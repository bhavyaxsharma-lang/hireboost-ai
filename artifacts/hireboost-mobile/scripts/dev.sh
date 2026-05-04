#!/bin/bash
# Architecture:
#   Replit shared proxy routes /mobile/* → port $PORT (our HTTP proxy).
#   Our proxy strips the /mobile/ prefix before forwarding to Metro.
#   Metro runs on METRO_PORT (25519).
#
# Web canvas (worf.replit.dev/mobile/):
#   Browser → shared proxy /mobile/ → our proxy :$PORT → strips → Metro :$METRO_PORT
#   app.json "web.publicPath": "/mobile/" makes Metro emit asset URLs at /mobile/_expo/...
#   Our proxy injects history.replaceState so expo-router sees "/" not "/mobile/".
#
# Native Expo Go (REPLIT_EXPO_DEV_DOMAIN):
#   The expo dev domain also routes through the shared proxy.
#   EXPO_PACKAGER_PROXY_URL="https://REPLIT_EXPO_DEV_DOMAIN/mobile" makes Expo CLI
#   generate all native URLs (manifest bundleUrl, assets, hot) with the /mobile/ prefix,
#   so they all route via shared proxy → our proxy → Metro. ✓
#
# NOTE: EXPO_BASE_URL is intentionally NOT set here.
#   - Web: app.json web.publicPath="/mobile/" injects EXPO_BASE_URL="mobile" into the
#     web bundle only (not native), so expo-router knows its web base is /mobile/.
#   - Native: no EXPO_BASE_URL in the native bundle → expo-router routes from "/". ✓

set -e

METRO_PORT="${METRO_PORT:-25519}"
PROXY_PORT="${PORT:-25516}"
BASE_PATH="${BASE_PATH:-/mobile/}"

echo "[dev.sh] Freeing ports $PROXY_PORT and $METRO_PORT before starting..."
fuser -k "${PROXY_PORT}/tcp" 2>/dev/null || true
fuser -k "${METRO_PORT}/tcp"  2>/dev/null || true
sleep 1

echo "[dev.sh] Starting web proxy on :$PROXY_PORT → Metro :$METRO_PORT (base: $BASE_PATH)"
echo ""
echo "=========================================="
echo "  Expo Go native URL (enter in Expo Go):"
echo "  https://$REPLIT_EXPO_DEV_DOMAIN/mobile"
echo "  or scan the QR code from the URL bar"
echo "=========================================="
echo ""

METRO_PORT="$METRO_PORT" PORT="$PROXY_PORT" BASE_PATH="$BASE_PATH" EXPO_DEV_DOMAIN="$REPLIT_EXPO_DEV_DOMAIN" \
  node scripts/web-proxy.mjs &
PROXY_PID=$!

cleanup() {
  echo "[dev.sh] Shutting down proxy (PID $PROXY_PID)..."
  kill "$PROXY_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# EXPO_PACKAGER_PROXY_URL with /mobile path:
#   Expo CLI uses this as the base URL for ALL native resource URLs:
#   manifest bundleUrl, asset URLs, and hot-reload endpoint.
#   They all get the /mobile/ prefix → route via shared proxy → our proxy → Metro.
EXPO_PACKAGER_PROXY_URL="https://$REPLIT_EXPO_DEV_DOMAIN/mobile" \
  EXPO_PUBLIC_DOMAIN="$REPLIT_DEV_DOMAIN" \
  EXPO_PUBLIC_REPL_ID="$REPL_ID" \
  CI=1 \
  pnpm exec expo start --localhost --port "$METRO_PORT"
