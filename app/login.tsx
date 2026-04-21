import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Platform,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { useAuth, useAlert, getSupabaseClient } from '@/template';
import { useTheme } from '../hooks/useTheme';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { createClient } from '@supabase/supabase-js';

// ── AI Logo ──
const AI_LOGO_URL = 'https://uzxmmddivzqjhcnnrkns.supabase.co/storage/v1/object/public/logo/logo.png';

// ── NOUVO SUPABASE POU APPLE LOGIN SELMAN ──
const MY_SUPABASE_URL = 'https://uzxmmddivzqjhcnnrkns.supabase.co'; // METE URL OU A ISIT LA
const MY_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6eG1tZGRpdnpxamhjbm5ya25zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MTY5MjEsImV4cCI6MjA5MTk5MjkyMX0.6PYtbRps9YJjvX5ibxGy346uA82RadEEpFrhSHa1UIE'; // METE KEY OU A ISIT LA

// Kreye yon nouvo kliyan Supabase pou Apple login selman
const appleSupabase = createClient(MY_SUPABASE_URL, MY_SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

const logoStyles = StyleSheet.create({
  logoWrapper: {
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(0, 150, 255, 0.5)',
    ...Platform.select({
      ios: { shadowColor: '#0096FF', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 8 },
      android: { elevation: 6 },
    }),
  },
});

function AILogo({ size = 64 }: { size?: number }) {
  return (
    <View style={[logoStyles.logoWrapper, { width: size, height: size, borderRadius: size / 2 }]}>
      <Image
        source={{ uri: AI_LOGO_URL }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        contentFit="cover"
      />
    </View>
  );
}

// ── Helper: send login confirmation email (SOU ANSYEN SUPABASE) ──
async function sendLoginConfirmationEmail(userId: string, email: string) {
  try {
    const supabase = getSupabaseClient(); // ANSYEN SUPABASE
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

// ── Helper: Generate nonce pou Apple Sign In ──
async function generateNonce(length: number = 32): Promise<string> {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const randomBytes = await Crypto.getRandomBytesAsync(length);
  let nonce = '';
  for (let i = 0; i < length; i++) {
    nonce += charset[randomBytes[i] % charset.length];
  }
  return nonce;
}

// ── Helper: SHA256 hash pou Apple nonce ──
async function sha256Hash(str: string): Promise<string> {
  try {
    // Eseye metod Expo Crypto la avan
    const digest = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      str
    );
    return digest;
  } catch (e) {
    // Fallback: itilize js-sha256 si disponib oswa yon lòt metod
    console.warn('SHA256 with expo-crypto failed, trying fallback:', e);
    // Ou ka ajoute js-sha256 kòm yon dependency si ou vle
    throw new Error('SHA256 hashing failed. Please ensure expo-crypto is properly configured.');
  }
}

export default function LoginScreen() {
  const { colors } = useTheme();
  const { signInWithPassword, signInWithGoogle, operationLoading, user } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [checkingPasskey, setCheckingPasskey] = useState(false);
  const [showPasskeyPrompt, setShowPasskeyPrompt] = useState(false);
  const [passkeyBiometricLabel, setPasskeyBiometricLabel] = useState('Biometrics');
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [passkeyUserId, setPasskeyUserId] = useState<string | null>(null);
  const [appleLoading, setAppleLoading] = useState(false);
  const [guestModalVisible, setGuestModalVisible] = useState(false);

  // On mount: check for existing passkeys (SOU ANSYEN SUPABASE)
  useEffect(() => {
    checkForPasskeyLogin();
  }, []);

  // Watch for user changes and navigate when authenticated
  useEffect(() => {
    if (user) {
      router.replace('/home');
    }
  }, [user]);

  // ── PASSKEY LOGIC SOU ANSYEN SUPABASE (PA MANYEN) ──
  const checkForPasskeyLogin = async () => {
    if (Platform.OS === 'web') return;
    try {
      const supabase = getSupabaseClient(); // ANSYEN SUPABASE

      const cleared = await AsyncStorage.getItem('passkey_session_active');
      if (cleared === 'false') return;

      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      if (!userId) return;

      const { data: passkeys } = await supabase
        .from('user_api_keys')
        .select('id, key_value')
        .eq('user_id', userId)
        .eq('key_name', 'passkey')
        .eq('is_active', true)
        .limit(1);

      if (!passkeys || passkeys.length === 0) return;

      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!compatible || !enrolled) return;

      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      let label = 'Biometrics';
      if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) label = 'Face ID';
      else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) label = Platform.OS === 'ios' ? 'Touch ID' : 'Fingerprint';

      setPasskeyBiometricLabel(label);
      setPasskeyUserId(userId);
      setShowPasskeyPrompt(true);
    } catch (err) {
      console.log('Passkey check error:', err);
    }
  };

  const handlePasskeyAuthenticate = async () => {
    setPasskeyLoading(true);
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: `Sign in with ${passkeyBiometricLabel}`,
        fallbackLabel: 'Use password instead',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });
      if (result.success) {
        await AsyncStorage.setItem('passkey_session_active', 'true');
        router.replace('/home');
      } else {
        setShowPasskeyPrompt(false);
      }
    } catch {
      setShowPasskeyPrompt(false);
    } finally {
      setPasskeyLoading(false);
    }
  };

  const emailDomains = [
    '@gmail.com', '@icloud.com', '@yahoo.com',
    '@outlook.com', '@hotmail.com', '@proton.me',
  ];

  const handleEmailChange = (text: string) => {
    setEmail(text);
    if (text.includes('@')) {
      setShowSuggestions(false);
      return;
    }
    if (text.length > 0) {
      setSuggestions(emailDomains.map(domain => text + domain));
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  const [adminCodeSending, setAdminCodeSending] = useState(false);

  // ── EMAIL LOGIN (SOU ANSYEN SUPABASE) ──
  const handleEmailContinue = async () => {
    if (!email.trim()) {
      showAlert('Error', 'Please enter your email address');
      return;
    }
    const adminEmails = ['berryxoe@gmail.com', 'newdawens@gmail.com', 'kontgithub@gmail.com'];
    if (adminEmails.includes(email.toLowerCase())) {
      setAdminCodeSending(true);
      try {
        const supabase = getSupabaseClient(); // ANSYEN SUPABASE
        const { error: otpError } = await supabase.auth.signInWithOtp({
          email: email.toLowerCase(),
          options: { shouldCreateUser: false },
        });
        if (otpError) throw new Error(otpError.message);
      } catch (e: any) {
        showAlert('Error', e?.message || 'Failed to send admin code. Please try again.');
        setAdminCodeSending(false);
        return;
      } finally {
        setAdminCodeSending(false);
      }
      router.push({ pathname: '/verify-code', params: { email: email.toLowerCase(), mode: 'admin_login' } });
    } else {
      router.push({ pathname: '/login-password', params: { email } });
    }
  };

  // ── GOOGLE LOGIN (SOU ANSYEN SUPABASE) ──
  const handleGoogleSignIn = async () => {
    try {
      const { error, user: googleUser } = await signInWithGoogle() as any;
      if (error) {
        showAlert('Error', error);
        return;
      }
      if (googleUser) {
        await sendLoginConfirmationEmail(googleUser.id, googleUser.email || email);
      }
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      showAlert('Error', err?.message || 'Google sign-in failed. Please try again.');
    }
  };

  const handlePhoneLogin = () => {
    router.push('/phone-entry');
  };

  const handleGuestMode = () => {
    router.replace('/home');
  };

  // ═══════════════════════════════════════════════════════
  // ── APPLE SIGN IN (SOU NOUVO SUPABASE SELMAN) ──
  // ═══════════════════════════════════════════════════════
  const handleAppleSignIn = async () => {
    if (Platform.OS !== 'ios') {
      showAlert('Not Available', 'Apple Sign In is only available on iOS devices.');
      return;
    }

    setAppleLoading(true);
    
    try {
      // Verify Apple Sign In available
      const available = await AppleAuthentication.isAvailableAsync();
      if (!available) {
        showAlert('Not Available', 'Apple Sign In is not available on this device.');
        setAppleLoading(false);
        return;
      }

      // 1. Generate raw nonce
      const rawNonce = await generateNonce(32);
      
      // 2. Hash nonce with SHA256 pou Apple
      const hashedNonce = await sha256Hash(rawNonce);

      // 3. Request Apple credentials
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce, // Apple resevwa hashed nonce
      });

      if (!credential.identityToken) {
        showAlert('Sign In Error', 'Apple did not return an identity token.');
        setAppleLoading(false);
        return;
      }

      // 4. Sign in to NOUVO Supabase with Apple ID token
      const { data, error } = await appleSupabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
        nonce: rawNonce, // Supabase resevwa RAW nonce (li pral hash li pou verifye)
      });

      if (error) {
        console.error('Supabase Apple sign-in error:', error);
        showAlert('Sign In Failed', error.message || 'Failed to authenticate with Apple.');
        setAppleLoading(false);
        return;
      }

      if (data?.user) {
        // Update profile with Apple name if provided (first sign-in only)
        if (credential.fullName?.givenName || credential.fullName?.familyName) {
          const fullName = [
            credential.fullName.givenName,
            credential.fullName.familyName,
          ].filter(Boolean).join(' ');
          
          try {
            await appleSupabase
              .from('user_profiles')
              .update({ full_name: fullName })
              .eq('id', data.user.id);
          } catch (profileErr) {
            console.log('Profile update error (non-critical):', profileErr);
          }
        }

        // Voye login email sou ANSYEN supabase (si ou vle kenbe tracking la)
        const appleEmail = data.user.email || credential.email || `${credential.user}@privaterelay.appleid.com`;
        await sendLoginConfirmationEmail(data.user.id, appleEmail);
        
        // IMPORTANT: Si ou vle itilize ansyen Supabase pou lòt bagay, 
        // ou ka kopye session la oswa kreye yon koneksyon ant de kont yo
        // Men pou kounye a, navigation ap fet pa useEffect ki gade 'user' state
        // Ou ka bezwen ajoute yon mekanis pou update 'user' state la si li pa auto
      }
    } catch (e: any) {
      if (e?.code === 'ERR_REQUEST_CANCELED') {
        console.log('Apple Sign In cancelled by user');
      } else if (e?.code === 'ERR_APPLE_AUTHENTICATION_CREDENTIAL') {
        showAlert('Sign In Failed', 'Apple credential error. Please try again.');
      } else {
        console.error('Apple Sign In error:', e);
        showAlert('Sign In Error', e?.message || 'Apple Sign In failed. Please try again.');
      }
    } finally {
      setAppleLoading(false);
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    closeButton: {
      position: 'absolute',
      top: Platform.select({ ios: insets.top + 16, android: insets.top + 16, default: 16 }),
      right: 20,
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    content: {
      flex: 1,
      paddingHorizontal: Spacing.xl,
      paddingTop: Platform.select({
        ios: insets.top + 80,
        android: insets.top + 80,
        default: 80,
      }),
    },
    title: {
      fontSize: 34,
      fontWeight: '700',
      color: colors.text,
      marginBottom: Spacing.xl,
      textAlign: 'center',
    },
    description: {
      ...Typography.body,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: Spacing.xxl,
      lineHeight: 22,
    },
    inputContainer: {
      backgroundColor: colors.surface,
      borderRadius: BorderRadius.lg,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      marginBottom: Spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    inputLabel: {
      ...Typography.caption,
      color: colors.textSecondary,
      fontSize: 12,
      marginBottom: 4,
    },
    input: {
      ...Typography.body,
      color: colors.text,
      fontSize: 16,
      padding: 0,
    },
    continueButton: {
      backgroundColor: colors.text,
      borderRadius: BorderRadius.full,
      padding: Spacing.md,
      alignItems: 'center',
      marginBottom: Spacing.xl,
    },
    continueButtonDisabled: { opacity: 0.3 },
    continueButtonText: {
      ...Typography.body,
      color: colors.background,
      fontWeight: '600',
      fontSize: 16,
    },
    divider: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: Spacing.xl,
    },
    dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
    dividerText: {
      ...Typography.body,
      color: colors.textSecondary,
      paddingHorizontal: Spacing.md,
    },
    appleButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#000000',
      borderRadius: BorderRadius.full,
      padding: Spacing.md,
      marginBottom: Spacing.md,
      borderWidth: 1,
      borderColor: '#000000',
      gap: Spacing.sm,
      opacity: appleLoading ? 0.7 : 1,
    },
    appleButtonText: {
      ...Typography.body,
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '500',
    },
    oauthButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderRadius: BorderRadius.full,
      padding: Spacing.md,
      marginBottom: Spacing.md,
      borderWidth: 1.5,
      borderColor: colors.border,
      gap: Spacing.sm,
      opacity: operationLoading ? 0.7 : 1,
    },
    oauthButtonText: {
      ...Typography.body,
      color: colors.text,
      fontSize: 16,
      fontWeight: '500',
    },
  });

  const pkStyles = StyleSheet.create({
    overlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.92)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 999,
      paddingHorizontal: 32,
    },
    card: {
      width: '100%',
      alignItems: 'center',
      paddingVertical: 48,
    },
    iconWrap: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: 'rgba(255,255,255,0.1)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 28,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.15)',
    },
    title: {
      fontSize: 26,
      fontWeight: '700',
      color: '#FFFFFF',
      marginBottom: 10,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 15,
      color: 'rgba(255,255,255,0.55)',
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: 48,
    },
    primaryBtn: {
      width: '100%',
      backgroundColor: '#FFFFFF',
      borderRadius: 50,
      paddingVertical: 16,
      alignItems: 'center',
      marginBottom: 14,
    },
    primaryBtnText: {
      fontSize: 17,
      fontWeight: '700',
      color: '#000000',
    },
    secondaryBtn: {
      paddingVertical: 12,
      paddingHorizontal: 24,
    },
    secondaryBtnText: {
      fontSize: 16,
      color: 'rgba(255,255,255,0.5)',
      fontWeight: '500',
    },
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle={colors.text === '#FFFFFF' ? 'light-content' : 'dark-content'} />

      {showPasskeyPrompt && (
        <View style={pkStyles.overlay}>
          <View style={pkStyles.card}>
            <View style={pkStyles.iconWrap}>
              <Ionicons
                name={passkeyBiometricLabel === 'Face ID' ? 'scan-outline' : 'finger-print-outline'}
                size={52}
                color="#FFFFFF"
              />
            </View>
            <Text style={pkStyles.title}>Sign in faster</Text>
            <Text style={pkStyles.subtitle}>
              Use {passkeyBiometricLabel} to sign in to your account
            </Text>
            <TouchableOpacity
              style={pkStyles.primaryBtn}
              onPress={handlePasskeyAuthenticate}
              disabled={passkeyLoading}
            >
              {passkeyLoading ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={pkStyles.primaryBtnText}>Sign in with {passkeyBiometricLabel}</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={pkStyles.secondaryBtn}
              onPress={() => setShowPasskeyPrompt(false)}
            >
              <Text style={pkStyles.secondaryBtnText}>Use password instead</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
        <Ionicons name="close" size={24} color={colors.text} />
      </TouchableOpacity>

      <View style={styles.content}>
        <View style={{ alignItems: 'center', marginBottom: 16 }}>
          <AILogo size={72} />
        </View>
        <Text style={styles.title}>Log in or sign up</Text>
        <Text style={styles.description}>
          You will get smarter responses and can upload files, images and more.
        </Text>

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder=""
            placeholderTextColor={colors.textSecondary}
            value={email}
            onChangeText={handleEmailChange}
            autoCapitalize="none"
            keyboardType="email-address"
            editable={!operationLoading}
            accessibilityLabel="Email address"
          />
        </View>

        {showSuggestions && (
          <View style={{
            backgroundColor: colors.surface,
            borderRadius: 10,
            marginTop: 6,
            borderWidth: 1,
            borderColor: colors.border,
          }}>
            {suggestions.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={{
                  padding: 12,
                  borderBottomWidth: index !== suggestions.length - 1 ? 1 : 0,
                  borderColor: colors.border,
                }}
                onPress={() => { setEmail(item); setShowSuggestions(false); }}
              >
                <Text style={{ color: colors.text }}>{item}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={[styles.continueButton, !email.trim() && styles.continueButtonDisabled]}
          onPress={handleEmailContinue}
          disabled={!email.trim() || operationLoading || adminCodeSending}
          accessibilityLabel="Continue with email"
          accessibilityRole="button"
        >
          {adminCodeSending ? (
            <ActivityIndicator size="small" color={colors.background} />
          ) : (
            <Text style={styles.continueButtonText}>
              {operationLoading ? 'Processing...' : 'Continue'}
            </Text>
          )}
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OR</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Google Button - SOU ANSYEN SUPABASE */}
        <TouchableOpacity
          style={styles.oauthButton}
          onPress={handleGoogleSignIn}
          disabled={operationLoading}
          accessibilityLabel="Continue with Google"
          accessibilityRole="button"
        >
          {operationLoading ? (
            <ActivityIndicator size="small" color={colors.text} />
          ) : (
            <>
              <Ionicons name="logo-google" size={20} color={colors.text} />
              <Text style={styles.oauthButtonText}>Continue with Google</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Apple Sign In - SOU NOUVO SUPABASE */}
        {Platform.OS === 'ios' && (
          <TouchableOpacity
            style={styles.appleButton}
            onPress={handleAppleSignIn}
            disabled={appleLoading}
            accessibilityLabel="Sign in with Apple"
            accessibilityRole="button"
          >
            {appleLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="logo-apple" size={20} color="#FFFFFF" />
                <Text style={styles.appleButtonText}>Sign in with Apple</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.oauthButton}
          onPress={handlePhoneLogin}
          disabled={operationLoading}
          accessibilityLabel="Continue with phone"
          accessibilityRole="button"
        >
          <Ionicons name="call" size={20} color={colors.text} />
          <Text style={styles.oauthButtonText}>Continue with phone</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.oauthButton, { marginTop: 4 }]}
          onPress={() => setGuestModalVisible(true)}
          accessibilityLabel="Continue as guest"
          accessibilityRole="button"
        >
          <Ionicons name="person-outline" size={20} color={colors.text} />
          <Text style={styles.oauthButtonText}>Continue as guest</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={guestModalVisible} transparent animationType="fade" onRequestClose={() => setGuestModalVisible(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setGuestModalVisible(false)} />
          <View style={guestStyles.sheet}>
            <View style={guestStyles.handle} />
            <View style={guestStyles.iconWrap}>
              <Ionicons name="person-outline" size={32} color="#FFF" />
            </View>
            <Text style={guestStyles.title}>Continue as Guest</Text>
            <Text style={guestStyles.body}>
              {'You can chat with AI without creating an account. Guest sessions are limited to 35 messages and do not save history.'}
            </Text>
            <View style={guestStyles.featureList}>
              {[
                { icon: 'checkmark-circle', text: '35 free messages', ok: true },
                { icon: 'close-circle', text: 'No chat history saved', ok: false },
                { icon: 'close-circle', text: 'No file uploads', ok: false },
                { icon: 'checkmark-circle', text: 'Basic AI responses', ok: true },
              ].map((f, i) => (
                <View key={i} style={guestStyles.featureRow}>
                  <Ionicons name={f.icon as any} size={18} color={f.ok ? '#34C759' : '#FF453A'} />
                  <Text style={guestStyles.featureText}>{f.text}</Text>
                </View>
              ))}
            </View>
            <TouchableOpacity style={guestStyles.primaryBtn} onPress={() => { setGuestModalVisible(false); handleGuestMode(); }}>
              <Text style={guestStyles.primaryBtnText}>Start as Guest</Text>
            </TouchableOpacity>
            <TouchableOpacity style={guestStyles.secondaryBtn} onPress={() => setGuestModalVisible(false)}>
              <Text style={guestStyles.secondaryBtnText}>Create Account Instead</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const guestStyles = StyleSheet.create({
  sheet: { backgroundColor: '#1C1C1E', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 28, paddingBottom: 40 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)', alignSelf: 'center', marginBottom: 24 },
  iconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 16 },
  title: { color: '#FFF', fontSize: 22, fontWeight: '700', textAlign: 'center', marginBottom: 10 },
  body: { color: 'rgba(255,255,255,0.55)', fontSize: 14, textAlign: 'center', lineHeight: 21, marginBottom: 20 },
  featureList: { gap: 10, marginBottom: 24 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  featureText: { color: 'rgba(255,255,255,0.8)', fontSize: 15 },
  primaryBtn: { backgroundColor: '#FFFFFF', borderRadius: 50, paddingVertical: 16, alignItems: 'center', marginBottom: 12 },
  primaryBtnText: { color: '#000000', fontSize: 17, fontWeight: '700' },
  secondaryBtn: { alignItems: 'center', paddingVertical: 10 },
  secondaryBtnText: { color: 'rgba(255,255,255,0.45)', fontSize: 15 },
});
