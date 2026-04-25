const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Source extensions — dwe gen ts/tsx anvan js/jsx
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

// ESM/CJS interop — sèlman CJS pou pakè ki gen de version
config.resolver.unstable_enablePackageExports = true;
config.resolver.unstable_conditionNames = ['require', 'default'];

// Optional: Faster resolution
config.resolver.unstable_disableModuleWrapping = true;

module.exports = config;
