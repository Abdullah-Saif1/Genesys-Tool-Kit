#!/usr/bin/env bash
# Backend-only smoke test — no browser needed. Exercises the parts of the app that don't
# require a real Genesys Cloud org: the Basic Auth gate, static shell, and every Architect
# route that doesn't need a live Genesys session (requireGenesysAuth-gated routes correctly
# 401 without one, which this script also checks).
#
# Usage: BASE=http://localhost:3000 APP_USER=team APP_PASS=xxxxxxxxx ./smoke.sh
set -euo pipefail

BASE="${BASE:-http://localhost:3000}"
APP_USER="${APP_USER:-team}"
APP_PASS="${APP_PASS:?Set APP_PASS to the value from .app-password or the server startup log}"
AUTH="$APP_USER:$APP_PASS"
JAR="$(mktemp)"
trap 'rm -f "$JAR"' EXIT

pass=0
fail=0
check() {
  local desc="$1" expected="$2" actual="$3"
  if [ "$actual" = "$expected" ]; then
    echo "  OK   $desc ($actual)"
    pass=$((pass + 1))
  else
    echo "  FAIL $desc (expected $expected, got $actual)"
    fail=$((fail + 1))
  fi
}

echo "== auth gate =="
check "no credentials -> 401" 401 "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/")"
check "static shell -> 200"   200 "$(curl -s -u "$AUTH" -o /dev/null -w '%{http_code}' "$BASE/")"

echo "== unauthenticated API surface =="
check "GET /api/regions -> 200"          200 "$(curl -s -u "$AUTH" -o /dev/null -w '%{http_code}' "$BASE/api/regions")"
check "GET /api/auth/status -> 200"      200 "$(curl -s -u "$AUTH" -o /dev/null -w '%{http_code}' "$BASE/api/auth/status")"
check "GET /api/architect/flow-types"    200 "$(curl -s -u "$AUTH" -o /dev/null -w '%{http_code}' "$BASE/api/architect/flow-types")"
check "GET /api/architect/providers"     200 "$(curl -s -u "$AUTH" -o /dev/null -w '%{http_code}' "$BASE/api/architect/providers")"

echo "== routes that correctly require a Genesys session =="
check "GET /api/architect/flows -> 401"  401 "$(curl -s -u "$AUTH" -o /dev/null -w '%{http_code}' "$BASE/api/architect/flows")"
check "POST /api/proxy no path -> 400"   400 "$(curl -s -u "$AUTH" -o /dev/null -w '%{http_code}' -X POST "$BASE/api/proxy" -H 'Content-Type: application/json' -d '{}')"

echo "== AI provider key test (session-based, no real Genesys org needed) =="
curl -s -u "$AUTH" -c "$JAR" -b "$JAR" -X POST "$BASE/api/architect/settings/api-key" \
  -H 'Content-Type: application/json' \
  -d '{"provider":"anthropic","apiKey":"sk-ant-dummy-invalid-key-for-smoke-test"}' > /dev/null
test_resp="$(curl -s -u "$AUTH" -c "$JAR" -b "$JAR" -X POST "$BASE/api/architect/settings/api-key/test")"
if echo "$test_resp" | grep -q 'invalid x-api-key'; then
  echo "  OK   dummy Anthropic key correctly rejected by the real API ($test_resp)"
  pass=$((pass + 1))
else
  echo "  FAIL unexpected response: $test_resp"
  fail=$((fail + 1))
fi

echo
echo "$pass passed, $fail failed"
[ "$fail" -eq 0 ]
