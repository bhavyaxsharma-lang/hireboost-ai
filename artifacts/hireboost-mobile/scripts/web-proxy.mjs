/**
 * Thin HTTP proxy between the Replit reverse proxy and Metro.
 *
 * The Replit reverse proxy routes /mobile/* to this server WITHOUT stripping
 * the /mobile/ prefix.  So this proxy:
 *   1. Strips BASE_PATH prefix from incoming URLs before forwarding to Metro.
 *   2. For HTML responses, rewrites absolute paths in src/href attributes to
 *      include BASE_PATH, and injects a <script> that removes the base-path
 *      prefix from window.location before expo-router initialises (so route
 *      matching works correctly inside the SPA).
 *   3. Passes WebSocket upgrades (HMR) through transparently.
 */

import http from "http";

const PROXY_PORT = parseInt(process.env.PORT || "25516", 10);
const METRO_PORT = parseInt(process.env.METRO_PORT || "25519", 10);
const BASE_PATH = (process.env.BASE_PATH || "/mobile/").replace(/\/$/, "");
// BASE_PATH without trailing slash: e.g. "/mobile"

// Injected before the bundle — strips base path so expo-router sees "/"
const BASE_PATH_SCRIPT = `<script>
(function(){
  var base="${BASE_PATH}";
  var p=window.location.pathname;
  if(p===base||p===base+"/"){
    window.history.replaceState(null,"","/"+window.location.search+window.location.hash);
  } else if(p.startsWith(base+"/")){
    window.history.replaceState(null,"",p.slice(base.length)+window.location.search+window.location.hash);
  }
})();
</script>`;

function stripBase(url) {
  if (url.startsWith(BASE_PATH + "/")) return url.slice(BASE_PATH.length);
  if (url === BASE_PATH) return "/";
  return url; // unrecognized prefix — forward as-is
}

function forwardRequest(clientReq, clientRes) {
  const metroPath = stripBase(clientReq.url);

  const options = {
    hostname: "localhost",
    port: METRO_PORT,
    path: metroPath,
    method: clientReq.method,
    headers: { ...clientReq.headers, host: `localhost:${METRO_PORT}` },
  };

  const proxyReq = http.request(options, (proxyRes) => {
    const contentType = proxyRes.headers["content-type"] || "";
    const isHtml = contentType.includes("text/html");

    if (!isHtml) {
      clientRes.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(clientRes, { end: true });
      return;
    }

    // Collect HTML, rewrite paths, inject base-path fix script
    let body = "";
    proxyRes.setEncoding("utf8");
    proxyRes.on("data", (chunk) => { body += chunk; });
    proxyRes.on("end", () => {
      let rewritten = body
        // Bundle entry script
        .replace(/src="\/node_modules\//g, `src="${BASE_PATH}/node_modules/`)
        // Expo internal static assets
        .replace(/src="\/_expo\//g, `src="${BASE_PATH}/_expo/`)
        .replace(/href="\/_expo\//g, `href="${BASE_PATH}/_expo/`)
        // Favicon and other root-relative hrefs
        .replace(/href="\/(?![\/]|mobile\/|http|_expo)/g, `href="${BASE_PATH}/`);

      // Inject the base-path fix script just before </head>
      rewritten = rewritten.replace("</head>", BASE_PATH_SCRIPT + "</head>");

      const responseHeaders = { ...proxyRes.headers };
      responseHeaders["content-length"] = Buffer.byteLength(rewritten, "utf8").toString();
      delete responseHeaders["transfer-encoding"];

      clientRes.writeHead(proxyRes.statusCode, responseHeaders);
      clientRes.end(rewritten);
    });
  });

  proxyReq.on("error", (err) => {
    if (err.code !== "ECONNREFUSED") {
      console.error("[web-proxy] upstream error:", err.message, "for", clientReq.url);
    }
    if (!clientRes.headersSent) clientRes.writeHead(502);
    clientRes.end("Bad Gateway");
  });

  clientReq.pipe(proxyReq, { end: true });
}

function forwardUpgrade(clientReq, clientSocket, head) {
  const metroPath = stripBase(clientReq.url);
  const target = http.request({
    hostname: "localhost",
    port: METRO_PORT,
    path: metroPath,
    method: clientReq.method,
    headers: { ...clientReq.headers, host: `localhost:${METRO_PORT}` },
  });

  target.on("upgrade", (res, metroSock, upgradeHead) => {
    const headerLines = Object.entries(res.headers)
      .map(([k, v]) => `${k}: ${v}`)
      .join("\r\n");
    clientSocket.write(`HTTP/1.1 101 Switching Protocols\r\n${headerLines}\r\n\r\n`);
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
  console.log(`[web-proxy] :${PROXY_PORT} → Metro :${METRO_PORT}  base="${BASE_PATH}"`);
});
