/**
 * Thin HTTP proxy between the Replit reverse proxy and Metro.
 *
 * Routing context:
 *  Replit path-based proxy: /mobile/* → this server (port 25516) without
 *  stripping the prefix. We strip BASE_PATH before forwarding to Metro.
 *  HTML responses need base-path-prefixed asset URLs so the browser can
 *  route them back through this proxy.
 *
 * expo-router routing on web is handled by the history.replaceState injection
 * below (changes /mobile/ → / before the bundle runs). No EXPO_BASE_URL needed.
 */

import http from "http";

const PROXY_PORT = parseInt(process.env.PORT || "25516", 10);
const METRO_PORT = parseInt(process.env.METRO_PORT || "25519", 10);
const BASE_PATH = (process.env.BASE_PATH || "/mobile/").replace(/\/$/, "");
// BASE_PATH without trailing slash: e.g. "/mobile"

// Injected before the bundle — changes window.location so expo-router sees "/"
// Uses replaceState (no navigation event fired) so the canvas wrapper doesn't detect the URL change.
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

function hasBasePrefix(url) {
  return url.startsWith(BASE_PATH + "/") || url === BASE_PATH;
}

function stripBase(url) {
  if (url.startsWith(BASE_PATH + "/")) return url.slice(BASE_PATH.length);
  if (url === BASE_PATH) return "/";
  return url; // pass through as-is
}

function forwardRequest(clientReq, clientRes) {
  // Respond to health-check paths immediately without hitting Metro
  const rawPath = clientReq.url.split("?")[0];
  if (rawPath === "/status" || rawPath === `${BASE_PATH}/status` || rawPath === `${BASE_PATH}status`) {
    clientRes.writeHead(200, { "content-type": "text/plain" });
    clientRes.end("ok");
    return;
  }

  const needsRewrite = hasBasePrefix(clientReq.url);
  const metroPath = needsRewrite ? stripBase(clientReq.url) : clientReq.url;

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

    // For non-HTML or for requests that don't carry the base prefix,
    // stream through without modification.
    if (!isHtml || !needsRewrite) {
      clientRes.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(clientRes, { end: true });
      return;
    }

    // Collect HTML, rewrite asset paths to include BASE_PATH, inject fix script
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
        // Favicon and other root-relative hrefs (not already prefixed)
        .replace(/href="\/(?![\/]|mobile\/|http|_expo)/g, `href="${BASE_PATH}/`);

      // Inject URL fix before </head> so expo-router sees "/" not "/mobile/"
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
  const metroPath = hasBasePrefix(clientReq.url)
    ? stripBase(clientReq.url)
    : clientReq.url;

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
