/**
 * google-auth.ts
 *
 * Platform-aware Google OAuth helper using YOUR OWN Google Console credentials.
 *
 * ─── SETUP (REQUIRED) ────────────────────────────────────────────────────────
 * 1. Go to https://console.cloud.google.com/ → APIs & Services → Credentials
 * 2. Create OAuth 2.0 Client IDs:
 *    - iOS:     Application type = iOS, Bundle ID = com.dawinix.app
 *    - Android: Application type = Android, Package name = com.dawinix.app
 *    - Web:     Application type = Web application
 *               Authorized redirect URIs: https://YOUR_SUPABASE_PROJECT.supabase.co/auth/v1/callback
 *
 * 3. Replace the placeholder values below with your real Client IDs
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * STRATEGY:
 * - iOS/Android: Uses @react-native-google-signin/google-signin (native SDK)
 *   → Gets an idToken from Google directly, then exchanges it with Supabase
 * - Web: Uses Supabase signInWithOAuth with your Web Client ID via popup/redirect
 *   → Auto-detects origin: davetopup.com → davetopup callback,
 *      dawinix → dawinix.com callback, otherwise default
 */

import { Platform } from 'react-native';
import { getSupabaseClient } from '@/template';

// ── Your Google Client IDs ─────────────────────────────────────────────────
const IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '';
const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '';

// ── Redirect URL helpers ───────────────────────────────────────────────────

/**
 * Detect current web origin and return the appropriate OAuth redirect URL.
 * - davetopup.com  → use davetopup.com/auth/callback
 * - dawinix        → use dawinix.com/auth/callback
 * - otherwise      → use the Supabase project callback (default)
 */
function getWebCallbackUrl(): string | undefined {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;

  const origin = window.location.origin.toLowerCase();

  if (origin.includes('davetopup.com')) {
    return 'https://davetopup.com/auth/callback';
  }

  if (origin.includes('dawinix')) {
    return 'https://www.dawinix.com/auth/callback';
  }

  // Default: let Supabase use its configured Site URL
  return undefined;
}

// ── Web sign-in (popup + same-tab fallback) ────────────────────────────────

async function signInWithGoogleBrowser(): Promise<{ error: string | null }> {
  const supabase = getSupabaseClient();
  const redirectTo = getWebCallbackUrl();

  const oauthOptions: Parameters<typeof supabase.auth.signInWithOAuth>[0] = {
    provider: 'google',
    options: {
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
      ...(redirectTo ? { redirectTo } : {}),
      skipBrowserRedirect: true,
    },
  };

  const { data, error } = await supabase.auth.signInWithOAuth(oauthOptions);

  if (error) return { error: error.message };
  if (!data?.url) return { error: 'No OAuth URL returned.' };

  // Try popup first
  const popup = window.open(data.url, '_blank', 'width=500,height=650,scrollbars=yes,resizable=yes');

  if (popup && !popup.closed) {
    return new Promise((resolve) => {
      const messageHandler = async (event: MessageEvent) => {
        if (event.data?.type !== 'supabase:oauth:callback') return;
        window.removeEventListener('message', messageHandler);

        const callbackUrl: string = event.data.url;
        const urlObj = new URL(callbackUrl);
        const hashParams = new URLSearchParams(urlObj.hash.replace('#', ''));
        const queryParams = new URLSearchParams(urlObj.search);

        const accessToken = hashParams.get('access_token') || queryParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token') || queryParams.get('refresh_token');
        const code = queryParams.get('code');

        try {
          if (code) {
            const { error: exchError } = await supabase.auth.exchangeCodeForSession(callbackUrl);
            if (exchError) throw exchError;
          } else if (accessToken && refreshToken) {
            const { error: sessError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (sessError) throw sessError;
            try { await supabase.auth.refreshSession(); } catch (_) {}
          }
          resolve({ error: null });
        } catch (err: any) {
          resolve({ error: err?.message || 'OAuth exchange failed.' });
        }
      };

      window.addEventListener('message', messageHandler);

      // Detect popup closed without completing
      const interval = setInterval(() => {
        if (popup.closed) {
          clearInterval(interval);
          window.removeEventListener('message', messageHandler);
          resolve({ error: 'Sign-in was cancelled.' });
        }
      }, 500);
    });
  }

  // Popup blocked — fall back to same-tab redirect
  window.location.href = data.url;
  return { error: null };
}

// ── Native sign-in (iOS / Android) ────────────────────────────────────────

async function signInWithGoogleNative(): Promise<{ error: string | null }> {
  try {
    const { GoogleSignin } = await import('@react-native-google-signin/google-signin');

    GoogleSignin.configure({
      iosClientId: IOS_CLIENT_ID,
      webClientId: WEB_CLIENT_ID,
      offlineAccess: true,
    });

    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

    const signInResult = await GoogleSignin.signIn();

    // SDK v13+ returns tokens nested under data
    const tokens = await GoogleSignin.getTokens();
    const idToken = tokens?.idToken || (signInResult as any)?.data?.idToken || (signInResult as any)?.idToken;

    if (!idToken) {
      return { error: 'No ID token received from Google.' };
    }

    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });

    if (error) return { error: error.message };
    return { error: null };
  } catch (err: any) {
    const msg: string = err?.message || err?.toString() || 'Google sign-in failed.';
    const lower = msg.toLowerCase();
    if (
      lower.includes('cancel') ||
      lower.includes('dismiss') ||
      lower.includes('closed') ||
      err?.code === 'SIGN_IN_CANCELLED' ||
      err?.code === 12501
    ) {
      return { error: 'cancelled' };
    }
    return { error: msg };
  }
}

