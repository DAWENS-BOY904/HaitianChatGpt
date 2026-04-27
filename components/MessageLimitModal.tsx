/**
 * MESSAGE LIMIT MODAL
 * Shows when non-Pro users hit the 45 message per conversation limit
 * Includes "New Chat" and "Get Plus" options as shown in reference image
 */

import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useRouter } from 'expo-router';
import { Spacing, Typography, BorderRadius } from '../constants/theme';

interface MessageLimitModalProps {
  visible: boolean;
  onClose: () => void;
  onNewChat: () => void;
  resetTime?: string;
}

export function MessageLimitModal({ 
  visible, 
  onClose, 
  onNewChat,
  resetTime = '4:02 AM'
}: MessageLimitModalProps) {
  const { colors } = useTheme();
  const router = useRouter();

  const handleGetPlus = () => {
    onClose();
    router.push('/subscription');
  };

  const handleNewChat = () => {
    onNewChat();
    onClose();
  };

  const styles = StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: Spacing.xl,
    },
    modal: {
      backgroundColor: colors.surface,
      borderRadius: BorderRadius.xl,
      padding: Spacing.xl,
      width: '100%',
      maxWidth: 400,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.3,
      shadowRadius: 16,
      elevation: 10,
    },
    iconContainer: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: `${colors.primary}20`,
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center',
      marginBottom: Spacing.lg,
    },
    title: {
      ...Typography.heading,
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      marginBottom: Spacing.md,
    },
    message: {
      ...Typography.body,
      fontSize: 15,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: Spacing.xl,
    },
    highlight: {
      color: colors.primary,
      fontWeight: '600',
    },
    buttonsContainer: {
      gap: Spacing.sm,
    },
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: Spacing.md,
      borderRadius: BorderRadius.lg,
      gap: Spacing.sm,
    },
    primaryButton: {
      backgroundColor: colors.text,
    },
    secondaryButton: {
      backgroundColor: colors.background,
      borderWidth: 2,
      borderColor: colors.border,
    },
    buttonText: {
      ...Typography.body,
      fontSize: 16,
      fontWeight: '700',
    },
    primaryButtonText: {
      color: colors.background,
    },
    secondaryButtonText: {
      color: colors.text,
    },
    infoBox: {
      backgroundColor: `${colors.primary}10`,
      padding: Spacing.md,
      borderRadius: BorderRadius.md,
      marginTop: Spacing.lg,
      borderLeftWidth: 3,
      borderLeftColor: colors.primary,
    },
    infoText: {
      ...Typography.caption,
      color: colors.text,
      fontSize: 13,
      lineHeight: 18,
    },
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable onPress={(e) => e.stopPropagation()}>
          <View style={styles.modal}>
            <View style={styles.iconContainer}>
              <Ionicons name="chatbubbles" size={32} color={colors.primary} />
            </View>

            <Text style={styles.title}>
              You've reached the message limit
            </Text>

            <Text style={styles.message}>
              You've used all <Text style={styles.highlight}>45 messages</Text> for this conversation.{'\n\n'}
              Upgrade now or wait until <Text style={styles.highlight}>{resetTime}</Text> to keep using files, or start a new chat now without files.
            </Text>

            <View style={styles.buttonsContainer}>
              <TouchableOpacity 
                style={[styles.button, styles.secondaryButton]}
                onPress={handleNewChat}
              >
                <Ionicons name="add-circle-outline" size={20} color={colors.text} />
                <Text style={[styles.buttonText, styles.secondaryButtonText]}>
                  New chat
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.button, styles.primaryButton]}
                onPress={handleGetPlus}
              >
                <Ionicons name="flash" size={20} color={colors.background} />
                <Text style={[styles.buttonText, styles.primaryButtonText]}>
                  Get Plus
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                💡 With Plus: Unlimited messages, photo uploads, priority access, and advanced features
              </Text>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
connect this in home page for plan free limit messge 50 show this modal and x button they can remove it and if they send 20 messgae ank li re monte and add li in blur mmode.
