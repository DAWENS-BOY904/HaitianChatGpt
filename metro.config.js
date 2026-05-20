const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Ensure PNG assets are handled 
if (!config.resolver.assetExts.includes('png')) {
  config.resolver.assetExts.push('png');
}

// Platform-specific resolveRequest
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // On web: shim expo-web-browser with our iframe-based in-app implementation
  if (platform === 'web' && (moduleName === 'expo-web-browser' || moduleName === 'expo-web-browser/build/WebBrowser')) {
    return {
      filePath: path.resolve(__dirname, 'utils/web-browser.web.ts'),
      type: 'sourceFile',
    };
  }


module.exports = config;
