import React, { useState } from 'react';
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

export default function SignUpScreen() {
  const { colors } = useTheme();
  const { sendOTP, operationLoading } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { email } = useLocalSearchParams<{ email: string }>();

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleContinue = async () => {
    if (!password.trim()) {
      showAlert('Error', 'Please enter a password');
      return;
    }

    if (password.length < 6) {
      showAlert('Error', 'Password must be at least 6 characters');
      return;
    }

    // Send OTP
    const { error } = await sendOTP(email);
    if (error) {
      showAlert('Error', error);
      return;
    }

    // Navigate to verification code screen
    router.push({
      pathname: '/verify-code',
      params: { email, password },
    });
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingTop: Platform.select({
        ios: insets.top + 16,
        android: insets.top + 16,
        default: 16,
      }),
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.md,
    },
    backButton: {
      marginRight: Spacing.md,
    },
    closeButton: {
      marginLeft: 'auto',
    },
    content: {
      flex: 1,
      paddingHorizontal: Spacing.xl,
      paddingTop: Spacing.xxl,
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
    },
    inputContainer: {
      backgroundColor: colors.surface,
      borderRadius: BorderRadius.lg,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      marginBottom: Spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    inputWrapper: {
      flex: 1,
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
    emailValue: {
      ...Typography.body,
      color: colors.text,
      fontSize: 16,
    },
    eyeButton: {
      padding: Spacing.xs,
    },
    continueButton: {
      backgroundColor: colors.text,
      borderRadius: BorderRadius.full,
      padding: Spacing.md,
      alignItems: 'center',
      marginTop: Spacing.lg,
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

  return (
    <View style={styles.container}>
      <StatusBar barStyle={colors.text === '#FFFFFF' ? 'light-content' : 'dark-content'} />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={28} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.closeButton} onPress={() => router.replace('/home')}>
          <Ionicons name="close" size={28} color={colors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.icon}>
          <Text style={styles.iconSymbol}>✦</Text>
        </View>

        <Text style={styles.title}>Create your account</Text>
        <Text style={styles.subtitle}>Set your password for OpenAI to continue</Text>

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Email</Text>
          <Text style={styles.emailValue}>{email}</Text>
        </View>

        <View style={styles.inputContainer}>
          <View style={styles.inputRow}>
            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>Password</Text>
              <TextInput
                style={styles.input}
                placeholder=""
                placeholderTextColor={colors.textSecondary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                editable={!operationLoading}
              />
            </View>
            <TouchableOpacity 
              style={styles.eyeButton} 
              onPress={() => setShowPassword(!showPassword)}
            >
              <Ionicons 
                name={showPassword ? 'eye-off' : 'eye'} 
                size={20} 
                color={colors.textSecondary} 
              />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.continueButton, !password.trim() && styles.continueButtonDisabled]}
          onPress={handleContinue}
          disabled={!password.trim() || operationLoading}
        >
          <Text style={styles.continueButtonText}>
            {operationLoading ? 'Processing...' : 'Continue'}
          </Text>
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
