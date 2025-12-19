import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Image,
} from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useAuth, useAlert } from '@/template';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSupabaseClient } from '@/template';
import * as Device from 'expo-device';
import { decode } from 'base64-arraybuffer';
import * as ImagePicker from 'expo-image-picker';

type BugType = 'ui-issue' | 'performance' | 'crash' | 'other' | null;

export default function BugReportScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const supabase = getSupabaseClient();
  const { screenshot: initialScreenshot } = useLocalSearchParams<{ screenshot?: string }>();

  const [bugType, setBugType] = useState<BugType>(null);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [screenshots, setScreenshots] = useState<string[]>(initialScreenshot ? [initialScreenshot] : []);

  const canSubmit = bugType !== null && description.trim().length > 0;

  const handleAddScreenshot = async () => {
    // Check if user is logged in
    if (!user) {
      showAlert(
        'Login Required',
        'Please log in to upload screenshots',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Log In', onPress: () => router.push('/login') }
        ]
      );
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setScreenshots(prev => [...prev, result.assets[0].uri]);
      }
    } catch (error) {
      console.error('Image picker error:', error);
    }
  };

  const handleRemoveScreenshot = (index: number) => {
    setScreenshots(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!canSubmit) {
      return;
    }

    setSubmitting(true);

    try {
      let uploadedScreenshots: string[] = [];

      // Upload screenshots if available
      if (screenshots.length > 0) {
        for (const screenshot of screenshots) {
          const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
          const filePath = `bug-reports/${user?.id || 'anonymous'}/${fileName}`;

          let uploadData: any;
          if (screenshot.startsWith('data:')) {
            const base64Data = screenshot.split(',')[1];
            uploadData = decode(base64Data);
          } else {
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
            uploadedScreenshots.push(urlData.publicUrl);
          }
        }
      }

      const deviceInfo = {
        brand: Device.brand,
        modelName: Device.modelName,
        osName: Device.osName,
        osVersion: Device.osVersion,
        platform: Platform.OS,
        bugType: bugType,
        screenshots: uploadedScreenshots,
      };

      const { error } = await supabase.from('bug_reports').insert({
        user_id: user?.id || null,
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
      alignItems: 'center',
    },
    backButton: {
      marginRight: Spacing.md,
    },
    headerTitle: {
      ...Typography.heading,
      color: colors.text,
      fontSize: 20,
      fontWeight: '600',
    },
    content: {
      flex: 1,
    },
    scrollContent: {
      padding: Spacing.lg,
    },
    section: {
      marginBottom: Spacing.xl,
    },
    sectionTitle: {
      ...Typography.heading,
      color: colors.text,
      fontSize: 22,
      fontWeight: '700',
      marginBottom: Spacing.xs,
    },
    sectionDescription: {
      ...Typography.body,
      color: colors.textSecondary,
      marginBottom: Spacing.lg,
      lineHeight: 20,
    },
    subtitle: {
      ...Typography.body,
      color: colors.text,
      fontSize: 16,
      fontWeight: '600',
      marginBottom: Spacing.md,
    },
    bugTypeGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.md,
    },
    bugTypeButton: {
      flex: 1,
      minWidth: '45%',
      backgroundColor: colors.surface,
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    bugTypeButtonActive: {
      borderColor: colors.primary,
      backgroundColor: `${colors.primary}10`,
    },
    bugTypeText: {
      ...Typography.body,
      color: colors.text,
      fontSize: 15,
      fontWeight: '500',
    },
    inputCard: {
      backgroundColor: colors.surface,
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      marginBottom: Spacing.md,
    },
    input: {
      ...Typography.body,
      color: colors.text,
      minHeight: 120,
      textAlignVertical: 'top',
      padding: 0,
    },
    screenshotSection: {
      marginBottom: Spacing.lg,
    },
    screenshotsPreview: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
      marginBottom: Spacing.md,
    },
    screenshotItem: {
      width: 80,
      height: 80,
      borderRadius: BorderRadius.md,
      position: 'relative',
    },
    screenshot: {
      width: '100%',
      height: '100%',
      borderRadius: BorderRadius.md,
    },
    removeButton: {
      position: 'absolute',
      top: -8,
      right: -8,
      backgroundColor: '#FF3B30',
      borderRadius: BorderRadius.full,
      width: 24,
      height: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      borderStyle: 'dashed',
      gap: Spacing.sm,
    },
    addButtonText: {
      ...Typography.body,
      color: colors.text,
      fontSize: 15,
      fontWeight: '500',
    },
    disclaimer: {
      ...Typography.caption,
      color: colors.textSecondary,
      lineHeight: 18,
      marginBottom: Spacing.xl,
    },
    submitButton: {
      backgroundColor: '#00A67E',
      borderRadius: BorderRadius.full,
      padding: Spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Platform.select({
        ios: insets.bottom + Spacing.md,
        android: Spacing.md,
      }),
    },
    submitButtonDisabled: {
      opacity: 0.3,
    },
    submitButtonText: {
      ...Typography.body,
      color: '#FFFFFF',
      fontWeight: '600',
      fontSize: 16,
    },
  });

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Report a Bug</Text>
      </View>

      {/* CONTENT */}
      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {/* TITLE SECTION */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Help us improve</Text>
          <Text style={styles.sectionDescription}>
            Found a bug? Let us know what went wrong and we will fix it as soon as possible.
          </Text>
        </View>

        {/* BUG TYPE */}
        <View style={styles.section}>
          <Text style={styles.subtitle}>Bug Type</Text>
          <View style={styles.bugTypeGrid}>
            <TouchableOpacity
              style={[styles.bugTypeButton, bugType === 'ui-issue' && styles.bugTypeButtonActive]}
              onPress={() => setBugType('ui-issue')}
            >
              <Ionicons name="color-palette" size={20} color={colors.text} />
              <Text style={styles.bugTypeText}>UI Issue</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.bugTypeButton, bugType === 'performance' && styles.bugTypeButtonActive]}
              onPress={() => setBugType('performance')}
            >
              <Ionicons name="speedometer" size={20} color={colors.text} />
              <Text style={styles.bugTypeText}>Performance</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.bugTypeButton, bugType === 'crash' && styles.bugTypeButtonActive]}
              onPress={() => setBugType('crash')}
            >
              <Ionicons name="warning" size={20} color={colors.text} />
              <Text style={styles.bugTypeText}>Crash</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.bugTypeButton, bugType === 'other' && styles.bugTypeButtonActive]}
              onPress={() => setBugType('other')}
            >
              <Ionicons name="help-circle" size={20} color={colors.text} />
              <Text style={styles.bugTypeText}>Other</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* DESCRIPTION */}
        <View style={styles.section}>
          <Text style={styles.subtitle}>Description (Optional)</Text>
          <View style={styles.inputCard}>
            <TextInput
              style={styles.input}
              placeholder="Describe the issue in detail..."
              placeholderTextColor={colors.textSecondary}
              value={description}
              onChangeText={setDescription}
              multiline
            />
          </View>
        </View>

        {/* SCREENSHOTS */}
        <View style={styles.screenshotSection}>
          <Text style={styles.subtitle}>Screenshots (Optional)</Text>

          {screenshots.length > 0 && (
            <View style={styles.screenshotsPreview}>
              {screenshots.map((uri, index) => (
                <View key={index} style={styles.screenshotItem}>
                  <Image source={{ uri }} style={styles.screenshot} resizeMode="cover" />
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => handleRemoveScreenshot(index)}
                  >
                    <Ionicons name="close" size={14} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          <TouchableOpacity style={styles.addButton} onPress={handleAddScreenshot}>
            <Ionicons name="camera" size={20} color={colors.text} />
            <Text style={styles.addButtonText}>Add Screenshot</Text>
          </TouchableOpacity>
        </View>

        {/* DISCLAIMER */}
        <Text style={styles.disclaimer}>
          Your report will include basic device information to help us debug the issue. We take your privacy seriously and only collect technical data.
        </Text>

        {/* SUBMIT BUTTON */}
        <TouchableOpacity
          style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit || submitting}
        >
          <Text style={styles.submitButtonText}>
            {submitting ? 'Sending...' : 'Submit Report'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
