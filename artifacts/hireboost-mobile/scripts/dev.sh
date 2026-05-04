#!/bin/bash
# Start the web proxy on $PORT, Metro on METRO_PORT=25519

set -e

METRO_PORT="${METRO_PORT:-25519}"
PROXY_PORT="${PORT:-25516}"
BASE_PATH="${BASE_PATH:-/mobile/}"

echo "[dev.sh] Freeing ports $PROXY_PORT and $METRO_PORT before starting..."
fuser -k "${PROXY_PORT}/tcp" 2>/dev/null || true
fuser -k "${METRO_PORT}/tcp"  2>/dev/null || true
sleep 1

echo "[dev.sh] Starting web proxy on :$PROXY_PORT → Metro :$METRO_PORT (base: $BASE_PATH)"

# Start proxy in background
METRO_PORT="$METRO_PORT" PORT="$PROXY_PORT" BASE_PATH="$BASE_PATH" \
  node scripts/web-proxy.mjs &
PROXY_PID=$!

cleanup() {
  echo "[dev.sh] Shutting down proxy (PID $PROXY_PID)..."
  kill "$PROXY_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# Start Metro on METRO_PORT
# --yes: answer "yes" to any interactive prompts (e.g. port-in-use)
# NOTE: EXPO_BASE_URL is intentionally NOT set here.
#  - Web canvas: the proxy injects history.replaceState + rewrites asset URLs,
#    so expo-router on web sees "/" and routes correctly without a base URL.
#  - Native Android: setting EXPO_BASE_URL="mobile" would be inlined into the
#    native bundle too (Metro serves all platforms), causing expo-router to
#    prefix every route with "/mobile/" → all routes 404 → crash.
EXPO_PACKAGER_PROXY_URL="https://$REPLIT_EXPO_DEV_DOMAIN" \
  EXPO_PUBLIC_DOMAIN="$REPLIT_DEV_DOMAIN" \
  EXPO_PUBLIC_REPL_ID="$REPL_ID" \
  REACT_NATIVE_PACKAGER_HOSTNAME="$REPLIT_DEV_DOMAIN" \
  CI=1 \
  pnpm exec expo start --localhost --port "$METRO_PORT"
