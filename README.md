# Genesys Cloud Toolkit

A local admin web app for standing up new Genesys Cloud implementations quickly. Log in with
just a Client ID / Client Secret, then manage Canned Responses (Response Management), Wrap-up
Codes, Queues, Users/Divisions, Skills, and run arbitrary API calls via a built-in explorer.

## Setup

```
npm install
npm start
```

Then open http://localhost:3000

## Genesys Cloud OAuth client

Create an OAuth client in **Admin → Integrations → OAuth**:

- Grant type: **Client Credentials**
- Assign a role with whatever permissions you need for the screens you'll use, e.g.:
  - Response Management (`all` or `view`/`add`/`edit`/`delete` on `responsemanagement`)
  - Routing (`wrapupcode`, `queue`, `skill`)
  - Users (`view`)
  - Authorization (`division` view)

Paste the resulting Client ID and Client Secret into the app's Login tab, pick the region your
org lives in, and connect. The secret is sent once to this local server (never to your browser's
JS beyond that one request) and is held in server memory for the life of your session only.

## How it works

- The Node/Express backend (`server.js`) performs the OAuth Client Credentials exchange and holds
  the resulting token server-side in an in-memory session, refreshing it automatically as needed.
- Every feature screen — and the API Explorer tab — calls a single generic proxy endpoint
  (`POST /api/proxy`) that forwards `{ method, path, query, body }` to Genesys Cloud's `/api/v2/*`
  API with the session's bearer token attached. This keeps the server thin and makes the explorer
  behave identically to the dedicated screens.
- Nothing is persisted to disk; restarting the server clears all sessions and credentials.

## Notes

- Sessions are in-memory and cookies are not marked `secure` (the app is served over plain HTTP
  on localhost; a tunnel/proxy in front of it can still add HTTPS, as below).
- The API Explorer only allows calls to paths starting with `/api/v2/`, matching Genesys Cloud's
  public API namespace.

## Sharing it with colleagues (public link)

The app sits behind an HTTP Basic Auth gate (`server.js`) so a stumbled-upon URL can't be used
by strangers as a free Genesys API proxy — this is on top of, not instead of, each person still
needing their own Genesys Client ID/Secret to do anything once inside.

- Username/password: printed to the server console on startup (`App access gate -> ...`), and
  cached in a local `.app-password` file (gitignored) so it survives restarts. Set `APP_USER` /
  `APP_PASSWORD` env vars to pin your own instead of using the generated one.
- **Quick public link (no account needed)**: run a Cloudflare quick tunnel from the machine
  running `npm start`:
  ```
  cloudflared tunnel --protocol http2 --url http://localhost:3000
  ```
  It prints a `https://<random-words>.trycloudflare.com` URL. Share that + the gate
  username/password with your colleagues. Caveats: the link only works while your machine, the
  Node server, and this tunnel process are all still running, and a new run gets a new random
  URL (no account = no stable custom subdomain). `--protocol http2` is worth keeping — the
  default QUIC/UDP transport can get stuck retrying on networks that block UDP.
## Deploying to Vercel (stable link, works even when your PC is off)

Vercel runs this as a serverless function (`vercel.json` points it at `server.js`), which means
**in-memory sessions don't survive between requests** — different invocations can land on
different instances with empty memory. That's what MongoDB is for here: it's used purely as the
session store (via `connect-mongo`), not as an app database. Nothing else is persisted.

1. **MongoDB Atlas**: in your cluster, create a database user (Database Access) and grab the
   connection string (Connect → Drivers) — it looks like
   `mongodb+srv://user:password@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`.
   Also allow access from anywhere (Network Access → 0.0.0.0/0), since Vercel's outbound IPs
   aren't fixed on the free plan.
2. **Log into Vercel** (only you can do this step — it opens a browser for you to authenticate):
   ```
   vercel login
   ```
3. From the project folder, link and deploy:
   ```
   vercel        # first run: link/create the project, deploy a preview
   vercel --prod # promote to your production URL
   ```
4. In the Vercel project's dashboard (Settings → Environment Variables), set:
   - `MONGODB_URI` — the connection string from step 1
   - `SESSION_SECRET` — any long random string (`node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`) — must stay fixed, or sessions break across cold starts
   - `APP_USER` / `APP_PASSWORD` — your chosen shared-gate login (see above) — also must be fixed for the same reason
   - `NODE_ENV=production` — makes the session cookie `secure` (HTTPS-only), which Vercel serves over anyway

   Redeploy (`vercel --prod`) after adding env vars so the running instance picks them up.

Locally, none of these env vars are required — the app falls back to in-memory sessions and a
`.app-password`/`.session-secret` file-cached secret, which is exactly what you want for `npm start`.
