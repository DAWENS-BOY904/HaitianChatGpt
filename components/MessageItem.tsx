import React, { useState, memo, useCallback, useMemo } from 'react';
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
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { useTheme } from '../hooks/useTheme';
import { useAuth, useAlert } from '@/template';
import { router } from 'expo-router';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { StreamingCodeBlock } from './StreamingCodeBlock';
import { StreamingText } from './StreamingText';
import { MessageActionsModal } from './MessageActionsModal';
import { LinkSafetyModal } from './LinkSafetyModal';
import { WebViewModal } from './WebViewModal';
import { ImageViewerModal } from './ImageViewerModal';
import { ImageEditModal } from './ImageEditModal';
import { FileDownloadModal } from './FileDownloadModal';
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
    lowerUrl.includes('supabase') && lowerUrl.includes('chat-images')
  );
};

const getFileIcon = (fileType?: string): keyof typeof Ionicons.glyphMap => {
  const iconMap: Record<string, keyof typeof Ionicons.glyphMap> = {
    csv: 'document-text', html: 'code-slash', json: 'code',
    js: 'logo-javascript', ts: 'code', pdf: 'document',
    doc: 'document-text', docx: 'document-text', xls: 'grid',
    xlsx: 'grid', default: 'document',
  };
  return iconMap[fileType?.toLowerCase() || ''] || iconMap.default;
};

// Detect if content has a message card
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

