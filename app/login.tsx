import React, { useState, useEffect, useRef } from 'react';
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
  Image,
} from 'react-native';
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

// ── AI Logo ──
const AI_LOGO_URL = 'https://uzxmmddivzqjhcnnrkns.supabase.co/storage/v1/object/public/logo/logo.png';

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
      <Image source={{ uri: AI_LOGO_URL }} style={{ width: size, height: size, borderRadius: size / 2 }} resizeMode="cover" />
    </View>
  );
}

// ── Helper: send login confirmation email ──
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
    // Non-blocking – don't interrupt login flow
    console.warn('Login email send failed:', e);
  }
}

// ── Helper: Generate nonce for Apple Sign In ──
async function generateNonce(length: number = 32): Promise<string> {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const randomBytes = await Crypto.getRandomBytesAsync(length);
  let nonce = '';
  for (let i = 0; i < length; i++) {
    nonce += charset[randomBytes[i] % charset.length];
  }
  return nonce;
}

// ── Helper: SHA256 hash for Apple nonce ──
async function sha256Hash(str: string): Promise<string> {
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    str
  );
  return digest;
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

  // On mount: check for existing passkeys and show biometric prompt card
  useEffect(() => {
    checkForPasskeyLogin();
  }, []);

  // Watch for user changes and navigate when authenticated
  useEffect(() => {
    if (user) {
      router.replace('/home');
    }
  }, [user]);

  const checkForPasskeyLogin = async () => {
    if (Platform.OS === 'web') return;
    try {
      const supabase = getSupabaseClient();

      // Check if logout explicitly cleared the passkey flag
      const cleared = await AsyncStorage.getItem('passkey_session_active');
      // If flag is explicitly 'false', skip prompt
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

      // Biometric hardware check
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
      // silently ignore
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
        // User tapped fallback or failed — dismiss prompt card
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

  const handleEmailContinue = async () => {
    if (!email.trim()) {
      showAlert('Error', 'Please enter your email address');
      return;
    }
    const adminEmails = ['berryxoe@gmail.com', 'newdawens@gmail.com', 'kontgithub@gmail.com'];
    if (adminEmails.includes(email.toLowerCase())) {
      // Auto-send a verification code to the admin email, then go to code entry
      setAdminCodeSending(true);
      try {
        const supabase = getSupabaseClient();
        await supabase.functions.invoke('send-verification-code', {
          body: { email: email.toLowerCase(), type: 'admin_login' },
        });
      } catch (e) {
        console.warn('Admin code send error (non-blocking):', e);
      } finally {
        setAdminCodeSending(false);
      }
      router.push({ pathname: '/verify-code', params: { email: email.toLowerCase(), mode: 'admin_login' } });
    } else {
      router.push({ pathname: '/login-password', params: { email } });
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      const { error, user: googleUser } = await signInWithGoogle() as any;
      if (error) {
        showAlert('Error', error);
        return;
      }
      if (googleUser) {
        await sendLoginConfirmationEmail(googleUser.id, googleUser.email || email);
        // Navigation handled by useEffect watching 'user'
      }
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      showAlert('Error', err?.message || 'Google sign-in failed. Please try again.');
    }
  };

  const handlePhoneLogin = () => {
    router.push('/phone-entry');
  };

  const handleAppleSignIn = async () => {
    if (Platform.OS !== 'ios') {
      showAlert('Not Available', 'Apple Sign In is only available on iOS devices.');
      return;
    }

    setAppleLoading(true);
    
    try {
      const available = await AppleAuthentication.isAvailableAsync();
      if (!available) {
        showAlert('Not Available', 'Apple Sign In is not available on this device. Please update iOS.');
        setAppleLoading(false);
        return;
      }

      // Generate nonce using expo-crypto
      const rawNonce = await generateNonce(32);
      const hashedNonce = await sha256Hash(rawNonce);

      // Request Apple credentials
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });

      if (!credential.identityToken) {
        showAlert('Sign In Error', 'Apple did not return an identity token. Please try again.');
        setAppleLoading(false);
        return;
      }

      // Use the main Supabase client (not a separate one)
      const supabase = getSupabaseClient();

      // Sign in to Supabase with Apple ID token
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
        nonce: rawNonce, // Use raw nonce here
      });

      if (error) {
        console.error('Supabase Apple sign-in error:', error);
        showAlert('Sign In Failed', error.message || 'Failed to authenticate with Apple.');
        setAppleLoading(false);
        return;
      }

      if (data?.user) {
        // Update profile with Apple name if provided
        if (credential.fullName?.givenName || credential.fullName?.familyName) {
          const fullName = [
            credential.fullName.givenName,
            credential.fullName.familyName,
          ].filter(Boolean).join(' ');
          
          try {
            await supabase
              .from('user_profiles')
              .update({ full_name: fullName })
              .eq('id', data.user.id);
          } catch (profileErr) {
            console.log('Profile update error (non-critical):', profileErr);
          }
        }

        const appleEmail = data.user.email || credential.email || `${credential.user}@privaterelay.appleid.com`;
        await sendLoginConfirmationEmail(data.user.id, appleEmail);
        
        // Navigation will be handled by useEffect watching 'user' state
      }
    } catch (e: any) {
      if (e?.code === 'ERR_REQUEST_CANCELED') {
        // User cancelled — no error shown
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
    // Apple-compliant Sign In button - must have visible outline per HIG
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
      // Visible border is required — Apple Guideline 4.0
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

  // ── Passkey prompt card styles (defined outside StyleSheet for readability) ──
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

      {/* ── Passkey full-screen biometric prompt card ── */}
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

        {/* Google Button — must have visible border */}
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

        {/* Apple Sign In — iOS only per Apple HIG */}
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
      </View>
    </View>
  );
}
