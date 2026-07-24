#!/bin/bash

# Logistics Aggregator Portal - Reset Rate Limits
# ------------------------------------------------
# Clears rate-limit state across ALL services.
#
# Two storage models are in play (verified in the codebase):
#   1. In-memory (express-rate-limit default): api-gateway, auth, partner,
#      shipment, user, support, platform, license. State lives in the Node
#      process, so RESTARTING the service is what clears it.
#   2. Redis-backed: wallet-service uses a custom Redis store whose keys are
#      the bare client IP (no namespace prefix), TTL 15 min. A restart does NOT
#      clear these, so we delete them from Redis directly.
#
# Redis (db 0) is shared with sessions/permissions/cache, so we NEVER flush it.
# We only delete keys that look like a bare IP / IPv6-mapped IP — the exact
# shape wallet's limiter produces and which no legitimate app key uses.
#
# Usage:
#   ./scripts/reset-rate-limits.sh          # development compose
#   ./scripts/reset-rate-limits.sh --prod   # production compose

set -euo pipefail

SERVICES="api-gateway auth-service user-service shipment-service partner-service wallet-service support-service platform-service license-service"

if [[ "${1:-}" == "--prod" ]]; then
  DC="docker-compose -f docker-compose.production.yml --env-file .env.production"
  echo "🔒 Target: PRODUCTION compose"
else
  DC="docker-compose"
  echo "🛠️  Target: DEVELOPMENT compose"
fi

echo ""
echo "🔄 Restarting backend services (clears in-memory rate limiters)..."
# shellcheck disable=SC2086
$DC restart $SERVICES

echo ""
echo "🧹 Clearing wallet-service Redis rate-limit keys (bare-IP keys only)..."

# Lua runs atomically inside Redis: SCAN the keyspace and DEL only keys whose
# name is a bare IPv4 (a.b.c.d[:port]) or an IPv6-mapped IPv4 (::ffff:...).
# This spares session:*, permissions:*, geo:*, zones:* and every namespaced key.
LUA='
local deleted = 0
local cursor = "0"
repeat
  local res = redis.call("SCAN", cursor, "COUNT", 500)
  cursor = res[1]
  for _, key in ipairs(res[2]) do
    if string.match(key, "^%d+%.%d+%.%d+%.%d+")
       or string.match(key, "^::ffff:")
       or string.match(key, "^::1") then
      redis.call("DEL", key)
      deleted = deleted + 1
    end
  end
until cursor == "0"
return deleted
'

DELETED=$($DC exec -T redis redis-cli EVAL "$LUA" 0 2>/dev/null | tr -d '\r' || echo "0")
echo "   Deleted ${DELETED:-0} rate-limit key(s) from Redis."

echo ""
echo "✅ Rate limits reset across all services."
echo "   In-memory limiters: cleared by restart."
echo "   Wallet Redis limiter: keys deleted (remaining ones expire within 15 min)."
