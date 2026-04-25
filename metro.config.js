const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Source extensions — ts/tsx must resolve before js/jsx
config.resolver.sourceExts = [
  'tsx',
  'ts',
  'jsx',
  'js',
  'json',
  'cjs',
  'mjs',
];

// Asset extensions
config.resolver.assetExts = [
  ...config.resolver.assetExts,
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'svg',
];

// Permanently disable ESM package exports resolution so Node never
// tries to load expo-modules-core's .ts source files directly.
config.resolver.unstable_enablePackageExports = false;

// Force CJS condition names — prevents Node from picking the ESM
// entry point for packages that define "exports" in package.json.
config.resolver.unstable_conditionNames = ['require', 'default'];

module.exports = config;
