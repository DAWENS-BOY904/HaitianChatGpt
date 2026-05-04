// Dawens
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
  Linking,
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
import { ImageSearchResults } from './ImageSearchResults';
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
  isImageTask?: boolean;
  isAdmin?: boolean;
  onDelete?: (messageId: string) => void;
  onReply?: (message: any) => void;
}

// Blinking cursor for streaming
const BlinkingCursor = memo(function BlinkingCursor({ color }: { color: string }) {
  const blink = useRef(new Animated.Value(1)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    animRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(blink, { toValue: 0, duration: 500, useNativeDriver: true }),
        Animated.timing(blink, { toValue: 1, duration: 500, useNativeDriver: true }),
      ])
    );
    animRef.current.start();
    return () => {
      animRef.current?.stop();
      animRef.current = null;
    };
  }, []);

  return (
    <Animated.Text style={{ opacity: blink, color, fontSize: 16, fontWeight: '300', lineHeight: 22 }}>
      {'●'}
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

// ── Full Markdown Renderer (ChatGPT-style) ──
const MarkdownRenderer = memo(function MarkdownRenderer({
  text,
  colors,
  isUser,
  isStreaming,
}: {
  text: string;
  colors: any;
  isUser: boolean;
  isStreaming?: boolean;
}) {
  const textColor = isUser ? '#FFFFFF' : colors.text;
  const mutedColor = isUser ? 'rgba(255,255,255,0.65)' : colors.textSecondary;

  const renderInline = (lineText: string, keyPfx: string): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
    const re = /(\*\*\*([^*]+)\*\*\*|\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`|__([^_]+)__)/g;
    let last = 0;
    let m: RegExpExecArray | null;
    let ki = 0;
    while ((m = re.exec(lineText)) !== null) {
      if (m.index > last) {
        parts.push(<Text key={`${keyPfx}-il-${ki++}`} style={{ color: textColor }}>{lineText.slice(last, m.index)}</Text>);
      }
      if (m[2]) {
        parts.push(<Text key={`${keyPfx}-il-${ki++}`} style={{ fontWeight: '700', fontStyle: 'italic', color: textColor }}>{m[2]}</Text>);
      } else if (m[3]) {
        parts.push(<Text key={`${keyPfx}-il-${ki++}`} style={{ fontWeight: '700', color: textColor }}>{m[3]}</Text>);
      } else if (m[4]) {
        parts.push(<Text key={`${keyPfx}-il-${ki++}`} style={{ fontStyle: 'italic', color: textColor }}>{m[4]}</Text>);
      } else if (m[5]) {
        parts.push(
          <Text key={`${keyPfx}-il-${ki++}`} style={{
            fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
            fontSize: 13,
            backgroundColor: isUser ? 'rgba(255,255,255,0.2)' : 'rgba(120,120,128,0.18)',
            color: isUser ? '#fff' : colors.primary,
            paddingHorizontal: 5,
            borderRadius: 4,
          }}>{m[5]}</Text>
        );
      } else if (m[6]) {
        parts.push(<Text key={`${keyPfx}-il-${ki++}`} style={{ fontWeight: '700', color: textColor }}>{m[6]}</Text>);
      }
      last = m.index + m[0].length;
    }
    if (last < lineText.length) {
      parts.push(<Text key={`${keyPfx}-il-${ki++}`} style={{ color: textColor }}>{lineText.slice(last)}</Text>);
    }
    return parts.length > 0 ? parts : [<Text key={`${keyPfx}-il-0`} style={{ color: textColor }}>{lineText}</Text>];
  };

  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;
  let keyIdx = 0;
  const nextKey = () => `mk-${keyIdx++}`;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      elements.push(<View key={nextKey()} style={{ height: 5 }} />);
      i++;
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      elements.push(
        <View key={nextKey()} style={{
          height: StyleSheet.hairlineWidth,
          backgroundColor: isUser ? 'rgba(255,255,255,0.28)' : colors.border,
          marginVertical: 10,
        }} />
      );
      i++;
      continue;
    }

    if (/^# /.test(trimmed)) {
      const k = nextKey();
      elements.push(
        <Text key={k} style={{ fontSize: 20, fontWeight: '700', color: textColor, marginTop: 12, marginBottom: 4, lineHeight: 28 }}>
          {renderInline(trimmed.replace(/^# /, ''), k)}
        </Text>
      );
      i++; continue;
    }

    if (/^## /.test(trimmed)) {
      const k = nextKey();
      elements.push(
        <Text key={k} style={{ fontSize: 17, fontWeight: '700', color: textColor, marginTop: 10, marginBottom: 3, lineHeight: 24 }}>
          {renderInline(trimmed.replace(/^## /, ''), k)}
        </Text>
      );
      i++; continue;
    }

    if (/^### /.test(trimmed)) {
      const k = nextKey();
      elements.push(
        <Text key={k} style={{ fontSize: 15, fontWeight: '700', color: textColor, marginTop: 8, marginBottom: 2, lineHeight: 22 }}>
          {renderInline(trimmed.replace(/^### /, ''), k)}
        </Text>
      );
      i++; continue;
    }

    if (/^#{4,6} /.test(trimmed)) {
      const k = nextKey();
      elements.push(
        <Text key={k} style={{ fontSize: 14, fontWeight: '700', color: textColor, marginTop: 6, marginBottom: 2, lineHeight: 20 }}>
          {renderInline(trimmed.replace(/^#{4,6} /, ''), k)}
        </Text>
      );
      i++; continue;
    }

    if (/^\d+\. /.test(trimmed)) {
      const num = trimmed.match(/^(\d+)\. /)?.[1] || '1';
      const itemText = trimmed.replace(/^\d+\. /, '');
      const k = nextKey();
      elements.push(
        <View key={k} style={{ flexDirection: 'row', marginBottom: 3, paddingLeft: 2 }}>
          <Text style={{ color: mutedColor, fontSize: 15, lineHeight: 23, minWidth: 22, fontWeight: '600' }}>{num}.</Text>
          <Text style={{ color: textColor, fontSize: 15, lineHeight: 23, flex: 1, flexWrap: 'wrap' }}>
            {renderInline(itemText, k)}
          </Text>
        </View>
      );
      i++; continue;
    }

    if (/^[-*•] /.test(trimmed)) {
      const itemText = trimmed.replace(/^[-*•] /, '');
      const k = nextKey();
      elements.push(
        <View key={k} style={{ flexDirection: 'row', marginBottom: 3, paddingLeft: 2 }}>
          <Text style={{ color: mutedColor, fontSize: 16, lineHeight: 23, minWidth: 18, marginTop: 0 }}>{'•'}</Text>
          <Text style={{ color: textColor, fontSize: 15, lineHeight: 23, flex: 1, flexWrap: 'wrap' }}>
            {renderInline(itemText, k)}
          </Text>
        </View>
      );
      i++; continue;
    }

    if (/^ {2,}[-*•] /.test(line)) {
      const itemText = line.replace(/^ {2,}[-*•] /, '');
      const k = nextKey();
      elements.push(
        <View key={k} style={{ flexDirection: 'row', marginBottom: 2, paddingLeft: 18 }}>
          <Text style={{ color: mutedColor, fontSize: 14, lineHeight: 22, minWidth: 16 }}>{'◦'}</Text>
          <Text style={{ color: textColor, fontSize: 14, lineHeight: 22, flex: 1, flexWrap: 'wrap' }}>
            {renderInline(itemText, k)}
          </Text>
        </View>
      );
      i++; continue;
    }

    if (/^> /.test(trimmed)) {
      const qText = trimmed.replace(/^> /, '');
      const k = nextKey();
      elements.push(
        <View key={k} style={{
          borderLeftWidth: 3,
          borderLeftColor: isUser ? 'rgba(255,255,255,0.5)' : colors.primary,
          paddingLeft: 12, marginVertical: 4,
        }}>
          <Text style={{ color: mutedColor, fontSize: 14, lineHeight: 22, fontStyle: 'italic' }}>
            {renderInline(qText, k)}
          </Text>
        </View>
      );
      i++; continue;
    }

    const k = nextKey();
    elements.push(
      <Text
        key={k}
        selectable={!isUser}
        selectionColor={!isUser ? 'rgba(16,163,127,0.35)' : undefined}
        style={{ color: textColor, fontSize: 15, lineHeight: 23, flexWrap: 'wrap', marginBottom: 1 }}
      >
        {renderInline(trimmed, k)}
      </Text>
    );
    i++;
  }

  return <View>{elements}</View>;
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
        if (currentText.length > 0) { result.push({ type: 'text', content: currentText.join('\n') }); currentText = []; }
        inTable = true;
      }
      currentTable.push(line);
    } else {
      if (inTable) { result.push({ type: 'table', content: currentTable.join('\n') }); currentTable = []; inTable = false; }
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
  const [downloading, setDownloading] = useState(false);
  const [done, setDone] = useState(false);
  const { showAlert } = useAlert();

  const handlePress = useCallback(async () => {
    if (downloading || done) return;
    setDownloading(true);
    try {
      // Write the label text as a downloadable .txt file
      const safeFileName = label.replace(/[^a-zA-Z0-9_\- ]/g, '').trim().slice(0, 60) || 'download';
      const fileName = `${safeFileName}_${Date.now()}.txt`;
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(fileUri, label, { encoding: FileSystem.EncodingType.UTF8 });
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/plain',
          dialogTitle: 'Save or share',
          UTI: 'public.plain-text',
        });
      } else {
        await Share.share({ message: label, title: safeFileName });
      }
      setDone(true);
      setTimeout(() => setDone(false), 3000);
    } catch (err: any) {
      if (err?.message !== 'User canceled') {
        showAlert('Download failed', err?.message || 'Could not download file');
      }
    } finally {
      setDownloading(false);
    }
  }, [label, downloading, done, showAlert]);

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.75}
      disabled={downloading}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 8,
        marginBottom: 4,
        backgroundColor: done
          ? 'rgba(52,199,89,0.12)'
          : `${colors.primary}14`,
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: done ? 'rgba(52,199,89,0.35)' : `${colors.primary}30`,
        alignSelf: 'flex-start',
      }}
    >
      {downloading ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (
        <Ionicons
          name={done ? 'checkmark-circle' : 'download-outline'}
          size={16}
          color={done ? '#34C759' : colors.primary}
        />
      )}
      <Text
        style={{
          fontSize: 14,
          color: done ? '#34C759' : colors.primary,
          fontWeight: '600',
          flexShrink: 1,
        }}
        numberOfLines={1}
      >
        {done ? 'Downloaded!' : label}
      </Text>
      {!downloading && !done && (
        <Ionicons name="arrow-down" size={13} color={colors.primary} />
      )}
    </TouchableOpacity>
  );
});

const MessageCard = memo(function MessageCard({ content, colors }: { content: string; colors: any }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(content);
  const [copied, setCopied] = useState(false);
  const { showAlert } = useAlert();

  const handleCopy = async () => { await Clipboard.setStringAsync(editedContent); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const handleShare = async () => { try { await Share.share({ message: editedContent, title: 'Message' }); } catch {} };
  const handleDownload = async () => {
    try {
      const fileName = `message_${Date.now()}.txt`;
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(fileUri, editedContent, { encoding: FileSystem.EncodingType.UTF8 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, { mimeType: 'text/plain', dialogTitle: 'Save Message', UTI: 'public.plain-text' });
      } else { await Share.share({ message: editedContent, title: 'Message' }); }
    } catch { showAlert('Error', 'Failed to download message'); }
  };

  if (isEditing) {
    return (
      <Modal visible animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 56 : 24, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <TouchableOpacity onPress={() => setIsEditing(false)}><Ionicons name="close" size={24} color={colors.text} /></TouchableOpacity>
            <Text style={{ color: colors.text, fontSize: 17, fontWeight: '600' }}>Message</Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity onPress={handleCopy}><Ionicons name="copy-outline" size={22} color={colors.text} /></TouchableOpacity>
              <TouchableOpacity onPress={handleShare}><Ionicons name="share-outline" size={22} color={colors.text} /></TouchableOpacity>
            </View>
          </View>
          <ScrollView style={{ flex: 1, padding: 20 }}>
            <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 20, minHeight: 300 }}>
              <Text style={{ color: colors.text, fontSize: 16, lineHeight: 26 }} selectable>{editedContent}</Text>
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
          <TouchableOpacity onPress={() => setIsEditing(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}><Ionicons name="pencil-outline" size={18} color={colors.textSecondary} /></TouchableOpacity>
          <TouchableOpacity onPress={handleCopy} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}><Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={18} color={copied ? colors.primary : colors.textSecondary} /></TouchableOpacity>
          <TouchableOpacity onPress={handleShare} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}><Ionicons name="share-outline" size={18} color={colors.textSecondary} /></TouchableOpacity>
        </View>
      </View>
      <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
        <View style={{ padding: 16 }}>
          <Text style={{ color: colors.text, fontSize: 15, lineHeight: 24 }}>{editedContent}</Text>
        </View>
      </ScrollView>
      <TouchableOpacity onPress={handleDownload} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: `${colors.primary}10` }}>
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

function parseImageSearchResults(content: string): { text: string; imageSearchResults?: any[] } {
  const startTag = '[IMAGE_SEARCH_RESULTS:';
  const start = content.indexOf(startTag);
  if (start === -1) return { text: content };

  // Find the matching closing bracket by counting brackets
  let depth = 0;
  let end = -1;
  for (let i = start + startTag.length; i < content.length; i++) {
    if (content[i] === '[') depth++;
    else if (content[i] === ']') {
      if (depth === 0) { end = i; break; }
      depth--;
    }
  }
  if (end === -1) return { text: content };

  const jsonStr = content.substring(start + startTag.length, end).trim();
  const before = content.substring(0, start).trim();
  const after = content.substring(end + 1).trim();
  try {
    const results = JSON.parse(jsonStr);
    if (!Array.isArray(results) || results.length === 0) return { text: [before, after].filter(Boolean).join('\n\n') };
    return { text: [before, after].filter(Boolean).join('\n\n'), imageSearchResults: results };
  } catch {
    return { text: content };
  }
}

// ── Reaction + Action bottom sheet ──
const QUICK_REACTIONS = ['❤️', '👍', '👎', '😆', '😮', '😐'];

const MessageReactionSheet = memo(function MessageReactionSheet({
  visible, onClose, message, onCopy, onReply, onDelete, onReport, isAdmin, isDark, colors,
}: {
  visible: boolean; onClose: () => void; message: any; onCopy: () => void; onReply?: () => void;
  onDelete?: () => void; onReport?: () => void; isAdmin?: boolean; isDark: boolean; colors: any;
}) {
  const slideAnim = useRef(new Animated.Value(300)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [selectedReaction, setSelectedReaction] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, tension: 260, friction: 24, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 300, duration: 150, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;

  const menuItems = [
    { icon: 'copy-outline', label: 'Copy', onPress: () => { onClose(); setTimeout(onCopy, 60); } },
    { icon: 'arrow-undo-outline', label: 'Reply', onPress: () => { onClose(); setTimeout(() => onReply?.(), 60); } },
    ...(isAdmin || message.role === 'assistant' ? [{ icon: 'trash-outline', label: 'Delete', onPress: () => { onClose(); setTimeout(() => onDelete?.(), 60); }, destructive: true }] : []),
    ...(message.role === 'assistant' ? [{ icon: 'flag-outline', label: 'Report', onPress: () => { onClose(); setTimeout(() => onReport?.(), 60); }, destructive: true }] : []),
  ];

  const sheetContent = (
    <>
      <View style={rsStyles.handle} />
      <View style={rsStyles.reactionRow}>
        {QUICK_REACTIONS.map((emoji) => (
          <TouchableOpacity
            key={emoji}
            style={[rsStyles.emojiBtn, selectedReaction === emoji && { backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)', borderRadius: 20 }]}
            onPress={() => setSelectedReaction(selectedReaction === emoji ? null : emoji)}
            activeOpacity={0.7}
          >
            <Text style={rsStyles.emoji}>{emoji}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={rsStyles.emojiBtn} activeOpacity={0.7}>
          <View style={[rsStyles.plusCircle, { backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)' }]}>
            <Ionicons name="add" size={18} color={colors.text} />
          </View>
        </TouchableOpacity>
      </View>
      <View style={[rsStyles.divider, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }]} />
      {menuItems.map((item, i) => (
        <TouchableOpacity
          key={item.label}
          style={[rsStyles.actionRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}
          onPress={item.onPress}
          activeOpacity={0.7}
        >
          <Ionicons name={item.icon as any} size={22} color={(item as any).destructive ? '#FF453A' : colors.text} />
          <Text style={[rsStyles.actionLabel, { color: (item as any).destructive ? '#FF453A' : colors.text }]}>{item.label}</Text>
        </TouchableOpacity>
      ))}
    </>
  );

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.42)', opacity: fadeAnim }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <Animated.View style={{ transform: [{ translateY: slideAnim }] }}>
          {Platform.OS === 'ios' ? (
            <BlurView intensity={85} tint={isDark ? 'dark' : 'extraLight'} style={rsStyles.sheet}>
              {sheetContent}
            </BlurView>
          ) : (
            <View style={[rsStyles.sheet, { backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7' }]}>
              {sheetContent}
            </View>
          )}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
});

const rsStyles = StyleSheet.create({
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 34, overflow: 'hidden' },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(128,128,128,0.4)', alignSelf: 'center', marginTop: 10, marginBottom: 6 },
  reactionRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, gap: 2 },
  emojiBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 28 },
  plusCircle: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: 0, marginBottom: 4 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 15 },
  actionLabel: { fontSize: 17, fontWeight: '400' },
});

// ── Inline dot-grid image creation placeholder ──
const InlineImageCreatingPlaceholder = memo(function InlineImageCreatingPlaceholder() {
  const dotCount = 48;
  const dotAnims = useRef(Array.from({ length: dotCount }, () => new Animated.Value(0))).current;
  const shimmerX = useRef(new Animated.Value(-200)).current;
  const mountAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(mountAnim, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    const dots = dotAnims.map((anim, i) => {
      const row = Math.floor(i / 8), col = i % 8;
      return Animated.loop(Animated.sequence([
        Animated.delay((row + col) * 50),
        Animated.timing(anim, { toValue: 1, duration: 500 + Math.random() * 400, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 500 + Math.random() * 400, useNativeDriver: true }),
      ]));
    });
    dots.forEach(a => a.start());
    const shimmer = Animated.loop(Animated.sequence([
      Animated.timing(shimmerX, { toValue: 280, duration: 1600, useNativeDriver: true }),
      Animated.delay(400),
      Animated.timing(shimmerX, { toValue: -200, duration: 0, useNativeDriver: true }),
    ]));
    shimmer.start();
    return () => { dots.forEach(a => a.stop()); shimmer.stop(); };
  }, []);

  const cardW = Math.min(SCREEN_WIDTH * 0.62, 260);
  const cardH = cardW * 1.05;
  return (
    <Animated.View style={{ opacity: mountAnim, marginVertical: 4 }}>
      <View style={[inlinePH.card, { width: cardW, height: cardH }]}>
        <View style={inlinePH.dotGrid}>
          {dotAnims.map((anim, i) => (
            <Animated.View key={i} style={[
              inlinePH.dot,
              {
                opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.1, 0.6] }),
                transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.2] }) }],
              },
            ]} />
          ))}
        </View>
        <Animated.View style={[inlinePH.shimmer, { transform: [{ translateX: shimmerX }] }]} />
        <View style={inlinePH.textRow}>
          <ActivityIndicator size="small" color="rgba(255,255,255,0.65)" style={{ marginRight: 7 }} />
          <Text style={inlinePH.label}>Creating image…</Text>
        </View>
      </View>
    </Animated.View>
  );
});

const inlinePH = StyleSheet.create({
  card: { borderRadius: 20, backgroundColor: '#111113', overflow: 'hidden', justifyContent: 'flex-end', padding: 16, marginVertical: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  dotGrid: { position: 'absolute', top: 14, left: 14, right: 14, bottom: 52, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 7 },
  dot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: 'rgba(255,255,255,0.75)' },
  shimmer: { position: 'absolute', top: 0, bottom: 0, width: 60, backgroundColor: 'rgba(255,255,255,0.04)' },
  textRow: { flexDirection: 'row', alignItems: 'center', paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.08)' },
  label: { color: 'rgba(255,255,255,0.78)', fontSize: 14, fontWeight: '500', letterSpacing: 0.2 },
});

const aiImgMenuStyles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, overflow: 'hidden', marginTop: 8 },
  btn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, gap: 3 },
  btnLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '600' },
  divider: { width: StyleSheet.hairlineWidth, height: 36, backgroundColor: 'rgba(255,255,255,0.15)' },
});

// ── Report AI Message Modal ──
const REPORT_CATEGORIES = [
  'Violence & self-harm', 'Sexual exploitation & abuse', 'Child/teen exploitation',
  'Bullying & harassment', 'Spam, fraud & deception', 'Privacy violation',
  'Intellectual property', 'Age-inappropriate content', 'Something else',
];

const ReportMessageModal = memo(function ReportMessageModal({ visible, onClose, onSubmit, isDark, colors }: {
  visible: boolean; onClose: () => void; onSubmit: (category: string, detail: string) => void; isDark: boolean; colors: any;
}) {
  const [step, setStep] = useState<'category' | 'detail'>('category');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [detail, setDetail] = useState('');

  useEffect(() => {
    if (!visible) { setStep('category'); setSelectedCategory(''); setDetail(''); }
  }, [visible]);

  if (!visible) return null;
  const bg = isDark ? '#1C1C1E' : '#F2F2F7';
  const cardBg = isDark ? '#2C2C2E' : '#FFFFFF';
  const textC = isDark ? '#FFFFFF' : '#000000';
  const subC = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)';
  const borderC = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';

  return (
    <Modal visible={visible} transparent={false} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: bg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: Platform.OS === 'ios' ? 56 : 28, paddingHorizontal: 16, paddingBottom: 16 }}>
          {step === 'detail' ? (
            <TouchableOpacity onPress={() => setStep('category')} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <Ionicons name="chevron-back" size={20} color={textC} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={onClose} style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8, marginRight: 12 }}>
              <Text style={{ color: textC, fontSize: 15, fontWeight: '500' }}>Cancel</Text>
            </TouchableOpacity>
          )}
          <Text style={{ flex: 1, fontSize: 17, fontWeight: '700', color: textC, textAlign: 'center', marginRight: step === 'detail' ? 48 : 0 }}>Report conversation</Text>
          {step === 'detail' ? (
            <TouchableOpacity onPress={() => { onSubmit(selectedCategory, detail); onClose(); }} style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8 }}>
              <Text style={{ color: textC, fontSize: 15, fontWeight: '600' }}>Submit</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        {step === 'category' ? (
          <>
            <Text style={{ color: subC, fontSize: 15, textAlign: 'center', marginBottom: 20, paddingHorizontal: 24 }}>Why are you reporting this conversation?</Text>
            <View style={{ marginHorizontal: 16, borderRadius: 16, overflow: 'hidden', backgroundColor: cardBg }}>
              {REPORT_CATEGORIES.map((cat, i) => (
                <TouchableOpacity key={cat} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 16, borderTopWidth: i > 0 ? StyleSheet.hairlineWidth : 0, borderTopColor: borderC }} onPress={() => { setSelectedCategory(cat); setStep('detail'); }}>
                  <Text style={{ color: textC, fontSize: 16 }}>{cat}</Text>
                  <Ionicons name="chevron-forward" size={18} color={subC} />
                </TouchableOpacity>
              ))}
            </View>
          </>
        ) : (
          <>
            <Text style={{ color: textC, fontSize: 17, fontWeight: '600', textAlign: 'center', marginBottom: 4, paddingHorizontal: 24 }}>{selectedCategory}</Text>
            <Text style={{ color: subC, fontSize: 14, textAlign: 'center', marginBottom: 24 }}>Please provide more details</Text>
            <View style={{ marginHorizontal: 16, borderRadius: 16, overflow: 'hidden', backgroundColor: cardBg, padding: 16 }}>
              <TextInput style={{ color: textC, fontSize: 16, minHeight: 120, textAlignVertical: 'top' }} placeholder="Please provide more details" placeholderTextColor={subC} value={detail} onChangeText={setDetail} multiline autoFocus />
            </View>
          </>
        )}
      </View>
    </Modal>
  );
});

// ── Phone Call Confirmation Modal ──
const PhoneCallModal = memo(function PhoneCallModal({ visible, number, onCall, onCancel, isDark }: {
  visible: boolean; number: string; onCall: () => void; onCancel: () => void; isDark: boolean;
}) {
  if (!visible) return null;
  const bg = isDark ? 'rgba(30,30,34,0.97)' : 'rgba(255,255,255,0.97)';
  const textC = isDark ? '#FFFFFF' : '#000000';
  const subC = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)';
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
        {Platform.OS === 'ios' ? <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} /> : null}
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onCancel} />
        <View style={{ backgroundColor: bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 28, paddingBottom: 40, alignItems: 'center' }}>
          <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: '#34C759', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <Ionicons name="call" size={28} color="#FFF" />
          </View>
          <Text style={{ color: textC, fontSize: 20, fontWeight: '700', marginBottom: 6 }}>Call {number}?</Text>
          <Text style={{ color: subC, fontSize: 14, textAlign: 'center', marginBottom: 28 }}>Do you want to call this number?</Text>
          <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
            <TouchableOpacity style={{ flex: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)', borderRadius: 50, paddingVertical: 15, alignItems: 'center' }} onPress={onCancel}>
              <Text style={{ color: textC, fontSize: 16, fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ flex: 1, backgroundColor: '#007AFF', borderRadius: 50, paddingVertical: 15, alignItems: 'center' }} onPress={onCall}>
              <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '700' }}>Call {number}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
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
  isImageTask = false,
  isAdmin = false,
  onDelete,
  onReply,
}: MessageItemProps) {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const supabase = getSupabaseClient();

  const [showReactionSheet, setShowReactionSheet] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showActionsModal, setShowActionsModal] = useState(false);
  const [showSelectTextModal, setShowSelectTextModal] = useState(false);
  const [liked, setLiked] = useState<'like' | 'dislike' | null>(null);
  const [analysisVisible, setAnalysisVisible] = useState(false);
  const [selectedLink, setSelectedLink] = useState('');
  const [selectedImageUrl, setSelectedImageUrl] = useState('');
  const [fileData, setFileData] = useState({ name: '', content: '', type: '' });
  const [modals, setModals] = useState({ link: false, webView: false, imageViewer: false, imageEdit: false, file: false });
  const [downloadingImage, setDownloadingImage] = useState(false);
  // Phone call confirmation
  const [phoneCallModal, setPhoneCallModal] = useState<{ visible: boolean; number: string }>({ visible: false, number: '' });

  const entranceOpacity = useRef(new Animated.Value(0)).current;
  const entranceTranslateY = useRef(new Animated.Value(16)).current;
  useEffect(() => {
    const animations = Animated.parallel([
      Animated.timing(entranceOpacity, { toValue: 1, duration: 260, useNativeDriver: true }),
      Animated.spring(entranceTranslateY, { toValue: 0, tension: 240, friction: 24, useNativeDriver: true }),
    ]);
    animations.start();
    return () => animations.stop();
  }, []);

  const toggleModal = useCallback((modalName: keyof typeof modals, value?: boolean) => {
    setModals(prev => ({ ...prev, [modalName]: value ?? !prev[modalName] }));
  }, []);

  const handleDownloadImage = useCallback(async (imageUrl: string) => {
    try {
      setDownloadingImage(true);
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permission Required', 'Please allow access to save images.'); return; }
      const urlObj = new URL(imageUrl);
      const pathname = urlObj.pathname;
      const ext = pathname.split('.').pop()?.split('?')[0]?.toLowerCase() || 'jpg';
      const validExt = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext) ? ext : 'jpg';
      const fileUri = `${FileSystem.documentDirectory}temp_image_${Date.now()}.${validExt}`;
      const downloadResult = await FileSystem.downloadAsync(imageUrl, fileUri);
      if (downloadResult.status !== 200) throw new Error(`Download failed with status ${downloadResult.status}`);
      const asset = await MediaLibrary.createAssetAsync(downloadResult.uri);
      await MediaLibrary.createAlbumAsync('Dawinix', asset, false);
      showAlert('Success', 'Image saved to your photo library!');
    } catch (err: any) { Alert.alert('Error', err?.message || 'Failed to save image.'); }
    finally { setDownloadingImage(false); }
  }, [showAlert]);

  const hasOnlyImage = message.role === 'user' && !!message.image_url && !message.content.trim();
  const hasBothTextAndImage = message.role === 'user' && !!message.image_url && !!message.content.trim();

  const handleLongPress = useCallback(() => {
    if (hasOnlyImage) return;
    setShowReactionSheet(true);
  }, [hasOnlyImage]);

  const handleAIImageLongPress = useCallback((_imageUrl: string) => {
    setShowReactionSheet(true);
  }, []);

  const handleShareImage = useCallback(async (imageUrl: string) => {
    try { await Share.share({ message: imageUrl, url: imageUrl }); } catch {}
  }, []);

  const handleCopy = useCallback(async () => {
    await Clipboard.setStringAsync(message.content);
    showAlert('Copied!', 'Full message copied to clipboard');
    onCopy?.();
  }, [message.content, showAlert, onCopy]);

  const handleLike = useCallback(async (type: 'like' | 'dislike') => {
    if (!user) { showAlert('Sign In Required', 'Please sign in to rate messages'); router.push('/login'); return; }
    try {
      const previousLiked = liked;
      setLiked(type);
      if (previousLiked === type) {
        await supabase.from('message_likes').delete().eq('message_id', message.id).eq('user_id', user.id);
        setLiked(null);
      } else {
        await supabase.from('message_likes').delete().eq('message_id', message.id).eq('user_id', user.id);
        await supabase.from('message_likes').upsert({ message_id: message.id, user_id: user.id, like_type: type });
      }
    } catch (err: any) { showAlert('Error', err?.message || 'Failed to save feedback'); setLiked(liked); }
  }, [liked, message.id, user, supabase, showAlert]);

  // ── Link press: detect phone numbers, live chat, and normal URLs ──
  const handleLinkPress = useCallback((url: string) => {
    if (url.startsWith('tel:')) {
      const number = url.replace('tel:', '');
      setPhoneCallModal({ visible: true, number });
      return;
    }
    // Live chat links open in-app WebView
    if (url.includes('988lifeline.org') || url.includes('/chat') || url.includes('livechat') || url.includes('live-chat') || url.includes('crisis') || url.includes('suicidepreventionlifeline')) {
      setSelectedLink(url);
      toggleModal('webView', true);
      return;
    }
    setSelectedLink(url);
    toggleModal('link', true);
  }, [toggleModal]);

  // ── Phone call handler ──
  const handlePhoneCall = useCallback((number: string) => {
    Linking.openURL(`tel:${number}`).catch(() => {});
    setPhoneCallModal({ visible: false, number: '' });
  }, []);

  const [viewerIsUserImage, setViewerIsUserImage] = useState(false);
  const handleImagePress = useCallback((imageUrl: string, isUser = false) => {
    setSelectedImageUrl(imageUrl);
    setViewerIsUserImage(isUser);
    toggleModal('imageViewer', true);
  }, [toggleModal]);
  const handleImageEdit = useCallback(() => { toggleModal('imageViewer', false); toggleModal('imageEdit', true); }, [toggleModal]);

  const handleApplyImageEdits = useCallback(async (editPrompt: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('chat', { body: { editImageUrl: selectedImageUrl, editPrompt, messages: [], conversationId: 'temp' } });
      if (error) throw error;
      if (data?.imageUrl) { setSelectedImageUrl(data.imageUrl); toggleModal('imageEdit', false); toggleModal('imageViewer', true); }
      else throw new Error('No image URL returned');
    } catch (err: any) { showAlert('Error', err?.message || 'Failed to apply edits'); }
  }, [selectedImageUrl, supabase, toggleModal, showAlert]);

  const handleFileDownload = useCallback((fileName: string, fileContent: string, fileType: string) => {
    try { setFileData({ name: fileName, content: fileContent, type: fileType }); toggleModal('file', true); }
    catch (err: any) { showAlert('Error', err?.message || 'Failed to open file'); }
  }, [toggleModal, showAlert]);

  const handleDeleteMessage = useCallback(() => {
    Alert.alert('Delete message?', 'This message will be permanently deleted.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDelete?.(message.id) },
    ]);
  }, [message.id, onDelete]);

  const handleReportSubmit = useCallback(async (category: string, detail: string) => {
    try {
      if (user?.id) {
        await supabase.from('bug_reports').insert({ user_id: user.id, description: `Report message - Category: ${category}\nDetail: ${detail}\nMessage ID: ${message.id}`, status: 'pending' });
      }
      showAlert('Reported', 'Thank you for your report. We will review it.');
    } catch (_e) { showAlert('Reported', 'Thank you for your report.'); }
  }, [user?.id, supabase, showAlert, message.id]);

  const parsed = useMemo(() => {
    const { text: t1, sources } = parseSources(message.content);
    const { text: t2, entries: analysisEntries } = parseAnalysis(t1);
    const { text: t3, downloadLabel } = parseDownloadCard(t2);
    const { text: t4, imageSearchResults } = parseImageSearchResults(t3);
    const { hasCard, cardContent, beforeCard } = extractMessageCard(t4);
    return { sources, analysisEntries, downloadLabel, hasCard, cardContent, beforeCard, imageSearchResults };
  }, [message.content]);

  const { sources, analysisEntries, downloadLabel, hasCard, cardContent, beforeCard, imageSearchResults } = parsed;

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
      if (match.index > lastIndex) { parts.push({ type: 'text', content: textToProcess.substring(lastIndex, match.index) }); }
      parts.push({ type: 'code', language: match[1] || 'text', content: match[2].trim() });
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < textToProcess.length) { parts.push({ type: 'text', content: textToProcess.substring(lastIndex) }); }
    return parts.length > 0 ? parts : [{ type: 'text' as const, content: textToProcess }];
  }, [cleanedBeforeCard]);

  // ── Parse text into segments: URLs, phone numbers, live chat, plain text ──
  const parseTextWithLinks = useCallback((text: string) => {
    if (!text) return [{ type: 'text', content: '' }];
    const parts: any[] = [];
    // Match URLs and phone numbers
    const combinedRegex = /((https?:\/\/[^\s]+)|(\b988\b|\b911\b|\b1-800-[\d-]+\b|\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b))/g;
    let match;
    let lastIndex = 0;

    while ((match = combinedRegex.exec(text)) !== null) {
      const preceding = text.substring(lastIndex, match.index);
      if (preceding) {
        // Detect "live chat" in preceding text
        const lc = /(live\s+chat)/gi;
        let lcM;
        let lcLast = 0;
        while ((lcM = lc.exec(preceding)) !== null) {
          if (lcM.index > lcLast) parts.push({ type: 'text', content: preceding.substring(lcLast, lcM.index) });
          parts.push({ type: 'livechat', content: lcM[0] });
          lcLast = lcM.index + lcM[0].length;
        }
        if (lcLast < preceding.length) parts.push({ type: 'text', content: preceding.substring(lcLast) });
      }
      const matched = match[0];
      if (/^https?:\/\//.test(matched)) {
        parts.push({ type: 'link', content: matched, url: matched });
      } else {
        parts.push({ type: 'phone', content: matched, number: matched.replace(/[^\d+]/g, '') });
      }
      lastIndex = match.index + matched.length;
    }

    if (lastIndex < text.length) {
      const remaining = text.substring(lastIndex);
      const lc = /(live\s+chat)/gi;
      let lcM;
      let lcLast = 0;
      while ((lcM = lc.exec(remaining)) !== null) {
        if (lcM.index > lcLast) parts.push({ type: 'text', content: remaining.substring(lcLast, lcM.index) });
        parts.push({ type: 'livechat', content: lcM[0] });
        lcLast = lcM.index + lcM[0].length;
      }
      if (lcLast < remaining.length) parts.push({ type: 'text', content: remaining.substring(lcLast) });
    }
    return parts.length > 0 ? parts : [{ type: 'text', content: text }];
  }, []);

  const hasGeneratedImage = useMemo(() => Boolean(message.image_url && isImageUrl(message.image_url)), [message.image_url]);
  const shouldStreamPart = useCallback((isLastPart: boolean) => streaming && isGenerating && message.role === 'assistant' && isLastPart, [streaming, isGenerating, message.role]);

  // Image card: square 1:1 ratio, full width of assistant bubble, with rounded corners
  const imgCardImgSize = Math.min(SCREEN_WIDTH * 0.78, 320);
  const imgCardStyles = useMemo(() => StyleSheet.create({
    cardWrap: { marginTop: 4, marginBottom: 6, alignSelf: 'flex-start' },
    label: { color: colors.textSecondary, fontSize: 13, fontWeight: '500', marginBottom: 6, paddingLeft: 2 },
    imageContainer: {
      borderRadius: 18,
      overflow: 'hidden',
      backgroundColor: colors.surface,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.22,
      shadowRadius: 14,
      elevation: 10,
      // Ensure the Pressable wraps the image tightly
      width: imgCardImgSize,
      height: imgCardImgSize,
    },
    image: { width: imgCardImgSize, height: imgCardImgSize },
  }), [colors, imgCardImgSize]);

  const styles = useMemo(() => StyleSheet.create({
    container: { paddingHorizontal: Spacing.md, paddingVertical: 10, marginVertical: 2, maxWidth: '78%' },
    userMessage: { alignSelf: 'flex-end', backgroundColor: colors.primary, borderRadius: 18, borderBottomRightRadius: 4, marginRight: Spacing.sm },
    userMessageImageOnly: { alignSelf: 'flex-end', backgroundColor: 'transparent', borderRadius: 0, marginRight: Spacing.sm, padding: 0 },
    userMessageTextOnly: { alignSelf: 'flex-end', backgroundColor: colors.primary, borderRadius: 18, borderTopRightRadius: 4, borderBottomRightRadius: 4, marginRight: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: 10 },
    assistantMessage: { alignSelf: 'flex-start', backgroundColor: 'transparent', borderRadius: 0, marginLeft: Spacing.sm, maxWidth: '92%' },
    messageImage: { width: '100%', height: 220, borderRadius: BorderRadius.md, marginBottom: Spacing.sm },
    downloadButton: { position: 'absolute', bottom: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.75)', borderRadius: BorderRadius.full, width: 44, height: 44, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
    fileAttachment: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background, borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.sm, borderWidth: 1, borderColor: colors.border, gap: Spacing.md },
    fileIcon: { width: 48, height: 48, borderRadius: BorderRadius.md, backgroundColor: `${colors.primary}15`, alignItems: 'center', justifyContent: 'center' },
    fileInfo: { flex: 1 },
    fileName: { ...Typography.body, color: colors.text, fontWeight: '600', fontSize: 14 },
    fileMeta: { ...Typography.caption, color: colors.textSecondary, fontSize: 12, marginTop: 2 },
    messageText: { fontSize: 15, lineHeight: 23, flexShrink: 1, flexWrap: 'wrap' },
    userMessageText: { color: '#FFFFFF' },
    assistantMessageText: { color: colors.text },
    editedLabel: { ...Typography.caption, fontSize: 11, marginTop: Spacing.xs, fontStyle: 'italic', opacity: 0.7, color: message.role === 'user' ? 'rgba(255,255,255,0.7)' : colors.textSecondary },
    actionsContainer: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: message.role === 'user' ? 'rgba(255,255,255,0.2)' : colors.border, flexWrap: 'wrap' },
    actionButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: BorderRadius.sm, backgroundColor: message.role === 'user' ? 'rgba(255,255,255,0.15)' : colors.background },
    actionButtonActive: { backgroundColor: colors.primary },
    linkText: { color: message.role === 'user' ? '#FFFFFF' : colors.primary, textDecorationLine: 'underline', fontWeight: '500' },
    phoneText: { color: '#007AFF', textDecorationLine: 'underline', fontWeight: '600' },
    userImagePreview: { width: SCREEN_WIDTH * 0.55, height: SCREEN_WIDTH * 0.4, borderRadius: BorderRadius.md, marginBottom: Spacing.sm },
  }), [colors, message.role]);

  const isStreamingRendered = streaming && isGenerating && message.role === 'assistant';

  const renderTextParts = useCallback((textParts: any[], isUserMsg: boolean) => {
    return textParts.map((textPart, textIndex) => {
      if (textPart.type === 'link') {
        return <Text key={`link-${textIndex}`} style={isUserMsg ? styles.linkText : [styles.linkText, { color: colors.primary }]} onPress={() => handleLinkPress(textPart.url)}>{textPart.content}</Text>;
      }
      if (textPart.type === 'phone') {
        return <Text key={`phone-${textIndex}`} style={[styles.phoneText, isUserMsg && { color: 'rgba(255,255,255,0.9)' }]} onPress={() => setPhoneCallModal({ visible: true, number: textPart.number })}>{textPart.content}</Text>;
      }
      if (textPart.type === 'livechat') {
        return <Text key={`lc-${textIndex}`} style={isUserMsg ? styles.linkText : [styles.linkText, { color: colors.primary }]} onPress={() => { setSelectedLink('https://988lifeline.org/chat/'); toggleModal('webView', true); }}>{textPart.content}</Text>;
      }
      return <Text key={`txt-${textIndex}`}>{textPart.content}</Text>;
    });
  }, [styles, colors, handleLinkPress, toggleModal]);

  return (
    <>
      <Animated.View style={{ opacity: entranceOpacity, transform: [{ translateY: entranceTranslateY }] }}>
        {hasBothTextAndImage ? (
          <View style={{ alignSelf: 'flex-end', marginRight: Spacing.sm, maxWidth: '78%', gap: 6 }}>
            <TouchableOpacity onPress={() => handleImagePress(message.image_url!, true)} style={{ borderRadius: 18, overflow: 'hidden', alignSelf: 'flex-end' }} activeOpacity={0.9}>
              <Image source={{ uri: message.image_url }} style={styles.userImagePreview} contentFit="cover" transition={200} />
            </TouchableOpacity>
            <Pressable onLongPress={handleLongPress} delayLongPress={350} style={styles.userMessageTextOnly}>
              {contentParts.map((part, index) => {
                if (part.type === 'code') return <CodeBlock key={`code-${index}`} code={part.content} language={part.language || 'code'} streaming={false} speed={streamingSpeed} />;
                const textParts = parseTextWithLinks(part.content);
                return (
                  <Text key={`seg-${index}`} style={[styles.messageText, styles.userMessageText]}>
                    {renderTextParts(textParts, true)}
                  </Text>
                );
              })}
              {message.edited && <Text style={styles.editedLabel}>(edited)</Text>}
            </Pressable>
          </View>
        ) : (
        <Pressable
          onLongPress={handleLongPress}
          delayLongPress={350}
          style={[styles.container, message.role === 'user' ? (hasOnlyImage ? styles.userMessageImageOnly : styles.userMessage) : styles.assistantMessage]}
        >
          {message.role === 'user' && message.image_url && !hasBothTextAndImage && (
            <TouchableOpacity onPress={() => handleImagePress(message.image_url!, true)} style={{ borderRadius: 18, overflow: 'hidden', marginBottom: message.content.trim() ? Spacing.sm : 0 }} activeOpacity={0.9}>
              <Image source={{ uri: message.image_url }} style={styles.userImagePreview} contentFit="cover" transition={200} />
            </TouchableOpacity>
          )}

          {message.role === 'assistant' && !hasGeneratedImage && isGenerating && isImageTask ? (
            <InlineImageCreatingPlaceholder />
          ) : null}

          {hasGeneratedImage && message.role === 'assistant' && (
            <View style={imgCardStyles.cardWrap}>
              <Text style={imgCardStyles.label}>Image created ✨</Text>
              {/* Tap image → fullscreen viewer */}
              <Pressable
                onPress={() => handleImagePress(message.image_url!)}
                onLongPress={() => handleAIImageLongPress(message.image_url!)}
                delayLongPress={350}
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
                  <View style={[StyleSheet.absoluteFillObject, { borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center' }]}>
                    <ActivityIndicator color="#fff" size="large" />
                    <Text style={{ color: '#fff', marginTop: 8, fontSize: 13 }}>Saving...</Text>
                  </View>
                ) : null}
                {/* Download button overlaid on image */}
                <TouchableOpacity
                  style={styles.downloadButton}
                  onPress={(e) => { e.stopPropagation?.(); handleDownloadImage(message.image_url!); }}
                  disabled={downloadingImage}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Ionicons name="download" size={20} color="#fff" />
                </TouchableOpacity>
              </Pressable>
              {/* Action bar below image */}
              <BlurView intensity={75} tint="dark" style={aiImgMenuStyles.bar}>
                <TouchableOpacity style={aiImgMenuStyles.btn} onPress={() => handleDownloadImage(message.image_url!)}>
                  <Ionicons name="arrow-down-circle-outline" size={20} color="#FFF" />
                  <Text style={aiImgMenuStyles.btnLabel}>Save</Text>
                </TouchableOpacity>
                <View style={aiImgMenuStyles.divider} />
                <TouchableOpacity style={aiImgMenuStyles.btn} onPress={() => handleImagePress(message.image_url!)}>
                  <Ionicons name="expand-outline" size={20} color="#FFF" />
                  <Text style={aiImgMenuStyles.btnLabel}>View</Text>
                </TouchableOpacity>
                <View style={aiImgMenuStyles.divider} />
                <TouchableOpacity style={aiImgMenuStyles.btn} onPress={() => handleShareImage(message.image_url!)}>
                  <Ionicons name="share-outline" size={20} color="#FFF" />
                  <Text style={aiImgMenuStyles.btnLabel}>Share</Text>
                </TouchableOpacity>
                <View style={aiImgMenuStyles.divider} />
                <TouchableOpacity style={aiImgMenuStyles.btn} onPress={() => handleLike('like')}>
                  <Ionicons name={liked === 'like' ? 'thumbs-up' : 'thumbs-up-outline'} size={20} color={liked === 'like' ? '#34C759' : '#FFF'} />
                  <Text style={[aiImgMenuStyles.btnLabel, liked === 'like' && { color: '#34C759' }]}>Good</Text>
                </TouchableOpacity>
              </BlurView>
            </View>
          )}

          {message.file_url && message.file_name && (
            <TouchableOpacity style={styles.fileAttachment} onPress={() => handleFileDownload(message.file_name!, '', message.file_type || 'txt')}>
              <View style={styles.fileIcon}><Ionicons name={getFileIcon(message.file_type)} size={26} color={colors.primary} /></View>
              <View style={styles.fileInfo}>
                <Text style={styles.fileName} numberOfLines={1}>{message.file_name}</Text>
                <Text style={styles.fileMeta}>{message.file_type?.toUpperCase() || 'FILE'}</Text>
              </View>
              <Ionicons name="download-outline" size={22} color={colors.text} />
            </TouchableOpacity>
          )}

          {contentParts.map((part, index) => {
            const isLastPart = index === contentParts.length - 1 && !hasCard;
            const shouldStream = shouldStreamPart(isLastPart);

            if (part.type === 'code') {
              return (
                <View key={`code-${index}`} style={{ marginVertical: 2 }}>
                  <CodeBlock code={part.content} language={part.language || 'code'} streaming={shouldStream} speed={streamingSpeed} />
                </View>
              );
            }

            if (message.role === 'assistant') {
              const textSegments = splitTablesFromText(part.content);
              return (
                <View key={`text-${index}`}>
                  {textSegments.map((seg, si) => {
                    if (seg.type === 'table') return <MarkdownTable key={`table-${si}`} tableText={seg.content} colors={colors} />;
                    return (
                      <React.Fragment key={`seg-${si}`}>
                        <MarkdownRenderer text={seg.content} colors={colors} isUser={false} isStreaming={isStreamingRendered && isLastPart && si === textSegments.length - 1} />
                        {isStreamingRendered && isLastPart && si === textSegments.length - 1 ? (
                          <BlinkingCursor color={isDark ? 'rgba(255,255,255,0.85)' : '#333333'} />
                        ) : null}
                      </React.Fragment>
                    );
                  })}
                </View>
              );
            }

            const textSegments = splitTablesFromText(part.content);
            return (
              <View key={`text-${index}`}>
                {textSegments.map((seg, si) => {
                  if (seg.type === 'table') return <MarkdownTable key={`table-${si}`} tableText={seg.content} colors={colors} />;
                  const textParts = parseTextWithLinks(seg.content);
                  return (
                    <Text key={`seg-${si}`} style={[styles.messageText, styles.userMessageText]}>
                      {renderTextParts(textParts, true)}
                    </Text>
                  );
                })}
              </View>
            );
          })}

          {inlineImages.length > 0 && inlineImages.map((imgUrl, i) => (
            <TouchableOpacity key={`inline-img-${i}`} onPress={() => handleImagePress(imgUrl)} activeOpacity={0.9} style={{ borderRadius: BorderRadius.md, overflow: 'hidden', marginVertical: Spacing.sm }}>
              <Image source={{ uri: imgUrl }} style={styles.messageImage} contentFit="cover" transition={200} />
              <TouchableOpacity style={styles.downloadButton} onPress={(e) => { e.stopPropagation(); handleDownloadImage(imgUrl); }}>
                <Ionicons name="download" size={22} color="#fff" />
              </TouchableOpacity>
            </TouchableOpacity>
          ))}

          {imageSearchResults && imageSearchResults.length > 0 && (
            <ImageSearchResults
              query={message.content.split('\n')[0] || 'Image search'}
              images={imageSearchResults}
              onImagePress={(url) => handleImagePress(url)}
            />
          )}

          {downloadLabel && message.role === 'assistant' && <DownloadLinkCard label={downloadLabel} colors={colors} />}
          {hasCard && message.role === 'assistant' && <MessageCard content={cardContent} colors={colors} />}
          {message.role === 'assistant' && sources.length > 0 && <SourcesButton sources={sources} />}

          {message.edited && (
            <Text style={styles.editedLabel}>(edited {message.edited_at ? new Date(message.edited_at).toLocaleTimeString() : ''})</Text>
          )}

          {message.role === 'assistant' && !isGenerating && !hasGeneratedImage && (
            <View style={styles.actionsContainer}>
              <TouchableOpacity style={styles.actionButton} onPress={handleCopy}>
                <Ionicons name="copy-outline" size={14} color={colors.text} />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionButton, liked === 'like' && styles.actionButtonActive]} onPress={() => handleLike('like')}>
                <Ionicons name={liked === 'like' ? 'thumbs-up' : 'thumbs-up-outline'} size={14} color={liked === 'like' ? '#FFFFFF' : colors.text} />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionButton, liked === 'dislike' && styles.actionButtonActive]} onPress={() => handleLike('dislike')}>
                <Ionicons name={liked === 'dislike' ? 'thumbs-down' : 'thumbs-down-outline'} size={14} color={liked === 'dislike' ? '#FFFFFF' : colors.text} />
              </TouchableOpacity>
              {analysisEntries.length > 0 && <TerminalButton onPress={() => setAnalysisVisible(true)} />}
              <TouchableOpacity style={styles.actionButton} onPress={() => setShowActionsModal(true)}>
                <Ionicons name="ellipsis-horizontal" size={14} color={colors.text} />
              </TouchableOpacity>
            </View>
          )}
        </Pressable>
        )}
      </Animated.View>

      {analysisEntries.length > 0 && (
        <AnalysisModal visible={analysisVisible} onClose={() => setAnalysisVisible(false)} entries={analysisEntries} title="Analysis" />
      )}

      <MessageReactionSheet
        visible={showReactionSheet}
        onClose={() => setShowReactionSheet(false)}
        message={message}
        onCopy={handleCopy}
        onReply={() => onReply?.(message)}
        onDelete={isAdmin ? handleDeleteMessage : undefined}
        onReport={message.role === 'assistant' ? () => setShowReportModal(true) : undefined}
        isAdmin={isAdmin}
        isDark={isDark}
        colors={colors}
      />

      <ReportMessageModal
        visible={showReportModal}
        onClose={() => setShowReportModal(false)}
        onSubmit={handleReportSubmit}
        isDark={isDark}
        colors={colors}
      />

      {/* Select text modal */}
      <Modal visible={showSelectTextModal} transparent={false} animationType="slide" onRequestClose={() => setShowSelectTextModal(false)}>
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 56 : 28, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }}>
            <TouchableOpacity onPress={() => setShowSelectTextModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={{ color: colors.text, fontSize: 17, fontWeight: '600' }}>Select Text</Text>
            <TouchableOpacity onPress={async () => { try { await Clipboard.setStringAsync(message.content); showAlert('Copied!', 'Message copied to clipboard'); setShowSelectTextModal(false); } catch { setShowSelectTextModal(false); } }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={{ color: colors.primary, fontSize: 15, fontWeight: '600' }}>Copy All</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 60 }} keyboardShouldPersistTaps="always">
            {Platform.OS === 'ios' ? (
              <TextInput value={message.content} multiline editable={false} scrollEnabled={false} showSoftInputOnFocus={false} contextMenuHidden={false} selectionColor={`${colors.primary}55`} style={{ color: colors.text, fontSize: 16, lineHeight: 26, padding: 0, margin: 0, textAlignVertical: 'top' }} />
            ) : (
              <Text selectable selectionColor={`${colors.primary}55`} style={{ color: colors.text, fontSize: 16, lineHeight: 26 }}>{message.content}</Text>
            )}
          </ScrollView>
          <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingBottom: Platform.OS === 'ios' ? 34 : 20, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }}>
            <TouchableOpacity style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 12, paddingVertical: 13, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: colors.border }} onPress={async () => { await Share.share({ message: message.content }); }}>
              <Ionicons name="share-outline" size={18} color={colors.text} />
              <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600' }}>Share</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ flex: 1, backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 13, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }} onPress={async () => { await Clipboard.setStringAsync(message.content); showAlert('Copied!', 'Copied'); setShowSelectTextModal(false); }}>
              <Ionicons name="copy-outline" size={18} color="#FFF" />
              <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '600' }}>Copy All</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Phone call confirmation modal */}
      <PhoneCallModal
        visible={phoneCallModal.visible}
        number={phoneCallModal.number}
        onCall={() => handlePhoneCall(phoneCallModal.number)}
        onCancel={() => setPhoneCallModal({ visible: false, number: '' })}
        isDark={isDark}
      />

      <LinkSafetyModal visible={modals.link} url={selectedLink} onClose={() => toggleModal('link', false)} onOpenLink={() => { toggleModal('link', false); toggleModal('webView', true); }} />
      {/* Live chat and other URLs open in-app WebView */}
      <WebViewModal visible={modals.webView} url={selectedLink} onClose={() => toggleModal('webView', false)} />
      <ImageViewerModal visible={modals.imageViewer} imageUrl={selectedImageUrl} onClose={() => toggleModal('imageViewer', false)} onEdit={viewerIsUserImage ? undefined : handleImageEdit} title={viewerIsUserImage ? 'Photo' : 'Image created ✨'} isUserImage={viewerIsUserImage} />
      <ImageEditModal visible={modals.imageEdit} imageUrl={selectedImageUrl} onClose={() => toggleModal('imageEdit', false)} onApplyEdits={handleApplyImageEdits} />
      <FileDownloadModal visible={modals.file} fileName={fileData.name} fileContent={fileData.content} fileType={fileData.type} onClose={() => toggleModal('file', false)} />
      <MessageActionsModal visible={showActionsModal} onClose={() => setShowActionsModal(false)} message={message} onLike={handleLike} />
    </>
  );
});

