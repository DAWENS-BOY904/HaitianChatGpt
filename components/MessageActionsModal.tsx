import React, { useState, useCallback } from 'react';
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
import * as Speech from 'expo-speech';
import { captureRef } from 'react-native-view-shot';
import * as MediaLibrary from 'expo-media-library';
import { useTheme } from '../hooks/useTheme';
import { useAlert } from '@/template';
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
}

export function MessageActionsModal({
  visible,
  onClose,
  message,
  onLike,
}: MessageActionsModalProps) {
  const { colors } = useTheme();
  const { showAlert } = useAlert();
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [liked, setLiked] = useState<'like' | 'dislike' | null>(null);

  // PRODUCTION: Text-to-Speech
  const handleReadAloud = useCallback(async () => {
    if (isSpeaking) {
      Speech.stop();
      setIsSpeaking(false);
      return;
    }

    setIsSpeaking(true);
    
    // Remove code blocks and formatting for better TTS
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

  // PRODUCTION: Copy message content
  const handleCopy = useCallback(async () => {
    await Clipboard.setStringAsync(message.content);
    showAlert('Copied!', 'Message copied to clipboard');
    onClose();
  }, [message.content, showAlert, onClose]);

  // PRODUCTION: Share message
  const handleShare = useCallback(async () => {
    try {
      await Share.share({
        message: message.content,
        title: 'HaitianChatGPT Message',
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  }, [message.content]);

  // PRODUCTION: Like/Unlike
  const handleLikePress = useCallback((type: 'like' | 'dislike') => {
    const newLiked = liked === type ? null : type;
    setLiked(newLiked);
    onLike?.(type);
  }, [liked, onLike]);

  // PRODUCTION: Stop speaking on close
  const handleClose = useCallback(() => {
    if (isSpeaking) {
      Speech.stop();
      setIsSpeaking(false);
    }
    onClose();
  }, [isSpeaking, onClose]);

  const styles = StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    darkOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    dismissArea: {
      flex: 1,
    },
    container: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingBottom: Platform.OS === 'ios' ? 34 : 20,
      borderTopWidth: 1,
      borderColor: colors.border,
    },
    handleBar: {
      width: 36,
      height: 5,
      borderRadius: 3,
      backgroundColor: colors.textSecondary,
      alignSelf: 'center',
      marginTop: 12,
      marginBottom: 20,
    },
    content: {
      padding: 20,
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: 24,
    },
    row: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 16,
    },
    actionButton: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: BorderRadius.md,
      padding: 16,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    actionButtonActive: {
      backgroundColor: `${colors.primary}20`,
      borderColor: colors.primary,
    },
    actionIcon: {
      marginBottom: 8,
    },
    actionText: {
      fontSize: 12,
      color: colors.text,
      fontWeight: '500',
    },
    section: {
      marginTop: 8,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 12,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    shareButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: BorderRadius.md,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 12,
    },
    shareText: {
      fontSize: 15,
      color: colors.text,
      fontWeight: '500',
      marginLeft: 12,
      flex: 1,
    },
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={styles.darkOverlay} />
        
        <TouchableOpacity
          style={styles.dismissArea}
          activeOpacity={1}
          onPress={handleClose}
        />

        <Animated.View 
          entering={FadeInDown.duration(300).springify()}
          style={styles.container}
        >
          <View style={styles.handleBar} />

          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.title}>Message Actions</Text>
            <Text style={styles.subtitle}>
              {new Date(message.created_at).toLocaleString()}
            </Text>

            {/* Quick Actions */}
            <View style={styles.row}>
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  liked === 'like' && styles.actionButtonActive,
                ]}
                onPress={() => handleLikePress('like')}
              >
                <Ionicons
                  name={liked === 'like' ? 'thumbs-up' : 'thumbs-up-outline'}
                  size={24}
                  color={liked === 'like' ? colors.primary : colors.text}
                  style={styles.actionIcon}
                />
                <Text style={styles.actionText}>Like</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.actionButton,
                  liked === 'dislike' && styles.actionButtonActive,
                ]}
                onPress={() => handleLikePress('dislike')}
              >
                <Ionicons
                  name={liked === 'dislike' ? 'thumbs-down' : 'thumbs-down-outline'}
                  size={24}
                  color={liked === 'dislike' ? colors.primary : colors.text}
                  style={styles.actionIcon}
                />
                <Text style={styles.actionText}>Dislike</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.actionButton,
                  isSpeaking && styles.actionButtonActive,
                ]}
                onPress={handleReadAloud}
              >
                <Ionicons
                  name={isSpeaking ? 'stop-circle' : 'volume-high-outline'}
                  size={24}
                  color={isSpeaking ? colors.primary : colors.text}
                  style={styles.actionIcon}
                />
                <Text style={styles.actionText}>
                  {isSpeaking ? 'Stop' : 'Read Aloud'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Copy & Share */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Export</Text>
              
              <TouchableOpacity style={styles.shareButton} onPress={handleCopy}>
                <Ionicons name="copy-outline" size={20} color={colors.text} />
                <Text style={styles.shareText}>Copy Text</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
                <Ionicons name="share-outline" size={20} color={colors.text} />
                <Text style={styles.shareText}>Share</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}
