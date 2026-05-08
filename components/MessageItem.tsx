import React, { useState, useCallback, useRef, useEffect, memo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Alert,
  Modal,
  Platform,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useTheme } from '../hooks/useTheme';
import { useSettings } from '../hooks/useSettings';
import { getSupabaseClient } from '@/template';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import * as WebBrowser from 'expo-web-browser';
import { BlurView } from 'expo-blur';
import { CodeBlock } from './CodeBlock';
import { SourcesListModal as SourcesModal } from './SourcesModal';
import { LinkSafetyModal } from './LinkSafetyModal';
import * as Clipboard from 'expo-clipboard';

// ── Types ────────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  createdAt?: string;
  created_at?: string;
  imageUrl?: string;
  isEdited?: boolean;
  isDeleted?: boolean;
  reactions?: string[];
}

interface MessageItemProps {
  message: Message;
  onCancel?: () => void;
  onEdit?: (messageId: string, content: string) => void;
  onCopy?: () => void;
  isGenerating?: boolean;
  streaming?: boolean;
  streamingSpeed?: number;
  isOffline?: boolean;
  isImageTask?: boolean;
  isAdmin?: boolean;
  onReply?: (message: Message) => void;
  onDelete?: (messageId: string) => void;
  onChunkRendered?: () => void;
  // Like/unlike state for inline action row
  isLiked?: boolean;
  isUnliked?: boolean;
  onLike?: (messageId: string) => void;
  onUnlike?: (messageId: string) => void;
  onOpenActions?: (message: Message) => void;
}

// ── Safety keywords ──────────────────────────────────────────────────────────
const SELF_HARM_KEYWORDS = [
  'kill myself', 'suicide', 'end my life', 'want to die', 'self harm',
  'self-harm', 'hurt myself', 'take my life', 'not worth living',
  'mouri', 'touye tèt mwen', 'pa vle viv',
];

function containsSelfHarm(text: string): boolean {
  const lower = (text || '').toLowerCase();
  return SELF_HARM_KEYWORDS.some(kw => lower.includes(kw));
}

// ── Phone number detection ───────────────────────────────────────────────────
const PHONE_REGEX = /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;

