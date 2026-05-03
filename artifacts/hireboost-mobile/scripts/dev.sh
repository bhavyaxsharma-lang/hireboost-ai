#!/bin/bash
# Start the web proxy on $PORT, Metro on METRO_PORT=25519
# The proxy rewrites script src="/node_modules/ → src="$BASE_PATH/node_modules/
# so that the Replit reverse proxy can route the bundle URL back to this server.

set -e

METRO_PORT="${METRO_PORT:-25519}"
PROXY_PORT="${PORT:-25516}"
BASE_PATH="${BASE_PATH:-/mobile/}"

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
# EXPO_BASE_URL tells expo-router to strip "/mobile" from incoming paths and
# prefix generated navigation URLs with "/mobile" — no client-side URL hacks needed.
EXPO_PACKAGER_PROXY_URL="https://$REPLIT_EXPO_DEV_DOMAIN" \
  EXPO_PUBLIC_DOMAIN="$REPLIT_DEV_DOMAIN" \
  EXPO_PUBLIC_REPL_ID="$REPL_ID" \
  REACT_NATIVE_PACKAGER_HOSTNAME="$REPLIT_DEV_DOMAIN" \
  EXPO_BASE_URL="mobile" \
  pnpm exec expo start --localhost --port "$METRO_PORT"
