import React, { useState, useCallback, useEffect, useRef } from 'react';
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
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import { useRouter } from 'expo-router';
import { useTheme } from '../hooks/useTheme';
import { useAlert, getSupabaseClient } from '@/template';
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
  const supabase = getSupabaseClient();
  const router = useRouter();
  const accentColor = settings.accentColor || colors.primary;

  // TTS state — persists beyond modal close so audio keeps playing
  const [isSpeaking, setIsSpeaking] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);

  // Translate state
  const [isTranslating, setIsTranslating] = useState(false);
  const [translateResult, setTranslateResult] = useState('');
  const [translateSheetVisible, setTranslateSheetVisible] = useState(false);

  const stopTTS = useCallback(async () => {
    if (soundRef.current) {
      try { await soundRef.current.stopAsync(); } catch (_e) {}
      try { await soundRef.current.unloadAsync(); } catch (_e) {}
      soundRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

  // Do NOT stop on close — audio persists; user must tap Stop inside modal
  useEffect(() => () => { stopTTS(); }, []);

  const handleReadAloud = useCallback(async () => {
    if (isSpeaking) { await stopTTS(); return; }
    setIsSpeaking(true);
    const cleanText = message.content
      .replace(/```[\s\S]*?```/g, 'code block')
      .replace(/[*_`~]/g, '')
      .replace(/\[.*?\]\(.*?\)/g, 'link')
      .slice(0, 3000);
    // Use the voice the user selected in voice-settings
    const selectedVoice = (settings as any).voiceSelection || (settings as any).voice_selection || 'pNInz6obpgDQGcFmaJgB';
    try {
      const { data, error } = await supabase.functions.invoke('generate-tts', {
        body: { text: cleanText, voice: selectedVoice },
      });
      if (error || !data?.audioUrl) throw new Error(error?.message || 'TTS failed');
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        allowsRecordingIOS: false,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
      const { sound } = await Audio.Sound.createAsync(
        { uri: data.audioUrl },
        { shouldPlay: true, volume: 1.0 }
      );
      soundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((status: any) => {
        if (status.didJustFinish || status.isCancelled) {
          sound.unloadAsync().catch(() => {});
          soundRef.current = null;
          setIsSpeaking(false);
        }
      });
    } catch (_err) {
      setIsSpeaking(false);
      showAlert('TTS Error', 'Could not play audio. Please try again.');
    }
  }, [message.content, isSpeaking, stopTTS, supabase, showAlert]);

  const handleTranslate = useCallback(async () => {
    if (isTranslating) return;
    setIsTranslating(true);
    const userLang = settings.appLanguage || settings.mainLanguage || 'English';
    const cleanText = message.content.replace(/```[\s\S]*?```/g, '[code block]').slice(0, 3000);
    const translatePrompt = `Translate the following text to ${userLang}. Return ONLY the translated text, no explanations or extra text:\n\n${cleanText}`;
    try {
      const { data, error } = await supabase.functions.invoke('chat', {
        body: {
          messages: [{ role: 'user', content: translatePrompt }],
          model: 'gemini',
          conversationId: 'translate-temp',
        },
      });
      if (error) throw new Error(error.message || 'Translation failed');
      const result = data?.content || data?.message || data?.response || '';
      if (!result.trim()) throw new Error('Empty translation result');
      setTranslateResult(result.trim());
      setTranslateSheetVisible(true);
    } catch (_err) {
      showAlert('Translation Error', 'Could not translate the message. Please try again.');
    } finally {
      setIsTranslating(false);
    }
  }, [message.content, settings, supabase, showAlert, isTranslating]);

  const handleCopy = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Clipboard.setStringAsync(message.content);
    showAlert('Copied!', 'Message copied to clipboard');
    onClose();
  }, [message.content, showAlert, onClose]);

  const handleShare = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try { await Share.share({ message: message.content, title: 'Haitian AI Message' }); } catch (_e) {}
  }, [message.content]);

  // Like — clears dislike if active; toggling off like restores dislike button visibility
  const handleLike = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (handleLikeMessage) {
      handleLikeMessage(message.id);
      // Clear any existing dislike when liking
      if (isUnliked && handleUnlikeMessage) {
        handleUnlikeMessage(message.id);
      }
    } else {
      onLike?.('like');
    }
  }, [handleLikeMessage, handleUnlikeMessage, onLike, message.id, isUnliked]);

  // Dislike — opens feedback page
  const handleDislike = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (handleUnlikeMessage) {
      handleUnlikeMessage(message.id);
    } else {
      onLike?.('dislike');
    }
    onClose();
    setTimeout(() => {
      router.push({
        pathname: '/feedback',
        params: { messageId: message.id },
      } as any);
    }, 150);
  }, [handleUnlikeMessage, onLike, message.id, onClose, router]);

  // Close modal WITHOUT stopping audio — user controls audio via the Stop button
  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={handleClose}
      >
        <View style={styles.overlay}>
          {/* Dim overlay only — no full-screen blur (avoids blurring the home chat) */}
          <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0.28)' }]} />

          {/* Tap outside to dismiss */}
          <TouchableOpacity style={styles.dismissArea} activeOpacity={1} onPress={handleClose} />

          {/* Sheet */}
          <Animated.View
            entering={FadeInDown.duration(280).springify()}
            style={[styles.container, { borderColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.12)' }]}
          >
            <BlurView
              intensity={Platform.OS === 'ios' ? 92 : 88}
              tint={isDark ? 'chromeMaterialDark' : 'chromeMaterial'}
              style={styles.sheetBlur}
            >
              {/* Extra glass layer for depth */}
              <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(18,18,22,0.55)' : 'rgba(255,255,255,0.55)', borderTopLeftRadius: 24, borderTopRightRadius: 24 }]} pointerEvents="none" />
              <View style={[styles.handleBar, { backgroundColor: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.18)' }]} />

              <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <Text style={[styles.title, { color: isDark ? '#FFF' : '#000' }]}>Message Actions</Text>
                <Text style={[styles.subtitle, { color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)' }]}>
                  {new Date(message.created_at).toLocaleString()}
                </Text>

                {/* Like / Dislike / Read Aloud row — assistant messages only */}
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

                    {/* Dislike — hidden when message is liked; reappears when like is removed */}
                    {!isLiked ? (
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
                    ) : null}

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

                {/* Translate */}
                <TouchableOpacity
                  style={[styles.translateBtn, {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)',
                    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                  }]}
                  onPress={handleTranslate}
                  activeOpacity={0.7}
                  disabled={isTranslating}
                >
                  {isTranslating ? (
                    <ActivityIndicator size="small" color={accentColor} style={{ marginRight: 10 }} />
                  ) : (
                    <Ionicons name="language-outline" size={20} color={accentColor} style={{ marginRight: 10 }} />
                  )}
                  <Text style={[styles.translateBtnText, { color: accentColor }]}>
                    {isTranslating ? 'Translating...' : 'Translate Message'}
                  </Text>
                  {!isTranslating ? (
                    <Ionicons name="chevron-forward" size={16} color={accentColor + '88'} style={{ marginLeft: 'auto' }} />
                  ) : null}
                </TouchableOpacity>

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

      {/* Translate Result Sheet */}
      <Modal
        visible={translateSheetVisible}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setTranslateSheetVisible(false)}
      >
        <View style={styles.overlay}>
          <BlurView intensity={Platform.OS === 'ios' ? 70 : 90} tint="dark" style={StyleSheet.absoluteFill} />
          <TouchableOpacity style={styles.dismissArea} activeOpacity={1} onPress={() => setTranslateSheetVisible(false)} />
          <View style={styles.translateSheet}>
            <BlurView intensity={Platform.OS === 'ios' ? 95 : 100} tint="dark" style={styles.translateSheetBlur}>
              <View style={styles.translateHandle} />
              <View style={styles.translateHeader}>
                <View style={styles.translateHeaderLeft}>
                  <Ionicons name="language" size={20} color={accentColor} />
                  <Text style={styles.translateHeaderTitle}>Translation</Text>
                </View>
                <TouchableOpacity onPress={() => setTranslateSheetVisible(false)} style={styles.translateCloseBtn}>
                  <Ionicons name="close" size={18} color="rgba(255,255,255,0.6)" />
                </TouchableOpacity>
              </View>
              <View style={[styles.langBadge, { backgroundColor: accentColor + '22', borderColor: accentColor + '44' }]}>
                <Ionicons name="globe-outline" size={13} color={accentColor} />
                <Text style={[styles.langBadgeText, { color: accentColor }]}>
                  {settings.appLanguage || settings.mainLanguage || 'English'}
                </Text>
              </View>
              <ScrollView style={styles.translateScroll} showsVerticalScrollIndicator={false}>
                <Text style={styles.translateText}>{translateResult}</Text>
              </ScrollView>
              <View style={styles.translateActions}>
                <TouchableOpacity
                  style={[styles.translateActionBtn, { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.1)' }]}
                  onPress={async () => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    await Clipboard.setStringAsync(translateResult);
                    showAlert('Copied!', 'Translation copied to clipboard');
                    setTranslateSheetVisible(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="copy-outline" size={18} color="rgba(255,255,255,0.8)" />
                  <Text style={styles.translateActionText}>Copy</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.translateActionBtn, { backgroundColor: accentColor + '22', borderColor: accentColor + '44' }]}
                  onPress={async () => { try { await Share.share({ message: translateResult }); } catch (_e) {} }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="share-outline" size={18} color={accentColor} />
                  <Text style={[styles.translateActionText, { color: accentColor }]}>Share</Text>
                </TouchableOpacity>
              </View>
            </BlurView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  dismissArea: { flex: 1 },
  container: { borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden', borderTopWidth: StyleSheet.hairlineWidth },
  sheetBlur: { paddingBottom: Platform.OS === 'ios' ? 34 : 20 },
  handleBar: { width: 36, height: 5, borderRadius: 3, alignSelf: 'center', marginTop: 12, marginBottom: 20 },
  scrollContent: { paddingHorizontal: 20 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 6 },
  subtitle: { fontSize: 13, marginBottom: 22 },
  row: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  actionButton: { flex: 1, borderRadius: 14, padding: 14, alignItems: 'center', borderWidth: 1 },
  actionIcon: { marginBottom: 8 },
  actionText: { fontSize: 12, fontWeight: '600' },
  translateBtn: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, padding: 16, borderWidth: 1, marginBottom: 18 },
  translateBtnText: { fontSize: 15, fontWeight: '600' },
  section: { marginTop: 4, marginBottom: 8 },
  sectionTitle: { fontSize: 12, fontWeight: '700', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.6 },
  shareButton: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, padding: 16, borderWidth: 1, marginBottom: 10 },
  shareText: { fontSize: 15, fontWeight: '500', marginLeft: 12, flex: 1 },
  translateSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden', maxHeight: '70%' },
  translateSheetBlur: { paddingBottom: Platform.OS === 'ios' ? 34 : 20 },
  translateHandle: { width: 36, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.25)', alignSelf: 'center', marginTop: 12, marginBottom: 16 },
  translateHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 12 },
  translateHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  translateHeaderTitle: { color: '#FFF', fontSize: 17, fontWeight: '700' },
  translateCloseBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  langBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', marginHorizontal: 20, marginBottom: 14, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  langBadgeText: { fontSize: 12, fontWeight: '600' },
  translateScroll: { paddingHorizontal: 20, maxHeight: 280, marginBottom: 16 },
  translateText: { color: 'rgba(255,255,255,0.92)', fontSize: 16, lineHeight: 26, fontWeight: '400' },
  translateActions: { flexDirection: 'row', gap: 12, paddingHorizontal: 20 },
  translateActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, paddingVertical: 13, borderWidth: 1 },
  translateActionText: { color: 'rgba(255,255,255,0.85)', fontSize: 15, fontWeight: '600' },
});
