const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Ensure .ts/.tsx source files are resolved correctly (fixes ESM/CJS conflict)
config.resolver.sourceExts = [
  'tsx',
  'ts',
  'jsx',
  'js',
  'json',
  'cjs',
  'mjs',
];

// Push additional asset extensions
config.resolver.assetExts.push('png');

module.exports = config;
