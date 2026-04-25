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

// Force CJS interop — prevents Node ESM loader from trying to load .ts files directly
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
