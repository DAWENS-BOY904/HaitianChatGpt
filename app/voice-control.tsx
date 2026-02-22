import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { router } from 'expo-router';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import { useAlert } from '@/template';
import { getSupabaseClient } from '@/template';
import { useAuth } from '@/template';
import Canvas from 'react-native-canvas';

type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking';

const VOICES = [
  {
    id: 'ember',
    name: 'Ember',
    description: 'Confident and optimistic',
    color: '#FF6B35',
  },
  {
    id: 'nova',
    name: 'Nova',
    description: 'Warm and engaging',
    color: '#4A90E2',
  },
  {
    id: 'alloy',
    name: 'Alloy',
    description: 'Neutral and balanced',
    color: '#718096',
  },
  {
    id: 'echo',
    name: 'Echo',
    description: 'Clear and articulate',
    color: '#48BB78',
  },
  {
    id: 'shimmer',
    name: 'Shimmer',
    description: 'Bright and cheerful',
    color: '#ED8936',
  },
];

export default function VoiceControlScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();
  const { user } = useAuth();
  const supabase = getSupabaseClient();

  // State
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [selectedVoice, setSelectedVoice] = useState('ember');
  const [showVoiceSelector, setShowVoiceSelector] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(null);

  // Animation
  const orbScale = useRef(new Animated.Value(1)).current;
  const orbOpacity = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;

  // Audio
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    setupAudio();
    return () => {
      cleanup();
    };
  }, []);

  useEffect(() => {
    animateOrb();
  }, [voiceState]);

  const setupAudio = async () => {
    await Audio.requestPermissionsAsync();
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });
  };

  const cleanup = async () => {
    if (recording) {
      await recording.stopAndUnloadAsync();
    }
    if (sound) {
      await sound.unloadAsync();
    }
    if (ws.current) {
      ws.current.close();
    }
  };

  const animateOrb = () => {
    if (voiceState === 'idle') {
      Animated.parallel([
        Animated.timing(orbScale, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(orbOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (voiceState === 'listening') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else if (voiceState === 'thinking') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(orbScale, {
            toValue: 1.1,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(orbScale, {
            toValue: 0.9,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else if (voiceState === 'speaking') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(orbOpacity, {
            toValue: 0.7,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(orbOpacity, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  };

  const startVoiceConversation = async () => {
    try {
      setVoiceState('listening');
      setTranscript('');

      // Start recording
      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(newRecording);

      // Connect to OpenAI Realtime API (via Edge Function)
      connectWebSocket();
    } catch (error) {
      console.error('Failed to start recording:', error);
      showAlert('Error', 'Failed to start voice conversation');
      setVoiceState('idle');
    }
  };

  const stopVoiceConversation = async () => {
    try {
      if (recording) {
        await recording.stopAndUnloadAsync();
        const uri = recording.getURI();
        
        if (uri) {
          // Process audio
          await processAudio(uri);
        }
        
        setRecording(null);
      }

      if (ws.current) {
        ws.current.close();
        ws.current = null;
      }

      setVoiceState('idle');
    } catch (error) {
      console.error('Failed to stop recording:', error);
      setVoiceState('idle');
    }
  };

  const connectWebSocket = () => {
    // In production, this would connect to OpenAI Realtime API
    // For now, we'll use the Edge Function approach
    const supabaseUrl = supabase.functions.getUrl('chat');
    
    // Note: WebSocket connection would be established here
    // For this implementation, we'll use HTTP streaming instead
  };

  const processAudio = async (audioUri: string) => {
    try {
      setVoiceState('thinking');

      // Read audio file
      const response = await fetch(audioUri);
      const audioBlob = await response.blob();
      const reader = new FileReader();

      reader.onloadend = async () => {
        const base64Audio = (reader.result as string).split(',')[1];

        // Send to Edge Function
        const { data, error } = await supabase.functions.invoke('chat', {
          body: {
            messages: [
              {
                role: 'user',
                content: 'Transcribe and respond to this audio',
              },
            ],
            audio: base64Audio,
            voice: selectedVoice,
            model: 'gpt-5.1',
            responseType: 'audio',
          },
        });

        if (error) {
          console.error('Edge Function error:', error);
          showAlert('Error', 'Failed to process audio');
          setVoiceState('idle');
          return;
        }

        if (data.transcript) {
          setTranscript(data.transcript);
        }

        if (data.audioUrl) {
          setCurrentAudioUrl(data.audioUrl);
          await playAudioResponse(data.audioUrl);
        }
      };

      reader.readAsDataURL(audioBlob);
    } catch (error) {
      console.error('Failed to process audio:', error);
      showAlert('Error', 'Failed to process audio');
      setVoiceState('idle');
    }
  };

  const playAudioResponse = async (audioUrl: string) => {
    try {
      setVoiceState('speaking');

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: true }
      );

      setSound(newSound);

      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setVoiceState('idle');
        }
      });
    } catch (error) {
      console.error('Failed to play audio:', error);
      setVoiceState('idle');
    }
  };

  const handleMicPress = () => {
    if (voiceState === 'idle') {
      startVoiceConversation();
    } else if (voiceState === 'listening') {
      stopVoiceConversation();
    }
  };

  const handleShareClip = async () => {
    if (!currentAudioUrl) {
      showAlert('Error', 'No audio clip to share');
      return;
    }

    try {
      await Share.share({
        message: 'Made with HaitianChatGPT\nVoice conversation powered by AI',
        url: currentAudioUrl,
      });
    } catch (error) {
      console.error('Share failed:', error);
    }
  };

  const getOrbColor = () => {
    const voice = VOICES.find((v) => v.id === selectedVoice);
    return voice?.color || '#4A90E2';
  };

  const getStateText = () => {
    switch (voiceState) {
      case 'listening':
        return 'Listening...';
      case 'thinking':
        return 'Thinking...';
      case 'speaking':
        return 'Speaking...';
      default:
        return 'Tap to speak';
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      paddingTop: Platform.select({
        ios: insets.top + 10,
        android: insets.top + 10,
      }),
      paddingHorizontal: Spacing.md,
      paddingBottom: Spacing.md,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    closeButton: {
      padding: Spacing.xs,
    },
    headerActions: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    iconButton: {
      padding: Spacing.xs,
    },
    content: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: Spacing.xl,
    },
    orbContainer: {
      width: 280,
      height: 280,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: Spacing.xxl,
    },
    orb: {
      width: 200,
      height: 200,
      borderRadius: 100,
      justifyContent: 'center',
      alignItems: 'center',
    },
    gradient: {
      width: '100%',
      height: '100%',
      borderRadius: 100,
    },
    stateText: {
      ...Typography.heading,
      color: colors.text,
      fontSize: 24,
      marginBottom: Spacing.sm,
      textAlign: 'center',
    },
    transcript: {
      ...Typography.body,
      color: colors.text,
      fontSize: 18,
      textAlign: 'center',
      lineHeight: 28,
      paddingHorizontal: Spacing.lg,
    },
    bottomControls: {
      paddingBottom: Platform.select({
        ios: insets.bottom + 20,
        android: 30,
      }),
      paddingHorizontal: Spacing.xl,
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'center',
    },
    controlButton: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: colors.card,
      justifyContent: 'center',
      alignItems: 'center',
    },
    micButton: {
      width: 80,
      height: 80,
      borderRadius: 40,
      justifyContent: 'center',
      alignItems: 'center',
    },
    micButtonActive: {
      backgroundColor: '#FF3B30',
    },
    voiceSelectorModal: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: colors.card,
      borderTopLeftRadius: BorderRadius.xl,
      borderTopRightRadius: BorderRadius.xl,
      paddingBottom: Platform.select({
        ios: insets.bottom + 20,
        android: 30,
      }),
    },
    voiceSelectorHeader: {
      padding: Spacing.lg,
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    voiceSelectorTitle: {
      ...Typography.heading,
      color: colors.text,
      fontSize: 18,
    },
    voiceList: {
      padding: Spacing.md,
    },
    voiceItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: Spacing.md,
      marginBottom: Spacing.sm,
      borderRadius: BorderRadius.md,
      backgroundColor: colors.background,
    },
    voiceItemSelected: {
      backgroundColor: colors.surface,
      borderWidth: 2,
      borderColor: colors.primary,
    },
    voiceOrb: {
      width: 50,
      height: 50,
      borderRadius: 25,
      marginRight: Spacing.md,
    },
    voiceInfo: {
      flex: 1,
    },
    voiceName: {
      ...Typography.body,
      color: colors.text,
      fontWeight: '600',
      marginBottom: 2,
    },
    voiceDescription: {
      ...Typography.caption,
      color: colors.textSecondary,
    },
    doneButton: {
      margin: Spacing.md,
      padding: Spacing.md,
      backgroundColor: colors.text,
      borderRadius: BorderRadius.lg,
      alignItems: 'center',
    },
    doneButtonText: {
      ...Typography.body,
      color: colors.background,
      fontWeight: '600',
    },
  });

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
          <Ionicons name="close" size={28} color={colors.text} />
        </TouchableOpacity>

        <View style={styles.headerActions}>
          {currentAudioUrl && (
            <TouchableOpacity style={styles.iconButton} onPress={handleShareClip}>
              <Ionicons name="share-outline" size={24} color={colors.text} />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.iconButton}>
            <Ionicons name="settings-outline" size={24} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton}>
            <Ionicons name="ellipsis-horizontal" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* MAIN CONTENT */}
      <View style={styles.content}>
        {/* ORB */}
        <View style={styles.orbContainer}>
          <Animated.View
            style={[
              styles.orb,
              {
                backgroundColor: getOrbColor(),
                transform: [{ scale: orbScale }],
                opacity: orbOpacity,
              },
            ]}
          >
            {voiceState === 'listening' && (
              <Animated.View
                style={[
                  {
                    position: 'absolute',
                    width: 220,
                    height: 220,
                    borderRadius: 110,
                    borderWidth: 3,
                    borderColor: getOrbColor(),
                    opacity: pulseAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.3, 0],
                    }),
                    transform: [
                      {
                        scale: pulseAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1, 1.3],
                        }),
                      },
                    ],
                  },
                ]}
              />
            )}
          </Animated.View>
        </View>

        {/* STATE TEXT */}
        <Text style={styles.stateText}>{getStateText()}</Text>

        {/* TRANSCRIPT */}
        {transcript && <Text style={styles.transcript}>{transcript}</Text>}
      </View>

      {/* BOTTOM CONTROLS */}
      <View style={styles.bottomControls}>
        <TouchableOpacity style={styles.controlButton}>
          <Ionicons name="camera-outline" size={28} color={colors.text} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.micButton,
            { backgroundColor: getOrbColor() },
            voiceState !== 'idle' && styles.micButtonActive,
          ]}
          onPress={handleMicPress}
        >
          <Ionicons
            name={voiceState === 'idle' ? 'mic' : 'stop'}
            size={36}
            color="#FFFFFF"
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.controlButton}
          onPress={() => setShowVoiceSelector(true)}
        >
          <Ionicons name="volume-high-outline" size={28} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* VOICE SELECTOR MODAL */}
      {showVoiceSelector && (
        <View style={styles.voiceSelectorModal}>
          <View style={styles.voiceSelectorHeader}>
            <Text style={styles.voiceSelectorTitle}>Choose a voice</Text>
          </View>

          <View style={styles.voiceList}>
            {VOICES.map((voice) => (
              <TouchableOpacity
                key={voice.id}
                style={[
                  styles.voiceItem,
                  selectedVoice === voice.id && styles.voiceItemSelected,
                ]}
                onPress={() => setSelectedVoice(voice.id)}
              >
                <View
                  style={[styles.voiceOrb, { backgroundColor: voice.color }]}
                />
                <View style={styles.voiceInfo}>
                  <Text style={styles.voiceName}>{voice.name}</Text>
                  <Text style={styles.voiceDescription}>{voice.description}</Text>
                </View>
                {selectedVoice === voice.id && (
                  <Ionicons name="checkmark" size={24} color={colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={styles.doneButton}
            onPress={() => setShowVoiceSelector(false)}
          >
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
