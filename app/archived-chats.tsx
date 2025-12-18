import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useAuth, useAlert } from '@/template';
import { useRouter } from 'expo-router';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSupabaseClient } from '@/template';

interface ArchivedChat {
  id: string;
  title: string;
  archived_at: string;
  message_count: number;
}

export default function ArchivedChatsScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const supabase = getSupabaseClient();

  const [archivedChats, setArchivedChats] = useState<ArchivedChat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadArchivedChats();
  }, []);

  const loadArchivedChats = async () => {
    if (!user) return;

    setLoading(true);
    
    // For now, this is placeholder data
    // In a real implementation, you would have an archived_conversations table
    // or an is_archived column in conversations table
    
    setLoading(false);
  };

  const handleRestore = async (chatId: string) => {
    showAlert('Restore Chat', 'Do you want to restore this conversation?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Restore',
        onPress: async () => {
          // Restore logic here
          showAlert('Success', 'Chat restored successfully');
          loadArchivedChats();
        },
      },
    ]);
  };

  const handleDelete = async (chatId: string) => {
    showAlert(
      'Delete Chat',
      'This will permanently delete this conversation. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            // Delete logic here
            showAlert('Success', 'Chat deleted permanently');
            loadArchivedChats();
          },
        },
      ]
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
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
    chatItem: {
      backgroundColor: colors.card,
      padding: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    chatHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: Spacing.sm,
    },
    chatTitle: {
      ...Typography.body,
      color: colors.text,
      fontWeight: '600',
      flex: 1,
      marginRight: Spacing.sm,
    },
    chatDate: {
      ...Typography.caption,
      color: colors.textSecondary,
      fontSize: 12,
    },
    chatInfo: {
      ...Typography.caption,
      color: colors.textSecondary,
      marginBottom: Spacing.sm,
    },
    chatActions: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.sm,
      gap: Spacing.xs,
      flex: 1,
      justifyContent: 'center',
    },
    restoreButton: {
      backgroundColor: colors.primary,
    },
    deleteButton: {
      backgroundColor: '#FF3B30',
    },
    actionButtonText: {
      ...Typography.caption,
      color: '#FFFFFF',
      fontWeight: '600',
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
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

  const renderChatItem = ({ item }: { item: ArchivedChat }) => (
    <View style={styles.chatItem}>
      <View style={styles.chatHeader}>
        <Text style={styles.chatTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.chatDate}>{formatDate(item.archived_at)}</Text>
      </View>

      <Text style={styles.chatInfo}>{item.message_count} messages</Text>

      <View style={styles.chatActions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.restoreButton]}
          onPress={() => handleRestore(item.id)}
        >
          <Ionicons name="arrow-undo" size={16} color="#FFFFFF" />
          <Text style={styles.actionButtonText}>Restore</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => handleDelete(item.id)}
        >
          <Ionicons name="trash" size={16} color="#FFFFFF" />
          <Text style={styles.actionButtonText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Archived Chats</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : archivedChats.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons
            name="archive-outline"
            size={64}
            color={colors.textSecondary}
            style={styles.emptyIcon}
          />
          <Text style={styles.emptyTitle}>No archived chats</Text>
          <Text style={styles.emptyText}>
            Conversations you archive will appear here
          </Text>
        </View>
      ) : (
        <FlatList
          data={archivedChats}
          renderItem={renderChatItem}
          keyExtractor={(item) => item.id}
        />
      )}
    </View>
  );
}
