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
  Image 
} from 'react-native';
import { useRouter, Redirect } from 'expo-router';
import { useAuth, useAlert, getSupabaseClient } from '@/template';
import { useTheme } from '../hooks/useTheme';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createClient } from '@supabase/supabase-js';

const WELCOME_PHRASES = [
  "Let's brainstorm",
  "What can I help with?",
  "Ask me anything",
  "Ready to assist you",
  "What's on your mind?",
];

// AI Logo URL
const AI_LOGO_URL = 'https://uzxmmddivzqjhcnnrkns.supabase.co/storage/v1/object/public/logo/WhatsApp%20Image%202026-04-18%20at%202.58.46%20AM.jpeg';

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

// ── Helper: get Apple-specific Supabase client ──
function getAppleSupabaseClient() {
  const supabaseUrl = process.env.MY_SUPABASE_URL || process.env.EXPO_PUBLIC_MY_SUPABASE_URL;
  const supabaseKey = process.env.MY_SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_MY_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
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

// ── Apple Sign-In ──
async function performAppleSignIn(
  showAlert: (title: string, msg?: string) => void
): Promise<{ user: any; error?: string }> {
  if (Platform.OS === 'web') {
    return { user: null, error: 'Apple Sign In is not available on web.' };
  }

  try {
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

    const supabase = getAppleSupabaseClient();
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
      nonce: rawNonce,
    });

    if (error) return { user: null, error: error.message };
    return { user: data?.user ?? null };
  } catch (e: any) {
    if (e?.code === 'ERR_REQUEST_CANCELED') return { user: null };
    return { user: null, error: e?.message || 'Apple Sign In failed' };
  }
}

// ── Branded splash logo ──
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
        width: 80, height: 80, borderRadius: 22,
        overflow: 'hidden',
        backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7',
        borderWidth: 1.5,
        borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <Image
          source={{ uri: AI_LOGO_URL }}
          style={{ width: 80, height: 80, borderRadius: 20 }}
          resizeMode="cover"
        />
      </View>
    </Animated.View>
  );
}

// ── Branded loading screen (photos 3 & 4) ──
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

// ── Static AI Logo ──
function AILogo({ size = 100 }: { size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.25, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(0,150,255,0.2)' }}>
      <Image
        source={{ uri: AI_LOGO_URL }}
        style={{ width: size, height: size }}
        resizeMode="cover"
      />
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
      if (user) {
        const email = user.email || `${user.id}@privaterelay.appleid.com`;
        sendLoginConfirmationEmail(user.id, email);
      }
    } finally {
      setLoading(null);
    }
  };

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
            style={[styles.appleButton, { backgroundColor: isDark ? '#FFFFFF' : '#000000' }]}
            onPress={handleApple}
            disabled={loading !== null}
            activeOpacity={0.82}
          >
            {loading === 'apple' ? (
              <ActivityIndicator size="small" color={isDark ? '#000' : '#FFF'} />
            ) : (
              <Ionicons name="logo-apple" size={20} color={isDark ? '#000000' : '#FFFFFF'} />
            )}
            <Text style={[styles.appleButtonText, { color: isDark ? '#000' : '#FFF' }]}>
              {loading === 'apple' ? 'Signing in...' : 'Continue with Apple'}
            </Text>
          </TouchableOpacity>
        ) : null}

        {/* Google Sign-In */}
        <TouchableOpacity
          style={styles.googleButton}
          onPress={handleGoogle}
          disabled={loading !== null}
          activeOpacity={0.82}
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

        {/* Email */}
        <TouchableOpacity 
          style={[styles.emailButton, { backgroundColor: colors.primary || '#10A37F' }]} 
          onPress={() => router.push('/login')}
          activeOpacity={0.82}
        >
          <Text style={styles.emailButtonText}>Continue with Email</Text>
        </TouchableOpacity>

        {/* Log in */}
        <TouchableOpacity 
          style={[styles.loginButton, { borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)' }]} 
          onPress={() => router.push('/login')}
          activeOpacity={0.82}
        >
          <Text style={[styles.loginButtonText, { color: colors.text }]}>Log in</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 60,
    gap: 16,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 38,
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
  },
  bottomSection: {
    width: '100%',
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 12,
  },
  appleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 50,
    paddingVertical: 16,
    gap: 10,
  },
  appleButtonText: {
    fontWeight: '700',
    fontSize: 16,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4A4A4A',
    borderRadius: 50,
    paddingVertical: 16,
    gap: 10,
  },
  googleButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  emailButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 50,
    paddingVertical: 16,
  },
  emailButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  loginButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 50,
    paddingVertical: 16,
    borderWidth: 1,
  },
  loginButtonText: {
    fontWeight: '600',
    fontSize: 16,
  },
});

export default function RootScreen() {
  const { user, loading } = useAuth();
  const { isDark } = useTheme();

  // Show branded splash while auth loads — prevents login flash + white/black screens
  if (loading) {
    return <SplashScreen />;
  }

  if (user) {
    return <Redirect href="/home" />;
  }

  return <WelcomeScreen />;
}
