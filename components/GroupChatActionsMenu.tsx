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
  const subC = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)';
  const borderC = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';
  const bgCard = isDark ? 'rgba(40,40,44,0.97)' : 'rgba(255,255,255,0.97)';

  const items = [
    { sub: true, label: 'New group chat' },
    { icon: 'people-outline', label: 'People', onPress: () => { onClose(); onPeople(); } },
    { icon: 'person-add-outline', label: 'Add people', onPress: () => { onClose(); onAddPeople(); } },
    { icon: 'link-outline', label: 'Manage group link', onPress: () => { onClose(); onManageLink(); } },
    { icon: 'pencil-outline', label: 'Rename group', onPress: () => { onClose(); onRenameGroup(); } },
    { icon: 'settings-outline', label: 'Customize Dawinix', onPress: () => { onClose(); onCustomize(); } },
    { icon: isMuted ? 'notifications-outline' : 'notifications-off-outline', label: isMuted ? 'Unmute notifications' : 'Mute notifications', onPress: () => { onClose(); onMute(); } },
    { icon: 'flag-outline', label: 'Report', onPress: () => { onClose(); onReport(); }, destructive: true },
    { icon: 'exit-outline', label: 'Leave group chat', onPress: () => { onClose(); onDeleteGroup(); }, destructive: true },
  ];

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={{ flex: 1 }} onPress={onClose}>
        <View style={{ position: 'absolute', top: 80, right: 16, width: 250, borderRadius: 18, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 20 }}>
          {Platform.OS === 'ios' ? (
            <BlurView intensity={isDark ? 80 : 70} tint={isDark ? 'dark' : 'extraLight'} style={{ borderRadius: 18, overflow: 'hidden', paddingVertical: 4 }}>
              {items.map((item: any, i) => (
                item.sub ? (
                  <Text key={`sub-${i}`} style={{ color: subC, fontSize: 12, fontWeight: '600', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4 }}>{item.label}</Text>
                ) : (
                  <TouchableOpacity key={item.label} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, gap: 12, borderTopWidth: i > 1 ? StyleSheet.hairlineWidth : 0, borderTopColor: borderC }} onPress={item.onPress} activeOpacity={0.7}>
                    <Ionicons name={item.icon} size={20} color={item.destructive ? '#FF453A' : textC} />
                    <Text style={{ color: item.destructive ? '#FF453A' : textC, fontSize: 16 }}>{item.label}</Text>
                  </TouchableOpacity>
                )
              ))}
            </BlurView>
          ) : (
            <View style={{ backgroundColor: bgCard, borderRadius: 18, paddingVertical: 4 }}>
              {items.map((item: any, i) => (
                item.sub ? (
                  <Text key={`sub-${i}`} style={{ color: subC, fontSize: 12, fontWeight: '600', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4 }}>{item.label}</Text>
                ) : (
                  <TouchableOpacity key={item.label} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, gap: 12, borderTopWidth: i > 1 ? StyleSheet.hairlineWidth : 0, borderTopColor: borderC }} onPress={item.onPress} activeOpacity={0.7}>
                    <Ionicons name={item.icon} size={20} color={item.destructive ? '#FF453A' : textC} />
                    <Text style={{ color: item.destructive ? '#FF453A' : textC, fontSize: 16 }}>{item.label}</Text>
                  </TouchableOpacity>
                )
              ))}
            </View>
          )}
        </View>
      </Pressable>
    </Modal>
  );
}
