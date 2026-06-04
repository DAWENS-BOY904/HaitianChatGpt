// by me dawens
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
  ActivityIndicator,
  Animated,
  Share,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useTheme } from '../hooks/useTheme';
import { useSettings } from '../hooks/useSettings';
import { getSupabaseClient } from '@/template';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import * as WebBrowser from '../utils/web-browser';
import { BlurView } from 'expo-blur';
import { StreamingCodeBlock } from './StreamingCodeBlock';
import { SourcesModal, Source, InlineSourcesPill } from './SourcesModal';
import Clipboard from '@react-native-clipboard/clipboard';
import * as MediaLibrary from 'expo-media-library';
import { LinkPreviewCard, extractFirstUrl, extractLinkMetadataFromAIResponse, detectLinkPlatform, UrlChip } from './LinkPreviewCard';
import { SpotifyMusicCard, SpotifyTrack } from './SpotifyMusicCard';
import WeatherCard from './WeatherCard';
import MapCard from './MapCard';
// expo-video — used for real-time video playback
let VideoComponent: any = null;
let VideoResizeMode: any = { CONTAIN: 'contain' };
try {
  const ev = require('expo-video');
  VideoComponent = ev.VideoView || ev.Video || null;
} catch (_e) {}

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
  isLiked?: boolean;
  isUnliked?: boolean;
  onLike?: (messageId: string) => void;
  onUnlike?: (messageId: string) => void;
  onOpenActions?: (message: Message) => void;
}


// ── Selection helper ───────────────────────────────────────────────────────
function handleSelectionChange(e: any, fullText: string, setSelected: (t: string) => void, setShow: (v: boolean) => void) {
  const { start, end } = e.nativeEvent.selection;
  if (start !== end && fullText) {
    setSelected(fullText.slice(start, end));
    setShow(true);
  } else {
    setSelected('');
    setShow(false);
  }
}


// ── BlurredCard helper — consistent blur across all cards ──────────────────
const BlurredCard = ({ children, style, intensity = 90 }: any) => (
  <BlurView intensity={intensity} tint="dark" style={[{
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
  }, style]}>
    {children}
  </BlurView>
);

// ── Inline Image Search Card ────────────────────────────────────────────────
const InlineImageCard = memo(function InlineImageCard({ query, isDark, colors, onPress }: { query: string; isDark: boolean; colors: any; onPress: (url: string) => void }) {
  const supabaseHook = getSupabaseClient();
  const [images, setImages] = useState<Array<{ url: string; title?: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error: fnErr } = await supabaseHook.functions.invoke('image-search', { body: { query, limit: 6 } });
        if (cancelled) return;
        if (fnErr || !data?.images?.length) { setImgError(true); setLoading(false); return; }
        setImages(data.images.slice(0, 6));
      } catch { if (!cancelled) setImgError(true); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [query]);

  if (loading) {
    return (
      <View style={{ marginVertical: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <ActivityIndicator size='small' color={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)'} />
          <Text style={{ color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)', fontSize: 13 }}>{'Fetching images…'}</Text>
        </View>
      </View>
    );
  }

  if (imgError || images.length === 0) return null;

  const CARD_W = images.length === 1 ? Math.min(Dimensions.get('window').width - 64, 280) : 146;
  const CARD_H = images.length === 1 ? Math.round(CARD_W * 0.65) : 108;

  return (
    <View style={{ marginVertical: 8 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 4 }}>
        {images.map((img, i) => (
          <View key={`isearch-${i}`} style={{ width: CARD_W, borderRadius: 14, overflow: 'hidden', backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA', borderWidth: StyleSheet.hairlineWidth, borderColor: isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.07)' }}>
            <TouchableOpacity onPress={() => onPress(img.url)} activeOpacity={0.86}>
              <Image source={{ uri: img.url }} style={{ width: CARD_W, height: CARD_H }} contentFit='cover' transition={200} />
            </TouchableOpacity>
            {img.title ? (
              <View style={{ paddingHorizontal: 8, paddingVertical: 5 }}>
                <Text style={{ color: isDark ? '#FFF' : '#000', fontSize: 11, fontWeight: '600' }} numberOfLines={1}>{img.title}</Text>
              </View>
            ) : null}
          </View>
        ))}
      </ScrollView>
      <Text style={{ color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.3)', fontSize: 11, marginTop: 4 }}>{`Photos: ${query.length > 40 ? query.slice(0, 40) + '\u2026' : query}`}</Text>
    </View>
  );
});

// ── TikTok Card Parser ───────────────────────────────────────────────────────
interface TikTokCardData {
  title: string;
  author: string;
  thumbnail: string;
  videoUrl: string;
}

function parseTikTokCard(content: string): { cleanContent: string; card: TikTokCardData | null } {
  const match = content.match(/\[TIKTOK_CARD\]([\s\S]*?)\[\/TIKTOK_CARD\]/);
  if (!match) return { cleanContent: content, card: null };
  try {
    const card: TikTokCardData = JSON.parse(match[1]);
    const cleanContent = content.replace(/\[TIKTOK_CARD\][\s\S]*?\[\/TIKTOK_CARD\]/, '').trim();
    return { cleanContent, card };
  } catch {
    return { cleanContent: content, card: null };
  }
}

// ── TikTok Preview Card Component ────────────────────────────────────────────
const TikTokPreviewCard = memo(function TikTokPreviewCard({
  card, isDark, colors,
}: { card: TikTokCardData; isDark: boolean; colors: any }) {
  const [imgError, setImgError] = useState(false);
  const borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';

  return (
    <BlurView intensity={90} tint={isDark ? "dark" : "light"} style={{
      borderRadius: 18,
      overflow: 'hidden',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor,
      marginVertical: 8,
      maxWidth: 320,
    }}>
      {/* Thumbnail */}
      <View style={{ width: '100%', height: 180, backgroundColor: '#000', position: 'relative' }}>
        {card.thumbnail && !imgError ? (
          <Image source={{ uri: card.thumbnail }} style={{ width: '100%', height: 180 }} contentFit="cover" />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#111' }}>
            <Ionicons name="logo-tiktok" size={48} color="rgba(255,255,255,0.35)" />
          </View>
        )}
        {/* Play overlay */}
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(0,0,0,0.55)' }}>
            <Ionicons name="play" size={24} color="#FFF" style={{ marginLeft: 3 }} />
          </View>
        </View>
      </View>

      {/* Info */}
      <View style={{ padding: 12, gap: 4 }}>
        {card.title && <Text style={{ color: isDark ? '#FFF' : '#000', fontSize: 14, fontWeight: '600' }} numberOfLines={2}>{card.title}</Text>}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="person-circle-outline" size={14} color={colors.textSecondary} />
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>@{card.author}</Text>
        </View>
      </View>
    </BlurView>
  );
});

// ── Text Selection Overlay for AI messages ───────────────────────────────────


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

// ── URL detection ────────────────────────────────────────────────────────────
const URL_REGEX = /https?:\/\/[^\s"')]+/g;

// ── Image URL detection ──────────────────────────────────────────────────────
const IMAGE_URL_REGEX = /https?:\/\/[^\s"')]+\.(?:jpg|jpeg|png|webp|gif)(?:\?[^\s"')]*)?/gi;

// ── Open any URL fully in-app (never external browser) ───────────────────────
async function openInApp(url: string): Promise<void> {
  if (!url) return;
  try {
    await WebBrowser.openBrowserAsync(url);
  } catch (_e) {
    // fallback: do nothing, never go outside app
  }
}

// ── Theme-aware single dot indicator ─────────────────────────────────────────
function ThemeDot({ isDark }: { isDark: boolean }) {
  const pulse = useRef(new Animated.Value(0.65)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.65, duration: 600, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);
  return (
    <Animated.View
      style={{
        width: 8, height: 8, borderRadius: 4,
        backgroundColor: isDark ? '#FFFFFF' : '#000000',
        opacity: pulse,
      }}
    />
  );
}

// ── Streaming dots indicator (kept for legacy use) ─────────────────────────────
function StreamingDots({ isDark }: { isDark?: boolean }) {
  return <ThemeDot isDark={isDark ?? false} />;
}



// ── Horizontal scrollable image grid ─────────────────────────────────────────
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
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 8, gap: 10, paddingRight: 4 }} style={{ marginTop: 8, marginBottom: 4 }}>
      {images.slice(0, 8).map((img, i) => (
        <View key={`img-${i}-${img.url}`} style={{ width: CARD_W, borderRadius: 16, overflow: 'hidden', backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA', borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', elevation: 3 }}>
          <TouchableOpacity onPress={() => onPress(img.url, i)} activeOpacity={0.88}>
            <Image source={{ uri: img.url }} style={{ width: CARD_W, height: CARD_H }} contentFit="cover" transition={200} />
          </TouchableOpacity>
          {img.title ? (
            <View style={{ paddingHorizontal: 8, paddingVertical: 6 }}>
              <Text style={{ color: isDark ? '#FFF' : '#000', fontSize: 11, fontWeight: '600' }} numberOfLines={1}>{img.title}</Text>
            </View>
          ) : null}
          {onSendToChat ? (
            <TouchableOpacity onPress={() => onSendToChat(img.url)} activeOpacity={0.75} style={{ position: 'absolute', top: 6, right: 6, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="send" size={13} color="#FFF" />
            </TouchableOpacity>
          ) : null}
        </View>
      ))}
    </ScrollView>
  );
});

// ── Safety Response ───────────────────────────────────────────────────────────
function SafetyResponse() {
  const { colors, isDark } = useTheme();
  return (
    <View style={{ padding: 16, marginHorizontal: 16, marginBottom: 12, backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7', borderRadius: 18, borderLeftWidth: 4, borderLeftColor: '#FF453A' }}>
      <Text style={{ color: colors.text, fontSize: 17, fontWeight: '700', marginBottom: 8 }}>Help is available. You are not alone.</Text>
      <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 21, marginBottom: 16 }}>
        {"If you're going through something difficult, please reach out. Trained counselors are available 24/7 to help."}
      </Text>
      <View style={{ gap: 10 }}>
        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#34C759', borderRadius: 14, padding: 14, gap: 10 }} onPress={() => Linking.openURL('tel:988')} activeOpacity={0.8}>
          <Ionicons name="call" size={20} color="#FFF" />
          <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '700' }}>Call 988 (Crisis Line)</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA', borderRadius: 14, padding: 14, gap: 10 }} onPress={() => openInApp('https://988lifeline.org/chat/')} activeOpacity={0.8}>
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
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' }}>
        {Platform.OS === 'ios' ? <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} /> : null}
        <View style={{ width: 280, backgroundColor: isDark ? '#2C2C2E' : '#FFF', borderRadius: 20, overflow: 'hidden', elevation: 20 }}>
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
            <TouchableOpacity style={{ flex: 1, paddingVertical: 16, alignItems: 'center' }} onPress={() => { onClose(); Linking.openURL(`tel:${number.replace(/\D/g, '')}`); }}>
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
  const fileName = label || (url || '').split('/').pop()?.split('?')[0] || 'Download';
  const ext = fileName.split('.').pop()?.toUpperCase() || 'FILE';
  return (
    <TouchableOpacity onPress={() => openInApp(url)} activeOpacity={0.75} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', borderRadius: 14, padding: 12, marginVertical: 4, gap: 12, borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }}>
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

// ── Sources helpers ───────────────────────────────────────────────────────────
const FAVICON_BASE = 'https://www.google.com/s2/favicons?domain=';

function getDomainFromSource(src: string): string {
  if (!src) return '';
  try { if (src.startsWith('http')) return new URL(src).hostname.replace('www.', ''); } catch {}
  return src.replace(/^https?:\/\//, '').split('/')[0];
}

function FaviconBubble({ domain, index, isDark }: { domain: string; index: number; isDark: boolean }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const faviconUri = `${FAVICON_BASE}${domain}&sz=64`;
  const borderColor = isDark ? '#1C1C1E' : '#FFF';
  return (
    <View style={{
      width: 22, height: 22, borderRadius: 11,
      borderWidth: 1.5, borderColor,
      backgroundColor: isDark ? '#3A3A3C' : '#E5E5EA',
      marginLeft: index === 0 ? 0 : -8,
      zIndex: 4 - index,
      alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
    }}>
      {!failed && domain ? (
        <Image
          source={{ uri: faviconUri }}
          style={{ width: 16, height: 16 }}
          contentFit="contain"
          cachePolicy="memory-disk"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      ) : (
        // Fallback: first letter of domain in colored circle
        <View style={{
          width: 14, height: 14, borderRadius: 7,
          backgroundColor: `hsl(${(domain.charCodeAt(0) || 0) * 37 % 360}, 65%, 50%)`,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ color: '#FFF', fontSize: 8, fontWeight: '800' }}>
            {(domain[0] || '?').toUpperCase()}
          </Text>
        </View>
      )}
    </View>
  );
}

// ── Parse markdown into segments ─────────────────────────────────────────────
interface TextSegment {
  type: 'text' | 'bold' | 'italic' | 'code_inline' | 'link' | 'phone' | 'image_url' | 'strikethrough';
  content: string;
  url?: string;
}

function parseInlineMarkdown(text: string): TextSegment[] {
  if (!text) return [];
  const segments: TextSegment[] = [];
  const pattern = /(~~([^~]+)~~|\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^\)]+)\)|(https?:\/\/[^\s"')]+\.(?:jpg|jpeg|png|webp|gif)(?:\?[^\s"')]*)?)|(\+?[\d\s\-\(\)]{10,})|(https?:\/\/[^\s"')]+))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) segments.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    const full = match[0];
    if (full.startsWith('~~')) segments.push({ type: 'strikethrough', content: match[2] || '' });
    else if (full.startsWith('**')) segments.push({ type: 'bold', content: match[3] || '' });
    else if (full.startsWith('*')) segments.push({ type: 'italic', content: match[4] || '' });
    else if (full.startsWith('`')) segments.push({ type: 'code_inline', content: match[5] || '' });
    else if (full.startsWith('[')) {
      const url = match[7] || '';
      const label = match[6] || '';
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
  if (lastIndex < text.length) segments.push({ type: 'text', content: text.slice(lastIndex) });
  return segments;
}

