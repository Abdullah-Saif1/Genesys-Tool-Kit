---
name: run-genesys-cloud-toolkit
description: Build, run, and drive the Genesys Cloud Toolkit (Node/Express admin web app). Use when asked to start the app, run its backend smoke test, take a screenshot of its UI, log in, or exercise the Architect / Audit Log / Canned Responses screens without real Genesys credentials.
---

Node/Express app (`server.js`) serving a static frontend (`public/`) behind an HTTP Basic Auth
gate, with a second, in-app Genesys Cloud OAuth login on top of that. Drive it two ways: `smoke.sh`
for a browser-free backend check (fastest, covers most routes), or the Chrome browser tool for a
real UI screenshot — both need the auth-proxy trick below to get past the Basic Auth gate.

All paths below are relative to the repo root (`genesys-cloud-toolkit/`).

## Prerequisites

No system packages needed. Node is the only requirement:

```bash
node --version   # tested against v18.15.0 — see Gotchas re: the package.json engines field
```

## Setup

```bash
npm install
```

No env vars are required for local dev. `MONGODB_URI` / `SESSION_SECRET` / `APP_USER` /
`APP_PASSWORD` are optional and only matter for the Vercel deployment (see README.md); locally the
app falls back to an in-memory session store and a password cached in `.app-password`.

## Run (agent path)

### 1. Start the server

```bash
npm start &
timeout 30 bash -c 'until curl -sf -o /dev/null http://localhost:3000/ || [ $? = 22 ]; do sleep 1; done'
```

It prints the Basic Auth gate credentials on startup — capture them:

```
App access gate -> user: "team"  password: "<random>"
```

The password is also cached in `.app-password` (gitignored) across restarts:

```bash
APP_PASS=$(cat .app-password)
```

Stop it with `lsof -ti:3000 -sTCP:LISTEN | xargs -r kill` (or on Windows, find the PID via
`netstat -ano | grep :3000` and `taskkill //PID <pid> //F`) before relaunching, or the next start
hits `EADDRINUSE`.

### 2a. Backend-only smoke test (no browser, fastest — start here)

```bash
BASE=http://localhost:3000 APP_USER=team APP_PASS="$APP_PASS" \
  bash .claude/skills/run-genesys-cloud-toolkit/smoke.sh
```

Checks the Basic Auth gate, the static shell, every unauthenticated API route (`/api/regions`,
`/api/architect/flow-types`, `/api/architect/providers`), that Genesys-session-gated routes
correctly 401/400 without one, and a full save-key → test-key round trip against the real
Anthropic API using a deliberately-invalid key (expects a genuine `401 invalid x-api-key`, which
proves the request actually reached Anthropic rather than failing locally). Verified output:

```
9 passed, 0 failed
```

Most backend PRs (new `/api/architect/*` routes, proxy logic, provider key handling) only need
this layer — no browser required.

### 2b. Full UI, screenshot-driven (Chrome browser tool)

The app's Basic Auth gate is an HTTP `WWW-Authenticate: Basic` challenge. A real browser turns
that into a native modal dialog that blocks all further automation — so route through a small
local proxy that injects the `Authorization` header instead of ever hitting that dialog:

```bash
APP_PASS=$(cat .app-password)
TARGET=http://localhost:3000 PROXY_PORT=4200 APP_USER=team APP_PASS="$APP_PASS" \
  node .claude/skills/run-genesys-cloud-toolkit/authproxy.js &
```

