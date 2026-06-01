// Web fallback — expo-web-browser is not available on web platform
import { Linking } from 'react-native';

/**
 * Opens a URL in a new tab on web.
 */
export async function openBrowserAsync(url: string, options?: any): Promise<void> {
  if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }
  await Linking.openURL(url);
}

/**
 * No-op on web — there is no in-app browser to dismiss.
 */
export function dismissBrowser(): void {
  // no-op on web
}

/**
 * On web, check if the current URL contains an OAuth callback token
 * and signal success to the opener. Called on the redirect landing page.
 */
export function maybeCompleteAuthSession(_options?: any): { type: string } {
  if (typeof window === 'undefined') return { type: 'success' };
  // If this page was opened by a popup, signal completion and close
  try {
    if (window.opener && window.location.hash.includes('access_token')) {
      window.opener.postMessage(
        { type: 'supabase:oauth:callback', url: window.location.href },
        window.location.origin
      );
      window.close();
      return { type: 'success' };
    }
  } catch (_e) {}
  return { type: 'success' };
}

/**
 * Opens an auth session via popup on web.
 * Returns when the popup completes OAuth and posts back the result URL.
 */
export async function openAuthSessionAsync(
  url: string,
  redirectUrl?: string,
  options?: any
): Promise<{ type: string; url?: string }> {
  if (typeof window === 'undefined') {
    try { await Linking.openURL(url); } catch {}
    return { type: 'opened' };
  }

  return new Promise<{ type: string; url?: string }>((resolve) => {
    const width = 500;
    const height = 660;
    const left = Math.max(0, (window.screen.width - width) / 2);
    const top  = Math.max(0, (window.screen.height - height) / 2);
    const features = `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`;

    const popup = window.open(url, 'oauth_popup', features);
    if (!popup) {
      // Popup was blocked — fall back to same-tab redirect
      window.location.href = url;
      resolve({ type: 'opened' });
      return;
    }

    // Listen for the callback message from the popup
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'supabase:oauth:callback') {
        cleanup();
        resolve({ type: 'success', url: event.data.url });
      }
    };

    // Detect if the popup was manually closed
    const pollTimer = setInterval(() => {
      try {
        if (popup.closed) {
          cleanup();
          resolve({ type: 'dismiss' });
        }
      } catch (_e) {
        cleanup();
        resolve({ type: 'dismiss' });
      }
    }, 400);

    function cleanup() {
      clearInterval(pollTimer);
      window.removeEventListener('message', onMessage);
      try { if (!popup.closed) popup.close(); } catch {}
    }

    window.addEventListener('message', onMessage);

    // Safety timeout after 5 minutes
    setTimeout(() => {
      cleanup();
      resolve({ type: 'timeout' });
    }, 5 * 60 * 1000);
  });
}