// Styled Message Card Component
const MessageCard = memo(function MessageCard({
  content,
  colors,
}: {
  content: string;
  colors: any;
}) {
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
      await FileSystem.writeAsStringAsync(fileUri, editedContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/plain',
          dialogTitle: 'Save Message',
          UTI: 'public.plain-text',
        });
      } else {
        await Share.share({ message: editedContent, title: 'Message' });
      }
    } catch (error) {
      showAlert('Error', 'Failed to download message');
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({ message: editedContent, title: 'Message' });
    } catch {}
  };

  if (isEditing) {
    return (
      <Modal visible animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          {/* Edit Modal Header */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingTop: Platform.OS === 'ios' ? 56 : 24,
            paddingBottom: 16,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}>
            <TouchableOpacity onPress={() => setIsEditing(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={{ color: colors.text, fontSize: 17, fontWeight: '600' }}>Message</Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity onPress={handleCopy}>
                <Ionicons name="copy-outline" size={22} color={colors.text} />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleShare}>
                <Ionicons name="share-outline" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>
          </View>
          <ScrollView style={{ flex: 1, padding: 20 }}>
            <View style={{
              backgroundColor: colors.surface,
              borderRadius: 16,
              padding: 20,
              minHeight: 300,
            }}>
              <Text
                style={{
                  color: colors.text,
                  fontSize: 16,
                  lineHeight: 26,
                  fontWeight: '400',
                }}
                selectable
              >
                {editedContent}
              </Text>
            </View>
          </ScrollView>
        </View>
      </Modal>
    );
  }

  return (
    <View style={{
      backgroundColor: colors.surface,
      borderRadius: 16,
      marginTop: 8,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
    }}>
      {/* Card Header */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        backgroundColor: `${colors.background}80`,
      }}>
        <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '500' }}>
          Message
        </Text>
        <View style={{ flexDirection: 'row', gap: 16 }}>
          <TouchableOpacity onPress={() => setIsEditing(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="pencil-outline" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleCopy} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons
              name={copied ? 'checkmark' : 'copy-outline'}
              size={18}
              color={copied ? colors.primary : colors.textSecondary}
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleShare} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="share-outline" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Card Content */}
      <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
        <View style={{ padding: 16 }}>
          <Text style={{
            color: colors.text,
            fontSize: 15,
            lineHeight: 24,
            fontWeight: '400',
          }}>
            {editedContent}
          </Text>
        </View>
      </ScrollView>

      {/* Card Footer */}
      <TouchableOpacity
        onPress={handleDownload}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          paddingVertical: 12,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          backgroundColor: `${colors.primary}10`,
        }}
      >
        <Ionicons name="download-outline" size={16} color={colors.primary} />
        <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '600' }}>
          Download Message
        </Text>
      </TouchableOpacity>
    </View>
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
}: MessageItemProps) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const supabase = getSupabaseClient();

  const [showContextMenu, setShowContextMenu] = useState(false);
  const [showActionsModal, setShowActionsModal] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [liked, setLiked] = useState<'like' | 'dislike' | null>(null);
  const [selectedLink, setSelectedLink] = useState('');
  const [selectedImageUrl, setSelectedImageUrl] = useState('');
  const [fileData, setFileData] = useState({ name: '', content: '', type: '' });
  const [modals, setModals] = useState({
    link: false, webView: false, imageViewer: false, imageEdit: false, file: false,
  });
  const [downloadingImage, setDownloadingImage] = useState(false);

  const toggleModal = useCallback((modalName: keyof typeof modals, value?: boolean) => {
    setModals(prev => ({ ...prev, [modalName]: value ?? !prev[modalName] }));
  }, []);

  // Download image to device
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
    } catch (error) {
      Alert.alert('Error', 'Failed to save image. Please try again.');
    } finally {
      setDownloadingImage(false);
    }
  }, [showAlert]);

  const handleLongPress = useCallback((event: any) => {
    const { pageX, pageY } = event.nativeEvent;
    setMenuPosition({ x: Math.min(pageX, SCREEN_WIDTH - 140), y: pageY - 100 });
    if (message.role === 'assistant') {
      setShowActionsModal(true);
    } else {
      setShowContextMenu(true);
    }
  }, [message.role]);

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

  // Parse message card
  const { hasCard, cardContent, beforeCard } = useMemo(
    () => extractMessageCard(message.content),
    [message.content]
  );

  // Parse content into text/code parts
  const contentParts = useMemo(() => {
    const textToProcess = beforeCard;
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
  }, [beforeCard]);

  // Parse text with links
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

  const styles = useMemo(() => StyleSheet.create({
    container: {
      padding: Spacing.md,
      marginVertical: Spacing.xs,
      maxWidth: '88%',
    },
    userMessage: {
      alignSelf: 'flex-end',
      backgroundColor: colors.primary,
      borderRadius: BorderRadius.lg,
      borderBottomRightRadius: 4,
      marginRight: Spacing.sm,
    },
    assistantMessage: {
      alignSelf: 'flex-start',
      backgroundColor: colors.surface,
      borderRadius: BorderRadius.lg,
      borderBottomLeftRadius: 4,
      marginLeft: Spacing.sm,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
      elevation: 2,
    },
    messageImage: {
      width: '100%',
      height: 220,
      borderRadius: BorderRadius.md,
      marginBottom: Spacing.sm,
      backgroundColor: colors.background,
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
    messageText: { ...Typography.body, fontSize: 15, lineHeight: 22 },
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
    actionButtonText: {
      ...Typography.caption,
      color: message.role === 'user' ? '#FFFFFF' : colors.text,
      fontSize: 12,
      fontWeight: '500',
    },
    generatingIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      marginTop: Spacing.sm,
    },
    generatingText: { ...Typography.caption, color: colors.textSecondary, fontSize: 12 },
    cancelButton: {
      paddingHorizontal: Spacing.md,
      paddingVertical: 6,
      borderRadius: BorderRadius.sm,
      backgroundColor: '#FF3B30',
    },
    cancelButtonText: { ...Typography.caption, color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
    contextMenuOverlay: { flex: 1, backgroundColor: 'transparent' },
    contextMenu: {
      position: 'absolute',
      backgroundColor: colors.card,
      borderRadius: BorderRadius.lg,
      padding: Spacing.xs,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.25,
      shadowRadius: 12,
      elevation: 10,
      minWidth: 140,
    },
    contextMenuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
      borderRadius: BorderRadius.sm,
    },
    contextMenuText: { ...Typography.body, color: colors.text, fontSize: 15 },
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
      backgroundColor: colors.background,
    },
  }), [colors, message.role]);

  return (
    <>
      <Pressable
        onLongPress={handleLongPress}
        style={[
          styles.container,
          message.role === 'user' ? styles.userMessage : styles.assistantMessage,
        ]}
      >
        {/* User uploaded image */}
        {message.role === 'user' && message.image_url && (
          <TouchableOpacity onPress={() => handleImagePress(message.image_url!)}>
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
          <TouchableOpacity
            onPress={() => handleImagePress(message.image_url!)}
            activeOpacity={0.9}
            disabled={downloadingImage}
          >
            <Image
              source={{ uri: message.image_url }}
              style={styles.messageImage}
              contentFit="cover"
              transition={200}
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
              <StreamingCodeBlock
                key={`code-${index}`}
                code={part.content}
                language={part.language}
                streaming={shouldStream}
                speed={streamingSpeed}
              />
            );
          }

          const textParts = parseTextWithLinks(part.content);
          return (
            <Text
              key={`text-${index}`}
              style={[
                styles.messageText,
                message.role === 'user' ? styles.userMessageText : styles.assistantMessageText,
              ]}
            >
              {shouldStream ? (
                <StreamingText
                  text={part.content}
                  speed={streamingSpeed}
                  variance={0.2}
                  chunkSize={4}
                  cursor={true}
                  style={styles.assistantMessageText}
                  onChunkRendered={onChunkRendered}
                />
              ) : (
                textParts.map((textPart, textIndex) => {
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
                })
              )}
            </Text>
          );
        })}

        {/* Styled Message Card */}
        {hasCard && message.role === 'assistant' && (
          <MessageCard content={cardContent} colors={colors} />
        )}

        {/* Edited Indicator */}
        {message.edited && (
          <Text style={styles.editedLabel}>
            (edited {message.edited_at ? new Date(message.edited_at).toLocaleTimeString() : ''})
          </Text>
        )}

        {/* Generating Indicator */}
        {message.role === 'assistant' && isGenerating && (
          <View style={styles.generatingIndicator}>
            <ActivityIndicator size="small" color={colors.textSecondary} />
            <Text style={styles.generatingText}>Thinking...</Text>
            {onCancel && (
              <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
                <Text style={styles.cancelButtonText}>Stop</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Action Buttons - Assistant only */}
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

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => setShowActionsModal(true)}
            >
              <Ionicons name="ellipsis-horizontal" size={14} color={colors.text} />
            </TouchableOpacity>
          </View>
        )}
      </Pressable>

      {/* Context Menu Modal */}
      <Modal
        visible={showContextMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowContextMenu(false)}
      >
        <Pressable style={styles.contextMenuOverlay} onPress={() => setShowContextMenu(false)}>
          <View style={[styles.contextMenu, { top: menuPosition.y, left: menuPosition.x }]}>
            <TouchableOpacity style={styles.contextMenuItem} onPress={handleCopy}>
              <Ionicons name="copy-outline" size={20} color={colors.text} />
              <Text style={styles.contextMenuText}>Copy</Text>
            </TouchableOpacity>
            {message.role === 'user' && onEdit && (
              <TouchableOpacity style={styles.contextMenuItem} onPress={handleEdit}>
                <Ionicons name="pencil-outline" size={20} color={colors.text} />
                <Text style={styles.contextMenuText}>Edit</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.contextMenuItem}
              onPress={() => { setShowContextMenu(false); setShowActionsModal(true); }}
            >
              <Ionicons name="share-outline" size={20} color={colors.text} />
              <Text style={styles.contextMenuText}>More</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
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
