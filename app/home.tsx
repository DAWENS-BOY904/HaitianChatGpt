import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, KeyboardAvoidingView, Platform, StatusBar, ActivityIndicator, Share } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useConversation } from '../hooks/useConversation';
import { useSubscription } from '../hooks/useSubscription';
import { useSettings } from '../hooks/useSettings';
import { useAlert } from '@/template';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { MenuModal } from '../components/MenuModal';
import { ToolsModal } from '../components/ToolsModal';
import { ConversationMenuModal } from '../components/ConversationMenuModal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { getSupabaseClient } from '@/template';
import { decode } from 'base64-arraybuffer';
import { useRouter } from 'expo-router';
import { Accelerometer } from 'expo-sensors';

export default function HomeScreen() {
  const { colors } = useTheme();
  const { settings } = useSettings();
  const { canSendMessage, incrementMessageCount, limits } = useSubscription();
  const { messages, currentConversation, sendMessage, createConversation, loading, updateConversationTitle, deleteConversation } = useConversation();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [inputText, setInputText] = useState('');
  const [menuVisible, setMenuVisible] = useState(false);
  const [toolsVisible, setToolsVisible] = useState(false);
  const [conversationMenuVisible, setConversationMenuVisible] = useState(false);
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!currentConversation) {
      createConversation();
    }
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  // Shake detection for bug report
  useEffect(() => {
    const subscription = Accelerometer.addListener(accelerometerData => {
      const { x, y, z } = accelerometerData;
      const acceleration = Math.sqrt(x * x + y * y + z * z);
      
      if (acceleration > 2.5) {
        router.push('/bugreport');
      }
    });

    Accelerometer.setUpdateInterval(100);

    return () => subscription.remove();
  }, []);

  const handleSend = async () => {
    if (!inputText.trim() || sending) return;

    if (!canSendMessage()) {
      showAlert('Limit Reached', `You have reached your daily limit of ${limits.messagesPerDay} messages. Upgrade to Premium for unlimited messages.`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Upgrade', onPress: () => router.push('/subscription') },
      ]);
      return;
    }

    setSending(true);
    const text = inputText;
    setInputText('');

    try {
      await sendMessage(text);
      await incrementMessageCount();
    } catch (error) {
      console.error('Send error:', error);
      showAlert('Error', 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleImagePicker = async () => {
    if (!limits.canUploadMedia) {
      showAlert('Premium Feature', 'Media uploads are only available for Premium members.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Upgrade', onPress: () => router.push('/subscription') },
      ]);
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.8,
      base64: true,
      allowsEditing: true,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const supabase = getSupabaseClient();
      
      try {
        const fileName = `${Date.now()}.${asset.type === 'video' ? 'mp4' : 'jpg'}`;
        const filePath = `${currentConversation?.id || 'temp'}/${fileName}`;
        const bucket = asset.type === 'video' ? 'media-files' : 'chat-images';
        
        const { data, error } = await supabase.storage
          .from(bucket)
          .upload(filePath, decode(asset.base64!), {
            contentType: asset.type === 'video' ? 'video/mp4' : 'image/jpeg',
          });

        if (error) throw error;

        const { data: urlData } = supabase.storage
          .from(bucket)
          .getPublicUrl(filePath);

        if (inputText.trim() || asset.type === 'image') {
          await sendMessage(inputText || '[Image]', urlData.publicUrl);
          setInputText('');
          await incrementMessageCount();
        }
      } catch (error) {
        console.error('Upload error:', error);
        showAlert('Error', 'Failed to upload media');
      }
    }
  };

  const handleDocumentPicker = async () => {
    if (!limits.canUploadMedia) {
      showAlert('Premium Feature', 'File uploads are only available for Premium members.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Upgrade', onPress: () => router.push('/subscription') },
      ]);
      return;
    }

    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    });

    if (!result.canceled && result.assets[0]) {
      showAlert('Info', `File selected: ${result.assets[0].name}`);
    }
  };

  const handleShare = async () => {
    if (!currentConversation) return;

    const messagesText = messages
      .map(m => `${m.role === 'user' ? 'You' : 'AI'}: ${m.content}`)
      .join('\n\n');

    try {
      await Share.share({
        message: messagesText,
        title: currentConversation.title,
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const handleRename = () => {
    if (!currentConversation) return;

    showAlert('Rename Conversation', 'Enter a new title:', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Rename',
        onPress: async () => {
          // In a real implementation, you would show a text input dialog
          await updateConversationTitle(currentConversation.id, 'New Title');
        },
      },
    ]);
  };

  const handleReport = () => {
    router.push('/bugreport');
  };

  const handleArchive = () => {
    showAlert('Success', 'Conversation archived');
  };

  const handleDelete = async () => {
    if (!currentConversation) return;

    showAlert('Delete Conversation', 'Are you sure? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteConversation(currentConversation.id);
          await createConversation();
        },
      },
    ]);
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
      flex: 1,
      marginLeft: Spacing.sm,
    },
    messagesContainer: {
      flex: 1,
    },
    messageItem: {
      padding: Spacing.md,
      marginVertical: Spacing.xs,
    },
    userMessage: {
      alignSelf: 'flex-end',
      backgroundColor: colors.primary,
      borderRadius: BorderRadius.md,
      maxWidth: '80%',
      marginRight: Spacing.md,
    },
    assistantMessage: {
      alignSelf: 'flex-start',
      backgroundColor: colors.surface,
      borderRadius: BorderRadius.md,
      maxWidth: '80%',
      marginLeft: Spacing.md,
    },
    messageText: {
      ...Typography.body,
    },
    userMessageText: {
      color: '#FFFFFF',
    },
    assistantMessageText: {
      color: colors.text,
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
    iconButton: {
      padding: Spacing.xs,
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
      padding: Spacing.md,
      alignItems: 'center',
    },
  });

  const renderMessage = ({ item }: { item: any }) => (
    <View style={[
      styles.messageItem,
      item.role === 'user' ? styles.userMessage : styles.assistantMessage
    ]}>
      <Text style={[
        styles.messageText,
        item.role === 'user' ? styles.userMessageText : styles.assistantMessageText
      ]}>
        {item.content}
      </Text>
    </View>
  );

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <StatusBar barStyle={colors.text === '#FFFFFF' ? 'light-content' : 'dark-content'} />
      
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.headerButton} onPress={() => setMenuVisible(true)}>
            <Ionicons name="menu" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {currentConversation?.title || 'HaitianChatGpt'}
          </Text>
        </View>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.push('/social')}>
          <Ionicons name="people" size={24} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.headerButton} onPress={() => setConversationMenuVisible(true)}>
          <Ionicons name="ellipsis-horizontal" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : messages.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="chatbubbles-outline" size={64} color={colors.textSecondary} style={styles.emptyIcon} />
          <Text style={styles.emptyTitle}>Start a conversation</Text>
          <Text style={styles.emptyText}>
            Ask me anything! I can help with questions, creative writing, analysis, and more.
          </Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingVertical: Spacing.md }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />
      )}

      <View style={styles.inputContainer}>
        <TouchableOpacity style={styles.headerButton} onPress={() => setMenuVisible(true)}>
          <Ionicons name="menu" size={24} color={colors.text} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.iconButton} onPress={handleImagePicker}>
          <Ionicons name="image-outline" size={24} color={colors.text} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.iconButton} onPress={handleDocumentPicker}>
          <Ionicons name="attach-outline" size={24} color={colors.text} />
        </TouchableOpacity>

        <TextInput
          style={styles.input}
          placeholder="Message..."
          placeholderTextColor={colors.textSecondary}
          value={inputText}
          onChangeText={setInputText}
          multiline
          editable={!sending}
        />

        <TouchableOpacity style={styles.iconButton} onPress={() => setToolsVisible(true)}>
          <Ionicons name="add-circle-outline" size={24} color={colors.text} />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.sendButton} 
          onPress={handleSend}
          disabled={!inputText.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
          )}
        </TouchableOpacity>
      </View>

      <MenuModal visible={menuVisible} onClose={() => setMenuVisible(false)} />
      <ToolsModal 
        visible={toolsVisible} 
        onClose={() => setToolsVisible(false)}
        onSelectTool={(tool) => {
          setInputText(`[${tool}] `);
        }}
      />
      <ConversationMenuModal
        visible={conversationMenuVisible}
        onClose={() => setConversationMenuVisible(false)}
        onShare={handleShare}
        onRename={handleRename}
        onReport={handleReport}
        onArchive={handleArchive}
        onDelete={handleDelete}
      />
    </KeyboardAvoidingView>
  );
}
