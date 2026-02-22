import React, { useState, memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable, Image, Modal, ActivityIndicator, Alert } from 'react-native';
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
  streaming?: boolean; // NEW: Enable real-time typing
}

// PRODUCTION-READY: Detect if URL is an image
const isImageUrl = (url: string): boolean => {
  if (!url) return false;
  const lowerUrl = url.toLowerCase();
  return (
    lowerUrl.match(/\.(jpg|jpeg|png|gif|webp|bmp)(\?|$)/) !== null ||
    lowerUrl.startsWith('data:image/') ||
    lowerUrl.includes('openai.com') ||
    lowerUrl.includes('googleusercontent.com') ||
    lowerUrl.includes('oaidalleapiprodscus.blob.core.windows.net')
  );
};

export const MessageItem = memo(function MessageItem({ message, onCancel, onEdit, isGenerating, streaming = false }: MessageItemProps) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [liked, setLiked] = useState<'like' | 'dislike' | null>(null);
  const [showActionsModal, setShowActionsModal] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [linkModalVisible, setLinkModalVisible] = useState(false);
  const [selectedLink, setSelectedLink] = useState('');
  const [webViewVisible, setWebViewVisible] = useState(false);
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [imageEditVisible, setImageEditVisible] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState('');
  const [fileModalVisible, setFileModalVisible] = useState(false);
  const [fileData, setFileData] = useState({ name: '', content: '', type: '' });
  const [downloadingImage, setDownloadingImage] = useState(false);
  const supabase = getSupabaseClient();

  // PRODUCTION-READY: Download and save image to device
  const handleDownloadImage = async (imageUrl: string) => {
    try {
      setDownloadingImage(true);
      
      // Request permissions
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow access to save images to your library.');
        return;
      }

      // Download image
      const fileUri = FileSystem.documentDirectory + 'temp_image_' + Date.now() + '.jpg';
      const downloadResult = await FileSystem.downloadAsync(imageUrl, fileUri);
      
      if (downloadResult.status !== 200) {
        throw new Error('Download failed');
      }

      // Save to media library
      const asset = await MediaLibrary.createAssetAsync(downloadResult.uri);
      await MediaLibrary.createAlbumAsync('HaitianChatGPT', asset, false);
      
      Alert.alert('Success', 'Image saved to your photo library!');
    } catch (error) {
      console.error('Image download error:', error);
      Alert.alert('Error', 'Failed to save image. Please try again.');
    } finally {
      setDownloadingImage(false);
    }
  };

  const handleLongPress = (event: any) => {
    const { pageX, pageY } = event.nativeEvent;
    setMenuPosition({ x: pageX, y: pageY });
    setShowContextMenu(true);
  };

  const handleCopy = async () => {
    await Clipboard.setStringAsync(message.content);
    showAlert('Copied!', 'Message copied to clipboard');
    setShowContextMenu(false);
  };

  const handleEdit = () => {
    if (onEdit) {
      onEdit(message.id, message.content);
    }
    setShowContextMenu(false);
  };

  const handleLike = async (type: 'like' | 'dislike') => {
    if (!user) return;

    router.push(`/message-detail?messageId=${message.id}`);

    try {
      if (liked === type) {
        await supabase
          .from('message_likes')
          .delete()
          .eq('message_id', message.id)
          .eq('user_id', user.id);
        setLiked(null);
      } else {
        await supabase
          .from('message_likes')
          .upsert({
            message_id: message.id,
            user_id: user.id,
            like_type: type,
          });
        setLiked(type);
      }
    } catch (error) {
      console.error('Like error:', error);
    }
  };

  const handleLinkPress = (url: string) => {
    setSelectedLink(url);
    setLinkModalVisible(true);
  };

  const handleOpenLink = (url: string) => {
    setWebViewVisible(true);
  };

  const handleImagePress = (imageUrl: string) => {
    setSelectedImageUrl(imageUrl);
    setImageViewerVisible(true);
  };

  const handleImageEdit = () => {
    setImageViewerVisible(false);
    setImageEditVisible(true);
  };

  const handleApplyImageEdits = async (editPrompt: string) => {
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
        setImageEditVisible(false);
        setImageViewerVisible(true);
      }
    } catch (error) {
      console.error('Edit error:', error);
      throw error;
    }
  };

  const handleFileDownload = (fileName: string, fileContent: string, fileType: string) => {
    setFileData({ name: fileName, content: fileContent, type: fileType });
    setFileModalVisible(true);
  };

  const detectFileDownload = (content: string) => {
    const downloadRegex = /Download file la|Download file|👉.*?Download.*?↗/i;
    return downloadRegex.test(content);
  };

  const extractFileInfo = (content: string): { fileName: string; type: string } | null => {
    const fileMatch = content.match(/File created: ([\w_]+\.(txt|csv|html|json|js))/i);
    if (fileMatch) {
      return {
        fileName: fileMatch[1],
        type: fileMatch[2],
      };
    }
    return null;
  };

  const urlRegex = /(https?:\/\/[^\s]+)/g;

  const parseTextWithLinks = (text: string) => {
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = urlRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push({
          type: 'text',
          content: text.substring(lastIndex, match.index),
        });
      }

      parts.push({
        type: 'link',
        content: match[0],
        url: match[0],
      });

      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      parts.push({
        type: 'text',
        content: text.substring(lastIndex),
      });
    }

    return parts.length > 0 ? parts : [{ type: 'text', content: text }];
  };

  const parseCodeBlocks = (content: string) => {
    const parts = [];
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push({
          type: 'text',
          content: content.substring(lastIndex, match.index),
        });
      }

      parts.push({
        type: 'code',
        language: match[1] || 'code',
        content: match[2].trim(),
      });

      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < content.length) {
      parts.push({
        type: 'text',
        content: content.substring(lastIndex),
      });
    }

    return parts.length > 0 ? parts : [{ type: 'text', content }];
  };

  const contentParts = parseCodeBlocks(message.content);
  const hasGeneratedImage = message.image_url && isImageUrl(message.image_url);

  const styles = StyleSheet.create({
    container: {
      padding: Spacing.md,
      marginVertical: 0,
      overflow: 'hidden',
    },
    userMessage: {
      alignSelf: 'flex-end',
      backgroundColor: colors.primary,
      borderRadius: BorderRadius.md,
      maxWidth: '80%',
      marginRight: Spacing.md,
    },
    assistantMessage: {
      alignSelf: 'flex-start',
      backgroundColor: colors.surface,
      borderRadius: BorderRadius.md,
      maxWidth: '90%',
      marginLeft: Spacing.md,
      paddingBottom: Spacing.md,
    },
    messageImage: {
      width: '100%',
      height: 200,
      borderRadius: BorderRadius.sm,
      marginBottom: Spacing.sm,
    },
    downloadOverlay: {
      position: 'absolute',
      top: 0,
      right: 0,
      left: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      borderRadius: BorderRadius.sm,
      justifyContent: 'center',
      alignItems: 'center',
    },
    downloadIcon: {
      position: 'absolute',
      bottom: 8,
      right: 8,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      borderRadius: BorderRadius.full,
      width: 40,
      height: 40,
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
      width: 44,
      height: 44,
      borderRadius: BorderRadius.sm,
      backgroundColor: `${colors.primary}20`,
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
      marginBottom: 2,
    },
    fileSize: {
      ...Typography.caption,
      color: colors.textSecondary,
      fontSize: 12,
    },
    messageText: {
      ...Typography.body,
    },
    userMessageText: {
      color: '#FFFFFF',
    },
    assistantMessageText: {
      color: colors.text,
      lineHeight: 22,
    },
    editedLabel: {
      ...Typography.caption,
      fontSize: 10,
      marginTop: Spacing.xs,
      fontStyle: 'italic',
    },
    editedLabelUser: {
      color: 'rgba(255, 255, 255, 0.7)',
    },
    editedLabelAssistant: {
      color: colors.textSecondary,
    },
    actionsContainer: {
      flexDirection: 'row',
      gap: Spacing.sm,
      marginTop: Spacing.sm,
      paddingTop: Spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 4,
      borderRadius: BorderRadius.sm,
      backgroundColor: colors.background,
    },
    actionButtonActive: {
      backgroundColor: colors.primary,
    },
    actionButtonText: {
      ...Typography.caption,
      color: colors.text,
      fontSize: 11,
    },
    actionButtonTextActive: {
      color: '#FFFFFF',
    },
    generatingIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      marginTop: Spacing.sm,
      paddingTop: Spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    generatingText: {
      ...Typography.caption,
      color: colors.textSecondary,
      fontSize: 11,
    },
    cancelButton: {
      paddingHorizontal: Spacing.sm,
      paddingVertical: 4,
      borderRadius: BorderRadius.sm,
      backgroundColor: '#FF3B30',
    },
    cancelButtonText: {
      ...Typography.caption,
      color: '#FFFFFF',
      fontSize: 11,
      fontWeight: '600',
    },
    contextMenuOverlay: {
      flex: 1,
      backgroundColor: 'transparent',
    },
    contextMenu: {
      position: 'absolute',
      backgroundColor: colors.card,
      borderRadius: BorderRadius.md,
      padding: Spacing.xs,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
      minWidth: 120,
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
      fontSize: 14,
    },
    linkText: {
      color: message.role === 'user' ? '#FFFFFF' : colors.primary,
      textDecorationLine: 'underline',
    },
  });

  return (
    <>
      <Pressable
        onLongPress={handleLongPress}
        style={[
          styles.container,
          message.role === 'user' ? styles.userMessage : styles.assistantMessage,
        ]}
        onLongPress={message.role === 'assistant' ? () => setShowActionsModal(true) : handleLongPress}
      >
        {/* PRODUCTION: Display AI-generated image with download button */}
        {hasGeneratedImage && (
          <TouchableOpacity 
            onPress={() => handleDownloadImage(message.image_url!)}
            activeOpacity={0.8}
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
                <Text style={{ color: '#fff', marginTop: 8, fontSize: 12 }}>Saving...</Text>
              </View>
            ) : (
              <View style={styles.downloadIcon}>
                <Ionicons name="download" size={20} color="#fff" />
              </View>
            )}
          </TouchableOpacity>
        )}
        
        {/* Display file attachment card */}
        {message.file_url && message.file_name && (
          <TouchableOpacity 
            style={styles.fileAttachment}
            onPress={() => handleFileDownload(message.file_name!, '', message.file_type || 'txt')}
          >
            <View style={styles.fileIcon}>
              <Ionicons 
                name={message.file_type === 'csv' ? 'document-text' : 
                      message.file_type === 'html' ? 'code-slash' : 
                      message.file_type === 'json' ? 'code' : 'document'} 
                size={24} 
                color={colors.primary} 
              />
            </View>
            <View style={styles.fileInfo}>
              <Text style={styles.fileName}>{message.file_name}</Text>
              <Text style={styles.fileSize}>{message.file_type?.toUpperCase()} File</Text>
            </View>
            <Ionicons name="download-outline" size={20} color={colors.text} />
          </TouchableOpacity>
        )}
        
        {contentParts.map((part, index) => {
          if (part.type === 'code') {
            return (
              <View key={index} style={{ marginVertical: 0 }}>
                <StreamingCodeBlock
                  code={part.content}
                  language={part.language}
                  streaming={streaming && index === contentParts.length - 1}
                />
              </View>
            );
          }
          
          const textParts = parseTextWithLinks(part.content);
          
          return (
            <Text
              key={index}
              style={[
                styles.messageText,
                message.role === 'user'
                  ? styles.userMessageText
                  : styles.assistantMessageText,
              ]}
            >
              {textParts.map((textPart, textIndex) => {
                if (textPart.type === 'link') {
                  return (
                    <Text
                      key={textIndex}
                      style={styles.linkText}
                      onPress={() => handleLinkPress(textPart.url)}
                    >
                      {textPart.content}
                    </Text>
                  );
                }
                // Use streaming text for AI messages during generation
                if (message.role === 'assistant' && streaming && textIndex === textParts.length - 1) {
                  return (
                    <StreamingText
                      key={textIndex}
                      text={textPart.content}
                      speed={3} // Fast but visible
                      style={styles.assistantMessageText}
                    />
                  );
                }
                return (
                  <Text key={textIndex}>{textPart.content}</Text>
                );
              })}
            </Text>
          );
        })}

        {message.edited && (
          <Text 
            style={[
              styles.editedLabel,
              message.role === 'user' ? styles.editedLabelUser : styles.editedLabelAssistant,
            ]}
          >
            (edited)
          </Text>
        )}

        {message.role === 'assistant' && isGenerating && (
          <View style={styles.generatingIndicator}>
            <Text style={styles.generatingText}>Generating...</Text>
            <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
              <Text style={styles.cancelButtonText}>Stop</Text>
            </TouchableOpacity>
          </View>
        )}

        {message.role === 'assistant' && !isGenerating && (
          <View style={styles.actionsContainer}>
            {detectFileDownload(message.content) && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => {
                  const fileInfo = extractFileInfo(message.content);
                  if (fileInfo) {
                    handleFileDownload(
                      fileInfo.fileName,
                      'File content would be here',
                      fileInfo.type
                    );
                  }
                }}
              >
                <Ionicons name="download-outline" size={14} color={colors.text} />
                <Text style={styles.actionButtonText}>Download</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity
              style={[
                styles.actionButton,
                liked === 'like' && styles.actionButtonActive,
              ]}
              onPress={() => handleLike('like')}
            >
              <Ionicons
                name={liked === 'like' ? 'thumbs-up' : 'thumbs-up-outline'}
                size={14}
                color={liked === 'like' ? '#FFFFFF' : colors.text}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.actionButton,
                liked === 'dislike' && styles.actionButtonActive,
              ]}
              onPress={() => handleLike('dislike')}
            >
              <Ionicons
                name={liked === 'dislike' ? 'thumbs-down' : 'thumbs-down-outline'}
                size={14}
                color={liked === 'dislike' ? '#FFFFFF' : colors.text}
              />
            </TouchableOpacity>
          </View>
        )}
      </Pressable>

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
          <View 
            style={[
              styles.contextMenu,
              { 
                top: menuPosition.y - 100,
                left: Math.min(menuPosition.x, 300),
              }
            ]}
          >
            <TouchableOpacity style={styles.contextMenuItem} onPress={handleCopy}>
              <Ionicons name="copy-outline" size={18} color={colors.text} />
              <Text style={styles.contextMenuText}>Copy</Text>
            </TouchableOpacity>

            {message.role === 'user' && onEdit && (
              <TouchableOpacity style={styles.contextMenuItem} onPress={handleEdit}>
                <Ionicons name="pencil-outline" size={18} color={colors.text} />
                <Text style={styles.contextMenuText}>Edit</Text>
              </TouchableOpacity>
            )}
          </View>
        </Pressable>
      </Modal>

      <LinkSafetyModal
        visible={linkModalVisible}
        url={selectedLink}
        onClose={() => setLinkModalVisible(false)}
        onOpenLink={handleOpenLink}
      />

      <WebViewModal
        visible={webViewVisible}
        url={selectedLink}
        onClose={() => setWebViewVisible(false)}
      />

      <ImageViewerModal
        visible={imageViewerVisible}
        imageUrl={selectedImageUrl}
        onClose={() => setImageViewerVisible(false)}
        onEdit={handleImageEdit}
        title="Image created"
      />

      <ImageEditModal
        visible={imageEditVisible}
        imageUrl={selectedImageUrl}
        onClose={() => setImageEditVisible(false)}
        onApplyEdits={handleApplyImageEdits}
      />

      <FileDownloadModal
        visible={fileModalVisible}
        fileName={fileData.name}
        fileContent={fileData.content}
        fileType={fileData.type}
        onClose={() => setFileModalVisible(false)}
      />

      {/* NEW: Message Actions Modal */}
      {message.role === 'assistant' && (
        <MessageActionsModal
          visible={showActionsModal}
          onClose={() => setShowActionsModal(false)}
          message={message}
          onLike={handleLike}
        />
      )}
    </>
  );
});
