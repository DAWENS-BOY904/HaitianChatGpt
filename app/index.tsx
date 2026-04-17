import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar, Platform, Animated, ActivityIndicator } from 'react-native';
import { useRouter, Redirect } from 'expo-router';
import { useAuth, useAlert, getSupabaseClient } from '@/template';
import { useTheme } from '../hooks/useTheme';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createClient } from '@supabase/supabase-js';

const WELCOME_PHRASES = [
  "Let's brainstorm",
  "What can I help with?",
  "Ask me anything",
  "Ready to assist you",
  "What's on your mind?",
];

// ── Helper: send login confirmation email (non-blocking) ──
async function sendLoginConfirmationEmail(userId: string, email: string) {
  try {
    const supabase = getSupabaseClient();
    await supabase.functions.invoke('send-login-email', {
      body: {
        userId,
        email,
        platform: Platform.OS,
        loginTime: new Date().toISOString(),
      },
    });
  } catch (e) {
    console.warn('Login email send failed:', e);
  }
}

// ── Helper: get Apple-specific Supabase client (uses MY_SUPABASE_URL) ──
function getAppleSupabaseClient() {
  const supabaseUrl = process.env.MY_SUPABASE_URL || process.env.EXPO_PUBLIC_MY_SUPABASE_URL;
  const supabaseKey = process.env.MY_SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_MY_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('MY_SUPABASE_URL or MY_SUPABASE_ANON_KEY not configured');
    // Fallback to regular client if env vars not set
    return getSupabaseClient();
  }
  
  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
}

// ── Apple Sign-In (native only) ──
async function performAppleSignIn(
  showAlert: (title: string, msg?: string) => void
): Promise<{ user: any; error?: string }> {
  if (Platform.OS === 'web') {
    return { user: null, error: 'Apple Sign In is not available on web.' };
  }

  try {
    // Dynamic import to avoid web build errors
    const AppleAuthentication = await import('expo-apple-authentication');
    const available = await AppleAuthentication.isAvailableAsync();
    if (!available) {
      return { user: null, error: 'Apple Sign In is not available on this device.' };
    }

    const generateNonce = (len: number) => {
      const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      let n = '';
      for (let i = 0; i < len; i++) n += charset[Math.floor(Math.random() * charset.length)];
      return n;
    };

    const rawNonce = generateNonce(32);
    const msgBuffer = new TextEncoder().encode(rawNonce);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashedNonce = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });

    if (!credential.identityToken) {
      return { user: null, error: 'Apple Sign In failed: no identity token returned.' };
    }

    // Use Apple-specific Supabase client with MY_SUPABASE_URL
    const supabase = getAppleSupabaseClient();
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
      nonce: rawNonce,
    });

    if (error) return { user: null, error: error.message };
    return { user: data?.user ?? null };
  } catch (e: any) {
    if (e?.code === 'ERR_REQUEST_CANCELED') return { user: null }; // user cancelled — no error
    return { user: null, error: e?.message || 'Apple Sign In failed' };
  }
}

function WelcomeScreen() {
  const { colors } = useTheme();
  const { signInWithGoogle } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [loading, setLoading] = useState<'apple' | 'google' | null>(null);
  const fadeTitle = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const interval = setInterval(() => {
      Animated.timing(fadeTitle, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
        setPhraseIndex(prev => (prev + 1) % WELCOME_PHRASES.length);
        Animated.timing(fadeTitle, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      });
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // ── Real Apple Sign-In ──
  const handleApple = async () => {
    if (Platform.OS !== 'ios') {
      showAlert('Not Available', 'Apple Sign In is only available on iOS.');
      return;
    }
    setLoading('apple');
    try {
      const { user, error } = await performAppleSignIn(showAlert);
      if (error) { showAlert('Sign In Failed', error); return; }
      if (user) {
        const email = user.email || `${user.id}@privaterelay.appleid.com`;
        sendLoginConfirmationEmail(user.id, email);
        // AuthRouter / Redirect will handle nav automatically via useAuth
      }
    } finally {
      setLoading(null);
    }
  };

  // ── Real Google Sign-In ──
  const handleGoogle = async () => {
    setLoading('google');
    try {
      const result = await signInWithGoogle() as any;
      const error = result?.error;
      const user = result?.user;
      if (error) { showAlert('Sign In Failed', error); return; }
      if (user) {
        sendLoginConfirmationEmail(user.id, user.email || '');
      }
    } finally {
      setLoading(null);
    }
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: Spacing.xl,
      paddingTop: Platform.select({ ios: insets.top + 60, android: insets.top + 60, default: 60 }),
    },
    title: { fontSize: 42, fontWeight: '700', color: colors.text, marginBottom: Spacing.lg, textAlign: 'center' },
    buttonContainer: {
      width: '100%',
      gap: Spacing.md,
      paddingHorizontal: Spacing.xl,
      paddingBottom: Platform.select({ ios: insets.bottom + Spacing.xxl, android: Spacing.xxl, default: Spacing.xxl }),
    },
    appleButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#FFFFFF',
      borderRadius: BorderRadius.full,
      padding: Spacing.md,
      gap: Spacing.sm,
    },
    appleButtonText: { color: '#000000', fontWeight: '600', fontSize: 16 },
    googleButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#4A4A4A',
      borderRadius: BorderRadius.full,
      padding: Spacing.md,
      gap: Spacing.sm,
    },
    googleButtonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 16 },
    signupButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#4A4A4A',
      borderRadius: BorderRadius.full,
      padding: Spacing.md,
    },
    signupButtonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 16 },
    loginButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
      borderRadius: BorderRadius.full,
      padding: Spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    loginButtonText: { color: colors.text, fontWeight: '600', fontSize: 16 },
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle={colors.text === '#FFFFFF' ? 'light-content' : 'dark-content'} />
      <View style={styles.content}>
        <Animated.Text style={[styles.title, { opacity: fadeTitle }]}>
          {WELCOME_PHRASES[phraseIndex]}
        </Animated.Text>
      </View>
      <View style={styles.buttonContainer}>
        {/* Apple Sign-In — direct, no login page redirect */}
        {Platform.OS === 'ios' ? (
          <TouchableOpacity
            style={styles.appleButton}
            onPress={handleApple}
            disabled={loading !== null}
          >
            {loading === 'apple' ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <Ionicons name="logo-apple" size={20} color="#000000" />
            )}
            <Text style={styles.appleButtonText}>
              {loading === 'apple' ? 'Signing in...' : 'Continue with Apple'}
            </Text>
          </TouchableOpacity>
        ) : null}

        {/* Google Sign-In — direct OAuth, no login page redirect */}
        <TouchableOpacity
          style={styles.googleButton}
          onPress={handleGoogle}
          disabled={loading !== null}
        >
          {loading === 'google' ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Ionicons name="logo-google" size={20} color="#FFFFFF" />
          )}
          <Text style={styles.googleButtonText}>
            {loading === 'google' ? 'Signing in...' : 'Continue with Google'}
          </Text>
        </TouchableOpacity>

        {/* Email sign-up / sign-in */}
        <TouchableOpacity style={styles.signupButton} onPress={() => router.push('/login')}>
          <Text style={styles.signupButtonText}>Continue with Email</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.loginButton} onPress={() => router.push('/login')}>
          <Text style={styles.loginButtonText}>Log in</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function RootScreen() {
  const { user } = useAuth();

  if (user) {
    return <Redirect href="/home" />;
  }

  return <WelcomeScreen />;
}
