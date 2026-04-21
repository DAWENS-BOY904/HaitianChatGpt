import React, { useState, memo, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Modal,
  ActivityIndicator,
  Alert,
  Dimensions,
  ScrollView,
  Share,
  Platform,
  Animated,
  TextInput,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { BlurView } from 'expo-blur';
import { useTheme } from '../hooks/useTheme';
import { useAuth, useAlert } from '@/template';
import { router } from 'expo-router';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { CodeBlock, StreamingCodeBlock } from './StreamingCodeBlock';
import { StreamingText } from './StreamingText';
import { MessageActionsModal } from './MessageActionsModal';
import { LinkSafetyModal } from './LinkSafetyModal';
import { WebViewModal } from './WebViewModal';
import { ImageViewerModal } from './ImageViewerModal';
import { ImageEditModal } from './ImageEditModal';
import { FileDownloadModal } from './FileDownloadModal';
import { SourcesButton, parseSources, Source } from './SourcesModal';
import { AnalysisModal, TerminalButton, parseAnalysis } from './AnalysisModal';
import { getSupabaseClient } from '@/template';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface MessageItemProps {
  message: {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    image_url?: string;
    file_url?: string;
    file_name?: string;
    file_type?: string;
    created_at: string;
    edited?: boolean;
    edited_at?: string;
  };
  onCancel?: () => void;
  onEdit?: (messageId: string, content: string) => void;
  onCopy?: () => void;
  onChunkRendered?: () => void;
  isGenerating?: boolean;
  streaming?: boolean;
  streamingSpeed?: number;
  isOffline?: boolean;
}

// Blinking cursor for streaming
const BlinkingCursor = memo(function BlinkingCursor({ color }: { color: string }) {
  const blink = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(blink, { toValue: 0, duration: 500, useNativeDriver: true }),
        Animated.timing(blink, { toValue: 1, duration: 500, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);
  return (
    <Animated.Text style={{ opacity: blink, color, fontSize: 16, fontWeight: '300', lineHeight: 22 }}>
      {'▋'}
    </Animated.Text>
  );
});

// Detect if URL is an image
const isImageUrl = (url: string): boolean => {
  if (!url) return false;
  const lowerUrl = url.toLowerCase();
  return (
    /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/.test(lowerUrl) ||
    lowerUrl.startsWith('data:image/') ||
    lowerUrl.includes('oaidalleapiprodscus') ||
    lowerUrl.includes('replicate.delivery') ||
    lowerUrl.includes('storage.googleapis') ||
    (lowerUrl.includes('supabase') && lowerUrl.includes('chat-images')) ||
    lowerUrl.includes('/images/generations') ||
    lowerUrl.includes('cdn.openai.com') ||
    lowerUrl.includes('image.onspace.ai')
  );
};

// ── Markdown Table Renderer ──
const MarkdownTable = memo(function MarkdownTable({ tableText, colors }: { tableText: string; colors: any }) {
  const rows = tableText
    .split('\n')
    .map(r => r.trim())
    .filter(r => r.startsWith('|') && r.endsWith('|'));

  if (rows.length < 2) return null;

  const parseRow = (row: string) =>
    row.split('|').map(c => c.trim()).filter((_, i, arr) => i > 0 && i < arr.length - 1);

  const isSeparator = (row: string) => /^[\|\s\-:]+$/.test(row);
  const headerRow = parseRow(rows[0]);
  const dataRows = rows.slice(1).filter(r => !isSeparator(r)).map(parseRow);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator style={{ marginVertical: 8 }}>
      <View style={{ borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
        <View style={{ flexDirection: 'row', backgroundColor: colors.surface }}>
          {headerRow.map((cell, ci) => (
            <View key={ci} style={{
              minWidth: 100, paddingHorizontal: 14, paddingVertical: 10,
              borderRightWidth: ci < headerRow.length - 1 ? 1 : 0,
              borderRightColor: colors.border,
            }}>
              <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13 }}>{cell}</Text>
            </View>
          ))}
        </View>
        {dataRows.map((row, ri) => (
          <View key={ri} style={{
            flexDirection: 'row',
            backgroundColor: ri % 2 === 0 ? colors.background : `${colors.surface}88`,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}>
            {headerRow.map((_, ci) => (
              <View key={ci} style={{
                minWidth: 100, paddingHorizontal: 14, paddingVertical: 9,
                borderRightWidth: ci < headerRow.length - 1 ? 1 : 0,
                borderRightColor: colors.border,
              }}>
                <Text style={{ color: colors.text, fontSize: 13 }}>{row[ci] ?? ''}</Text>
              </View>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
});

const extractInlineImages = (text: string): { text: string; images: string[] } => {
  const images: string[] = [];
  const mdImgRegex = /!\[([^\]]*)\]\((https?:\/\/[^\)]+)\)/g;
  let cleaned = text.replace(mdImgRegex, (_, _alt, url) => {
    if (isImageUrl(url)) { images.push(url); return ''; }
    return _;
  });
  const bareUrlRegex = /(https?:\/\/[^\s]+\.(?:jpg|jpeg|png|gif|webp|bmp)(?:\?[^\s]*)?)/gi;
  cleaned = cleaned.replace(bareUrlRegex, (url) => {
    if (isImageUrl(url)) { images.push(url); return ''; }
    return url;
  });
  return { text: cleaned.trim(), images: [...new Set(images)] };
};

const splitTablesFromText = (text: string): Array<{ type: 'text' | 'table'; content: string }> => {
  const lines = text.split('\n');
  const result: Array<{ type: 'text' | 'table'; content: string }> = [];
  let currentText: string[] = [];
  let currentTable: string[] = [];
  let inTable = false;

  for (const line of lines) {
    const isTableRow = /^\s*\|.+\|\s*$/.test(line);
    if (isTableRow) {
      if (!inTable) {
        if (currentText.length > 0) {
          result.push({ type: 'text', content: currentText.join('\n') });
          currentText = [];
        }
        inTable = true;
      }
      currentTable.push(line);
    } else {
      if (inTable) {
        result.push({ type: 'table', content: currentTable.join('\n') });
        currentTable = [];
        inTable = false;
      }
      currentText.push(line);
    }
  }
  if (inTable && currentTable.length > 0) result.push({ type: 'table', content: currentTable.join('\n') });
  if (currentText.length > 0) result.push({ type: 'text', content: currentText.join('\n') });
  return result;
};

const getFileIcon = (fileType?: string): keyof typeof Ionicons.glyphMap => {
  const iconMap: Record<string, keyof typeof Ionicons.glyphMap> = {
    csv: 'document-text', html: 'code-slash', json: 'code',
    js: 'logo-javascript', ts: 'code', pdf: 'document',
    doc: 'document-text', docx: 'document-text', xls: 'grid',
    xlsx: 'grid', zip: 'archive', default: 'document',
  };
  return iconMap[fileType?.toLowerCase() || ''] || iconMap.default;
};

const extractMessageCard = (content: string): { hasCard: boolean; cardContent: string; beforeCard: string } => {
  const startTag = '[MESSAGE_CARD]';
  const endTag = '[/MESSAGE_CARD]';
  const start = content.indexOf(startTag);
  const end = content.indexOf(endTag);
  if (start !== -1 && end !== -1) {
    return {
      hasCard: true,
      cardContent: content.substring(start + startTag.length, end).trim(),
      beforeCard: content.substring(0, start).trim(),
    };
  }
  return { hasCard: false, cardContent: '', beforeCard: content };
};

const DownloadLinkCard = memo(function DownloadLinkCard({ label, colors }: { label: string; colors: any }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, marginBottom: 2 }}>
      <Text style={{ fontSize: 18 }}>{'👉'}</Text>
      <Text style={{ fontSize: 15, color: colors.primary, textDecorationLine: 'underline', fontWeight: '500' }}>
        {label}
      </Text>
      <Text style={{ fontSize: 14, color: colors.primary }}>{'↗'}</Text>
    </View>
  );
});

const MessageCard = memo(function MessageCard({ content, colors }: { content: string; colors: any }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(content);
  const [copied, setCopied] = useState(false);
  const { showAlert } = useAlert();

  const handleCopy = async () => {
    await Clipboard.setStringAsync(editedContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = async () => {
    try {
      const fileName = `message_${Date.now()}.txt`;
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(fileUri, editedContent, { encoding: FileSystem.EncodingType.UTF8 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, { mimeType: 'text/plain', dialogTitle: 'Save Message', UTI: 'public.plain-text' });
      } else {
        await Share.share({ message: editedContent, title: 'Message' });
      }
    } catch {
      showAlert('Error', 'Failed to download message');
    }
  };

  const handleShare = async () => {
    try { await Share.share({ message: editedContent, title: 'Message' }); } catch {}
  };

  if (isEditing) {
    return (
      <Modal visible animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 56 : 24,
            paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border,
          }}>
            <TouchableOpacity onPress={() => setIsEditing(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={{ color: colors.text, fontSize: 17, fontWeight: '600' }}>Message</Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity onPress={handleCopy}><Ionicons name="copy-outline" size={22} color={colors.text} /></TouchableOpacity>
              <TouchableOpacity onPress={handleShare}><Ionicons name="share-outline" size={22} color={colors.text} /></TouchableOpacity>
            </View>
          </View>
          <ScrollView style={{ flex: 1, padding: 20 }}>
            <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 20, minHeight: 300 }}>
              <Text style={{ color: colors.text, fontSize: 16, lineHeight: 26, fontWeight: '400' }} selectable>
                {editedContent}
              </Text>
            </View>
          </ScrollView>
        </View>
      </Modal>
    );
  }

  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: 16, marginTop: 8, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: `${colors.background}80` }}>
        <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '500' }}>Message</Text>
        <View style={{ flexDirection: 'row', gap: 16 }}>
          <TouchableOpacity onPress={() => setIsEditing(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="pencil-outline" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleCopy} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={18} color={copied ? colors.primary : colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleShare} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="share-outline" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>
      <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
        <View style={{ padding: 16 }}>
          <Text style={{ color: colors.text, fontSize: 15, lineHeight: 24, fontWeight: '400' }}>
            {editedContent}
          </Text>
        </View>
      </ScrollView>
      <TouchableOpacity
        onPress={handleDownload}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: `${colors.primary}10` }}
      >
        <Ionicons name="download-outline" size={16} color={colors.primary} />
        <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '600' }}>Download Message</Text>
      </TouchableOpacity>
    </View>
  );
});

