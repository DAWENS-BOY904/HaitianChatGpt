import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  StatusBar,
  Dimensions,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
  FadeIn,
  interpolate,
  withSpring,
} from 'react-native-reanimated';
import { useTheme } from '../hooks/useTheme';
import { useAuth, useAlert } from '@/template';
import { getSupabaseClient } from '@/template';
import { useConversation } from '../hooks/useConversation';
import { Spacing, BorderRadius } from '../constants/theme';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Premium Animated Gradient Colors (matching Kimi style)
const GRADIENT_COLORS = [
  ['#1e3a8a', '#3b82f6', '#60a5fa'], // Deep blue to light blue
  ['#581c87', '#7c3aed', '#a78bfa'], // Deep purple to light purple
  ['#be123c', '#e11d48', '#fb7185'], // Deep rose to light rose
  ['#065f46', '#059669', '#34d399'], // Deep green to light green
  ['#7c2d12', '#ea580c', '#fb923c'], // Deep orange to light orange
];

type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking';

export default function VoiceControlScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const { messages, sendMessage, currentConversation, createConversation } = useConversation();
  const supabase = getSupabaseClient();

  // State
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [userInput, setUserInput] = useState('');
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [currentGradientIndex, setCurrentGradientIndex] = useState(0);
  const [conversationMessages, setConversationMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const scrollViewRef = useRef<ScrollView>(null);
  
  // Recording
  const recordingRef = useRef<Audio.Recording | null>(null);

  // Animations
  const pulseAnimation = useSharedValue(1);
  const gradientAnimation = useSharedValue(0);
  const waveAnimation = useSharedValue(0);

  // Animated gradient background
  useEffect(() => {
    gradientAnimation.value = withRepeat(
      withTiming(1, { duration: 10000, easing: Easing.inOut(Easing.ease) }),
      -1,
      false
    );

    const interval = setInterval(() => {
      setCurrentGradientIndex((prev) => (prev + 1) % GRADIENT_COLORS.length);
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  // Pulse animation for listening state
  useEffect(() => {
    if (voiceState === 'listening' || voiceState === 'speaking') {
      pulseAnimation.value = withRepeat(
        withSequence(
          withTiming(1.3, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
      
      waveAnimation.value = withRepeat(
        withTiming(1, { duration: 1500, easing: Easing.linear }),
        -1,
        false
      );
    } else {
      pulseAnimation.value = withSpring(1);
      waveAnimation.value = 0;
    }
  }, [voiceState]);

  // Auto-create conversation
  useEffect(() => {
    const initConversation = async () => {
      if (!currentConversation && user) {
        await createConversation();
      }
    };
    initConversation();
  }, []);

  // Sync with main conversation
  useEffect(() => {
    if (messages.length > 0) {
      setConversationMessages(messages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      })));
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  const startVoiceRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        showAlert('Permission Required', 'Microphone access is required for voice calls.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      setVoiceState('listening');

      const { recording } = await Audio.Recording.createAsync({
        android: {
          extension: '.m4a',
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
        },
        ios: {
          extension: '.m4a',
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {
          mimeType: 'audio/webm',
          bitsPerSecond: 128000,
        },
      });

      recordingRef.current = recording;
    } catch (error) {
      console.error('Recording error:', error);
      setVoiceState('idle');
      showAlert('Error', 'Failed to start recording. Please try again.');
    }
  };

  const stopVoiceRecording = async () => {
    if (!recordingRef.current) return;

    try {
      setVoiceState('processing');
      
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      
      if (!uri) throw new Error('No recording URI');

      const base64Audio = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Transcribe audio
      const { data, error } = await supabase.functions.invoke('transcribe-audio', {
        body: { audio: base64Audio, userId: user?.id },
      });

      if (!error && data?.text) {
        const userMessage = data.text;
        setConversationMessages(prev => [...prev, { role: 'user', content: userMessage }]);
        
        // Send to unified AI system
        setVoiceState('speaking');
        await sendMessage(userMessage, undefined, 'gemini-2.0-flash-exp');
        
        setTimeout(() => {
          setVoiceState('idle');
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 1000);
      } else {
        throw new Error('Transcription failed');
      }
    } catch (error: any) {
      console.error('Processing error:', error);
      showAlert('Error', 'Failed to process your voice. Please try again.');
      setVoiceState('idle');
    } finally {
      recordingRef.current = null;
    }
  };

  const handleSendText = async () => {
    if (!userInput.trim()) return;

    const text = userInput;
    setUserInput('');
    setConversationMessages(prev => [...prev, { role: 'user', content: text }]);
    
    try {
      setVoiceState('speaking');
      await sendMessage(text, undefined, 'gemini-2.0-flash-exp');
      
      setTimeout(() => {
        setVoiceState('idle');
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 1000);
    } catch (error) {
      console.error('Send message error:', error);
      setVoiceState('idle');
      showAlert('Error', 'Failed to send message. Please try again.');
    }
  };

  const toggleRecording = () => {
    if (voiceState === 'idle') {
      startVoiceRecording();
    } else if (voiceState === 'listening') {
      stopVoiceRecording();
    }
  };

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseAnimation.value }],
  }));

  const waveStyle = (delay: number) => useAnimatedStyle(() => {
    const opacity = interpolate(
      waveAnimation.value,
      [0, 0.5, 1],
      [0.3, 0.8, 0.3]
    );
    const scale = interpolate(
      waveAnimation.value,
      [0, 1],
      [1, 1.5 + delay * 0.3]
    );
    
    return {
      opacity,
      transform: [{ scale }],
    };
  });

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#000',
    },
    gradient: {
      ...StyleSheet.absoluteFillObject,
      opacity: 0.95,
    },
    content: {
      flex: 1,
      paddingTop: Platform.select({ ios: insets.top, android: insets.top, default: 0 }),
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.md,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: '#FFF',
      letterSpacing: 0.5,
    },
    settingsButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(255, 255, 255, 0.15)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    statusContainer: {
      alignItems: 'center',
      paddingVertical: 40,
    },
    statusText: {
      fontSize: 16,
      color: 'rgba(255, 255, 255, 0.90)',
      fontWeight: '600',
      marginTop: 16,
      textShadowColor: 'rgba(0, 0, 0, 0.3)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 3,
    },
    conversationArea: {
      flex: 1,
      paddingHorizontal: Spacing.lg,
      marginBottom: Spacing.xl,
    },
    messageBubble: {
      backgroundColor: 'rgba(255, 255, 255, 0.12)',
      borderRadius: 20,
      padding: 16,
      marginBottom: 12,
      maxWidth: '80%',
      backdropFilter: 'blur(10px)',
    },
    userBubble: {
      alignSelf: 'flex-end',
      backgroundColor: 'rgba(0, 122, 255, 0.25)',
    },
    assistantBubble: {
      alignSelf: 'flex-start',
      backgroundColor: 'rgba(255, 255, 255, 0.15)',
    },
    messageText: {
      fontSize: 16,
      color: '#FFF',
      lineHeight: 22,
    },
    inputArea: {
      borderTopWidth: 1,
      borderTopColor: 'rgba(255, 255, 255, 0.10)',
      backgroundColor: 'rgba(0, 0, 0, 0.60)',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      backdropFilter: 'blur(20px)',
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    textInput: {
      flex: 1,
      backgroundColor: 'rgba(255, 255, 255, 0.10)',
      borderRadius: 24,
      paddingHorizontal: 18,
      paddingVertical: 12,
      fontSize: 16,
      color: '#FFF',
      maxHeight: 120,
    },
    sendButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: '#007AFF',
      alignItems: 'center',
      justifyContent: 'center',
    },
    keyboardToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
    },
    keyboardToggleText: {
      fontSize: 14,
      color: 'rgba(255, 255, 255, 0.60)',
      fontWeight: '500',
    },
    controls: {
      alignItems: 'center',
      paddingVertical: 40,
      paddingBottom: Platform.select({ ios: insets.bottom + 40, android: 40, default: 40 }),
    },
    microphoneContainer: {
      position: 'relative',
      alignItems: 'center',
      justifyContent: 'center',
    },
    waveRing: {
      position: 'absolute',
      width: 140,
      height: 140,
      borderRadius: 70,
      borderWidth: 2,
      borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    micButton: {
      width: 90,
      height: 90,
      borderRadius: 45,
      backgroundColor: 'rgba(255, 255, 255, 0.25)',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 4,
      borderColor: 'rgba(255, 255, 255, 0.8)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.5,
      shadowRadius: 20,
      elevation: 15,
    },
    micButtonActive: {
      backgroundColor: '#FF3B30',
      borderColor: '#FF3B30',
    },
    stateLabel: {
      fontSize: 15,
      color: '#FFF',
      fontWeight: '600',
      marginTop: 20,
      letterSpacing: 0.5,
    },
  });

  const currentGradient = GRADIENT_COLORS[currentGradientIndex];
  const nextGradient = GRADIENT_COLORS[(currentGradientIndex + 1) % GRADIENT_COLORS.length];

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="light-content" />
      
      {/* Animated Gradient Background */}
      <LinearGradient
        colors={currentGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      />

      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>HaitianChatGPT</Text>
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => router.push('/voice-settings')}
          >
            <Ionicons name="settings-outline" size={22} color="#FFF" />
          </TouchableOpacity>
        </View>

        {/* Status Indicator */}
        <View style={styles.statusContainer}>
          <Text style={styles.statusText}>
            {voiceState === 'idle' && 'Ready to chat'}
            {voiceState === 'listening' && 'Listening...'}
            {voiceState === 'processing' && 'Processing...'}
            {voiceState === 'speaking' && 'AI is responding...'}
          </Text>
        </View>

        {/* Conversation History */}
        {showKeyboard && conversationMessages.length > 0 && (
          <ScrollView
            ref={scrollViewRef}
            style={styles.conversationArea}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
          >
            {conversationMessages.map((msg, index) => (
              <View
                key={index}
                style={[
                  styles.messageBubble,
                  msg.role === 'user' ? styles.userBubble : styles.assistantBubble,
                ]}
              >
                <Text style={styles.messageText}>{msg.content}</Text>
              </View>
            ))}
          </ScrollView>
        )}

        {/* Microphone Controls */}
        <View style={styles.controls}>
          <View style={styles.microphoneContainer}>
            {(voiceState === 'listening' || voiceState === 'speaking') && (
              <>
                <Animated.View style={[styles.waveRing, waveStyle(0)]} />
                <Animated.View style={[styles.waveRing, waveStyle(0.3)]} />
                <Animated.View style={[styles.waveRing, waveStyle(0.6)]} />
              </>
            )}
            
            <Animated.View style={pulseStyle}>
              <TouchableOpacity
                style={[
                  styles.micButton,
                  (voiceState === 'listening' || voiceState === 'speaking') && styles.micButtonActive
                ]}
                onPress={toggleRecording}
                disabled={voiceState === 'processing'}
              >
                {voiceState === 'processing' ? (
                  <ActivityIndicator size="large" color="#FFF" />
                ) : (
                  <Ionicons
                    name={voiceState === 'idle' ? 'mic' : 'stop'}
                    size={40}
                    color="#FFF"
                  />
                )}
              </TouchableOpacity>
            </Animated.View>
          </View>
          
          <Text style={styles.stateLabel}>
            {voiceState === 'idle' && 'Tap to speak'}
            {voiceState === 'listening' && 'Listening...'}
            {voiceState === 'processing' && 'Processing...'}
            {voiceState === 'speaking' && 'AI Speaking...'}
          </Text>
        </View>

        {/* Keyboard Input */}
        {showKeyboard && (
          <View style={styles.inputArea}>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.textInput}
                placeholder="Type to chat with AI..."
                placeholderTextColor="rgba(255, 255, 255, 0.40)"
                value={userInput}
                onChangeText={setUserInput}
                multiline
              />
              <TouchableOpacity style={styles.sendButton} onPress={handleSendText}>
                <Ionicons name="arrow-up" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Keyboard Toggle */}
        <TouchableOpacity
          style={styles.keyboardToggle}
          onPress={() => setShowKeyboard(!showKeyboard)}
        >
          <Ionicons name="keypad-outline" size={18} color="rgba(255, 255, 255, 0.60)" />
          <Text style={styles.keyboardToggleText}>
            {showKeyboard ? 'Hide keyboard' : 'Show keyboard'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

