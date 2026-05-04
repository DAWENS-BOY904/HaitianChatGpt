import React, { useState, useCallback, useRef, useEffect, memo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Alert,
  Modal,
  Animated,
  Pressable,
  Platform,
  ScrollView,
  Clipboard,
  Share,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useTheme } from '../hooks/useTheme';
import { WebView } from 'react-native-webview';
import { BlurView } from 'expo-blur';
import { CodeBlock } from './CodeBlock';
import { SourcesModal } from './SourcesModal';
import { LinkSafetyModal } from './LinkSafetyModal';
import * as Clipboard2 from 'expo-clipboard';

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

// ── Inline image grid (from AI image search results) ─────────────────────────
const ImageGrid = memo(function ImageGrid({ images, onPress }: {
  images: Array<{ url: string; title?: string; link?: string }>;
  onPress: (url: string, index: number) => void;
}) {
  const { isDark } = useTheme();
  if (!images || images.length === 0) return null;
  const cols = images.length === 1 ? 1 : 2;
  const { width: screenW } = Dimensions.get('window');
  const imgW = images.length === 1 ? Math.min(screenW - 64, 320) : (Math.min(screenW - 64, 320) - 8) / 2;
  const imgH = images.length === 1 ? imgW * 0.65 : imgW * 0.75;

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10, marginBottom: 4 }}>
      {images.slice(0, 6).map((img, i) => (
        <TouchableOpacity
          key={`img-${i}-${img.url}`}
          onPress={() => onPress(img.url, i)}
          activeOpacity={0.85}
          style={{
            width: imgW,
            height: imgH,
            borderRadius: 14,
            overflow: 'hidden',
            backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA',
          }}
        >
          <Image
            source={{ uri: img.url }}
            style={{ width: imgW, height: imgH }}
            contentFit="cover"
            transition={200}
          />
          {img.title ? (
            <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.48)', padding: 6 }}>
              <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '600' }} numberOfLines={1}>{img.title}</Text>
            </View>
          ) : null}
        </TouchableOpacity>
      ))}
    </View>
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
}: MessageItemProps) {
  const { colors, isDark } = useTheme();
  const isUser = message.role === 'user';

  const [phoneModalVisible, setPhoneModalVisible] = useState(false);
  const [pendingPhone, setPendingPhone] = useState('');
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [viewerImages, setViewerImages] = useState<string[]>([]);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [sourcesModalVisible, setSourcesModalVisible] = useState(false);
  const [sourcesData, setSourcesData] = useState<string[]>([]);
  const [linkSafetyVisible, setLinkSafetyVisible] = useState(false);
  const [pendingLink, setPendingLink] = useState('');
  const [webViewVisible, setWebViewVisible] = useState(false);
  const [webViewUrl, setWebViewUrl] = useState('');

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

  const handleLinkConfirm = useCallback(() => {
    setLinkSafetyVisible(false);
    const url = pendingLink;
    // Check if it should open in-app WebView
    const inAppDomains = ['988lifeline.org', 'crisis', 'support'];
    const isInApp = inAppDomains.some(d => url.includes(d));
    if (isInApp) {
      setWebViewUrl(url);
      setWebViewVisible(true);
    } else {
      Linking.openURL(url).catch(() => {});
    }
  }, [pendingLink]);

  // ── User message ──────────────────────────────────────────────────────────
  if (isUser) {
    // Safety intercept
    if (isSelfHarm) {
      return <SafetyResponse />;
    }

    return (
      <>
        <View style={userStyles.container}>
          {message.imageUrl ? (
            <TouchableOpacity
              onPress={() => handleImagePress(message.imageUrl!, [message.imageUrl!], 0)}
              activeOpacity={0.88}
              style={{ alignSelf: 'flex-end', marginHorizontal: 16, marginBottom: 6 }}
            >
              <Image
                source={{ uri: message.imageUrl }}
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

        {message.imageUrl ? (
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

              return (
                <View key={bi} style={{ marginVertical: 3 }}>
                  <InlineText
                    text={block.content}
                    textStyle={{ fontSize: 16, color: colors.text, lineHeight: 25 } as any}
                    onPhonePress={handlePhonePress}
                    onLinkPress={handleLinkPress}
                  />
                </View>
              );
            }

            return null;
          })}

          {/* Inline image grid for images found in content */}
          {embeddedImages.length > 0 ? (
            <ImageGrid
              images={embeddedImages}
              onPress={(url, idx) => handleImagePress(url, allImageUrls, idx)}
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

          {/* Action row */}
          {!isGenerating && !streaming && content ? (
            <View style={assistantStyles.actionRow}>
              <TouchableOpacity
                onPress={onCopy}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={assistantStyles.actionBtn}
              >
                <Ionicons name="copy-outline" size={17} color={colors.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => {
                  try {
                    await Share.share({ message: content });
                  } catch (_e) {}
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={assistantStyles.actionBtn}
              >
                <Ionicons name="share-outline" size={17} color={colors.textSecondary} />
              </TouchableOpacity>
              {onReply ? (
                <TouchableOpacity
                  onPress={() => onReply(message)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={assistantStyles.actionBtn}
                >
                  <Ionicons name="return-down-forward-outline" size={17} color={colors.textSecondary} />
                </TouchableOpacity>
              ) : null}
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

      {/* In-app WebView modal */}
      <Modal visible={webViewVisible} animationType="slide" onRequestClose={() => setWebViewVisible(false)}>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14, paddingTop: Platform.OS === 'ios' ? 56 : 14, backgroundColor: '#1C1C1E' }}>
            <TouchableOpacity onPress={() => setWebViewVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={24} color="#FFF" />
            </TouchableOpacity>
            <Text style={{ flex: 1, color: '#FFF', fontSize: 15, fontWeight: '600', marginLeft: 12 }} numberOfLines={1}>{webViewUrl}</Text>
          </View>
          <WebView source={{ uri: webViewUrl }} style={{ flex: 1 }} />
        </View>
      </Modal>
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
