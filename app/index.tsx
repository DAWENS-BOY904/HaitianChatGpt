import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Platform,
  ActivityIndicator,
  Animated,
  Image,
  Linking,
} from 'react-native';
import { useRouter, Redirect } from 'expo-router';
import { useAuth, useAlert, getSupabaseClient } from '@/template';
import { useTheme } from '../hooks/useTheme';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';

const WELCOME_PHRASES = [
  "Let's brainstorm",
  "What can I help with?",
  "Ask me anything",
  "Ready to assist you",
  "What's on your mind?",
];

const AI_LOGO_URL =
  'https://uzxmmddivzqjhcnnrkns.supabase.co/storage/v1/object/public/logo/WhatsApp%20Image%202026-04-18%20at%202.58.46%20AM.jpeg';

async function sendLoginConfirmationEmail(userId: string, email: string) {
  try {
    const supabase = getSupabaseClient();
    await supabase.functions.invoke('send-login-email', {
      body: { userId, email, platform: Platform.OS, loginTime: new Date().toISOString() },
    });
  } catch (e) {
    console.warn('Login email send failed:', e);
  }
}

// ── Proper Google G SVG icon via colored text segments ──
function GoogleLogo({ size = 20 }: { size?: number }) {
  const s = size;
  return (
    <View style={{ width: s, height: s, borderRadius: s / 2, overflow: 'hidden', backgroundColor: 'white', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: s * 0.7, fontWeight: '900', color: '#4285F4', lineHeight: s * 0.75 }}>G</Text>
    </View>
  );
}

// ── Apple Sign-In (dynamic import to avoid web bundle errors) ──
async function performAppleSignIn(showAlert: (title: string, msg?: string) => void): Promise<{ user: any; error?: string }> {
  if (Platform.OS !== 'ios') return { user: null, error: 'Apple Sign In is only available on iOS.' };

  let AppleAuthentication: any;
  let Crypto: any;
  try {
    AppleAuthentication = require('expo-apple-authentication');
    Crypto = require('expo-crypto');
    // Validate the module loaded correctly
    if (!AppleAuthentication || typeof AppleAuthentication.signInAsync !== 'function') {
      throw new Error('Apple Authentication module not properly loaded');
    }
  } catch (_e) {
    return { user: null, error: 'Apple Sign In requires a native development build.' };
  }

  try {
    // Check availability safely — some builds don't have isAvailableAsync
    if (typeof AppleAuthentication.isAvailableAsync === 'function') {
      const available = await AppleAuthentication.isAvailableAsync();
      if (!available) return { user: null }; // silently skip — not available
    }

    const rawNonce = Array.from({ length: 32 }, () =>
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[
        Math.floor(Math.random() * 62)
      ]
    ).join('');

    const hashedNonce = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      rawNonce
    );

    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });

    if (!credential.identityToken) return { user: null, error: 'Apple did not return an identity token.' };

    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
      nonce: rawNonce,
    });

    if (error) return { user: null, error: error.message };

    if (credential.fullName || credential.email) {
      const updates: any = {};
      if (credential.fullName?.givenName || credential.fullName?.familyName) {
        updates.data = {
          ...(updates.data || {}),
          full_name: [credential.fullName.givenName, credential.fullName.familyName]
            .filter(Boolean)
            .join(' '),
          given_name: credential.fullName.givenName,
          family_name: credential.fullName.familyName,
        };
      }
      if (Object.keys(updates).length > 0) {
        await supabase.auth.updateUser(updates);
      }
    }

    return { user: data?.user ?? null };
  } catch (e: any) {
    if (e?.code === 'ERR_REQUEST_CANCELED') return { user: null };
    return { user: null, error: e?.message || 'Apple Sign In failed' };
  }
}

// ── Google OAuth via Supabase URL (no WebBrowser needed) ──
async function performGoogleSignIn(): Promise<{ error?: string }> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'haitian-chatgpt://auth/callback',
        skipBrowserRedirect: true,
      },
    });
    if (error) return { error: error.message };
    if (data?.url) {
      await Linking.openURL(data.url);
      return {};
    }
    return { error: 'Could not get Google sign-in URL' };
  } catch (e: any) {
    return { error: e?.message || 'Google sign-in failed' };
  }
}

