import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, TextInput, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useConversation } from '../hooks/useConversation';
import { useAuth } from '@/template';
import { useRouter } from 'expo-router';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface MenuModalProps {
  visible: boolean;
  onClose: () => void;
}

export function MenuModal({ visible, onClose }: MenuModalProps) {
  const { colors } = useTheme();
  const { conversations, selectConversation, searchConversations, createConversation, deleteConversation } = useConversation();
  const { user, logout } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'ChatGPT' | 'Library' | 'GPTs'>('ChatGPT');
  const [contextMenuVisible, setContextMenuVisible] = useState(false);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);

  const filteredConversations = searchConversations(searchQuery);

  const handleSelectConversation = async (id: string) => {
    await selectConversation(id);
    onClose();
  };

  const handleLongPress = (id: string) => {
    setSelectedConversationId(id);
    setContextMenuVisible(true);
  };

  const handleRename = () => {
    setContextMenuVisible(false);
    // Will implement rename functionality
  };

  const handleShare = () => {
    setContextMenuVisible(false);
    // Will implement share functionality
  };

  const handleArchive = () => {
    setContextMenuVisible(false);
    // Will implement archive functionality
  };

  const handleDelete = async () => {
    if (selectedConversationId) {
      await deleteConversation(selectedConversationId);
      setContextMenuVisible(false);
      setSelectedConversationId(null);
    }
  };

  const handleNewChat = async () => {
    await createConversation();
    onClose();
  };

  const handleSettings = () => {
    onClose();
    router.push('/settings');
  };

  const handleLogout = async () => {
    await logout();
    onClose();
  };

  const styles = StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: colors.overlay,
    },
    container: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: '80%',
      backgroundColor: colors.background,
      paddingTop: Platform.select({ ios: insets.top, android: insets.top, default: 0 }),
    },
    header: {
      padding: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.inputBackground,
      borderRadius: BorderRadius.sm,
      padding: Spacing.sm,
      marginBottom: Spacing.md,
    },
    searchInput: {
      flex: 1,
      ...Typography.body,
      color: colors.text,
      marginLeft: Spacing.sm,
    },
    tabContainer: {
      flexDirection: 'row',
      gap: Spacing.md,
    },
    tab: {
      paddingVertical: Spacing.xs,
      paddingHorizontal: Spacing.sm,
    },
    tabActive: {
      borderBottomWidth: 2,
      borderBottomColor: colors.primary,
    },
    tabText: {
      ...Typography.body,
      color: colors.textSecondary,
    },
    tabTextActive: {
      color: colors.text,
      fontWeight: '600',
    },
    content: {
      flex: 1,
    },
    conversationItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    conversationText: {
      flex: 1,
      ...Typography.body,
      color: colors.text,
    },
    deleteButton: {
      padding: Spacing.xs,
    },
    newChatButton: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: Spacing.md,
      backgroundColor: colors.surface,
      margin: Spacing.md,
      borderRadius: BorderRadius.sm,
      gap: Spacing.sm,
    },
    newChatText: {
      ...Typography.body,
      color: colors.primary,
      fontWeight: '600',
    },
    footer: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      padding: Spacing.md,
      paddingBottom: Platform.select({ ios: insets.bottom + Spacing.md, android: insets.bottom + Spacing.md, default: Spacing.md }),
    },
    userContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      marginBottom: Spacing.md,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: BorderRadius.full,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      ...Typography.body,
      color: '#FFFFFF',
      fontWeight: '600',
    },
    userName: {
      ...Typography.body,
      color: colors.text,
      fontWeight: '600',
    },
    userEmail: {
      ...Typography.caption,
      color: colors.textSecondary,
    },
    menuButton: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: Spacing.sm,
      gap: Spacing.sm,
    },
    menuButtonText: {
      ...Typography.body,
      color: colors.text,
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
    contextMenuContainer: {
      backgroundColor: colors.background,
      borderRadius: BorderRadius.lg,
      padding: Spacing.sm,
      minWidth: 200,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    contextMenuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.lg,
      borderRadius: BorderRadius.sm,
    },
    contextMenuText: {
      ...Typography.body,
      color: colors.text,
      fontSize: 16,
    },
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.container} onStartShouldSetResponder={() => true}>
          <View style={styles.header}>
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={20} color={colors.textSecondary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search"
                placeholderTextColor={colors.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            <View style={styles.tabContainer}>
              {(['ChatGPT', 'Library', 'GPTs'] as const).map(tab => (
                <TouchableOpacity
                  key={tab}
                  style={[styles.tab, activeTab === tab && styles.tabActive]}
                  onPress={() => {
                    if (tab === 'GPTs') {
                      onClose();
                      router.push('/gpts');
                    } else {
                      setActiveTab(tab);
                    }
                  }}
                >
                  <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                    {tab}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <ScrollView style={styles.content}>
            <TouchableOpacity style={styles.newChatButton} onPress={handleNewChat}>
              <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
              <Text style={styles.newChatText}>New Chat</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.newChatButton} 
              onPress={() => {
                onClose();
                router.push('/new-project');
              }}
            >
              <Ionicons name="folder-outline" size={24} color={colors.primary} />
              <Text style={styles.newChatText}>New Project</Text>
            </TouchableOpacity>

            {filteredConversations.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>
                  {searchQuery ? 'No conversations found' : 'No conversations yet'}
                </Text>
              </View>
            ) : (
              filteredConversations.map(conv => (
                <TouchableOpacity
                  key={conv.id}
                  style={styles.conversationItem}
                  onPress={() => handleSelectConversation(conv.id)}
                  onLongPress={() => handleLongPress(conv.id)}
                >
                  <Text style={styles.conversationText} numberOfLines={1}>
                    {conv.title}
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.userContainer} onPress={handleSettings}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {user?.email?.[0].toUpperCase() || 'U'}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.userName}>{user?.username || 'User'}</Text>
                <Text style={styles.userEmail} numberOfLines={1}>{user?.email}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuButton} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={20} color={colors.danger} />
              <Text style={[styles.menuButtonText, { color: colors.danger }]}>Logout</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>

      {/* Context Menu Modal */}
      <Modal
        visible={contextMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setContextMenuVisible(false)}
      >
        <TouchableOpacity 
          style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', alignItems: 'center' }}
          activeOpacity={1}
          onPress={() => setContextMenuVisible(false)}
        >
          <View style={styles.contextMenuContainer} onStartShouldSetResponder={() => true}>
            <TouchableOpacity style={styles.contextMenuItem} onPress={handleShare}>
              <Ionicons name="share-outline" size={20} color={colors.text} />
              <Text style={styles.contextMenuText}>Share chat</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.contextMenuItem} onPress={handleRename}>
              <Ionicons name="pencil-outline" size={20} color={colors.text} />
              <Text style={styles.contextMenuText}>Rename</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.contextMenuItem} onPress={handleArchive}>
              <Ionicons name="archive-outline" size={20} color={colors.text} />
              <Text style={styles.contextMenuText}>Archive</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.contextMenuItem} onPress={handleDelete}>
              <Ionicons name="trash-outline" size={20} color={colors.danger} />
              <Text style={[styles.contextMenuText, { color: colors.danger }]}>Delete</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </Modal>
  );
}
