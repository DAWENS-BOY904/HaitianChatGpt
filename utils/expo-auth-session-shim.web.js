/**
 * Web shim for expo-auth-session.
 * Provides stub implementations so the web bundle doesn't break.
 */
module.exports = {
  makeRedirectUri: function (options) {
    if (typeof window !== 'undefined') {
      return window.location.origin + (options?.path || '/');
    }
    return 'https://localhost/';
  },
  useAuthRequest: function () { return [null, null, function () {}]; },
  useAutoDiscovery: function () { return null; },
  startAsync: function () { return Promise.resolve({ type: 'dismiss' }); },
  exchangeCodeAsync: function () { return Promise.resolve({}); },
  AuthRequest: function () {},
  AuthSession: {},
  ResponseType: { Code: 'code', Token: 'token' },
  Prompt: { Login: 'login', None: 'none' },
};
