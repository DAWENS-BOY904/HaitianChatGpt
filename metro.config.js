const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push('png');

// Shim expo-web-browser so that maybeCompleteAuthSession is always safe to call
// on all platforms (iOS/Android/Web) without crashing
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  'expo-web-browser': path.resolve(__dirname, 'utils/expo-web-browser-shim.js'),
};

module.exports = config;
