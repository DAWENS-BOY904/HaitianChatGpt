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
 */

import { Platform } from 'react-native';
import { getSupabaseClient } from '@/template';
import * as WebBrowser from './web-browser';

// ── YOUR GOOGLE CLIENT IDs ─────────────────────────────────────────────────
// Replace these with your real values from Google Cloud Console
const GOOGLE_WEB_CLIENT_ID   = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID   || '153408485563-rlq4fqkp66lsapggf7hr017vkbkjgipd.apps.googleusercontent.com';
const GOOGLE_IOS_CLIENT_ID   = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID   || '153408485563-5nom14bpg7re9m36pk91ndv45vqpcvsv.apps.googleusercontent.com';

// ── App scheme ─────────────────────────────────────────────────────────────
const APP_SCHEME = 'dawinix';
const PUBLISHED_WEB_URL = 'https://dawinix.com';

function getWebCallbackUrl(): string {
  if (typeof window !== 'undefined') {
    const origin = window.location.origin;
    const isTrustedOrigin = origin.includes('onspace.app') || origin.includes('dawinix');
    if (isTrustedOrigin) return `${origin}/auth/callback`;
  }
  return `${PUBLISHED_WEB_URL}/auth/callback`;
}

function getNativeRedirectUrl(): string {
  return `${APP_SCHEME}://home`;
}

export interface GoogleAuthResult {
  error: string | null;
  session?: any;
}

/**
 * Sign in with Google using native SDK (iOS/Android).
 * Uses @react-native-google-signin/google-signin to get a real idToken
 * from Google, then passes it directly to Supabase signInWithIdToken.
 */
async function signInWithGoogleNative(): Promise<GoogleAuthResult> {
  const supabase = getSupabaseClient();

  try {
    // Try native Google Sign-In SDK first (best UX — no browser popup)
    const { GoogleSignin, statusCodes } = require('@react-native-google-signin/google-signin');

    GoogleSignin.configure({
      webClientId: GOOGLE_WEB_CLIENT_ID,
      iosClientId: Platform.OS === 'ios' ? GOOGLE_IOS_CLIENT_ID : undefined,
      offlineAccess: true,
      forceCodeForRefreshToken: false,
    });

    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    await GoogleSignin.signOut().catch(() => {}); // clear any stale session

    const userInfo = await GoogleSignin.signIn();
    const idToken = userInfo?.data?.idToken || userInfo?.idToken;

    if (!idToken) {
      throw new Error('No ID token received from Google Sign-In');
    }

    console.log('[Google Auth] Got native idToken, exchanging with Supabase...');

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });

    if (error) {
      console.error('[Google Auth] Supabase signInWithIdToken error:', error.message);
      return { error: error.message };
    }

    if (data?.session) {
      try { await supabase.auth.refreshSession(); } catch (_) {}
      console.log('[Google Auth] Native sign-in successful');
      return { error: null, session: data.session };
    }

    return { error: 'No session returned from Supabase' };

  } catch (nativeErr: any) {
    const msg: string = nativeErr?.message || '';
    const code = nativeErr?.code;

    // User cancelled — treat as soft cancellation
    if (
      msg.toLowerCase().includes('cancel') ||
      msg.toLowerCase().includes('dismiss') ||
      msg.toLowerCase().includes('sign_in_cancelled') ||
      code === '12501' ||  // SIGN_IN_CANCELLED (Android)
      code === 'SIGN_IN_CANCELLED'
    ) {
      return { error: 'cancel' };
    }

    // Native SDK not available (e.g. Expo Go / web build) — fall back to browser OAuth
    const isModuleNotFound =
      msg.includes('Cannot find module') ||
      msg.includes('Unable to resolve module') ||
      msg.includes('requireNativeComponent') ||
      msg.includes('NativeModule') ||
      nativeErr?.name === 'Error' && msg.includes('@react-native-google-signin');

    if (isModuleNotFound) {
      console.log('[Google Auth] Native SDK unavailable, falling back to browser OAuth...');
      return signInWithGoogleBrowser('native');
    }

    console.error('[Google Auth] Native sign-in error:', msg);
    // Fall back to browser OAuth for any other native error
    return signInWithGoogleBrowser('native');
  }
}

/**
 * Sign in with Google using browser-based OAuth (Web and fallback for native).
 * Uses Supabase signInWithOAuth → opens Google's consent page.
 */
async function signInWithGoogleBrowser(origin: 'web' | 'native' = 'web'): Promise<GoogleAuthResult> {
  const supabase = getSupabaseClient();

  try {
    const isNative = origin === 'native' || (Platform.OS !== 'web');
    let redirectTo = isNative ? getNativeRedirectUrl() : getWebCallbackUrl();

    // Try to get a precise native redirect URI via expo-auth-session
    if (isNative) {
      try {
        const AuthSession = require('expo-auth-session');
        redirectTo = AuthSession.makeRedirectUri({ scheme: APP_SCHEME, path: 'home' });
      } catch (_e) {}
    }

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        skipBrowserRedirect: true,
        queryParams: {
          access_type: 'offline',
          prompt: 'select_account',
          // Pass your web client ID explicitly so Google uses your own OAuth app
          ...(GOOGLE_WEB_CLIENT_ID !== '153408485563-rlq4fqkp66lsapggf7hr017vkbkjgipd.apps.googleusercontent.com'
            ? { client_id: GOOGLE_WEB_CLIENT_ID }
            : {}),
        },
      },
    });

    if (error || !data?.url) {
      return { error: error?.message || 'Failed to get Google OAuth URL' };
    }

    // Open in system browser / popup
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

    if (result.type === 'success' && result.url) {
      // Parse the callback URL for tokens or code
      let searchStr = '';
      try {
        const parsed = new URL(result.url);
        searchStr = parsed.search + '&' + (parsed.hash || '').replace('#', '?');
      } catch (_e) {
        searchStr = result.url.includes('?') ? result.url.split('?')[1] : '';
      }
      const callbackParams = new URLSearchParams(searchStr);
      const code = callbackParams.get('code');
      const accessToken = callbackParams.get('access_token');
      const refreshToken = callbackParams.get('refresh_token');

      if (code) {
        const { error: exchError } = await supabase.auth.exchangeCodeForSession(result.url);
        if (exchError) return { error: exchError.message };
        try { await supabase.auth.refreshSession(); } catch (_) {}
        return { error: null };
      }

      if (accessToken && refreshToken) {
        const { error: setError } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        if (setError) return { error: setError.message };
        try { await supabase.auth.refreshSession(); } catch (_) {}
        return { error: null };
      }

      // Check if session was set via listener
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

  } catch (e: any) {
    const msg: string = e?.message || 'Unexpected error';
    const isCancellation = /cancel|dismiss|closed/i.test(msg);
    return { error: isCancellation ? 'cancel' : msg };
  }
}

/**
 * Main entry point — platform-aware Google Sign-In.
 *
 * iOS/Android: Tries native @react-native-google-signin/google-signin first,
 *              falls back to browser OAuth if the native SDK is unavailable.
 * Web:         Uses browser-based OAuth popup/redirect.
 */
export async function signInWithGoogleCrossPlatform(): Promise<GoogleAuthResult> {
  if (Platform.OS === 'web') {
    return signInWithGoogleBrowser('web');
  }
  return signInWithGoogleNative();
}
add this link https://davetopup.com/ fallback for auth login both must work.