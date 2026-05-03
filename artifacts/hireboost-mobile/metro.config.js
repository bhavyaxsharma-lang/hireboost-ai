const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// When served behind the Replit path-based proxy (BASE_PATH=/mobile/),
// all asset and bundle URLs emitted into the HTML must include that prefix
// so the proxy can route them to this Metro server.
const basePath = process.env.BASE_PATH || "/";
config.transformer = {
  ...config.transformer,
  publicPath: basePath,
};

module.exports = config;
