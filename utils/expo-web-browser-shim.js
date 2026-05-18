/**
 * Safe shim for expo-web-browser
 * Avoids circular dependency by NOT re-requiring 'expo-web-browser'.
 * Instead, resolves the real module via its absolute node_modules path.
 */

let ExpoWebBrowser = {};
try {
  // Resolve the REAL package directly — bypasses Metro's alias for this file
  ExpoWebBrowser = require('../node_modules/expo-web-browser');
} catch (_e) {
  // Package not available at all — all methods will be no-ops below
}

const SafeWebBrowser = {
  ...ExpoWebBrowser,

  maybeCompleteAuthSession: function (options) {
    try {
      if (typeof ExpoWebBrowser.maybeCompleteAuthSession === 'function') {
        return ExpoWebBrowser.maybeCompleteAuthSession(options);
      }
    } catch (_e) {}
    // No-op on platforms that don't support it (iOS/Android native)
    return { type: 'failed', message: 'Not supported on this platform' };
  },

  openBrowserAsync: function (url, options) {
    try {
      if (typeof ExpoWebBrowser.openBrowserAsync === 'function') {
        return ExpoWebBrowser.openBrowserAsync(url, options);
      }
    } catch (_e) {}
    // Fallback to Linking
    const { Linking } = require('react-native');
    return Linking.openURL(url).then(function () { return { type: 'opened' }; });
  },

  openAuthSessionAsync: function (url, redirectUrl, options) {
    try {
      if (typeof ExpoWebBrowser.openAuthSessionAsync === 'function') {
        return ExpoWebBrowser.openAuthSessionAsync(url, redirectUrl, options);
      }
    } catch (_e) {}
    const { Linking } = require('react-native');
    return Linking.openURL(url).then(function () { return { type: 'opened' }; });
  },

  dismissBrowser: function () {
    try {
      if (typeof ExpoWebBrowser.dismissBrowser === 'function') {
        return ExpoWebBrowser.dismissBrowser();
      }
    } catch (_e) {}
  },

  warmUpAsync: function (browserPackage) {
    try {
      if (typeof ExpoWebBrowser.warmUpAsync === 'function') {
        return ExpoWebBrowser.warmUpAsync(browserPackage);
      }
    } catch (_e) {}
    return Promise.resolve({ type: 'not-supported' });
  },

  coolDownAsync: function (browserPackage) {
    try {
      if (typeof ExpoWebBrowser.coolDownAsync === 'function') {
        return ExpoWebBrowser.coolDownAsync(browserPackage);
      }
    } catch (_e) {}
    return Promise.resolve({ type: 'not-supported' });
  },
};

module.exports = SafeWebBrowser;
fix this never go outside app only open web in app via expo and The MessageItem was edited via GitHub to add table format support Please read the current file and ensure the table rendering, strikethrough, blockquote, and horizontal rule markdown features are all working correctly without any compilation errors.
