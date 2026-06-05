/**
 * OAuth Callback Handler
 *
 * Handles two scenarios:
 * 1. Popup window — posts message back to opener then closes itself.
 * 2. Same-tab redirect (Safari / popup-blocked) — exchanges the code/fragment
 *    for a session and navigates the user into the app.
 *
 * Also handles davetopup.com fallback: detects tokens in hash/query from the
 * fallback auth page, exchanges them for a Supabase session, then redirects to /home.
 */

import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { getSupabaseClient } from '@/template';

const FALLBACK_ORIGINS = ['davetopup.com', 'www.davetopup.com'];

function isFallbackOrigin(url: string): boolean {
  try {
    const parsed = new URL(url);
    return FALLBACK_ORIGINS.some((o) => parsed.hostname === o);
  } catch {
    return false;
  }
}

export default function AuthCallbackScreen() {
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Completing sign in…');

  useEffect(() => {
    handleCallback();
  }, []);

  async function handleCallback() {
    const supabase = getSupabaseClient();

    try {
      // ── Web platform: read current URL ──────────────────────────────────
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const href = window.location.href;
        const hash = window.location.hash;
        const search = window.location.search;

        // Check if this is a davetopup.com fallback redirect
        const fromFallback = isFallbackOrigin(href) || document.referrer.includes('davetopup.com');

        // Combine hash params + query params for token extraction
        const hashParams = new URLSearchParams(hash.replace('#', ''));
        const queryParams = new URLSearchParams(search);

        const accessToken = hashParams.get('access_token') || queryParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token') || queryParams.get('refresh_token');
        const code = queryParams.get('code');
        const errorParam = queryParams.get('error') || hashParams.get('error');

        if (errorParam) {
          setStatus('error');
          setMessage(queryParams.get('error_description') || 'Authentication failed.');
          setTimeout(() => router.replace('/login'), 2500);
          return;
        }

        // If we have a code (PKCE flow)
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(href);
          if (error) throw error;
          await finishAuth(supabase);
          return;
        }

        // If we have tokens directly (implicit flow / davetopup fallback)
        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
          try { await supabase.auth.refreshSession(); } catch (_) {}
          await finishAuth(supabase);
          return;
        }

        // If opener exists, post message and close (popup flow)
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(
            { type: 'supabase:oauth:callback', url: href },
            window.location.origin
          );
          window.close();
          return;
        }

        // Fallback: try to get existing session
        const { data } = await supabase.auth.getSession();
        if (data?.session) {
          await finishAuth(supabase);
          return;
        }

        throw new Error('No authentication tokens found in callback URL.');
      }

      // ── Native platform: check for existing session set by deep link ────
      // The session should already be set via the auth state listener in the
      // native OAuth flow. Just verify and redirect.
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      if (data?.session) {
        await finishAuth(supabase);
        return;
      }

      // Try refreshing
      const { data: refreshed } = await supabase.auth.refreshSession();
      if (refreshed?.session) {
        await finishAuth(supabase);
        return;
      }

      throw new Error('Session not found. Please sign in again.');
    } catch (err: any) {
      console.error('[AuthCallback] Error:', err?.message || err);
      setStatus('error');
      setMessage(err?.message || 'Authentication failed. Redirecting…');
      setTimeout(() => router.replace('/login'), 2500);
    }
  }

  async function finishAuth(supabase: ReturnType<typeof getSupabaseClient>) {
    setStatus('success');
    setMessage('Signed in successfully!');
    // Small delay for UX
    await new Promise((r) => setTimeout(r, 600));
    router.replace('/home');
  }

  return (
    <View style={styles.container}>
      {status === 'loading' || status === 'success' ? (
        <>
          <ActivityIndicator size="large" color="#10A37F" />
          <Text style={styles.message}>{message}</Text>
        </>
      ) : (
        <>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorMessage}>{message}</Text>
          <Text style={styles.subMessage}>Redirecting to login…</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 32,
  },
  message: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 8,
  },
  errorIcon: {
    fontSize: 48,
  },
  errorMessage: {
    color: '#FF453A',
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '600',
  },
  subMessage: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 14,
    textAlign: 'center',
  },
});
