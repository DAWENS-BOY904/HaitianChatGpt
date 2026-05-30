import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Platform, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

interface GroupChatActionsMenuProps {
  visible: boolean;
  onClose: () => void;
  onPeople: () => void;
  onAddPeople: () => void;
  onManageLink: () => void;
  onRenameGroup: () => void;
  onCustomize: () => void;
  onMute: () => void;
  onReport: () => void;
  onDeleteGroup: () => void;
  isDark: boolean;
  isMuted?: boolean;
}

export function GroupChatActionsMenu({
  visible, onClose, onPeople, onAddPeople, onManageLink, onRenameGroup,
  onCustomize, onMute, onReport, onDeleteGroup, isDark, isMuted,
}: GroupChatActionsMenuProps) {
  const textC = isDark ? '#FFF' : '#000';
  const subC = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)';

  const items = [
    { sub: true, label: 'New group chat' },
    { icon: 'people-outline', label: 'People', onPress: () => { onClose(); onPeople(); } },
    { icon: 'person-add-outline', label: 'Add people', onPress: () => { onClose(); onAddPeople(); } },
    { icon: 'link-outline', label: 'Manage group link', onPress: () => { onClose(); onManageLink(); } },
    { icon: 'pencil-outline', label: 'Rename group', onPress: () => { onClose(); onRenameGroup(); } },
    { icon: 'settings-outline', label: 'Customize Dawinix', onPress: () => { onClose(); onCustomize(); } },
    { 
      icon: isMuted ? 'notifications-outline' : 'notifications-off-outline', 
      label: isMuted ? 'Unmute notifications' : 'Mute notifications', 
      onPress: () => { onClose(); onMute(); } 
    },
    { icon: 'flag-outline', label: 'Report', onPress: () => { onClose(); onReport(); }, destructive: true },
    { icon: 'exit-outline', label: 'Leave group chat', onPress: () => { onClose(); onDeleteGroup(); }, destructive: true },
  ];

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Backdrop Blur */}
        {Platform.OS === 'ios' ? (
          <BlurView
            intensity={isDark ? 45 : 35}
            tint={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
        ) : (
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: isDark ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.35)' }
            ]}
          />
        )}
      </Pressable>

      {/* Menu Container */}
      <View style={styles.menuContainer}>
        {Platform.OS === 'ios' ? (
          <BlurView
            intensity={isDark ? 92 : 88}
            tint={isDark ? 'dark' : 'extraLight'}
            style={styles.blurWrap}
          >
            {items.map((item: any, i) => (
              item.sub ? (
                <Text
                  key={`sub-${i}`}
                  style={styles.sectionHeader}
                >
                  {item.label}
                </Text>
              ) : (
                <TouchableOpacity
                  key={item.label}
                  style={styles.menuItem}
                  onPress={item.onPress}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={item.icon}
                    size={20}
                    color={item.destructive ? '#FF453A' : textC}
                  />
                  <Text
                    style={[
                      styles.menuLabel,
                      { color: item.destructive ? '#FF453A' : textC }
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              )
            ))}
          </BlurView>
        ) : (
          /* Android Fallback */
          <View style={[styles.blurWrap, { backgroundColor: isDark ? 'rgba(40,40,44,0.98)' : 'rgba(255,255,255,0.97)' }]}>
            {items.map((item: any, i) => (
              item.sub ? (
                <Text key={`sub-${i}`} style={styles.sectionHeader}>
                  {item.label}
                </Text>
              ) : (
                <TouchableOpacity
                  key={item.label}
                  style={styles.menuItem}
                  onPress={item.onPress}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={item.icon}
                    size={20}
                    color={item.destructive ? '#FF453A' : textC}
                  />
                  <Text
                    style={[
                      styles.menuLabel,
                      { color: item.destructive ? '#FF453A' : textC }
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              )
            ))}
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
  },
  menuContainer: {
    position: 'absolute',
    top: 80,
    right: 16,
    width: 250,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 22,
    elevation: 20,
  },
  blurWrap: {
    borderRadius: 18,
    overflow: 'hidden',
    paddingVertical: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  sectionHeader: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  menuLabel: {
    fontSize: 16,
    fontWeight: '400',
  },
});
