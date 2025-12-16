import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useAuth, useAlert } from '@/template';
import { useRouter } from 'expo-router';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSupabaseClient } from '@/template';
import * as Device from 'expo-device';
import { Accelerometer } from 'expo-sensors';

export default function BugReportScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const supabase = getSupabaseClient();

  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Set up shake detection
    const subscription = Accelerometer.addListener(accelerometerData => {
      const { x, y, z } = accelerometerData;
      const acceleration = Math.sqrt(x * x + y * y + z * z);
      
      if (acceleration > 2.5) {
        // Shake detected - this screen is already open
      }
    });

    Accelerometer.setUpdateInterval(100);

    return () => subscription.remove();
  }, []);

  const handleSubmit = async () => {
    if (!description.trim()) {
      showAlert('Error', 'Please describe the issue');
      return;
    }

    setSubmitting(true);

    const deviceInfo = {
      brand: Device.brand,
      modelName: Device.modelName,
      osName: Device.osName,
      osVersion: Device.osVersion,
      platform: Platform.OS,
    };

    const { error } = await supabase
      .from('bug_reports')
      .insert({
        user_id: user?.id,
        description,
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
    input: {
      backgroundColor: colors.inputBackground,
      borderRadius: BorderRadius.sm,
      padding: Spacing.md,
      ...Typography.body,
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.border,
      minHeight: 200,
      textAlignVertical: 'top',
      marginBottom: Spacing.md,
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

        <TextInput
          style={styles.input}
          placeholder="Describe the issue in detail..."
          placeholderTextColor={colors.textSecondary}
          value={description}
          onChangeText={setDescription}
          multiline
          autoFocus
        />

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
