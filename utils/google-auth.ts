/**
 * google-auth.ts
 *
 * Platform-aware Google OAuth redirect helper.
 *
 * - iOS/Android: uses the app deep-link scheme (dawinixht://) via expo-auth-session
 *   so the system browser returns into the app after auth.
 * - Web: uses a popup window via our cross-platform WebBrowser shim.
 *   The popup posts a message back to the opener; on Safari/popup-blocked it
 *   falls back to a same-tab redirect to /auth/callback.
 *
 * The Supabase "Redirect URLs" setting must include:
 *   - dawinixht://home  (iOS/Android)
 *   - https://<your-published-domain>/auth/callback  (Web)
 */

import { Platform } from 'react-native';
import { getSupabaseClient } from '@/template';
import * as WebBrowser from './web-browser';

// ── App scheme from app.json  ──────────────────────────────────────────────
const APP_SCHEME = 'dawinixht';

// ── Published web URL ─────────────────────────────────────────────────────
// IMPORTANT: Must be the REAL published URL (not window.location.origin)
// Safari & iframe environments reject dynamic origins — always use the canonical URL.
// Update this to your custom domain if you have one.
const PUBLISHED_WEB_URL = 'https://dawinixht.onspace.app';

function getWebCallbackUrl(): string {
  // In production (published app) always use the canonical origin
  // to avoid Safari "invalid address" errors when running in an iframe.
  if (typeof window !== 'undefined') {
    const origin = window.location.origin;
    // Only trust the origin if it matches our known domain (not localhost/iframe)
    const isTrustedOrigin = origin.includes('onspace.app') || origin.includes('dawinixht');
    if (isTrustedOrigin) {
      return `${origin}/auth/callback`;
    }
  }
  return `${PUBLISHED_WEB_URL}/auth/callback`;
}

// ── Native redirect URL  ───────────────────────────────────────────────────
function getNativeRedirectUrl(): string {
  // Supabase accepts deep-link URIs. The path just needs to be registered
  // as an allowed redirect URL in the Supabase dashboard.
  return `${APP_SCHEME}://home`;
}

export interface GoogleAuthResult {
  error: string | null;
  session?: any;
}

export async function signInWithGoogleCrossPlatform(): Promise<GoogleAuthResult> {
  const supabase = getSupabaseClient();

  try {
    if (Platform.OS === 'web') {
      // ── WEB: Popup-based OAuth ─────────────────────────────────────────
      const redirectTo = getWebCallbackUrl();

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,     // Don't let Supabase redirect — we open a popup
          queryParams: { access_type: 'offline', prompt: 'select_account' },
        },
      });

      if (error || !data?.url) {
        return { error: error?.message || 'Failed to get OAuth URL' };
      }

      // Open in popup window (falls back to same-tab if popup is blocked)
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

      if (result.type === 'success' && result.url) {
        // Let Supabase JS SDK detect and set the session from the callback URL
        // (it listens on onAuthStateChange automatically)
        // For PKCE flows we must explicitly exchange the code:
        const callbackParams = new URLSearchParams(
          new URL(result.url).search + '&' + new URL(result.url).hash.replace('#', '?')
        );
        const code = callbackParams.get('code');
        if (code) {
          const { error: exchError } = await supabase.auth.exchangeCodeForSession(result.url);
          if (exchError) return { error: exchError.message };
        }
        return { error: null };
      }

      if (result.type === 'dismiss' || result.type === 'timeout') {
        return { error: 'Sign-in was cancelled.' };
      }

      // Fallback: check if session was set via same-tab redirect
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session) return { error: null };

      return { error: 'Sign-in was cancelled or timed out.' };

    } else {
      // ── NATIVE (iOS / Android): deep-link in-app OAuth ─────────────────
      // We need expo-auth-session's makeRedirectUri for the native path
      let redirectTo = getNativeRedirectUrl();
      try {
        const AuthSession = require('expo-auth-session');
        redirectTo = AuthSession.makeRedirectUri({
          scheme: APP_SCHEME,
          path: 'home',
        });
      } catch (_e) {
        // expo-auth-session not available; use the hardcoded scheme URI
      }

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
          queryParams: { access_type: 'offline', prompt: 'select_account' },
        },
      });

      if (error || !data?.url) {
        return { error: error?.message || 'Failed to get OAuth URL' };
      }

      // Open in system in-app browser (expo-web-browser handles this natively)
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

      if (result.type === 'success' && result.url) {
        // Parse session tokens from the deep-link URL
        const callbackParams = new URLSearchParams(
          new URL(result.url).search + '&' + (new URL(result.url).hash || '').replace('#', '?')
        );
        const accessToken  = callbackParams.get('access_token');
        const refreshToken = callbackParams.get('refresh_token');
        const code         = callbackParams.get('code');

        if (code) {
          const { error: exchError } = await supabase.auth.exchangeCodeForSession(result.url);
          if (exchError) return { error: exchError.message };
          // Refresh so the newly-stored tokens are confirmed and auth listeners fire.
          try { await supabase.auth.refreshSession(); } catch (_) {}
          return { error: null };
        }

        if (accessToken && refreshToken) {
          const { error: setError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (setError) return { error: setError.message };
          // Force a session refresh so the persisted tokens are validated
          // and onAuthStateChange fires with the latest session.
          try { await supabase.auth.refreshSession(); } catch (_) {}
          return { error: null };
        }

        // No tokens found — try a plain session refresh in case the deep-link
        // already set a session via the Supabase JS listener.
        try {
          const { data: refreshed } = await supabase.auth.refreshSession();
          if (refreshed?.session) return { error: null };
        } catch (_) {}
        return { error: null };
      }

      if (result.type === 'cancel' || result.type === 'dismiss') {
        return { error: 'cancel' };
      }

      return { error: 'Google sign-in failed. Please try again.' };
    }
  } catch (e: any) {
    const msg: string = e?.message || 'Unexpected error';
    const isCancellation = /cancel|dismiss|closed/i.test(msg);
    return { error: isCancellation ? 'cancel' : msg };
  }
}
