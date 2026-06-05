/**
 * OAuth Callback Handler
 *
 * Handles two scenarios:
 * 1. Popup window — posts message back to opener then closes itself.
 * 2. Same-tab redirect (Safari / popup-blocked) — exchanges the code/fragment
 *    for a session and navigates the user into the app.
 *
 * Auto-detects origin: davetopup.com → /home on davetopup, dawinix → /home on dawinix.
 */

import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { getSupabaseClient } from '@/template';

function getPostAuthRedirect(): string {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return '/home';
  const origin = window.location.origin.toLowerCase();
  if (origin.includes('davetopup.com')) return 'https://davetopup.com/home';
  if (origin.includes('dawinix')) return 'https://www.dawinix.com/home';
  return '/home';
}

export default function AuthCallback() {
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (Platform.OS !== 'web') {
      router.replace('/home');
      return;
    }

    handleCallback();
  }, []);

  async function handleCallback() {
    try {
      const supabase = getSupabaseClient();

      if (typeof window === 'undefined') {
        router.replace('/home');
        return;
      }

      const url = window.location.href;
      const hashParams = new URLSearchParams(window.location.hash.replace('#', ''));
      const queryParams = new URLSearchParams(window.location.search);

      const accessToken = hashParams.get('access_token') || queryParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token') || queryParams.get('refresh_token');
      const code = queryParams.get('code');
      const errorParam = queryParams.get('error') || hashParams.get('error');

      if (errorParam) {
        const desc = queryParams.get('error_description') || hashParams.get('error_description') || errorParam;
        setErrorMsg(desc);
        setStatus('error');
        return;
      }

      // If opened as a popup, post back to opener and close
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage({ type: 'supabase:oauth:callback', url }, '*');
        window.close();
        return;
      }

      // Same-tab flow: exchange code or set session from tokens
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(url);
        if (error) throw error;
      } else if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error) throw error;
        try { await supabase.auth.refreshSession(); } catch (_) {}
      } else {
        // No tokens — check if session already established
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          throw new Error('No authentication data found in callback URL.');
        }
      }

      setStatus('success');

      // Redirect based on origin
      const redirect = getPostAuthRedirect();
      if (redirect.startsWith('http')) {
        window.location.href = redirect;
      } else {
        router.replace(redirect as any);
      }
    } catch (err: any) {
      console.error('Auth callback error:', err);
      setErrorMsg(err?.message || 'Authentication failed.');
      setStatus('error');
      setTimeout(() => router.replace('/login'), 3000);
    }
  }

  return (
    <View style={styles.container}>
      {status === 'loading' && (
        <>
          <ActivityIndicator size="large" color="#10A37F" />
          <Text style={styles.text}>Completing sign in...</Text>
        </>
      )}
      {status === 'success' && (
        <Text style={styles.text}>Sign in successful! Redirecting...</Text>
      )}
      {status === 'error' && (
        <>
          <Text style={[styles.text, { color: '#FF453A' }]}>Authentication failed</Text>
          <Text style={styles.subText}>{errorMsg}</Text>
          <Text style={styles.subText}>Redirecting to login...</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
    gap: 16,
    padding: 32,
  },
  text: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
  subText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
