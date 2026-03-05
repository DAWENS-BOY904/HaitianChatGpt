/**
 * AI MODE SELECTOR MODAL
 * Allows users to switch between Instant, Deep Thinking, and Agent modes
 * Based on Kimi AI interface (Photo 2)
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
} from 'react-native-reanimated';
import { useTheme } from '../hooks/useTheme';
import { Spacing, Typography, BorderRadius } from '../constants/theme';

interface AIModeOption {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  color: string;
  badge?: string;
}

const AI_MODES: AIModeOption[] = [
  {
    id: 'instant',
    title: 'K2.5 Instant',
    subtitle: 'Quick response',
    icon: 'flash-outline',
    color: '#007AFF',
  },
  {
    id: 'thinking',
    title: 'K2.5 Thinking',
    subtitle: 'Deep thinking for complex questions',
    icon: 'bulb-outline',
    color: '#FF9500',
  },
  {
    id: 'agent',
    title: 'K2.5 Agent',
    subtitle: 'Research, slides, websites, docs, sheets',
    icon: 'cube-outline',
    color: '#5856D6',
    badge: 'New chat',
  },
  {
    id: 'agent_swarm',
    title: 'K2.5 Agent Swarm',
    subtitle: 'Large-scale search, long-form writing, batch tasks',
    icon: 'git-network-outline',
    color: '#AF52DE',
    badge: 'Beta',
  },
];

interface AIModeSelectorModalProps {
  visible: boolean;
  onClose: () => void;
  selectedMode: string;
  onSelectMode: (modeId: string) => void;
}

export function AIModeSelectorModal({
  visible,
  onClose,
  selectedMode,
  onSelectMode,
}: AIModeSelectorModalProps) {
  const { colors } = useTheme();

  const handleSelect = (modeId: string) => {
    onSelectMode(modeId);
    onClose();
  };

  const styles = StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'flex-start',
      paddingTop: Platform.OS === 'ios' ? 100 : 80,
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
    },
    container: {
      backgroundColor: colors.background,
      marginHorizontal: Spacing.md,
      borderRadius: BorderRadius.xl,
      padding: Spacing.md,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.3,
      shadowRadius: 20,
      elevation: 20,
      maxWidth: 400,
      alignSelf: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: Spacing.md,
      paddingBottom: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: {
      ...Typography.heading,
      fontSize: 18,
      fontWeight: '700',
    },
    closeButton: {
      padding: Spacing.xs,
    },
    optionsList: {
      gap: Spacing.xs,
    },
    optionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: Spacing.md,
      borderRadius: BorderRadius.lg,
      backgroundColor: colors.surface,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    optionItemSelected: {
      borderColor: colors.primary,
      backgroundColor: `${colors.primary}15`,
    },
    iconContainer: {
      width: 40,
      height: 40,
      borderRadius: BorderRadius.md,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: Spacing.md,
    },
    optionContent: {
      flex: 1,
    },
    optionTitle: {
      ...Typography.body,
      fontWeight: '600',
      fontSize: 16,
      marginBottom: 2,
    },
    optionSubtitle: {
      ...Typography.caption,
      color: colors.textSecondary,
      lineHeight: 18,
    },
    badgeContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
    },
    badge: {
      backgroundColor: colors.primary,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 2,
      borderRadius: BorderRadius.sm,
    },
    badgeText: {
      ...Typography.caption,
      color: '#FFFFFF',
      fontSize: 11,
      fontWeight: '600',
    },
    checkmark: {
      marginLeft: Spacing.sm,
    },
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <BlurView intensity={20} tint="dark" style={styles.backdrop}>
          <Animated.View
            entering={SlideInDown.duration(300).springify()}
            exiting={SlideOutDown.duration(250)}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.container}>
              <View style={styles.header}>
                <Text style={styles.headerTitle}>Select AI Mode</Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={onClose}
                >
                  <Ionicons
                    name="close"
                    size={24}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.optionsList}
              >
                {AI_MODES.map((mode) => (
                  <TouchableOpacity
                    key={mode.id}
                    style={[
                      styles.optionItem,
                      selectedMode === mode.id && styles.optionItemSelected,
                    ]}
                    onPress={() => handleSelect(mode.id)}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.iconContainer,
                        { backgroundColor: `${mode.color}20` },
                      ]}
                    >
                      <Ionicons
                        name={mode.icon as any}
                        size={22}
                        color={mode.color}
                      />
                    </View>

                    <View style={styles.optionContent}>
                      <Text style={styles.optionTitle}>{mode.title}</Text>
                      <Text style={styles.optionSubtitle}>
                        {mode.subtitle}
                      </Text>
                    </View>

                    <View style={styles.badgeContainer}>
                      {mode.badge && (
                        <View style={styles.badge}>
                          <Text style={styles.badgeText}>{mode.badge}</Text>
                        </View>
                      )}
                      {selectedMode === mode.id && (
                        <Ionicons
                          name="checkmark"
                          size={24}
                          color={colors.primary}
                          style={styles.checkmark}
                        />
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </Animated.View>
        </BlurView>
      </TouchableOpacity>
    </Modal>
  );
}