Then drive `http://localhost:4200/` (not port 3000) with the browser tool
(`mcp__claude-in-chrome__navigate` / `computer` / `javascript_tool`, or `chromium-cli` if that's
what's available in your environment — the proxy trick is what matters, not the driver). This
gets you to the **login screen** (region + OAuth Client ID/Secret) — verified with a real
screenshot.

To see the **authenticated app shell** without a real Genesys Cloud org (no OAuth client needed),
force the state directly — the frontend is a plain `<script src="app.js">`, so its functions are
on `window`:

```js
setAuthenticated(true, 'us-east-1');
```

This flips the login view to the sidebar/tab shell and lands on Canned Responses. From there,
`setActiveTab('architect')` / `'audit'` / `'queues'` / etc. switches tabs. API calls made from
these tabs will 401 (no real Genesys session exists server-side) — that's expected; this path is
for verifying the UI renders and lays out correctly, not for exercising live Genesys data. To
actually authenticate, you need a real Genesys Cloud OAuth Client Credentials grant (Client
ID/Secret) — the app itself has no way to fake that server-side, and none of the API tabs return
real data without one. Confirmed working in this exact way: login screen, main shell, Architect
tab, mobile layout toggle, and dark/light theme toggle all screenshotted successfully this way.

## Run (human path)

```bash
npm start
```

Then open `http://localhost:3000`, enter the printed Basic Auth credentials at the browser's
native prompt, then a real Genesys Cloud OAuth Client ID/Secret on the app's own login screen.
Ctrl-C to stop.

## Test

No automated test suite exists in this repo (no `test` script in `package.json`). `smoke.sh`
above is the closest thing to one.

## Gotchas

- **`package.json` declares `"engines": {"node": ">=20.0.0"}` but the app runs fine on Node
  18.15.0** for everything except actually deploying an Architect flow — the
  `purecloud-flow-scripting-api-sdk-javascript` require is wrapped in a `try/catch` inside the
  `/api/architect/deploy` route specifically, returning a `501` with an explanatory message on
  older Node instead of crashing. Every other route (including flow *generation*, which doesn't
  touch that SDK) works normally on 18. `npm install` prints `EBADENGINE` warnings for this and
  for the SDK's own engines field — both harmless for everything except live deploys.
- **The Basic Auth dialog freezes browser automation.** Don't navigate the browser tool straight
  to `:3000` — route through `authproxy.js` on `:4200` as shown above. Once triggered, the native
  dialog can't be dismissed programmatically (this is a Claude-in-Chrome-wide restriction, not
  specific to this app).
- **`setAuthenticated(true, ...)` only fakes the client-side view state**, not a server session —
  it's for screenshotting layout/UI, not for exercising features that call `/api/proxy` or
  `/api/architect/*` routes requiring `req.session.gcAuth` (those still 401). There's no way to
  fake a real Genesys session without real OAuth credentials.
- **Mobile/dark-mode toggles are plain localStorage flags**, not viewport-driven — `gct-theme` /
  `gct-layout` keys, toggled via the icon buttons top-right of the header, independent of actual
  window size. Useful because headless browser tools here don't reliably resize the render
  viewport, but the forced-mobile CSS path (`html.is-mobile`) is fully testable this way regardless.

## Troubleshooting

- **`EADDRINUSE: address already in use :::3000`**: something (often a previous session's `npm
  start &`) is still bound to the port. `netstat -ano | grep :3000` (Windows) or
  `lsof -ti:3000 -sTCP:LISTEN` (Linux/Mac) to find the PID, kill it, retry. This is often fine to
  leave running across turns of the same session instead of restarting — check with `curl -s -o
  /dev/null -w '%{http_code}' -u team:$APP_PASS http://localhost:3000/` (expect `200`) before
  assuming you need a fresh instance.
- **`{"error":"Cannot read properties of undefined (reading 'retrieve')"}` from
  `POST /api/architect/settings/api-key/test` with `provider: "anthropic"`**: this was a real bug
  hit and fixed while building this skill — the installed `@anthropic-ai/sdk` was pinned to
  `^0.32.0`, a version that predates the SDK's `client.models` resource used by `testProviderKey()`
  in `architect.js`. Fixed by bumping to `^0.115.0` (`npm install @anthropic-ai/sdk@^0.115.0`).
  If you see this error again, check `node_modules/@anthropic-ai/sdk/package.json`'s version and
  that `package.json`'s dependency range wasn't reverted.
- **`${VAR:?message}` with an apostrophe in the message breaks `bash -n` with `unexpected EOF
  while looking for matching` `'`**: hit this writing `smoke.sh` — even though the message is
  inside a double-quoted string, bash re-lexes the `:?word` portion using normal quoting rules, so
  a stray `'` (e.g. "the server's log") is parsed as an unterminated single quote. Avoid
  apostrophes in `${VAR:?...}` messages entirely.
