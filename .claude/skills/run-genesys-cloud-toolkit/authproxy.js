// Injects HTTP Basic Auth into every proxied request so browser automation can reach the app
// without triggering the native browser Basic Auth dialog — that dialog is modal and blocks all
// further CDP/automation events once it appears, effectively freezing the tab.
//
// Usage:
//   APP_PASS=<value from .app-password, or the "App access gate ->" line the server prints>
//   TARGET=http://localhost:3000 PROXY_PORT=4200 APP_USER=team APP_PASS=$APP_PASS node authproxy.js
//
// Then drive PROXY_PORT (default 4200) instead of TARGET with your browser tool.
const http = require('http');

const TARGET = process.env.TARGET || 'http://localhost:3000';
const USER = process.env.APP_USER || 'team';
const PASS = process.env.APP_PASS || '';
const PORT = process.env.PROXY_PORT || 4200;
const target = new URL(TARGET);

if (!PASS) {
  console.error('APP_PASS is required (read it from .app-password or the server\'s startup log line).');
  process.exit(1);
}

const server = http.createServer((req, res) => {
  const authHeader = 'Basic ' + Buffer.from(`${USER}:${PASS}`).toString('base64');
  const opts = {
    hostname: target.hostname,
    port: target.port,
    path: req.url,
    method: req.method,
    headers: { ...req.headers, host: target.host, authorization: authHeader },
  };
  const proxyReq = http.request(opts, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });
  req.pipe(proxyReq);
  proxyReq.on('error', (e) => {
    res.writeHead(502);
    res.end(String(e));
  });
});

server.listen(PORT, () => console.log(`Auth proxy on :${PORT} -> ${TARGET}`));