// ── URL detection ────────────────────────────────────────────────────────────
const URL_REGEX = /https?:\/\/[^\s"')]+/g;

// ── Image URL detection ──────────────────────────────────────────────────────
const IMAGE_URL_REGEX = /https?:\/\/[^\s"')]+\.(?:jpg|jpeg|png|webp|gif)(?:\?[^\s"')]*)?/gi;

// ── Unsplash grid detection ──────────────────────────────────────────────────
interface UnsplashResult {
  id: string;
  urls: { small: string; regular: string; full: string };
  alt_description?: string;
  description?: string;
  user?: { name?: string };
  links?: { html?: string };
}

// ── Horizontal scrollable image grid (web search / AI image results) ──────────
const ImageGrid = memo(function ImageGrid({ images, onPress, onSendToChat }: {
  images: Array<{ url: string; title?: string; link?: string }>;
  onPress: (url: string, index: number) => void;
  onSendToChat?: (url: string) => void;
}) {
  const { isDark } = useTheme();
  if (!images || images.length === 0) return null;

  const CARD_W = images.length === 1 ? Math.min(Dimensions.get('window').width - 64, 280) : 150;
  const CARD_H = images.length === 1 ? CARD_W * 0.65 : 110;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingVertical: 8, gap: 10, paddingRight: 4 }}
      style={{ marginTop: 8, marginBottom: 4 }}
    >
      {images.slice(0, 8).map((img, i) => (
        <View
          key={`img-${i}-${img.url}`}
          style={{
            width: CARD_W,
            borderRadius: 16,
            overflow: 'hidden',
            backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA',
            borderWidth: 1,
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.15,
            shadowRadius: 6,
            elevation: 3,
          }}
        >
          <TouchableOpacity onPress={() => onPress(img.url, i)} activeOpacity={0.88}>
            <Image
              source={{ uri: img.url }}
              style={{ width: CARD_W, height: CARD_H }}
              contentFit="cover"
              transition={200}
            />
          </TouchableOpacity>
          {img.title ? (
            <View style={{ paddingHorizontal: 8, paddingVertical: 6 }}>
              <Text style={{ color: isDark ? '#FFF' : '#000', fontSize: 11, fontWeight: '600' }} numberOfLines={1}>{img.title}</Text>
            </View>
          ) : null}
          {/* Send to chat button */}
          {onSendToChat ? (
            <TouchableOpacity
              onPress={() => onSendToChat(img.url)}
              activeOpacity={0.75}
              style={{
                position: 'absolute',
                top: 6,
                right: 6,
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: 'rgba(0,0,0,0.55)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="send" size={13} color="#FFF" />
            </TouchableOpacity>
          ) : null}
        </View>
      ))}
    </ScrollView>
  );
});

// ── Safety Response Component ─────────────────────────────────────────────────
function SafetyResponse() {
  const { colors, isDark } = useTheme();
  const handleCall = () => {
    Alert.alert(
      'Call Crisis Line',
      'Do you want to call the 988 Suicide & Crisis Lifeline?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Call', onPress: () => Linking.openURL('tel:988') },
      ]
    );
  };
  const handleChat = () => {
    Alert.alert(
      'Open Crisis Chat',
      'This will open the 988 crisis chat in your browser.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open', onPress: () => Linking.openURL('https://988lifeline.org/chat/') },
      ]
    );
  };
  return (
    <View style={{ padding: 16, marginHorizontal: 16, marginBottom: 12, backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7', borderRadius: 18, borderLeftWidth: 4, borderLeftColor: '#FF453A' }}>
      <Text style={{ color: colors.text, fontSize: 17, fontWeight: '700', marginBottom: 8 }}>Help is available. You are not alone.</Text>
      <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 21, marginBottom: 16 }}>
        {"If you're going through something difficult, please reach out. Trained counselors are available 24/7 to help."}
      </Text>
      <View style={{ gap: 10 }}>
        <TouchableOpacity
          style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#34C759', borderRadius: 14, padding: 14, gap: 10 }}
          onPress={handleCall}
          activeOpacity={0.8}
        >
          <Ionicons name="call" size={20} color="#FFF" />
          <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '700' }}>Call 988 (Crisis Line)</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA', borderRadius: 14, padding: 14, gap: 10 }}
          onPress={handleChat}
          activeOpacity={0.8}
        >
          <Ionicons name="chatbubble-ellipses" size={20} color={colors.text} />
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>Chat Support Online</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Phone call modal ──────────────────────────────────────────────────────────
function PhoneCallModal({ visible, number, onClose }: { visible: boolean; number: string; onClose: () => void }) {
  const { colors, isDark } = useTheme();
  const handleCall = () => {
    onClose();
    Linking.openURL(`tel:${number.replace(/\D/g, '')}`);
  };
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' }}>
        {Platform.OS === 'ios' ? <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} /> : null}
        <View style={{ width: 280, backgroundColor: isDark ? '#2C2C2E' : '#FFF', borderRadius: 20, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.35, shadowRadius: 20, elevation: 20 }}>
          <View style={{ padding: 20, alignItems: 'center' }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#34C759', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
              <Ionicons name="call" size={26} color="#FFF" />
            </View>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: 6 }}>Call this number?</Text>
            <Text style={{ color: colors.primary, fontSize: 17, fontWeight: '600', marginBottom: 4 }}>{number}</Text>
          </View>
          <View style={{ flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}>
            <TouchableOpacity style={{ flex: 1, paddingVertical: 16, alignItems: 'center' }} onPress={onClose}>
              <Text style={{ color: colors.textSecondary, fontSize: 17 }}>Cancel</Text>
            </TouchableOpacity>
            <View style={{ width: StyleSheet.hairlineWidth, backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }} />
            <TouchableOpacity style={{ flex: 1, paddingVertical: 16, alignItems: 'center' }} onPress={handleCall}>
              <Text style={{ color: '#34C759', fontSize: 17, fontWeight: '700' }}>Call</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Download link card ────────────────────────────────────────────────────────
function DownloadLinkCard({ url, label }: { url: string; label?: string }) {
  const { colors, isDark } = useTheme();
  const fileName = label || url.split('/').pop()?.split('?')[0] || 'Download';
  const ext = fileName.split('.').pop()?.toUpperCase() || 'FILE';

  const handlePress = useCallback(async () => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Cannot open URL', 'This link cannot be opened on this device.');
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to open the link.');
    }
  }, [url]);

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.75}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
        borderRadius: 14,
        padding: 12,
        marginVertical: 4,
        gap: 12,
        borderWidth: 1,
        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
      }}
    >
      <View style={{ width: 42, height: 42, borderRadius: 10, backgroundColor: colors.primary + '22', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="document-attach" size={22} color={colors.primary} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>{fileName}</Text>
        <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>{ext} • Tap to open</Text>
      </View>
      <Ionicons name="open-outline" size={18} color={colors.textSecondary} />
    </TouchableOpacity>
  );
}

