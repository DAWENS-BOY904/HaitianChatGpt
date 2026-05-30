import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ScrollView,
  Platform,
  Share,
  Linking,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAlert } from '@/template';
import { BlurView } from 'expo-blur'; // npm install expo-blur

interface EmailComposerModalProps {
  visible: boolean;
  onClose: () => void;
  template?: 'support' | 'relations' | 'custom';
}

// --- Constants ---
const RECIPIENT_EMAIL = 'support@haitianchatgpt.com';

const TEMPLATES = {
  support: {
    subject: 'Support Request – Account Issue',
    body: `Hello Haitian ChatGPT Support Team,

I hope you are doing well. I am writing to request assistance with an issue I am experiencing.

Phone number (with country code):
Device model:
Operating system version:

Description of the issue:
Please clearly describe the problem here (for example: unable to receive verification code, account banned, messages not sending, etc.).

I have already tried basic troubleshooting steps such as restarting my device and checking my internet connection, but the issue still persists.

I would appreciate your help in resolving this matter as soon as possible. Thank you for your time and support.

Kind regards,
[Your Name]`,
  },
  relations: {
    subject: 'Partnership Inquiry',
    body: `Hello Haitian ChatGPT Team,

I am reaching out to inquire about potential collaboration opportunities.

Company/Organization:
Contact Person:
Email:
Phone:

Proposal:
[Describe your partnership proposal]

I look forward to discussing this further.

Best regards,
[Your Name]`,
  },
  custom: {
    subject: '',
    body: '',
  },
} as const;

