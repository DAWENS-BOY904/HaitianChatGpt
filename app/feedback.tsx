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
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { useSettings } from '../hooks/useSettings';
import { useAuth } from '@/template';
import { getSupabaseClient } from '@/template';
import * as Haptics from 'expo-haptics';

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

  const handleSubmit = async () => {
    if (!selectedIssue || submitting) return;
    setSubmitting(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
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

          {/* Issue section label */}
          <Text style={styles.sectionLabel}>What was the issue?</Text>

          {/* Issue list — blurred card */}
          <View style={styles.issueCardWrap}>
            <BlurView intensity={60} tint="dark" style={styles.issueCardBlur}>
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
            </BlurView>
          </View>

          {/* Additional details */}
          <Text style={[styles.sectionLabel, { marginTop: 24 }]}>Additional details</Text>
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
                <Text style={[styles.submitText, { color: '#FFF' }]}>Submitting...</Text>
              ) : (
                <Text style={[styles.submitText, { color: selectedIssue ? '#FFF' : 'rgba(255,255,255,0.35)' }]}>
                  Submit feedback
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  issueCardWrap: {
    marginHorizontal: 16,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  issueCardBlur: {
    borderRadius: 18,
    overflow: 'hidden',
  },
  issueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  issueRowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  issueRowSelected: {
    backgroundColor: 'rgba(255,255,255,0.05)',
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
});
