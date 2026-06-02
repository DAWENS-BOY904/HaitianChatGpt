
import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { useAuth, useAlert, getSupabaseClient } from '@/template';
import { useTheme } from '../hooks/useTheme';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { signInWithGoogleCrossPlatform } from '../utils/google-auth';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';

// ── AI Logo ──
const AI_LOGO_URL = 'https://uzxmmddivzqjhcnnrkns.supabase.co/storage/v1/object/public/logo/logo.png';

// ── NOUVO SUPABASE POU APPLE LOGIN AK PHONE LOGIN ──
const MY_SUPABASE_URL = 'https://uzxmmddivzqjhcnnrkns.supabase.co';
const MY_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6eG1tZGRpdnpxamhjbm5ya25zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MTY5MjEsImV4cCI6MjA5MTk5MjkyMX0.6PYtbRps9YJjvX5ibxGy346uA82RadEEpFrhSHa1UIE';

const appleSupabase = createClient(MY_SUPABASE_URL, MY_SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

const APPLE_NAME_CACHE_KEY = 'apple_signin_name_cache';

// ── COUNTRY LIST (30 peyi) ──
interface Country {
  name: string;
  code: string;
  flag: string;
  dialCode: string;
}

const COUNTRIES: Country[] = [
  { name: 'United States', code: 'US', flag: '🇺🇸', dialCode: '+1' },
  { name: 'United Kingdom', code: 'GB', flag: '🇬🇧', dialCode: '+44' },
  { name: 'Canada', code: 'CA', flag: '🇨🇦', dialCode: '+1' },
  { name: 'France', code: 'FR', flag: '🇫🇷', dialCode: '+33' },
  { name: 'Germany', code: 'DE', flag: '🇩🇪', dialCode: '+49' },
  { name: 'Haiti', code: 'HT', flag: '🇭🇹', dialCode: '+509' },
  { name: 'Jamaica', code: 'JM', flag: '🇯🇲', dialCode: '+1' },
  { name: 'Mexico', code: 'MX', flag: '🇲🇽', dialCode: '+52' },
  { name: 'Brazil', code: 'BR', flag: '🇧🇷', dialCode: '+55' },
  { name: 'India', code: 'IN', flag: '🇮🇳', dialCode: '+91' },
  { name: 'Italy', code: 'IT', flag: '🇮🇹', dialCode: '+39' },
  { name: 'Spain', code: 'ES', flag: '🇪🇸', dialCode: '+34' },
  { name: 'Portugal', code: 'PT', flag: '🇵🇹', dialCode: '+351' },
  { name: 'Netherlands', code: 'NL', flag: '🇳🇱', dialCode: '+31' },
  { name: 'Belgium', code: 'BE', flag: '🇧🇪', dialCode: '+32' },
  { name: 'Switzerland', code: 'CH', flag: '🇨🇭', dialCode: '+41' },
  { name: 'Sweden', code: 'SE', flag: '🇸🇪', dialCode: '+46' },
  { name: 'Norway', code: 'NO', flag: '🇳🇴', dialCode: '+47' },
  { name: 'Denmark', code: 'DK', flag: '🇩🇰', dialCode: '+45' },
  { name: 'Finland', code: 'FI', flag: '🇫🇮', dialCode: '+358' },
  { name: 'Nigeria', code: 'NG', flag: '🇳🇬', dialCode: '+234' },
  { name: 'South Africa', code: 'ZA', flag: '🇿🇦', dialCode: '+27' },
  { name: 'Kenya', code: 'KE', flag: '🇰🇪', dialCode: '+254' },
  { name: 'Ghana', code: 'GH', flag: '🇬🇭', dialCode: '+233' },
  { name: 'Egypt', code: 'EG', flag: '🇪🇬', dialCode: '+20' },
  { name: 'China', code: 'CN', flag: '🇨🇳', dialCode: '+86' },
  { name: 'Japan', code: 'JP', flag: '🇯🇵', dialCode: '+81' },
  { name: 'South Korea', code: 'KR', flag: '🇰🇷', dialCode: '+82' },
  { name: 'Philippines', code: 'PH', flag: '🇵🇭', dialCode: '+63' },
];

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

export default function LoginScreen() {
  const { colors, isDark } = useTheme();
  const { signInWithPassword, signInWithGoogle, operationLoading, user } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [email, setEmail] = useState('');
  const [showPasskeyPrompt, setShowPasskeyPrompt] = useState(false);
  const [passkeyBiometricLabel, setPasskeyBiometricLabel] = useState('Biometrics');
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [guestModalVisible, setGuestModalVisible] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);
  
  // ── PHONE STATE ──
  const [isPhoneMode, setIsPhoneMode] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<Country>(COUNTRIES[0]);
  const [showCountryList, setShowCountryList] = useState(false);
  const [phoneLoading, setPhoneLoading] = useState(false);
  const isMounted = useRef(true);

  useEffect(() => {
    return () => { isMounted.current = false; };
  }, []);

  // Check Apple Sign In availability
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    AppleAuthentication.isAvailableAsync()
      .then(setAppleAvailable)
      .catch(() => setAppleAvailable(false));
  }, []);

  const safeSetState = useCallback(<T,>(setter: React.Dispatch<React.SetStateAction<T>>, value: T) => {
    if (isMounted.current) setter(value);
  }, []);

  useEffect(() => {
    checkForPasskeyLogin();
  }, []);

  useEffect(() => {
    if (user) {
      router.replace('/');
    }
  }, [user]);

  const checkForPasskeyLogin = async () => {
    if (Platform.OS === 'web') return;
    try {
      const supabase = getSupabaseClient();
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

      safeSetState(setPasskeyBiometricLabel, label);
      safeSetState(setShowPasskeyPrompt, true);
    } catch (err) {
      console.log('Passkey check error:', err);
    }
  };

  const handlePasskeyAuthenticate = async () => {
    safeSetState(setPasskeyLoading, true);
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
        safeSetState(setShowPasskeyPrompt, false);
      }
    } catch {
      safeSetState(setShowPasskeyPrompt, false);
    } finally {
      safeSetState(setPasskeyLoading, false);
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
      safeSetState(setAdminCodeSending, true);
      try {
        const supabase = getSupabaseClient();
        const { error: otpError } = await supabase.auth.signInWithOtp({
          email: email.toLowerCase(),
          options: { shouldCreateUser: false },
        });
        if (otpError) throw new Error(otpError.message);
      } catch (e: any) {
        showAlert('Error', e?.message || 'Failed to send admin code.');
        safeSetState(setAdminCodeSending, false);
        return;
      } finally {
        safeSetState(setAdminCodeSending, false);
      }
      router.push({ pathname: '/verify-code', params: { email: email.toLowerCase(), mode: 'admin_login' } });
    } else {
      router.push({ pathname: '/login-password', params: { email } });
    }
  };

  const handlePhoneContinue = async () => {
    if (!phoneNumber.trim()) {
      showAlert('Error', 'Please enter your phone number');
      return;
    }
    
    const digits = phoneNumber.replace(/\D/g, '');
    if (digits.length < 6) {
      showAlert('Error', 'Please enter a valid phone number');
      return;
    }

    setPhoneLoading(true);
    try {
      const fullPhone = `${selectedCountry.dialCode}${digits}`;
      
      const { error: otpError } = await appleSupabase.auth.signInWithOtp({ 
        phone: fullPhone 
      });

      if (otpError) throw otpError;

      router.push({
        pathname: '/verify-code',
        params: {
          phone: fullPhone,
          formattedPhone: `${selectedCountry.flag} ${selectedCountry.dialCode} ${formatPhoneDisplay(digits)}`,
          mode: 'phone_login',
        },
      });
    } catch (err: any) {
      showAlert('Error', err?.message || 'Failed to send verification code.');
    } finally {
      setPhoneLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (googleLoading || appleLoading || operationLoading) return;
    safeSetState(setGoogleLoading, true);
    try {
      const { error } = await signInWithGoogleCrossPlatform();
      if (error) {
        const lower = (error || '').toLowerCase();
        const isCancellation = lower.includes('cancel') || lower.includes('dismiss') || lower.includes('closed');
        if (!isCancellation) showAlert('Error', error);
      }
    } catch (err: any) {
      const msg = (err?.message || '').toLowerCase();
      const isCancellation = msg.includes('cancel') || msg.includes('dismiss') || msg.includes('closed');
      if (!isCancellation) showAlert('Error', err?.message || 'Google sign-in failed.');
    } finally {
      safeSetState(setGoogleLoading, false);
    }
  };

  const handleGuestMode = () => {
    router.replace('/home');
  };

  const togglePhoneMode = () => {
    setIsPhoneMode(!isPhoneMode);
    setEmail('');
    setPhoneNumber('');
    setShowSuggestions(false);
    setShowCountryList(false);
  };

  const selectCountry = (country: Country) => {
    setSelectedCountry(country);
    setShowCountryList(false);
  };

  const handlePhoneChange = (text: string) => {
    const digits = text.replace(/\D/g, '');
    setPhoneNumber(digits);
  };

  const formatPhoneDisplay = (raw: string): string => {
    const digits = raw.replace(/\D/g, '');
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
    if (digits.length <= 10) return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 10)} ${digits.slice(10)}`;
  };

  // ── APPLE SIGN IN (Production-Ready with Native Button) ──
  const handleAppleSignIn = async () => {
    if (Platform.OS !== 'ios') {
      showAlert('Not Available', 'Apple Sign In is only available on iOS devices.');
      return;
    }
    if (appleLoading || googleLoading || operationLoading) return;
    setAppleLoading(true);
    try {
      const isAvailable = await AppleAuthentication.isAvailableAsync();
      if (!isAvailable) {
        showAlert('Not Available', 'Apple Sign In is not available on this device.');
        return;
      }

      // Generate secure nonce
      const rawNonce = Array.from({ length: 32 }, () =>
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[
          Math.floor(Math.random() * 62)
        ]
      ).join('');

      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        rawNonce
      );

      // Generate state for CSRF protection
      const state = Array.from({ length: 16 }, () =>
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[
          Math.floor(Math.random() * 62)
        ]
      ).join('');

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
        state,
      });

      if (credential.state && credential.state !== state) {
        showAlert('Security Error', 'Invalid authentication state. Please try again.');
        return;
      }

      const { identityToken } = credential;
      if (!identityToken) {
        showAlert('Sign In Failed', 'No identity token returned from Apple.');
        return;
      }

      const { data, error } = await appleSupabase.auth.signInWithIdToken({
        provider: 'apple',
        token: identityToken,
        nonce: rawNonce,
      });

      if (error) {
        showAlert('Sign In Failed', error.message || 'Apple Sign In failed.');
        return;
      }

      // Cache name for future logins
      const fullName = [
        credential.fullName?.givenName,
        credential.fullName?.familyName,
      ].filter(Boolean).join(' ');

      if (fullName) {
        await AsyncStorage.setItem(`${APPLE_NAME_CACHE_KEY}_${credential.user}`, fullName);
      }

      // Update user metadata
      if (credential.fullName || credential.email) {
        const updates: any = {};
        if (fullName) {
          updates.data = {
            ...(updates.data || {}),
            full_name: fullName,
            given_name: credential.fullName?.givenName,
            family_name: credential.fullName?.familyName,
          };
        }
        if (Object.keys(updates).length > 0) {
          await appleSupabase.auth.updateUser(updates);
        }
      }

      if (data?.session) {
        const supabase = getSupabaseClient();
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
        // Persist & validate tokens so app restarts stay logged in
        try { await supabase.auth.refreshSession(); } catch (_) {}
        if (data.session.user) {
          sendLoginConfirmationEmail(data.session.user.id, data.session.user.email || '');
        }
        router.replace('/home');
      }
    } catch (e: any) {
      if (e?.code === 'ERR_REQUEST_CANCELED') {
        return;
      }
      const msg = (e?.message || '').toLowerCase();
      const isCancellation = msg.includes('cancel') || msg.includes('dismiss') || msg.includes('closed');
      if (!isCancellation) {
        showAlert('Sign In Error', e?.message || 'Apple Sign In failed.');
      }
    } finally {
      setAppleLoading(false);
    }
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    closeButton: {
      position: 'absolute',
      top: Platform.select({ ios: insets.top + 16, android: insets.top + 16, default: 16 }),
      right: 20, width: 40, height: 40, borderRadius: 20,
      backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center',
      zIndex: 10, borderWidth: 1, borderColor: colors.border,
    },
    content: {
      flex: 1, paddingHorizontal: Spacing.xl,
      paddingTop: Platform.select({ ios: insets.top + 80, android: insets.top + 80, default: 80 }),
    },
    title: { fontSize: 34, fontWeight: '700', color: colors.text, marginBottom: Spacing.xl, textAlign: 'center' },
    description: {
      ...Typography.body, color: colors.textSecondary,
      textAlign: 'center', marginBottom: Spacing.xxl, lineHeight: 22,
    },
    inputContainer: {
      backgroundColor: colors.surface, borderRadius: BorderRadius.lg,
      paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
      marginBottom: Spacing.md, borderWidth: 1, borderColor: colors.border,
    },
    inputLabel: { ...Typography.caption, color: colors.textSecondary, fontSize: 12, marginBottom: 4 },
    input: { ...Typography.body, color: colors.text, fontSize: 16, padding: 0 },
    countrySelector: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: colors.surface, borderRadius: BorderRadius.lg,
      paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
      marginBottom: Spacing.sm, borderWidth: 1, borderColor: colors.border,
    },
    countrySelectorLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    countryFlag: { fontSize: 20 },
    countryName: { ...Typography.body, color: colors.text, fontSize: 16 },
    countryDialCode: { ...Typography.body, color: colors.textSecondary, fontSize: 14 },
    phoneInputContainer: {
      backgroundColor: colors.surface, borderRadius: BorderRadius.lg,
      paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
      marginBottom: Spacing.md, borderWidth: 1, borderColor: colors.border,
    },
    phoneInputLabel: { ...Typography.caption, color: colors.textSecondary, fontSize: 12, marginBottom: 4 },
    phoneInput: { ...Typography.body, color: colors.text, fontSize: 16, padding: 0 },
    countryListContainer: {
      backgroundColor: colors.surface, borderRadius: BorderRadius.lg,
      marginTop: 6, marginBottom: Spacing.md,
      borderWidth: 1, borderColor: colors.border, maxHeight: 250,
    },
    countryItem: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      padding: 12, borderBottomWidth: 1, borderColor: colors.border,
    },
    countryItemLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    countryItemText: { ...Typography.body, color: colors.text, fontSize: 15 },
    countryItemDial: { ...Typography.body, color: colors.textSecondary, fontSize: 14 },
    continueButton: {
      backgroundColor: colors.text, borderRadius: BorderRadius.full,
      padding: Spacing.md, alignItems: 'center', marginBottom: Spacing.md,
    },
    continueButtonDisabled: { opacity: 0.3 },
    continueButtonText: { ...Typography.body, color: colors.background, fontWeight: '600', fontSize: 16 },
    divider: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.xl },
    dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
    dividerText: { ...Typography.body, color: colors.textSecondary, paddingHorizontal: Spacing.md },
    appleButtonContainer: {
      width: '100%',
      height: 50,
      marginBottom: Spacing.md,
      borderRadius: BorderRadius.full,
      overflow: 'hidden',
    },
    oauthButton: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      backgroundColor: colors.surface, borderRadius: BorderRadius.full,
      padding: Spacing.md, marginBottom: Spacing.md,
      borderWidth: 1.5, borderColor: colors.border, gap: Spacing.sm,
      opacity: operationLoading ? 0.7 : 1,
    },
    oauthButtonText: { ...Typography.body, color: colors.text, fontSize: 16, fontWeight: '500' },
  });

  const pkStyles = StyleSheet.create({
    overlay: {
      ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.92)',
      justifyContent: 'center', alignItems: 'center', zIndex: 999, paddingHorizontal: 32,
    },
    card: { width: '100%', alignItems: 'center', paddingVertical: 48 },
    iconWrap: {
      width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.1)',
      alignItems: 'center', justifyContent: 'center', marginBottom: 28,
      borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    },
    title: { fontSize: 26, fontWeight: '700', color: '#FFFFFF', marginBottom: 10, textAlign: 'center' },
    subtitle: { fontSize: 15, color: 'rgba(255,255,255,0.55)', textAlign: 'center', lineHeight: 22, marginBottom: 48 },
    primaryBtn: { width: '100%', backgroundColor: '#FFFFFF', borderRadius: 50, paddingVertical: 16, alignItems: 'center', marginBottom: 14 },
    primaryBtnText: { fontSize: 17, fontWeight: '700', color: '#000000' },
    secondaryBtn: { paddingVertical: 12, paddingHorizontal: 24 },
    secondaryBtnText: { fontSize: 16, color: 'rgba(255,255,255,0.5)', fontWeight: '500' },
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle={colors.text === '#FFFFFF' ? 'light-content' : 'dark-content'} />

      {showPasskeyPrompt && (
        <View style={pkStyles.overlay}>
          <View style={pkStyles.card}>
            <View style={pkStyles.iconWrap}>
              <Ionicons name={passkeyBiometricLabel === 'Face ID' ? 'scan-outline' : 'finger-print-outline'} size={52} color="#FFFFFF" />
            </View>
            <Text style={pkStyles.title}>Sign in faster</Text>
            <Text style={pkStyles.subtitle}>Use {passkeyBiometricLabel} to sign in to your account</Text>
            <TouchableOpacity style={pkStyles.primaryBtn} onPress={handlePasskeyAuthenticate} disabled={passkeyLoading}>
              {passkeyLoading ? <ActivityIndicator color="#000" /> : <Text style={pkStyles.primaryBtnText}>Sign in with {passkeyBiometricLabel}</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={pkStyles.secondaryBtn} onPress={() => setShowPasskeyPrompt(false)}>
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
        <Text style={styles.description}>You will get smarter responses and can upload files, images and more.</Text>

        {/* PHONE INPUT OR EMAIL INPUT */}
        {isPhoneMode ? (
          <>
            <TouchableOpacity style={styles.countrySelector} onPress={() => setShowCountryList(!showCountryList)} activeOpacity={0.7}>
              <View style={styles.countrySelectorLeft}>
                <Text style={styles.countryFlag}>{selectedCountry.flag}</Text>
                <Text style={styles.countryName}>{selectedCountry.name}</Text>
                <Text style={styles.countryDialCode}>({selectedCountry.dialCode})</Text>
              </View>
              <Ionicons name={showCountryList ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textSecondary} />
            </TouchableOpacity>

            {showCountryList && (
              <View style={styles.countryListContainer}>
                <ScrollView showsVerticalScrollIndicator={false}>
                  {COUNTRIES.map((country, index) => (
                    <TouchableOpacity
                      key={country.code}
                      style={[styles.countryItem, index === COUNTRIES.length - 1 && { borderBottomWidth: 0 }]}
                      onPress={() => selectCountry(country)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.countryItemLeft}>
                        <Text style={styles.countryFlag}>{country.flag}</Text>
                        <Text style={styles.countryItemText}>{country.name}</Text>
                      </View>
                      <Text style={styles.countryItemDial}>{country.dialCode}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            <View style={styles.phoneInputContainer}>
              <Text style={styles.phoneInputLabel}>Phone number</Text>
              <TextInput
                style={styles.phoneInput}
                placeholder={`${selectedCountry.dialCode} (305) 896-2443`}
                placeholderTextColor={colors.textSecondary}
                value={formatPhoneDisplay(phoneNumber)}
                onChangeText={handlePhoneChange}
                keyboardType="phone-pad"
                editable={!operationLoading && !phoneLoading}
                accessibilityLabel="Phone number"
              />
            </View>
          </>
        ) : (
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="" placeholderTextColor={colors.textSecondary}
              value={email} onChangeText={handleEmailChange}
              autoCapitalize="none" keyboardType="email-address"
              editable={!operationLoading} accessibilityLabel="Email address"
            />
          </View>
        )}

        {/* EMAIL SUGGESTIONS */}
        {!isPhoneMode && showSuggestions && (
          <View style={{ backgroundColor: colors.surface, borderRadius: 10, marginTop: 6, borderWidth: 1, borderColor: colors.border }}>
            {suggestions.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={{ padding: 12, borderBottomWidth: index !== suggestions.length - 1 ? 1 : 0, borderColor: colors.border }}
                onPress={() => { setEmail(item); setShowSuggestions(false); }}
              >
                <Text style={{ color: colors.text }}>{item}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* CONTINUE BUTTON */}
        <TouchableOpacity
          style={[styles.continueButton, (isPhoneMode ? !phoneNumber.trim() : !email.trim()) && styles.continueButtonDisabled]}
          onPress={isPhoneMode ? handlePhoneContinue : handleEmailContinue}
          disabled={(isPhoneMode ? !phoneNumber.trim() : !email.trim()) || operationLoading || adminCodeSending || phoneLoading}
        >
          {adminCodeSending || phoneLoading ? (
            <ActivityIndicator size="small" color={colors.background} />
          ) : (
            <Text style={styles.continueButtonText}>{operationLoading ? 'Processing...' : 'Continue'}</Text>
          )}
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OR</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Google */}
        <TouchableOpacity style={[styles.oauthButton, { opacity: googleLoading ? 0.7 : 1 }]} onPress={handleGoogleSignIn} disabled={googleLoading || operationLoading}>
          {googleLoading ? <ActivityIndicator size="small" color={colors.text} /> : (
            <><Ionicons name="logo-google" size={20} color={colors.text} /><Text style={styles.oauthButtonText}>Continue with Google</Text></>
          )}
        </TouchableOpacity>

        {/* Apple — Native Apple Button */}
        {Platform.OS === 'ios' && appleAvailable && (
          <View style={styles.appleButtonContainer}>
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={isDark ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={25}
              style={{ width: '100%', height: 50 }}
              onPress={handleAppleSignIn}
            />
          </View>
        )}

        {/* Toggle Phone/Email */}
        <TouchableOpacity style={styles.oauthButton} onPress={togglePhoneMode} disabled={operationLoading || phoneLoading}>
          <Ionicons name={isPhoneMode ? "mail-outline" : "call"} size={20} color={colors.text} />
          <Text style={styles.oauthButtonText}>{isPhoneMode ? 'Continue with email' : 'Continue with phone'}</Text>
        </TouchableOpacity>

        {/* Guest */}
        <TouchableOpacity style={[styles.oauthButton, { marginTop: 4 }]} onPress={() => setGuestModalVisible(true)}>
          <Ionicons name="person-outline" size={20} color={colors.text} />
          <Text style={styles.oauthButtonText}>Continue as guest</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={guestModalVisible} transparent animationType="slide" onRequestClose={() => setGuestModalVisible(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <TouchableOpacity 
            style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.4)' }]} 
            activeOpacity={1} 
            onPress={() => setGuestModalVisible(false)} 
          />

          <View style={{ borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' }}>
            {Platform.OS === 'ios' ? (
              <BlurView intensity={80} tint={isDark ? 'dark' : 'light'} style={{ width: '100%' }} experimentalBlurMethod="dimezisBlurView">
                <GuestModalContent 
                  onStartGuest={() => { setGuestModalVisible(false); handleGuestMode(); }}
                  onClose={() => setGuestModalVisible(false)}
                  isDark={isDark}
                />
              </BlurView>
            ) : (
              <View style={{ width: '100%', backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF' }}>
                <GuestModalContent 
                  onStartGuest={() => { setGuestModalVisible(false); handleGuestMode(); }}
                  onClose={() => setGuestModalVisible(false)}
                  isDark={isDark}
                />
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function GuestModalContent({ onStartGuest, onClose, isDark }: { onStartGuest: () => void; onClose: () => void; isDark: boolean }) {
  const bg = isDark ? '#1C1C1E' : '#FFFFFF';
  const text = isDark ? '#FFFFFF' : '#000000';
  const textSecondary = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)';
  const textTertiary = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)';
  const iconBg = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)';
  const handleColor = isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)';
  const btnBg = isDark ? '#FFFFFF' : '#000000';
  const btnText = isDark ? '#000000' : '#FFFFFF';

  return (
    <View style={{ padding: 28, paddingBottom: 40 }}>
      <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: handleColor, alignSelf: 'center', marginBottom: 24 }} />
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: iconBg, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 16 }}>
        <Ionicons name="person-outline" size={32} color={text} />
      </View>
      <Text style={{ color: text, fontSize: 22, fontWeight: '700', textAlign: 'center', marginBottom: 10 }}>Continue as Guest</Text>
      <Text style={{ color: textSecondary, fontSize: 14, textAlign: 'center', lineHeight: 21, marginBottom: 20 }}>
        {'You can chat with AI without creating an account. Guest sessions are limited to 35 messages and do not save history.'}
      </Text>
      <View style={{ gap: 10, marginBottom: 24 }}>
        {[{ icon: 'checkmark-circle', text: '35 free messages', ok: true }, { icon: 'close-circle', text: 'No chat history saved', ok: false }, { icon: 'close-circle', text: 'No file uploads', ok: false }, { icon: 'checkmark-circle', text: 'Basic AI responses', ok: true }].map((f, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Ionicons name={f.icon as any} size={18} color={f.ok ? '#34C759' : '#FF453A'} />
            <Text style={{ color: isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.7)', fontSize: 15 }}>{f.text}</Text>
          </View>
        ))}
      </View>
      <TouchableOpacity 
        style={{ backgroundColor: btnBg, borderRadius: 50, paddingVertical: 16, alignItems: 'center', marginBottom: 12 }}
        onPress={onStartGuest}
      >
        <Text style={{ color: btnText, fontSize: 17, fontWeight: '700' }}>Start as Guest</Text>
      </TouchableOpacity>
      <TouchableOpacity style={{ alignItems: 'center', paddingVertical: 10 }} onPress={onClose}>
        <Text style={{ color: textTertiary, fontSize: 15 }}>Create Account Instead</Text>
      </TouchableOpacity>
    </View>
  );
}

fix image searhc via unplash must be real its return only [image_search tex with no img please fix this.