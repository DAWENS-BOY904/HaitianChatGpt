import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable, Image, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../hooks/useTheme';
import { useAuth, useAlert } from '@/template';
import { router } from 'expo-router';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { CodeBlock } from './CodeBlock';
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
    created_at: string;
    edited?: boolean;
    edited_at?: string;
  };
  onCancel?: () => void;
  onEdit?: (messageId: string, content: string) => void;
  isGenerating?: boolean;
}

export function MessageItem({ message, onCancel, onEdit, isGenerating }: MessageItemProps) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [liked, setLiked] = useState<'like' | 'dislike' | null>(null);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [linkModalVisible, setLinkModalVisible] = useState(false);
  const [selectedLink, setSelectedLink] = useState('');
  const [webViewVisible, setWebViewVisible] = useState(false);
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [imageEditVisible, setImageEditVisible] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState('');
  const [fileModalVisible, setFileModalVisible] = useState(false);
  const [fileData, setFileData] = useState({ name: '', content: '', type: '' });
  const supabase = getSupabaseClient();

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

    // Navigate to detail page
    router.push(`/message-detail?messageId=${message.id}`);

    try {
      if (liked === type) {
        // Remove like
        await supabase
          .from('message_likes')
          .delete()
          .eq('message_id', message.id)
          .eq('user_id', user.id);
        setLiked(null);
      } else {
        // Add or update like
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
      // Call edge function to edit image
      const { data, error } = await supabase.functions.invoke('chat', {
        body: {
          editImageUrl: selectedImageUrl,
          editPrompt,
          messages: [],
          conversationId: 'temp',
        },
      });

      if (error) throw error;

      // Update the image with edited version
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

  // Detect "Download file" links
  const detectFileDownload = (content: string) => {
    const downloadRegex = /Download file la|Download file|👉.*?Download.*?↗/i;
    return downloadRegex.test(content);
  };

  // Extract file info from message
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

  // Detect URLs in text
  const urlRegex = /(https?:\/\/[^\s]+)/g;

  // Parse text with clickable links
  const parseTextWithLinks = (text: string) => {
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = urlRegex.exec(text)) !== null) {
      // Add text before link
      if (match.index > lastIndex) {
        parts.push({
          type: 'text',
          content: text.substring(lastIndex, match.index),
        });
      }

      // Add link
      parts.push({
        type: 'link',
        content: match[0],
        url: match[0],
      });

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push({
        type: 'text',
        content: text.substring(lastIndex),
      });
    }

    return parts.length > 0 ? parts : [{ type: 'text', content: text }];
  };

  // Parse code blocks from content
  const parseCodeBlocks = (content: string) => {
    const parts = [];
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      // Add text before code block
      if (match.index > lastIndex) {
        parts.push({
          type: 'text',
          content: content.substring(lastIndex, match.index),
        });
      }

      // Add code block
      parts.push({
        type: 'code',
        language: match[1] || 'code',
        content: match[2].trim(),
      });

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < content.length) {
      parts.push({
        type: 'text',
        content: content.substring(lastIndex),
      });
    }

    return parts.length > 0 ? parts : [{ type: 'text', content }];
  };

  const contentParts = parseCodeBlocks(message.content);

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
      >
        {message.image_url && (
          <TouchableOpacity onPress={() => handleImagePress(message.image_url!)}>
            <Image source={{ uri: message.image_url }} style={styles.messageImage} />
          </TouchableOpacity>
        )}
        
        {contentParts.map((part, index) => {
          if (part.type === 'code') {
            return (
              <View key={index} style={{ marginVertical: 0 }}>
                <CodeBlock
                  code={part.content}
                  language={part.language}
                />
              </View>
            );
          }
          
          // Parse text for links
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
                    // In real implementation, we'd have the file content stored
                    // For now, show a placeholder
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

      {/* Link Safety Modal */}
      <LinkSafetyModal
        visible={linkModalVisible}
        url={selectedLink}
        onClose={() => setLinkModalVisible(false)}
        onOpenLink={handleOpenLink}
      />

      {/* WebView Modal */}
      <WebViewModal
        visible={webViewVisible}
        url={selectedLink}
        onClose={() => setWebViewVisible(false)}
      />

      {/* Image Viewer Modal */}
      <ImageViewerModal
        visible={imageViewerVisible}
        imageUrl={selectedImageUrl}
        onClose={() => setImageViewerVisible(false)}
        onEdit={handleImageEdit}
        title="Image created"
      />

      {/* Image Edit Modal */}
      <ImageEditModal
        visible={imageEditVisible}
        imageUrl={selectedImageUrl}
        onClose={() => setImageEditVisible(false)}
        onApplyEdits={handleApplyImageEdits}
      />

      {/* File Download Modal */}
      <FileDownloadModal
        visible={fileModalVisible}
        fileName={fileData.name}
        fileContent={fileData.content}
        fileType={fileData.type}
        onClose={() => setFileModalVisible(false)}
      />
    </>
  );
}
