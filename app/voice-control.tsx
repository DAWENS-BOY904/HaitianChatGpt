import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  StatusBar,
  Dimensions,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { useTheme } from '../hooks/useTheme';
import { useAuth, useAlert } from '@/template';
import { getSupabaseClient } from '@/template';
import { useConversation } from '../hooks/useConversation';
import { Spacing, BorderRadius } from '../constants/theme';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { FunctionsHttpError } from '@supabase/supabase-js';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const GRADIENT_COLORS: [string, string, string][] = [
  ['#1e3a8a', '#3b82f6', '#60a5fa'],
  ['#581c87', '#7c3aed', '#a78bfa'],
  ['#be123c', '#e11d48', '#fb7185'],
  ['#065f46', '#059669', '#34d399'],
];

type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking';

interface ConvMessage { role: 'user' | 'assistant'; content: string }

export default function VoiceControlScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const { sendMessage, currentConversation, createConversation } = useConversation();
  const supabase = getSupabaseClient();

  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [messages, setMessages] = useState<ConvMessage[]>([]);
  const [userInput, setUserInput] = useState('');
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [gradientIdx, setGradientIdx] = useState(0);
  const [statusText, setStatusText] = useState('Tap to speak');

  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  // Animations
  const pulse = useSharedValue(1);
  const wave = useSharedValue(0);

  useEffect(() => {
    const t = setInterval(() => setGradientIdx(i => (i + 1) % GRADIENT_COLORS.length), 8000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (voiceState === 'listening' || voiceState === 'speaking') {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.3, { duration: 700, easing: Easing.inOut(Easing.ease) }),
          withTiming(1.0, { duration: 700, easing: Easing.inOut(Easing.ease) })
        ), -1, false
      );
      wave.value = withRepeat(withTiming(1, { duration: 1200, easing: Easing.linear }), -1, false);
    } else {
      pulse.value = withSpring(1);
      wave.value = withTiming(0, { duration: 300 });
    }
  }, [voiceState]);

  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));
  const makeWaveStyle = (offset: number) => useAnimatedStyle(() => ({
    opacity: interpolate(wave.value, [0, 0.5, 1], [0.15, 0.5, 0.15]),
    transform: [{ scale: interpolate(wave.value, [0, 1], [1, 1.6 + offset * 0.3]) }],
  }));
  const wave1 = makeWaveStyle(0);
  const wave2 = makeWaveStyle(0.4);
  const wave3 = makeWaveStyle(0.8);

  // Greet on mount
  useEffect(() => {
    const greet = async () => {
      await speakText("Hey! I'm here. How can I help you?");
      setMessages([{ role: 'assistant', content: "Hey! I'm here. How can I help you?" }]);
    };
    const t = setTimeout(greet, 800);
    return () => clearTimeout(t);
  }, []);

  // Scroll to bottom
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  // ── REAL TTS: use generate-tts edge function ──
  const speakText = useCallback(async (text: string) => {
    try {
      // Stop any current playback
      if (soundRef.current) {
        try { await soundRef.current.stopAsync(); await soundRef.current.unloadAsync(); } catch {}
        soundRef.current = null;
      }

      setVoiceState('speaking');
      setStatusText('AI is speaking...');

      // Call the generate-tts edge function
      const { data, error } = await supabase.functions.invoke('generate-tts', {
        body: { text: text.slice(0, 500), voice: 'alloy', format: 'mp3' },
      });

      if (error) throw error;

      // data should be base64 audio or a URL
      let audioUri = '';
      if (data?.audioUrl) {
        audioUri = data.audioUrl;
      } else if (data?.audio) {
        // base64 audio
        const fileUri = `${FileSystem.documentDirectory}tts_${Date.now()}.mp3`;
        await FileSystem.writeAsStringAsync(fileUri, data.audio, {
          encoding: FileSystem.EncodingType.Base64,
        });
        audioUri = fileUri;
      } else if (data?.url) {
        audioUri = data.url;
      }

      if (audioUri) {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
        });
        const { sound } = await Audio.Sound.createAsync(
          { uri: audioUri },
          { shouldPlay: true, volume: 1.0 }
        );
        soundRef.current = sound;
        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded && status.didJustFinish) {
            setVoiceState('idle');
            setStatusText('Tap to speak');
            sound.unloadAsync().catch(() => {});
            soundRef.current = null;
          }
        });
      } else {
        setVoiceState('idle');
        setStatusText('Tap to speak');
      }
    } catch (e) {
      console.error('TTS error:', e);
      setVoiceState('idle');
      setStatusText('Tap to speak');
    }
  }, [supabase]);

  // ── START RECORDING ──
  const startRecording = async () => {
    try {
      // Stop TTS if playing
      if (soundRef.current) {
        try { await soundRef.current.stopAsync(); } catch {}
      }

      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        showAlert('Permission Required', 'Microphone access is required.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
      });

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
      setVoiceState('listening');
      setStatusText('Listening...');
    } catch (e) {
      console.error('Recording start error:', e);
      showAlert('Error', 'Could not start microphone.');
      setVoiceState('idle');
    }
  };

  // ── STOP + PROCESS ──
  const stopAndProcess = async () => {
    if (!recordingRef.current) return;

    try {
      setVoiceState('processing');
      setStatusText('Processing...');

      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      if (!uri) throw new Error('No recording URI');

      const base64Audio = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Transcribe
      const { data: txData, error: txError } = await supabase.functions.invoke('transcribe-audio', {
        body: { audio: base64Audio, userId: user?.id },
      });

      if (txError || !txData?.text?.trim()) {
        showAlert('Could not understand', 'Please try again.');
        setVoiceState('idle');
        setStatusText('Tap to speak');
        return;
      }

      const userText = txData.text.trim();
      setMessages(prev => [...prev, { role: 'user', content: userText }]);

      // Get AI response
      const { data: aiData, error: aiError } = await supabase.functions.invoke('chat', {
        body: {
          messages: [
            ...messages.slice(-8).map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: userText },
          ],
          conversationId: currentConversation?.id || `voice-${Date.now()}`,
          aiModel: 'gemini',
        },
      });

      let aiReply = 'Sorry, I could not respond right now.';
      if (!aiError && aiData?.message) {
        aiReply = aiData.message;
      } else if (aiError instanceof FunctionsHttpError) {
        try { const t = await aiError.context?.text(); aiReply = t || aiReply; } catch {}
      }

      // Strip markdown for speech
      const spokenText = aiReply
        .replace(/```[\s\S]*?```/g, 'Here is the code.')
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        .replace(/#{1,6}\s/g, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .trim();

      setMessages(prev => [...prev, { role: 'assistant', content: aiReply }]);
      await speakText(spokenText);
    } catch (e: any) {
      console.error('Voice process error:', e);
      showAlert('Error', 'Something went wrong. Please try again.');
      setVoiceState('idle');
      setStatusText('Tap to speak');
    }
  };

  const toggleMic = () => {
    if (voiceState === 'idle') startRecording();
    else if (voiceState === 'listening') stopAndProcess();
  };

  const handleSendText = async () => {
    if (!userInput.trim() || voiceState === 'processing' || voiceState === 'speaking') return;
    const text = userInput.trim();
    setUserInput('');
    setMessages(prev => [...prev, { role: 'user', content: text }]);

    setVoiceState('processing');
    setStatusText('Processing...');

    try {
      const { data, error } = await supabase.functions.invoke('chat', {
        body: {
          messages: [
            ...messages.slice(-8).map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: text },
          ],
          conversationId: currentConversation?.id || `voice-${Date.now()}`,
          aiModel: 'gemini',
        },
      });
      const reply = data?.message || 'Sorry, no response.';
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
      await speakText(reply.slice(0, 500));
    } catch {
      setVoiceState('idle');
      setStatusText('Tap to speak');
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync().catch(() => {});
      recordingRef.current?.stopAndUnloadAsync().catch(() => {});
    };
  }, []);

  const gradient = GRADIENT_COLORS[gradientIdx];

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle="light-content" />

      <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="chevron-down" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Voice AI</Text>
        <TouchableOpacity onPress={() => router.push('/voice-settings')} style={styles.headerBtn}>
          <Ionicons name="settings-outline" size={22} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* Status */}
      <View style={styles.statusWrap}>
        <Text style={styles.statusText}>{statusText}</Text>
      </View>

      {/* Conversation */}
      <ScrollView
        ref={scrollRef}
        style={styles.chatArea}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.map((msg, i) => (
          <View key={i} style={[styles.bubble, msg.role === 'user' ? styles.userBubble : styles.aiBubble]}>
            <Text style={styles.bubbleText}>{msg.content}</Text>
          </View>
        ))}
        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Mic + waves */}
      <View style={[styles.controls, { paddingBottom: insets.bottom + 60 }]}>
        <View style={styles.micWrap}>
          {(voiceState === 'listening' || voiceState === 'speaking') && (
            <>
              <Animated.View style={[styles.waveRing, wave1]} />
              <Animated.View style={[styles.waveRing, wave2]} />
              <Animated.View style={[styles.waveRing, wave3]} />
            </>
          )}
          <Animated.View style={pulseStyle}>
            <TouchableOpacity
              style={[
                styles.micBtn,
                voiceState === 'listening' && styles.micBtnActive,
                voiceState === 'speaking' && { backgroundColor: '#10A37F', borderColor: '#10A37F' },
              ]}
              onPress={toggleMic}
              disabled={voiceState === 'processing' || voiceState === 'speaking'}
            >
              {voiceState === 'processing' ? (
                <ActivityIndicator size="large" color="#FFF" />
              ) : voiceState === 'speaking' ? (
                <Ionicons name="volume-high" size={40} color="#FFF" />
              ) : (
                <Ionicons name={voiceState === 'listening' ? 'stop' : 'mic'} size={40} color="#FFF" />
              )}
            </TouchableOpacity>
          </Animated.View>
        </View>
      </View>

      {/* Keyboard toggle */}
      <TouchableOpacity
        style={[styles.keyboardToggle, { bottom: insets.bottom + 16 }]}
        onPress={() => setShowKeyboard(k => !k)}
      >
        <Ionicons name="keypad-outline" size={18} color="rgba(255,255,255,0.6)" />
        <Text style={styles.keyboardToggleText}>{showKeyboard ? 'Hide keyboard' : 'Type instead'}</Text>
      </TouchableOpacity>

      {/* Text input */}
      {showKeyboard && (
        <View style={[styles.inputBar, { paddingBottom: insets.bottom + 12 }]}>
          <TextInput
            style={styles.textInput}
            placeholder="Type your message..."
            placeholderTextColor="rgba(255,255,255,0.35)"
            value={userInput}
            onChangeText={setUserInput}
            multiline
            editable={voiceState === 'idle' || voiceState === 'listening'}
          />
          <TouchableOpacity style={styles.sendBtn} onPress={handleSendText}>
            <Ionicons name="arrow-up" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#FFF' },
  statusWrap: { alignItems: 'center', paddingVertical: 12 },
  statusText: { fontSize: 16, color: 'rgba(255,255,255,0.85)', fontWeight: '600', letterSpacing: 0.3 },
  chatArea: { flex: 1, paddingHorizontal: 20 },
  bubble: {
    maxWidth: '80%',
    borderRadius: 20,
    padding: 14,
    marginBottom: 10,
  },
  userBubble: { alignSelf: 'flex-end', backgroundColor: 'rgba(0,122,255,0.3)', borderBottomRightRadius: 4 },
  aiBubble: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.15)', borderBottomLeftRadius: 4 },
  bubbleText: { color: '#FFF', fontSize: 15, lineHeight: 22 },
  controls: { alignItems: 'center', paddingVertical: 24 },
  micWrap: { position: 'relative', alignItems: 'center', justifyContent: 'center', width: 160, height: 160 },
  waveRing: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  micBtn: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 12,
  },
  micBtnActive: { backgroundColor: '#FF3B30', borderColor: '#FF3B30' },
  keyboardToggle: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  keyboardToggleText: { fontSize: 14, color: 'rgba(255,255,255,0.6)' },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  textInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 12,
    fontSize: 16,
    color: '#FFF',
    maxHeight: 100,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
