/**
 * Safe shim for expo-web-browser
 * Ensures maybeCompleteAuthSession and other methods are always available
 * regardless of platform support.
 */
const ExpoWebBrowser = require('expo-web-browser');

const SafeWebBrowser = {
  ...ExpoWebBrowser,
  maybeCompleteAuthSession: function(options) {
    if (typeof ExpoWebBrowser.maybeCompleteAuthSession === 'function') {
      return ExpoWebBrowser.maybeCompleteAuthSession(options);
    }
    // No-op on platforms that don't support it (iOS/Android native)
    return { type: 'failed', message: 'Not supported on this platform' };
  },
  openBrowserAsync: function(url, options) {
    if (typeof ExpoWebBrowser.openBrowserAsync === 'function') {
      return ExpoWebBrowser.openBrowserAsync(url, options);
    }
    // Fallback to Linking
    const { Linking } = require('react-native');
    return Linking.openURL(url).then(() => ({ type: 'opened' }));
  },
  openAuthSessionAsync: function(url, redirectUrl, options) {
    if (typeof ExpoWebBrowser.openAuthSessionAsync === 'function') {
      return ExpoWebBrowser.openAuthSessionAsync(url, redirectUrl, options);
    }
    const { Linking } = require('react-native');
    return Linking.openURL(url).then(() => ({ type: 'opened' }));
  },
  dismissBrowser: function() {
    if (typeof ExpoWebBrowser.dismissBrowser === 'function') {
      return ExpoWebBrowser.dismissBrowser();
    }
  },
  warmUpAsync: function(browserPackage) {
    if (typeof ExpoWebBrowser.warmUpAsync === 'function') {
      return ExpoWebBrowser.warmUpAsync(browserPackage);
    }
    return Promise.resolve({ type: 'not-supported' });
  },
  coolDownAsync: function(browserPackage) {
    if (typeof ExpoWebBrowser.coolDownAsync === 'function') {
      return ExpoWebBrowser.coolDownAsync(browserPackage);
    }
    return Promise.resolve({ type: 'not-supported' });
  },
};

module.exports = SafeWebBrowser;