// ── Markdown block parser ─────────────────────────────────────────────────────
interface Block {
  type: 'paragraph' | 'heading' | 'code' | 'bullet' | 'numbered' | 'divider' | 'image' | 'blockquote' | 'sources' | 'table';
  content: string;
  level?: number;
  language?: string;
  streaming?: boolean;
  sources?: string[];
  rows?: string[][];
  hasHeader?: boolean;
}

function parseMarkdownBlocks(raw: string, isStreaming = false): Block[] {
  if (!raw) return [];
  const blocks: Block[] = [];

  // Safe sources extraction
  let sourcesBlock: Block | null = null;
  try {
    const sourcesMatch = raw.match(/\[SOURCES\]([\s\S]*?)(?:\[\/SOURCES\]|$)/i);
    if (sourcesMatch) {
      const srcLines = (sourcesMatch[1] || '').trim().split('\n')
        .map((s: string) => s.replace(/^[-*•]\s*/, '').trim()).filter(Boolean);
      if (srcLines.length > 0) sourcesBlock = { type: 'sources', content: '', sources: srcLines };
    }
  } catch (_e) {}

  const cleanRaw = raw.replace(/\[SOURCES\][\s\S]*?(?:\[\/SOURCES\]|$)/gi, '').trim();
  const cleanLines = cleanRaw.split('\n');

  let i = 0;
  while (i < cleanLines.length) {
    const line = cleanLines[i] ?? '';

    // Table detection
    if (line.trim().startsWith('|') && line.trim().includes('|', 1)) {
      const tableLines: string[] = [];
      let ti = i;
      while (ti < cleanLines.length && (cleanLines[ti] ?? '').trim().startsWith('|')) {
        tableLines.push(cleanLines[ti] ?? '');
        ti++;
      }
      if (tableLines.length >= 2) {
        const parseRow = (rowLine: string): string[] =>
          rowLine.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c: string) => c.trim());
        const isSep = (rowLine: string) => /^[\|\-\s:]+$/.test(rowLine);
        const rows: string[][] = [];
        let hasHeader = false;
        let firstDataRow = 0;
        if (tableLines.length >= 2 && isSep(tableLines[1] ?? '')) {
          rows.push(parseRow(tableLines[0] ?? ''));
          hasHeader = true;
          firstDataRow = 2;
        }
        for (let r = firstDataRow; r < tableLines.length; r++) {
          if (!isSep(tableLines[r] ?? '')) rows.push(parseRow(tableLines[r] ?? ''));
        }
        if (rows.length > 0) blocks.push({ type: 'table', content: '', rows, hasHeader });
        i = ti;
        continue;
      }
    }

    // Code block with proper streaming detection
    if (line.trim().startsWith('```')) {
      const lang = line.trim().slice(3).trim() || 'plaintext';
      const codeLines: string[] = [];
      i++;
      let closedFence = false;
      while (i < cleanLines.length) {
        const cl = cleanLines[i] ?? '';
        // A closing fence is ONLY a line that is exactly ``` (nothing else)
        if (cl.trim() === '```') {
          closedFence = true;
          i++;
          break;
        }
        codeLines.push(cl);
        i++;
      }
      const code = codeLines.join('\n');
      // Only add a code block if there is actual content OR it is streaming
      if (code.trim().length > 0 || (isStreaming && !closedFence)) {
        if (!closedFence && isStreaming) {
          // Partial streaming code block — show live streaming indicator
          blocks.push({ type: 'code', content: code, language: lang, streaming: true });
        } else {
          blocks.push({ type: 'code', content: code.trim(), language: lang, streaming: false });
        }
      }
      continue;
    }

    // Heading
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (headingMatch) {
      blocks.push({ type: 'heading', content: headingMatch[2] || '', level: headingMatch[1].length });
      i++; continue;
    }

    // Divider
    if (/^[-*_]{3,}$/.test(line.trim())) {
      blocks.push({ type: 'divider', content: '' });
      i++; continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      blocks.push({ type: 'blockquote', content: line.slice(2) });
      i++; continue;
    }

    // Bullet list
    const bulletMatch = line.match(/^(\s*)[-*+•]\s+(.+)/);
    if (bulletMatch) {
      blocks.push({ type: 'bullet', content: bulletMatch[2] || '' });
      i++; continue;
    }

    // Numbered list
    const numberedMatch = line.match(/^(\s*)\d+[.)]\s+(.+)/);
    if (numberedMatch) {
      blocks.push({ type: 'numbered', content: numberedMatch[2] || '' });
      i++; continue;
    }

    // Image markdown
    const imgMatch = line.match(/!\[([^\]]*)\]\((https?:\/\/[^\)]+)\)/);
    if (imgMatch) {
      blocks.push({ type: 'image', content: imgMatch[2] || '' });
      i++; continue;
    }

    // Paragraph — but check if it CONTAINS a ``` opener (AI sometimes puts heading + code fence on same line or without a blank line)
    if (line.trim()) {
      // Check if this paragraph line itself starts with ``` embedded in prose (e.g. "### Code ```html")
      const embeddedFenceMatch = line.match(/```(\w*)$/);
      if (embeddedFenceMatch) {
        // Flush the text before the fence as a paragraph
        const textBefore = line.replace(/```\w*$/, '').trim();
        if (textBefore) blocks.push({ type: 'paragraph', content: textBefore });
        // Now collect the rest as a code block
        const lang = embeddedFenceMatch[1] || 'plaintext';
        const codeLines: string[] = [];
        i++;
        let closedFence = false;
        while (i < cleanLines.length) {
          const cl = cleanLines[i] ?? '';
          if (cl.trim() === '```') { closedFence = true; i++; break; }
          codeLines.push(cl);
          i++;
        }
        const code = codeLines.join('\n');
        if (code.trim().length > 0 || (isStreaming && !closedFence)) {
          blocks.push({ type: 'code', content: code.trim(), language: lang, streaming: !closedFence && isStreaming });
        }
        continue;
      }
      blocks.push({ type: 'paragraph', content: line });
    }
    i++;
  }

  if (sourcesBlock) blocks.push(sourcesBlock);
  return blocks;
}

