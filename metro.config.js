const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Ensure PNG assets are handled 
if (!config.resolver.assetExts.includes('png')) {
  config.resolver.assetExts.push('png');
}

// Shim expo-web-browser so it is always safe on all platforms
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  'expo-web-browser': path.resolve(__dirname, 'utils/expo-web-browser-shim.js'),
};

// Platform-specific resolveRequest: shim expo-auth-session on web only
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // On web, shim expo-auth-session (not available as a web package)
  if (platform === 'web' && moduleName === 'expo-auth-session') {
    return {
      filePath: path.resolve(__dirname, 'utils/expo-auth-session-shim.web.js'),
      type: 'sourceFile',
    };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
