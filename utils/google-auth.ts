/**
 * Cross-platform Google Sign-In helper.
 * Uses the app's existing `signInWithGoogle` from the template auth layer,
 * wrapped so callers always get a { error: string | null } result shape.
 */

import { getSupabaseClient } from '@/template';
import { Platform } from 'react-native';
import { openAuthSessionAsync } from './web-browser';

export interface GoogleSignInResult {
  error: string | null;
}

/**
 * Initiates Google OAuth sign-in on any platform (iOS, Android, Web).
 * On native it opens a browser session via expo-web-browser;
 * on web it uses a popup window.
 *
 * The Supabase client handles token exchange automatically via the
 * onAuthStateChange listener set up in the template auth provider.
 */
export async function signInWithGoogleCrossPlatform(): Promise<GoogleSignInResult> {
  try {
    const supabase = getSupabaseClient();

    // Build the redirect URL
    let redirectTo: string;
    if (Platform.OS === 'web') {
      // On web, redirect back to the /auth/callback route on the same origin
      if (typeof window !== 'undefined') {
        redirectTo = `${window.location.origin}/auth/callback`;
      } else {
        redirectTo = '/auth/callback';
      }
    } else {
      // On native, use the Expo deep-link scheme so the OS routes back to the app
      const scheme = process.env.EXPO_PUBLIC_APP_SCHEME || 'dawinix';
      redirectTo = `${scheme}://auth/callback`;
    }

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    if (error) {
      return { error: error.message };
    }

    const authUrl = data?.url;
    if (!authUrl) {
      return { error: 'Could not generate Google sign-in URL.' };
    }

    // ── Native: open in-app browser session ──────────────────────────────────
    if (Platform.OS !== 'web') {
      const result = await openAuthSessionAsync(authUrl, redirectTo);
      if (result.type === 'dismiss' || result.type === 'timeout') {
        return { error: 'Google sign-in was cancelled.' };
      }
      // The Supabase onAuthStateChange listener handles the session automatically
      return { error: null };
    }

    // ── Web: open popup (handled inside openAuthSessionAsync) ─────────────────
    const webResult = await openAuthSessionAsync(authUrl, redirectTo);
    if (webResult.type === 'dismiss' || webResult.type === 'timeout') {
      return { error: 'Google sign-in was cancelled.' };
    }

    // Let the Supabase client pick up the session from the callback URL
    if (webResult.url) {
      await supabase.auth.exchangeCodeForSession(webResult.url);
    }

    return { error: null };
  } catch (err: any) {
    const msg: string = err?.message || 'Unknown error during Google sign-in.';
    return { error: msg };
  }
}