function BrandedLogo({ isDark }: { isDark?: boolean }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.06, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
      <View style={{
        width: 80, height: 80, borderRadius: 22, overflow: 'hidden',
        backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7',
        borderWidth: 1.5,
        borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Image source={{ uri: AI_LOGO_URL }} style={{ width: 80, height: 80, borderRadius: 20 }} resizeMode="cover" />
      </View>
    </Animated.View>
  );
}

function SplashScreen() {
  const { isDark } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);
  const bg = isDark ? '#000' : '#FFFFFF';
  return (
    <View style={{ flex: 1, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={bg} />
      <Animated.View style={{ opacity: fadeAnim, alignItems: 'center' }}>
        <BrandedLogo isDark={isDark} />
      </Animated.View>
    </View>
  );
}

function AILogo({ size = 100 }: { size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.25, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(0,150,255,0.2)' }}>
      <Image source={{ uri: AI_LOGO_URL }} style={{ width: size, height: size }} resizeMode="cover" />
    </View>
  );
}

function WelcomeScreen() {
  const { colors, isDark } = useTheme();
  const { signInWithGoogle } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [loading, setLoading] = useState<'apple' | 'google' | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    const interval = setInterval(() => {
      setPhraseIndex(prev => (prev + 1) % WELCOME_PHRASES.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleApple = async () => {
    if (Platform.OS !== 'ios') {
      showAlert('Not Available', 'Apple Sign In is only available on iOS.');
      return;
    }
    setLoading('apple');
    try {
      const { user, error } = await performAppleSignIn(showAlert);
      if (error) { showAlert('Sign In Failed', error); return; }
      if (user) sendLoginConfirmationEmail(user.id, user.email || '');
    } finally {
      setLoading(null);
    }
  };

  const handleGoogle = async () => {
    setLoading('google');
    try {
      // Try template signInWithGoogle first, fallback to direct OAuth URL
      let result: any;
      try {
        result = await signInWithGoogle();
      } catch (innerErr: any) {
        // Template method failed (e.g. WebBrowser issue), use direct Linking
        result = await performGoogleSignIn();
      }

      const error = result?.error;
      if (error) {
        const lower = (error || '').toLowerCase();
        const isCancellation = lower.includes('cancel') || lower.includes('dismiss') || lower.includes('closed');
        if (!isCancellation) showAlert('Sign In Failed', error);
      }
    } catch (err: any) {
      const msg = (err?.message || '').toLowerCase();
      const isCancellation = msg.includes('cancel') || msg.includes('dismiss') || msg.includes('closed');
      if (!isCancellation) {
        // Final fallback: open OAuth URL directly
        try {
          await performGoogleSignIn();
        } catch (e2) {
          showAlert('Error', 'Google sign-in failed. Please try again.');
        }
      }
    } finally {
      setLoading(null);
    }
  };

  const btnBase: any = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 50,
    paddingVertical: 15,
    paddingHorizontal: 20,
    gap: 10,
    overflow: 'hidden',
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      <Animated.View style={[styles.topSection, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <AILogo size={90} />
        <Text style={[styles.title, { color: colors.text }]}>
          {WELCOME_PHRASES[phraseIndex]}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary || '#666' }]}>
          Your AI Assistant
        </Text>
      </Animated.View>

      <Animated.View style={[styles.bottomSection, { paddingBottom: Math.max(insets.bottom, 20) + 20, opacity: fadeAnim }]}>

        {/* Apple Sign-In — iOS only */}
        {Platform.OS === 'ios' ? (
          <TouchableOpacity
            style={[btnBase, { backgroundColor: isDark ? '#FFFFFF' : '#000000' }]}
            onPress={handleApple}
            disabled={loading !== null}
            activeOpacity={0.82}
          >
            {loading === 'apple' ? (
              <ActivityIndicator size="small" color={isDark ? '#000' : '#FFF'} />
            ) : (
              <Ionicons name="logo-apple" size={20} color={isDark ? '#000000' : '#FFFFFF'} />
            )}
            <Text style={{ fontWeight: '700', fontSize: 16, color: isDark ? '#000' : '#FFF' }}>
              {loading === 'apple' ? 'Signing in...' : 'Continue with Apple'}
            </Text>
          </TouchableOpacity>
        ) : null}

        {/* Google Sign-In — real colored G icon */}
        <TouchableOpacity
          style={[btnBase, {
            backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
            borderWidth: 1,
            borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)',
          }]}
          onPress={handleGoogle}
          disabled={loading !== null}
          activeOpacity={0.82}
        >
          {loading === 'google' ? (
            <ActivityIndicator size="small" color={colors.text} />
          ) : (
            <>
              {/* Colored Google G */}
              <View style={{ width: 22, height: 22, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 15, fontWeight: '900', color: '#4285F4' }}>G</Text>
              </View>
            </>
          )}
          <Text style={{ fontWeight: '600', fontSize: 16, color: colors.text }}>
            {loading === 'google' ? 'Signing in...' : 'Continue with Google'}
          </Text>
        </TouchableOpacity>

        {/* Continue with Email */}
        <TouchableOpacity
          style={[btnBase, {
            backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
            borderWidth: 1,
            borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)',
          }]}
          onPress={() => router.push('/login')}
          activeOpacity={0.82}
        >
          <Ionicons name="mail-outline" size={20} color={colors.text} />
          <Text style={{ fontWeight: '600', fontSize: 16, color: colors.text }}>Continue with email</Text>
        </TouchableOpacity>

        {/* Continue with Phone */}
        <TouchableOpacity
          style={[btnBase, {
            backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
            borderWidth: 1,
            borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)',
          }]}
          onPress={() => router.push('/phone-entry')}
          activeOpacity={0.82}
        >
          <Ionicons name="call-outline" size={20} color={colors.text} />
          <Text style={{ fontWeight: '600', fontSize: 16, color: colors.text }}>Continue with phone</Text>
        </TouchableOpacity>

        {/* Continue as Guest */}
        <TouchableOpacity
          style={[btnBase, {
            backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
            borderWidth: 1,
            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
          }]}
          onPress={() => router.push('/login')}
          activeOpacity={0.82}
        >
          <Text style={{ fontWeight: '500', fontSize: 16, color: colors.textSecondary || '#888' }}>Login</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 60,
    gap: 16,
  },
  title: { fontSize: 30, fontWeight: '700', textAlign: 'center', lineHeight: 38 },
  subtitle: { fontSize: 15, textAlign: 'center' },
  bottomSection: {
    width: '100%',
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 12,
  },
});

export default function RootScreen() {
  const { user, loading } = useAuth();
  const { isDark } = useTheme();
  const router = useRouter();

  // After login completes, redirect to home — using useEffect prevents
  // the white-screen race between auth state update and Stack navigation.
  useEffect(() => {
    if (!loading && user) {
      router.replace('/home');
    }
  }, [user, loading]);

  if (loading) return <SplashScreen />;
  if (user) return <SplashScreen />; // show splash while effect fires
  return <WelcomeScreen />;
}