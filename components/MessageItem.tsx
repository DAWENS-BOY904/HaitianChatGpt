import React, { useState, memo, useCallback, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Pressable, 
  Image, 
  Modal, 
  ActivityIndicator, 
  Alert,
  Dimensions 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
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
  isGenerating?: boolean;
  streaming?: boolean;
  streamingSpeed?: number;
}

// PRODUCTION-READY: Detect if URL is an image
const isImageUrl = (url: string): boolean => {
  if (!url) return false;
  const lowerUrl = url.toLowerCase();
  const imageExtensions = /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/;
  const imageHosts = [
    'openai.com',
    'googleusercontent.com',
    'oaidalleapiprodscus.blob.core.windows.net',
    'replicate.delivery',
    'huggingface.co'
  ];
  
  return (
    imageExtensions.test(lowerUrl) ||
    lowerUrl.startsWith('data:image/') ||
    imageHosts.some(host => lowerUrl.includes(host))
  );
};

// Get file icon based on type
const getFileIcon = (fileType?: string): keyof typeof Ionicons.glyphMap => {
  const iconMap: Record<string, keyof typeof Ionicons.glyphMap> = {
    csv: 'document-text',
    html: 'code-slash',
    json: 'code',
    js: 'logo-javascript',
    ts: 'code',
    pdf: 'document',
    doc: 'document-text',
    docx: 'document-text',
    xls: 'grid',
    xlsx: 'grid',
    default: 'document'
  };
  return iconMap[fileType?.toLowerCase() || ''] || iconMap.default;
};

