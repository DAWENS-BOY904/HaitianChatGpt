import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Platform,
} from 'react-native';
import { useAuth, useAlert } from '@/template';
import { useTheme } from '../hooks/useTheme';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function VerifyCodeScreen() {
  const { colors } = useTheme();
  const { verifyOTPAndLogin, sendOTP, operationLoading } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { email, password } = useLocalSearchParams<{ email: string; password: string }>();

  const [code, setCode] = useState(['', '', '', '', '', '']);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    // Auto-focus first input
    inputRefs.current[0]?.focus();
  }, []);

  const handleCodeChange = (index: number, value: string) => {
    // Only allow digits
    if (value && !/^\d+$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits are entered
    if (index === 5 && value) {
      handleVerify(newCode.join(''));
    }
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

    const { error } = await verifyOTPAndLogin(email, otp, { password });
    if (error) {
      showAlert('Error', error);
      // Reset code inputs on error
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    }
  };

  const handleResendEmail = async () => {
    const { error } = await sendOTP(email);
    if (error) {
      showAlert('Error', error);
    } else {
      showAlert('Success', 'Verification code sent to your email');
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    closeButton: {
      position: 'absolute',
      top: Platform.select({
        ios: insets.top + 16,
        android: insets.top + 16,
        default: 16,
      }),
      right: 20,
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
    icon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.text,
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center',
      marginBottom: Spacing.xl,
    },
    iconSymbol: {
      fontSize: 32,
      fontWeight: '700',
      color: colors.background,
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      color: colors.text,
      marginBottom: Spacing.md,
      textAlign: 'center',
    },
    subtitle: {
      ...Typography.body,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: Spacing.xxl,
      lineHeight: 22,
    },
    email: {
      color: colors.text,
      fontWeight: '600',
    },
    codeInputContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: Spacing.sm,
      marginBottom: Spacing.xl,
    },
    codeInput: {
      width: 50,
      height: 56,
      backgroundColor: colors.surface,
      borderRadius: BorderRadius.lg,
      borderWidth: 2,
      borderColor: colors.border,
      textAlign: 'center',
      fontSize: 24,
      fontWeight: '600',
      color: colors.text,
    },
    codeInputFocused: {
      borderColor: colors.text,
    },
    continueButton: {
      backgroundColor: colors.text,
      borderRadius: BorderRadius.full,
      padding: Spacing.md,
      alignItems: 'center',
      marginBottom: Spacing.md,
    },
    continueButtonDisabled: {
      opacity: 0.3,
    },
    continueButtonText: {
      ...Typography.body,
      color: colors.background,
      fontWeight: '600',
      fontSize: 16,
    },
    resendButton: {
      alignItems: 'center',
      padding: Spacing.sm,
    },
    resendButtonText: {
      ...Typography.body,
      color: colors.text,
      fontWeight: '600',
    },
    footer: {
      position: 'absolute',
      bottom: Platform.select({
        ios: insets.bottom + Spacing.lg,
        android: Spacing.lg,
        default: Spacing.lg,
      }),
      left: Spacing.xl,
      right: Spacing.xl,
      flexDirection: 'row',
      justifyContent: 'center',
      gap: Spacing.md,
    },
    footerLink: {
      ...Typography.caption,
      color: colors.textSecondary,
    },
  });

  const isCodeComplete = code.every(digit => digit !== '');

  return (
    <View style={styles.container}>
      <StatusBar barStyle={colors.text === '#FFFFFF' ? 'light-content' : 'dark-content'} />

      <TouchableOpacity style={styles.closeButton} onPress={() => router.replace('/home')}>
        <Ionicons name="close" size={28} color={colors.text} />
      </TouchableOpacity>

      <View style={styles.content}>
        <View style={styles.icon}>
          <Text style={styles.iconSymbol}>✦</Text>
        </View>

        <Text style={styles.title}>Check your inbox</Text>
        <Text style={styles.subtitle}>
          Enter the verification code we just sent to{'\n'}
          <Text style={styles.email}>{email}</Text>.
        </Text>

        <View style={styles.codeInputContainer}>
          {code.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => inputRefs.current[index] = ref}
              style={[
                styles.codeInput,
                digit && styles.codeInputFocused,
              ]}
              value={digit}
              onChangeText={(value) => handleCodeChange(index, value)}
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
          style={styles.resendButton} 
          onPress={handleResendEmail}
          disabled={operationLoading}
        >
          <Text style={styles.resendButtonText}>Resend email</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerLink}>Terms of Use</Text>
        <Text style={styles.footerLink}>•</Text>
        <Text style={styles.footerLink}>Privacy Policy</Text>
      </View>
    </View>
  );
}
