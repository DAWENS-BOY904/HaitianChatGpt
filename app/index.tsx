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