export const MessageItem = memo(function MessageItem({ 
  message, 
  onCancel, 
  onEdit, 
  isGenerating, 
  streaming = false,
  streamingSpeed = 50 
}: MessageItemProps) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const supabase = getSupabaseClient();

  // Modal states
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [showActionsModal, setShowActionsModal] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  
  // Content interaction states
  const [liked, setLiked] = useState<'like' | 'dislike' | null>(null);
  const [selectedLink, setSelectedLink] = useState('');
  const [selectedImageUrl, setSelectedImageUrl] = useState('');
  const [fileData, setFileData] = useState({ name: '', content: '', type: '' });
  
  // Modal visibility states
  const [modals, setModals] = useState({
    link: false,
    webView: false,
    imageViewer: false,
    imageEdit: false,
    file: false
  });
  
  const [downloadingImage, setDownloadingImage] = useState(false);

  // Toggle modal helper
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
      console.error('Image download error:', error);
      Alert.alert('Error', 'Failed to save image. Please try again.');
    } finally {
      setDownloadingImage(false);
    }
  }, [showAlert]);

  // Long press handler
  const handleLongPress = useCallback((event: any) => {
    const { pageX, pageY } = event.nativeEvent;
    setMenuPosition({ 
      x: Math.min(pageX, SCREEN_WIDTH - 140), 
      y: pageY - 100 
    });
    
    if (message.role === 'assistant') {
      setShowActionsModal(true);
    } else {
      setShowContextMenu(true);
    }
  }, [message.role]);

  // Copy message content
  const handleCopy = useCallback(async () => {
    await Clipboard.setStringAsync(message.content);
    showAlert('Copied!', 'Message copied to clipboard');
    setShowContextMenu(false);
  }, [message.content, showAlert]);

  // Edit message
  const handleEdit = useCallback(() => {
    onEdit?.(message.id, message.content);
    setShowContextMenu(false);
  }, [message.id, message.content, onEdit]);

  // Like/dislike handler
  const handleLike = useCallback(async (type: 'like' | 'dislike') => {
    if (!user) {
      router.push('/login');
      return;
    }

    router.push(`/message-detail?messageId=${message.id}`);

    try {
      if (liked === type) {
        await supabase.from('message_likes').delete().eq('message_id', message.id).eq('user_id', user.id);
        setLiked(null);
      } else {
        await supabase.from('message_likes').upsert({
          message_id: message.id,
          user_id: user.id,
          like_type: type,
        });
        setLiked(type);
      }
    } catch (error) {
      console.error('Like error:', error);
      showAlert('Error', 'Failed to save feedback');
    }
  }, [liked, message.id, user, supabase, showAlert]);

  // Link handling
  const handleLinkPress = useCallback((url: string) => {
    setSelectedLink(url);
    toggleModal('link', true);
  }, [toggleModal]);

  // Image handling
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
        body: {
          editImageUrl: selectedImageUrl,
          editPrompt,
          messages: [],
          conversationId: 'temp',
        },
      });

      if (error) throw error;
      if (data.imageUrl) {
        setSelectedImageUrl(data.imageUrl);
        showAlert('Success', 'Image edited successfully!');
        toggleModal('imageEdit', false);
        toggleModal('imageViewer', true);
      }
    } catch (error) {
      console.error('Edit error:', error);
      throw error;
    }
  }, [selectedImageUrl, supabase, showAlert, toggleModal]);

  // File handling
  const handleFileDownload = useCallback((fileName: string, fileContent: string, fileType: string) => {
    setFileData({ name: fileName, content: fileContent, type: fileType });
    toggleModal('file', true);
  }, [toggleModal]);

  // Content parsing - memoized for performance
  const contentParts = useMemo(() => {
    const parts: Array<{type: 'text' | 'code', content: string, language?: string}> = [];
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(message.content)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ type: 'text', content: message.content.substring(lastIndex, match.index) });
      }
      parts.push({ type: 'code', language: match[1] || 'text', content: match[2].trim() });
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < message.content.length) {
      parts.push({ type: 'text', content: message.content.substring(lastIndex) });
    }

    return parts.length > 0 ? parts : [{ type: 'text', content: message.content }];
  }, [message.content]);

  // Parse text with links
  const parseTextWithLinks = useCallback((text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = [];
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

  // Check for file download indicators
  const hasFileDownload = useMemo(() => {
    return /download\s+file|👉.*?download|📎/i.test(message.content);
  }, [message.content]);

  const extractFileInfo = useMemo(() => {
    const match = message.content.match(/File created:\s*([\w_]+\.(txt|csv|html|json|js|ts|pdf))/i);
    return match ? { fileName: match[1], type: match[2] } : null;
  }, [message.content]);

  const hasGeneratedImage = useMemo(() => 
    message.image_url && isImageUrl(message.image_url), 
    [message.image_url]
  );

  // Determine if this part should stream
  const shouldStreamPart = useCallback((partIndex: number, isLastPart: boolean) => {
    return streaming && isGenerating && message.role === 'assistant' && isLastPart;
  }, [streaming, isGenerating, message.role]);

  // Styles - moved outside render for performance
  const styles = useMemo(() => StyleSheet.create({
    container: {
      padding: Spacing.md,
      marginVertical: Spacing.xs,
      maxWidth: '85%',
    },
    userMessage: {
      alignSelf: 'flex-end',
      backgroundColor: colors.primary,
      borderRadius: BorderRadius.lg,
      borderBottomRightRadius: BorderRadius.sm,
      marginRight: Spacing.sm,
    },
    assistantMessage: {
      alignSelf: 'flex-start',
      backgroundColor: colors.surface,
      borderRadius: BorderRadius.lg,
      borderBottomLeftRadius: BorderRadius.sm,
      marginLeft: Spacing.sm,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
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
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      borderRadius: BorderRadius.md,
      justifyContent: 'center',
      alignItems: 'center',
    },
    downloadButton: {
      position: 'absolute',
      bottom: 12,
      right: 12,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
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
    fileInfo: {
      flex: 1,
    },
    fileName: {
      ...Typography.body,
      color: colors.text,
      fontWeight: '600',
      fontSize: 14,
    },
    fileMeta: {
      ...Typography.caption,
      color: colors.textSecondary,
      fontSize: 12,
      marginTop: 2,
    },
    messageText: {
      ...Typography.body,
      fontSize: 15,
      lineHeight: 22,
    },
    userMessageText: {
      color: '#FFFFFF',
    },
    assistantMessageText: {
      color: colors.text,
    },
    editedLabel: {
      ...Typography.caption,
      fontSize: 11,
      marginTop: Spacing.xs,
      fontStyle: 'italic',
      opacity: 0.7,
    },
    actionsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      marginTop: Spacing.sm,
      paddingTop: Spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: message.role === 'user' ? 'rgba(255,255,255,0.2)' : colors.border,
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
    actionButtonActive: {
      backgroundColor: colors.primary,
    },
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
    generatingText: {
      ...Typography.caption,
      color: colors.textSecondary,
      fontSize: 12,
    },
    cancelButton: {
      paddingHorizontal: Spacing.md,
      paddingVertical: 6,
      borderRadius: BorderRadius.sm,
      backgroundColor: colors.error || '#FF3B30',
    },
    cancelButtonText: {
      ...Typography.caption,
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '600',
    },
    contextMenuOverlay: {
      flex: 1,
      backgroundColor: 'transparent',
    },
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
    contextMenuText: {
      ...Typography.body,
      color: colors.text,
      fontSize: 15,
    },
    linkText: {
      color: message.role === 'user' ? '#FFFFFF' : colors.primary,
      textDecorationLine: 'underline',
      fontWeight: '500',
    },
    streamingCursor: {
      color: colors.primary,
      fontWeight: 'bold',
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
        {/* AI Generated Image */}
        {hasGeneratedImage && (
          <TouchableOpacity 
            onPress={() => handleImagePress(message.image_url!)}
            activeOpacity={0.9}
            disabled={downloadingImage}
          >
            <Image 
              source={{ uri: message.image_url }} 
              style={styles.messageImage} 
              resizeMode="cover"
            />
            {downloadingImage ? (
              <View style={styles.downloadOverlay}>
                <ActivityIndicator color="#fff" size="large" />
                <Text style={{ color: '#fff', marginTop: 8, fontSize: 13 }}>Saving...</Text>
              </View>
            ) : (
              <TouchableOpacity 
                style={styles.downloadButton}
                onPress={(e) => {
                  e.stopPropagation();
                  handleDownloadImage(message.image_url!);
                }}
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
          const isLastPart = index === contentParts.length - 1;
          const shouldStream = shouldStreamPart(index, isLastPart);

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
          const isStreamingText = shouldStream && part.content.length > 0;
          
          return (
            <Text
              key={`text-${index}`}
              style={[
                styles.messageText,
                message.role === 'user' ? styles.userMessageText : styles.assistantMessageText,
              ]}
            >
              {isStreamingText ? (
                <StreamingText
                  text={part.content}
                  speed={streamingSpeed}
                  variance={0.2}
                  cursor={true}
                  style={styles.assistantMessageText}
                  onComplete={() => {
                    // Optional: trigger haptic or sound when complete
                  }}
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

        {/* Action Buttons */}
        {message.role === 'assistant' && !isGenerating && (
          <View style={styles.actionsContainer}>
            {hasFileDownload && extractFileInfo && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleFileDownload(
                  extractFileInfo.fileName,
                  'File content would be here',
                  extractFileInfo.type
                )}
              >
                <Ionicons name="download-outline" size={16} color={colors.text} />
                <Text style={styles.actionButtonText}>Download</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity
              style={[styles.actionButton, liked === 'like' && styles.actionButtonActive]}
              onPress={() => handleLike('like')}
            >
              <Ionicons
                name={liked === 'like' ? 'thumbs-up' : 'thumbs-up-outline'}
                size={16}
                color={liked === 'like' ? '#FFFFFF' : colors.text}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, liked === 'dislike' && styles.actionButtonActive]}
              onPress={() => handleLike('dislike')}
            >
              <Ionicons
                name={liked === 'dislike' ? 'thumbs-down' : 'thumbs-down-outline'}
                size={16}
                color={liked === 'dislike' ? '#FFFFFF' : colors.text}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => setShowActionsModal(true)}
            >
              <Ionicons name="ellipsis-horizontal" size={16} color={colors.text} />
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
        <Pressable 
          style={styles.contextMenuOverlay}
          onPress={() => setShowContextMenu(false)}
        >
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
              onPress={() => {
                setShowContextMenu(false);
                setShowActionsModal(true);
              }}
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
        onOpenLink={() => {
          toggleModal('link', false);
          toggleModal('webView', true);
        }}
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
        title="Generated Image"
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
