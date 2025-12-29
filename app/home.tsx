import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, KeyboardAvoidingView, Platform, StatusBar, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useConversation } from '../hooks/useConversation';
import { useSettings } from '../hooks/useSettings';
import { useGuestLimits } from '../hooks/useGuestLimits';
import { useAlert, useAuth } from '@/template';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { MenuModal } from '../components/MenuModal';
import { ToolsModal } from '../components/ToolsModal';
import { ConversationMenuModal } from '../components/ConversationMenuModal';
import { MessageItem } from '../components/MessageItem';
import { ThinkingIndicator } from '../components/ThinkingIndicator';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSupabaseClient } from '@/template';
import { decode } from 'base64-arraybuffer';
import { useRouter } from 'expo-router';
import { Accelerometer } from 'expo-sensors';
import { Audio } from 'expo-av';

export default function HomeScreen() {
  const { colors } = useTheme();
  const { settings, updateSetting } = useSettings();
  const { user } = useAuth();
  const { canSendMessage, incrementMessageCount, remainingMessages } = useGuestLimits();
  const { conversations, messages, currentConversation, sendMessage, updateMessage, updateMessageAndRegenerate, createConversation, loading, updateConversationTitle, deleteConversation } = useConversation();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [inputText, setInputText] = useState('');
  const [menuVisible, setMenuVisible] = useState(false);
  const [toolsVisible, setToolsVisible] = useState(false);
  const [conversationMenuVisible, setConversationMenuVisible] = useState(false);
  const [sending, setSending] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<any[]>([]);
  const [currentAIModel, setCurrentAIModel] = useState(settings.preferredAiModel || 'gemini');
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [lastShake, setLastShake] = useState(0);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [thinkingMode, setThinkingMode] = useState<'thinking' | 'creating_image' | 'analyzing' | 'editing_image'>('thinking');
  const [showCompletionStatus, setShowCompletionStatus] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const supabase = getSupabaseClient();

  // DO NOT create conversation on mount - only when user sends first message
  // NO AUTO-CREATE - conversations only created when user sends message

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  // Shake detection for bug report (only on native mobile - not web)
  useEffect(() => {
    // Only enable accelerometer on iOS and Android, not on web
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      const subscription = Accelerometer.addListener(accelerometerData => {
        const { x, y, z } = accelerometerData;
        const acceleration = Math.sqrt(x * x + y * y + z * z);
        const now = Date.now();
        
        // Increased threshold to 3.0 and added 2-second cooldown to prevent accidental triggers
        if (acceleration > 3.0 && now - lastShake > 1000) {
          setLastShake(now);
          router.push('/bugreport');
        }
      });

      Accelerometer.setUpdateInterval(100);

      return () => subscription.remove();
    }
    // No cleanup needed for web
    return () => {};
  }, [lastShake]);

  const handleSend = async () => {
    if ((!inputText.trim() && selectedMedia.length === 0) || sending) return;

    // Check guest limits for new messages only (not edits)
    if (!editingMessageId && !canSendMessage()) {
      showAlert(
        'Login Required',
        `You have used your 2 free messages. Please log in to continue chatting.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Log In', onPress: () => router.push('/login') },
        ]
      );
      return;
    }

    // Create conversation if it doesn't exist (first message only)
    let conversationId = currentConversation?.id;
    if (!conversationId) {
      console.log('📝 Creating new conversation for first message');
      conversationId = await createConversation();
      if (!conversationId) {
        showAlert('Error', 'Failed to create conversation');
        return;
      }
    }

    setSending(true);
    setGenerating(true);
    const text = inputText;
    const media = selectedMedia;
    const editingId = editingMessageId;
    
    // Clear input immediately for better UX
    setInputText('');
    setSelectedMedia([]);
    setEditingMessageId(null);
    
    // Set default thinking mode
    setThinkingMode('thinking');

    try {
      // If editing an existing message
      if (editingId) {
        console.log('🔄 Editing message:', editingId);
        await updateMessageAndRegenerate(editingId, text, currentAIModel);
        setGenerating(false);
        setSending(false);
        return;
      }

      // NEW MESSAGE FLOW
      console.log('📤 Sending new message with model:', currentAIModel);
      
      // Upload media if any
      let imageUrl: string | undefined;
      if (media.length > 0) {
        const firstMedia = media[0];
        if (firstMedia.type === 'image' && firstMedia.base64) {
          const fileName = `${Date.now()}.jpg`;
          const filePath = `${conversationId}/${fileName}`;
          
          const { error: uploadError } = await supabase.storage
            .from('chat-images')
            .upload(filePath, decode(firstMedia.base64), {
              contentType: 'image/jpeg',
            });

          if (!uploadError) {
            const { data: urlData } = supabase.storage
              .from('chat-images')
              .getPublicUrl(filePath);
            imageUrl = urlData.publicUrl;
          }
        }
      }

      // Use ConversationContext's sendMessage which handles everything
      await sendMessage(text || '[Image]', imageUrl, currentAIModel);
      
      // Show completion status briefly after AI response
      setShowCompletionStatus(true);
      setTimeout(() => {
        setShowCompletionStatus(false);
      }, 2000);
      
      // Increment guest message count
      await incrementMessageCount();
      
    } catch (error: any) {
      console.error('❌ Send error:', error);
      
      // Show detailed error message to user
      const errorMsg = error?.message || (editingId ? 'Failed to update message' : 'Failed to send message');
      console.error('📋 Error message shown to user:', errorMsg);
      
      showAlert('Error', errorMsg);
    } finally {
      setSending(false);
      setGenerating(false);
    }
  };

  const handleCancelGeneration = () => {
    setGenerating(false);
    showAlert('Cancelled', 'AI response generation stopped');
  };

  const handleEditMessage = (messageId: string, content: string) => {
    setEditingMessageId(messageId);
    setInputText(content);
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setInputText('');
  };

  const handleMediaPicked = (media: any[]) => {
    setSelectedMedia(media);
  };

  const handleAIModelSelect = async (model: string) => {
    console.log('🤖 AI Model changed to:', model);
    setCurrentAIModel(model);
    await updateSetting('preferredAiModel', model);
    showAlert('Model Updated', `Now using ${model === 'gemini' ? 'Gemini' : model === 'openai' ? 'OpenAI' : model === 'claude' ? 'Claude' : 'Llama'} for all responses`);
  };

  const handleStartRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') return;

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(recording);
      setIsRecording(true);
    } catch (error) {
      console.error('Recording error:', error);
    }
  };

  const handleStopRecording = async () => {
    if (!recording) return;

    setIsRecording(false);
    
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      
      // In a real app, you would send this audio to a speech-to-text service
      showAlert('Voice Input', 'Voice recording feature coming soon');
    } catch (error) {
      console.error('Stop recording error:', error);
    }
    
    setRecording(null);
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
    modelButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 4,
      borderRadius: BorderRadius.sm,
      marginRight: Spacing.sm,
    },
    modelText: {
      ...Typography.caption,
      color: colors.text,
      fontSize: 11,
      marginRight: 4,
    },
    messagesContainer: {
      flex: 1,
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
    recordingButton: {
      backgroundColor: '#FF3B30',
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
    selectedMediaPreview: {
      flexDirection: 'row',
      gap: Spacing.xs,
      paddingHorizontal: Spacing.md,
      paddingBottom: Spacing.sm,
    },
    mediaPreviewItem: {
      width: 60,
      height: 60,
      borderRadius: BorderRadius.sm,
      backgroundColor: colors.surface,
      position: 'relative',
    },
    removeMediaButton: {
      position: 'absolute',
      top: -6,
      right: -6,
      backgroundColor: '#FF3B30',
      borderRadius: BorderRadius.full,
      width: 20,
      height: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    editingIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      backgroundColor: `${colors.primary}20`,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    editingText: {
      ...Typography.caption,
      color: colors.primary,
      flex: 1,
    },
  });

  const renderMessage = ({ item, index }: { item: any; index: number }) => (
    <MessageItem
      message={item}
      onCancel={handleCancelGeneration}
      onEdit={(messageId, content) => handleEditMessage(messageId, content)}
      isGenerating={generating && index === messages.length - 1}
    />
  );

  const modelName = currentAIModel === 'gemini' ? 'Gemini' 
    : currentAIModel === 'openai' ? 'OpenAI' 
    : currentAIModel === 'claude' ? 'Claude'
    : 'Llama';

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
        
        <TouchableOpacity 
          style={styles.modelButton} 
          onPress={() => router.push('/model-selector')}
        >
          <Text style={styles.modelText}>{modelName}</Text>
          <Ionicons name="chevron-down" size={12} color={colors.text} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.headerButton} onPress={() => router.push('/upload-manager')}>
          <Ionicons name="cloud-upload-outline" size={22} color={colors.text} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.headerButton} onPress={() => router.push('/conversation-viewer')}>
          <Ionicons name="document-text-outline" size={22} color={colors.text} />
        </TouchableOpacity>

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
            Ask me anything! I can help with questions, creative writing, coding, analysis, and more.
          </Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingVertical: Spacing.md }}
          ListFooterComponent={generating ? (
            <ThinkingIndicator 
              userMessage={messages.length > 0 ? messages[messages.length - 1].content : inputText}
              completed={showCompletionStatus}
            />
          ) : null}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />
      )}

      {selectedMedia.length > 0 && (
        <View style={styles.selectedMediaPreview}>
          {selectedMedia.map((media, index) => (
            <View key={index} style={styles.mediaPreviewItem}>
              <Ionicons name="image" size={32} color={colors.textSecondary} />
              <TouchableOpacity
                style={styles.removeMediaButton}
                onPress={() => setSelectedMedia(prev => prev.filter((_, i) => i !== index))}
              >
                <Ionicons name="close" size={12} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {editingMessageId && (
        <View style={styles.editingIndicator}>
          <Ionicons name="pencil" size={16} color={colors.primary} />
          <Text style={styles.editingText}>Editing message</Text>
          <TouchableOpacity onPress={handleCancelEdit}>
            <Text style={{ ...Typography.caption, color: colors.primary, fontWeight: '600' }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.inputContainer}>
        <TouchableOpacity style={styles.iconButton} onPress={() => setToolsVisible(true)} disabled={editingMessageId !== null}>
          <Ionicons name="add-circle-outline" size={24} color={editingMessageId ? colors.textSecondary : colors.text} />
        </TouchableOpacity>

        <TextInput
          style={styles.input}
          placeholder={editingMessageId ? "Edit message..." : "Message..."}
          placeholderTextColor={colors.textSecondary}
          value={inputText}
          onChangeText={setInputText}
          multiline
          editable={!sending}
        />

        <TouchableOpacity 
          style={styles.iconButton} 
          onPress={() => router.push('/voice-control')}
          disabled={editingMessageId !== null}
        >
          <Ionicons name="mic-outline" size={24} color={editingMessageId ? colors.textSecondary : colors.text} />
        </TouchableOpacity>

        {editingMessageId && (
          <TouchableOpacity 
            style={styles.iconButton} 
            onPress={handleCancelEdit}
          >
            <Ionicons name="close-circle-outline" size={24} color="#FF3B30" />
          </TouchableOpacity>
        )}

        {inputText.trim() || selectedMedia.length > 0 ? (
          <TouchableOpacity 
            style={styles.sendButton} 
            onPress={handleSend}
            disabled={sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity 
            style={[styles.sendButton, isRecording && styles.recordingButton]} 
            onPress={isRecording ? handleStopRecording : handleStartRecording}
            disabled={editingMessageId !== null}
          >
            <Ionicons 
              name={isRecording ? "stop" : "mic"} 
              size={20} 
              color="#FFFFFF" 
            />
          </TouchableOpacity>
        )}
      </View>

      <MenuModal visible={menuVisible} onClose={() => setMenuVisible(false)} />
      <ToolsModal 
        visible={toolsVisible} 
        onClose={() => setToolsVisible(false)}
        onSelectTool={(tool) => setInputText(`[${tool}] `)}
        onPickMedia={handleMediaPicked}
        onSelectAIModel={handleAIModelSelect}
        onOpenCamera={() => router.push('/camera')}
        currentModel={currentAIModel}
      />
      <ConversationMenuModal
        visible={conversationMenuVisible}
        onClose={() => setConversationMenuVisible(false)}
        onShare={() => {}}
        onRename={() => {}}
        onReport={() => router.push('/bugreport')}
        onArchive={() => {}}
        onDelete={async () => {
          if (currentConversation) {
            await deleteConversation(currentConversation.id);
            await createConversation();
          }
        }}
      />
    </KeyboardAvoidingView>
  );
}
