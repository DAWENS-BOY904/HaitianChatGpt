import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { getSupabaseClient } from '@/template';
import { useAlert } from '@/template';
import { router } from 'expo-router';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AdminContentScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();
  const [loading, setLoading] = useState(false);
  const [contentList, setContentList] = useState<any[]>([]);
  const [selectedType, setSelectedType] = useState<'terms_of_use' | 'privacy_policy' | 'faq' | 'help_article'>('terms_of_use');
  const [editingContent, setEditingContent] = useState<any>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('');
  const supabase = getSupabaseClient();

  useEffect(() => {
    loadContent();
  }, [selectedType]);

  const loadContent = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('app_content')
        .select('*')
        .eq('content_type', selectedType)
        .order('display_order', { ascending: true });

      setContentList(data || []);
    } catch (error) {
      console.error('Content load error:', error);
    }
    setLoading(false);
  };

  const handleSaveContent = async () => {
    if (!title.trim() || !content.trim()) {
      showAlert('Error', 'Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');

      if (editingContent) {
        // Update existing content
        const { error } = await supabase
          .from('app_content')
          .update({
            title,
            content,
            category,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingContent.id);

        if (error) throw error;
        showAlert('Success', 'Content updated successfully');
      } else {
        // Create new content
        const { error } = await supabase
          .from('app_content')
          .insert({
            content_type: selectedType,
            title,
            content,
            slug,
            category,
            display_order: contentList.length,
          });

        if (error) throw error;
        showAlert('Success', 'Content created successfully');
      }

      setShowEditor(false);
      setTitle('');
      setContent('');
      setCategory('');
      setEditingContent(null);
      await loadContent();
    } catch (error: any) {
      showAlert('Error', error.message || 'Failed to save content');
    }
    setLoading(false);
  };

  const handleEditContent = (item: any) => {
    setEditingContent(item);
    setTitle(item.title);
    setContent(item.content);
    setCategory(item.category || '');
    setShowEditor(true);
  };

  const handleDeleteContent = async (id: string) => {
    showAlert('Confirm Delete', 'Are you sure you want to delete this content?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const { error } = await supabase
              .from('app_content')
              .delete()
              .eq('id', id);

            if (error) throw error;
            await loadContent();
            showAlert('Success', 'Content deleted successfully');
          } catch (error: any) {
            showAlert('Error', error.message || 'Failed to delete content');
          }
        },
      },
    ]);
  };

  const getContentTypeLabel = (type: string) => {
    switch (type) {
      case 'terms_of_use':
        return 'Terms of Use';
      case 'privacy_policy':
        return 'Privacy Policy';
      case 'faq':
        return 'FAQ';
      case 'help_article':
        return 'Help Article';
      default:
        return type;
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingTop: Platform.select({ ios: insets.top, android: insets.top, default: 0 }),
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: {
      padding: Spacing.xs,
    },
    headerTitle: {
      ...Typography.heading,
      color: colors.text,
      marginLeft: Spacing.sm,
      flex: 1,
    },
    content: {
      flex: 1,
    },
    typeSelector: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.xs,
      padding: Spacing.md,
    },
    typeButton: {
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
      borderRadius: BorderRadius.sm,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    typeButtonActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    typeButtonText: {
      ...Typography.body,
      color: colors.text,
      fontSize: 14,
    },
    typeButtonTextActive: {
      color: '#FFFFFF',
      fontWeight: '600',
    },
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.xs,
      margin: Spacing.md,
      padding: Spacing.md,
      backgroundColor: colors.primary,
      borderRadius: BorderRadius.sm,
    },
    addButtonText: {
      ...Typography.body,
      color: '#FFFFFF',
      fontWeight: '600',
    },
    contentItem: {
      padding: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    contentTitle: {
      ...Typography.body,
      color: colors.text,
      fontWeight: '600',
      marginBottom: Spacing.xs,
    },
    contentPreview: {
      ...Typography.caption,
      color: colors.textSecondary,
      marginBottom: Spacing.sm,
    },
    contentActions: {
      flexDirection: 'row',
      gap: Spacing.md,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    actionButtonText: {
      ...Typography.caption,
      color: colors.primary,
      fontSize: 14,
    },
    deleteButtonText: {
      color: colors.danger,
    },
    editorContainer: {
      flex: 1,
      padding: Spacing.md,
    },
    label: {
      ...Typography.body,
      color: colors.text,
      marginBottom: Spacing.xs,
      fontWeight: '600',
    },
    input: {
      backgroundColor: colors.inputBackground,
      borderRadius: BorderRadius.sm,
      padding: Spacing.md,
      ...Typography.body,
      color: colors.text,
      marginBottom: Spacing.md,
    },
    textArea: {
      minHeight: 200,
      textAlignVertical: 'top',
    },
    buttonContainer: {
      flexDirection: 'row',
      gap: Spacing.md,
    },
    button: {
      flex: 1,
      backgroundColor: colors.primary,
      borderRadius: BorderRadius.sm,
      paddingVertical: Spacing.md,
      alignItems: 'center',
    },
    buttonText: {
      ...Typography.body,
      color: '#FFFFFF',
      fontWeight: '600',
    },
    secondaryButton: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: BorderRadius.sm,
      paddingVertical: Spacing.md,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    secondaryButtonText: {
      ...Typography.body,
      color: colors.text,
      fontWeight: '600',
    },
    emptyState: {
      padding: Spacing.xl,
      alignItems: 'center',
    },
    emptyText: {
      ...Typography.body,
      color: colors.textSecondary,
      textAlign: 'center',
    },
  });

  if (showEditor) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => setShowEditor(false)}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {editingContent ? 'Edit Content' : 'Create Content'}
          </Text>
        </View>

        <ScrollView style={styles.editorContainer}>
          <Text style={styles.label}>Title</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter title"
            placeholderTextColor={colors.textSecondary}
            value={title}
            onChangeText={setTitle}
          />

          {(selectedType === 'faq' || selectedType === 'help_article') && (
            <>
              <Text style={styles.label}>Category (Optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Account, Billing, Features"
                placeholderTextColor={colors.textSecondary}
                value={category}
                onChangeText={setCategory}
              />
            </>
          )}

          <Text style={styles.label}>Content</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Enter content (supports plain text)"
            placeholderTextColor={colors.textSecondary}
            value={content}
            onChangeText={setContent}
            multiline
            numberOfLines={10}
          />

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.button}
              onPress={handleSaveContent}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>
                  {editingContent ? 'Update' : 'Create'}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => {
                setShowEditor(false);
                setTitle('');
                setContent('');
                setCategory('');
                setEditingContent(null);
              }}
            >
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Content Management</Text>
      </View>

      <View style={styles.typeSelector}>
        {(['terms_of_use', 'privacy_policy', 'faq', 'help_article'] as const).map(type => (
          <TouchableOpacity
            key={type}
            style={[
              styles.typeButton,
              selectedType === type && styles.typeButtonActive,
            ]}
            onPress={() => setSelectedType(type)}
          >
            <Text
              style={[
                styles.typeButtonText,
                selectedType === type && styles.typeButtonTextActive,
              ]}
            >
              {getContentTypeLabel(type)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={styles.addButton}
        onPress={() => setShowEditor(true)}
      >
        <Ionicons name="add-circle" size={20} color="#FFFFFF" />
        <Text style={styles.addButtonText}>Add {getContentTypeLabel(selectedType)}</Text>
      </TouchableOpacity>

      <ScrollView style={styles.content}>
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: Spacing.xl }} />
        ) : contentList.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              No {getContentTypeLabel(selectedType)} content yet
            </Text>
          </View>
        ) : (
          contentList.map(item => (
            <View key={item.id} style={styles.contentItem}>
              <Text style={styles.contentTitle}>{item.title}</Text>
              {item.category && (
                <Text style={styles.contentPreview}>Category: {item.category}</Text>
              )}
              <Text style={styles.contentPreview} numberOfLines={2}>
                {item.content}
              </Text>
              <View style={styles.contentActions}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleEditContent(item)}
                >
                  <Ionicons name="pencil" size={16} color={colors.primary} />
                  <Text style={styles.actionButtonText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleDeleteContent(item.id)}
                >
                  <Ionicons name="trash" size={16} color={colors.danger} />
                  <Text style={[styles.actionButtonText, styles.deleteButtonText]}>
                    Delete
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}
