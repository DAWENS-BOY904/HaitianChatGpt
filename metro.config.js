const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Ensure PNG assets are handled 
if (!config.resolver.assetExts.includes('png')) {
  config.resolver.assetExts.push('png');
}

// Shim expo-web-browser so maybeCompleteAuthSession is always safe to call
// on all platforms (iOS/Android/Web) without crashing
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  'expo-web-browser': path.resolve(__dirname, 'utils/expo-web-browser-shim.js'),
};

module.exports = config;
