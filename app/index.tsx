import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar, Platform, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/template';
import { Redirect } from 'expo-router';
import { useTheme } from '../hooks/useTheme';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const WELCOME_PHRASES = [
  "Let's brainstorm",
  "What can I help with?",
  "Ask me anything",
  "Ready to assist you",
  "What's on your mind?",
];

function WelcomeScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [phraseIndex, setPhraseIndex] = useState(0);
  const fadeTitle = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const interval = setInterval(() => {
      Animated.timing(fadeTitle, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
        setPhraseIndex(prev => (prev + 1) % WELCOME_PHRASES.length);
        Animated.timing(fadeTitle, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      });
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: Spacing.xl,
      paddingTop: Platform.select({
        ios: insets.top + 60,
        android: insets.top + 60,
        default: 60,
      }),
    },
    title: {
      fontSize: 42,
      fontWeight: '700',
      color: colors.text,
      marginBottom: Spacing.lg,
      textAlign: 'center',
    },
    buttonContainer: {
      width: '100%',
      gap: Spacing.md,
      paddingHorizontal: Spacing.xl,
      paddingBottom: Platform.select({
        ios: insets.bottom + Spacing.xxl,
        android: Spacing.xxl,
        default: Spacing.xxl,
      }),
    },
    appleButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#FFFFFF',
      borderRadius: BorderRadius.full,
      padding: Spacing.md,
      gap: Spacing.sm,
    },
    appleButtonText: {
      color: '#000000',
      fontWeight: '600',
      fontSize: 16,
    },
    googleButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#4A4A4A',
      borderRadius: BorderRadius.full,
      padding: Spacing.md,
      gap: Spacing.sm,
    },
    googleButtonText: {
      color: '#FFFFFF',
      fontWeight: '600',
      fontSize: 16,
    },
    signupButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#4A4A4A',
      borderRadius: BorderRadius.full,
      padding: Spacing.md,
    },
    signupButtonText: {
      color: '#FFFFFF',
      fontWeight: '600',
      fontSize: 16,
    },
    loginButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
      borderRadius: BorderRadius.full,
      padding: Spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    loginButtonText: {
      color: colors.text,
      fontWeight: '600',
      fontSize: 16,
    },
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle={colors.text === '#FFFFFF' ? 'light-content' : 'dark-content'} />

      <View style={styles.content}>
        <Animated.Text style={[styles.title, { opacity: fadeTitle }]}>
          {WELCOME_PHRASES[phraseIndex]}
        </Animated.Text>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.appleButton} onPress={() => router.push('/login')}>
          <Ionicons name="logo-apple" size={20} color="#000000" />
          <Text style={styles.appleButtonText}>Continue with Apple</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.googleButton} onPress={() => router.push('/login')}>
          <Ionicons name="logo-google" size={20} color="#FFFFFF" />
          <Text style={styles.googleButtonText}>Continue with Google</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.signupButton} onPress={() => router.push('/login')}>
          <Text style={styles.signupButtonText}>Sign up</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.loginButton} onPress={() => router.push('/login')}>
          <Text style={styles.loginButtonText}>Log in</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function RootScreen() {
  const { user } = useAuth();

  if (user) {
    return <Redirect href="/home" />;
  }

  return <WelcomeScreen />;
}
Add a RevenueCat setup guide screen in app settings showing how to configure RC_API_KEY for iOS/Android, add product IDs to App Store Connect and Google Play, and test the full Go plan purchase flow end-to-end with real receipts.In group chat mode, when user types @, show a popup with all group members (name + avatar). Selecting one tags them in the message. If a user is tagged, the AI does not respond — only the tagged person can reply.After successful login (email/Google/Apple), automatically invoke the send-admin-email edge function to send the user a confirmation email with login time, device platform, and welcome message. Implement in the auth context after signIn succeeds.Implement real Expo push notifications: when AI finishes a response while app is in background, send a local notification to the device with the conversation title and first 60 chars of the AI response using expo-notifications and Supabase edge function. Fix this page to directly call signInWithGoogle() and implement real Apple Sign-In using expo-apple-authentication, bypassing the login page and going straight to the real OAuth/Apple flow.
