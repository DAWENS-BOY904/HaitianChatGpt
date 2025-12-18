import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { getSupabaseClient } from '@/template';
import { router, useLocalSearchParams } from 'expo-router';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ContentViewerScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const { type, slug } = params;
  const [loading, setLoading] = useState(true);
  const [contentList, setContentList] = useState<any[]>([]);
  const [selectedContent, setSelectedContent] = useState<any>(null);
  const supabase = getSupabaseClient();

  useEffect(() => {
    loadContent();
  }, [type, slug]);

  const loadContent = async () => {
    setLoading(true);
    try {
      if (slug) {
        // Load specific content by slug
        const { data } = await supabase
          .from('app_content')
          .select('*')
          .eq('slug', slug)
          .eq('is_published', true)
          .single();

        setSelectedContent(data);
      } else {
        // Load all content of type
        const { data } = await supabase
          .from('app_content')
          .select('*')
          .eq('content_type', type)
          .eq('is_published', true)
          .order('display_order', { ascending: true });

        setContentList(data || []);
        
        // Auto-select first item if available
        if (data && data.length > 0 && !selectedContent) {
          setSelectedContent(data[0]);
        }
      }
    } catch (error) {
      console.error('Content load error:', error);
    }
    setLoading(false);
  };

  const getTitle = () => {
    if (type === 'terms_of_use') return 'Terms of Use';
    if (type === 'privacy_policy') return 'Privacy Policy';
    if (type === 'faq') return 'FAQ';
    if (type === 'help_article') return 'Help Center';
    return 'Content';
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
    sidebar: {
      width: '100%',
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      maxHeight: 200,
    },
    sidebarItem: {
      padding: Spacing.md,
      borderLeftWidth: 3,
      borderLeftColor: 'transparent',
    },
    sidebarItemActive: {
      backgroundColor: `${colors.primary}10`,
      borderLeftColor: colors.primary,
    },
    sidebarItemTitle: {
      ...Typography.body,
      color: colors.text,
      fontWeight: '500',
    },
    sidebarItemTitleActive: {
      color: colors.primary,
      fontWeight: '600',
    },
    sidebarItemCategory: {
      ...Typography.caption,
      color: colors.textSecondary,
      marginTop: 2,
    },
    contentContainer: {
      flex: 1,
      padding: Spacing.md,
    },
    contentTitle: {
      ...Typography.heading,
      fontSize: 24,
      color: colors.text,
      marginBottom: Spacing.md,
    },
    contentBody: {
      ...Typography.body,
      color: colors.text,
      lineHeight: 24,
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: Spacing.xl,
    },
    emptyText: {
      ...Typography.body,
      color: colors.textSecondary,
      textAlign: 'center',
    },
  });

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{getTitle()}</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{getTitle()}</Text>
      </View>

      <View style={styles.content}>
        {/* Sidebar for multiple items */}
        {contentList.length > 1 && (
          <ScrollView style={styles.sidebar} horizontal>
            {contentList.map(item => (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.sidebarItem,
                  selectedContent?.id === item.id && styles.sidebarItemActive,
                ]}
                onPress={() => setSelectedContent(item)}
              >
                <Text
                  style={[
                    styles.sidebarItemTitle,
                    selectedContent?.id === item.id && styles.sidebarItemTitleActive,
                  ]}
                >
                  {item.title}
                </Text>
                {item.category && (
                  <Text style={styles.sidebarItemCategory}>{item.category}</Text>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Content display */}
        <ScrollView style={styles.contentContainer}>
          {selectedContent ? (
            <>
              <Text style={styles.contentTitle}>{selectedContent.title}</Text>
              <Text style={styles.contentBody}>{selectedContent.content}</Text>
            </>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No content available</Text>
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );
}
