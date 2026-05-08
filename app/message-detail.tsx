import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useAuth, useAlert } from '@/template';
import { router, useLocalSearchParams } from 'expo-router';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSupabaseClient } from '@/template';

export default function MessageDetailScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const { messageId } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const supabase = getSupabaseClient();

  const [message, setMessage] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadMessage();
  }, [messageId]);

  const loadMessage = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .single();

    if (!error && data) {
      setMessage(data);
    }
    setLoading(false);
  };

  const handleSubmitFeedback = async () => {
    if (!feedback.trim()) {
      showAlert('Error', 'Please enter your feedback');
      return;
    }

    setSubmitting(true);

    // In a real app, you would send this to a feedback system
    console.log('Feedback submitted:', {
      messageId,
      feedback,
      userId: user?.id,
    });

    showAlert('Thank you!', 'Your feedback helps us improve');
    setSubmitting(false);
    router.back();
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingTop: Platform.select({
        ios: insets.top,
        android: insets.top,
      }),
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
    section: {
      backgroundColor: colors.card,
      borderRadius: BorderRadius.md,
      padding: Spacing.lg,
      marginBottom: Spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    sectionTitle: {
      ...Typography.heading,
      color: colors.text,
      fontSize: 16,
      marginBottom: Spacing.md,
    },
    messageContent: {
      ...Typography.body,
      color: colors.text,
      lineHeight: 22,
      marginBottom: Spacing.md,
    },
    infoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: Spacing.sm,
    },
    infoLabel: {
      ...Typography.caption,
      color: colors.textSecondary,
    },
    infoValue: {
      ...Typography.caption,
      color: colors.text,
      fontWeight: '600',
    },
    feedbackInput: {
      backgroundColor: colors.inputBackground,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      color: colors.text,
      minHeight: 120,
      textAlignVertical: 'top',
      marginBottom: Spacing.md,
    },
    submitButton: {
      backgroundColor: colors.primary,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      alignItems: 'center',
    },
    submitButtonText: {
      ...Typography.body,
      color: '#FFFFFF',
      fontWeight: '600',
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Message Details</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Message Details</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Message Content</Text>
          <Text style={styles.messageContent}>{message?.content}</Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Created</Text>
            <Text style={styles.infoValue}>
              {new Date(message?.created_at).toLocaleString()}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Type</Text>
            <Text style={styles.infoValue}>{message?.role}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Provide Feedback</Text>
          <Text style={styles.infoLabel} style={{ marginBottom: Spacing.sm }}>
            Help us improve this response
          </Text>

          <TextInput
            style={styles.feedbackInput}
            placeholder="What could be improved about this response?"
            placeholderTextColor={colors.textSecondary}
            value={feedback}
            onChangeText={setFeedback}
            multiline
          />

          <TouchableOpacity
            style={styles.submitButton}
            onPress={handleSubmitFeedback}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.submitButtonText}>Submit Feedback</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
