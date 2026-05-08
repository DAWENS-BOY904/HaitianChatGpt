import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../hooks/useTheme';
import { useAuth, useAlert } from '@/template';
import { router } from 'expo-router';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { CodeBlock } from './CodeBlock';
import { getSupabaseClient } from '@/template';

interface MessageItemProps {
  message: {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    image_url?: string;
    created_at: string;
  };
  onCancel?: () => void;
  isGenerating?: boolean;
}

export function MessageItem({ message, onCancel, isGenerating }: MessageItemProps) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const [showActions, setShowActions] = useState(false);
  const [liked, setLiked] = useState<'like' | 'dislike' | null>(null);
  const supabase = getSupabaseClient();

  const handleCopy = async () => {
    await Clipboard.setStringAsync(message.content);
    showAlert('Copied!', 'Message copied to clipboard');
    setShowActions(false);
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
    setShowActions(false);
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
      marginVertical: Spacing.xs,
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
  });

  return (
    <Pressable
      onLongPress={() => message.role === 'assistant' && setShowActions(!showActions)}
      style={[
        styles.container,
        message.role === 'user' ? styles.userMessage : styles.assistantMessage,
      ]}
    >
      {message.image_url && (
        <Image source={{ uri: message.image_url }} style={styles.messageImage} />
      )}
      
      {contentParts.map((part, index) => {
        if (part.type === 'code') {
          return (
            <CodeBlock
              key={index}
              code={part.content}
              language={part.language}
            />
          );
        }
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
            {part.content}
          </Text>
        );
      })}

      {message.role === 'assistant' && isGenerating && (
        <View style={styles.generatingIndicator}>
          <Text style={styles.generatingText}>Generating...</Text>
          <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      {message.role === 'assistant' && showActions && !isGenerating && (
        <View style={styles.actionsContainer}>
          <TouchableOpacity style={styles.actionButton} onPress={handleCopy}>
            <Ionicons name="copy-outline" size={14} color={colors.text} />
            <Text style={styles.actionButtonText}>Copy</Text>
          </TouchableOpacity>

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
            <Text
              style={[
                styles.actionButtonText,
                liked === 'like' && styles.actionButtonTextActive,
              ]}
            >
              Like
            </Text>
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
            <Text
              style={[
                styles.actionButtonText,
                liked === 'dislike' && styles.actionButtonTextActive,
              ]}
            >
              Dislike
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </Pressable>
  );
}
