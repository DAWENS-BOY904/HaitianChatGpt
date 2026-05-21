import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useSocial } from '../hooks/useSocial';
import { useAuth } from '@/template';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ChatScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { friends, groups, getMessages, sendMessage, markMessagesSeen } = useSocial();
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  
  const chatId = params.id as string;
  const chatType = params.type as string;
  const isGroup = chatType === 'group';

  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const pollInterval = useRef<NodeJS.Timeout>();

  const chatInfo = isGroup 
    ? groups.find(g => g.id === chatId)
    : friends.find(f => f.id === chatId);

  useEffect(() => {
    loadMessages();
    markMessagesSeen(chatId, isGroup);

    pollInterval.current = setInterval(() => {
      loadMessages(true);
    }, 3000);

    return () => {
      if (pollInterval.current) {
        clearInterval(pollInterval.current);
      }
    };
  }, [chatId]);

  const loadMessages = async (silent = false) => {
    if (!silent) setLoading(true);
    const msgs = await getMessages(chatId, isGroup);
    setMessages(msgs);
    if (!silent) setLoading(false);
  };

  const handleSend = async () => {
    if (!inputText.trim() || sending) return;

    setSending(true);
    const text = inputText;
    setInputText('');

    const { error } = await sendMessage(
      text,
      isGroup ? undefined : chatId,
      isGroup ? chatId : undefined
    );

    if (!error) {
      await loadMessages(true);
      flatListRef.current?.scrollToEnd({ animated: true });
    }

    setSending(false);
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
      gap: Spacing.sm,
    },
    backButton: {
      padding: Spacing.xs,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: BorderRadius.full,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      ...Typography.body,
      color: '#FFFFFF',
      fontWeight: '600',
    },
    headerInfo: {
      flex: 1,
    },
    headerTitle: {
      ...Typography.body,
      color: colors.text,
      fontWeight: '600',
    },
    headerSubtitle: {
      ...Typography.caption,
      color: colors.textSecondary,
    },
    messagesContainer: {
      flex: 1,
    },
    messageItem: {
      padding: Spacing.md,
      marginVertical: Spacing.xs,
      maxWidth: '80%',
    },
    myMessage: {
      alignSelf: 'flex-end',
      backgroundColor: colors.primary,
      borderRadius: BorderRadius.md,
      marginRight: Spacing.md,
    },
    theirMessage: {
      alignSelf: 'flex-start',
      backgroundColor: colors.surface,
      borderRadius: BorderRadius.md,
      marginLeft: Spacing.md,
    },
    messageText: {
      ...Typography.body,
    },
    myMessageText: {
      color: '#FFFFFF',
    },
    theirMessageText: {
      color: colors.text,
    },
    messageMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: Spacing.xs,
      gap: Spacing.xs,
    },
    messageTime: {
      ...Typography.small,
      color: colors.textSecondary,
    },
    myMessageTime: {
      color: 'rgba(255, 255, 255, 0.7)',
    },
    senderName: {
      ...Typography.caption,
      color: colors.primary,
      fontWeight: '600',
      marginBottom: 2,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: Spacing.md,
      paddingBottom: Platform.select({ ios: insets.bottom + Spacing.md, android: insets.bottom + Spacing.md, default: Spacing.md }),
      borderTopWidth: 1,
      borderTopColor: colors.border,
      gap: Spacing.sm,
      backgroundColor: colors.background,
    },
    input: {
      flex: 1,
      backgroundColor: colors.inputBackground,
      borderRadius: BorderRadius.lg,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      ...Typography.body,
      color: colors.text,
      maxHeight: 100,
    },
    sendButton: {
      backgroundColor: colors.primary,
      borderRadius: BorderRadius.full,
      width: 36,
      height: 36,
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
      marginTop: Spacing.md,
    },
  });

  const renderMessage = ({ item }: { item: any }) => {
    const isMine = item.senderId === user?.id;
    const showSenderName = isGroup && !isMine;

    return (
      <View style={[
        styles.messageItem,
        isMine ? styles.myMessage : styles.theirMessage
      ]}>
        {showSenderName && (
          <Text style={styles.senderName}>
            {item.sender?.username || 'User'}
          </Text>
        )}
        <Text style={[
          styles.messageText,
          isMine ? styles.myMessageText : styles.theirMessageText
        ]}>
          {item.content}
        </Text>
        <View style={styles.messageMeta}>
          <Text style={[styles.messageTime, isMine && styles.myMessageTime]}>
            {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
          {isMine && (
            <Ionicons 
              name={item.status === 'seen' ? 'checkmark-done' : 'checkmark'} 
              size={14} 
              color={item.status === 'seen' ? '#4A90E2' : 'rgba(255, 255, 255, 0.7)'} 
            />
          )}
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.avatar}>
          {isGroup ? (
            <Ionicons name="people" size={20} color="#FFFFFF" />
          ) : (
            <Text style={styles.avatarText}>
              {chatInfo?.username?.[0]?.toUpperCase() || chatInfo?.name?.[0]?.toUpperCase() || 'U'}
            </Text>
          )}
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>
            {isGroup ? chatInfo?.name : chatInfo?.username || 'User'}
          </Text>
          <Text style={styles.headerSubtitle}>
            {isGroup ? 'Group chat' : chatInfo?.email || ''}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : messages.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="chatbubble-outline" size={64} color={colors.textSecondary} />
          <Text style={styles.emptyText}>No messages yet. Start the conversation!</Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingVertical: Spacing.md }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        />
      )}

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Message..."
          placeholderTextColor={colors.textSecondary}
          value={inputText}
          onChangeText={setInputText}
          multiline
          editable={!sending}
        />
        <TouchableOpacity 
          style={styles.sendButton} 
          onPress={handleSend}
          disabled={!inputText.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name="send" size={18} color="#FFFFFF" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
