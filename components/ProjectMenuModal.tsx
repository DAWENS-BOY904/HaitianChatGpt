/**
 * PROJECT MENU MODAL - KIMI AI STYLE
 * Side menu for project-get page matching Photo 2 design
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '@/template';
import { useRouter } from 'expo-router';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ProjectMenuModalProps {
  visible: boolean;
  onClose: () => void;
}

export function ProjectMenuModal({ visible, onClose }: ProjectMenuModalProps) {
  const { colors } = useTheme();
  const { user, logout } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');

  const styles = StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: colors.overlay,
    },
    container: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: '80%',
      backgroundColor: colors.background,
      paddingTop: Platform.select({ ios: insets.top, android: insets.top, default: 0 }),
    },
    header: {
      padding: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    profileSection: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      marginBottom: Spacing.md,
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: BorderRadius.full,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      ...Typography.body,
      color: '#FFFFFF',
      fontWeight: '700',
      fontSize: 20,
    },
    userInfo: {
      flex: 1,
    },
    userName: {
      ...Typography.body,
      color: colors.text,
      fontWeight: '600',
      fontSize: 16,
    },
    userEmail: {
      ...Typography.caption,
      color: colors.textSecondary,
    },
    exploreBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: Spacing.md,
      backgroundColor: colors.surface,
      borderRadius: BorderRadius.md,
      marginBottom: Spacing.md,
    },
    exploreText: {
      ...Typography.body,
      color: colors.text,
      fontWeight: '600',
    },
    freeTrialButton: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: Spacing.md,
      backgroundColor: `${colors.primary}15`,
      borderRadius: BorderRadius.md,
      gap: Spacing.sm,
    },
    freeTrialText: {
      ...Typography.body,
      color: colors.primary,
      fontWeight: '600',
      flex: 1,
    },
    content: {
      flex: 1,
    },
    sectionTitle: {
      ...Typography.caption,
      color: colors.textSecondary,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      fontWeight: '600',
      textTransform: 'uppercase',
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.inputBackground,
      borderRadius: BorderRadius.sm,
      padding: Spacing.sm,
      marginHorizontal: Spacing.md,
      marginBottom: Spacing.md,
    },
    searchInput: {
      flex: 1,
      ...Typography.body,
      color: colors.text,
      marginLeft: Spacing.sm,
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: Spacing.md,
      gap: Spacing.md,
    },
    menuItemText: {
      ...Typography.body,
      color: colors.text,
      flex: 1,
    },
    footer: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      padding: Spacing.md,
      paddingBottom: Platform.select({ ios: insets.bottom + Spacing.md, android: insets.bottom + Spacing.md, default: Spacing.md }),
    },
    logoutButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      padding: Spacing.sm,
    },
    logoutText: {
      ...Typography.body,
      color: colors.danger,
    },
    emptyState: {
      padding: Spacing.xl,
      alignItems: 'center',
    },
    emptyText: {
      ...Typography.body,
      color: colors.textSecondary,
      textAlign: 'center',
    },
  });

  const handleStartTrial = () => {
    onClose();
    router.push('/buy-coins');
  };

  const handleLogout = async () => {
    await logout();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.container} onStartShouldSetResponder={() => true}>
          <View style={styles.header}>
            <View style={styles.profileSection}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {user?.email?.[0].toUpperCase() || 'U'}
                </Text>
              </View>
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{user?.username || 'User'}</Text>
                <Text style={styles.userEmail} numberOfLines={1}>{user?.email}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </View>

            <TouchableOpacity style={styles.exploreBanner} onPress={() => {
              onClose();
              router.push('/subscription');
            }}>
              <Text style={styles.exploreText}>Explore Kimi+</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.text} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.freeTrialButton} onPress={handleStartTrial}>
              <Ionicons name="musical-notes" size={24} color={colors.primary} />
              <Text style={styles.freeTrialText}>Start free trial</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content}>
            <Text style={styles.sectionTitle}>Chat history</Text>

            <View style={styles.searchContainer}>
              <Ionicons name="search" size={20} color={colors.textSecondary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search"
                placeholderTextColor={colors.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No project history yet</Text>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={20} color={colors.danger} />
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}
