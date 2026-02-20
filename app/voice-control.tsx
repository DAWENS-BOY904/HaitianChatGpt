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
import { BlurView } from 'expo-blur';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
  FadeIn,
} from 'react-native-reanimated';
import { useTheme } from '../hooks/useTheme';
import { useAuth, useAlert } from '@/template';
import { getSupabaseClient } from '@/template';
import { Spacing, BorderRadius } from '../constants/theme';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Glassmorphism theme
const GLASS = {
  bg: 'linear-gradient(135deg, rgba(25, 55, 95, 0.95), rgba(35, 75, 110, 0.95))',
  bgDark: 'rgba(18, 38, 65, 0.98)',
  surface: 'rgba(44, 64, 90, 0.70)',
  border: 'rgba(255, 255, 255, 0.10)',
  text: '#FFFFFF',
  textSecondary: 'rgba(255, 255, 255, 0.70)',
  accent: '#0A84FF',
  error: '#FF453A',
};

type CallState = 'connecting' | 'connected' | 'ended';

export default function VoiceControlScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const supabase = getSupabaseClient();

  // State
  const [callState, setCallState] = useState<CallState>('connecting');
  const [aiTranscription, setAiTranscription] = useState('');
  const [userInput, setUserInput] = useState('');
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [connectionDots, setConnectionDots] = useState(0);
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string; color: string }>>([]);
  const scrollViewRef = useRef<ScrollView>(null);
  
  // Multi-color palette for message backgrounds
  const colorPalette = [
    'rgba(10, 132, 255, 0.25)',   // Blue
    'rgba(175, 82, 222, 0.25)',   // Purple
    'rgba(255, 55, 95, 0.25)',    // Pink
    'rgba(52, 199, 89, 0.25)',    // Green
    'rgba(255, 149, 0, 0.25)',    // Orange
    'rgba(90, 200, 250, 0.25)',   // Cyan
  ];
  
  // Recording
  const recordingRef = useRef<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  // Animations
  const pulseAnimation = useSharedValue(1);
  const dotAnimation = useSharedValue(0);

  useEffect(() => {
    // Pulse animation for status dots
    pulseAnimation.value = withRepeat(
      withSequence(
        withTiming(1.2, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );

    // Connecting animation
    if (callState === 'connecting') {
      const interval = setInterval(() => {
        setConnectionDots(prev => (prev + 1) % 8);
      }, 200);

      // Auto-connect after 2 seconds
      const timeout = setTimeout(() => {
        setCallState('connected');
        setAiTranscription('Hi, how are you today?');
        setMessages([{ role: 'assistant', content: 'Hi, how are you today?', color: colorPalette[0] }]);
        startListening();
      }, 2000);

      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }
  }, [callState]);

  const startListening = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        showAlert('Permission Denied', 'Microphone access is required for voice calls.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

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
      setIsRecording(true);

      // Auto-process every 5 seconds for real-time transcription
      setInterval(async () => {
        if (recordingRef.current && !isPaused) {
          await processVoiceInput();
        }
      }, 5000);

    } catch (error) {
      console.error('Failed to start listening:', error);
    }
  };

  const processVoiceInput = async () => {
    try {
      if (!recordingRef.current) return;

      // Stop current recording
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      
      if (!uri) return;

      // Read as base64
      const base64Audio = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Transcribe
      const { data, error } = await supabase.functions.invoke('transcribe-audio', {
        body: { audio: base64Audio, userId: user?.id },
      });

      if (!error && data?.text) {
        const userMessage = data.text;
        const userColor = colorPalette[messages.length % colorPalette.length];
        setMessages(prev => [...prev, { role: 'user', content: userMessage, color: userColor }]);
        
        // Scroll to bottom
        setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
        
        // Get AI response
        await getAIResponse(userMessage);
      }

      // Restart recording
      startListening();

    } catch (error) {
      console.error('Voice processing error:', error);
    }
  };

  const getAIResponse = async (userMessage: string) => {
    try {
      setAiTranscription('Thinking...');

      const { data, error } = await supabase.functions.invoke('chat', {
        body: {
          messages: [
            ...messages.map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: userMessage }
          ],
          aiModel: 'gemini',
        },
      });

      if (!error && data?.message) {
        const aiColor = colorPalette[(messages.length + 1) % colorPalette.length];
        setAiTranscription(data.message);
        setMessages(prev => [...prev, { role: 'assistant', content: data.message, color: aiColor }]);
        
        // Scroll to bottom after AI response
        setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
      }
    } catch (error) {
      console.error('AI response error:', error);
    }
  };

  const handleSendText = async () => {
    if (!userInput.trim()) return;

    const text = userInput;
    const userColor = colorPalette[messages.length % colorPalette.length];
    setUserInput('');
    setMessages(prev => [...prev, { role: 'user', content: text, color: userColor }]);
    
    // Scroll to bottom
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    
    await getAIResponse(text);
  };

  const handleEndCall = async () => {
    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
      } catch (e) {}
      recordingRef.current = null;
    }
    
    setCallState('ended');
    setTimeout(() => router.back(), 500);
  };

  const handlePauseCall = () => {
    setIsPaused(!isPaused);
  };

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseAnimation.value }],
  }));

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: GLASS.bgDark,
      paddingTop: Platform.select({ ios: insets.top, android: insets.top, default: 0 }),
    },
    blurBackground: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.md,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    headerIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: 'rgba(255, 255, 255, 0.15)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: GLASS.text,
    },
    headerRight: {
      flexDirection: 'row',
      gap: 16,
    },
    iconButton: {
      padding: 8,
    },
    statusIndicator: {
      alignItems: 'center',
      paddingVertical: 40,
    },
    statusDots: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 20,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: 'rgba(255, 255, 255, 0.3)',
    },
    dotActive: {
      backgroundColor: GLASS.accent,
    },
    statusText: {
      fontSize: 16,
      color: GLASS.text,
      fontWeight: '500',
    },
    transcriptionArea: {
      flex: 1,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.xl,
    },
    transcriptionBubble: {
      backgroundColor: 'rgba(60, 60, 67, 0.60)',
      borderRadius: 18,
      padding: 20,
      minHeight: 100,
      borderWidth: 1,
      borderColor: GLASS.border,
    },
    transcriptionText: {
      fontSize: 18,
      color: GLASS.text,
      lineHeight: 26,
    },
    conversationHistory: {
      paddingHorizontal: Spacing.lg,
      marginBottom: Spacing.xl,
    },
    messageBubble: {
      backgroundColor: 'rgba(60, 60, 67, 0.50)',
      borderRadius: 16,
      padding: 14,
      marginBottom: 10,
      maxWidth: '80%',
    },
    userBubble: {
      alignSelf: 'flex-end',
    },
    assistantBubble: {
      alignSelf: 'flex-start',
    },
    messageText: {
      fontSize: 15,
      color: GLASS.text,
      lineHeight: 21,
    },
    inputArea: {
      borderTopWidth: 1,
      borderTopColor: GLASS.border,
      backgroundColor: 'rgba(30, 30, 30, 0.80)',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    textInput: {
      flex: 1,
      backgroundColor: 'rgba(60, 60, 67, 0.50)',
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 10,
      fontSize: 16,
      color: GLASS.text,
      maxHeight: 100,
    },
    sendButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: GLASS.accent,
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
      color: GLASS.textSecondary,
      fontWeight: '500',
    },
    controls: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 40,
      paddingVertical: 40,
      paddingBottom: Platform.select({ ios: insets.bottom + 40, android: 40, default: 40 }),
    },
    controlButton: {
      alignItems: 'center',
      gap: 8,
    },
    endButton: {
      width: 70,
      height: 70,
      borderRadius: 35,
      backgroundColor: '#FF453A',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#FF453A',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 12,
      elevation: 8,
    },
    pauseButton: {
      width: 70,
      height: 70,
      borderRadius: 35,
      backgroundColor: 'rgba(255, 255, 255, 0.20)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    controlLabel: {
      fontSize: 14,
      color: GLASS.text,
      fontWeight: '500',
    },
  });

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="light-content" />
      <BlurView intensity={30} tint="dark" style={styles.blurBackground} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIcon}>
            <Ionicons name="sparkles" size={18} color={GLASS.text} />
          </View>
          <Text style={styles.headerTitle}>Kimi</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.iconButton}>
            <Ionicons name="volume-high-outline" size={24} color={GLASS.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton} onPress={() => router.push('/settings')}>
            <Ionicons name="settings-outline" size={24} color={GLASS.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Status Indicator */}
      <View style={styles.statusIndicator}>
        <View style={styles.statusDots}>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((index) => (
            <Animated.View
              key={index}
              style={[
                styles.dot,
                (callState === 'connecting' && index === connectionDots) && styles.dotActive,
                (callState === 'connected' && index < 7) && styles.dotActive,
                (callState === 'connecting' && index === connectionDots) && pulseStyle,
              ]}
            />
          ))}
        </View>
        <Text style={styles.statusText}>
          {callState === 'connecting' && 'Connecting...'}
          {callState === 'connected' && (isPaused ? 'Paused' : 'Connected')}
          {callState === 'ended' && 'Call Ended'}
        </Text>
      </View>

      {/* AI Transcription */}
      {callState === 'connected' && (
        <Animated.View entering={FadeIn} style={styles.transcriptionArea}>
          <View style={styles.transcriptionBubble}>
            <Text style={styles.transcriptionText}>
              {aiTranscription || 'Listening...'}
            </Text>
          </View>
        </Animated.View>
      )}

      {/* Conversation History - Shows ALL messages with scrolling */}
      {showKeyboard && messages.length > 0 && (
        <ScrollView 
          ref={scrollViewRef}
          style={styles.conversationHistory}
          showsVerticalScrollIndicator={true}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.map((msg, index) => (
            <View
              key={index}
              style={[
                styles.messageBubble,
                msg.role === 'user' ? styles.userBubble : styles.assistantBubble,
                { backgroundColor: msg.color },
              ]}
            >
              <Text style={styles.messageText}>{msg.content}</Text>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Keyboard Input */}
      {showKeyboard && (
        <View style={styles.inputArea}>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.textInput}
              placeholder="Type to continue chatting with Kimi"
              placeholderTextColor={GLASS.textSecondary}
              value={userInput}
              onChangeText={setUserInput}
              multiline
            />
            <TouchableOpacity style={styles.sendButton} onPress={handleSendText}>
              <Ionicons name="arrow-up" size={22} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Keyboard Toggle */}
      {callState === 'connected' && (
        <TouchableOpacity
          style={styles.keyboardToggle}
          onPress={() => setShowKeyboard(!showKeyboard)}
        >
          <Ionicons name="keypad-outline" size={18} color={GLASS.textSecondary} />
          <Text style={styles.keyboardToggleText}>
            {showKeyboard ? 'Hide keyboard' : 'Tap to show keyboard'}
          </Text>
        </TouchableOpacity>
      )}

      {/* Call Controls */}
      <View style={styles.controls}>
        <TouchableOpacity style={styles.controlButton} onPress={handleEndCall}>
          <View style={styles.endButton}>
            <Ionicons name="call" size={32} color="#FFF" />
          </View>
          <Text style={styles.controlLabel}>End</Text>
        </TouchableOpacity>

        {callState === 'connected' && (
          <TouchableOpacity style={styles.controlButton} onPress={handlePauseCall}>
            <View style={styles.pauseButton}>
              <Ionicons name={isPaused ? "play" : "pause"} size={32} color={GLASS.text} />
            </View>
            <Text style={styles.controlLabel}>Pause</Text>
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
