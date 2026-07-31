const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const { REGIONS } = require('./regions');
const createArchitectRouter = require('./architect');

const app = express();
const PORT = process.env.PORT || 3000;

// A failed MongoDB connection inside connect-mongo can otherwise surface as an unhandled
// rejection and take down the whole serverless instance instead of just failing one request.
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection (kept process alive):', reason);
});

// Stable secrets that must not change on every process restart (colleagues would get logged
// out, and on serverless hosts like Vercel every cold start would sign cookies with a different
// secret, breaking sessions constantly). If the env var isn't set, generate one and cache it to
// a local file for local-dev convenience. On read-only filesystems (e.g. Vercel without the env
// var set) the write silently fails and we fall back to a value that's random per instance —
// which is exactly why APP_PASSWORD/SESSION_SECRET/MONGODB_URI must be set as real env vars there.
function resolveSecret(envVar, cacheFileName, byteLength) {
  if (process.env[envVar]) return process.env[envVar];
  const cacheFile = path.join(__dirname, cacheFileName);
  try {
    return fs.readFileSync(cacheFile, 'utf8').trim();
  } catch {
    const generated = crypto.randomBytes(byteLength).toString('base64url');
    try {
      fs.writeFileSync(cacheFile, generated);
    } catch {
      console.warn(`Could not persist ${envVar} to disk (read-only filesystem?) — set the ${envVar} env var explicitly.`);
    }
    return generated;
  }
}

// Shared-password gate: this app accepts arbitrary Genesys OAuth credentials from whoever
// reaches it, so once it's exposed off localhost (tunnel, cloud host, etc.) it must not be
// left open to anyone who finds the URL. Override APP_USER/APP_PASSWORD via env vars.
const APP_USER = process.env.APP_USER || 'team';
const APP_PASSWORD = resolveSecret('APP_PASSWORD', '.app-password', 9);
console.log(`App access gate -> user: "${APP_USER}"  password: "${APP_PASSWORD}"`);

app.use((req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, encoded] = header.split(' ');
  if (scheme === 'Basic' && encoded) {
    const [user, pass] = Buffer.from(encoded, 'base64').toString('utf8').split(':');
    if (user === APP_USER && pass === APP_PASSWORD) return next();
  }
  res.set('WWW-Authenticate', 'Basic realm="Genesys Cloud Toolkit"');
  res.status(401).send('Authentication required.');
});

app.use(express.json({ limit: '2mb' }));

// Vercel (and most PaaS hosts) sit behind a reverse proxy that terminates TLS, so Express needs
// to trust its X-Forwarded-* headers to know the original request was HTTPS (req.secure, secure cookies).
app.set('trust proxy', 1);

// On Vercel, each request can hit a different serverless instance with its own empty memory, so
// the default in-memory session store would silently drop everyone's login on almost every request.
// Set MONGODB_URI (e.g. in Vercel's project environment variables) to persist sessions in MongoDB
// instead; without it, this falls back to the in-memory store, which is fine for local dev.
const SESSION_SECRET = resolveSecret('SESSION_SECRET', '.session-secret', 32);
const sessionStore = process.env.MONGODB_URI
  ? MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      collectionName: 'sessions',
      ttl: 60 * 60 * 24,
      // Forces IPv4 for the driver's TCP connections. Without this, some hosting networks (this
      // one included) hit a TLS handshake failure against Atlas's proxy over IPv6.
      mongoOptions: { family: 4 },
    })
  : undefined;

if (process.env.MONGODB_URI) console.log('Session store: MongoDB');
else console.log('Session store: in-memory (set MONGODB_URI to persist sessions across serverless instances)');

app.use(
  session({
    name: 'gct.sid',
    secret: SESSION_SECRET,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 1000,
    },
  })
);
app.use(express.static(path.join(__dirname, 'public')));

// Tokens are refreshed a bit early so an in-flight request never gets a token that
// expires between validation and the actual call to Genesys.
const TOKEN_REFRESH_SKEW_MS = 60 * 1000;

