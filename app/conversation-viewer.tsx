import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  ActivityIndicator,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useConversation } from '../hooks/useConversation';
import { useRouter } from 'expo-router';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { useAlert } from '@/template';

export default function ConversationViewerScreen() {
  const { colors } = useTheme();
  const { messages, currentConversation } = useConversation();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const aiMessages = messages.filter(m => m.role === 'assistant');

  const handleCopyAll = async () => {
    const text = aiMessages.map(m => m.content).join('\n\n---\n\n');
    await Clipboard.setStringAsync(text);
    showAlert('Copied', 'All AI responses copied to clipboard');
  };

  const handleShare = async () => {
    const text = aiMessages.map((m, i) => `${i + 1}. ${m.content}`).join('\n\n');
    
    try {
      await Share.share({
        message: text,
        title: `AI Responses from ${currentConversation?.title || 'Conversation'}`,
      });
    } catch (error) {
      console.error('Share error:', error);
    }
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
      justifyContent: 'space-between',
      padding: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    backButton: {
      padding: Spacing.xs,
      marginRight: Spacing.sm,
    },
    headerTitle: {
      ...Typography.heading,
      color: colors.text,
      flex: 1,
    },
    headerButton: {
      padding: Spacing.xs,
      marginLeft: Spacing.sm,
    },
    content: {
      flex: 1,
      padding: Spacing.md,
    },
    messageCard: {
      backgroundColor: colors.card,
      borderRadius: BorderRadius.md,
      padding: Spacing.lg,
      marginBottom: Spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    messageHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: Spacing.sm,
      paddingBottom: Spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    messageNumber: {
      ...Typography.caption,
      color: colors.primary,
      fontWeight: '600',
    },
    messageTime: {
      ...Typography.caption,
      color: colors.textSecondary,
      fontSize: 11,
    },
    messageContent: {
      ...Typography.body,
      color: colors.text,
      lineHeight: 22,
    },
    emptyState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: Spacing.xl,
    },
    emptyIcon: {
      marginBottom: Spacing.md,
    },
    emptyTitle: {
      ...Typography.heading,
      color: colors.text,
      marginBottom: Spacing.xs,
    },
    emptyText: {
      ...Typography.body,
      color: colors.textSecondary,
      textAlign: 'center',
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>AI Responses</Text>
        </View>
        
        {aiMessages.length > 0 && (
          <>
            <TouchableOpacity style={styles.headerButton} onPress={handleCopyAll}>
              <Ionicons name="copy-outline" size={22} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerButton} onPress={handleShare}>
              <Ionicons name="share-outline" size={22} color={colors.text} />
            </TouchableOpacity>
          </>
        )}
      </View>

      {aiMessages.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons
            name="chatbubbles-outline"
            size={64}
            color={colors.textSecondary}
            style={styles.emptyIcon}
          />
          <Text style={styles.emptyTitle}>No AI responses yet</Text>
          <Text style={styles.emptyText}>
            Start a conversation to see AI responses here
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.content}>
          {aiMessages.map((message, index) => (
            <View key={message.id} style={styles.messageCard}>
              <View style={styles.messageHeader}>
                <Text style={styles.messageNumber}>Response #{index + 1}</Text>
                <Text style={styles.messageTime}>
                  {new Date(message.created_at).toLocaleTimeString()}
                </Text>
              </View>
              <Text style={styles.messageContent}>{message.content}</Text>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