function parseDownloadCard(content: string): { text: string; downloadLabel?: string } {
  const startTag = '[DOWNLOAD_CARD]';
  const endTag = '[/DOWNLOAD_CARD]';
  const start = content.indexOf(startTag);
  const end = content.indexOf(endTag);
  if (start === -1 || end === -1) return { text: content };
  const label = content.substring(start + startTag.length, end).trim();
  const before = content.substring(0, start).trim();
  const after = content.substring(end + endTag.length).trim();
  return { text: [before, after].filter(Boolean).join('\n\n'), downloadLabel: label };
}

// ── Inline markdown renderer (bold, italic, code) ──
function renderInlineMarkdown(text: string, baseStyle: any, colors: any): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`)/g;
  let lastIndex = 0;
  let match;
  let keyIdx = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<Text key={`t${keyIdx++}`}>{text.slice(lastIndex, match.index)}</Text>);
    }
    if (match[2]) {
      parts.push(<Text key={`b${keyIdx++}`} style={{ fontWeight: '700' }}>{match[2]}</Text>);
    } else if (match[3]) {
      parts.push(<Text key={`i${keyIdx++}`} style={{ fontStyle: 'italic' }}>{match[3]}</Text>);
    } else if (match[4]) {
      parts.push(
        <Text key={`c${keyIdx++}`} style={{
          fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
          fontSize: 13,
          backgroundColor: 'rgba(120,120,128,0.2)',
          color: colors.primary,
          paddingHorizontal: 4,
          borderRadius: 4,
        }}>{match[4]}</Text>
      );
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(<Text key={`t${keyIdx++}`}>{text.slice(lastIndex)}</Text>);
  }
  return parts.length > 0 ? parts : text;
}

// ── Format timestamp ──
function formatMessageTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (isToday) return `Today, ${timeStr}`;
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return `Yesterday, ${timeStr}`;
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ', ' + timeStr;
  } catch {
    return '';
  }
}

// ── Blur Context Menu (like Photo 1) ──
const BlurContextMenu = memo(function BlurContextMenu({
  visible,
  timeLabel,
  items,
  onClose,
}: {
  visible: boolean;
  timeLabel: string;
  items: Array<{ icon: string; label: string; onPress: () => void; destructive?: boolean }>;
  onClose: () => void;
}) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, tension: 280, friction: 22, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 0.85, duration: 120, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={ctxStyles.backdrop} onPress={onClose}>
        <Animated.View style={[ctxStyles.menuWrap, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
          <BlurView intensity={85} tint="dark" style={ctxStyles.blurBox}>
            {timeLabel ? (
              <View style={ctxStyles.timeRow}>
                <Text style={ctxStyles.timeText}>{timeLabel}</Text>
              </View>
            ) : null}
            {items.map((item, i) => (
              <TouchableOpacity
                key={item.label}
                style={[ctxStyles.menuItem, i > 0 && ctxStyles.menuItemBorder]}
                activeOpacity={0.65}
                onPress={() => { onClose(); setTimeout(item.onPress, 60); }}
              >
                <Text style={[ctxStyles.menuLabel, item.destructive && ctxStyles.destructiveLabel]}>{item.label}</Text>
                <Ionicons name={item.icon as any} size={22} color={item.destructive ? '#FF453A' : 'rgba(255,255,255,0.85)'} />
              </TouchableOpacity>
            ))}
          </BlurView>
        </Animated.View>
      </Pressable>
    </Modal>
  );
});

const ctxStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuWrap: {
    width: 260,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 24,
  },
  blurBox: { borderRadius: 18, overflow: 'hidden' },
  timeRow: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  timeText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '500',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 15,
  },
  menuItemBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  menuLabel: { fontSize: 17, color: 'rgba(255,255,255,0.92)', fontWeight: '400' },
  destructiveLabel: { color: '#FF453A' },
});

export const MessageItem = memo(function MessageItem({
  message,
  onCancel,
  onEdit,
  onCopy,
  onChunkRendered,
  isGenerating,
  streaming = false,
  streamingSpeed = 50,
  isOffline = false,
}: MessageItemProps) {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const supabase = getSupabaseClient();

  const [showContextMenu, setShowContextMenu] = useState(false);
  const [showActionsModal, setShowActionsModal] = useState(false);
  const [showSelectTextModal, setShowSelectTextModal] = useState(false);
  const [liked, setLiked] = useState<'like' | 'dislike' | null>(null);
  const [analysisVisible, setAnalysisVisible] = useState(false);
  const [selectedLink, setSelectedLink] = useState('');
  const [selectedImageUrl, setSelectedImageUrl] = useState('');
  const [fileData, setFileData] = useState({ name: '', content: '', type: '' });
  const [modals, setModals] = useState({
    link: false, webView: false, imageViewer: false, imageEdit: false, file: false,
  });
  const [downloadingImage, setDownloadingImage] = useState(false);

  // ── Entrance animation ──
  const entranceOpacity = useRef(new Animated.Value(0)).current;
  const entranceTranslateY = useRef(new Animated.Value(16)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(entranceOpacity, { toValue: 1, duration: 260, useNativeDriver: true }),
      Animated.spring(entranceTranslateY, { toValue: 0, tension: 240, friction: 24, useNativeDriver: true }),
    ]).start();
  }, []);

  const toggleModal = useCallback((modalName: keyof typeof modals, value?: boolean) => {
    setModals(prev => ({ ...prev, [modalName]: value ?? !prev[modalName] }));
  }, []);

  const handleDownloadImage = useCallback(async (imageUrl: string) => {
    try {
      setDownloadingImage(true);
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow access to save images to your library.');
        return;
      }
      const ext = imageUrl.split('.').pop()?.split('?')[0] || 'jpg';
      const fileUri = `${FileSystem.documentDirectory}temp_image_${Date.now()}.${ext}`;
      const downloadResult = await FileSystem.downloadAsync(imageUrl, fileUri);
      if (downloadResult.status !== 200) throw new Error('Download failed');
      const asset = await MediaLibrary.createAssetAsync(downloadResult.uri);
      await MediaLibrary.createAlbumAsync('HaitianChatGPT', asset, false);
      showAlert('Success', 'Image saved to your photo library!');
    } catch {
      Alert.alert('Error', 'Failed to save image. Please try again.');
    } finally {
      setDownloadingImage(false);
    }
  }, [showAlert]);

  const handleLongPress = useCallback(() => {
    setShowContextMenu(true);
  }, []);

  const handleCopy = useCallback(async () => {
    await Clipboard.setStringAsync(message.content);
    showAlert('Copied!', 'Message copied to clipboard');
    setShowContextMenu(false);
    onCopy?.();
  }, [message.content, showAlert, onCopy]);

  const handleEdit = useCallback(() => {
    onEdit?.(message.id, message.content);
    setShowContextMenu(false);
  }, [message.id, message.content, onEdit]);

  const handleLike = useCallback(async (type: 'like' | 'dislike') => {
    if (!user) { router.push('/login'); return; }
    try {
      if (liked === type) {
        await supabase.from('message_likes').delete().eq('message_id', message.id).eq('user_id', user.id);
        setLiked(null);
      } else {
        await supabase.from('message_likes').upsert({ message_id: message.id, user_id: user.id, like_type: type });
        setLiked(type);
      }
    } catch {
      showAlert('Error', 'Failed to save feedback');
    }
  }, [liked, message.id, user, supabase, showAlert]);

  const handleLinkPress = useCallback((url: string) => {
    setSelectedLink(url);
    toggleModal('link', true);
  }, [toggleModal]);

  const handleImagePress = useCallback((imageUrl: string) => {
    setSelectedImageUrl(imageUrl);
    toggleModal('imageViewer', true);
  }, [toggleModal]);

  const handleImageEdit = useCallback(() => {
    toggleModal('imageViewer', false);
    toggleModal('imageEdit', true);
  }, [toggleModal]);

  const handleApplyImageEdits = useCallback(async (editPrompt: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('chat', {
        body: { editImageUrl: selectedImageUrl, editPrompt, messages: [], conversationId: 'temp' },
      });
      if (error) throw error;
      if (data.imageUrl) {
        setSelectedImageUrl(data.imageUrl);
        toggleModal('imageEdit', false);
        toggleModal('imageViewer', true);
      }
    } catch (error) {
      throw error;
    }
  }, [selectedImageUrl, supabase, toggleModal]);

  const handleFileDownload = useCallback((fileName: string, fileContent: string, fileType: string) => {
    setFileData({ name: fileName, content: fileContent, type: fileType });
    toggleModal('file', true);
  }, [toggleModal]);

  // ── Parse all special blocks ──
  const parsed = useMemo(() => {
    const { text: t1, sources } = parseSources(message.content);
    const { text: t2, entries: analysisEntries } = parseAnalysis(t1);
    const { text: t3, downloadLabel } = parseDownloadCard(t2);
    const { hasCard, cardContent, beforeCard } = extractMessageCard(t3);
    return { sources, analysisEntries, downloadLabel, hasCard, cardContent, beforeCard };
  }, [message.content]);

  const { sources, analysisEntries, downloadLabel, hasCard, cardContent, beforeCard } = parsed;

  const { inlineImages, cleanedBeforeCard } = useMemo(() => {
    if (message.role !== 'assistant') return { inlineImages: [], cleanedBeforeCard: beforeCard };
    const { text, images } = extractInlineImages(beforeCard);
    return { inlineImages: images, cleanedBeforeCard: text };
  }, [message.role, beforeCard]);

  const contentParts = useMemo(() => {
    const textToProcess = cleanedBeforeCard;
    const parts: Array<{ type: 'text' | 'code'; content: string; language?: string }> = [];
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    let lastIndex = 0;
    let match;
    while ((match = codeBlockRegex.exec(textToProcess)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ type: 'text', content: textToProcess.substring(lastIndex, match.index) });
      }
      parts.push({ type: 'code', language: match[1] || 'text', content: match[2].trim() });
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < textToProcess.length) {
      parts.push({ type: 'text', content: textToProcess.substring(lastIndex) });
    }
    return parts.length > 0 ? parts : [{ type: 'text' as const, content: textToProcess }];
  }, [cleanedBeforeCard]);

  const parseTextWithLinks = useCallback((text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts: any[] = [];
    let lastIndex = 0;
    let match;
    while ((match = urlRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ type: 'text', content: text.substring(lastIndex, match.index) });
      }
      parts.push({ type: 'link', content: match[0], url: match[0] });
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) {
      parts.push({ type: 'text', content: text.substring(lastIndex) });
    }
    return parts.length > 0 ? parts : [{ type: 'text', content: text }];
  }, []);

  const hasGeneratedImage = useMemo(
    () => Boolean(message.image_url && isImageUrl(message.image_url)),
    [message.image_url]
  );

  const shouldStreamPart = useCallback(
    (isLastPart: boolean) => streaming && isGenerating && message.role === 'assistant' && isLastPart,
    [streaming, isGenerating, message.role]
  );

  // Build context menu items based on message role
  const contextMenuItems = useMemo(() => {
    const items: Array<{ icon: string; label: string; onPress: () => void; destructive?: boolean }> = [];
    items.push({ icon: 'copy-outline', label: 'Copy', onPress: handleCopy });
    if (message.role === 'user' && onEdit) {
      items.push({ icon: 'pencil-outline', label: 'Edit', onPress: handleEdit });
    }
    if (message.role === 'assistant') {
      items.push({
        icon: 'text-outline', label: 'Select Text', onPress: () => {
          setShowContextMenu(false);
          setTimeout(() => setShowSelectTextModal(true), 100);
        }
      });
    }
    return items;
  }, [message.role, onEdit, handleCopy, handleEdit]);

  const imgCardStyles = useMemo(() => StyleSheet.create({
    cardWrap: { marginTop: 4, marginBottom: 4 },
    label: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: '500',
      marginBottom: 8,
      paddingLeft: 2,
    },
    imageContainer: {
      borderRadius: 18,
      overflow: 'hidden',
      backgroundColor: colors.surface,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.18,
      shadowRadius: 12,
      elevation: 8,
    },
    image: {
      width: Math.min(SCREEN_WIDTH - 48, 340),
      height: Math.min(SCREEN_WIDTH - 48, 340),
      borderRadius: 18,
    },
  }), [colors]);

  const styles = useMemo(() => StyleSheet.create({
    container: {
      paddingHorizontal: Spacing.md,
      paddingVertical: 10,
      marginVertical: 2,
      maxWidth: '78%',
    },
    userMessage: {
      alignSelf: 'flex-end',
      backgroundColor: colors.primary,
      borderRadius: 18,
      borderBottomRightRadius: 4,
      marginRight: Spacing.sm,
    },
    assistantMessage: {
      alignSelf: 'flex-start',
      backgroundColor: 'transparent',
      borderRadius: 0,
      marginLeft: Spacing.sm,
      maxWidth: '92%',
    },
    messageImage: {
      width: '100%',
      height: 220,
      borderRadius: BorderRadius.md,
      marginBottom: Spacing.sm,
    },
    downloadOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.6)',
      borderRadius: BorderRadius.md,
      justifyContent: 'center',
      alignItems: 'center',
    },
    downloadButton: {
      position: 'absolute',
      bottom: 12,
      right: 12,
      backgroundColor: 'rgba(0,0,0,0.75)',
      borderRadius: BorderRadius.full,
      width: 44,
      height: 44,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: '#fff',
    },
    fileAttachment: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      marginBottom: Spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
      gap: Spacing.md,
    },
    fileIcon: {
      width: 48,
      height: 48,
      borderRadius: BorderRadius.md,
      backgroundColor: `${colors.primary}15`,
      alignItems: 'center',
      justifyContent: 'center',
    },
    fileInfo: { flex: 1 },
    fileName: { ...Typography.body, color: colors.text, fontWeight: '600', fontSize: 14 },
    fileMeta: { ...Typography.caption, color: colors.textSecondary, fontSize: 12, marginTop: 2 },
    messageText: { fontSize: 15, lineHeight: 23, flexShrink: 1, flexWrap: 'wrap' },
    userMessageText: { color: '#FFFFFF' },
    assistantMessageText: { color: colors.text },
    editedLabel: {
      ...Typography.caption, fontSize: 11, marginTop: Spacing.xs,
      fontStyle: 'italic', opacity: 0.7,
      color: message.role === 'user' ? 'rgba(255,255,255,0.7)' : colors.textSecondary,
    },
    actionsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      marginTop: Spacing.sm,
      paddingTop: Spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: message.role === 'user' ? 'rgba(255,255,255,0.2)' : colors.border,
      flexWrap: 'wrap',
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 6,
      borderRadius: BorderRadius.sm,
      backgroundColor: message.role === 'user' ? 'rgba(255,255,255,0.15)' : colors.background,
    },
    actionButtonActive: { backgroundColor: colors.primary },
    linkText: {
      color: message.role === 'user' ? '#FFFFFF' : colors.primary,
      textDecorationLine: 'underline',
      fontWeight: '500',
    },
    userImagePreview: {
      width: SCREEN_WIDTH * 0.55,
      height: SCREEN_WIDTH * 0.4,
      borderRadius: BorderRadius.md,
      marginBottom: Spacing.sm,
    },
  }), [colors, message.role]);

  const isStreaming = streaming && isGenerating && message.role === 'assistant';
  const timeLabel = formatMessageTime(message.created_at);

  return (
    <>
      <Animated.View style={{ opacity: entranceOpacity, transform: [{ translateY: entranceTranslateY }] }}>
        <Pressable
          onLongPress={handleLongPress}
          delayLongPress={350}
          style={[
            styles.container,
            message.role === 'user' ? styles.userMessage : styles.assistantMessage,
          ]}
        >
          {/* User uploaded image */}
          {message.role === 'user' && message.image_url && (
            <TouchableOpacity
              onPress={() => handleImagePress(message.image_url!)}
              style={{ borderRadius: BorderRadius.md, overflow: 'hidden', marginBottom: Spacing.sm }}
              activeOpacity={0.9}
            >
              <Image
                source={{ uri: message.image_url }}
                style={styles.userImagePreview}
                contentFit="cover"
                transition={200}
              />
            </TouchableOpacity>
          )}

          {/* AI Generated Image */}
          {hasGeneratedImage && message.role === 'assistant' && (
            <View style={imgCardStyles.cardWrap}>
              <Text style={imgCardStyles.label}>Image created</Text>
              <TouchableOpacity
                onPress={() => handleImagePress(message.image_url!)}
                activeOpacity={0.9}
                disabled={downloadingImage}
                style={imgCardStyles.imageContainer}
              >
                <Image
                  source={{ uri: message.image_url }}
                  style={imgCardStyles.image}
                  contentFit="cover"
                  transition={400}
                />
                {downloadingImage ? (
                  <View style={styles.downloadOverlay}>
                    <ActivityIndicator color="#fff" size="large" />
                    <Text style={{ color: '#fff', marginTop: 8, fontSize: 13 }}>Saving...</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.downloadButton}
                    onPress={(e) => { e.stopPropagation(); handleDownloadImage(message.image_url!); }}
                  >
                    <Ionicons name="download" size={22} color="#fff" />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* File Attachment */}
          {message.file_url && message.file_name && (
            <TouchableOpacity
              style={styles.fileAttachment}
              onPress={() => handleFileDownload(message.file_name!, '', message.file_type || 'txt')}
            >
              <View style={styles.fileIcon}>
                <Ionicons name={getFileIcon(message.file_type)} size={26} color={colors.primary} />
              </View>
              <View style={styles.fileInfo}>
                <Text style={styles.fileName} numberOfLines={1}>{message.file_name}</Text>
                <Text style={styles.fileMeta}>{message.file_type?.toUpperCase() || 'FILE'}</Text>
              </View>
              <Ionicons name="download-outline" size={22} color={colors.text} />
            </TouchableOpacity>
          )}

          {/* Message Content */}
          {contentParts.map((part, index) => {
            const isLastPart = index === contentParts.length - 1 && !hasCard;
            const shouldStream = shouldStreamPart(isLastPart);

            if (part.type === 'code') {
              return (
                <View key={`code-${index}`}>
                  <CodeBlock
                    code={part.content}
                    language={part.language || 'code'}
                    streaming={shouldStream}
                    speed={streamingSpeed}
                  />
                </View>
              );
            }

            const textSegments = splitTablesFromText(part.content);
            return (
              <View key={`text-${index}`}>
                {textSegments.map((seg, si) => {
                  if (seg.type === 'table') {
                    return <MarkdownTable key={`table-${si}`} tableText={seg.content} colors={colors} />;
                  }
                  const textParts = parseTextWithLinks(seg.content);
                  return (
                    <Text
                      key={`seg-${si}`}
                      selectable={message.role === 'assistant'}
                      style={[
                        styles.messageText,
                        message.role === 'user' ? styles.userMessageText : styles.assistantMessageText,
                      ]}
                    >
                      {textParts.map((textPart, textIndex) => {
                        if (textPart.type === 'link') {
                          return (
                            <Text
                              key={`link-${textIndex}`}
                              style={styles.linkText}
                              onPress={() => handleLinkPress(textPart.url)}
                            >
                              {textPart.content}
                            </Text>
                          );
                        }
                        return <Text key={`txt-${textIndex}`}>{textPart.content}</Text>;
                      })}
                      {isStreaming && isLastPart && si === textSegments.length - 1 ? (
                        <BlinkingCursor color={colors.textSecondary} />
                      ) : null}
                    </Text>
                  );
                })}
              </View>
            );
          })}

          {/* Inline AI-generated images from text */}
          {inlineImages.length > 0 && inlineImages.map((imgUrl, i) => (
            <TouchableOpacity
              key={`inline-img-${i}`}
              onPress={() => handleImagePress(imgUrl)}
              activeOpacity={0.9}
              style={{ borderRadius: BorderRadius.md, overflow: 'hidden', marginVertical: Spacing.sm }}
            >
              <Image
                source={{ uri: imgUrl }}
                style={styles.messageImage}
                contentFit="cover"
                transition={200}
              />
              <TouchableOpacity
                style={styles.downloadButton}
                onPress={(e) => { e.stopPropagation(); handleDownloadImage(imgUrl); }}
              >
                <Ionicons name="download" size={22} color="#fff" />
              </TouchableOpacity>
            </TouchableOpacity>
          ))}

          {/* Download card */}
          {downloadLabel && message.role === 'assistant' && (
            <DownloadLinkCard label={downloadLabel} colors={colors} />
          )}

          {/* Styled Message Card */}
          {hasCard && message.role === 'assistant' && (
            <MessageCard content={cardContent} colors={colors} />
          )}

          {/* Sources pill */}
          {message.role === 'assistant' && sources.length > 0 && (
            <SourcesButton sources={sources} />
          )}

          {/* Edited Indicator */}
          {message.edited && (
            <Text style={styles.editedLabel}>
              (edited {message.edited_at ? new Date(message.edited_at).toLocaleTimeString() : ''})
            </Text>
          )}

          {/* Action Buttons — assistant only, hide while streaming */}
          {message.role === 'assistant' && !isGenerating && (
            <View style={styles.actionsContainer}>
              <TouchableOpacity style={styles.actionButton} onPress={handleCopy}>
                <Ionicons name="copy-outline" size={14} color={colors.text} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, liked === 'like' && styles.actionButtonActive]}
                onPress={() => handleLike('like')}
              >
                <Ionicons
                  name={liked === 'like' ? 'thumbs-up' : 'thumbs-up-outline'}
                  size={14}
                  color={liked === 'like' ? '#FFFFFF' : colors.text}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, liked === 'dislike' && styles.actionButtonActive]}
                onPress={() => handleLike('dislike')}
              >
                <Ionicons
                  name={liked === 'dislike' ? 'thumbs-down' : 'thumbs-down-outline'}
                  size={14}
                  color={liked === 'dislike' ? '#FFFFFF' : colors.text}
                />
              </TouchableOpacity>
              {analysisEntries.length > 0 && (
                <TerminalButton onPress={() => setAnalysisVisible(true)} />
              )}
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => setShowActionsModal(true)}
              >
                <Ionicons name="ellipsis-horizontal" size={14} color={colors.text} />
              </TouchableOpacity>
            </View>
          )}
        </Pressable>
      </Animated.View>

      {/* Analysis Modal */}
      {analysisEntries.length > 0 && (
        <AnalysisModal
          visible={analysisVisible}
          onClose={() => setAnalysisVisible(false)}
          entries={analysisEntries}
          title="Analysis"
        />
      )}

      {/* ── Blur Context Menu (Photo 1 style) ── */}
      <BlurContextMenu
        visible={showContextMenu}
        timeLabel={timeLabel}
        items={contextMenuItems}
        onClose={() => setShowContextMenu(false)}
      />

      {/* Select Text Modal — AI messages (native selectable, Photo 3 style) */}
      <Modal
        visible={showSelectTextModal}
        transparent={false}
        animationType="slide"
        onRequestClose={() => setShowSelectTextModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingTop: Platform.OS === 'ios' ? 56 : 28,
            paddingBottom: 14,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.border,
          }}>
            <TouchableOpacity onPress={() => setShowSelectTextModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={{ color: colors.text, fontSize: 17, fontWeight: '600' }}>Select Text</Text>
            <TouchableOpacity
              onPress={async () => { await Clipboard.setStringAsync(message.content); showAlert('Copied!', 'Message copied to clipboard'); setShowSelectTextModal(false); }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={{ color: colors.primary, fontSize: 15, fontWeight: '600' }}>Copy All</Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
            keyboardShouldPersistTaps="always"
          >
            <Text
              selectable
              selectionColor={`${colors.primary}55`}
              style={{ color: colors.text, fontSize: 16, lineHeight: 26, fontWeight: '400' }}
            >
              {message.content}
            </Text>
          </ScrollView>
          <View style={{
            flexDirection: 'row', gap: 12, paddingHorizontal: 16,
            paddingBottom: Platform.OS === 'ios' ? 34 : 20, paddingTop: 12,
            borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
          }}>
            <TouchableOpacity
              style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 12, paddingVertical: 13, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: colors.border }}
              onPress={async () => { await Share.share({ message: message.content }); }}
            >
              <Ionicons name="share-outline" size={18} color={colors.text} />
              <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600' }}>Share</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ flex: 1, backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 13, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }}
              onPress={async () => { await Clipboard.setStringAsync(message.content); showAlert('Copied!', 'Message copied to clipboard'); setShowSelectTextModal(false); }}
            >
              <Ionicons name="copy-outline" size={18} color="#FFF" />
              <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '600' }}>Copy All</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Sub-modals */}
      <LinkSafetyModal
        visible={modals.link}
        url={selectedLink}
        onClose={() => toggleModal('link', false)}
        onOpenLink={() => { toggleModal('link', false); toggleModal('webView', true); }}
      />
      <WebViewModal
        visible={modals.webView}
        url={selectedLink}
        onClose={() => toggleModal('webView', false)}
      />
      <ImageViewerModal
        visible={modals.imageViewer}
        imageUrl={selectedImageUrl}
        onClose={() => toggleModal('imageViewer', false)}
        onEdit={handleImageEdit}
        title="Image"
      />
      <ImageEditModal
        visible={modals.imageEdit}
        imageUrl={selectedImageUrl}
        onClose={() => toggleModal('imageEdit', false)}
        onApplyEdits={handleApplyImageEdits}
      />
      <FileDownloadModal
        visible={modals.file}
        fileName={fileData.name}
        fileContent={fileData.content}
        fileType={fileData.type}
        onClose={() => toggleModal('file', false)}
      />
      <MessageActionsModal
        visible={showActionsModal}
        onClose={() => setShowActionsModal(false)}
        message={message}
        onLike={handleLike}
      />
    </>
  );
});
