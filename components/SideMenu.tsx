import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Image,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../hooks/useTheme';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { AIModeSelectorModal, AIMode } from './AIModeSelectorModal';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const MENU_WIDTH = SCREEN_WIDTH * 0.8;

interface SideMenuProps {
  visible: boolean;
  onClose: () => void;
  currentProject?: {
    name: string;
    logo?: string;
  };
  currentAIMode: AIMode;
  onSelectAIMode: (mode: AIMode) => void;
  onNewChat: () => void;
  onChatHistory: () => void;
  onSettings: () => void;
  onProfile: () => void;
}

export function SideMenu({
  visible,
  onClose,
  currentProject,
  currentAIMode,
  onSelectAIMode,
  onNewChat,
  onChatHistory,
  onSettings,
  onProfile,
}: SideMenuProps) {
  const { colors } = useTheme();
  const [showAIModal, setShowAIModal] = useState(false);

  const translateX = useSharedValue(-MENU_WIDTH);
  const opacity = useSharedValue(0);

  React.useEffect(() => {
    if (visible) {
      translateX.value = withSpring(0, { damping: 25, stiffness: 300 });
      opacity.value = withTiming(1, { duration: 250 });
    } else {
      translateX.value = withSpring(-MENU_WIDTH, { damping: 25, stiffness: 300 });
      opacity.value = withTiming(0, { duration: 200 });
    }
  }, [visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const getAIModeDisplay = (mode: AIMode) => {
    switch (mode) {
      case 'instant':
        return { name: 'Instant', icon: 'flash', color: '#34C759' };
      case 'deep-thinking':
        return { name: 'Deep Thinking', icon: 'brain', color: '#007AFF' };
      case 'agent':
        return { name: 'Agent Mode', icon: 'construct', color: '#FF9500' };
      default:
        return { name: 'Instant', icon: 'flash', color: '#34C759' };
    }
  };

  const currentModeDisplay = getAIModeDisplay(currentAIMode);

  const menuItems = [
    {
      id: 'new-chat',
      title: 'New Chat',
      icon: 'add-circle-outline',
      onPress: () => {
        onNewChat();
        onClose();
      },
    },
    {
      id: 'chat-history',
      title: 'Chat History',
      icon: 'time-outline',
      onPress: () => {
        onChatHistory();
        onClose();
      },
    },
    {
      id: 'settings',
      title: 'Settings',
      icon: 'settings-outline',
      onPress: () => {
        onSettings();
        onClose();
      },
    },
    {
      id: 'profile',
      title: 'Profile',
      icon: 'person-outline',
      onPress: () => {
        onProfile();
        onClose();
      },
    },
  ];

  return (
    <>
      <Animated.View
        style={[styles.overlay, overlayStyle]}
        pointerEvents={visible ? 'auto' : 'none'}
      >
        <TouchableOpacity style={styles.overlayTouchable} onPress={onClose} />
      </Animated.View>

      <Animated.View style={[styles.container, animatedStyle]}>
        <BlurView intensity={20} style={styles.blurContainer}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Project Info */}
          <View style={styles.projectSection}>
            <View style={styles.projectLogo}>
              {currentProject?.logo ? (
                <Image source={{ uri: currentProject.logo }} style={styles.logoImage} />
              ) : (
                <View style={[styles.logoPlaceholder, { backgroundColor: colors.primary }]}>
                  <Ionicons name="code-working" size={32} color="#FFFFFF" />
                </View>
              )}
            </View>
            <View style={styles.projectInfo}>
              <Text style={[styles.projectName, { color: colors.text }]}>
                {currentProject?.name || 'Haitian AI Chat'}
              </Text>
              <Text style={[styles.projectSubtitle, { color: colors.textSecondary }]}>
                AI-Powered Assistant
              </Text>
            </View>
          </View>

          {/* AI Mode Selector */}
          <TouchableOpacity
            style={[styles.aiModeSection, { borderColor: colors.border }]}
            onPress={() => setShowAIModal(true)}
          >
            <View style={styles.aiModeHeader}>
              <View style={[styles.aiIconContainer, { backgroundColor: currentModeDisplay.color + '20' }]}>
                <Ionicons name={currentModeDisplay.icon as any} size={20} color={currentModeDisplay.color} />
              </View>
              <View style={styles.aiModeInfo}>
                <Text style={[styles.aiModeName, { color: colors.text }]}>
                  {currentModeDisplay.name}
                </Text>
                <Text style={[styles.aiModeSubtitle, { color: colors.textSecondary }]}>
                  Tap to change mode
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </View>
          </TouchableOpacity>

          {/* Menu Items */}
          <ScrollView style={styles.menuContainer} showsVerticalScrollIndicator={false}>
            {menuItems.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.menuItem, { borderBottomColor: colors.border }]}
                onPress={item.onPress}
              >
                <View style={styles.menuItemContent}>
                  <Ionicons name={item.icon as any} size={24} color={colors.text} />
                  <Text style={[styles.menuItemText, { color: colors.text }]}>
                    {item.title}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: colors.textSecondary }]}>
              Haitian AI Chat v2.0
            </Text>
          </View>
        </BlurView>
      </Animated.View>

      <AIModeSelectorModal
        visible={showAIModal}
        onClose={() => setShowAIModal(false)}
        onSelectMode={onSelectAIMode}
        currentMode={currentAIMode}
      />
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  overlayTouchable: {
    flex: 1,
  },
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: MENU_WIDTH,
    height: SCREEN_HEIGHT,
    zIndex: 1000,
  },
  blurContainer: {
    flex: 1,
    backgroundColor: 'rgba(28, 28, 30, 0.98)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    padding: Spacing.lg,
    paddingTop: Spacing.xl + 20, // Account for status bar
  },
  closeButton: {
    padding: Spacing.sm,
  },
  projectSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  projectLogo: {
    marginRight: Spacing.md,
  },
  logoImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  logoPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  projectInfo: {
    flex: 1,
  },
  projectName: {
    fontSize: Typography.h3.fontSize,
    fontWeight: 'bold',
    marginBottom: Spacing.xs,
  },
  projectSubtitle: {
    fontSize: Typography.caption.fontSize,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  aiModeSection: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  aiModeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
  },
  aiIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  aiModeInfo: {
    flex: 1,
  },
  aiModeName: {
    fontSize: Typography.body.fontSize,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  aiModeSubtitle: {
    fontSize: Typography.caption.fontSize,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  menuContainer: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    borderBottomWidth: 0.5,
  },
  menuItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuItemText: {
    fontSize: Typography.body.fontSize,
    marginLeft: Spacing.md,
  },
  footer: {
    padding: Spacing.lg,
    alignItems: 'center',
  },
  footerText: {
    fontSize: Typography.caption.fontSize,
    color: 'rgba(255, 255, 255, 0.4)',
  },
});