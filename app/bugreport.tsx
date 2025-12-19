import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Image,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useAuth, useAlert } from '@/template';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSupabaseClient } from '@/template';
import * as Device from 'expo-device';
import { decode } from 'base64-arraybuffer';

export default function BugReportScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const supabase = getSupabaseClient();
  const { screenshot: initialScreenshot } = useLocalSearchParams<{ screenshot?: string }>();

  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [screenshot, setScreenshot] = useState<string | null>(initialScreenshot || null);
  const [includeScreenshot, setIncludeScreenshot] = useState(true);
  const [shakeEnabled, setShakeEnabled] = useState(true);

  const canSubmit = description.trim().length > 0;

  const handleSubmit = async () => {
    if (!canSubmit) {
      return;
    }

    setSubmitting(true);

    try {
      let uploadedScreenshotUrl = '';

      // Upload screenshot if enabled and available
      if (includeScreenshot && screenshot) {
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
        const filePath = `bug-reports/${user?.id}/${fileName}`;

        // Convert base64 to blob if needed
        let uploadData: any;
        if (screenshot.startsWith('data:')) {
          const base64Data = screenshot.split(',')[1];
          uploadData = decode(base64Data);
        } else {
          // Fetch the file if it's a file URI
          const response = await fetch(screenshot);
          const blob = await response.blob();
          uploadData = blob;
        }

        const { error: uploadError } = await supabase.storage
          .from('chat-images')
          .upload(filePath, uploadData, {
            contentType: 'image/jpeg',
          });

        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from('chat-images')
            .getPublicUrl(filePath);
          uploadedScreenshotUrl = urlData.publicUrl;
        }
      }

      const deviceInfo = {
        brand: Device.brand,
        modelName: Device.modelName,
        osName: Device.osName,
        osVersion: Device.osVersion,
        platform: Platform.OS,
        screenshot: uploadedScreenshotUrl || null,
      };

      const { error } = await supabase.from('bug_reports').insert({
        user_id: user?.id,
        description: description,
        device_info: deviceInfo,
        status: 'pending',
      });

      setSubmitting(false);

      if (error) {
        showAlert('Error', 'Failed to submit bug report');
      } else {
        showAlert('Success', 'Bug report submitted. Thank you for your feedback!');
        router.back();
      }
    } catch (error) {
      console.error('Bug report error:', error);
      setSubmitting(false);
      showAlert('Error', 'Failed to submit bug report');
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      paddingTop: Platform.select({
        ios: insets.top + 10,
        android: insets.top + 10,
      }),
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.md,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    headerTitle: {
      ...Typography.heading,
      color: colors.text,
      fontSize: 20,
    },
    closeButton: {
      padding: Spacing.xs,
    },
    content: {
      flex: 1,
    },
    scrollContent: {
      padding: Spacing.lg,
    },
    sectionTitle: {
      ...Typography.heading,
      color: colors.text,
      fontSize: 18,
      marginBottom: Spacing.xs,
    },
    sectionSubtitle: {
      ...Typography.body,
      color: colors.textSecondary,
      marginBottom: Spacing.lg,
    },
    screenshotContainer: {
      backgroundColor: colors.surface,
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      marginBottom: Spacing.lg,
      alignItems: 'center',
    },
    screenshot: {
      width: '100%',
      height: 200,
      borderRadius: BorderRadius.md,
      marginBottom: Spacing.md,
    },
    screenshotLabel: {
      ...Typography.caption,
      color: colors.textSecondary,
    },
    inputCard: {
      backgroundColor: colors.surface,
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      marginBottom: Spacing.lg,
    },
    input: {
      ...Typography.body,
      color: colors.text,
      minHeight: 150,
      textAlignVertical: 'top',
      padding: 0,
    },
    charCount: {
      ...Typography.caption,
      color: colors.textSecondary,
      textAlign: 'right',
      marginTop: Spacing.sm,
    },
    disclaimer: {
      ...Typography.caption,
      color: colors.textSecondary,
      lineHeight: 18,
      marginBottom: Spacing.sm,
    },
    link: {
      color: colors.primary,
      textDecorationLine: 'underline',
    },
    settingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.surface,
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      marginBottom: Spacing.sm,
    },
    settingLeft: {
      flex: 1,
      marginRight: Spacing.md,
    },
    settingTitle: {
      ...Typography.body,
      color: colors.text,
      fontWeight: '600',
      marginBottom: 4,
    },
    settingDescription: {
      ...Typography.caption,
      color: colors.textSecondary,
    },
    bottomBar: {
      padding: Spacing.lg,
      paddingBottom: Platform.select({
        ios: insets.bottom + Spacing.lg,
        android: Spacing.lg,
      }),
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    sendButton: {
      backgroundColor: colors.text,
      borderRadius: BorderRadius.full,
      padding: Spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendButtonDisabled: {
      opacity: 0.3,
    },
    sendButtonText: {
      ...Typography.body,
      color: colors.background,
      fontWeight: '600',
      fontSize: 16,
    },
  });

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Report bug</Text>
        <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
          <Ionicons name="close" size={28} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* CONTENT */}
      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.sectionTitle}>What happened?</Text>

        {/* SCREENSHOT PREVIEW */}
        {screenshot && includeScreenshot && (
          <View style={styles.screenshotContainer}>
            <Image source={{ uri: screenshot }} style={styles.screenshot} resizeMode="contain" />
            <Text style={styles.screenshotLabel}>Attached screenshot</Text>
          </View>
        )}

        {/* DESCRIPTION INPUT */}
        <View style={styles.inputCard}>
          <TextInput
            style={styles.input}
            placeholder="Tell us about the issue you encountered"
            placeholderTextColor={colors.textSecondary}
            value={description}
            onChangeText={setDescription}
            multiline
            maxLength={2000}
          />
          <Text style={styles.charCount}>{description.length} / 2000</Text>
        </View>

        {/* DISCLAIMER */}
        <Text style={styles.disclaimer}>
          Any information you share may be reviewed to help improve ChatGPT. If you have additional
          questions, <Text style={styles.link}>contact support</Text>.
        </Text>

        {/* SETTINGS */}
        <View style={styles.settingRow}>
          <View style={styles.settingLeft}>
            <Text style={styles.settingTitle}>Include screenshot in report</Text>
          </View>
          <Switch
            value={includeScreenshot}
            onValueChange={setIncludeScreenshot}
            trackColor={{ true: colors.primary, false: colors.border }}
            ios_backgroundColor={colors.border}
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingLeft}>
            <Text style={styles.settingTitle}>Shake iPhone to report a bug</Text>
            <Text style={styles.settingDescription}>Toggle off to disable</Text>
          </View>
          <Switch
            value={shakeEnabled}
            onValueChange={setShakeEnabled}
            trackColor={{ true: colors.primary, false: colors.border }}
            ios_backgroundColor={colors.border}
          />
        </View>
      </ScrollView>

      {/* SEND BUTTON */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.sendButton, !canSubmit && styles.sendButtonDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit || submitting}
        >
          <Text style={styles.sendButtonText}>{submitting ? 'Sending...' : 'Send'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
