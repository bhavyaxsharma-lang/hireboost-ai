/**
 * Thin HTTP proxy between the Replit reverse proxy and Metro.
 *
 * Routing context:
 *  Replit path-based proxy: /mobile/* → this server (port 25516) without
 *  stripping the prefix. We strip BASE_PATH before forwarding to Metro.
 *
 * Web canvas (browser):
 *  HTML responses: asset URLs are rewritten to include BASE_PATH prefix,
 *  and history.replaceState is injected so expo-router sees "/" not "/mobile/".
 *
 * Native Expo Go:
 *  Metro generates asset/bundle URLs without the /mobile/ prefix (just the hostname).
 *  We intercept JSON manifest responses and rewrite all
 *    https://EXPO_DEV_DOMAIN/          →  https://EXPO_DEV_DOMAIN/mobile/
 *  so Expo Go fetches bundle + assets through /mobile/ → shared proxy → back here → Metro.
 */

import http from "http";
import crypto from "crypto";

function computeWsAccept(key) {
  return crypto
    .createHash("sha1")
    .update(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11")
    .digest("base64");
}

const PROXY_PORT = parseInt(process.env.PORT || "25516", 10);
const METRO_PORT = parseInt(process.env.METRO_PORT || "25519", 10);
const BASE_PATH = (process.env.BASE_PATH || "/mobile/").replace(/\/$/, "");
const EXPO_DEV_DOMAIN = process.env.EXPO_DEV_DOMAIN || "";
// BASE_PATH without trailing slash: e.g. "/mobile"

// Injected before the bundle — changes window.location so expo-router sees "/"
const BASE_PATH_SCRIPT = `<script>
(function(){
  try{
    var base="${BASE_PATH}";
    var p=window.location.pathname;
    if(p===base||p===base+"/"){
      window.history.replaceState(null,"","/"+window.location.search+window.location.hash);
    } else if(p.startsWith(base+"/")){
      window.history.replaceState(null,"",p.slice(base.length)+window.location.search+window.location.hash);
    }
  } catch(e){}
})();
</script>`;

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasBasePrefix(url) {
  return url.startsWith(BASE_PATH + "/") || url === BASE_PATH;
}

function stripBase(url) {
  if (url.startsWith(BASE_PATH + "/")) return url.slice(BASE_PATH.length);
  if (url === BASE_PATH) return "/";
  return url;
}

function forwardRequest(clientReq, clientRes) {
  const rawPath = clientReq.url.split("?")[0];

  // Health-check: respond immediately
  if (
    rawPath === "/status" ||
    rawPath === `${BASE_PATH}/status` ||
    rawPath === `${BASE_PATH}status`
  ) {
    clientRes.writeHead(200, { "content-type": "text/plain" });
    clientRes.end("ok");
    return;
  }

  const needsRewrite = hasBasePrefix(clientReq.url);
  const metroPath = needsRewrite ? stripBase(clientReq.url) : clientReq.url;

  // Strip the Origin header before forwarding to Metro. Metro's CorsMiddleware
  // rejects requests whose Origin is not localhost. Since we're a trusted proxy
  // on the same machine, we drop the external Origin so Metro sees a local-only
  // connection and allows the request.
  const forwardHeaders = { ...clientReq.headers, host: `localhost:${METRO_PORT}` };
  delete forwardHeaders["origin"];

  const options = {
    hostname: "localhost",
    port: METRO_PORT,
    path: metroPath,
    method: clientReq.method,
    headers: forwardHeaders,
  };

  const proxyReq = http.request(options, (proxyRes) => {
    const contentType = proxyRes.headers["content-type"] || "";
    const isHtml = contentType.includes("text/html");

    // Detect Expo manifest: an application/expo+json or multipart/mixed response
    // when the client sent an Expo manifest Accept header.
    // Triggered for /mobile/ prefixed paths AND for root "/" requests (which Expo Go
    // hits when reconnecting after an error using just the bare expo domain URL).
    const clientAccept = clientReq.headers["accept"] || "";
    const isExpoAccept =
      clientAccept.includes("application/expo+json") ||
      clientAccept.includes("multipart/mixed");
    const isManifest =
      EXPO_DEV_DOMAIN &&
      (contentType.includes("application/expo+json") ||
        contentType.includes("multipart/mixed")) &&
      (needsRewrite || isExpoAccept);

    // Stream through unchanged for binary/JS/other content
    if (!isHtml && !isManifest) {
      clientRes.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(clientRes, { end: true });
      return;
    }

    // Collect body for rewriting
    let body = "";
    proxyRes.setEncoding("utf8");
    proxyRes.on("data", (chunk) => {
      body += chunk;
    });
    proxyRes.on("end", () => {
      let rewritten = body;

      if (isHtml) {
        // Rewrite root-relative asset URLs to include BASE_PATH
        rewritten = body
          .replace(/src="\/node_modules\//g, `src="${BASE_PATH}/node_modules/`)
          .replace(/src="\/_expo\//g, `src="${BASE_PATH}/_expo/`)
          .replace(/href="\/_expo\//g, `href="${BASE_PATH}/_expo/`)
          .replace(
            /href="\/(?![\/]|mobile\/|http|_expo)/g,
            `href="${BASE_PATH}/`
          );
        // Inject URL-fix script before </head>
        rewritten = rewritten.replace("</head>", BASE_PATH_SCRIPT + "</head>");
      }

      if (isManifest) {
        // Rewrite "https://EXPO_DEV_DOMAIN/" → "https://EXPO_DEV_DOMAIN/mobile/"
        // for any absolute URL that doesn't already include the /mobile/ prefix.
        const urlPattern = new RegExp(
          `https://${escapeRegex(EXPO_DEV_DOMAIN)}/(?!mobile/)`,
          "g"
        );
        rewritten = rewritten.replace(
          urlPattern,
          `https://${EXPO_DEV_DOMAIN}/mobile/`
        );

        // Fix "hostUri" and "debuggerHost" — these are bare hostname strings
        // (no https:// prefix) that Expo Go uses to reconnect to the dev server
        // when reloading or recovering from an error.  Without /mobile they hit
        // the root of the expo domain which has no handler → "Package not running".
        const escaped = escapeRegex(EXPO_DEV_DOMAIN);
        rewritten = rewritten
          // "hostUri":"EXPO_DEV_DOMAIN"  →  "hostUri":"EXPO_DEV_DOMAIN/mobile"
          .replace(
            new RegExp(`("hostUri"\\s*:\\s*")${escaped}(?!/mobile)(")`,"g"),
            `$1${EXPO_DEV_DOMAIN}/mobile$2`
          )
          // "debuggerHost":"EXPO_DEV_DOMAIN"  →  "debuggerHost":"EXPO_DEV_DOMAIN/mobile"
          .replace(
            new RegExp(`("debuggerHost"\\s*:\\s*")${escaped}(?!/mobile)(")`,"g"),
            `$1${EXPO_DEV_DOMAIN}/mobile$2`
          );

        console.log(
          `[web-proxy] Rewrote manifest URLs for native Expo Go (${EXPO_DEV_DOMAIN})`
        );
      }

      const responseHeaders = { ...proxyRes.headers };
      responseHeaders["content-length"] = Buffer.byteLength(
        rewritten,
        "utf8"
      ).toString();
      delete responseHeaders["transfer-encoding"];

      clientRes.writeHead(proxyRes.statusCode, responseHeaders);
      clientRes.end(rewritten);
    });
  });

  proxyReq.on("error", (err) => {
    if (err.code !== "ECONNREFUSED") {
      console.error(
        "[web-proxy] upstream error:",
        err.message,
        "for",
        clientReq.url
      );
    }
    if (!clientRes.headersSent) clientRes.writeHead(502);
    clientRes.end("Bad Gateway");
  });

  clientReq.pipe(proxyReq, { end: true });
}

function forwardUpgrade(clientReq, clientSocket, head) {
  // Browser-initiated WebSocket connections (HMR for the web canvas preview).
  // The Expo web bundle sends registerEntryPoints with /mobile/-prefixed URLs.
  // Forwarding these to Metro causes it to crash (UnableToResolveError on the
  // entry path). Instead, absorb the connection: complete the WS handshake so
  // the browser doesn't error, but don't forward any messages to Metro.
  const ua = clientReq.headers["user-agent"] || "";
  if (ua.includes("Mozilla")) {
    const key = clientReq.headers["sec-websocket-key"] || "";
    const accept = computeWsAccept(key);
    clientSocket.write(
      `HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`
    );
    clientSocket.on("error", () => {});
    clientSocket.on("data", () => {});
    return;
  }

  const metroPath = hasBasePrefix(clientReq.url)
    ? stripBase(clientReq.url)
    : clientReq.url;

  const wsHeaders = { ...clientReq.headers, host: `localhost:${METRO_PORT}` };
  delete wsHeaders["origin"];

  const target = http.request({
    hostname: "localhost",
    port: METRO_PORT,
    path: metroPath,
    method: clientReq.method,
    headers: wsHeaders,
  });

  target.on("upgrade", (res, metroSock, upgradeHead) => {
    const headerLines = Object.entries(res.headers)
      .map(([k, v]) => `${k}: ${v}`)
      .join("\r\n");
    clientSocket.write(
      `HTTP/1.1 101 Switching Protocols\r\n${headerLines}\r\n\r\n`
    );
    if (upgradeHead?.length) metroSock.unshift(upgradeHead);
    metroSock.pipe(clientSocket);
    clientSocket.pipe(metroSock);
    clientSocket.on("error", () => metroSock.destroy());
    metroSock.on("error", () => clientSocket.destroy());
  });

  target.on("error", () => clientSocket.destroy());
  target.end();
}

const server = http.createServer(forwardRequest);
server.on("upgrade", forwardUpgrade);

server.listen(PROXY_PORT, () => {
  console.log(
    `[web-proxy] :${PROXY_PORT} → Metro :${METRO_PORT}  base="${BASE_PATH}"  expo-domain="${EXPO_DEV_DOMAIN}"`
  );
});
