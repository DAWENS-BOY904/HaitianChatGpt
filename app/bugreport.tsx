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
import { useRouter } from 'expo-router';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSupabaseClient } from '@/template';
import * as Device from 'expo-device';
import { Accelerometer } from 'expo-sensors';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SHAKE_PREF_KEY = 'shake_bug_report_enabled';

export default function BugReportScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const supabase = getSupabaseClient();

  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [includeScreenshot, setIncludeScreenshot] = useState(true);
  const [shakeEnabled, setShakeEnabled] = useState(true);

  const canSubmit = description.trim().length > 0;

  /* ---------------- LOAD SHAKE PREF ---------------- */
  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem(SHAKE_PREF_KEY);
      if (saved !== null) {
        setShakeEnabled(JSON.parse(saved));
      }
    })();
  }, []);

  /* ---------------- SAVE SHAKE PREF ---------------- */
  useEffect(() => {
    AsyncStorage.setItem(SHAKE_PREF_KEY, JSON.stringify(shakeEnabled));
  }, [shakeEnabled]);

  /* ---------------- AUTO SCREENSHOT ---------------- */
  const takeScreenshot = async () => {
    try {
      const ref = (global as any).__APP_SCREENSHOT_REF__;
      if (ref) {
        const uri = await ref.capture();
        setScreenshot(uri);
        setIncludeScreenshot(true);
      }
    } catch (e) {
      console.log('Screenshot failed', e);
    }
  };

  /* ---------------- SHAKE LISTENER ---------------- */
  useEffect(() => {
    let subscription: any = null;

    if (shakeEnabled) {
      Accelerometer.setUpdateInterval(300);

      subscription = Accelerometer.addListener(({ x, y, z }) => {
        const force = Math.abs(x) + Math.abs(y) + Math.abs(z);
        if (force > 2.3) {
          takeScreenshot();
          router.push('/bug-report');
        }
      });
    }

    return () => {
      if (subscription) subscription.remove();
    };
  }, [shakeEnabled]);

  /* ---------------- TOGGLE SCREENSHOT ---------------- */
  useEffect(() => {
    if (includeScreenshot && !screenshot) {
      takeScreenshot();
    }

    if (!includeScreenshot) {
      setScreenshot(null);
    }
  }, [includeScreenshot]);

  /* ---------------- SUBMIT ---------------- */
  const handleSubmit = async () => {
    if (!canSubmit) return;

    setSubmitting(true);

    try {
      let screenshotUrl: string | null = null;

      if (includeScreenshot && screenshot) {
        const filePath = `bug-reports/${user?.id}/${Date.now()}.jpg`;
        const response = await fetch(screenshot);
        const blob = await response.blob();

        const { error } = await supabase.storage
          .from('chat-images')
          .upload(filePath, blob, {
            contentType: 'image/jpeg',
          });

        if (!error) {
          screenshotUrl = supabase.storage
            .from('chat-images')
            .getPublicUrl(filePath).data.publicUrl;
        }
      }

      await supabase.from('bug_reports').insert({
        user_id: user?.id,
        description,
        screenshot: screenshotUrl,
        device_info: {
          brand: Device.brand,
          model: Device.modelName,
          os: Device.osName,
          osVersion: Device.osVersion,
          platform: Platform.OS,
        },
        status: 'pending',
      });

      showAlert('Success', 'Bug report submitted');
      router.back();
    } catch (e) {
      showAlert('Error', 'Failed to submit bug report');
    } finally {
      setSubmitting(false);
    }
  };

  /* ---------------- UI ---------------- */
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* HEADER */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Report bug
        </Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close" size={28} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* CONTENT */}
      <ScrollView contentContainerStyle={styles.content}>
        {/* SCREENSHOT */}
        {includeScreenshot && screenshot && (
          <View style={styles.screenshotContainer}>
            <Image
              source={{ uri: screenshot }}
              style={styles.screenshot}
              resizeMode="contain"
            />
            <Text style={styles.screenshotLabel}>
              Attached screenshot
            </Text>
          </View>
        )}

        {/* DESCRIPTION */}
        <View style={styles.inputCard}>
          <TextInput
            style={[styles.input, { color: colors.text }]}
            placeholder="What happened?"
            placeholderTextColor={colors.textSecondary}
            value={description}
            onChangeText={setDescription}
            multiline
            maxLength={2000}
          />
          <Text style={styles.charCount}>
            {description.length} / 2000
          </Text>
        </View>

        {/* SETTINGS */}
        <View style={styles.settingRow}>
          <Text style={styles.settingTitle}>
            Include screenshot in report
          </Text>
          <Switch
            value={includeScreenshot}
            onValueChange={setIncludeScreenshot}
          />
        </View>

        <View style={styles.settingRow}>
          <View>
            <Text style={styles.settingTitle}>
              Shake iPhone to report a bug
            </Text>
            <Text style={styles.settingDescription}>
              Toggle off to disable
            </Text>
          </View>
          <Switch
            value={shakeEnabled}
            onValueChange={setShakeEnabled}
          />
        </View>
      </ScrollView>

      {/* SEND */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[
            styles.sendButton,
            (!canSubmit || submitting) && styles.sendButtonDisabled,
          ]}
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

/* ---------------- STYLES ---------------- */
const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    ...Typography.heading,
    fontSize: 20,
  },
  content: {
    padding: Spacing.lg,
  },
  screenshotContainer: {
    backgroundColor: '#f2f2f2',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    alignItems: 'center',
  },
  screenshot: {
    width: '100%',
    height: 220,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  screenshotLabel: {
    ...Typography.caption,
  },
  inputCard: {
    backgroundColor: '#f2f2f2',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  input: {
    ...Typography.body,
    minHeight: 150,
    textAlignVertical: 'top',
  },
  charCount: {
    ...Typography.caption,
    textAlign: 'right',
    marginTop: Spacing.sm,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  settingTitle: {
    ...Typography.body,
    fontWeight: '600',
  },
  settingDescription: {
    ...Typography.caption,
  },
  bottomBar: {
    padding: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  sendButton: {
    backgroundColor: '#000',
    borderRadius: BorderRadius.full,
    padding: Spacing.md,
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.3,
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});
