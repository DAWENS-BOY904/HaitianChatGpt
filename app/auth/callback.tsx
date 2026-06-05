/**
 * OAuth Callback Handler
 *
 * This page handles two scenarios:
 * 1. Popup window — posts message back to opener then closes itself.
 * 2. Same-tab redirect (Safari / popup-blocked) — exchanges the code/fragment
 *    for a session and navigates the user into the app.
 */
import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { getSupabaseClient } from '@/template';

export default function OAuthCallback() {
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (Platform.OS !== 'web') {
      // On native this page should never be reached; just go home
      router.replace('/');
      return;
    }

    async function handleCallback() {
      try {
        const supabase = getSupabaseClient();

        // ── Popup path: signal the opener then close ───────────────────
        if (window.opener) {
          try {
            // Use '*' as target origin so the message reaches the opener
            // even when running in an iframe with a different origin (Safari fix)
            window.opener.postMessage(
              { type: 'supabase:oauth:callback', url: window.location.href },
              '*'
            );
            // Small delay so the message is received before the popup closes
            await new Promise(r => setTimeout(r, 300));
            window.close();
            return;
          } catch (_e) {
            // opener may have been garbage-collected; fall through to
            // direct session exchange below
          }
        }

        // ── Direct / same-tab path ─────────────────────────────────────
        // Let Supabase parse the URL (handles both hash tokens and PKCE codes)
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          setErrorMsg(error.message);
          setStatus('error');
          return;
        }

        if (data?.session) {
          router.replace('/home');
          return;
        }

        // If no session yet, try to exchange PKCE code from URL
        const params = new URLSearchParams(
          window.location.search + '&' + window.location.hash.replace(/^#/, '')
        );
        const code = params.get('code');
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(
            window.location.href
          );
          if (exchangeError) {
            setErrorMsg(exchangeError.message);
            setStatus('error');
            return;
          }
          router.replace('/home');
          return;
        }

        // No code or session — go to login
        router.replace('/login');
      } catch (e: any) {
        setErrorMsg(e?.message || 'Unknown error during OAuth callback.');
        setStatus('error');
      }
    }

    handleCallback();
  }, []);

  if (status === 'error') {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000', padding: 32 }}>
        <Text style={{ color: '#FF453A', fontSize: 16, textAlign: 'center', marginBottom: 12 }}>
          Sign-in failed
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, textAlign: 'center' }}>
          {errorMsg}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }}>
      <ActivityIndicator size="large" color="#10A37F" />
      <Text style={{ color: 'rgba(255,255,255,0.55)', marginTop: 16, fontSize: 14 }}>
        Completing sign-in…
      </Text>
    </View>
  );
}
handle the davetopup.com/auth/callback deep link in app/auth/callback.tsx so tokens returned from the fallback auth page are automatically exchanged for a Supabase session and the user is redirected to /home.