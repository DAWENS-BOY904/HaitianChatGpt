import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Linking,
  KeyboardAvoidingView,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { useSettings } from '../hooks/useSettings';
import { useAuth } from '@/template';
import { getSupabaseClient } from '@/template';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';

const ISSUES = [
  { label: "Didn't fully follow instructions", icon: 'alert-circle-outline', detail: 'The response ignored or partially ignored your request.' },
  { label: 'Not factually correct', icon: 'close-circle-outline', detail: 'The response contained errors or inaccurate information.' },
  { label: 'Refused when it should not have', icon: 'ban-outline', detail: 'The AI declined a reasonable request.' },
  { label: 'Response was incomplete', icon: 'git-merge-outline', detail: 'The answer was cut off or missing key parts.' },
  { label: 'Harmful or unsafe content', icon: 'warning-outline', detail: 'The response included inappropriate content.' },
  { label: 'Other', icon: 'ellipsis-horizontal-circle-outline', detail: 'Something else went wrong.' },
];

export default function FeedbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ messageId?: string; conversationId?: string }>();
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const { settings } = useSettings();
  const { user } = useAuth();
  const supabase = getSupabaseClient();

  const accentColor = settings.accentColor || '#10A37F';
  const [selectedIssue, setSelectedIssue] = useState('');
  const [customText, setCustomText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [issueModalVisible, setIssueModalVisible] = useState(false);

  // Screenshot attachment
  const [screenshotUri, setScreenshotUri] = useState<string | null>(null);
  const [uploadingScreenshot, setUploadingScreenshot] = useState(false);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);

  const handlePickScreenshot = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });
      if (!result.canceled && result.assets.length > 0) {
        setScreenshotUri(result.assets[0].uri);
        setScreenshotUrl(null); // reset uploaded url
        Haptics.selectionAsync();
      }
    } catch (_e) {}
  };

  const uploadScreenshot = async (): Promise<string | null> => {
    if (!screenshotUri || !user?.id) return null;
    setUploadingScreenshot(true);
    try {
      const base64 = await FileSystem.readAsStringAsync(screenshotUri, { encoding: FileSystem.EncodingType.Base64 });
      const ext = screenshotUri.split('.').pop()?.toLowerCase() || 'jpg';
      const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
      const fileName = `${user.id}/feedback-${Date.now()}.${ext}`;
      const byteArray = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
      const { data, error } = await supabase.storage
        .from('chat-images')
        .upload(fileName, byteArray, { contentType: mimeType, upsert: false });
      if (error) return null;
      const { data: urlData } = supabase.storage.from('chat-images').getPublicUrl(fileName);
      return urlData?.publicUrl || null;
    } catch (_e) {
      return null;
    } finally {
      setUploadingScreenshot(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedIssue || submitting) return;
    setSubmitting(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      let imageUrl: string | null = screenshotUrl;
      if (screenshotUri && !screenshotUrl) {
        imageUrl = await uploadScreenshot();
        if (imageUrl) setScreenshotUrl(imageUrl);
      }
      if (user?.id) {
        await supabase.from('activity_logs').insert({
          user_id: user.id,
          action: 'dislike',
          action_type: 'message_feedback',
          details: {
            issue_category: selectedIssue,
            additional_text: customText || null,
            message_id: params.messageId || null,
            conversation_id: params.conversationId || null,
            screenshot_url: imageUrl || null,
          },
        });
      }
      setSubmitted(true);
      setTimeout(() => router.back(), 1400);
    } catch (_e) {
      setSubmitted(true);
      setTimeout(() => router.back(), 1400);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: accentColor, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="checkmark" size={38} color="#FFF" />
          </View>
          <Text style={{ color: '#FFF', fontSize: 22, fontWeight: '700' }}>Feedback submitted</Text>
          <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 15, textAlign: 'center', paddingHorizontal: 40 }}>
            Thank you! Your feedback helps us improve Haitian AI.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {/* Full-screen blur background */}
      <BlurView intensity={95} tint="dark" style={StyleSheet.absoluteFill} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.closeBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <BlurView intensity={60} tint="dark" style={styles.closeBtnBlur}>
                <Ionicons name="close" size={18} color="rgba(255,255,255,0.85)" />
              </BlurView>
            </TouchableOpacity>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={styles.headerTitle}>Share your feedback</Text>
              <Text style={styles.headerSub}>Help us improve Haitian AI</Text>
            </View>
            <View style={{ width: 40 }} />
          </View>

          {/* Thumbs-down icon */}
          <View style={styles.iconRow}>
            <View style={[styles.iconCircle, { borderColor: '#FF453A44' }]}>
              <BlurView intensity={50} tint="dark" style={styles.iconCircleBlur}>
                <Ionicons name="thumbs-down" size={28} color="#FF453A" />
              </BlurView>
            </View>
          </View>

          {/* Issue selector — triggers blur modal */}
          <Text style={styles.sectionLabel}>What was the issue?</Text>
          <TouchableOpacity
            style={styles.selectIssueBtn}
            onPress={() => setIssueModalVisible(true)}
            activeOpacity={0.75}
          >
            <BlurView intensity={55} tint="dark" style={styles.selectIssueBtnBlur}>
              <View style={{ flex: 1 }}>
                {selectedIssue ? (
                  <>
                    <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '600' }}>{selectedIssue}</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 }}>
                      {ISSUES.find(i => i.label === selectedIssue)?.detail || ''}
                    </Text>
                  </>
                ) : (
                  <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 15 }}>Select an issue...</Text>
                )}
              </View>
              <Ionicons name="chevron-down" size={18} color="rgba(255,255,255,0.4)" />
            </BlurView>
          </TouchableOpacity>

          {/* Screenshot attachment */}
          <Text style={[styles.sectionLabel, { marginTop: 24 }]}>Attach screenshot (optional)</Text>
          <View style={{ marginHorizontal: 16, marginBottom: 4 }}>
            {screenshotUri ? (
              <View style={{ position: 'relative', alignSelf: 'flex-start' }}>
                <ExpoImage
                  source={{ uri: screenshotUri }}
                  style={{ width: 120, height: 120, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' }}
                  contentFit="cover"
                />
                <TouchableOpacity
                  style={{ position: 'absolute', top: -8, right: -8, backgroundColor: '#FF453A', borderRadius: 14, width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#000' }}
                  onPress={() => { setScreenshotUri(null); setScreenshotUrl(null); }}
                >
                  <Ionicons name="close" size={15} color="#FFF" />
                </TouchableOpacity>
                {uploadingScreenshot ? (
                  <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}>
                    <ActivityIndicator color="#FFF" />
                  </View>
                ) : null}
              </View>
            ) : (
              <TouchableOpacity
                style={styles.screenshotPickerBtn}
                onPress={handlePickScreenshot}
                activeOpacity={0.75}
              >
                <BlurView intensity={45} tint="dark" style={styles.screenshotPickerBlur}>
                  <Ionicons name="image-outline" size={22} color="rgba(255,255,255,0.5)" />
                  <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '600', marginTop: 6 }}>Add screenshot</Text>
                </BlurView>
              </TouchableOpacity>
            )}
          </View>

          {/* Additional details */}
          <Text style={[styles.sectionLabel, { marginTop: 20 }]}>Additional details</Text>
          <View style={styles.textAreaWrap}>
            <BlurView intensity={50} tint="dark" style={styles.textAreaBlur}>
              <TextInput
                style={styles.textArea}
                placeholder="Describe the issue in more detail... (optional)"
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={customText}
                onChangeText={txt => { if (txt.length <= 2000) setCustomText(txt); }}
                multiline
                maxLength={2000}
              />
              <Text style={styles.charCount}>{customText.length}/2000</Text>
            </BlurView>
          </View>

          {/* Learn more */}
          <TouchableOpacity
            style={styles.learnMore}
            onPress={() => Linking.openURL('https://help.openai.com/en/articles/6825527-what-feedback-can-i-submit-in-chatgpt')}
          >
            <Ionicons name="open-outline" size={13} color={accentColor} />
            <Text style={[styles.learnMoreText, { color: accentColor }]}>Learn more about our feedback policy</Text>
          </TouchableOpacity>

          {/* Submit button */}
          <View style={styles.submitWrap}>
            <TouchableOpacity
              style={[
                styles.submitBtn,
                { backgroundColor: selectedIssue ? accentColor : 'rgba(255,255,255,0.1)' },
              ]}
              disabled={!selectedIssue || submitting}
              onPress={handleSubmit}
              activeOpacity={0.8}
            >
              {submitting ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={[styles.submitText, { color: selectedIssue ? '#FFF' : 'rgba(255,255,255,0.35)' }]}>
                  Submit feedback
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Issue picker — full-screen blur modal */}
      <Modal
        visible={issueModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIssueModalVisible(false)}
        statusBarTranslucent
      >
        <View style={{ flex: 1 }}>
          <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
          {/* Tap outside to close */}
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={() => setIssueModalVisible(false)}
          />
          {/* Sheet */}
          <View style={[styles.issueSheet, { paddingBottom: insets.bottom + 24 }]}>
            <BlurView intensity={85} tint="dark" style={styles.issueSheetBlur}>
              {/* Handle */}
              <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)', alignSelf: 'center', marginBottom: 18 }} />
              <Text style={styles.issueSheetTitle}>What was the issue?</Text>
              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 480 }}>
                {ISSUES.map((issue, i) => {
                  const isSelected = selectedIssue === issue.label;
                  return (
                    <TouchableOpacity
                      key={issue.label}
                      style={[
                        styles.issueRow,
                        i > 0 && styles.issueRowBorder,
                        isSelected && styles.issueRowSelected,
                      ]}
                      onPress={() => {
                        setSelectedIssue(issue.label);
                        Haptics.selectionAsync();
                        setTimeout(() => setIssueModalVisible(false), 120);
                      }}
                      activeOpacity={0.7}
                    >
                      {/* Left icon */}
                      <View style={[styles.issueIconWrap, isSelected && { backgroundColor: accentColor + '22', borderColor: accentColor + '55' }]}>
                        <Ionicons
                          name={issue.icon as any}
                          size={20}
                          color={isSelected ? accentColor : 'rgba(255,255,255,0.55)'}
                        />
                      </View>
                      {/* Text */}
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.issueLabel, isSelected && { color: '#FFF', fontWeight: '700' }]}>
                          {issue.label}
                        </Text>
                        <Text style={styles.issueSub}>{issue.detail}</Text>
                      </View>
                      {/* Checkmark */}
                      {isSelected ? (
                        <View style={[styles.checkCircle, { backgroundColor: accentColor }]}>
                          <Ionicons name="checkmark" size={13} color="#FFF" />
                        </View>
                      ) : (
                        <View style={styles.checkCircleEmpty} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              {/* Cancel */}
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setIssueModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </BlurView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  closeBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnBlur: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '700',
  },
  headerSub: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
    marginTop: 2,
  },
  iconRow: {
    alignItems: 'center',
    marginVertical: 20,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    overflow: 'hidden',
    borderWidth: 1.5,
  },
  iconCircleBlur: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginHorizontal: 20,
    marginBottom: 10,
  },
  selectIssueBtn: {
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  selectIssueBtnBlur: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  screenshotPickerBtn: {
    width: 120,
    height: 120,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.12)',
    borderStyle: 'dashed',
  },
  screenshotPickerBlur: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textAreaWrap: {
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  textAreaBlur: {
    borderRadius: 16,
    overflow: 'hidden',
    padding: 14,
  },
  textArea: {
    color: '#FFF',
    fontSize: 15,
    minHeight: 100,
    textAlignVertical: 'top',
    lineHeight: 22,
  },
  charCount: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 11,
    textAlign: 'right',
    marginTop: 6,
  },
  learnMore: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 16,
    marginHorizontal: 16,
  },
  learnMoreText: {
    fontSize: 13,
    fontWeight: '600',
  },
  submitWrap: {
    marginHorizontal: 16,
    marginTop: 24,
  },
  submitBtn: {
    borderRadius: 50,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitText: {
    fontSize: 17,
    fontWeight: '700',
  },
  // Issue modal sheet
  issueSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  issueSheetBlur: {
    padding: 20,
    paddingTop: 16,
  },
  issueSheetTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
  },
  issueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 14,
    gap: 14,
  },
  issueRowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  issueRowSelected: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
  },
  issueIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  issueLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 2,
  },
  issueSub: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 12,
    lineHeight: 16,
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleEmpty: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  cancelBtn: {
    marginTop: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 50,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  cancelBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
