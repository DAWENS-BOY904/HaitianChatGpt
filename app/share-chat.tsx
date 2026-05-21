import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, Share as RNShare, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSupabaseClient } from '@/template';
import { MessageItem } from '../components/MessageItem';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  image_url?: string;
  created_at: string;
}

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export default function ShareChatScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { conversationId } = useLocalSearchParams();
  const supabase = getSupabaseClient();
  
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [shareUrl, setShareUrl] = useState('');

  useEffect(() => {
    loadConversation();
  }, [conversationId]);

  const loadConversation = async () => {
    if (!conversationId) return;

    setLoading(true);

    // Load conversation
    const { data: convData, error: convError } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .single();

    if (!convError && convData) {
      setConversation(convData);
    }

    // Load messages
    const { data: messagesData, error: messagesError } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (!messagesError && messagesData) {
      setMessages(messagesData);
    }

    // Generate shareable URL (in a real app, you'd create a public share link)
    setShareUrl(`https://haitianchatgpt.app/shared/${conversationId}`);

    setLoading(false);
  };

  const handleShare = async () => {
    try {
      await RNShare.share({
        message: `Check out this conversation: ${shareUrl}`,
        url: shareUrl,
        title: conversation?.title || 'Chat Conversation',
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const handleCopyLink = async () => {
    if (Platform.OS === 'web') {
      navigator.clipboard.writeText(shareUrl);
    } else {
      // For native, you'd use Clipboard from expo
      const Clipboard = await import('expo-clipboard');
      await Clipboard.default.setStringAsync(shareUrl);
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
      justifyContent: 'space-between',
      padding: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.background,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    headerButton: {
      padding: Spacing.xs,
    },
    headerTitle: {
      ...Typography.heading,
      color: colors.text,
      fontSize: 18,
      marginLeft: Spacing.sm,
    },
    content: {
      flex: 1,
    },
    infoSection: {
      backgroundColor: colors.surface,
      margin: Spacing.md,
      padding: Spacing.md,
      borderRadius: BorderRadius.md,
    },
    infoText: {
      ...Typography.caption,
      color: colors.textSecondary,
      marginBottom: Spacing.sm,
      lineHeight: 18,
    },
    conversationTitle: {
      ...Typography.heading,
      color: colors.text,
      fontSize: 16,
      marginBottom: Spacing.xs,
    },
    dateText: {
      ...Typography.caption,
      color: colors.textSecondary,
      fontSize: 12,
    },
    messagesSection: {
      flex: 1,
      paddingHorizontal: Spacing.md,
    },
    messagesSectionTitle: {
      ...Typography.caption,
      color: colors.textSecondary,
      marginBottom: Spacing.sm,
      fontWeight: '600',
      textTransform: 'uppercase',
      fontSize: 11,
    },
    footer: {
      padding: Spacing.md,
      paddingBottom: Platform.select({ ios: insets.bottom + Spacing.md, android: insets.bottom + Spacing.md, default: Spacing.md }),
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.background,
    },
    shareButton: {
      backgroundColor: colors.primary,
      padding: Spacing.md,
      borderRadius: BorderRadius.lg,
      alignItems: 'center',
      marginBottom: Spacing.sm,
    },
    shareButtonText: {
      ...Typography.body,
      color: '#FFFFFF',
      fontWeight: '600',
    },
    copyButton: {
      backgroundColor: colors.surface,
      padding: Spacing.md,
      borderRadius: BorderRadius.lg,
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'center',
      gap: Spacing.sm,
    },
    copyButtonText: {
      ...Typography.body,
      color: colors.text,
      fontWeight: '600',
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: Spacing.xl,
    },
    emptyText: {
      ...Typography.body,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    helpIcon: {
      padding: Spacing.xs,
    },
  });

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Share link to chat</Text>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  if (!conversation || messages.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Share link to chat</Text>
          </View>
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No conversation found</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Share link to chat</Text>
        </View>
        <TouchableOpacity style={styles.helpIcon}>
          <Ionicons name="help-circle-outline" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.infoSection}>
          <Text style={styles.infoText}>
            Messages sent or received after sharing your link won't be shared. Anyone with the URL will be able to view your shared chat.
          </Text>
          <Text style={styles.infoText}>
            Your custom instructions won't be shared with viewers.
          </Text>
        </View>

        <View style={[styles.infoSection, { marginTop: 0 }]}>
          <Text style={styles.conversationTitle}>{conversation.title}</Text>
          <Text style={styles.dateText}>
            Anonymous • {new Date(conversation.created_at).toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric', 
              year: 'numeric' 
            })}
          </Text>
        </View>

        <View style={styles.messagesSection}>
          <Text style={styles.messagesSectionTitle}>Preview</Text>
          {messages.map((message) => (
            <MessageItem
              key={message.id}
              message={message}
              isGenerating={false}
            />
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
          <Ionicons name="share-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
          <Text style={styles.shareButtonText}>Share link</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.copyButton} onPress={handleCopyLink}>
          <Ionicons name="copy-outline" size={18} color={colors.text} />
          <Text style={styles.copyButtonText}>Copy link</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