// ── Inline text renderer ─────────────────────────────────────────────────────
function InlineText({ text, textStyle, onPhonePress, onLinkPress }: {
  text: string; textStyle: any;
  onPhonePress?: (num: string) => void; onLinkPress?: (url: string) => void;
}) {
  const segments = parseInlineMarkdown(text || '');
  return (
    <Text style={textStyle}>
      {segments.map((seg, i) => {
        if (seg.type === 'strikethrough') return <Text key={i} style={{ textDecorationLine: 'line-through', opacity: 0.62 }}>{seg.content}</Text>;
        if (seg.type === 'bold') return <Text key={i} style={{ fontWeight: '700' }}>{seg.content}</Text>;
        if (seg.type === 'italic') return <Text key={i} style={{ fontStyle: 'italic' }}>{seg.content}</Text>;
        if (seg.type === 'code_inline') return (
          <Text key={i} style={{ fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', backgroundColor: 'rgba(128,128,128,0.15)', borderRadius: 4, fontSize: (textStyle?.fontSize || 16) - 1 }}>
            {' '}{seg.content}{' '}
          </Text>
        );
        if (seg.type === 'phone') return (
          <Text key={i} style={{ color: '#34C759', textDecorationLine: 'underline' }} onPress={() => onPhonePress?.(seg.content)}>{seg.content}</Text>
        );
        if (seg.type === 'link') return (
          <Text key={i} style={{ color: '#007AFF', textDecorationLine: 'underline' }} onPress={() => onLinkPress?.(seg.url || seg.content)}>{seg.content}</Text>
        );
        return <Text key={i}>{seg.content}</Text>;
      })}
    </Text>
  );
}

// ── Markdown Table Renderer ───────────────────────────────────────────────────
const MarkdownTable = memo(function MarkdownTable({ rows, hasHeader, isDark, colors }: {
  rows: string[][]; hasHeader?: boolean; isDark: boolean; colors: any;
}) {
  if (!rows || rows.length === 0) return null;
  const colCount = Math.max(...rows.map(r => r.length), 1);
  const headerRow = hasHeader ? rows[0] : null;
  const bodyRows = hasHeader ? rows.slice(1) : rows;
  const borderC = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.09)';
  const headerBg = isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.055)';
  const evenRowBg = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)';
  const textC = isDark ? '#FFFFFF' : '#1A1A1A';
  const subC = isDark ? 'rgba(255,255,255,0.78)' : 'rgba(0,0,0,0.75)';
  const cellMinW = Math.max(70, Math.floor(280 / Math.min(colCount, 4)));
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 8 }} contentContainerStyle={{ paddingRight: 2 }}>
      <View style={{ borderRadius: 14, borderWidth: 1, borderColor: borderC, overflow: 'hidden', minWidth: colCount * cellMinW }}>
        {headerRow ? (
          <View style={{ flexDirection: 'row', backgroundColor: headerBg, borderBottomWidth: 1, borderBottomColor: borderC }}>
            {headerRow.map((cell, ci) => (
              <View key={`h-${ci}`} style={{ flex: 1, minWidth: cellMinW, paddingHorizontal: 12, paddingVertical: 10, borderRightWidth: ci < headerRow.length - 1 ? StyleSheet.hairlineWidth : 0, borderRightColor: borderC }}>
                <Text style={{ color: textC, fontSize: 13, fontWeight: '700', lineHeight: 18 }} numberOfLines={2}>{cell}</Text>
              </View>
            ))}
          </View>
        ) : null}
        {bodyRows.map((row, ri) => (
          <View key={`r-${ri}`} style={{ flexDirection: 'row', backgroundColor: ri % 2 === 1 ? evenRowBg : 'transparent', borderBottomWidth: ri < bodyRows.length - 1 ? StyleSheet.hairlineWidth : 0, borderBottomColor: borderC }}>
            {Array.from({ length: colCount }).map((_, ci) => (
              <View key={`c-${ri}-${ci}`} style={{ flex: 1, minWidth: cellMinW, paddingHorizontal: 12, paddingVertical: 9, borderRightWidth: ci < colCount - 1 ? StyleSheet.hairlineWidth : 0, borderRightColor: borderC }}>
                <Text style={{ color: subC, fontSize: 13, lineHeight: 18 }} selectable>{(row ?? [])[ci] ?? ''}</Text>
              </View>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
});

// ── Inline segment renderer ─────────────────────────────────────────────────
function renderInlineSegments(content: string, handlePhonePress: (n: string) => void, handleLinkPress: (u: string) => void, isDark = false) {
  if (!content) return null;
  return parseInlineMarkdown(content).map((seg, si) => {
    if (seg.type === 'strikethrough') return <Text key={si} style={{ textDecorationLine: 'line-through', opacity: 0.62 }}>{seg.content}</Text>;
    if (seg.type === 'bold') return <Text key={si} style={{ fontWeight: '700', color: isDark ? '#FFFFFF' : '#0A0A0A' }}>{seg.content}</Text>;
    if (seg.type === 'italic') return <Text key={si} style={{ fontStyle: 'italic', color: isDark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.82)' }}>{seg.content}</Text>;
    if (seg.type === 'code_inline') return <Text key={si} style={{ fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)', borderRadius: 5, paddingHorizontal: 3, fontSize: 14, color: isDark ? '#E2E8F0' : '#1A202C' }}>{' '}{seg.content}{' '}</Text>;
    if (seg.type === 'phone') return <Text key={si} style={{ color: '#34C759', textDecorationLine: 'underline' }} onPress={() => handlePhonePress(seg.content)}>{seg.content}</Text>;
    if (seg.type === 'link') return <Text key={si} style={{ color: '#007AFF', textDecorationLine: 'underline' }} onPress={() => handleLinkPress(seg.url || seg.content)}>{seg.content}</Text>;
    return <Text key={si}>{seg.content}</Text>;
  });
}

// ── Main MessageItem ──────────────────────────────────────────────────────────
export const MessageItem = memo(function MessageItem({
  message,
  onCancel,
  onEdit,
  onCopy,
  isGenerating,
  streaming,
  isAdmin,
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
  const [ttsLoading, setTtsLoading] = useState(false);
  const [phoneModalVisible, setPhoneModalVisible] = useState(false);
  const [pendingPhone, setPendingPhone] = useState('');
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [viewerImages, setViewerImages] = useState<string[]>([]);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [sourcesModalVisible, setSourcesModalVisible] = useState(false);
  const [sourcesData, setSourcesData] = useState<Source[]>([]);
  const [inlineSourcesVisible, setInlineSourcesVisible] = useState(false);
  const [inlineSources, setInlineSources] = useState<Source[]>([]);
  // ── Native text selection state ──────────────────────────────────────────
  const [selectedText, setSelectedText] = useState('');
  const [showFloatingCopy, setShowFloatingCopy] = useState(false);
  const [copiedFlash, setCopiedFlash] = useState(false);
  const { settings: messageSettings } = useSettings();
 const { aiImages, realImages, cleanContent: contentWithoutImages } = parseImageSearchResults(contentWithoutSpotify);

// If we have image search results, create a row set
const hasImageSearchResults = aiImages.length > 0 || realImages.length > 0;

// Use cleanContent for block parsing (without image search tags)
let blocks: Block[] = [];
try {
  blocks = parseMarkdownBlocks(contentWithoutImages, isCurrentlyStreaming);
} catch (_e) {
  blocks = contentWithoutImages ? [{ type: 'paragraph', content: contentWithoutImages }] : [];
}

// ── Render image search carousel if results exist ──────────────────────────
{hasImageSearchResults && (
  <View style={{ marginVertical: 8 }}>
    <ImageSearchCarousel
      rowSets={[
        {
          id: `msg-${message.id}-images`,
          aiImages,
          realImages,
          query: lastUserContent.slice(0, 50) || 'Image Search',
          timestamp: Date.now(),
        },
      ]}
      onImagePress={handleImagePress}
      onSendToChat={handleSendImageToChat}
    />
  </View>
)}



  // CRITICAL: Safe content — never undefined/null, prevents crash during streaming
  const safeContent: string = (() => {
    try {
      if (message == null) return '';
      if (typeof message.content === 'string') return message.content;
      if (message.content == null) return '';
      return String(message.content);
    } catch {
      return '';
    }
  })();

  const handleReadAloud = useCallback(async () => {
    if (ttsPlaying || ttsLoading) {
      try { ttsSound.current?.stopAsync(); ttsSound.current?.unloadAsync(); } catch {}
      ttsSound.current = null;
      try { Speech.stop(); } catch {}
      setTtsPlaying(false); setTtsLoading(false);
      return;
    }
    const text = safeContent.replace(/[#*`>]/g, '').slice(0, 2000);
    if (!text.trim()) return;
    setTtsLoading(true);
    const selectedVoice = (settings as any)?.voiceSelection || 'pNInz6obpgDQGcFmaJgB';
    try {
      const { data, error } = await supabase.functions.invoke('generate-tts', {
        body: { text, voice: selectedVoice, speed: 1.0 },
      });
      setTtsLoading(false);
      if (error || !data) throw new Error('TTS failed');
      if (data.fallback === true || data.code === 'USE_DEVICE_TTS') {
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
      try { Speech.stop(); } catch {}
      setTtsPlaying(true);
      Speech.speak(text, { language: 'en-US', rate: 1.0, onDone: () => setTtsPlaying(false), onError: () => setTtsPlaying(false) });
    }
  }, [safeContent, settings, supabase, ttsPlaying, ttsLoading]);

  useEffect(() => {
    return () => {
      try { ttsSound.current?.stopAsync(); ttsSound.current?.unloadAsync(); } catch {}
      try { Speech.stop(); } catch {}
    };
  }, []);

  // Embedded image URLs in AI response
  const embeddedImages: Array<{ url: string; title?: string }> = [];
  if (!isUser && safeContent) {
    try {
      const imgMatches = safeContent.match(IMAGE_URL_REGEX);
      if (imgMatches) {
        imgMatches.forEach((url: string) => {
          if (url && !embeddedImages.find(im => im.url === url)) embeddedImages.push({ url });
        });
      }
    } catch {}
  }

  const handleSendImageToChat = useCallback((url: string) => {
    Clipboard.setStringAsync(url).catch(() => {});
    Alert.alert('Image URL Copied', 'The image URL has been copied to clipboard.');
  }, []);

  const handlePhonePress = useCallback((num: string) => {
    setPendingPhone(num);
    setPhoneModalVisible(true);
  }, []);

  // All links open in-app — NEVER go to Safari/Chrome/external browser
  const handleLinkPress = useCallback((url: string) => {
    if (!url) return;
    const isImage = /\.(jpg|jpeg|png|webp|gif)/i.test(url);
    if (isImage) {
      setViewerImages([url]);
      setViewerIndex(0);
      setImageViewerVisible(true);
      return;
    }
    openInApp(url);
  }, []);

  const handleImagePress = useCallback((url: string, allUrls: string[], idx: number) => {
    if (!url) return;
    setViewerImages(allUrls && allUrls.length > 0 ? allUrls : [url]);
    setViewerIndex(Math.max(0, idx || 0));
    setImageViewerVisible(true);
  }, []);

  // ── Video preview card — full real-time playback ─────────────────────────────
function VideoPreviewCard({ name, uri, isDark, colors }: { name: string; uri?: string; isDark: boolean; colors: any }) {
  const [playerVisible, setPlayerVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSaveVideo = async () => {
    if (!uri || saving) return;
    setSaving(true);
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') { setSaving(false); return; }
      await MediaLibrary.saveToLibraryAsync(uri);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (_e) {}
    finally { setSaving(false); }
  };

  return (
    <>
      <BlurView intensity={88} tint={isDark ? "dark" : "light"} style={{
        borderRadius: 16,
        overflow: 'hidden',
        maxWidth: 260,
        alignSelf: 'flex-end',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: isDark ? 'rgba(255,107,53,0.35)' : 'rgba(255,107,53,0.25)',
      }}>
        <TouchableOpacity
          onPress={() => setPlayerVisible(true)}
          activeOpacity={0.88}
          style={{ width: '100%' }}
        >
        {/* Thumbnail area */}
        <View style={{ width: 260, height: 160, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="play" size={24} color="#FFF" style={{ marginLeft: 3 }} />
          </View>
        </View>
        {/* Footer */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 9, gap: 8 }}>
          <Ionicons name="videocam" size={16} color="#FF6B35" />
          <Text style={{ color: isDark ? '#FFF' : '#000', fontSize: 12, fontWeight: '600', flex: 1 }} numberOfLines={1}>{name || 'Video'}</Text>
          {/* Save button */}
          <TouchableOpacity
            onPress={handleSaveVideo}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            disabled={saving || saved}
            activeOpacity={0.7}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FF6B35" />
            ) : (
              <Ionicons name={saved ? 'checkmark-circle' : 'download-outline'} size={18} color={saved ? '#34C759' : '#FF6B35'} />
            )}
          </TouchableOpacity>
        </View>
        </TouchableOpacity>
      </BlurView>

      {/* Full-screen video player modal */}
      {playerVisible ? (
        <Modal visible={playerVisible} transparent={false} animationType="slide" onRequestClose={() => setPlayerVisible(false)} statusBarTranslucent>
          <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
            {/* Header */}
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 56, paddingHorizontal: 16, paddingBottom: 12, zIndex: 10 }}>
              <TouchableOpacity
                onPress={() => setPlayerVisible(false)}
                style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}
              >
                <Ionicons name="close" size={20} color="#FFF" />
              </TouchableOpacity>
              <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '600' }} numberOfLines={1}>{name || 'Video'}</Text>
              {/* Save button top right */}
              <TouchableOpacity
                onPress={handleSaveVideo}
                disabled={saving || saved}
                activeOpacity={0.8}
              >
                {Platform.OS === 'ios' ? (
                  <BlurView intensity={60} tint="dark" style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {saving ? <ActivityIndicator size="small" color="#FFF" /> : <Ionicons name={saved ? 'checkmark-circle' : 'arrow-down-circle-outline'} size={22} color={saved ? '#34C759' : '#FFF'} />}
                  </BlurView>
                ) : (
                  <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                    {saving ? <ActivityIndicator size="small" color="#FFF" /> : <Ionicons name={saved ? 'checkmark-circle' : 'arrow-down-circle-outline'} size={22} color={saved ? '#34C759' : '#FFF'} />}
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {/* Video player */}
            {uri && VideoComponent ? (
              <VideoComponent
                source={{ uri }}
                style={{ width: Dimensions.get('window').width, height: Dimensions.get('window').height * 0.6 }}
                resizeMode="contain"
                useNativeControls
                isLooping={false}
              />
            ) : (
              <View style={{ alignItems: 'center', gap: 16 }}>
                <Ionicons name="videocam-off-outline" size={56} color="rgba(255,255,255,0.4)" />
                <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 15 }}>Video preview not available</Text>
                {uri ? (
                  <TouchableOpacity
                    style={{ backgroundColor: '#FF6B35', borderRadius: 28, paddingHorizontal: 28, paddingVertical: 13, marginTop: 8 }}
                    onPress={() => Linking.openURL(uri).catch(() => {})}
                  >
                    <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 15 }}>Open in external player</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            )}
          </View>
        </Modal>
      ) : null}
    </>
  );
}

// ── User message ──────────────────────────────────────────────────────────
  if (isUser) {
    if (containsSelfHarm(safeContent)) return <SafetyResponse />;

    const cleanUserContent = (() => {
      let c = safeContent;
      c = c.replace(/\n*\[FILE ATTACHED:[^\n]*\n[\s\S]*?(?=\n\[FILE ATTACHED:|\n\[VIDEO ATTACHED:|$)/gi, '');
      c = c.replace(/\n*\[FILE ATTACHED:[^\]]*\][^\n]*/gi, '');
      c = c.replace(/\n*\[VIDEO ATTACHED:[^\n]*/gi, '');
      c = c.replace(/^\[SYSTEM:[\s\S]*?\]\s*/i, '');
      c = c.replace(/^\[SYSTEM RULES:[\s\S]*?\]\n*/i, '');
      c = c.replace(/^\[Replying to[^\]]*\]\n*/i, '');
      return c.trim();
    })();

    const fileAttachments: Array<{ name: string; mimeType: string }> = [];
    (safeContent.match(/\[FILE ATTACHED: ([^\n(]+)\s*\(([^)]+)\)/g) || []).forEach((m: string) => {
      const nm = m.match(/\[FILE ATTACHED: ([^\n(]+)\s*\(([^)]+)\)/);
      if (nm) fileAttachments.push({ name: nm[1].trim(), mimeType: nm[2].trim() });
    });
    (safeContent.match(/\[VIDEO ATTACHED: ([^\]\n]+)/g) || []).forEach((m: string) => {
      const nm = m.match(/\[VIDEO ATTACHED: ([^\]\n]+)/);
      if (nm) fileAttachments.push({ name: nm[1].trim(), mimeType: 'video' });
    });

    const displayImage = message.imageUrl || (message as any).image_url || null;
    const multiImages: string[] = (() => {
      const raw = (message as any).image_urls;
      if (Array.isArray(raw) && raw.length > 0) return raw;
      if (typeof raw === 'string') {
        try { const p = JSON.parse(raw); if (Array.isArray(p)) return p; } catch {}
        return raw.split(',').map((s: string) => s.trim()).filter(Boolean);
      }
      return displayImage ? [displayImage] : [];
    })();
    const hasValidImage = multiImages.length > 0;

    return (
      <>
        <View style={userStyles.container}>
          {hasValidImage && multiImages.length > 1 ? (
            <View style={{ alignSelf: 'flex-end', marginHorizontal: 16, marginBottom: cleanUserContent ? 6 : 0 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ maxHeight: 180 }}>
                {multiImages.map((uri, idx) => (
                  <View key={`user-img-${idx}`} style={{ position: 'relative' }}>
                    <TouchableOpacity onPress={() => handleImagePress(uri, multiImages, idx)} activeOpacity={0.88}>
                      <Image source={{ uri }} style={{ width: 150, height: 150, borderRadius: 14 }} contentFit="cover" transition={200} />
                    </TouchableOpacity>
                    {/* Save button top-right */}
                    <TouchableOpacity
                      onPress={async () => {
                        try {
                          const { status } = await MediaLibrary.requestPermissionsAsync();
                          if (status === 'granted') await MediaLibrary.saveToLibraryAsync(uri);
                        } catch (_e) {}
                      }}
                      style={{ position: 'absolute', top: 6, right: 6, zIndex: 5 }}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      {Platform.OS === 'ios' ? (
                        <BlurView intensity={60} tint="dark" style={{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                          <Ionicons name="arrow-down" size={14} color="#FFF" />
                        </BlurView>
                      ) : (
                        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' }}>
                          <Ionicons name="arrow-down" size={14} color="#FFF" />
                        </View>
                      )}
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            </View>
          ) : hasValidImage ? (
            <View style={{ alignSelf: 'flex-end', marginHorizontal: 16, marginBottom: cleanUserContent ? 6 : 0, position: 'relative' }}>
              <TouchableOpacity onPress={() => handleImagePress(multiImages[0], multiImages, 0)} activeOpacity={0.88}>
                <Image source={{ uri: multiImages[0] }} style={{ width: 220, height: 220, borderRadius: 18 }} contentFit="cover" transition={200} />
              </TouchableOpacity>
              {/* Save to camera roll — top-right blur icon */}
              <TouchableOpacity
                onPress={async () => {
                  try {
                    const { status } = await MediaLibrary.requestPermissionsAsync();
                    if (status === 'granted') await MediaLibrary.saveToLibraryAsync(multiImages[0]);
                  } catch (_e) {}
                }}
                style={{ position: 'absolute', top: 8, right: 8, zIndex: 5 }}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                {Platform.OS === 'ios' ? (
                  <BlurView intensity={65} tint="dark" style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    <Ionicons name="arrow-down-circle-outline" size={18} color="#FFF" />
                  </BlurView>
                ) : (
                  <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="arrow-down-circle-outline" size={18} color="#FFF" />
                  </View>
                )}
              </TouchableOpacity>
            </View>
          ) : null}

          {fileAttachments.length > 0 ? (
            <View style={{ alignSelf: 'flex-end', marginHorizontal: 16, marginBottom: cleanUserContent ? 6 : 0, gap: 6 }}>
              {fileAttachments.map((fa, fi) => {
                const isVideo = fa.mimeType.includes('video') || fa.mimeType === 'video';
                const isPdf = fa.mimeType.includes('pdf');
                const isDoc = fa.mimeType.includes('doc') || fa.mimeType.includes('word');
                const isSheet = fa.mimeType.includes('sheet') || fa.mimeType.includes('excel') || fa.mimeType.includes('csv');
                // Video gets a special preview card
                if (isVideo) {
                  return <VideoPreviewCard key={`fa-${fi}`} name={fa.name} isDark={isDark} colors={colors} uri={undefined} />;
                }
                const iconName: any = isPdf ? 'document-text' : isDoc ? 'document-text' : isSheet ? 'grid' : 'attach';
                const iconColor = isPdf ? '#FF3B30' : isDoc ? '#007AFF' : isSheet ? '#34C759' : colors.primary;
                const extRaw = fa.mimeType.split('/').pop() || 'file';
                const ext = extRaw.replace('vnd.', '').slice(0, 8).toUpperCase();
                return (
                  <View key={`fa-${fi}`} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? 'rgba(44,44,46,0.96)' : 'rgba(235,235,240,0.98)', borderRadius: 13, paddingHorizontal: 11, paddingVertical: 9, gap: 9, maxWidth: 256, borderWidth: StyleSheet.hairlineWidth, borderColor: isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.07)' }}>
                    <View style={{ width: 34, height: 34, borderRadius: 8, backgroundColor: iconColor + '22', alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name={iconName} size={17} color={iconColor} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }} numberOfLines={1}>{fa.name}</Text>
                      <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 1 }}>{ext}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : null}

          {cleanUserContent ? (
            <View style={[userStyles.bubble, { backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA' }]}>
              <Text
                selectable
                selectionColor={(settings as any)?.accentColor ? (settings as any).accentColor + '55' : '#007AFF55'}
                style={[userStyles.text, { color: colors.text }]}
              >
                {cleanUserContent}
              </Text>
              {message.isEdited ? <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 4, textAlign: 'right' }}>Edited</Text> : null}
            </View>
          ) : null}

        </View>

        {hasValidImage ? (
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
  const isCurrentlyStreaming = !!(isGenerating || streaming);

  // ── Parse inline [IMAGE_SEARCH:query] tags ─────────────────────────────────
  const inlineImageSearchQueries: string[] = [];
  try {
    const isTagRegex = /\[IMAGE_SEARCH:([^\]]+)\]/g;
    let isTagMatch: RegExpExecArray | null;
    while ((isTagMatch = isTagRegex.exec(safeContent)) !== null) {
      const q = (isTagMatch[1] || '').trim();
      if (q && !inlineImageSearchQueries.includes(q)) inlineImageSearchQueries.push(q);
    }
  } catch (_e) {}

  // ── Parse Spotify results tag ───────────────────────────────────────────
  // ── Parse [WEATHER_CITY:city] tag
  let weatherCity: string | null = null;
  const weatherMatch = safeContent.match(/\[WEATHER_CITY:([^\]]+)\]/);
  if (weatherMatch) weatherCity = weatherMatch[1].trim();

  // ── Parse [MAP_LOCATION:json] tag
  let mapLocationData: { location: string; lat?: number; lon?: number } | null = null;
  const mapMatch = safeContent.match(/\[MAP_LOCATION:([^\]]+)\]/);
  if (mapMatch) {
    try {
      mapLocationData = JSON.parse(mapMatch[1]);
    } catch {
      mapLocationData = { location: mapMatch[1].trim() };
    }
  }

  // ── Parse [CONTEXT_PHOTO:json] tag — contextual Unsplash photo reference
  let contextPhoto: { url: string; title?: string; query?: string } | null = null;
  const contextPhotoMatch = safeContent.match(/\[CONTEXT_PHOTO:([^\]]+)\]/);
  if (contextPhotoMatch) {
    try {
      contextPhoto = JSON.parse(contextPhotoMatch[1]);
    } catch {
      contextPhoto = null;
    }
  }

  let spotifyTracks: SpotifyTrack[] | null = null;
  let contentWithoutSpotify = safeContent
    .replace(/\[WEATHER_CITY:[^\]]+\]/g, '')
    .replace(/\[MAP_LOCATION:[^\]]+\]/g, '')
    .replace(/\[CONTEXT_PHOTO:[^\]]+\]/g, '')
    .replace(/\[IMAGE_SEARCH:[^\]]+\]/g, '')
    .trim();
  try {
    const spotifyMatch = safeContent.match(/\[SPOTIFY_RESULTS:(.*?)\]/s);
    if (spotifyMatch) {
      const parsed = JSON.parse(spotifyMatch[1]);
      if (Array.isArray(parsed) && parsed.length > 0) {
        spotifyTracks = parsed as SpotifyTrack[];
      }
      contentWithoutSpotify = safeContent.replace(/\[SPOTIFY_RESULTS:.*?\]/s, '').trim();
    }
  } catch (_e) {
    contentWithoutSpotify = safeContent.replace(/\[SPOTIFY_RESULTS:[^\]]*\]/g, '').trim();
  }

  // Extract TikTok card before parsing blocks
  const { cleanContent: contentWithoutTiktok, card: tiktokCardData } = parseTikTokCard(contentWithoutSpotify);

  // SAFE parse — wrap entire parseMarkdownBlocks in try/catch to prevent crashes
  let blocks: Block[] = [];
  try {
    blocks = parseMarkdownBlocks(contentWithoutTiktok, isCurrentlyStreaming);
  } catch (_e) {
    // If parsing throws during streaming, show raw text as paragraph
    blocks = contentWithoutTiktok ? [{ type: 'paragraph', content: contentWithoutTiktok }] : [];
  }

  const allImageUrls = embeddedImages.map(im => im.url);

  // ── Deduplicate preview cards ──────────────────────────────────────────────
  // Track which URLs already have a dedicated card so we never show a duplicate
  // generic LinkPreviewCard for the same URL.
  const _renderedPreviewUrls = new Set<string>();
  // Mark TikTok URLs as already handled if a [TIKTOK_CARD] block is present
  if (tiktokCardData) {
    if (tiktokCardData.videoUrl) _renderedPreviewUrls.add(tiktokCardData.videoUrl);
    // Also mark any tiktok.com domain URL as handled
    _renderedPreviewUrls.add('__tiktok__');
  }

  return (
    <>
      <View style={assistantStyles.container}>
        <View style={assistantStyles.inner}>
          {/* Thinking dot — shown only when generating with no content yet */}
          {isGenerating && !safeContent ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8, paddingVertical: 4 }}>
              <ThemeDot isDark={isDark} />
            </View>
          ) : null}

          {blocks.map((block, bi) => {
            // Code block — streaming flag handled by StreamingCodePlaceholder
            if (block.type === 'code') {
              return (
                <View key={`b-${bi}`} style={{ marginVertical: 6 }}>
                  <StreamingCodeBlock
                    code={block.content || ''}
                    language={block.language || 'plaintext'}
                    isStreaming={!!block.streaming}
                    isAdmin={isAdmin}
                  />
                </View>
              );
            }

            if (block.type === 'heading') {
              const fontSize = block.level === 1 ? 22 : block.level === 2 ? 19 : block.level === 3 ? 17 : 16;
              const fontWeight: any = block.level === 1 ? '800' : block.level === 2 ? '700' : '600';
              return (
                <View key={`b-${bi}`} style={{ marginTop: bi > 0 ? 14 : 4, marginBottom: 4 }}>
                  <InlineText text={block.content} textStyle={{ fontSize, fontWeight, color: colors.text, lineHeight: fontSize * 1.3 }} onPhonePress={handlePhonePress} onLinkPress={handleLinkPress} />
                </View>
              );
            }

            if (block.type === 'divider') {
              return (
                <View key={`b-${bi}`} style={{ marginVertical: 14 }}>
                  <View style={{ height: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.09)', borderRadius: 1 }} />
                </View>
              );
            }

            if (block.type === 'blockquote') {
              return (
                <View key={`b-${bi}`} style={{ flexDirection: 'row', marginVertical: 6, borderRadius: 10, overflow: 'hidden', backgroundColor: isDark ? 'rgba(99,102,241,0.09)' : 'rgba(99,102,241,0.065)' }}>
                  <View style={{ width: 3.5, backgroundColor: colors.primary, borderRadius: 2 }} />
                  <View style={{ flex: 1, paddingHorizontal: 13, paddingVertical: 10 }}>
                    <InlineText text={block.content} textStyle={{ fontSize: 15, color: isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.72)', lineHeight: 23, fontStyle: 'italic' }} onPhonePress={handlePhonePress} onLinkPress={handleLinkPress} />
                  </View>
                </View>
              );
            }

            if (block.type === 'table') {
              return (
                <View key={`b-${bi}`} style={{ marginVertical: 6 }}>
                  <MarkdownTable rows={block.rows || []} hasHeader={block.hasHeader} isDark={isDark} colors={colors} />
                </View>
              );
            }

            if (block.type === 'bullet') {
              return (
                <View key={`b-${bi}`} style={{ flexDirection: 'row', marginVertical: 3, paddingLeft: 4, alignItems: 'flex-start' }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)', marginTop: 9, marginRight: 10, flexShrink: 0 }} />
                  <View style={{ flex: 1 }}>
                    <Text
                    selectable
                    selectionColor={colors.primary + '55'}
                    style={{ fontSize: 16, color: colors.text, lineHeight: 25 }}
                    onSelectionChange={(e) => handleSelectionChange(e, block.content || '', setSelectedText, setShowFloatingCopy)}
                  >
                    {renderInlineSegments(block.content || '', handlePhonePress, handleLinkPress, isDark)}
                  </Text>
                  </View>
                </View>
              );
            }

            if (block.type === 'numbered') {
              let num = 1;
              for (let ni = bi - 1; ni >= 0; ni--) {
                if (blocks[ni].type === 'numbered') num++;
                else break;
              }
              return (
                <View key={`b-${bi}`} style={{ flexDirection: 'row', marginVertical: 3, paddingLeft: 4, alignItems: 'flex-start' }}>
                  <Text style={{ color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)', fontSize: 15, fontWeight: '600', minWidth: 26, lineHeight: 25, textAlign: 'right', marginRight: 8 }}>{num}.</Text>
                  <View style={{ flex: 1 }}>
                    <Text
                    selectable
                    selectionColor={colors.primary + '55'}
                    style={{ fontSize: 16, color: colors.text, lineHeight: 25 }}
                    onSelectionChange={(e) => handleSelectionChange(e, block.content || '', setSelectedText, setShowFloatingCopy)}
                  >
                    {renderInlineSegments(block.content || '', handlePhonePress, handleLinkPress, isDark)}
                  </Text>
                  </View>
                </View>
              );
            }

            if (block.type === 'image' && block.content) {
              return (
                <TouchableOpacity key={`b-${bi}`} onPress={() => handleImagePress(block.content, [block.content], 0)} activeOpacity={0.88} style={{ marginVertical: 8 }}>
                  <Image source={{ uri: block.content }} style={{ width: '100%', height: 220, borderRadius: 16 }} contentFit="cover" transition={200} />
                </TouchableOpacity>
              );
            }

            if (block.type === 'sources') return null;

            if (block.type === 'paragraph') {
              const urlsInPara = (block.content || '').match(URL_REGEX) || [];
              const hasDownloadLink = urlsInPara.some(u => /\.(pdf|zip|doc|docx|xls|xlsx|csv|mp3|mp4|mov|apk)(\?|$)/i.test(u));
              const previewLinks = urlsInPara.filter(u => !(/\.(pdf|zip|doc|docx|xls|xlsx|csv|mp3|mp4|mov|apk)(\?|$)/i.test(u)));
              if (hasDownloadLink) {
                return (
                  <View key={`b-${bi}`} style={{ marginVertical: 4 }}>
                    <Text
                      selectable
                      selectionColor={colors.primary + '55'}
                      style={{ fontSize: 16, color: colors.text, lineHeight: 26 }}
                    >
                      {renderInlineSegments((block.content || '').replace(URL_REGEX, '').trim(), handlePhonePress, handleLinkPress, isDark)}
                    </Text>
                    {urlsInPara.map((url, ui) => <DownloadLinkCard key={ui} url={url} />)}
                  </View>
                );
              }
              const deduplicatedPreviewLinks = previewLinks.filter(u => {
                if (tiktokCardData && (u.includes('tiktok.com') || u.includes('vm.tiktok'))) return false;
                if (_renderedPreviewUrls.has(u)) return false;
                _renderedPreviewUrls.add(u);
                return true;
              }).slice(0, 1);

              // Spacing between paragraphs — add top margin when previous block is also a paragraph
              const prevBlock = bi > 0 ? blocks[bi - 1] : null;
              const topMargin = prevBlock && (prevBlock.type === 'paragraph' || prevBlock.type === 'code') ? 10 : 4;

              return (
                <View key={`b-${bi}`} style={{ marginTop: topMargin, marginBottom: 4 }}>
                  <Text
                    selectable
                    selectionColor={colors.primary + '55'}
                    style={{ fontSize: 16, color: colors.text, lineHeight: 26 }}
                    onSelectionChange={(e) => handleSelectionChange(e, block.content || '', setSelectedText, setShowFloatingCopy)}
                  >
                    {renderInlineSegments(block.content || '', handlePhonePress, handleLinkPress, isDark)}
                  </Text>
                  {deduplicatedPreviewLinks.map((pUrl, pi) => {
                    const meta = extractLinkMetadataFromAIResponse(safeContent, pUrl);
                    return (
                      <LinkPreviewCard
                        key={`ai-url-${pi}-${pUrl}`}
                        url={pUrl}
                        metadata={meta}
                        isDark={isDark}
                        colors={colors}
                        compact={false}
                      />
                    );
                  })}
                </View>
              );
            }

            return null;
          })}

          {embeddedImages.length > 0 ? (
            <ImageGrid images={embeddedImages} onPress={(url, idx) => handleImagePress(url, allImageUrls, idx)} onSendToChat={handleSendImageToChat} />
          ) : null}

          {/* Spotify results card */}
          {weatherCity ? (
            <WeatherCard city={weatherCity} isDark={isDark} />
          ) : null}
          {mapLocationData ? (
            <MapCard
              location={mapLocationData.location}
              lat={mapLocationData.lat}
              lon={mapLocationData.lon}
              isDark={isDark}
            />
          ) : null}
          {spotifyTracks && spotifyTracks.length > 0 ? (
            <SpotifyMusicCard
              tracks={spotifyTracks}
              isDark={isDark}
              onConnectSpotify={() => {}}
            />
          ) : null}

          {/* TikTok preview card */}
          {tiktokCardData ? (
            <TikTokPreviewCard card={tiktokCardData} isDark={isDark} colors={colors} />
          ) : null}

          {/* Inline [IMAGE_SEARCH:query] cards */}
          {inlineImageSearchQueries.map((q, qi) => (
            <InlineImageCard
              key={`isearch-${qi}`}
              query={q}
              isDark={isDark}
              colors={colors}
              onPress={(url) => handleImagePress(url, [url], 0)}
            />
          ))}

          {/* Contextual Unsplash photo reference — shown for informational topics */}
          {contextPhoto && contextPhoto.url ? (
            <View style={{ marginTop: 10, marginBottom: 4 }}>
              <TouchableOpacity
                onPress={() => handleImagePress(contextPhoto!.url, [contextPhoto!.url], 0)}
                activeOpacity={0.88}
              >
                <Image
                  source={{ uri: contextPhoto.url }}
                  style={{ width: '100%', height: 200, borderRadius: 16 }}
                  contentFit="cover"
                  transition={300}
                />
              </TouchableOpacity>
              {contextPhoto.title ? (
                <Text style={{ color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)', fontSize: 12, marginTop: 5, textAlign: 'center' }}>
                  {contextPhoto.title} · via Unsplash
                </Text>
              ) : null}
            </View>
          ) : null}

          {message.imageUrl && !isUser ? (
            <TouchableOpacity onPress={() => handleImagePress(message.imageUrl!, [message.imageUrl!], 0)} activeOpacity={0.88} style={{ marginTop: 10 }}>
              <Image source={{ uri: message.imageUrl }} style={{ width: '100%', height: 240, borderRadius: 16 }} contentFit="cover" transition={200} />
            </TouchableOpacity>
          ) : null}



          {/* Action row — only shown after streaming completes */}
          {!isGenerating && !streaming && safeContent ? (() => {
            const sourcesBlock = blocks.find(b => b.type === 'sources' && b.sources && b.sources.length > 0);
            // Parse sources to Source[] objects
            let parsedSources: Source[] = [];
            if (sourcesBlock) {
              try {
                const raw = (sourcesBlock.sources || []).join('\n');
                const jsonMatch = raw.match(/\[\{[\s\S]*?\}\]/);
                if (jsonMatch) { try { parsedSources = JSON.parse(jsonMatch[0]); } catch {} }
                if (parsedSources.length === 0) {
                  parsedSources = (sourcesBlock.sources || []).map(s => ({
                    title: s.startsWith('http') ? getDomainFromSource(s) : s,
                    url: s.startsWith('http') ? s : `https://www.google.com/search?q=${encodeURIComponent(s)}`,
                  }));
                }
              } catch {}
            }
            const shownFavicons = parsedSources.slice(0, 3).map(s => {
              try { return new URL(s.url).hostname.replace('www.', ''); } catch { return ''; }
            }).filter(Boolean);

            return (
              <>
                <View style={assistantStyles.actionRow}>
                  <TouchableOpacity
                    onPress={() => {
                      if (selectedText.trim()) {
                        Clipboard.setStringAsync(selectedText.trim()).catch(() => {});
                        setCopiedFlash(true);
                        setTimeout(() => setCopiedFlash(false), 1200);
                      }
                    }}
                    onLongPress={() => {
                      const cleanText = safeContent.replace(/[#*`>]/g, '').replace(/\[SOURCES\][\s\S]*?\[\/SOURCES\]/gi, '').trim();
                      Clipboard.setStringAsync(cleanText).catch(() => {});
                      setCopiedFlash(true);
                      setTimeout(() => setCopiedFlash(false), 1200);
                      onCopy?.();
                    }}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={assistantStyles.actionBtn}
                    delayLongPress={600}
                  >
                    <Ionicons name={copiedFlash ? 'checkmark' : 'copy-outline'} size={18} color={copiedFlash ? '#10A37F' : colors.textSecondary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleReadAloud}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={assistantStyles.actionBtn}
                  >
                    {ttsLoading ? (
                      <ActivityIndicator size="small" color={colors.textSecondary} />
                    ) : (
                      <Ionicons name={ttsPlaying ? 'stop-circle-outline' : 'volume-medium-outline'} size={18} color={ttsPlaying ? '#10A37F' : colors.textSecondary} />
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => onLike?.(message.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={assistantStyles.actionBtn}>
                    <Ionicons name={isLiked ? 'thumbs-up' : 'thumbs-up-outline'} size={18} color={isLiked ? '#10A37F' : colors.textSecondary} />
                  </TouchableOpacity>
                  {!isLiked ? (
                    <TouchableOpacity onPress={() => onUnlike?.(message.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={assistantStyles.actionBtn}>
                      <Ionicons name={isUnliked ? 'thumbs-down' : 'thumbs-down-outline'} size={18} color={isUnliked ? '#FF453A' : colors.textSecondary} />
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity onPress={() => onOpenActions?.(message)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={assistantStyles.actionBtn}>
                    <Ionicons name="ellipsis-horizontal" size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                  {/* Sources button — stacked favicons */}
                  {parsedSources.length > 0 ? (
                    <TouchableOpacity
                      onPress={() => { setSourcesData(parsedSources); setSourcesModalVisible(true); }}
                      hitSlop={{ top: 10, bottom: 10, left: 6, right: 10 }}
                      style={assistantStyles.sourcesBtn}
                      activeOpacity={0.7}
                    >
                      {/* Stacked favicons (up to 3) */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 2 }}>
                        {shownFavicons.map((domain, idx) => (
                          <FaviconBubble key={`fav-${idx}-${domain}`} domain={domain} index={idx} isDark={isDark} />
                        ))}
                      </View>
                      <Text style={[assistantStyles.sourcesLabel, { color: colors.textSecondary }]}>
                        {parsedSources.length} Source{parsedSources.length !== 1 ? 's' : ''}
                      </Text>
                      <Ionicons name="chevron-forward" size={12} color={colors.textSecondary} />
                    </TouchableOpacity>
                  ) : null}
                </View>
                {/* Floating copy button — appears when text is selected */}
                {showFloatingCopy && selectedText.trim() ? (
                  <TouchableOpacity
                    onPress={() => {
                      Clipboard.setStringAsync(selectedText.trim()).catch(() => {});
                      setCopiedFlash(true);
                      setShowFloatingCopy(false);
                      setSelectedText('');
                      setTimeout(() => setCopiedFlash(false), 1200);
                    }}
                    activeOpacity={0.8}
                    style={{ position: 'absolute', top: -44, right: 12, zIndex: 20 }}
                  >
                    {Platform.OS === 'ios' ? (
                      <BlurView intensity={80} tint={isDark ? "dark" : "light"} style={{ borderRadius: 24, overflow: 'hidden', paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Ionicons name="copy-outline" size={15} color={isDark ? '#FFF' : '#000'} />
                        <Text style={{ color: isDark ? '#FFF' : '#000', fontSize: 13, fontWeight: '600' }}>Copy</Text>
                      </BlurView>
                    ) : (
                      <View style={{ borderRadius: 24, backgroundColor: isDark ? 'rgba(44,44,46,0.95)' : 'rgba(255,255,255,0.95)', paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Ionicons name="copy-outline" size={15} color={isDark ? '#FFF' : '#000'} />
                        <Text style={{ color: isDark ? '#FFF' : '#000', fontSize: 13, fontWeight: '600' }}>Copy</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ) : null}
              </>
            );
          })() : null}
        </View>
      </View>

      <PhoneCallModal visible={phoneModalVisible} number={pendingPhone} onClose={() => setPhoneModalVisible(false)} />

      <Modal visible={imageViewerVisible} transparent animationType="fade" onRequestClose={() => setImageViewerVisible(false)} statusBarTranslucent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.93)', justifyContent: 'center', alignItems: 'center' }}>
          <TouchableOpacity style={{ position: 'absolute', top: Platform.OS === 'ios' ? 56 : 24, right: 20, zIndex: 10, width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }} onPress={() => setImageViewerVisible(false)}>
            <Ionicons name="close" size={22} color="#FFF" />
          </TouchableOpacity>
          <Image source={{ uri: viewerImages[viewerIndex] || '' }} style={{ width: Dimensions.get('window').width, height: Dimensions.get('window').height * 0.75 }} contentFit="contain" />
          {viewerImages.length > 1 ? (
            <View style={{ flexDirection: 'row', gap: 16, marginTop: 16 }}>
              <TouchableOpacity onPress={() => setViewerIndex(im => Math.max(0, im - 1))} disabled={viewerIndex === 0}>
                <Ionicons name="chevron-back" size={28} color={viewerIndex === 0 ? 'rgba(255,255,255,0.3)' : '#FFF'} />
              </TouchableOpacity>
              <Text style={{ color: '#FFF', fontSize: 14 }}>{viewerIndex + 1} / {viewerImages.length}</Text>
              <TouchableOpacity onPress={() => setViewerIndex(im => Math.min(viewerImages.length - 1, im + 1))} disabled={viewerIndex === viewerImages.length - 1}>
                <Ionicons name="chevron-forward" size={28} color={viewerIndex === viewerImages.length - 1 ? 'rgba(255,255,255,0.3)' : '#FFF'} />
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </Modal>

      {/* Sources modal — URL-only sources */}
      <SourcesModal visible={sourcesModalVisible} sources={sourcesData} onClose={() => setSourcesModalVisible(false)} />
      {/* Inline sources modal — structured JSON sources from web search */}
      <SourcesModal visible={inlineSourcesVisible} sources={inlineSources} onClose={() => setInlineSourcesVisible(false)} />
    </>
  );
});

// ── Styles ────────────────────────────────────────────────────────────────────
const userStyles = StyleSheet.create({
  container: { alignItems: 'flex-end', paddingHorizontal: 16, marginBottom: 14 },
  bubble: { maxWidth: '82%', borderRadius: 20, borderBottomRightRadius: 6, paddingHorizontal: 15, paddingVertical: 11 },
  text: { fontSize: 16, lineHeight: 24 },
});

const assistantStyles = StyleSheet.create({
  container: { paddingHorizontal: 16, marginBottom: 16 },
  inner: { maxWidth: '100%' },
  actionRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 4, flexWrap: 'nowrap' },
  actionBtn: { padding: 7, borderRadius: 10 },
  sourcesBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 7, paddingHorizontal: 6 },
  sourcesLabel: { fontSize: 13, fontWeight: '500' },
});
