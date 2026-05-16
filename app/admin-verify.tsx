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
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSupabaseClient } from '@/template';

// Admin verification code (in production, generate and send via email)
const ADMIN_VERIFICATION_CODE = '123456';

export default function AdminVerifyScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const supabase = getSupabaseClient();

  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    // Verify user is admin
    if (!user) {
      router.replace('/login');
      return;
    }

    const adminEmails = ['berryxoe@gmail.com', 'newdawens@gmail.com', 'kontgithub@gmail.com'];
    if (!adminEmails.includes(user.email || '')) {
      showAlert('Access Denied', 'You do not have admin privileges');
      router.replace('/home');
      return;
    }

    // Auto-focus first input
    inputRefs.current[0]?.focus();
  }, []);

  const handleCodeChange = (index: number, value: string) => {
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

    setLoading(true);

    // Verify code
    if (otp === ADMIN_VERIFICATION_CODE) {
      // Update user role to admin in database
      const { error } = await supabase
        .from('user_profiles')
        .update({ role: 'admin' })
        .eq('id', user?.id);

      if (error) {
        showAlert('Error', 'Failed to update admin status');
        setLoading(false);
        return;
      }

      showAlert('Success', 'Admin access granted', [
        { text: 'Continue', onPress: () => router.replace('/admin') }
      ]);
    } else {
      showAlert('Error', 'Invalid verification code');
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    }

    setLoading(false);
  };

  const handleResendCode = () => {
    showAlert('Code Sent', `Verification code sent to ${user?.email}`);
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
      zIndex: 10,
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
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: '#FF3B30',
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center',
      marginBottom: Spacing.xl,
    },
    iconSymbol: {
      fontSize: 40,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    title: {
      fontSize: 32,
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
      width: 54,
      height: 60,
      backgroundColor: colors.surface,
      borderRadius: BorderRadius.lg,
      borderWidth: 2,
      borderColor: colors.border,
      textAlign: 'center',
      fontSize: 26,
      fontWeight: '700',
      color: colors.text,
    },
    codeInputFocused: {
      borderColor: '#FF3B30',
    },
    continueButton: {
      backgroundColor: '#FF3B30',
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
      color: '#FFFFFF',
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
      alignItems: 'center',
      marginTop: Spacing.xl,
    },
    footerText: {
      ...Typography.caption,
      color: colors.textSecondary,
      textAlign: 'center',
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
          <Text style={styles.iconSymbol}>🔐</Text>
        </View>

        <Text style={styles.title}>Admin Verification</Text>
        <Text style={styles.subtitle}>
          Enter the 6-digit verification code sent to{'\n'}
          <Text style={styles.email}>{user?.email}</Text>
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
              editable={!loading}
            />
          ))}
        </View>

        <TouchableOpacity
          style={[styles.continueButton, !isCodeComplete && styles.continueButtonDisabled]}
          onPress={() => handleVerify()}
          disabled={!isCodeComplete || loading}
        >
          <Text style={styles.continueButtonText}>
            {loading ? 'Verifying...' : 'Verify & Continue'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.resendButton} 
          onPress={handleResendCode}
          disabled={loading}
        >
          <Text style={styles.resendButtonText}>Resend code</Text>
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            This code was sent for security verification.{'\n'}
            If you didn't request admin access, please contact support.
          </Text>
        </View>
      </View>
    </View>
  );
}
