import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  StatusBar, 
  Platform, 
  ActivityIndicator,
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

// AI Logo URL - won gradient logo
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
    console.error('MY_SUPABASE_URL or MY_SUPABASE_ANON_KEY not configured');
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

// ── Static AI Logo (no animation) ──
function AILogo({ size = 100 }: { size?: number }) {
  return (
    <View style={[logoStyles.logoContainer, { width: size, height: size }]}>
      <View 
        style={[
          logoStyles.logoWrapper,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
          }
        ]}
      >
        <Image
          source={{ uri: AI_LOGO_URL }}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
          }}
          resizeMode="cover"
        />
      </View>
    </View>
  );
}

const logoStyles = StyleSheet.create({
  logoContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoWrapper: {
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(0, 150, 255, 0.3)',
  },
});

function WelcomeScreen() {
  const { colors } = useTheme();
  const { signInWithGoogle } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [loading, setLoading] = useState<'apple' | 'google' | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setPhraseIndex(prev => (prev + 1) % WELCOME_PHRASES.length);
    }, 3000);
    return () => clearInterval(interval);
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
      <StatusBar barStyle={colors.text === '#FFFFFF' ? 'light-content' : 'dark-content'} />
      
      {/* Top Section - Logo + Title */}
      <View style={styles.topSection}>
        <AILogo size={100} />
        <Text style={[styles.title, { color: colors.text }]}>
          {WELCOME_PHRASES[phraseIndex]}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary || '#666' }]}>
          Your AI Assistant
        </Text>
      </View>
      
      {/* Bottom Section - Buttons */}
      <View style={[styles.bottomSection, { paddingBottom: Math.max(insets.bottom, 20) + 20 }]}>
        {/* Apple Sign-In */}
        {Platform.OS === 'ios' ? (
          <TouchableOpacity
            style={styles.appleButton}
            onPress={handleApple}
            disabled={loading !== null}
            activeOpacity={0.8}
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

        {/* Google Sign-In */}
        <TouchableOpacity
          style={styles.googleButton}
          onPress={handleGoogle}
          disabled={loading !== null}
          activeOpacity={0.8}
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

        {/* Email sign-up */}
        <TouchableOpacity 
          style={[styles.emailButton, { backgroundColor: colors.primary || '#007AFF' }]} 
          onPress={() => router.push('/login')}
          activeOpacity={0.8}
        >
          <Text style={styles.emailButtonText}>Continue with Email</Text>
        </TouchableOpacity>

        {/* Log in */}
        <TouchableOpacity 
          style={[styles.loginButton, { borderColor: colors.border }]} 
          onPress={() => router.push('/login')}
          activeOpacity={0.8}
        >
          <Text style={[styles.loginButtonText, { color: colors.text }]}>Log in</Text>
        </TouchableOpacity>
      </View>
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
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    marginTop: 24,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
  bottomSection: {
    width: '100%',
    paddingHorizontal: 24,
    paddingTop: 20,
    gap: 12,
  },
  appleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  appleButtonText: {
    color: '#000000',
    fontWeight: '600',
    fontSize: 16,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4A4A4A',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 10,
  },
  googleButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
  emailButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 14,
  },
  emailButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
  loginButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1,
  },
  loginButtonText: {
    fontWeight: '600',
    fontSize: 16,
  },
});

export default function RootScreen() {
  const { user } = useAuth();

  if (user) {
    return <Redirect href="/home" />;
  }

  return <WelcomeScreen />;
}
