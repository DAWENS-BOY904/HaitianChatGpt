import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, TextInput, ScrollView, Platform, Share, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAlert } from '@/template';

interface EmailComposerModalProps {
  visible: boolean;
  onClose: () => void;
  template?: 'support' | 'relations' | 'custom';
}

export function EmailComposerModal({ visible, onClose, template = 'support' }: EmailComposerModalProps) {
  const { colors } = useTheme();
  const { showAlert } = useAlert();
  const insets = useSafeAreaInsets();

  const [recipient, setRecipient] = useState('support@haitianchatgpt.com');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [showShareSheet, setShowShareSheet] = useState(false);

  const getTemplateContent = () => {
    switch (template) {
      case 'support':
        return {
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
[Your Name]`
        };
      case 'relations':
        return {
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
[Your Name]`
        };
      default:
        return {
          subject: '',
          body: ''
        };
    }
  };

  React.useEffect(() => {
    if (visible) {
      const templateContent = getTemplateContent();
      setSubject(templateContent.subject);
      setBody(templateContent.body);
    }
  }, [visible, template]);

  const handleCopyEmail = () => {
    const fullEmail = `To: ${recipient}\nSubject: ${subject}\n\n${body}`;
    // In a real app, copy to clipboard
    showAlert('Copied', 'Email template copied to clipboard');
  };

  const handleSendEmail = async () => {
    // Show native share sheet for email apps
    if (Platform.OS === 'web') {
      // Open mailto link on web
      const mailtoUrl = `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      Linking.openURL(mailtoUrl);
    } else {
      // Show share options on mobile
      try {
        await Share.share({
          message: `Subject: ${subject}\n\n${body}`,
          title: 'Send via Email',
        });
      } catch (error) {
        console.error('Share error:', error);
      }
    }
  };

  const styles = StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    container: {
      backgroundColor: colors.background,
      borderTopLeftRadius: BorderRadius.xl,
      borderTopRightRadius: BorderRadius.xl,
      maxHeight: '90%',
      paddingTop: Spacing.md,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.md,
      borderBottomWidth: 1,
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
    emailPreview: {
      backgroundColor: colors.card,
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      marginBottom: Spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    emailHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: Spacing.md,
      paddingBottom: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    emailLabel: {
      ...Typography.caption,
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: '600',
    },
    actions: {
      flexDirection: 'row',
      gap: Spacing.xs,
    },
    actionButton: {
      padding: Spacing.xs,
    },
    section: {
      marginBottom: Spacing.md,
    },
    sectionLabel: {
      ...Typography.caption,
      color: colors.textSecondary,
      fontSize: 12,
      marginBottom: Spacing.xs,
    },
    sectionContent: {
      ...Typography.body,
      color: colors.text,
      fontSize: 15,
      lineHeight: 22,
    },
    subjectInput: {
      backgroundColor: colors.surface,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      ...Typography.body,
      color: colors.text,
      fontSize: 15,
      fontWeight: '600',
      marginBottom: Spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    bodyInput: {
      backgroundColor: colors.surface,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      ...Typography.body,
      color: colors.text,
      fontSize: 14,
      lineHeight: 20,
      minHeight: 300,
      textAlignVertical: 'top',
      borderWidth: 1,
      borderColor: colors.border,
    },
    footer: {
      flexDirection: 'row',
      gap: Spacing.sm,
      padding: Spacing.lg,
      paddingBottom: Platform.select({
        ios: insets.bottom + Spacing.lg,
        android: Spacing.lg,
        default: Spacing.lg,
      }),
      borderTopWidth: 1,
      borderTopColor: colors.border,
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
    },
    sendButtonText: {
      ...Typography.body,
      color: '#FFFFFF',
      fontWeight: '600',
      fontSize: 16,
    },
    shareSheetContainer: {
      backgroundColor: colors.background,
      borderTopLeftRadius: BorderRadius.xl,
      borderTopRightRadius: BorderRadius.xl,
      padding: Spacing.lg,
      paddingBottom: Platform.select({
        ios: insets.bottom + Spacing.lg,
        android: Spacing.lg,
        default: Spacing.lg,
      }),
    },
    shareSheetTitle: {
      ...Typography.heading,
      color: colors.text,
      fontSize: 16,
      marginBottom: Spacing.md,
      textAlign: 'center',
    },
    shareOption: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: Spacing.md,
      borderRadius: BorderRadius.md,
      backgroundColor: colors.surface,
      marginBottom: Spacing.sm,
    },
    shareIcon: {
      width: 44,
      height: 44,
      borderRadius: BorderRadius.full,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: Spacing.md,
    },
    shareOptionText: {
      ...Typography.body,
      color: colors.text,
      fontSize: 16,
    },
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.container} onStartShouldSetResponder={() => true}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Email Composer</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content}>
            <View style={styles.emailPreview}>
              <View style={styles.emailHeader}>
                <Text style={styles.emailLabel}>Email</Text>
                <View style={styles.actions}>
                  <TouchableOpacity style={styles.actionButton} onPress={handleCopyEmail}>
                    <Ionicons name="copy-outline" size={20} color={colors.text} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionButton} onPress={handleSendEmail}>
                    <Ionicons name="mail-outline" size={20} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionLabel}>To</Text>
                <Text style={styles.sectionContent}>{recipient}</Text>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Subject</Text>
                <TextInput
                  style={styles.subjectInput}
                  value={subject}
                  onChangeText={setSubject}
                  placeholder="Email subject"
                  placeholderTextColor={colors.textSecondary}
                  multiline
                />
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Message</Text>
                <TextInput
                  style={styles.bodyInput}
                  value={body}
                  onChangeText={setBody}
                  placeholder="Email body"
                  placeholderTextColor={colors.textSecondary}
                  multiline
                />
              </View>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.sendButton}
              onPress={handleSendEmail}
            >
              <Ionicons name="send" size={20} color="#FFFFFF" />
              <Text style={styles.sendButtonText}>Send Email</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>

      {/* Share Sheet Modal */}
      <Modal
        visible={showShareSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowShareSheet(false)}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setShowShareSheet(false)}
        >
          <View style={styles.shareSheetContainer} onStartShouldSetResponder={() => true}>
            <Text style={styles.shareSheetTitle}>Open in</Text>

            <TouchableOpacity style={styles.shareOption}>
              <View style={[styles.shareIcon, { backgroundColor: '#007AFF' }]}>
                <Ionicons name="mail" size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.shareOptionText}>Mail</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.shareOption}>
              <View style={[styles.shareIcon, { backgroundColor: '#EA4335' }]}>
                <Ionicons name="logo-google" size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.shareOptionText}>Gmail</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </Modal>
  );
}
