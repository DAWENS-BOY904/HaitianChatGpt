/**
 * Safe shim for expo-web-browser.
 * Never opens an external browser — always uses in-app browsing:
 *   - Native (iOS/Android): uses expo-web-browser's SFSafariViewController / Chrome Custom Tabs
 *   - Web: opens in the same window context (no external navigation)
 */

let ExpoWebBrowser = {};
try {
  ExpoWebBrowser = require('../node_modules/expo-web-browser');
} catch (_e) {}

const SafeWebBrowser = {
  ...ExpoWebBrowser,

  maybeCompleteAuthSession: function (options) {
    try {
      if (typeof ExpoWebBrowser.maybeCompleteAuthSession === 'function') {
        return ExpoWebBrowser.maybeCompleteAuthSession(options);
      }
    } catch (_e) {}
    return { type: 'failed', message: 'Not supported on this platform' };
  },

  openBrowserAsync: function (url, options) {
    try {
      if (typeof ExpoWebBrowser.openBrowserAsync === 'function') {
        // Uses SFSafariViewController on iOS / Chrome Custom Tabs on Android
        // Both stay inside the app — no external browser opens
        return ExpoWebBrowser.openBrowserAsync(url, options);
      }
    } catch (_e) {}
    // Web fallback: open in same window
    if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
      return Promise.resolve({ type: 'opened' });
    }
    return Promise.resolve({ type: 'failed' });
  },

  openAuthSessionAsync: function (url, redirectUrl, options) {
    try {
      if (typeof ExpoWebBrowser.openAuthSessionAsync === 'function') {
        return ExpoWebBrowser.openAuthSessionAsync(url, redirectUrl, options);
      }
    } catch (_e) {}
    if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
      return Promise.resolve({ type: 'opened' });
    }
    return Promise.resolve({ type: 'failed' });
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