// --- Component ---
export function EmailComposerModal({
  visible,
  onClose,
  template = 'support',
}: EmailComposerModalProps) {
  const { colors, isDark } = useTheme();
  const { showAlert } = useAlert();
  const insets = useSafeAreaInsets();

  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  // Reset fields when modal opens with new template
  React.useEffect(() => {
    if (visible) {
      const t = TEMPLATES[template];
      setSubject(t.subject);
      setBody(t.body);
    }
  }, [visible, template]);

  const handleCopyEmail = useCallback(() => {
    const fullEmail = `To: ${RECIPIENT_EMAIL}\\nSubject: ${subject}\\n\\n${body}`;
    // Clipboard.setString(fullEmail); // Uncomment when you have @react-native-clipboard/clipboard
    showAlert('Copied', 'Email template copied to clipboard');
  }, [subject, body, showAlert]);

  const handleSendEmail = useCallback(async () => {
    if (Platform.OS === 'web') {
      const mailtoUrl = `mailto:${RECIPIENT_EMAIL}?subject=${encodeURIComponent(
        subject
      )}&body=${encodeURIComponent(body)}`;
      Linking.openURL(mailtoUrl);
      return;
    }

    try {
      await Share.share({
        message: `Subject: ${subject}\\n\\n${body}`,
        title: 'Send via Email',
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  }, [subject, body]);

  // --- Styles ---
  const styles = useMemo(
    () =>
      StyleSheet.create({
        overlay: {
          flex: 1,
          justifyContent: 'flex-end',
        },
        blurBackground: {
          ...StyleSheet.absoluteFillObject,
        },
        blurOverlay: {
          ...StyleSheet.absoluteFillObject,
          backgroundColor: isDark ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.25)',
        },
        container: {
          borderTopLeftRadius: BorderRadius.xl,
          borderTopRightRadius: BorderRadius.xl,
          maxHeight: '92%',
          overflow: 'hidden',
          backgroundColor: isDark ? 'rgba(28,28,30,0.82)' : 'rgba(255,255,255,0.82)',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -8 },
          shadowOpacity: isDark ? 0.45 : 0.15,
          shadowRadius: 24,
          elevation: 20,
        },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: Spacing.lg,
          paddingVertical: Spacing.md,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        headerTitle: {
          ...Typography.heading,
          color: colors.text,
          fontSize: 18,
        },
        closeButton: {
          padding: Spacing.xs,
        },
        content: {
          padding: Spacing.lg,
        },
        card: {
          backgroundColor: isDark ? 'rgba(44,44,46,0.55)' : 'rgba(245,245,247,0.60)',
          borderRadius: BorderRadius.lg,
          padding: Spacing.md,
          marginBottom: Spacing.lg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)',
          overflow: 'hidden',
        },
        cardHeader: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: Spacing.md,
          paddingBottom: Spacing.md,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.divider,
        },
        cardLabel: {
          ...Typography.caption,
          color: colors.textSecondary,
          fontSize: 11,
          fontWeight: '600',
          letterSpacing: 0.5,
          textTransform: 'uppercase',
        },
        iconRow: {
          flexDirection: 'row',
          gap: Spacing.xs,
        },
        iconButton: {
          padding: Spacing.xs,
          borderRadius: BorderRadius.md,
        },
        field: {
          marginBottom: Spacing.md,
        },
        fieldLabel: {
          ...Typography.caption,
          color: colors.textSecondary,
          fontSize: 12,
          marginBottom: Spacing.xs,
          fontWeight: '500',
        },
        recipientText: {
          ...Typography.body,
          color: colors.text,
          fontSize: 15,
          paddingVertical: Spacing.sm,
        },
        input: {
          backgroundColor: isDark ? 'rgba(58,58,60,0.50)' : 'rgba(255,255,255,0.55)',
          borderRadius: BorderRadius.md,
          padding: Spacing.md,
          ...Typography.body,
          color: colors.text,
          fontSize: 15,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
        },
        subjectInput: {
          fontWeight: '600',
        },
        bodyInput: {
          minHeight: 280,
          textAlignVertical: 'top',
          lineHeight: 22,
        },
        footer: {
          flexDirection: 'row',
          gap: Spacing.sm,
          padding: Spacing.lg,
          paddingBottom: Math.max(insets.bottom, Spacing.lg),
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
          backgroundColor: 'transparent',
        },
        sendButton: {
          flex: 1,
          backgroundColor: colors.primary,
          borderRadius: BorderRadius.lg,
          padding: Spacing.md,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: Spacing.sm,
          shadowColor: colors.primary,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 4,
        },
        sendButtonText: {
          ...Typography.body,
          color: '#FFFFFF',
          fontWeight: '600',
          fontSize: 16,
        },
      }),
    [colors, insets.bottom]
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        {/* 🔵 BLUR BACKGROUND EFFECT */}
        <BlurView
          style={styles.blurBackground}
          intensity={isDark ? 55 : 75}
          tint={isDark ? 'dark' : 'light'}
        />
        <View style={styles.blurOverlay} />

        {/* Tap outside to close */}
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 20 : 0}
        >
          <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Email Composer</Text>
              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.content}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.card}>
                <BlurView
                  intensity={isDark ? 20 : 30}
                  tint={isDark ? 'dark' : 'light'}
                  style={StyleSheet.absoluteFill}
                />
                {/* Card Header */}
                <View style={styles.cardHeader}>
                  <Text style={styles.cardLabel}>New Message</Text>
                  <View style={styles.iconRow}>
                    <TouchableOpacity
                      style={styles.iconButton}
                      onPress={handleCopyEmail}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name="copy-outline"
                        size={20}
                        color={colors.textSecondary}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.iconButton}
                      onPress={handleSendEmail}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name="mail-outline"
                        size={20}
                        color={colors.primary}
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Recipient */}
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>To</Text>
                  <Text style={styles.recipientText}>{RECIPIENT_EMAIL}</Text>
                </View>

                {/* Subject */}
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Subject</Text>
                  <TextInput
                    style={[styles.input, styles.subjectInput]}
                    value={subject}
                    onChangeText={setSubject}
                    placeholder="Email subject"
                    placeholderTextColor={colors.textSecondary}
                    multiline
                    maxLength={200}
                  />
                </View>

                {/* Body */}
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Message</Text>
                  <TextInput
                    style={[styles.input, styles.bodyInput]}
                    value={body}
                    onChangeText={setBody}
                    placeholder="Write your message..."
                    placeholderTextColor={colors.textSecondary}
                    multiline
                    textAlignVertical="top"
                  />
                </View>
              </View>
            </ScrollView>

            {/* Footer */}
            <View style={styles.footer}>
              <TouchableOpacity
                style={styles.sendButton}
                onPress={handleSendEmail}
                activeOpacity={0.8}
              >
                <Ionicons name="send" size={20} color="#FFFFFF" />
                <Text style={styles.sendButtonText}>Send Email</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
