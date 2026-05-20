/**
 * Safe shim for expo-web-browser.
 * Native: uses expo-web-browser (SFSafariViewController / Chrome Custom Tabs) — stays in-app.
 * Web: uses iframe overlay — never opens external browser or leaves the app.
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
        return ExpoWebBrowser.openBrowserAsync(url, options);
      }
    } catch (_e) {}
    // Web fallback: iframe overlay
    if (typeof document !== 'undefined') {
      try {
        const overlay = document.createElement('div');
        overlay.id = 'wb_overlay_' + Date.now();
        overlay.style.cssText = 'position:fixed;inset:0;z-index:999999;background:#000;display:flex;flex-direction:column;';
        const bar = document.createElement('div');
        bar.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:8px 16px;background:#1c1c1e;min-height:48px;';
        const label = document.createElement('span');
        label.textContent = url.replace(/^https?:\/\//, '').split('/')[0];
        label.style.cssText = 'color:#fff;font-size:13px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
        const btn = document.createElement('button');
        btn.textContent = '✕';
        btn.style.cssText = 'background:rgba(255,255,255,0.15);border:none;color:#fff;width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:14px;margin-left:12px;';
        btn.onclick = function () { overlay.remove(); };
        bar.appendChild(label); bar.appendChild(btn);
        const iframe = document.createElement('iframe');
        iframe.src = url;
        iframe.style.cssText = 'flex:1;border:none;width:100%;background:#fff;';
        overlay.appendChild(bar); overlay.appendChild(iframe);
        document.body.appendChild(overlay);
        return Promise.resolve({ type: 'opened' });
      } catch (_e2) {}
    }
    return Promise.resolve({ type: 'failed' });
  },

  openAuthSessionAsync: function (url, redirectUrl, options) {
    try {
      if (typeof ExpoWebBrowser.openAuthSessionAsync === 'function') {
        return ExpoWebBrowser.openAuthSessionAsync(url, redirectUrl, options);
      }
    } catch (_e) {}
    return SafeWebBrowser.openBrowserAsync(url, options);
  },

  dismissBrowser: function () {
    try {
      if (typeof ExpoWebBrowser.dismissBrowser === 'function') {
        return ExpoWebBrowser.dismissBrowser();
      }
    } catch (_e) {}
    if (typeof document !== 'undefined') {
      document.querySelectorAll('[id^="wb_overlay_"]').forEach(function (el) { el.remove(); });
    }
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
please ai remove login google must stay in app never go outside.