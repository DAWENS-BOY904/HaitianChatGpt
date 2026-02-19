import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  FlatList, 
  KeyboardAvoidingView, 
  Platform, 
  StatusBar, 
  ActivityIndicator,
  Alert,
} from 'react-native';
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
import * as FileSystem from 'expo-file-system';

// Recording states
type RecordingState = 'idle' | 'recording' | 'processing';

export default function HomeScreen() {
  const { colors } = useTheme();
  const { settings, updateSetting } = useSettings();
  const { user } = useAuth();
  const { canSendMessage, incrementMessageCount, remainingMessages } = useGuestLimits();
  const { conversations, messages, currentConversation, sendMessage, updateMessage, updateMessageAndRegenerate, createConversation, loading, updateConversationTitle, deleteConversation } = useConversation();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  // State
  const [inputText, setInputText] = useState('');
  const [menuVisible, setMenuVisible] = useState(false);
  const [toolsVisible, setToolsVisible] = useState(false);
  const [conversationMenuVisible, setConversationMenuVisible] = useState(false);
  const [sending, setSending] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<any[]>([]);
  const [currentAIModel, setCurrentAIModel] = useState(settings.preferredAiModel || 'gemini');
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [lastShake, setLastShake] = useState(0);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [thinkingMode, setThinkingMode] = useState<'thinking' | 'creating_image' | 'analyzing' | 'editing_image'>('thinking');
  const [showCompletionStatus, setShowCompletionStatus] = useState(false);
  
  // Refs
  const flatListRef = useRef<FlatList>(null);
  const supabase = getSupabaseClient();
  const recordingRef = useRef<Audio.Recording | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioPermissionRef = useRef<boolean>(false);

  // Initialize audio permissions on mount
  useEffect(() => {
    checkAudioPermissions();
  }, []);

  const checkAudioPermissions = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      audioPermissionRef.current = status === 'granted';
      
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
    } catch (error) {
      console.error('Audio permission error:', error);
    }
  };

  // Auto-create conversation when user enters home page
  useEffect(() => {
    const initConversation = async () => {
      if (!currentConversation && user) {
        console.log('🆕 Auto-creating new conversation on mount');
        await createConversation();
      }
    };
    initConversation();
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  // Cleanup recording on unmount
  useEffect(() => {
    return () => {
      stopRecordingTimer();
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
      }
    };
  }, []);

  // Shake detection for bug report
  useEffect(() => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      const subscription = Accelerometer.addListener(accelerometerData => {
        const { x, y, z } = accelerometerData;
        const acceleration = Math.sqrt(x * x + y * y + z * z);
        const now = Date.now();
        
        if (acceleration > 3.0 && now - lastShake > 1000) {
          setLastShake(now);
          router.push('/bugreport');
        }
      });

      Accelerometer.setUpdateInterval(100);
      return () => subscription.remove();
    }
    return () => {};
  }, [lastShake]);

  // Recording timer
  const startRecordingTimer = () => {
    setRecordingDuration(0);
    recordingTimerRef.current = setInterval(() => {
      setRecordingDuration(prev => prev + 1);
    }, 1000);
  };

  const stopRecordingTimer = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Start voice recording
  const startVoiceRecording = async () => {
    if (!audioPermissionRef.current) {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Microphone access is needed for voice input. Please enable it in Settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Platform.OS === 'ios' ? Linking.openURL('app-settings:') : Linking.openSettings() }
          ]
        );
        return;
      }
      audioPermissionRef.current = true;
    }

    try {
      // Stop any existing recording
      if (recordingRef.current) {
        await recordingRef.current.stopAndUnloadAsync();
      }

      setRecordingState('recording');
      startRecordingTimer();

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      recordingRef.current = recording;

      // Auto-stop after 60 seconds
      setTimeout(() => {
        if (recordingState === 'recording') {
          stopVoiceRecording();
        }
      }, 60000);

    } catch (error) {
      console.error('Failed to start recording:', error);
      setRecordingState('idle');
      stopRecordingTimer();
      showAlert('Error', 'Failed to start recording. Please try again.');
    }
  };

    // Stop voice recording and process
  const stopVoiceRecording = async () => {
    if (!recordingRef.current || recordingState !== 'recording') return;

    stopRecordingTimer();
    setRecordingState('processing');

    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      
      if (!uri) {
        throw new Error('No recording URI');
      }

      const info = await FileSystem.getInfoAsync(uri);
      if (!info.exists) {
        throw new Error('Recording file not found');
      }

      console.log('🎤 Recording saved:', uri, 'Size:', info.size);

      const base64Audio = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Appel fonksyon ki gen moderasyon
      await transcribeAudio(base64Audio);

    } catch (error) {
      console.error('Recording error:', error);
      if (recordingState !== 'idle') {
        setRecordingState('idle');
      }
    } finally {
      recordingRef.current = null;
    }
  };


   // Transcribe audio with scam/fraud detection
  const transcribeAudio = async (base64Audio: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('transcribe-audio', {
        body: {
          audio: base64Audio,
          userId: user?.id,
          conversationId: currentConversation?.id,
        },
      });

      // Check if user got banned for scam/fraud
      if (error?.message?.includes('Content violation') || data?.banned) {
        setRecordingState('idle');
        
        Alert.alert(
          '🚫 Account Suspended',
          "Don't fucking say that! Your account has been suspended for 10 days due to scam/fraud content. This conversation has been terminated.",
          [{ 
            text: 'OK', 
            onPress: () => {
              // Clear current conversation
              setInputText('');
              setTranscript('');
              // Navigate to suspended screen or logout
              router.push('/suspended');
            } 
          }]
        );
        return;
      }

      if (data?.text) {
        console.log('📝 Transcribed:', data.text);
        setInputText(prev => prev + (prev ? ' ' : '') + data.text);
        setRecordingState('idle');
      } else {
        throw new Error('No transcription received');
      }

    } catch (error: any) {
      console.error('Transccription error:', error);
      
      // Check if it's a ban error
      if (error?.message?.includes('Content violation') || error?.message?.includes('suspended')) {
        setRecordingState('idle');
        return;
      }
      
      // Fallback: Show manual input option
      Alert.alert(
        'Transcription Failed',
        'Could not transcribe audio. Would you like to try again or type manually?',
        [
          { 
            text: 'Try Again', 
            onPress: () => startVoiceRecording() 
          },
          { 
            text: 'Type Manually', 
            style: 'cancel',
            onPress: () => setRecordingState('idle')
          },
        ]
      );
    }
  };


  // Toggle recording
  const toggleRecording = () => {
    if (recordingState === 'idle') {
      startVoiceRecording();
    } else if (recordingState === 'recording') {
      stopVoiceRecording();
    }
  };

  // Handle send message
  const handleSend = async () => {
    if ((!inputText.trim() && selectedMedia.length === 0) || sending) return;

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
    
    setInputText('');
    setSelectedMedia([]);
    setEditingMessageId(null);
    setThinkingMode('thinking');

    try {
      if (editingId) {
        console.log('🔄 Editing message:', editingId);
        await updateMessageAndRegenerate(editingId, text, currentAIModel);
        setGenerating(false);
        setSending(false);
        return;
      }

      console.log('📤 Sending new message with model:', currentAIModel);
      
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

      await sendMessage(text || '[Image]', imageUrl, currentAIModel);
      
      setShowCompletionStatus(true);
      setTimeout(() => {
        setShowCompletionStatus(false);
      }, 2000);
      
      await incrementMessageCount();
      
    } catch (error: any) {
      console.error('❌ Send error:', error);
      const errorMsg = error?.message || (editingId ? 'Failed to update message' : 'Failed to send message');
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

  // Styles
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
    inputWrapper: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.inputBackground,
      borderRadius: BorderRadius.lg,
      paddingHorizontal: Spacing.md,
      minHeight: 44,
      maxHeight: 120,
    },
    input: {
      flex: 1,
      ...Typography.body,
      color: colors.text,
      paddingVertical: Spacing.sm,
      maxHeight: 100,
    },
    recordingIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      gap: Spacing.sm,
    },
    recordingDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#FF3B30',
    },
    recordingText: {
      ...Typography.body,
      color: '#FF3B30',
      fontWeight: '600',
    },
    recordingDuration: {
      ...Typography.caption,
      color: colors.textSecondary,
      marginLeft: 'auto',
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
    processingButton: {
      backgroundColor: colors.textSecondary,
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
      overflow: 'hidden',
    },
    mediaImage: {
      width: '100%',
      height: '100%',
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

  // Determine send button state
  const showSendButton = inputText.trim() || selectedMedia.length > 0;
  const isRecording = recordingState === 'recording';
  const isProcessing = recordingState === 'processing';

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
              {media.type === 'image' ? (
                <Image source={{ uri: media.uri }} style={styles.mediaImage} resizeMode="cover" />
              ) : (
                <Ionicons name="document" size={32} color={colors.textSecondary} style={{ margin: 14 }} />
              )}
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
        <TouchableOpacity 
          style={styles.iconButton} 
          onPress={() => setToolsVisible(true)} 
          disabled={editingMessageId !== null || isRecording}
        >
          <Ionicons 
            name="add-circle-outline" 
            size={24} 
            color={editingMessageId || isRecording ? colors.textSecondary : colors.text} 
          />
        </TouchableOpacity>

        <View style={styles.inputWrapper}>
          {isRecording ? (
            <View style={styles.recordingIndicator}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingText}>Recording...</Text>
              <Text style={styles.recordingDuration}>{formatDuration(recordingDuration)}</Text>
            </View>
          ) : isProcessing ? (
            <View style={styles.recordingIndicator}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={{ ...Typography.body, color: colors.text, marginLeft: Spacing.sm }}>
                Transcribing...
              </Text>
            </View>
          ) : (
            <TextInput
              style={styles.input}
              placeholder={editingMessageId ? "Edit message..." : "Message..."}
              placeholderTextColor={colors.textSecondary}
              value={inputText}
              onChangeText={setInputText}
              multiline
              editable={!sending && !isRecording && !isProcessing}
            />
          )}
        </View>
        
        <TouchableOpacity 
  style={styles.iconButton} 
  onPress={() => router.push('/voice-control')}
  disabled={editingMessageId !== null}
>
  <Ionicons name="call-outline" size={24} color={editingMessageId ? colors.textSecondary : colors.text} />
</TouchableOpacity>


        {editingMessageId && (
          <TouchableOpacity 
            style={styles.iconButton} 
            onPress={handleCancelEdit}
          >
            <Ionicons name="close-circle-outline" size={24} color="#FF3B30" />
          </TouchableOpacity>
        )}

        {showSendButton ? (
          <TouchableOpacity 
            style={styles.sendButton} 
            onPress={handleSend}
            disabled={sending || isRecording || isProcessing}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity 
            style={[
              styles.sendButton, 
              isRecording && styles.recordingButton,
              isProcessing && styles.processingButton
            ]} 
            onPress={toggleRecording}
            disabled={editingMessageId !== null || isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons 
                name={isRecording ? "stop" : "mic"} 
                size={20} 
                color="#FFFFFF" 
              />
            )}
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