async function requestToken(region, clientId, clientSecret) {
  const regionInfo = REGIONS[region];
  if (!regionInfo) {
    const err = new Error(`Unknown region: ${region}`);
    err.status = 400;
    throw err;
  }

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const resp = await fetch(`https://${regionInfo.loginHost}/oauth/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const err = new Error(data.error_description || data.message || 'Failed to authenticate with Genesys Cloud');
    err.status = resp.status;
    throw err;
  }

  return {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}

// On serverless hosts, the function can freeze right after the response is sent — before an
// async session-store write (e.g. to MongoDB) has actually finished. Explicitly awaiting
// session.save() guarantees the write completes before we respond, instead of racing it.
function saveSession(req) {
  return new Promise((resolve, reject) => {
    req.session.save((err) => (err ? reject(err) : resolve()));
  });
}

async function getValidToken(req) {
  const auth = req.session.gcAuth;
  if (!auth) {
    const err = new Error('Not authenticated. Please log in first.');
    err.status = 401;
    throw err;
  }

  if (!auth.accessToken || Date.now() >= auth.expiresAt - TOKEN_REFRESH_SKEW_MS) {
    const { accessToken, expiresAt } = await requestToken(auth.region, auth.clientId, auth.clientSecret);
    auth.accessToken = accessToken;
    auth.expiresAt = expiresAt;
    await saveSession(req);
  }

  return auth;
}

app.use('/api/architect', createArchitectRouter({ getValidToken, saveSession, REGIONS }));

app.get('/api/regions', (req, res) => {
  const list = Object.entries(REGIONS).map(([id, info]) => ({ id, label: info.label, code: info.code }));
  res.json(list);
});

app.post('/api/auth/login', async (req, res) => {
  const { clientId, clientSecret, region } = req.body || {};
  if (!clientId || !clientSecret || !region) {
    return res.status(400).json({ error: 'clientId, clientSecret and region are all required.' });
  }

  try {
    const { accessToken, expiresAt } = await requestToken(region, clientId, clientSecret);
    req.session.gcAuth = { clientId, clientSecret, region, accessToken, expiresAt };
    await saveSession(req);
    res.json({ ok: true, region });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.get('/api/auth/status', (req, res) => {
  const auth = req.session.gcAuth;
  if (!auth) return res.json({ authenticated: false });
  res.json({ authenticated: true, region: auth.region });
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// Generic proxy: every feature screen and the API Explorer tab route through here.
// Restricted to Genesys Cloud's public API namespace so this can't become an open relay.
app.post('/api/proxy', async (req, res) => {
  const { method, path: apiPath, query, body } = req.body || {};

  if (!apiPath || typeof apiPath !== 'string' || !apiPath.startsWith('/api/v2/')) {
    return res.status(400).json({ error: 'path must be a Genesys Cloud API path starting with /api/v2/' });
  }

  const httpMethod = (method || 'GET').toUpperCase();
  if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(httpMethod)) {
    return res.status(400).json({ error: `Unsupported method: ${httpMethod}` });
  }

  try {
    const auth = await getValidToken(req);
    const regionInfo = REGIONS[auth.region];

    const url = new URL(`https://${regionInfo.apiHost}${apiPath}`);
    if (query && typeof query === 'object') {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
      }
    }

    const fetchOpts = {
      method: httpMethod,
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
        'Content-Type': 'application/json',
      },
    };
    if (httpMethod !== 'GET' && httpMethod !== 'DELETE' && body !== undefined) {
      fetchOpts.body = JSON.stringify(body);
    }

    const gcResp = await fetch(url.toString(), fetchOpts);
    const text = await gcResp.text();
    const contentType = gcResp.headers.get('content-type') || '';

    res.status(gcResp.status);
    if (contentType.includes('application/json') && text) {
      res.type('application/json').send(text);
    } else {
      res.json(text ? { message: text } : {});
    }
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Catches errors from middleware that runs before any route handler — e.g. the session store
// failing to reach MongoDB — so the client gets a JSON error instead of Express's default HTML page.
app.use((err, req, res, next) => {
  console.error('Unhandled request error:', err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Server error: ' + (err && err.message ? err.message : 'unknown') });
});

// Vercel imports `app` and calls it directly as a request handler per invocation — it never runs
// this file's top-level app.listen(). Locally (and on any other Node host) we still need it.
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Genesys Cloud Toolkit running at http://localhost:${PORT}`);
  });
}

module.exports = app;
