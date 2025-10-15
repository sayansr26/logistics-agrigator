#!/bin/bash

###############################################################################
# Dockerfile Update Verification Script
# Verifies that all backend services use the enhanced entrypoint pattern
###############################################################################

set -e

SERVICES=(
    "auth-service"
    "user-service"
    "shipment-service"
    "partner-service"
    "wallet-service"
    "support-service"
    "platform-service"
    "license-service"
)

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Dockerfile Update Verification"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

TOTAL=0
PASSED=0
FAILED=0

for SERVICE in "${SERVICES[@]}"; do
    TOTAL=$((TOTAL + 1))
    DOCKERFILE="backend/$SERVICE/Dockerfile"
    
    echo "Checking $SERVICE..."
    
    # Check if Dockerfile exists
    if [ ! -f "$DOCKERFILE" ]; then
        echo "  ❌ Dockerfile not found"
        FAILED=$((FAILED + 1))
        continue
    fi
    
    # Check for required components
    HAS_BASH=$(grep -q "apk add --no-cache.*bash" "$DOCKERFILE" && echo "yes" || echo "no")
    HAS_ENTRYPOINT_COPY=$(grep -q "COPY scripts/entrypoint.sh" "$DOCKERFILE" && echo "yes" || echo "no")
    HAS_CHMOD=$(grep -q "chmod +x.*entrypoint.sh" "$DOCKERFILE" && echo "yes" || echo "no")
    HAS_ENTRYPOINT=$(grep -q 'ENTRYPOINT \["/usr/local/bin/entrypoint.sh"\]' "$DOCKERFILE" && echo "yes" || echo "no")
    HAS_CMD=$(grep -q 'CMD \["pnpm", "run", "dev"\]' "$DOCKERFILE" && echo "yes" || echo "no")
    NO_OLD_STARTSH=$(grep -q 'CMD \["/app/start.sh"\]' "$DOCKERFILE" && echo "no" || echo "yes")
    
    if [ "$HAS_BASH" = "yes" ] && \
       [ "$HAS_ENTRYPOINT_COPY" = "yes" ] && \
       [ "$HAS_CHMOD" = "yes" ] && \
       [ "$HAS_ENTRYPOINT" = "yes" ] && \
       [ "$HAS_CMD" = "yes" ] && \
       [ "$NO_OLD_STARTSH" = "yes" ]; then
        echo "  ✅ All checks passed"
        PASSED=$((PASSED + 1))
    else
        echo "  ❌ Failed checks:"
        [ "$HAS_BASH" = "no" ] && echo "    - Missing bash installation"
        [ "$HAS_ENTRYPOINT_COPY" = "no" ] && echo "    - Missing entrypoint copy"
        [ "$HAS_CHMOD" = "no" ] && echo "    - Missing chmod command"
        [ "$HAS_ENTRYPOINT" = "no" ] && echo "    - Missing ENTRYPOINT directive"
        [ "$HAS_CMD" = "no" ] && echo "    - Missing proper CMD directive"
        [ "$NO_OLD_STARTSH" = "no" ] && echo "    - Still using old start.sh pattern"
        FAILED=$((FAILED + 1))
    fi
    echo ""
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Total Services: $TOTAL"
echo "Passed: $PASSED"
echo "Failed: $FAILED"
echo ""

if [ $FAILED -eq 0 ]; then
    echo "✅ All services updated successfully!"
    exit 0
else
    echo "❌ Some services need attention"
    exit 1
fi
