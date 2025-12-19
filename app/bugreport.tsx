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
import { Accelerometer } from 'expo-sensors';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SHAKE_KEY = 'shake_bug_report_enabled';

export default function BugReportScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const supabase = getSupabaseClient();
  const { screenshot: initialScreenshot } =
    useLocalSearchParams<{ screenshot?: string }>();

  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [screenshot, setScreenshot] = useState<string | null>(
    initialScreenshot || null
  );
  const [includeScreenshot, setIncludeScreenshot] = useState(true);
  const [shakeEnabled, setShakeEnabled] = useState(true);

  const canSubmit = description.trim().length > 0;

  /* ---------------- LOAD SHAKE PREF ---------------- */
  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem(SHAKE_KEY);
      if (saved !== null) {
        setShakeEnabled(JSON.parse(saved));
      }
    })();
  }, []);

  /* ---------------- SAVE SHAKE PREF ---------------- */
  useEffect(() => {
    AsyncStorage.setItem(SHAKE_KEY, JSON.stringify(shakeEnabled));
  }, [shakeEnabled]);

  /* ---------------- SHAKE LISTENER ---------------- */
  useEffect(() => {
    let subscription: any = null;

    if (shakeEnabled) {
      Accelerometer.setUpdateInterval(300);

      subscription = Accelerometer.addListener(({ x, y, z }) => {
        const force = Math.abs(x) + Math.abs(y) + Math.abs(z);

        if (force > 2.3) {
          router.push('/bug-report');
        }
      });
    }

    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
  }, [shakeEnabled]);

  /* ---------------- SUBMIT ---------------- */
  const handleSubmit = async () => {
    if (!canSubmit) return;

    setSubmitting(true);

    try {
      let uploadedScreenshotUrl = '';

      if (includeScreenshot && screenshot) {
        const fileName = `${Date.now()}_${Math.random()
          .toString(36)
          .substring(7)}.jpg`;
        const filePath = `bug-reports/${user?.id}/${fileName}`;

        let uploadData: any;

        if (screenshot.startsWith('data:')) {
          uploadData = decode(screenshot.split(',')[1]);
        } else {
          const response = await fetch(screenshot);
          uploadData = await response.blob();
        }

        const { error: uploadError } = await supabase.storage
          .from('chat-images')
          .upload(filePath, uploadData, {
            contentType: 'image/jpeg',
          });

        if (!uploadError) {
          const { data } = supabase.storage
            .from('chat-images')
            .getPublicUrl(filePath);
          uploadedScreenshotUrl = data.publicUrl;
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
        description,
        device_info: deviceInfo,
        status: 'pending',
      });

      setSubmitting(false);

      if (error) {
        showAlert('Error', 'Failed to submit bug report');
      } else {
        showAlert('Success', 'Bug report submitted. Thank you!');
        router.back();
      }
    } catch (e) {
      setSubmitting(false);
      showAlert('Error', 'Failed to submit bug report');
    }
  };

  /* ---------------- STYLES ---------------- */
  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingTop: insets.top + 10,
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
    content: { flex: 1 },
    scrollContent: { padding: Spacing.lg },
    sectionTitle: {
      ...Typography.heading,
      color: colors.text,
      fontSize: 18,
      marginBottom: Spacing.xs,
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
    },
    settingRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      backgroundColor: colors.surface,
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      marginBottom: Spacing.sm,
    },
    settingTitle: {
      ...Typography.body,
      color: colors.text,
      fontWeight: '600',
    },
    settingDescription: {
      ...Typography.caption,
      color: colors.textSecondary,
    },
    bottomBar: {
      padding: Spacing.lg,
      paddingBottom: insets.bottom + Spacing.lg,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    sendButton: {
      backgroundColor: colors.text,
      borderRadius: BorderRadius.full,
      padding: Spacing.md,
      alignItems: 'center',
    },
    sendButtonDisabled: { opacity: 0.3 },
    sendButtonText: {
      ...Typography.body,
      color: colors.background,
      fontWeight: '600',
    },
  });

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Report bug</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close" size={28} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* CONTENT */}
      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.sectionTitle}>What happened?</Text>

        {screenshot && includeScreenshot && (
          <View style={styles.screenshotContainer}>
            <Image source={{ uri: screenshot }} style={styles.screenshot} />
            <Text>Attached screenshot</Text>
          </View>
        )}

        <View style={styles.inputCard}>
          <TextInput
            style={styles.input}
            placeholder="Describe the issue"
            placeholderTextColor={colors.textSecondary}
            value={description}
            onChangeText={setDescription}
            multiline
            maxLength={2000}
          />
        </View>

        <View style={styles.settingRow}>
          <Text style={styles.settingTitle}>Include screenshot</Text>
          <Switch
            value={includeScreenshot}
            onValueChange={setIncludeScreenshot}
          />
        </View>

        <View style={styles.settingRow}>
          <View>
            <Text style={styles.settingTitle}>Shake to report bug</Text>
            <Text style={styles.settingDescription}>Disable to turn off</Text>
          </View>
          <Switch value={shakeEnabled} onValueChange={setShakeEnabled} />
        </View>
      </ScrollView>

      {/* SEND */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.sendButton, !canSubmit && styles.sendButtonDisabled]}
          disabled={!canSubmit || submitting}
          onPress={handleSubmit}
        >
          <Text style={styles.sendButtonText}>
            {submitting ? 'Sending...' : 'Send'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
