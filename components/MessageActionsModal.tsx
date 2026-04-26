import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Share,
  Platform,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import { useTheme } from '../hooks/useTheme';
import { useAlert } from '@/template';
import { useSettings } from '../hooks/useSettings';
import { Spacing, BorderRadius } from '../constants/theme';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface MessageActionsModalProps {
  visible: boolean;
  onClose: () => void;
  message: {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    image_url?: string;
    created_at: string;
  };
  onLike?: (type: 'like' | 'dislike') => void;
  // Direct handlers from home.tsx
  handleLikeMessage?: (messageId: string) => void;
  handleUnlikeMessage?: (messageId: string) => void;
  isLiked?: boolean;
  isUnliked?: boolean;
}

export function MessageActionsModal({
  visible,
  onClose,
  message,
  onLike,
  handleLikeMessage,
  handleUnlikeMessage,
  isLiked = false,
  isUnliked = false,
}: MessageActionsModalProps) {
  const { colors, isDark } = useTheme();
  const { showAlert } = useAlert();
  const { settings } = useSettings();
  const accentColor = settings.accentColor || colors.primary;
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Stop TTS when modal closes
  useEffect(() => {
    if (!visible && isSpeaking) {
      Speech.stop();
      setIsSpeaking(false);
    }
  }, [visible]);

  // Stop TTS when modal opens (in case something is already playing)
  useEffect(() => {
    if (visible) {
      Speech.stop();
      setIsSpeaking(false);
    }
  }, [visible]);

  // TTS
  const handleReadAloud = useCallback(async () => {
    if (isSpeaking) {
      Speech.stop();
      setIsSpeaking(false);
      return;
    }
    setIsSpeaking(true);
    const cleanText = message.content
      .replace(/```[\s\S]*?```/g, 'code block')
      .replace(/[*_`~]/g, '')
      .replace(/\[.*?\]\(.*?\)/g, 'link');
    Speech.speak(cleanText, {
      language: 'en',
      pitch: 1.0,
      rate: 0.9,
      onDone: () => setIsSpeaking(false),
      onStopped: () => setIsSpeaking(false),
      onError: () => {
        setIsSpeaking(false);
        showAlert('Error', 'Text-to-speech failed');
      },
    });
  }, [message.content, isSpeaking, showAlert]);

  // Copy
  const handleCopy = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Clipboard.setStringAsync(message.content);
    showAlert('Copied!', 'Message copied to clipboard');
    onClose();
  }, [message.content, showAlert, onClose]);

  // Share
  const handleShare = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await Share.share({ message: message.content, title: 'Haitian AI Message' });
    } catch (_e) {}
  }, [message.content]);

  // Like handler — uses home.tsx handler if provided, falls back to onLike
  const handleLike = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (handleLikeMessage) {
      handleLikeMessage(message.id);
    } else {
      onLike?.('like');
    }
  }, [handleLikeMessage, onLike, message.id]);

  // Dislike handler — uses home.tsx handler if provided, falls back to onLike
  const handleDislike = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (handleUnlikeMessage) {
      handleUnlikeMessage(message.id);
      onClose(); // close modal before feedback page opens
    } else {
      onLike?.('dislike');
    }
  }, [handleUnlikeMessage, onLike, message.id, onClose]);

  // Stop TTS on close
  const handleClose = useCallback(() => {
    if (isSpeaking) {
      Speech.stop();
      setIsSpeaking(false);
    }
    onClose();
  }, [isSpeaking, onClose]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        {/* Full-screen BlurView background */}
        <BlurView
          intensity={Platform.OS === 'ios' ? 60 : 80}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />

        {/* Tap outside to dismiss */}
        <TouchableOpacity
          style={styles.dismissArea}
          activeOpacity={1}
          onPress={handleClose}
        />

        {/* Sheet */}
        <Animated.View
          entering={FadeInDown.duration(280).springify()}
          style={[styles.container, { borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)' }]}
        >
          {/* Blur inside the sheet */}
          <BlurView
            intensity={Platform.OS === 'ios' ? 90 : 95}
            tint={isDark ? 'dark' : 'light'}
            style={styles.sheetBlur}
          >
            {/* Handle bar */}
            <View style={[styles.handleBar, { backgroundColor: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.18)' }]} />

            <ScrollView
              style={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={[styles.title, { color: isDark ? '#FFF' : '#000' }]}>Message Actions</Text>
              <Text style={[styles.subtitle, { color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)' }]}>
                {new Date(message.created_at).toLocaleString()}
              </Text>

              {/* Like / Dislike / Read Aloud row */}
              {message.role === 'assistant' ? (
                <View style={styles.row}>
                  {/* Like */}
                  <TouchableOpacity
                    style={[styles.actionButton, {
                      backgroundColor: isLiked ? accentColor + '22' : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'),
                      borderColor: isLiked ? accentColor + '55' : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'),
                    }]}
                    onPress={handleLike}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={isLiked ? 'thumbs-up' : 'thumbs-up-outline'}
                      size={24}
                      color={isLiked ? accentColor : (isDark ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.6)')}
                      style={styles.actionIcon}
                    />
                    <Text style={[styles.actionText, { color: isLiked ? accentColor : (isDark ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.6)') }]}>
                      {isLiked ? 'Liked' : 'Like'}
                    </Text>
                  </TouchableOpacity>

                  {/* Dislike */}
                  <TouchableOpacity
                    style={[styles.actionButton, {
                      backgroundColor: isUnliked ? '#FF453A22' : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'),
                      borderColor: isUnliked ? '#FF453A55' : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'),
                    }]}
                    onPress={handleDislike}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={isUnliked ? 'thumbs-down' : 'thumbs-down-outline'}
                      size={24}
                      color={isUnliked ? '#FF453A' : (isDark ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.6)')}
                      style={styles.actionIcon}
                    />
                    <Text style={[styles.actionText, { color: isUnliked ? '#FF453A' : (isDark ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.6)') }]}>
                      {isUnliked ? 'Reported' : 'Dislike'}
                    </Text>
                  </TouchableOpacity>

                  {/* Read Aloud */}
                  <TouchableOpacity
                    style={[styles.actionButton, {
                      backgroundColor: isSpeaking ? accentColor + '22' : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'),
                      borderColor: isSpeaking ? accentColor + '55' : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'),
                    }]}
                    onPress={handleReadAloud}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={isSpeaking ? 'stop-circle' : 'volume-high-outline'}
                      size={24}
                      color={isSpeaking ? accentColor : (isDark ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.6)')}
                      style={styles.actionIcon}
                    />
                    <Text style={[styles.actionText, { color: isSpeaking ? accentColor : (isDark ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.6)') }]}>
                      {isSpeaking ? 'Stop' : 'Read Aloud'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              {/* Copy & Share */}
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)' }]}>Export</Text>

                <TouchableOpacity style={[styles.shareButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }]} onPress={handleCopy} activeOpacity={0.7}>
                  <Ionicons name="copy-outline" size={20} color={isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.7)'} />
                  <Text style={[styles.shareText, { color: isDark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.8)' }]}>Copy Text</Text>
                  <Ionicons name="chevron-forward" size={18} color={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.25)'} />
                </TouchableOpacity>

                <TouchableOpacity style={[styles.shareButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }]} onPress={handleShare} activeOpacity={0.7}>
                  <Ionicons name="share-outline" size={20} color={isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.7)'} />
                  <Text style={[styles.shareText, { color: isDark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.8)' }]}>Share</Text>
                  <Ionicons name="chevron-forward" size={18} color={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.25)'} />
                </TouchableOpacity>
              </View>
            </ScrollView>
          </BlurView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  dismissArea: {
    flex: 1,
  },
  container: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  sheetBlur: {
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  handleBar: {
    width: 36,
    height: 5,
    borderRadius: 3,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    marginBottom: 22,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },
  actionButton: {
    flex: 1,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
  },
  actionIcon: {
    marginBottom: 8,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  section: {
    marginTop: 4,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    marginBottom: 10,
  },
  shareText: {
    fontSize: 15,
    fontWeight: '500',
    marginLeft: 12,
    flex: 1,
  },
});
replace the native Speech.speak in MessageActionsModal with the generate-tts edge function using ElevenLabs for higher quality text-to-speech playback via expo-av.
