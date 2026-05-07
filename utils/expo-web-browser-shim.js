/**
 * Safe shim for expo-web-browser
 * Fully self-contained — does NOT re-require 'expo-web-browser' to avoid
 * circular dependency or pnpm resolution issues.
 * Provides safe no-op fallbacks for all methods on platforms that lack them.
 */

'use strict';

const { Linking, Platform } = require('react-native');

// Try to get the real module via every possible pnpm/npm path
let RealWebBrowser = null;
const candidates = [
  '../node_modules/expo-web-browser/build/index.js',
  '../node_modules/expo-web-browser/src/index.ts',
  '../node_modules/.pnpm/expo-web-browser@14.1.6/node_modules/expo-web-browser/build/index.js',
];
for (const c of candidates) {
  try {
    RealWebBrowser = require(c);
    break;
  } catch (_) {}
}

function safeCall(name, args) {
  try {
    if (RealWebBrowser && typeof RealWebBrowser[name] === 'function') {
      return RealWebBrowser[name](...args);
    }
  } catch (_) {}
  return undefined;
}

const SafeWebBrowser = {
  // ── Critical: called at module load time in template/auth/supabase/service.ts ──
  maybeCompleteAuthSession: function (options) {
    // On native (iOS/Android) this is a no-op; only meaningful on Web
    if (Platform.OS === 'web') {
      return safeCall('maybeCompleteAuthSession', [options]) || { type: 'failed', message: 'Not supported' };
    }
    return { type: 'failed', message: 'Not supported on native' };
  },

  openBrowserAsync: function (url, options) {
    const result = safeCall('openBrowserAsync', [url, options]);
    if (result !== undefined) return result;
    return Linking.openURL(url).then(function () { return { type: 'opened' }; });
  },

  openAuthSessionAsync: function (url, redirectUrl, options) {
    const result = safeCall('openAuthSessionAsync', [url, redirectUrl, options]);
    if (result !== undefined) return result;
    return Linking.openURL(url).then(function () { return { type: 'opened' }; });
  },

  dismissBrowser: function () {
    safeCall('dismissBrowser', []);
  },

  dismissAuthSession: function () {
    safeCall('dismissAuthSession', []);
  },

  warmUpAsync: function (browserPackage) {
    const result = safeCall('warmUpAsync', [browserPackage]);
    if (result !== undefined) return result;
    return Promise.resolve({ type: 'not-supported' });
  },

  coolDownAsync: function (browserPackage) {
    const result = safeCall('coolDownAsync', [browserPackage]);
    if (result !== undefined) return result;
    return Promise.resolve({ type: 'not-supported' });
  },

  getCustomTabsSupportingBrowsersAsync: function () {
    const result = safeCall('getCustomTabsSupportingBrowsersAsync', []);
    if (result !== undefined) return result;
    return Promise.resolve({ browserPackages: [], defaultBrowserPackage: null, servicePackages: [] });
  },
};

// Spread any remaining exports from the real module
if (RealWebBrowser) {
  for (const key of Object.keys(RealWebBrowser)) {
    if (!(key in SafeWebBrowser)) {
      SafeWebBrowser[key] = RealWebBrowser[key];
    }
  }
}

module.exports = SafeWebBrowser;
