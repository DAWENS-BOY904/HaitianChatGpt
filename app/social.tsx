import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Platform, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useSocial } from '../hooks/useSocial';
import { useRouter } from 'expo-router';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SocialScreen() {
  const { colors } = useTheme();
  const { friends, friendRequests, groups, loading, searchUsers, sendFriendRequest, acceptFriendRequest, rejectFriendRequest, createGroup, generateGroupInvite, joinGroupByCode } = useSocial();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<'friends' | 'requests' | 'groups'>('friends');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [showJoinGroup, setShowJoinGroup] = useState(false);
  const [inviteCode, setInviteCode] = useState('');

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    const results = await searchUsers(searchQuery);
    setSearchResults(results);
    setSearching(false);
  };

  const handleSendRequest = async (userId: string) => {
    await sendFriendRequest(userId);
    setSearchResults([]);
    setSearchQuery('');
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) return;
    const { error, groupId } = await createGroup(groupName);
    if (!error && groupId) {
      setShowCreateGroup(false);
      setGroupName('');
    }
  };

  const handleGenerateInvite = async (groupId: string) => {
    const { inviteCode } = await generateGroupInvite(groupId);
    if (inviteCode) {
      alert(`Invite code: ${inviteCode}\nShare this code with others to invite them.`);
    }
  };

  const handleJoinGroup = async () => {
    if (!inviteCode.trim()) return;
    const { error } = await joinGroupByCode(inviteCode);
    if (!error) {
      setShowJoinGroup(false);
      setInviteCode('');
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
      marginRight: Spacing.sm,
    },
    headerTitle: {
      ...Typography.heading,
      color: colors.text,
      flex: 1,
    },
    tabs: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    tab: {
      flex: 1,
      padding: Spacing.md,
      alignItems: 'center',
    },
    activeTab: {
      borderBottomWidth: 2,
      borderBottomColor: colors.primary,
    },
    tabText: {
      ...Typography.body,
      color: colors.textSecondary,
    },
    activeTabText: {
      color: colors.primary,
      fontWeight: '600',
    },
    searchContainer: {
      padding: Spacing.md,
      backgroundColor: colors.surface,
    },
    searchBar: {
      flexDirection: 'row',
      backgroundColor: colors.inputBackground,
      borderRadius: BorderRadius.sm,
      padding: Spacing.sm,
      alignItems: 'center',
      gap: Spacing.sm,
    },
    searchInput: {
      flex: 1,
      ...Typography.body,
      color: colors.text,
    },
    content: {
      flex: 1,
    },
    listItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
      gap: Spacing.md,
    },
    avatar: {
      width: 48,
      height: 48,
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
    itemInfo: {
      flex: 1,
    },
    itemName: {
      ...Typography.body,
      color: colors.text,
      fontWeight: '600',
    },
    itemEmail: {
      ...Typography.caption,
      color: colors.textSecondary,
      marginTop: 2,
    },
    button: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.xs,
      borderRadius: BorderRadius.sm,
      backgroundColor: colors.primary,
    },
    buttonText: {
      ...Typography.caption,
      color: '#FFFFFF',
      fontWeight: '600',
    },
    outlineButton: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.border,
    },
    outlineButtonText: {
      color: colors.text,
    },
    requestActions: {
      flexDirection: 'row',
      gap: Spacing.sm,
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
      marginTop: Spacing.md,
    },
    fab: {
      position: 'absolute',
      right: Spacing.md,
      bottom: Platform.select({ ios: insets.bottom + Spacing.md, android: insets.bottom + Spacing.md, default: Spacing.md }),
      width: 56,
      height: 56,
      borderRadius: BorderRadius.full,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
    },
    modal: {
      padding: Spacing.md,
      backgroundColor: colors.surface,
      margin: Spacing.md,
      borderRadius: BorderRadius.md,
    },
    modalTitle: {
      ...Typography.heading,
      color: colors.text,
      marginBottom: Spacing.md,
    },
    input: {
      backgroundColor: colors.inputBackground,
      borderRadius: BorderRadius.sm,
      padding: Spacing.md,
      ...Typography.body,
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: Spacing.md,
    },
    modalActions: {
      flexDirection: 'row',
      gap: Spacing.sm,
      justifyContent: 'flex-end',
    },
  });

  const renderFriends = () => (
    <>
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search users..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
          />
          {searching && <ActivityIndicator size="small" color={colors.primary} />}
        </View>
      </View>

      <ScrollView style={styles.content}>
        {searchResults.length > 0 ? (
          searchResults.map(user => (
            <View key={user.id} style={styles.listItem}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{user.username?.[0]?.toUpperCase() || 'U'}</Text>
              </View>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{user.username || 'User'}</Text>
                <Text style={styles.itemEmail}>{user.email}</Text>
              </View>
              <TouchableOpacity style={styles.button} onPress={() => handleSendRequest(user.id)}>
                <Text style={styles.buttonText}>Add</Text>
              </TouchableOpacity>
            </View>
          ))
        ) : friends.length > 0 ? (
          friends.map(friend => (
            <TouchableOpacity 
              key={friend.id} 
              style={styles.listItem}
              onPress={() => router.push(`/chat?id=${friend.id}&type=user`)}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{friend.username?.[0]?.toUpperCase() || 'U'}</Text>
              </View>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{friend.username || 'User'}</Text>
                <Text style={styles.itemEmail}>{friend.email}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={64} color={colors.textSecondary} />
            <Text style={styles.emptyText}>No friends yet. Search for users to add them!</Text>
          </View>
        )}
      </ScrollView>
    </>
  );

  const renderRequests = () => (
    <ScrollView style={styles.content}>
      {friendRequests.length > 0 ? (
        friendRequests.map(request => {
          const isReceived = request.receiver.id !== request.sender.id;
          const displayUser = isReceived ? request.sender : request.receiver;
          
          return (
            <View key={request.id} style={styles.listItem}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{displayUser.username?.[0]?.toUpperCase() || 'U'}</Text>
              </View>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{displayUser.username || 'User'}</Text>
                <Text style={styles.itemEmail}>
                  {isReceived ? 'Wants to connect' : 'Request sent'}
                </Text>
              </View>
              {isReceived ? (
                <View style={styles.requestActions}>
                  <TouchableOpacity style={styles.button} onPress={() => acceptFriendRequest(request.id)}>
                    <Text style={styles.buttonText}>Accept</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.button, styles.outlineButton]} onPress={() => rejectFriendRequest(request.id)}>
                    <Text style={[styles.buttonText, styles.outlineButtonText]}>Reject</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={[styles.button, styles.outlineButton]} onPress={() => rejectFriendRequest(request.id)}>
                  <Text style={[styles.buttonText, styles.outlineButtonText]}>Cancel</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="mail-outline" size={64} color={colors.textSecondary} />
          <Text style={styles.emptyText}>No friend requests</Text>
        </View>
      )}
    </ScrollView>
  );

  const renderGroups = () => (
    <>
      <ScrollView style={styles.content}>
        {groups.length > 0 ? (
          groups.map(group => (
            <TouchableOpacity 
              key={group.id} 
              style={styles.listItem}
              onPress={() => router.push(`/chat?id=${group.id}&type=group`)}
            >
              <View style={styles.avatar}>
                <Ionicons name="people" size={24} color="#FFFFFF" />
              </View>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{group.name}</Text>
                <Text style={styles.itemEmail}>Group chat</Text>
              </View>
              <TouchableOpacity onPress={() => handleGenerateInvite(group.id)}>
                <Ionicons name="share-outline" size={20} color={colors.primary} />
              </TouchableOpacity>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={64} color={colors.textSecondary} />
            <Text style={styles.emptyText}>No groups yet. Create one to get started!</Text>
          </View>
        )}
      </ScrollView>

      <TouchableOpacity style={[styles.fab, { bottom: Platform.select({ ios: insets.bottom + 80, android: insets.bottom + 80, default: 80 }) }]} onPress={() => setShowCreateGroup(true)}>
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.fab} onPress={() => setShowJoinGroup(true)}>
        <Ionicons name="enter-outline" size={28} color="#FFFFFF" />
      </TouchableOpacity>

      {showCreateGroup && (
        <View style={styles.modal}>
          <Text style={styles.modalTitle}>Create Group</Text>
          <TextInput
            style={styles.input}
            placeholder="Group name"
            placeholderTextColor={colors.textSecondary}
            value={groupName}
            onChangeText={setGroupName}
          />
          <View style={styles.modalActions}>
            <TouchableOpacity style={[styles.button, styles.outlineButton]} onPress={() => setShowCreateGroup(false)}>
              <Text style={[styles.buttonText, styles.outlineButtonText]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={handleCreateGroup}>
              <Text style={styles.buttonText}>Create</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {showJoinGroup && (
        <View style={styles.modal}>
          <Text style={styles.modalTitle}>Join Group</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter invite code"
            placeholderTextColor={colors.textSecondary}
            value={inviteCode}
            onChangeText={setInviteCode}
            autoCapitalize="characters"
          />
          <View style={styles.modalActions}>
            <TouchableOpacity style={[styles.button, styles.outlineButton]} onPress={() => setShowJoinGroup(false)}>
              <Text style={[styles.buttonText, styles.outlineButtonText]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={handleJoinGroup}>
              <Text style={styles.buttonText}>Join</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Social</Text>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'friends' && styles.activeTab]}
          onPress={() => setActiveTab('friends')}
        >
          <Text style={[styles.tabText, activeTab === 'friends' && styles.activeTabText]}>
            Friends ({friends.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'requests' && styles.activeTab]}
          onPress={() => setActiveTab('requests')}
        >
          <Text style={[styles.tabText, activeTab === 'requests' && styles.activeTabText]}>
            Requests ({friendRequests.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'groups' && styles.activeTab]}
          onPress={() => setActiveTab('groups')}
        >
          <Text style={[styles.tabText, activeTab === 'groups' && styles.activeTabText]}>
            Groups ({groups.length})
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <>
          {activeTab === 'friends' && renderFriends()}
          {activeTab === 'requests' && renderRequests()}
          {activeTab === 'groups' && renderGroups()}
        </>
      )}
    </View>
  );
}
