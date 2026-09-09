#!/usr/bin/env bash
# Mandatory verification protocol (CLAUDE.md). Exits non-zero on first failure.
set -uo pipefail

usage() {
  cat <<'EOF'
usage: verify.sh <service>

  frontend      3000   api-gateway  3001   auth      3002
  user          3003   shipment     3004   partner   3005
  wallet        3006   support      3007   platform  3008
  license       3009
EOF
}

[ $# -eq 1 ] || { usage; exit 64; }

case "$1" in
  frontend)    PORT=3000; CONTAINER=logistics-frontend;           SVC=frontend ;;
  api-gateway) PORT=3001; CONTAINER=logistics-api-gateway;        SVC=api-gateway ;;
  auth)        PORT=3002; CONTAINER=logistics-auth-service;       SVC=auth-service ;;
  user)        PORT=3003; CONTAINER=logistics-user-service;       SVC=user-service ;;
  shipment)    PORT=3004; CONTAINER=logistics-shipment-service;   SVC=shipment-service ;;
  partner)     PORT=3005; CONTAINER=logistics-partner-service;    SVC=partner-service ;;
  wallet)      PORT=3006; CONTAINER=logistics-wallet-service;     SVC=wallet-service ;;
  support)     PORT=3007; CONTAINER=logistics-support-service;    SVC=support-service ;;
  platform)    PORT=3008; CONTAINER=logistics-platform-service;   SVC=platform-service ;;
  license)     PORT=3009; CONTAINER=logistics-license-service;    SVC=license-service ;;
  *) echo "unknown service: $1" >&2; usage; exit 64 ;;
esac

fail() { echo "❌ FAIL: $*" >&2; exit 1; }

echo "▸ 1/5 restarting $SVC"
docker-compose restart "$SVC" || fail "docker-compose restart $SVC"

# Give the process a moment to bind its port and flush startup logs.
sleep 5

echo "▸ 2/5 checking logs"
LOGS=$(docker logs "$CONTAINER" --tail=50 2>&1) || fail "docker logs $CONTAINER"
if printf '%s\n' "$LOGS" | grep -qiE '(^|[^a-z])(error|cannot find|eaddrinuse|unhandledrejection)'; then
  printf '%s\n' "$LOGS" | grep -inE '(^|[^a-z])(error|cannot find|eaddrinuse|unhandledrejection)' >&2
  fail "errors in $CONTAINER logs"
fi
echo "  clean"

echo "▸ 3/5 checking for MODULE_NOT_FOUND (zero tolerance)"
# grep exits 1 on no match while still being the success case here, so capture
# the output and judge on that rather than on the exit code.
MODERR=$(docker logs "$CONTAINER" 2>&1 | grep -c MODULE_NOT_FOUND || true)
[ "${MODERR:-0}" -eq 0 ] || fail "$MODERR MODULE_NOT_FOUND occurrences in $CONTAINER"
echo "  none"

if [ "$SVC" = "frontend" ]; then
  echo "▸ 4/5 frontend build"
  yarn --cwd frontend build || fail "frontend build"
  echo "▸ 5/5 restarting frontend container so it serves the new build"
  docker-compose restart frontend || fail "restart frontend"
  echo "✅ frontend verified"
  exit 0
fi

echo "▸ 4/5 health endpoint"
HEALTH=$(curl -fsS -m 10 "http://localhost:$PORT/health") || fail "health endpoint on :$PORT"
printf '%s\n' "$HEALTH" | (command -v jq >/dev/null && jq . || cat)
printf '%s' "$HEALTH" | grep -q healthy || fail "health did not report healthy"

echo "▸ 5/5 endpoint reachability (unauthenticated - 401/403 is a pass)"
CODE=$(curl -s -o /dev/null -w '%{http_code}' -m 10 "http://localhost:$PORT/api/v1/")
case "$CODE" in
  5*) fail "api root returned $CODE" ;;
  000) fail "no response from :$PORT" ;;
  *) echo "  HTTP $CODE" ;;
esac

echo
echo "✅ $SVC passed the verification protocol"
echo "   Next: exercise the actual endpoint with a real token (api-tester agent),"
echo "   including invalid payload → 400, no token → 401, wrong role → 403."
