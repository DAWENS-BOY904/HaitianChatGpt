// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// On web, redirect expo-web-browser to our cross-platform shim
// (expo-web-browser's index.js is missing on web builds)
const webBrowserShim = path.resolve(__dirname, 'utils/web-browser.ts');

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName === 'expo-web-browser' &&
    platform === 'web'
  ) {
    return {
      filePath: webBrowserShim,
      type: 'sourceFile',
    };
  }
  // Fall back to default resolution
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