// ── OnSpace AI OAuth fallback (web + native) ─────────────────────────────

/**
 * OnSpace AI login fallback.
 * Uses the same Supabase signInWithOAuth flow but routes through the OnSpace
 * identity provider entry.  If the primary Google flows fail (missing client
 * IDs, play-services unavailable, etc.) this is tried as a final option.
 */
async function signInWithOnSpaceOAuth(): Promise<{ error: string | null }> {
  const supabase = getSupabaseClient();

  if (Platform.OS === 'web') {
    const redirectTo = getWebCallbackUrl();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        queryParams: { access_type: 'offline', prompt: 'select_account' },
        ...(redirectTo ? { redirectTo } : {}),
        skipBrowserRedirect: true,
      },
    });
    if (error) return { error: error.message };
    if (!data?.url) return { error: 'No OAuth URL returned from OnSpace fallback.' };

    const popup = window.open(data.url, '_blank', 'width=500,height=650,scrollbars=yes,resizable=yes');

    if (popup && !popup.closed) {
      return new Promise((resolve) => {
        const handler = async (event: MessageEvent) => {
          if (event.data?.type !== 'supabase:oauth:callback') return;
          window.removeEventListener('message', handler);

          const callbackUrl: string = event.data.url;
          const urlObj = new URL(callbackUrl);
          const hashParams = new URLSearchParams(urlObj.hash.replace('#', ''));
          const queryParams = new URLSearchParams(urlObj.search);

          const accessToken = hashParams.get('access_token') || queryParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token') || queryParams.get('refresh_token');
          const code = queryParams.get('code');

          try {
            if (code) {
              const { error: exchError } = await supabase.auth.exchangeCodeForSession(callbackUrl);
              if (exchError) throw exchError;
            } else if (accessToken && refreshToken) {
              const { error: sessError } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
              if (sessError) throw sessError;
              try { await supabase.auth.refreshSession(); } catch (_) {}
            }
            resolve({ error: null });
          } catch (err: any) {
            resolve({ error: err?.message || 'OnSpace OAuth exchange failed.' });
          }
        };

        window.addEventListener('message', handler);

        const interval = setInterval(() => {
          if (popup.closed) {
            clearInterval(interval);
            window.removeEventListener('message', handler);
            resolve({ error: 'Sign-in was cancelled.' });
          }
        }, 500);
      });
    }

    window.location.href = data.url;
    return { error: null };
  }

  // Native: use Supabase OAuth with in-app browser
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        queryParams: { access_type: 'offline', prompt: 'select_account' },
        skipBrowserRedirect: false,
      },
    });
    if (error) return { error: error.message };
    return { error: null };
  } catch (err: any) {
    return { error: err?.message || 'OnSpace fallback sign-in failed.' };
  }
}

// ── Cross-platform entry point ─────────────────────────────────────────────

export async function signInWithGoogleCrossPlatform(): Promise<{ error: string | null }> {
  if (Platform.OS === 'web') {
    return signInWithGoogleBrowser();
  }

  // Primary: native Google SDK
  const nativeResult = await signInWithGoogleNative();

  // If it errored for a non-cancellation reason, try the OnSpace OAuth fallback
  if (nativeResult.error && nativeResult.error !== 'cancelled') {
    const lower = nativeResult.error.toLowerCase();
    const isCancellation =
      lower.includes('cancel') || lower.includes('dismiss') || lower.includes('closed');
    if (!isCancellation) {
      return signInWithOnSpaceOAuth();
    }
  }

  return nativeResult;
}