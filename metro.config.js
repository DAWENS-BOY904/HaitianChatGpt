const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push('png');

// ── Shim expo-web-browser so maybeCompleteAuthSession is always safe ──
// Use resolveRequest (more reliable than extraNodeModules in pnpm workspaces)
const shimPath = path.resolve(__dirname, 'utils/expo-web-browser-shim.js');
const originalResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'expo-web-browser') {
    return { filePath: shimPath, type: 'sourceFile' };
  }
  // Fall back to the default resolver
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
