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
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function LoginScreen() {
  const { colors } = useTheme();
  const { signInWithPassword, signInWithGoogle, operationLoading } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

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
    const { error } = await signInWithGoogle();
    if (error) {
      showAlert('Error', error);
    }
  };

  const handlePhoneLogin = () => {
    router.push('/verify-code');
  };

  const handleAppleSignIn = async () => {
    showAlert('Coming Soon', 'Apple Sign In will be available soon');
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

  return (
    <View style={styles.container}>
      <StatusBar barStyle={colors.text === '#FFFFFF' ? 'light-content' : 'dark-content'} />

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

        {/* Apple Sign In — Black bg with white text per Apple HIG + visible border */}
        <TouchableOpacity
          style={styles.appleButton}
          onPress={handleAppleSignIn}
          accessibilityLabel="Sign in with Apple"
          accessibilityRole="button"
        >
          <Ionicons name="logo-apple" size={20} color="#FFFFFF" />
          <Text style={styles.appleButtonText}>Sign in with Apple</Text>
        </TouchableOpacity>

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
