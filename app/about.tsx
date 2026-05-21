import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useRouter } from 'expo-router';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AboutScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingTop: Platform.select({ ios: insets.top, android: insets.top, default: 0 }),
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: {
      padding: Spacing.xs,
      marginRight: Spacing.sm,
    },
    headerTitle: {
      ...Typography.heading,
      color: colors.text,
    },
    content: {
      padding: Spacing.lg,
    },
    logoContainer: {
      alignItems: 'center',
      marginVertical: Spacing.xl,
    },
    logo: {
      width: 80,
      height: 80,
      borderRadius: BorderRadius.md,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.md,
    },
    appName: {
      ...Typography.title,
      color: colors.text,
      marginBottom: Spacing.xs,
    },
    version: {
      ...Typography.body,
      color: colors.textSecondary,
    },
    section: {
      marginTop: Spacing.xl,
    },
    sectionTitle: {
      ...Typography.heading,
      color: colors.text,
      marginBottom: Spacing.md,
    },
    infoRow: {
      flexDirection: 'row',
      paddingVertical: Spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    infoLabel: {
      ...Typography.body,
      color: colors.textSecondary,
      width: 100,
    },
    infoValue: {
      ...Typography.body,
      color: colors.text,
      flex: 1,
      fontWeight: '600',
    },
    description: {
      ...Typography.body,
      color: colors.textSecondary,
      lineHeight: 24,
      marginTop: Spacing.md,
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>About</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.logoContainer}>
          <View style={styles.logo}>
            <Ionicons name="chatbubbles" size={40} color="#FFFFFF" />
          </View>
          <Text style={styles.appName}>HaitianChatGpt</Text>
          <Text style={styles.version}>Version 1.0.0</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Creator Information</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Created by:</Text>
            <Text style={styles.infoValue}>Dawens Boy</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Gender:</Text>
            <Text style={styles.infoValue}>Male</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Age:</Text>
            <Text style={styles.infoValue}>10 years old</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About This App</Text>
          <Text style={styles.description}>
            HaitianChatGpt is a complete AI-powered assistant application with social features. 
            It combines the power of artificial intelligence with social messaging, allowing you 
            to have intelligent conversations with AI and connect with friends.
          </Text>
          <Text style={styles.description}>
            Features include AI chat, conversation history, friends system, group chats, 
            and comprehensive settings for customization.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Technology</Text>
          <Text style={styles.description}>
            Built with React Native and OnSpace Cloud backend, featuring real-time messaging, 
            secure authentication, and scalable infrastructure.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