// ── Sources badge ─────────────────────────────────────────────────────────────
function SourcesBadge({ sources, onPress }: { sources: string[]; onPress: () => void }) {
  const { colors, isDark } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 7,
        gap: 6,
        marginTop: 8,
        borderWidth: 1,
        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)',
      }}
    >
      <Ionicons name="globe-outline" size={14} color={colors.textSecondary} />
      <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600' }}>{sources.length} Source{sources.length !== 1 ? 's' : ''}</Text>
      <Ionicons name="chevron-forward" size={14} color={colors.textSecondary} />
    </TouchableOpacity>
  );
}

// ── Parse markdown into segments ─────────────────────────────────────────────
interface TextSegment {
  type: 'text' | 'bold' | 'italic' | 'code_inline' | 'link' | 'phone' | 'image_url';
  content: string;
  url?: string;
}

function parseInlineMarkdown(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  // Combined pattern: **bold**, *italic*, `code`, [link](url), phone numbers, plain URLs
  const pattern = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^\)]+)\)|(https?:\/\/[^\s"')]+\.(?:jpg|jpeg|png|webp|gif)(?:\?[^\s"')]*)?)|(\+?[\d\s\-\(\)]{10,})|( https?:\/\/[^\s"')]+))/g;
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    }
    const full = match[0];
    if (full.startsWith('**')) {
      segments.push({ type: 'bold', content: match[2] });
    } else if (full.startsWith('*')) {
      segments.push({ type: 'italic', content: match[3] });
    } else if (full.startsWith('`')) {
      segments.push({ type: 'code_inline', content: match[4] });
    } else if (full.startsWith('[')) {
      const url = match[6];
      const label = match[5];
      const isImg = /\.(jpg|jpeg|png|webp|gif)/i.test(url);
      segments.push({ type: isImg ? 'image_url' : 'link', content: label, url });
    } else if (/^\+?[\d\s\-\(\)]{10,}$/.test(full.trim())) {
      segments.push({ type: 'phone', content: full.trim() });
    } else if (/\.(jpg|jpeg|png|webp|gif)/i.test(full)) {
      segments.push({ type: 'image_url', content: full.trim(), url: full.trim() });
    } else {
      segments.push({ type: 'link', content: full.trim(), url: full.trim() });
    }
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', content: text.slice(lastIndex) });
  }

  return segments;
}

// ── Markdown block parser ─────────────────────────────────────────────────────
interface Block {
  type: 'paragraph' | 'heading' | 'code' | 'bullet' | 'numbered' | 'divider' | 'image' | 'blockquote' | 'sources';
  content: string;
  level?: number;
  language?: string;
  sources?: string[];
}

function parseMarkdownBlocks(raw: string): Block[] {
  if (!raw) return [];
  const lines = raw.split('\n');
  const blocks: Block[] = [];
  let i = 0;

  // Extract sources block first
  let sourcesBlock: Block | null = null;
  const sourcesMatch = raw.match(/\[SOURCES\]([\s\S]*?)(?:\[\/SOURCES\]|$)/i);
  if (sourcesMatch) {
    const srcLines = sourcesMatch[1].trim().split('\n').map(s => s.replace(/^[-*•]\s*/, '').trim()).filter(Boolean);
    if (srcLines.length > 0) sourcesBlock = { type: 'sources', content: '', sources: srcLines };
  }

  const cleanRaw = raw.replace(/\[SOURCES\][\s\S]*?(?:\[\/SOURCES\]|$)/gi, '').trim();
  const cleanLines = cleanRaw.split('\n');

  i = 0;
  while (i < cleanLines.length) {
    const line = cleanLines[i];

    // Code block
    if (line.trim().startsWith('```')) {
      const lang = line.trim().slice(3).trim() || 'plaintext';
      const codeLines: string[] = [];
      i++;
      while (i < cleanLines.length && !cleanLines[i].trim().startsWith('```')) {
        codeLines.push(cleanLines[i]);
        i++;
      }
      i++;
      const code = codeLines.join('\n').trim();
      if (code) blocks.push({ type: 'code', content: code, language: lang });
      continue;
    }

    // Heading
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (headingMatch) {
      blocks.push({ type: 'heading', content: headingMatch[2], level: headingMatch[1].length });
      i++;
      continue;
    }

    // Divider
    if (/^[-*_]{3,}$/.test(line.trim())) {
      blocks.push({ type: 'divider', content: '' });
      i++;
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      blocks.push({ type: 'blockquote', content: line.slice(2) });
      i++;
      continue;
    }

    // Bullet list
    const bulletMatch = line.match(/^(\s*)[-*+•]\s+(.+)/);
    if (bulletMatch) {
      blocks.push({ type: 'bullet', content: bulletMatch[2] });
      i++;
      continue;
    }

    // Numbered list
    const numberedMatch = line.match(/^(\s*)\d+[.)]\s+(.+)/);
    if (numberedMatch) {
      blocks.push({ type: 'numbered', content: numberedMatch[2] });
      i++;
      continue;
    }

    // Image markdown
    const imgMatch = line.match(/!\[([^\]]*)\]\((https?:\/\/[^\)]+)\)/);
    if (imgMatch) {
      blocks.push({ type: 'image', content: imgMatch[2] });
      i++;
      continue;
    }

    // Paragraph (skip empty lines)
    if (line.trim()) {
      blocks.push({ type: 'paragraph', content: line });
    }
    i++;
  }

  if (sourcesBlock) blocks.push(sourcesBlock);
  return blocks;
}

