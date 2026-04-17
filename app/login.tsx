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
  Animated,
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

  // On mount: check for existing passkeys and show biometric prompt card
  useEffect(() => {
    checkForPasskeyLogin();
  }, []);

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
    } catch {
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

  const handleEmailContinue = async () => {
    if (!email.trim()) {
      showAlert('Error', 'Please enter your email address');
      return;
    }
    const adminEmails = ['berryxoe@gmail.com', 'newdawens@gmail.com', 'kontgithub@gmail.com'];
    if (adminEmails.includes(email.toLowerCase())) {
      router.push('/admin-verify');
    } else {
      router.push({ pathname: '/login-password', params: { email } });
    }
  };

  const handleGoogleSignIn = async () => {
    const { error, user } = await signInWithGoogle() as any;
    if (error) {
      showAlert('Error', error);
      return;
    }
    if (user) {
      sendLoginConfirmationEmail(user.id, user.email || email);
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
    try {
      const available = await AppleAuthentication.isAvailableAsync();
      if (!available) {
        showAlert('Not Available', 'Apple Sign In is not available on this device.');
        return;
      }

      // Generate a random nonce
      const generateNonce = (length: number) => {
        const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let nonce = '';
        const randomValues = new Uint8Array(length);
        for (let i = 0; i < length; i++) {
          nonce += charset[Math.floor(Math.random() * charset.length)];
        }
        return nonce;
      };

      const rawNonce = generateNonce(32);

      // SHA256 hash the nonce for Apple
      const digestNonce = async (nonce: string): Promise<string> => {
        const msgBuffer = new TextEncoder().encode(nonce);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      };

      const hashedNonce = await digestNonce(rawNonce);

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });

      if (!credential.identityToken) {
        showAlert('Error', 'Apple Sign In failed: no identity token returned.');
        return;
      }

      const { getSupabaseClient } = await import('@/template');
      const supabase = getSupabaseClient();

      const { error, data } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
        nonce: rawNonce,
      });

      if (error) {
        showAlert('Sign In Failed', error.message);
        return;
      }
      // Send login confirmation email
      if (data?.user) {
        const appleEmail = data.user.email ||
          credential.email ||
          `${credential.user}@privaterelay.appleid.com`;
        sendLoginConfirmationEmail(data.user.id, appleEmail);
      }
      // AuthRouter will handle navigation on success
    } catch (e: any) {
      if (e?.code === 'ERR_REQUEST_CANCELED') return; // user cancelled
      showAlert('Error', e?.message || 'Apple Sign In failed');
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
          disabled={!email.trim() || operationLoading}
          accessibilityLabel="Continue with email"
          accessibilityRole="button"
        >
          <Text style={styles.continueButtonText}>
            {operationLoading ? 'Processing...' : 'Continue'}
          </Text>
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
          accessibilityLabel="Continue with Google"
          accessibilityRole="button"
        >
          <Ionicons name="logo-google" size={20} color={colors.text} />
          <Text style={styles.oauthButtonText}>Continue with Google</Text>
        </TouchableOpacity>

        {/* Apple Sign In — iOS only per Apple HIG */}
        {Platform.OS === 'ios' && (
          <TouchableOpacity
            style={styles.appleButton}
            onPress={handleAppleSignIn}
            accessibilityLabel="Sign in with Apple"
            accessibilityRole="button"
          >
            <Ionicons name="logo-apple" size={20} color="#FFFFFF" />
            <Text style={styles.appleButtonText}>Sign in with Apple</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.oauthButton}
          onPress={handlePhoneLogin}
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
