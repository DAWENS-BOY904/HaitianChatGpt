import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Platform,
} from 'react-native';
import { useAuth, useAlert, getSupabaseClient } from '@/template';
import { useTheme } from '../hooks/useTheme';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ── MEME SUPABASE KONFIGIRASYON KI NAN LoginScreen ──
const MY_SUPABASE_URL = 'https://uzxmmddivzqjhcnnrkns.supabase.co';
const MY_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6eG1tZGRpdnpxamhjbm5ya25zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MTY5MjEsImV4cCI6MjA5MTk5MjkyMX0.6PYtbRps9YJjvX5ibxGy346uA82RadEEpFrhSHa1UIE';

import { createClient } from '@supabase/supabase-js';
const phoneSupabase = createClient(MY_SUPABASE_URL, MY_SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
});

export default function VerifyCodeScreen() {
  const { colors } = useTheme();
  const { verifyOTPAndLogin, sendOTP, operationLoading } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const {
    email,
    password,
    mode,
    phone,
    formattedPhone,
  } = useLocalSearchParams<{
    email: string;
    password: string;
    mode: string;
    phone: string;
    formattedPhone: string;
  }>();

  const isAdminLogin = mode === 'admin_login';
  const isPhoneMode = mode === 'phone_login' || !!phone;

  const [code, setCode] = useState(['', '', '', '', '', '']);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  const [resendCount, setResendCount] = useState(0);
  const [cooldown, setCooldown] = useState(isPhoneMode ? 60 : 0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [resendLoading, setResendLoading] = useState(false);

  const startCooldown = useCallback((seconds: number) => {
    setCooldown(seconds);
    cooldownRef.current && clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setCooldown(prev => {
        if (prev <= 1) {
          cooldownRef.current && clearInterval(cooldownRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    if (isPhoneMode) startCooldown(60);
    setTimeout(() => inputRefs.current[0]?.focus(), 100);
    return () => { cooldownRef.current && clearInterval(cooldownRef.current!); };
  }, [isPhoneMode, startCooldown]);

  const handleCodeChange = (index: number, value: string) => {
    if (value && !/^\d+$/.test(value)) return;
    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
    if (index === 5 && value) handleVerify(newCode.join(''));
  };

  const handleKeyPress = (index: number, key: string) => {
    if (key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (codeValue?: string) => {
    const otp = codeValue || code.join('');
    if (otp.length !== 6) {
      showAlert('Error', 'Please enter the 6-digit code');
      return;
    }

    // ── PHONE OTP VERIFY AK MEME SUPABASE ──
    if (isPhoneMode) {
      try {
        const { error, data } = await phoneSupabase.auth.verifyOtp({
          phone: phone!,
          token: otp,
          type: 'sms',
        });
        if (error) {
          showAlert('Error', error.message);
          setCode(['', '', '', '', '', '']);
          inputRefs.current[0]?.focus();
        } else if (data?.user) {
          setTimeout(() => router.replace('/'), 100);
        }
      } catch (err: any) {
        showAlert('Error', err?.message || 'Verification failed');
        setCode(['', '', '', '', '', '']);
      }
      return;
    }

    // Email OTP (pa chanje)
    if (isAdminLogin) {
      const { error: otpError, user: otpUser } = await verifyOTPAndLogin(email, otp);
      if (otpError) {
        showAlert('Error', otpError);
        setCode(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      } else if (otpUser) {
        setTimeout(() => router.replace('/'), 100);
      }
      return;
    }

    const { error } = await verifyOTPAndLogin(email, otp, { password });
    if (error) {
      showAlert('Error', error);
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || resendLoading) return;
    setResendLoading(true);
    try {
      if (isPhoneMode) {
        // ── RESEND PHONE OTP AK MEME SUPABASE ──
        const { error } = await phoneSupabase.auth.signInWithOtp({ phone: phone! });
        if (error) throw error;
        showAlert('Code Sent', `Verification code resent to ${formattedPhone || phone}.`);
      } else {
        const { error } = await sendOTP(email);
        if (error) throw new Error(error);
        showAlert('Code Sent', 'Verification code sent to your email.');
      }
      setResendCount(c => c + 1);
      startCooldown(60);
    } catch (e: any) {
      showAlert('Error', e?.message || 'Failed to resend code.');
    } finally {
      setResendLoading(false);
    }
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    closeButton: {
      position: 'absolute',
      top: Platform.select({ ios: insets.top + 16, android: insets.top + 16, default: 16 }),
      right: 20,
    },
    content: {
      flex: 1, paddingHorizontal: Spacing.xl,
      paddingTop: Platform.select({ ios: insets.top + 80, android: insets.top + 80, default: 80 }),
    },
    icon: {
      width: 64, height: 64, borderRadius: 32,
      backgroundColor: colors.text, alignItems: 'center', justifyContent: 'center',
      alignSelf: 'center', marginBottom: Spacing.xl,
    },
    iconSymbol: { fontSize: 32, fontWeight: '700', color: colors.background },
    title: {
      fontSize: 28, fontWeight: '700', color: colors.text,
      marginBottom: Spacing.md, textAlign: 'center',
    },
    subtitle: {
      ...Typography.body, color: colors.textSecondary,
      textAlign: 'center', marginBottom: Spacing.xxl, lineHeight: 22,
    },
    highlight: { color: colors.text, fontWeight: '600' },
    codeInputContainer: {
      flexDirection: 'row', justifyContent: 'center',
      gap: Spacing.sm, marginBottom: Spacing.xl,
    },
    codeInput: {
      width: 50, height: 56, backgroundColor: colors.surface,
      borderRadius: BorderRadius.lg, borderWidth: 2, borderColor: colors.border,
      textAlign: 'center', fontSize: 24, fontWeight: '600', color: colors.text,
    },
    codeInputFocused: { borderColor: colors.text },
    continueButton: {
      backgroundColor: colors.text, borderRadius: BorderRadius.full,
      padding: Spacing.md, alignItems: 'center', marginBottom: Spacing.md,
    },
    continueButtonDisabled: { opacity: 0.3 },
    continueButtonText: {
      ...Typography.body, color: colors.background, fontWeight: '600', fontSize: 16,
    },
    resendButton: { alignItems: 'center', padding: Spacing.sm },
    resendButtonText: { ...Typography.body, color: colors.text, fontWeight: '600' },
    phoneHint: {
      ...Typography.caption, color: colors.textSecondary,
      textAlign: 'center', marginTop: Spacing.md, lineHeight: 18,
    },
    footer: {
      position: 'absolute',
      bottom: Platform.select({ ios: insets.bottom + Spacing.lg, android: Spacing.lg, default: Spacing.lg }),
      left: Spacing.xl, right: Spacing.xl,
      flexDirection: 'row', justifyContent: 'center', gap: Spacing.md,
    },
    footerLink: { ...Typography.caption, color: colors.textSecondary },
  });

  const isCodeComplete = code.every(d => d !== '');

  return (
    <View style={styles.container}>
      <StatusBar barStyle={colors.text === '#FFFFFF' ? 'light-content' : 'dark-content'} />

      <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
        <Ionicons name="close" size={28} color={colors.text} />
      </TouchableOpacity>

      <View style={styles.content}>
        <View style={styles.icon}>
          <Text style={styles.iconSymbol}>{isPhoneMode ? '📱' : '✦'}</Text>
        </View>

        <Text style={styles.title}>
          {isPhoneMode ? 'Check your messages' : 'Check your inbox'}
        </Text>
        <Text style={styles.subtitle}>
          {isPhoneMode
            ? 'Enter the 6-digit code we sent to '
            : 'Enter the verification code we just sent to '}
          <Text style={styles.highlight}>
            {isPhoneMode ? (formattedPhone || phone) : email}
          </Text>
          {'.'}
        </Text>

        <View style={styles.codeInputContainer}>
          {code.map((digit, index) => (
            <TextInput
              key={index}
              ref={ref => { inputRefs.current[index] = ref; }}
              style={[styles.codeInput, digit && styles.codeInputFocused]}
              value={digit}
              onChangeText={value => handleCodeChange(index, value)}
              onKeyPress={({ nativeEvent: { key } }) => handleKeyPress(index, key)}
              keyboardType="number-pad"
              maxLength={1}
              editable={!operationLoading}
            />
          ))}
        </View>

        <TouchableOpacity
          style={[styles.continueButton, !isCodeComplete && styles.continueButtonDisabled]}
          onPress={() => handleVerify()}
          disabled={!isCodeComplete || operationLoading}
        >
          <Text style={styles.continueButtonText}>
            {operationLoading ? 'Verifying...' : 'Continue'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.resendButton, (cooldown > 0 || resendLoading) && { opacity: 0.4 }]}
          onPress={handleResend}
          disabled={operationLoading || cooldown > 0 || resendLoading}
        >
          <Text style={styles.resendButtonText}>
            {resendLoading
              ? 'Sending...'
              : cooldown > 0
              ? `Resend code in ${cooldown}s`
              : isPhoneMode ? 'Resend SMS' : 'Resend email'}
          </Text>
        </TouchableOpacity>

        {isPhoneMode && (
          <Text style={styles.phoneHint}>
            {"Didn't receive it? Check that your number is correct or try a different method."}
          </Text>
        )}
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerLink}>Terms of Use</Text>
        <Text style={styles.footerLink}>•</Text>
        <Text style={styles.footerLink}>Privacy Policy</Text>
      </View>
    </View>
  );
}
