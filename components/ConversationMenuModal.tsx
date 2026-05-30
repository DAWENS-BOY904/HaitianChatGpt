import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Platform,
  Pressable,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';

interface ConversationMenuModalProps {
  visible: boolean;
  onClose: () => void;
  onShare: () => void;
  onRename: () => void;
  onReport: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onAddPeople: () => void;
  conversationTitle?: string;
  topOffset?: number;
}

export function ConversationMenuModal({
  visible,
  onClose,
  onShare,
  onRename,
  onReport,
  onArchive,
  onDelete,
  onAddPeople,
  conversationTitle,
  topOffset = 60,
}: ConversationMenuModalProps) {
  const { isDark, colors } = useTheme();

  const textC = isDark ? '#FFFFFF' : '#000000';
  const subC = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)';

  const menuItems = [
    {
      icon: 'share-outline' as const,
      label: 'Share',
      onPress: () => { onClose(); onShare(); },
    },
    {
      icon: 'person-add-outline' as const,
      label: 'Add people',
      onPress: () => { onClose(); onAddPeople(); },
    },
    {
      icon: 'pencil-outline' as const,
      label: 'Rename',
      onPress: () => { onClose(); onRename(); },
    },
    {
      icon: 'archive-outline' as const,
      label: 'Archive',
      onPress: () => { onClose(); onArchive(); },
    },
    {
      icon: 'flag-outline' as const,
      label: 'Report',
      onPress: () => { onClose(); onReport(); },
    },
    {
      icon: 'trash-outline' as const,
      label: 'Delete',
      onPress: () => { onClose(); onDelete(); },
      destructive: true,
    },
  ];

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      // ✅ KEY FIX: Use overFullScreen so modal doesn't wrap/capture the whole screen
      presentationStyle="overFullScreen"
      statusBarTranslucent={Platform.OS === 'android'}
    >
      {/* Backdrop — sèlman backdrop la bliye, pa tout ekran an */}
      <Pressable style={styles.backdrop} onPress={onClose}>
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
      <View style={[styles.menuContainer, { top: topOffset, right: 14 }]}>
        {Platform.OS === 'ios' ? (
          <BlurView
            intensity={isDark ? 92 : 90}
            tint={isDark ? 'dark' : 'extraLight'}
            style={styles.blurWrap}
          >
            {conversationTitle ? (
              <View style={styles.titleRow}>
                <Text style={[styles.titleText, { color: subC }]} numberOfLines={1}>
                  {conversationTitle}
                </Text>
              </View>
            ) : null}

            {menuItems.map((item, i) => (
              <TouchableOpacity
                key={item.label}
                style={[
                  styles.menuItem,
                  // ✅ KEY FIX: Retire line anba chak message
                  // i !== menuItems.length - 1 && styles.itemBorder,
                ]}
                onPress={item.onPress}
                activeOpacity={0.65}
              >
                <Text 
                  style={[
                    styles.menuLabel, 
                    item.destructive && styles.destructive,
                    { color: item.destructive ? '#FF453A' : textC }
                  ]}
                >
                  {item.label}
                </Text>
                <Ionicons
                  name={item.icon}
                  size={20}
                  color={item.destructive ? '#FF453A' : subC}
                />
              </TouchableOpacity>
            ))}
          </BlurView>
        ) : (
          /* Android Fallback */
          <View 
            style={[
              styles.blurWrap, 
              { 
                backgroundColor: isDark 
                  ? 'rgba(36,36,40,0.98)' 
                  : 'rgba(255,255,255,0.97)' 
              }
            ]}
          >
            {conversationTitle ? (
              <View style={styles.titleRow}>
                <Text style={[styles.titleText, { color: subC }]} numberOfLines={1}>
                  {conversationTitle}
                </Text>
              </View>
            ) : null}

            {menuItems.map((item, i) => (
              <TouchableOpacity
                key={item.label}
                style={[
                  styles.menuItem,
                  // ✅ KEY FIX: Retire line anba chak message
                  // i !== menuItems.length - 1 && styles.itemBorder,
                ]}
                onPress={item.onPress}
                activeOpacity={0.65}
              >
                <Text 
                  style={[
                    styles.menuLabel, 
                    item.destructive && styles.destructive,
                    { color: item.destructive ? '#FF453A' : textC }
                  ]}
                >
                  {item.label}
                </Text>
                <Ionicons
                  name={item.icon}
                  size={20}
                  color={item.destructive ? '#FF453A' : subC}
                />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  menuContainer: {
    position: 'absolute',
    width: 240,
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
    borderColor: 'rgba(255,255,255,0.15)',
  },
  titleRow: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  titleText: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  // ✅ Retire itemBorder style si ou pa bezwen li nan lòt kote
  itemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  menuLabel: {
    fontSize: 17,
    fontWeight: '400',
  },
  destructive: {
    color: '#FF453A',
  },
});
