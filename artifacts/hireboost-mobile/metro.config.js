const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Handle HMR entry-point registration from the Expo web bundle.
//
// When the Expo web app runs in the canvas browser, its HMR client connects to
// Metro's /hot WebSocket and sends a registerEntryPoints message whose URL
// contains the /mobile/ publicPath prefix, e.g.:
//   https://<expo-domain>/mobile/node_modules/.pnpm/.../expo-router/entry.js
//
// Metro strips the scheme+host and tries to resolve the remaining path
//   ./mobile/node_modules/.pnpm/.../expo-router/entry
// from /home/runner/workspace (the workspace root), not from __dirname.
// That path doesn't exist → UnableToResolveError → Metro process exit.
//
// Fix: intercept any module name starting with ./mobile/ or mobile/,
// strip the prefix, change the origin to __dirname so Metro looks in the
// right place, and re-resolve with the corrected name.
config.resolver = {
  ...config.resolver,
  resolveRequest(context, moduleName, platform) {
    if (/^\.?\/mobile\//.test(moduleName)) {
      const stripped = moduleName.replace(/^\.?\/mobile\//, "./");
      try {
        return context.resolveRequest(
          { ...context, originModulePath: path.join(__dirname, "_hmr_origin.js") },
          stripped,
          platform
        );
      } catch (_) {}
    }
    return context.resolveRequest(context, moduleName, platform);
  },
};

module.exports = config;
