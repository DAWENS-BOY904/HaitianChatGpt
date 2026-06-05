
/**
 * verify-code.tsx
 *
 * OTP verification screen.
 * - Sends codes exclusively via the `send-verification-code` edge function (Resend API).
 * - Verifies codes via the `verify-code-check` logic inside the same edge function.
 * - No Supabase OTP paths used.
 * - Shows a 10-minute countdown timer.
 * - Calls `send-welcome-email` after successful new-user registration.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSupabaseClient } from '@/template';
import { useAlert } from '@/template';
import { useTheme } from '@/hooks/useTheme';
import { FunctionsHttpError } from '@supabase/supabase-js';

// ── Types ──────────────────────────────────────────────────────────────────

type VerifyMode =
  | 'registration'
  | 'login'
  | 'password_change'
  | 'email_change'
  | 'account_action';

// ── Constants ──────────────────────────────────────────────────────────────

const CODE_EXPIRY_SECONDS = 600; // 10 minutes
const CODE_LENGTH = 6;

// ── Helper: call edge function ─────────────────────────────────────────────

async function callEdgeFunction(
  name: string,
  body: Record<string, unknown>
): Promise<{ data: any; error: string | null }> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.functions.invoke(name, { body });

  if (error) {
    let msg = error.message;
    if (error instanceof FunctionsHttpError) {
      try {
        const text = await (error as any).context?.text?.();
        msg = text || msg;
      } catch (_) {}
    }
    return { data: null, error: msg };
  }

  return { data, error: null };
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function VerifyCodeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();
  const { isDark } = useTheme();

  // Route params
  const params = useLocalSearchParams<{
    email?: string;
    mode?: VerifyMode;
    username?: string;
    password?: string;
    redirectTo?: string;
  }>();

  const email = params.email ?? '';
  const mode: VerifyMode = (params.mode as VerifyMode) ?? 'login';
  const username = params.username ?? '';
  const password = params.password ?? '';
  const redirectTo = params.redirectTo ?? '/home';

  // State
  const [code, setCode] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(CODE_EXPIRY_SECONDS);
  const [canResend, setCanResend] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(60);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resendRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const inputRefs = useRef<(TextInput | null)[]>([]);
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''));

  // ── Countdown timer ──────────────────────────────────────────────────────

  const startExpiryTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setSecondsLeft(CODE_EXPIRY_SECONDS);
    timerRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const startResendCooldown = useCallback(() => {
    if (resendRef.current) clearInterval(resendRef.current);
    setCanResend(false);
    setResendCooldown(60);
    resendRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(resendRef.current!);
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (resendRef.current) clearInterval(resendRef.current);
    };
  }, []);

  // ── Send code on mount ───────────────────────────────────────────────────

  useEffect(() => {
    if (email) {
      sendVerificationCode();
    }
  }, [email]); // Added email to dependency array

  // ── Send code via edge function ──────────────────────────────────────────

  async function sendVerificationCode() {
    if (!email) {
      showAlert('Error', 'Email address is required.');
      return;
    }

    setSending(true);
    try {
      const codeType = mode === 'registration' ? 'registration' : mode === 'login' ? 'login' : mode;
      const { data, error } = await callEdgeFunction('send-verification-code', {
        email,
        type: codeType,
        username: username || undefined,
      });

      if (error) {
        showAlert('Failed to Send Code', error);
        return;
      }

      setCodeSent(true);
      startExpiryTimer();
      startResendCooldown();
    } finally {
      setSending(false);
    }
  }

  // ── Handle digit input ───────────────────────────────────────────────────

  function handleDigitChange(value: string, index: number) {
    const sanitized = value.replace(/[^0-9]/g, '').slice(-1);
    const newDigits = [...digits];
    newDigits[index] = sanitized;
    setDigits(newDigits);
    setCode(newDigits.join(''));

    if (sanitized && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all digits entered
    if (sanitized && index === CODE_LENGTH - 1) {
      const full = newDigits.join('');
      if (full.length === CODE_LENGTH) {
        verifyCode(full);
      }
    }
  }

  function handleDigitKeyPress(key: string, index: number) {
    if (key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
      const newDigits = [...digits];
      newDigits[index - 1] = '';
      setDigits(newDigits);
      setCode(newDigits.join(''));
    }
  }

  // ── Verify code ──────────────────────────────────────────────────────────

  async function verifyCode(codeToVerify?: string) {
    const finalCode = (codeToVerify ?? code).trim();
    if (finalCode.length !== CODE_LENGTH) {
      showAlert('Invalid Code', `Please enter the ${CODE_LENGTH}-digit code.`);
      return;
    }

    if (secondsLeft === 0) {
      showAlert('Code Expired', 'Your verification code has expired. Please request a new one.');
      return;
    }

    setVerifying(true);
    try {
      // Verify via edge function (uses service role key — bypasses RLS)
      const { data, error } = await callEdgeFunction('send-verification-code', {
        action: 'verify',
        email: email.toLowerCase().trim(),
        code: finalCode,
      });

      if (error || !data?.success) {
        showAlert(
          'Invalid Code',
          error ?? 'The code you entered is incorrect or has expired. Please try again.'
        );
        return;
      }

      // Stop timers
      if (timerRef.current) clearInterval(timerRef.current);
      if (resendRef.current) clearInterval(resendRef.current);

      // Handle post-verification actions per mode
      await handlePostVerification();
    } finally {
      setVerifying(false);
    }
  }

  // ── Post-verification logic per mode ────────────────────────────────────

  async function handlePostVerification() {
    const supabase = getSupabaseClient();

    if (mode === 'registration') {
      // Create account via Supabase signUp
      if (!password) {
        showAlert('Error', 'Password is missing. Please restart registration.');
        router.replace('/signup');
        return;
      }

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { username: username || email.split('@')[0] },
        },
      });

      if (signUpError) {
        // If user already exists, try signing in
        if (signUpError.message.toLowerCase().includes('already')) {
          const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
          if (loginError) {
            showAlert('Account Error', loginError.message);
            return;
          }
        } else {
          showAlert('Registration Failed', signUpError.message);
          return;
        }
      }

      // Send welcome email (non-fatal)
      try {
        await callEdgeFunction('send-welcome-email', {
          email,
          username: username || email.split('@')[0],
          userId: signUpData?.user?.id,
        });
      } catch (_) {}

      router.replace(redirectTo as any);
      return;
    }

    if (mode === 'login') {
      // For email/OTP login we just navigate — the session was established upstream
      router.replace(redirectTo as any);
      return;
    }

    if (mode === 'password_change') {
      router.push({ pathname: '/security', params: { verified: '1' } } as any);
      return;
    }

    if (mode === 'email_change') {
      router.push({ pathname: '/settings', params: { verified: '1' } } as any);
      return;
    }

    // Default
    router.replace(redirectTo as any);
  }

  // ── Resend ───────────────────────────────────────────────────────────────

  async function handleResend() {
    if (!canResend || sending) return;
    setDigits(Array(CODE_LENGTH).fill(''));
    setCode('');
    await sendVerificationCode();
  }

  // ── UI helpers ───────────────────────────────────────────────────────────

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const timerColor =
    secondsLeft > 120 ? '#10A37F' : secondsLeft > 30 ? '#FF9F0A' : '#FF453A';

  // ── Theme colors ──────────────────────────────────────────────────────────

  const bg = isDark ? '#0a0a0a' : '#F2F2F7';
  const cardBg = isDark ? '#111111' : '#FFFFFF';
  const textColor = isDark ? '#FFFFFF' : '#000000';
  const subtleText = isDark ? '#888888' : '#6B6B6B';
  const borderColor = isDark ? '#2C2C2E' : '#E5E5EA';
  const inputBg = isDark ? '#1C1C1E' : '#F2F2F7';
  const accentColor = '#10A37F';

  // ── Render ────────────────────────────────────────────────────────────────

  const modeLabel: Record<VerifyMode, string> = {
    registration: 'Verify Your Email',
    login: 'Enter Verification Code',
    password_change: 'Confirm Identity',
    email_change: 'Verify New Email',
    account_action: 'Verify Action',
  };

  const modeDescription: Record<VerifyMode, string> = {
    registration: `We sent a ${CODE_LENGTH}-digit code to confirm your email address.`,
    login: `We sent a ${CODE_LENGTH}-digit sign-in code to your email.`,
    password_change: `Enter the ${CODE_LENGTH}-digit code to authorize this password change.`,
    email_change: `Enter the ${CODE_LENGTH}-digit code sent to your new email.`,
    account_action: `Enter the ${CODE_LENGTH}-digit code to complete this action.`,
  };

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Back button */}
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={24} color={textColor} />
        </TouchableOpacity>

        {/* Icon */}
        <View style={[styles.iconWrap, { backgroundColor: `${accentColor}20` }]}>
          <Ionicons name="mail-unread-outline" size={36} color={accentColor} />
        </View>

        {/* Title */}
        <Text style={[styles.title, { color: textColor }]}>
          {modeLabel[mode]}
        </Text>

        <Text style={[styles.subtitle, { color: subtleText }]}>
          {modeDescription[mode]}
        </Text>

        {!!email && (
          <Text style={[styles.emailLabel, { color: accentColor }]}>
            {email}
          </Text>
        )}

        {/* Loading state while sending */}
        {sending && !codeSent && (
          <View style={styles.sendingWrap}>
            <ActivityIndicator size="small" color={accentColor} />
            <Text style={[styles.sendingText, { color: subtleText }]}>Sending code…</Text>
          </View>
        )}

        {/* Code input */}
        {(codeSent || sending) && (
          <>
            <View style={styles.codeRow}>
              {digits.map((digit, i) => (
                <TextInput
                  key={i}
                  ref={(ref) => { inputRefs.current[i] = ref; }}
                  style={[
                    styles.codeInput,
                    {
                      backgroundColor: inputBg,
                      borderColor: digit ? accentColor : borderColor,
                      color: textColor,
                    },
                  ]}
                  value={digit}
                  onChangeText={(v) => handleDigitChange(v, i)}
                  onKeyPress={({ nativeEvent }) => handleDigitKeyPress(nativeEvent.key, i)}
                  keyboardType="number-pad"
                  maxLength={1}
                  textAlign="center"
                  selectTextOnFocus
                  returnKeyType="done"
                  accessibilityLabel={`Digit ${i + 1}`}
                />
              ))}
            </View>

            {/* Timer */}
            <View style={styles.timerRow}>
              <Ionicons name="time-outline" size={16} color={timerColor} />
              <Text style={[styles.timerText, { color: timerColor }]}>
                {secondsLeft > 0
                  ? `Code expires in ${formatTime(secondsLeft)}`
                  : 'Code expired — please request a new one'}
              </Text>
            </View>

            {/* Verify button */}
            <TouchableOpacity
              style={[
                styles.verifyBtn,
                {
                  backgroundColor:
                    code.length === CODE_LENGTH && secondsLeft > 0
                      ? accentColor
                      : isDark ? '#2C2C2E' : '#E5E5EA',
                },
              ]}
              onPress={() => verifyCode()}
              disabled={verifying || code.length !== CODE_LENGTH || secondsLeft === 0}
              activeOpacity={0.8}
            >
              {verifying ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text
                  style={[
                    styles.verifyBtnText,
                    {
                      color:
                        code.length === CODE_LENGTH && secondsLeft > 0
                          ? '#FFF'
                          : subtleText,
                    },
                  ]}
                >
                  Verify Code
                </Text>
              )}
            </TouchableOpacity>

            {/* Resend */}
            <View style={styles.resendRow}>
              <Text style={[styles.resendLabel, { color: subtleText }]}>
                {"Didn't receive a code? "}
              </Text>
              {canResend ? (
                <TouchableOpacity onPress={handleResend} disabled={sending}>
                  <Text style={[styles.resendLink, { color: accentColor }]}>
                    Resend
                  </Text>
                </TouchableOpacity>
              ) : (
                <Text style={[styles.resendCooldown, { color: subtleText }]}>
                  Resend in {resendCooldown}s
                </Text>
              )}
            </View>
          </>
        )}

        {/* Info card */}
        <View style={[styles.infoCard, { backgroundColor: cardBg, borderColor }]}>
          <Ionicons name="shield-checkmark-outline" size={20} color={accentColor} style={styles.infoIcon} />
          <Text style={[styles.infoText, { color: subtleText }]}>
            {'For your security, do not share this code with anyone — including support staff.'}
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  backBtn: {
    alignSelf: 'flex-start',
    marginBottom: 24,
    padding: 4,
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 8,
    maxWidth: 320,
  },
  emailLabel: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 32,
  },
  sendingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 24,
  },
  sendingText: {
    fontSize: 15,
  },
  codeRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
    justifyContent: 'center',
  },
  codeInput: {
    width: 48,
    height: 58,
    borderRadius: 14,
    borderWidth: 1.5,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : {}),
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 28,
  },
  timerText: {
    fontSize: 13,
    fontWeight: '600',
  },
  verifyBtn: {
    width: '100%',
    maxWidth: 360,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  verifyBtnText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 36,
  },
  resendLabel: {
    fontSize: 14,
  },
  resendLink: {
    fontSize: 14,
    fontWeight: '600',
  },
  resendCooldown: {
    fontSize: 14,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    maxWidth: 360,
    width: '100%',
  },
  infoIcon: {
    marginTop: 1,
    flexShrink: 0,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
  },
});
after the email login otp fix error its must auto sign fix.