import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Platform, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useAuth, useAlert } from '@/template';
import { useRouter } from 'expo-router';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSupabaseClient } from '@/template';
import * as Device from 'expo-device';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';

export default function BugReportScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const supabase = getSupabaseClient();

  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [screenshots, setScreenshots] = useState<any[]>([]);
  const [selectedBugType, setSelectedBugType] = useState<string>('');

  const bugTypes = [
    { id: 'ui', label: 'UI Issue', icon: 'color-palette' },
    { id: 'performance', label: 'Performance', icon: 'speedometer' },
    { id: 'crash', label: 'Crash', icon: 'warning' },
    { id: 'other', label: 'Other', icon: 'help-circle' },
  ];

  const handlePickScreenshot = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showAlert('Permission needed', 'Please grant photo library access to attach screenshots');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets.length > 0) {
      setScreenshots([...screenshots, ...result.assets]);
    }
  };

  const handleRemoveScreenshot = (index: number) => {
    setScreenshots(screenshots.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!description.trim() && screenshots.length === 0) {
      showAlert('Error', 'Please describe the issue or attach a screenshot');
      return;
    }

    if (!selectedBugType) {
      showAlert('Error', 'Please select a bug type');
      return;
    }

    setSubmitting(true);

    try {
      // Upload screenshots if any
      const uploadedUrls: string[] = [];
      
      for (const screenshot of screenshots) {
        if (screenshot.base64) {
          const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
          const filePath = `bug-reports/${user?.id}/${fileName}`;
          
          const { error: uploadError } = await supabase.storage
            .from('chat-images')
            .upload(filePath, decode(screenshot.base64), {
              contentType: 'image/jpeg',
            });

          if (!uploadError) {
            const { data: urlData } = supabase.storage
              .from('chat-images')
              .getPublicUrl(filePath);
            uploadedUrls.push(urlData.publicUrl);
          }
        }
      }

      const deviceInfo = {
        brand: Device.brand,
        modelName: Device.modelName,
        osName: Device.osName,
        osVersion: Device.osVersion,
        platform: Platform.OS,
        bugType: selectedBugType,
        screenshots: uploadedUrls,
      };

      const { error } = await supabase
        .from('bug_reports')
        .insert({
          user_id: user?.id,
          description: description || 'See attached screenshots',
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
      flex: 1,
      padding: Spacing.md,
    },
    title: {
      ...Typography.title,
      color: colors.text,
      marginBottom: Spacing.sm,
    },
    subtitle: {
      ...Typography.body,
      color: colors.textSecondary,
      marginBottom: Spacing.lg,
    },
    section: {
      marginBottom: Spacing.lg,
    },
    sectionTitle: {
      ...Typography.heading,
      color: colors.text,
      fontSize: 16,
      marginBottom: Spacing.sm,
    },
    bugTypeGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
    },
    bugTypeButton: {
      flex: 1,
      minWidth: '45%',
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      backgroundColor: colors.surface,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    bugTypeButtonSelected: {
      borderColor: colors.primary,
      backgroundColor: `${colors.primary}20`,
    },
    bugTypeText: {
      ...Typography.body,
      color: colors.text,
      fontSize: 14,
    },
    input: {
      backgroundColor: colors.inputBackground,
      borderRadius: BorderRadius.sm,
      padding: Spacing.md,
      ...Typography.body,
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.border,
      minHeight: 120,
      textAlignVertical: 'top',
      marginBottom: Spacing.md,
    },
    screenshotsContainer: {
      marginBottom: Spacing.lg,
    },
    screenshotGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
      marginBottom: Spacing.sm,
    },
    screenshotItem: {
      width: 100,
      height: 100,
      borderRadius: BorderRadius.sm,
      position: 'relative',
      overflow: 'hidden',
    },
    screenshot: {
      width: '100%',
      height: '100%',
    },
    removeScreenshotButton: {
      position: 'absolute',
      top: 4,
      right: 4,
      backgroundColor: '#FF3B30',
      borderRadius: BorderRadius.full,
      width: 24,
      height: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addScreenshotButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.xs,
      backgroundColor: colors.surface,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      borderStyle: 'dashed',
    },
    addScreenshotText: {
      ...Typography.body,
      color: colors.text,
    },
    infoBox: {
      backgroundColor: colors.surface,
      borderRadius: BorderRadius.sm,
      padding: Spacing.md,
      marginBottom: Spacing.lg,
    },
    infoText: {
      ...Typography.caption,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    submitButton: {
      backgroundColor: colors.primary,
      borderRadius: BorderRadius.sm,
      padding: Spacing.md,
      alignItems: 'center',
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    buttonText: {
      ...Typography.body,
      color: '#FFFFFF',
      fontWeight: '600',
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Report a Bug</Text>
      </View>

      <ScrollView style={styles.content}>
        <Text style={styles.title}>Help us improve</Text>
        <Text style={styles.subtitle}>
          Found a bug? Let us know what went wrong and we will fix it as soon as possible.
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bug Type</Text>
          <View style={styles.bugTypeGrid}>
            {bugTypes.map(type => (
              <TouchableOpacity
                key={type.id}
                style={[
                  styles.bugTypeButton,
                  selectedBugType === type.id && styles.bugTypeButtonSelected,
                ]}
                onPress={() => setSelectedBugType(type.id)}
              >
                <Ionicons
                  name={type.icon as any}
                  size={20}
                  color={selectedBugType === type.id ? colors.primary : colors.text}
                />
                <Text style={styles.bugTypeText}>{type.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Description (Optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="Describe the issue in detail..."
            placeholderTextColor={colors.textSecondary}
            value={description}
            onChangeText={setDescription}
            multiline
          />
        </View>

        <View style={styles.screenshotsContainer}>
          <Text style={styles.sectionTitle}>Screenshots (Optional)</Text>
          
          <View style={styles.screenshotGrid}>
            {screenshots.map((screenshot, index) => (
              <View key={index} style={styles.screenshotItem}>
                <Image source={{ uri: screenshot.uri }} style={styles.screenshot} />
                <TouchableOpacity
                  style={styles.removeScreenshotButton}
                  onPress={() => handleRemoveScreenshot(index)}
                >
                  <Ionicons name="close" size={14} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={styles.addScreenshotButton}
            onPress={handlePickScreenshot}
          >
            <Ionicons name="camera-outline" size={20} color={colors.text} />
            <Text style={styles.addScreenshotText}>Add Screenshot</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            Your report will include basic device information to help us debug the issue. 
            We take your privacy seriously and only collect technical data.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          <Text style={styles.buttonText}>
            {submitting ? 'Submitting...' : 'Submit Report'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