// ── Inline text renderer ─────────────────────────────────────────────────────
function InlineText({ text, textStyle, onPhonePress, onLinkPress }: {
  text: string;
  textStyle: any;
  onPhonePress?: (num: string) => void;
  onLinkPress?: (url: string) => void;
}) {
  const segments = parseInlineMarkdown(text);
  return (
    <Text style={textStyle}>
      {segments.map((seg, i) => {
        if (seg.type === 'bold') return <Text key={i} style={{ fontWeight: '700' }}>{seg.content}</Text>;
        if (seg.type === 'italic') return <Text key={i} style={{ fontStyle: 'italic' }}>{seg.content}</Text>;
        if (seg.type === 'code_inline') return (
          <Text key={i} style={{ fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', backgroundColor: 'rgba(128,128,128,0.15)', borderRadius: 4, fontSize: (textStyle?.fontSize || 16) - 1 }}>
            {' '}{seg.content}{' '}
          </Text>
        );
        if (seg.type === 'phone') return (
          <Text key={i} style={{ color: '#34C759', textDecorationLine: 'underline' }} onPress={() => onPhonePress?.(seg.content)}>
            {seg.content}
          </Text>
        );
        if (seg.type === 'link') return (
          <Text key={i} style={{ color: '#007AFF', textDecorationLine: 'underline' }} onPress={() => onLinkPress?.(seg.url || seg.content)}>
            {seg.content}
          </Text>
        );
        return <Text key={i}>{seg.content}</Text>;
      })}
    </Text>
  );
}

// ── Main MessageItem ──────────────────────────────────────────────────────────
export const MessageItem = memo(function MessageItem({
  message,
  onCancel,
  onEdit,
  onCopy,
  isGenerating,
  streaming,
  streamingSpeed,
  isOffline,
  isImageTask,
  isAdmin,
  onReply,
  onDelete,
  onChunkRendered,
  isLiked = false,
  isUnliked = false,
  onLike,
  onUnlike,
  onOpenActions,
}: MessageItemProps) {
  const { colors, isDark } = useTheme();
  const { settings } = useSettings();
  const isUser = message.role === 'user';
  const supabase = getSupabaseClient();
  const ttsSound = useRef<any>(null);
  const [ttsPlaying, setTtsPlaying] = useState(false);

  const [phoneModalVisible, setPhoneModalVisible] = useState(false);
  const [pendingPhone, setPendingPhone] = useState('');
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [viewerImages, setViewerImages] = useState<string[]>([]);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [sourcesModalVisible, setSourcesModalVisible] = useState(false);
  const [sourcesData, setSourcesData] = useState<string[]>([]);
  const [linkSafetyVisible, setLinkSafetyVisible] = useState(false);
  const [pendingLink, setPendingLink] = useState('');

  const [ttsLoading, setTtsLoading] = useState(false);

  // ── TTS: read message aloud using user-selected voice ─────────────────────
  const handleReadAloud = useCallback(async () => {
    if (ttsPlaying || ttsLoading) {
      // Stop current playback
      try { ttsSound.current?.stopAsync(); ttsSound.current?.unloadAsync(); } catch {}
      ttsSound.current = null;
      try { Speech.stop(); } catch {}
      setTtsPlaying(false);
      setTtsLoading(false);
      return;
    }
    const text = (message.content || '').replace(/[#*`>]/g, '').slice(0, 2000);
    if (!text.trim()) return;
    setTtsLoading(true);
    const selectedVoice = (settings as any).voiceSelection || (settings as any).voice_selection || 'pNInz6obpgDQGcFmaJgB';
    try {
      const { data, error } = await supabase.functions.invoke('generate-tts', {
        body: { text, voice: selectedVoice, speed: 1.0 },
      });
      setTtsLoading(false);
      if (error || !data) throw new Error('TTS failed');
      if (data.fallback === true || data.code === 'USE_DEVICE_TTS') {
        // Device TTS fallback
        try { Speech.stop(); } catch {}
        setTtsPlaying(true);
        Speech.speak(text, { language: data.lang || 'en-US', rate: 1.0, onDone: () => setTtsPlaying(false), onError: () => setTtsPlaying(false) });
        return;
      }
      const audioUrl = data.audioUrl || data.audio_url;
      if (!audioUrl) throw new Error('No audio URL');
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true, staysActiveInBackground: false });
      const { sound } = await Audio.Sound.createAsync({ uri: audioUrl }, { shouldPlay: true, volume: 1.0 });
      ttsSound.current = sound;
      setTtsPlaying(true);
      sound.setOnPlaybackStatusUpdate((s: any) => {
        if (s.isLoaded && s.didJustFinish) { sound.unloadAsync().catch(() => {}); ttsSound.current = null; setTtsPlaying(false); }
      });
    } catch (_e) {
      setTtsLoading(false);
      // Device TTS as final fallback
      try { Speech.stop(); } catch {}
      setTtsPlaying(true);
      Speech.speak(text, { language: 'en-US', rate: 1.0, onDone: () => setTtsPlaying(false), onError: () => setTtsPlaying(false) });
    }
  }, [message.content, settings, supabase, ttsPlaying, ttsLoading]);

  // Cleanup TTS on unmount
  useEffect(() => {
    return () => {
      try { ttsSound.current?.stopAsync(); ttsSound.current?.unloadAsync(); } catch {}
      try { Speech.stop(); } catch {}
    };
  }, []);

  const content = message.content || '';
  const isSelfHarm = isUser && containsSelfHarm(content);

  // Extract image URLs from assistant messages
  const embeddedImages: Array<{ url: string; title?: string }> = [];
  if (!isUser) {
    const imgMatches = content.match(IMAGE_URL_REGEX);
    if (imgMatches) {
      imgMatches.forEach(url => {
        if (!embeddedImages.find(i => i.url === url)) {
          embeddedImages.push({ url });
        }
      });
    }
  }

  // Send image from grid to parent chat as an attachment
  const handleSendImageToChat = useCallback((url: string) => {
    // Navigate back and attach; we pass via a global event approach
    // Just open fullscreen + copy URL for now — caller handles attach
    Clipboard.setStringAsync(url).catch(() => {});
    Alert.alert('Image URL Copied', 'Paste it or the parent will attach it automatically.');
  }, []);

  const handlePhonePress = useCallback((num: string) => {
    setPendingPhone(num);
    setPhoneModalVisible(true);
  }, []);

  const handleLinkPress = useCallback((url: string) => {
    if (!url) return;
    const isImage = /\.(jpg|jpeg|png|webp|gif)/i.test(url);
    if (isImage) {
      setViewerImages([url]);
      setViewerIndex(0);
      setImageViewerVisible(true);
      return;
    }
    // Show link safety modal for external links
    setPendingLink(url);
    setLinkSafetyVisible(true);
  }, []);

  const handleImagePress = useCallback((url: string, allUrls: string[], idx: number) => {
    setViewerImages(allUrls);
    setViewerIndex(idx);
    setImageViewerVisible(true);
  }, []);

  const handleLinkConfirm = useCallback(async () => {
    setLinkSafetyVisible(false);
    const url = pendingLink;
    if (!url) return;
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch (_e) {
      Linking.openURL(url).catch(() => {});
    }
  }, [pendingLink]);

  // ── User message ──────────────────────────────────────────────────────────
  if (isUser) {
    // Safety intercept
    if (isSelfHarm) {
      return <SafetyResponse />;
    }

    // Support both camelCase (imageUrl) and snake_case (image_url) field names
    const displayImage = message.imageUrl || (message as any).image_url || null;
    // Determine if message has media — media messages cannot be edited
    const hasMedia = !!displayImage || !!(message as any).file_url;

    return (
      <>
        <View style={userStyles.container}>
          {displayImage ? (
            <TouchableOpacity
              onPress={() => handleImagePress(displayImage, [displayImage], 0)}
              activeOpacity={0.88}
              style={{ alignSelf: 'flex-end', marginHorizontal: 16, marginBottom: content ? 6 : 0 }}
            >
              <Image
                source={{ uri: displayImage }}
                style={{ width: 220, height: 220, borderRadius: 18 }}
                contentFit="cover"
                transition={200}
              />
            </TouchableOpacity>
          ) : null}
          {content ? (
            <View style={[userStyles.bubble, { backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA' }]}>
              <Text style={[userStyles.text, { color: colors.text }]}>{content}</Text>
              {message.isEdited ? (
                <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 4, textAlign: 'right' }}>Edited</Text>
              ) : null}
            </View>
          ) : null}
        </View>

        {displayImage ? (
          <Modal visible={imageViewerVisible} transparent animationType="fade" onRequestClose={() => setImageViewerVisible(false)} statusBarTranslucent>
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.93)', justifyContent: 'center', alignItems: 'center' }}>
              <TouchableOpacity style={{ position: 'absolute', top: Platform.OS === 'ios' ? 56 : 24, right: 20, zIndex: 10, width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }} onPress={() => setImageViewerVisible(false)}>
                <Ionicons name="close" size={22} color="#FFF" />
              </TouchableOpacity>
              <Image source={{ uri: viewerImages[viewerIndex] || '' }} style={{ width: Dimensions.get('window').width, height: Dimensions.get('window').height * 0.75 }} contentFit="contain" />
            </View>
          </Modal>
        ) : null}
        <PhoneCallModal visible={phoneModalVisible} number={pendingPhone} onClose={() => setPhoneModalVisible(false)} />
      </>
    );
  }

  // ── Assistant message ─────────────────────────────────────────────────────
  const blocks = parseMarkdownBlocks(content);
  const allImageUrls = embeddedImages.map(i => i.url);

  return (
    <>
      <View style={[assistantStyles.container]}>
        <View style={assistantStyles.inner}>
          {/* AI Thinking indicator */}
          {isGenerating && blocks.length === 0 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 }}>
              <View style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                backgroundColor: isDark ? '#FFFFFF' : '#000000',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <View style={{
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: isDark ? '#000000' : '#FFFFFF',
                }} />
              </View>
              <Text style={{ color: colors.textSecondary, fontSize: 14, fontWeight: '500' }}>Thinking...</Text>
            </View>
          ) : null}
          {blocks.map((block, bi) => {
            if (block.type === 'code') {
              return (
                <View key={bi} style={{ marginVertical: 6 }}>
                  <CodeBlock
                    code={block.content}
                    language={block.language || 'plaintext'}
                    isAdmin={isAdmin}
                  />
                </View>
              );
            }

            if (block.type === 'heading') {
              const fontSize = block.level === 1 ? 22 : block.level === 2 ? 19 : block.level === 3 ? 17 : 16;
              const fontWeight = block.level === 1 ? '800' : block.level === 2 ? '700' : '600';
              return (
                <View key={bi} style={{ marginTop: bi > 0 ? 14 : 4, marginBottom: 4 }}>
                  <InlineText
                    text={block.content}
                    textStyle={{ fontSize, fontWeight, color: colors.text, lineHeight: fontSize * 1.3 } as any}
                    onPhonePress={handlePhonePress}
                    onLinkPress={handleLinkPress}
                  />
                </View>
              );
            }

            if (block.type === 'divider') {
              return <View key={bi} style={{ height: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)', marginVertical: 12 }} />;
            }

            if (block.type === 'blockquote') {
              return (
                <View key={bi} style={{ borderLeftWidth: 3, borderLeftColor: colors.primary, paddingLeft: 12, marginVertical: 4, opacity: 0.85 }}>
                  <InlineText
                    text={block.content}
                    textStyle={{ fontSize: 15, color: colors.textSecondary, lineHeight: 22, fontStyle: 'italic' } as any}
                    onPhonePress={handlePhonePress}
                    onLinkPress={handleLinkPress}
                  />
                </View>
              );
            }

            if (block.type === 'bullet') {
              return (
                <View key={bi} style={{ flexDirection: 'row', marginVertical: 2, paddingLeft: 4 }}>
                  <Text style={{ color: colors.text, fontSize: 16, marginRight: 8, marginTop: 1, lineHeight: 24 }}>{'\u2022'}</Text>
                  <View style={{ flex: 1 }}>
                    <InlineText
                      text={block.content}
                      textStyle={{ fontSize: 16, color: colors.text, lineHeight: 24 } as any}
                      onPhonePress={handlePhonePress}
                      onLinkPress={handleLinkPress}
                    />
                  </View>
                </View>
              );
            }

            if (block.type === 'numbered') {
              const num = blocks.slice(0, bi).filter(b => b.type === 'numbered').length + 1;
              return (
                <View key={bi} style={{ flexDirection: 'row', marginVertical: 2, paddingLeft: 4 }}>
                  <Text style={{ color: colors.primary, fontSize: 16, marginRight: 8, fontWeight: '700', minWidth: 22, lineHeight: 24 }}>{num}.</Text>
                  <View style={{ flex: 1 }}>
                    <InlineText
                      text={block.content}
                      textStyle={{ fontSize: 16, color: colors.text, lineHeight: 24 } as any}
                      onPhonePress={handlePhonePress}
                      onLinkPress={handleLinkPress}
                    />
                  </View>
                </View>
              );
            }

            if (block.type === 'image') {
              return (
                <TouchableOpacity
                  key={bi}
                  onPress={() => handleImagePress(block.content, [block.content], 0)}
                  activeOpacity={0.88}
                  style={{ marginVertical: 8 }}
                >
                  <Image
                    source={{ uri: block.content }}
                    style={{ width: '100%', height: 220, borderRadius: 16 }}
                    contentFit="cover"
                    transition={200}
                  />
                </TouchableOpacity>
              );
            }

            if (block.type === 'sources' && block.sources && block.sources.length > 0) {
              return (
                <SourcesBadge
                  key={bi}
                  sources={block.sources}
                  onPress={() => { setSourcesData(block.sources!); setSourcesModalVisible(true); }}
                />
              );
            }

            // Paragraph
            if (block.type === 'paragraph') {
              // Detect download links
              const urlsInPara = block.content.match(URL_REGEX) || [];
              const hasDownloadLink = urlsInPara.some(u => /\.(pdf|zip|doc|docx|xls|xlsx|csv|mp3|mp4|mov|apk)(\?|$)/i.test(u));
              if (hasDownloadLink) {
                return (
                  <View key={bi} style={{ marginVertical: 3 }}>
                    <InlineText
                      text={block.content.replace(URL_REGEX, '').trim()}
                      textStyle={{ fontSize: 16, color: colors.text, lineHeight: 25 } as any}
                      onPhonePress={handlePhonePress}
                      onLinkPress={handleLinkPress}
                    />
                    {urlsInPara.map((url, ui) => (
                      <DownloadLinkCard key={ui} url={url} />
                    ))}
                  </View>
                );
              }

              // Native text selection via selectable Text — works on both iOS & Android
              const hasLinks = block.content.match(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)|https?:\/\/\S+/g);
              if (hasLinks) {
                // Render with inline links (non-selectable mode for rich content)
                return (
                  <View key={bi} style={{ marginVertical: 3 }}>
                    <Text
                      selectable
                      selectionColor={colors.primary + '55'}
                      style={{ fontSize: 16, color: colors.text, lineHeight: 25 }}
                    >
                      {parseInlineMarkdown(block.content).map((seg, si) => {
                        if (seg.type === 'bold') return <Text key={si} style={{ fontWeight: '700' }}>{seg.content}</Text>;
                        if (seg.type === 'italic') return <Text key={si} style={{ fontStyle: 'italic' }}>{seg.content}</Text>;
                        if (seg.type === 'code_inline') return <Text key={si} style={{ fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', backgroundColor: 'rgba(128,128,128,0.15)', borderRadius: 4 }}>{' '}{seg.content}{' '}</Text>;
                        if (seg.type === 'phone') return <Text key={si} style={{ color: '#34C759', textDecorationLine: 'underline' }} onPress={() => handlePhonePress(seg.content)}>{seg.content}</Text>;
                        if (seg.type === 'link') return <Text key={si} style={{ color: '#007AFF', textDecorationLine: 'underline' }} onPress={() => handleLinkPress(seg.url || seg.content)}>{seg.content}</Text>;
                        return <Text key={si}>{seg.content}</Text>;
                      })}
                    </Text>
                  </View>
                );
              }

              // Plain text paragraph — use selectable Text for full native selection
              return (
                <View key={bi} style={{ marginVertical: 3 }}>
                  <Text
                    selectable
                    selectionColor={colors.primary + '55'}
                    style={{ fontSize: 16, color: colors.text, lineHeight: 25 }}
                  >
                    {parseInlineMarkdown(block.content).map((seg, si) => {
                      if (seg.type === 'bold') return <Text key={si} style={{ fontWeight: '700' }}>{seg.content}</Text>;
                      if (seg.type === 'italic') return <Text key={si} style={{ fontStyle: 'italic' }}>{seg.content}</Text>;
                      if (seg.type === 'code_inline') return <Text key={si} style={{ fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', backgroundColor: 'rgba(128,128,128,0.15)', borderRadius: 4 }}>{' '}{seg.content}{' '}</Text>;
                      if (seg.type === 'phone') return <Text key={si} style={{ color: '#34C759', textDecorationLine: 'underline' }} onPress={() => handlePhonePress(seg.content)}>{seg.content}</Text>;
                      if (seg.type === 'link') return <Text key={si} style={{ color: '#007AFF', textDecorationLine: 'underline' }} onPress={() => handleLinkPress(seg.url || seg.content)}>{seg.content}</Text>;
                      return <Text key={si}>{seg.content}</Text>;
                    })}
                  </Text>
                </View>
              );
            }

            return null;
          })}

          {/* Horizontal scrollable image grid for images found in content */}
          {embeddedImages.length > 0 ? (
            <ImageGrid
              images={embeddedImages}
              onPress={(url, idx) => handleImagePress(url, allImageUrls, idx)}
              onSendToChat={handleSendImageToChat}
            />
          ) : null}

          {/* Message attached image (from message.imageUrl in assistant messages) */}
          {message.imageUrl && !isUser ? (
            <TouchableOpacity
              onPress={() => handleImagePress(message.imageUrl!, [message.imageUrl!], 0)}
              activeOpacity={0.88}
              style={{ marginTop: 10 }}
            >
              <Image
                source={{ uri: message.imageUrl }}
                style={{ width: '100%', height: 240, borderRadius: 16 }}
                contentFit="cover"
                transition={200}
              />
            </TouchableOpacity>
          ) : null}

          {/* Action row: copy, like, unlike, ... */}
          {!isGenerating && !streaming && content ? (
            <View style={assistantStyles.actionRow}>
              {/* Copy */}
              <TouchableOpacity
                onPress={onCopy}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={assistantStyles.actionBtn}
              >
                <Ionicons name="copy-outline" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
              {/* Like 👍 */}
              <TouchableOpacity
                onPress={() => onLike?.(message.id)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={assistantStyles.actionBtn}
              >
                <Ionicons
                  name={isLiked ? 'thumbs-up' : 'thumbs-up-outline'}
                  size={18}
                  color={isLiked ? '#10A37F' : colors.textSecondary}
                />
              </TouchableOpacity>
              {/* Unlike 👎 — hidden when liked */}
              {!isLiked ? (
                <TouchableOpacity
                  onPress={() => onUnlike?.(message.id)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={assistantStyles.actionBtn}
                >
                  <Ionicons
                    name={isUnliked ? 'thumbs-down' : 'thumbs-down-outline'}
                    size={18}
                    color={isUnliked ? '#FF453A' : colors.textSecondary}
                  />
                </TouchableOpacity>
              ) : null}
              {/* Three dots — opens message action modal */}
              <TouchableOpacity
                onPress={() => onOpenActions?.(message)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={assistantStyles.actionBtn}
              >
                <Ionicons name="ellipsis-horizontal" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </View>

      {/* Modals */}
      <PhoneCallModal
        visible={phoneModalVisible}
        number={pendingPhone}
        onClose={() => setPhoneModalVisible(false)}
      />

      {/* Inline full-screen image viewer */}
      <Modal visible={imageViewerVisible} transparent animationType="fade" onRequestClose={() => setImageViewerVisible(false)} statusBarTranslucent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.93)', justifyContent: 'center', alignItems: 'center' }}>
          <TouchableOpacity style={{ position: 'absolute', top: Platform.OS === 'ios' ? 56 : 24, right: 20, zIndex: 10, width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }} onPress={() => setImageViewerVisible(false)}>
            <Ionicons name="close" size={22} color="#FFF" />
          </TouchableOpacity>
          <Image source={{ uri: viewerImages[viewerIndex] || '' }} style={{ width: Dimensions.get('window').width, height: Dimensions.get('window').height * 0.75 }} contentFit="contain" />
          {viewerImages.length > 1 ? (
            <View style={{ flexDirection: 'row', gap: 16, marginTop: 16 }}>
              <TouchableOpacity onPress={() => setViewerIndex(i => Math.max(0, i - 1))} disabled={viewerIndex === 0}>
                <Ionicons name="chevron-back" size={28} color={viewerIndex === 0 ? 'rgba(255,255,255,0.3)' : '#FFF'} />
              </TouchableOpacity>
              <Text style={{ color: '#FFF', fontSize: 14 }}>{viewerIndex + 1} / {viewerImages.length}</Text>
              <TouchableOpacity onPress={() => setViewerIndex(i => Math.min(viewerImages.length - 1, i + 1))} disabled={viewerIndex === viewerImages.length - 1}>
                <Ionicons name="chevron-forward" size={28} color={viewerIndex === viewerImages.length - 1 ? 'rgba(255,255,255,0.3)' : '#FFF'} />
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </Modal>

      <SourcesModal
        visible={sourcesModalVisible}
        sources={sourcesData}
        onClose={() => setSourcesModalVisible(false)}
      />

      <LinkSafetyModal
        visible={linkSafetyVisible}
        url={pendingLink}
        onClose={() => setLinkSafetyVisible(false)}
        onConfirm={handleLinkConfirm}
      />


    </>
  );
});

// ── Styles ────────────────────────────────────────────────────────────────────
const userStyles = StyleSheet.create({
  container: {
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  bubble: {
    maxWidth: '82%',
    borderRadius: 20,
    borderBottomRightRadius: 6,
    paddingHorizontal: 15,
    paddingVertical: 11,
  },
  text: {
    fontSize: 16,
    lineHeight: 24,
  },
});

const assistantStyles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  inner: {
    maxWidth: '100%',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 4,
  },
  actionBtn: {
    padding: 7,
    borderRadius: 10,
  },
});
