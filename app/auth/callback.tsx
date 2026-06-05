import { useEffect } from 'react';
import { View, ActivityIndicator, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { getSupabaseClient } from '@/template';

/**
 * Determines the post-auth redirect path.
 * Always returns an absolute URL on web so the domain is never lost.
 */
function getPostAuthRedirect(): string {
  if (Platform.OS !== 'web') return '/home';

  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  // davetopup.com
  if (origin.includes('davetopup.com')) {
    return `${origin}/home`;
  }

  // dawinix.com (www and non-www)
  if (origin.includes('dawinix.com')) {
    return `${origin}/home`;
  }

  // Default fallback — preserves whatever origin the app is running on
  return `${origin}/home`;
}

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    handleCallback();
  }, []);

  async function handleCallback() {
    try {
      const supabase = getSupabaseClient();

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const hash = window.location.hash;
        const search = window.location.search;
        const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
        const hashParams = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);

        const code = params.get('code');
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');

        // ── PKCE code exchange ──
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            console.error('[callback] PKCE exchange error:', error.message);
          }
          const redirect = getPostAuthRedirect();
          window.location.replace(redirect);
          return;
        }

        // ── Implicit flow — set session from hash tokens ──
        if (accessToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken ?? '',
          });
          if (error) {
            console.error('[callback] setSession error:', error.message);
          }

          // Notify opener (popup flow)
          if (window.opener && !window.opener.closed) {
            window.opener.postMessage({ type: 'SUPABASE_AUTH_CALLBACK', success: true }, '*');
            window.close();
            return;
          }

          const redirect = getPostAuthRedirect();
          window.location.replace(redirect);
          return;
        }

        // ── No tokens found — redirect anyway ──
        const redirect = getPostAuthRedirect();
        window.location.replace(redirect);
        return;
      }

      // ── Native (iOS / Android) ──
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        router.replace('/home');
      } else {
        router.replace('/login');
      }
    } catch (err: any) {
      console.error('[callback] Unhandled error:', err?.message);
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.location.replace(getPostAuthRedirect());
      } else {
        router.replace('/login');
      }
    }
  }

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0a0a0a' }}>
      <ActivityIndicator size="large" color="#10A37F" />
    </View>
  );
}
