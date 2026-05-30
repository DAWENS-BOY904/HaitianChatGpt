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
  template?: 'support' | 'relations' | 'custom' | 'ai_prompt';
  /** AI-generated prompt/message passed directly from chat */
  aiContent?: {
    subject?: string;
    body: string;
    title?: string;
  };
}

// --- Constants ---
const RECIPIENT_EMAIL = 'support@haitianchatgpt.com';

const TEMPLATES: Record<string, { subject: string; body: string }> = {
  ai_prompt: {
    subject: '',
    body: '',
  },
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
  aiContent,
}: EmailComposerModalProps) {
  const { colors, isDark } = useTheme();
  const { showAlert } = useAlert();
  const insets = useSafeAreaInsets();

  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  const [modalTitle, setModalTitle] = useState('Email Composer');

  // Reset fields when modal opens with new template or AI content
  React.useEffect(() => {
    if (visible) {
      if (template === 'ai_prompt' && aiContent) {
        setSubject(aiContent.subject || 'AI Generated Prompt');
        setBody(aiContent.body);
        setModalTitle(aiContent.title || 'Beautiful Prompt');
      } else {
        const t = TEMPLATES[template] || TEMPLATES['support'];
        setSubject(t.subject);
        setBody(t.body);
        setModalTitle('Email Composer');
      }
    }
  }, [visible, template, aiContent]);

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
        container: {
          backgroundColor: colors.background,
          borderTopLeftRadius: BorderRadius.xl,
          borderTopRightRadius: BorderRadius.xl,
          maxHeight: '92%',
          overflow: 'hidden',
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
          backgroundColor: colors.card,
          borderRadius: BorderRadius.lg,
          padding: Spacing.md,
          marginBottom: Spacing.lg,
          borderWidth: 1,
          borderColor: colors.border,
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
          backgroundColor: colors.surface,
          borderRadius: BorderRadius.md,
          padding: Spacing.md,
          ...Typography.body,
          color: colors.text,
          fontSize: 15,
          borderWidth: 1,
          borderColor: colors.border,
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
          borderTopColor: colors.border,
          backgroundColor: colors.background,
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
          intensity={isDark ? 40 : 60}
          tint={isDark ? 'dark' : 'light'}
        />

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
              <Text style={styles.headerTitle}>{modalTitle}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {template === 'ai_prompt' ? (
                  <TouchableOpacity
                    style={[styles.closeButton, { backgroundColor: colors.primary + '18', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6 }]}
                    onPress={handleCopyEmail}
                    activeOpacity={0.7}
                  >
                    <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '700' }}>Copy</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView
              style={styles.content}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {template === 'ai_prompt' ? (
                /* ── AI Prompt display card ── */
                <View style={[styles.card, { borderColor: colors.primary + '35', borderWidth: 1.5 }]}>
                  <View style={[styles.cardHeader, { borderBottomColor: colors.primary + '22' }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primary + '20', alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="sparkles" size={14} color={colors.primary} />
                      </View>
                      <Text style={[styles.cardLabel, { color: colors.primary, letterSpacing: 0 }]}>AI Generated Prompt</Text>
                    </View>
                    <View style={styles.iconRow}>
                      <TouchableOpacity style={styles.iconButton} onPress={handleCopyEmail} activeOpacity={0.7}>
                        <Ionicons name="copy-outline" size={20} color={colors.textSecondary} />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.iconButton} onPress={handleSendEmail} activeOpacity={0.7}>
                        <Ionicons name="share-outline" size={20} color={colors.primary} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  {/* Prompt title/subject */}
                  {subject ? (
                    <View style={styles.field}>
                      <Text style={styles.fieldLabel}>Title</Text>
                      <TextInput
                        style={[styles.input, styles.subjectInput, { backgroundColor: colors.primary + '08' }]}
                        value={subject}
                        onChangeText={setSubject}
                        placeholder="Prompt title..."
                        placeholderTextColor={colors.textSecondary}
                        multiline
                        maxLength={200}
                      />
                    </View>
                  ) : null}
                  {/* Prompt body */}
                  <View style={styles.field}>
                    <Text style={styles.fieldLabel}>Prompt Content</Text>
                    <TextInput
                      style={[styles.input, styles.bodyInput, { backgroundColor: colors.primary + '06', minHeight: 220 }]}
                      value={body}
                      onChangeText={setBody}
                      placeholder="Your AI prompt will appear here..."
                      placeholderTextColor={colors.textSecondary}
                      multiline
                      textAlignVertical="top"
                    />
                  </View>
                </View>
              ) : (
              <View style={styles.card}>
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
              )}
            </ScrollView>

            {/* Footer */}
            <View style={styles.footer}>
              {template === 'ai_prompt' ? (
                <>
                  <TouchableOpacity
                    style={[styles.sendButton, { flex: 0.5, backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)' }]}
                    onPress={handleCopyEmail}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="copy-outline" size={18} color={colors.text} />
                    <Text style={[styles.sendButtonText, { color: colors.text }]}>Copy</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.sendButton}
                    onPress={handleSendEmail}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="share-outline" size={20} color="#FFFFFF" />
                    <Text style={styles.sendButtonText}>Share Prompt</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={styles.sendButton}
                  onPress={handleSendEmail}
                  activeOpacity={0.8}
                >
                  <Ionicons name="send" size={20} color="#FFFFFF" />
                  <Text style={styles.sendButtonText}>Send Email</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
