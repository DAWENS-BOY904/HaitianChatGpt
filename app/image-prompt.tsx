/**
 * image-prompt.tsx — "Home Photo" page
 * A second home page for AI image generation with an uploaded photo.
 * User picks a photo from images page, sees it here with a prompt input,
 * taps send → AI transforms the photo.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  StatusBar,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useAuth, useAlert } from '@/template';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Spacing, BorderRadius } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSupabaseClient } from '@/template';
import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text?: string;
  imageUri?: string;     // user uploaded photo
  generatedUrl?: string; // AI result
  loading?: boolean;
}

type RecordingState = 'idle' | 'recording' | 'processing';

export default function ImagePromptScreen() {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const supabase = getSupabaseClient();

  // Params passed from images page
  const { imageUri: initUri, base64: initB64, stylePrompt: initPrompt } =
    useLocalSearchParams<{ imageUri: string; base64: string; stylePrompt: string }>();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState(initPrompt || '');
  const [selectedImage, setSelectedImage] = useState<{ uri: string; base64: string } | null>(
    initUri ? { uri: initUri, base64: initB64 || '' } : null
  );
  const [sending, setSending] = useState(false);
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const flatListRef = useRef<FlatList>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);

  // Auto-send on mount if we have an initial image + prompt
  useEffect(() => {
    if (initUri && initPrompt) {
      handleSend();
    }
  }, []);

  const handleSend = useCallback(async () => {
    if (!inputText.trim() && !selectedImage) return;
    if (sending) return;

    const text = inputText.trim();
    const img = selectedImage;

    setSending(true);
    setInputText('');
    setSelectedImage(null);

    // Add user message
    const userId = `user-${Date.now()}`;
    const assistantId = `ai-${Date.now()}`;

    setMessages(prev => [
      ...prev,
      {
        id: userId,
        role: 'user',
        text,
        imageUri: img?.uri,
      },
      {
        id: assistantId,
        role: 'assistant',
        loading: true,
      },
    ]);

    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      let base64ToSend = img?.base64;

      // If we have a URI but no base64, read it
      if (img?.uri && !base64ToSend) {
        try {
          base64ToSend = await FileSystem.readAsStringAsync(img.uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
        } catch {}
      }

      const { data, error } = await supabase.functions.invoke('chat', {
        body: {
          messages: [
            {
              role: 'user',
              content: text || 'Generate an image',
              image_url: img?.uri,
            },
          ],
          conversationId: `image-prompt-${Date.now()}`,
          aiModel: 'google-gemini',
          base64Image: base64ToSend,
        },
      });

      if (error) throw error;

      const aiImageUrl = data?.imageUrl;
      const aiText = data?.message || 'Image created ✨';

      setMessages(prev =>
        prev.map(m =>
          m.id === assistantId
            ? { ...m, loading: false, generatedUrl: aiImageUrl, text: aiText }
            : m
        )
      );

      // ── Auto-save AI-generated image to media_files (My Images) ──
      if (aiImageUrl && user?.id) {
        try {
          const { data: existing } = await supabase
            .from('media_files')
            .select('id')
            .eq('user_id', user.id)
            .eq('file_url', aiImageUrl)
            .maybeSingle();
          if (!existing) {
            await supabase.from('media_files').insert({
              user_id: user.id,
              file_type: 'image',
              file_url: aiImageUrl,
              file_name: `ai_image_${Date.now()}.jpg`,
            });
          }
        } catch (_e) {}
      }
    } catch (err: any) {
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantId
            ? { ...m, loading: false, text: 'Failed to generate image. Please try again.' }
            : m
        )
      );
    } finally {
      setSending(false);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 200);
    }
  }, [inputText, selectedImage, sending, supabase]);

  const handlePickPhoto = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showAlert('Permission required', 'Please allow photo library access');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      setSelectedImage({ uri: result.assets[0].uri, base64: result.assets[0].base64 || '' });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [showAlert]);

  const handleTakeSelfie = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      showAlert('Permission required', 'Please allow camera access');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.9,
      base64: true,
      cameraType: ImagePicker.CameraType.front,
    });
    if (!result.canceled && result.assets[0]) {
      setSelectedImage({ uri: result.assets[0].uri, base64: result.assets[0].base64 || '' });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [showAlert]);

  const handlePickImageOptions = () => {
    Alert.alert(
      'Add Photo',
      '',
      [
        { text: 'Choose Photo', onPress: handlePickPhoto },
        { text: 'Take Selfie', onPress: handleTakeSelfie },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  // Voice
  const toggleRecording = useCallback(async () => {
    if (recordingState === 'recording') {
      // Stop
      setRecordingState('processing');
      try {
        await recordingRef.current?.stopAndUnloadAsync();
        const uri = recordingRef.current?.getURI();
        if (uri) {
          const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
          const { data, error } = await supabase.functions.invoke('transcribe-audio', {
            body: { audio: b64, userId: user?.id },
          });
          if (!error && data?.text) {
            setInputText(prev => prev + (prev ? ' ' : '') + data.text.trim());
          }
        }
      } catch {}
      recordingRef.current = null;
      setRecordingState('idle');
    } else {
      // Start
      try {
        const { status } = await Audio.requestPermissionsAsync();
        if (status !== 'granted') { showAlert('Permission', 'Microphone access required'); return; }
        await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
        const { recording } = await Audio.Recording.createAsync({
          android: {
            extension: '.m4a',
            outputFormat: Audio.AndroidOutputFormat.MPEG_4,
            audioEncoder: Audio.AndroidAudioEncoder.AAC,
            sampleRate: 16000,
            numberOfChannels: 1,
            bitRate: 64000,
          },
          ios: {
            extension: '.m4a',
            audioQuality: Audio.IOSAudioQuality.MEDIUM,
            sampleRate: 16000,
            numberOfChannels: 1,
            bitRate: 64000,
            linearPCMBitDepth: 16,
            linearPCMIsBigEndian: false,
            linearPCMIsFloat: false,
          },
          web: { mimeType: 'audio/webm', bitsPerSecond: 64000 },
        });
        recordingRef.current = recording;
        setRecordingState('recording');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch (e) {
        showAlert('Error', 'Could not start recording');
      }
    }
  }, [recordingState, supabase, user?.id, showAlert]);

  const handleDownloadImage = async (url: string) => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') { showAlert('Permission', 'Photo library access required'); return; }
      const fileUri = `${FileSystem.documentDirectory}ai_img_${Date.now()}.jpg`;
      const dl = await FileSystem.downloadAsync(url, fileUri);
      await MediaLibrary.createAssetAsync(dl.uri);
      showAlert('Saved', 'Image saved to your photos!');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      showAlert('Error', 'Failed to save image');
    }
  };

  const accentColor = '#10A37F';

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    if (item.role === 'user') {
      return (
        <View style={localStyles.userMsgContainer}>
          {item.imageUri ? (
            <Image
              source={{ uri: item.imageUri }}
              style={localStyles.userPhoto}
              contentFit="cover"
              transition={200}
            />
          ) : null}
          {item.text ? (
            <View style={[localStyles.userBubble, { backgroundColor: '#7C3AED' }]}>
              <Text style={localStyles.userBubbleText}>{item.text}</Text>
            </View>
          ) : null}
        </View>
      );
    }

    // Assistant
    return (
      <View style={localStyles.aiBubbleContainer}>
        {item.loading ? (
          <View style={localStyles.loadingDot}>
            <ActivityIndicator size="small" color="rgba(255,255,255,0.5)" />
          </View>
        ) : (
          <>
            {item.text && !item.generatedUrl && (
              <Text style={[localStyles.aiText, { color: colors.text }]}>{item.text}</Text>
            )}
            {item.generatedUrl ? (
              <View style={{ position: 'relative' }}>
                <Image
                  source={{ uri: item.generatedUrl }}
                  style={localStyles.generatedImage}
                  contentFit="cover"
                  transition={300}
                />
                <TouchableOpacity
                  style={localStyles.downloadBtn}
                  onPress={() => handleDownloadImage(item.generatedUrl!)}
                >
                  <Ionicons name="download" size={20} color="#FFF" />
                </TouchableOpacity>
              </View>
            ) : null}
            {item.generatedUrl && item.text ? (
              <Text style={[localStyles.aiCaption, { color: colors.textSecondary }]}>{item.text}</Text>
            ) : null}
          </>
        )}
      </View>
    );
  };

  return (
    <View style={[localStyles.container, { backgroundColor: '#000' }]}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* Header */}
      <View style={[localStyles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="close" size={26} color="#FFF" />
        </TouchableOpacity>
        <Text style={localStyles.headerTitle}>Dawinix Images</Text>
        <View style={{ width: 26 }} />
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={item => item.id}
        contentContainerStyle={{ paddingVertical: 16 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={localStyles.emptyWrap}>
            <Ionicons name="image-outline" size={48} color="rgba(255,255,255,0.2)" />
            <Text style={localStyles.emptyText}>
              Upload a photo and describe what you want to create
            </Text>
          </View>
        }
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />

      {/* Input area */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* Selected image preview */}
        {selectedImage && (
          <View style={localStyles.previewWrap}>
            <Image source={{ uri: selectedImage.uri }} style={localStyles.previewThumb} contentFit="cover" />
            <TouchableOpacity
              style={localStyles.previewRemove}
              onPress={() => setSelectedImage(null)}
            >
              <Ionicons name="close" size={12} color="#FFF" />
            </TouchableOpacity>
          </View>
        )}

        <View style={[
          localStyles.inputBar,
          { paddingBottom: insets.bottom + 12 }
        ]}>
          {/* Photo pick button */}
          <TouchableOpacity style={localStyles.iconBtn} onPress={handlePickImageOptions}>
            <Ionicons name="image-outline" size={26} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>

          <TextInput
            style={localStyles.input}
            placeholder="Describe an image"
            placeholderTextColor="rgba(255,255,255,0.35)"
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={1000}
            editable={!sending}
          />

          {/* Voice button */}
          <TouchableOpacity
            style={localStyles.iconBtn}
            onPress={toggleRecording}
          >
            {recordingState === 'processing' ? (
              <ActivityIndicator size="small" color={accentColor} />
            ) : (
              <Ionicons
                name={recordingState === 'recording' ? 'stop-circle' : 'mic-outline'}
                size={24}
                color={recordingState === 'recording' ? '#FF3B30' : 'rgba(255,255,255,0.7)'}
              />
            )}
          </TouchableOpacity>

          {/* Send button */}
          <TouchableOpacity
            style={[
              localStyles.sendBtn,
              { backgroundColor: (inputText.trim() || selectedImage) ? accentColor : 'rgba(255,255,255,0.15)' }
            ]}
            onPress={handleSend}
            disabled={sending || (!inputText.trim() && !selectedImage)}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Ionicons name="arrow-up" size={18} color="#FFF" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const localStyles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFF',
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 40,
    gap: 16,
  },
  emptyText: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  userMsgContainer: {
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    marginBottom: 12,
    gap: 8,
  },
  userPhoto: {
    width: SCREEN_WIDTH * 0.55,
    height: SCREEN_WIDTH * 0.55,
    borderRadius: 20,
  },
  userBubble: {
    maxWidth: SCREEN_WIDTH * 0.75,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderBottomRightRadius: 4,
  },
  userBubbleText: {
    color: '#FFF',
    fontSize: 15,
    lineHeight: 22,
  },
  aiBubbleContainer: {
    paddingHorizontal: 16,
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  loadingDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiText: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 6,
  },
  aiCaption: {
    fontSize: 13,
    marginTop: 6,
    lineHeight: 18,
  },
  generatedImage: {
    width: SCREEN_WIDTH * 0.72,
    height: SCREEN_WIDTH * 0.72,
    borderRadius: 20,
  },
  downloadBtn: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  previewWrap: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 8,
    position: 'relative',
    alignSelf: 'flex-start',
  },
  previewThumb: {
    width: 56,
    height: 56,
    borderRadius: 10,
  },
  previewRemove: {
    position: 'absolute',
    top: -6,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 10,
    gap: 8,
    backgroundColor: '#111',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    color: '#FFF',
    fontSize: 16,
    paddingVertical: 8,
    maxHeight: 100,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
