import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, StatusBar, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useAuth, useAlert } from '@/template';
import { useTheme } from '../hooks/useTheme';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';

export default function LoginScreen() {
  const { colors } = useTheme();
  const { sendOTP, verifyOTPAndLogin, signInWithPassword, operationLoading } = useAuth();
  const { showAlert } = useAlert();
  
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);

  const handleSendOTP = async () => {
    if (!email) {
      showAlert('Error', 'Please enter your email');
      return;
    }

    const { error } = await sendOTP(email);
    if (error) {
      showAlert('Error', error);
      return;
    }

    setOtpSent(true);
    showAlert('Success', 'Verification code sent to your email');
  };

  const handleSignUp = async () => {
    if (!email || !password || !confirmPassword) {
      showAlert('Error', 'Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      showAlert('Error', 'Passwords do not match');
      return;
    }

    if (!otpSent) {
      await handleSendOTP();
      return;
    }

    if (!otp) {
      showAlert('Error', 'Please enter the verification code');
      return;
    }

    const { error } = await verifyOTPAndLogin(email, otp, { password });
    if (error) {
      showAlert('Error', error);
    }
  };

  const handleSignIn = async () => {
    if (!email || !password) {
      showAlert('Error', 'Please enter email and password');
      return;
    }

    const { error } = await signInWithPassword(email, password);
    if (error) {
      showAlert('Error', error);
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      flexGrow: 1,
      justifyContent: 'center',
      padding: Spacing.xl,
    },
    header: {
      alignItems: 'center',
      marginBottom: Spacing.xxl,
    },
    logo: {
      width: 64,
      height: 64,
      borderRadius: BorderRadius.md,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.md,
    },
    title: {
      ...Typography.title,
      color: colors.text,
      marginBottom: Spacing.xs,
    },
    subtitle: {
      ...Typography.body,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    form: {
      gap: Spacing.md,
    },
    input: {
      backgroundColor: colors.inputBackground,
      borderRadius: BorderRadius.sm,
      padding: Spacing.md,
      ...Typography.body,
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.border,
    },
    button: {
      backgroundColor: colors.primary,
      borderRadius: BorderRadius.sm,
      padding: Spacing.md,
      alignItems: 'center',
      marginTop: Spacing.sm,
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    buttonText: {
      ...Typography.body,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    switchContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: Spacing.lg,
      gap: Spacing.xs,
    },
    switchText: {
      ...Typography.body,
      color: colors.textSecondary,
    },
    switchButton: {
      ...Typography.body,
      color: colors.primary,
      fontWeight: '600',
    },
    otpInfo: {
      ...Typography.caption,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: Spacing.sm,
    },
  });

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle={colors.text === '#FFFFFF' ? 'light-content' : 'dark-content'} />
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.logo}>
            <Ionicons name="chatbubbles" size={32} color="#FFFFFF" />
          </View>
          <Text style={styles.title}>HaitianChatGpt</Text>
          <Text style={styles.subtitle}>
            {isSignUp ? 'Create your account' : 'Welcome back'}
          </Text>
        </View>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={colors.textSecondary}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            editable={!operationLoading}
          />

          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={colors.textSecondary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            editable={!operationLoading}
          />

          {isSignUp && (
            <>
              <TextInput
                style={styles.input}
                placeholder="Confirm Password"
                placeholderTextColor={colors.textSecondary}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                editable={!operationLoading}
              />

              {otpSent && (
                <>
                  <TextInput
                    style={styles.input}
                    placeholder="Verification Code"
                    placeholderTextColor={colors.textSecondary}
                    value={otp}
                    onChangeText={setOtp}
                    keyboardType="number-pad"
                    editable={!operationLoading}
                  />
                  <Text style={styles.otpInfo}>
                    Enter the 4-digit code sent to your email
                  </Text>
                </>
              )}
            </>
          )}

          <TouchableOpacity
            style={[styles.button, operationLoading && styles.buttonDisabled]}
            onPress={isSignUp ? handleSignUp : handleSignIn}
            disabled={operationLoading}
          >
            <Text style={styles.buttonText}>
              {operationLoading ? 'Processing...' : (isSignUp ? (otpSent ? 'Create Account' : 'Continue') : 'Sign In')}
            </Text>
          </TouchableOpacity>

          <View style={styles.switchContainer}>
            <Text style={styles.switchText}>
              {isSignUp ? 'Already have an account?' : "Don't have an account?"}
            </Text>
            <TouchableOpacity onPress={() => {
              setIsSignUp(!isSignUp);
              setOtpSent(false);
              setOtp('');
            }}>
              <Text style={styles.switchButton}>
                {isSignUp ? 'Sign In' : 'Sign Up'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
