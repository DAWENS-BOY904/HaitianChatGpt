import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useTheme } from '../hooks/useTheme';
import { Spacing, Typography, BorderRadius } from '../constants/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export type AIMode = 'instant' | 'deep-thinking' | 'agent';

interface AIModeOption {
  id: AIMode;
  name: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  capabilities: string[];
}

const AI_MODES: AIModeOption[] = [
  {
    id: 'instant',
    name: 'Instant',
    description: 'Fast replies for quick questions and casual conversation',
    icon: 'flash',
    color: '#34C759',
    capabilities: ['Quick responses', 'General chat', 'Simple tasks']
  },
  {
    id: 'deep-thinking',
    name: 'Deep Thinking',
    description: 'Advanced reasoning for complex analysis and detailed explanations',
    icon: 'brain',
    color: '#007AFF',
    capabilities: ['Complex reasoning', 'Detailed analysis', 'Problem solving']
  },
  {
    id: 'agent',
    name: 'Agent Mode',
    description: 'Research, create slides, websites, documents, and spreadsheets',
    icon: 'construct',
    color: '#FF9500',
    capabilities: ['Research', 'Slides', 'Websites', 'Documents', 'Sheets']
  }
];

interface AIModeSelectorModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectMode: (mode: AIMode) => void;
  currentMode: AIMode;
}

export function AIModeSelectorModal({
  visible,
  onClose,
  onSelectMode,
  currentMode,
}: AIModeSelectorModalProps) {
  const { colors } = useTheme();
  const [selectedMode, setSelectedMode] = useState<AIMode>(currentMode);

  const handleSelectMode = (mode: AIMode) => {
    setSelectedMode(mode);
    onSelectMode(mode);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <BlurView intensity={20} style={styles.overlay}>
        <View style={styles.container}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.text }]}>
              Select AI Mode
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            {AI_MODES.map((mode) => (
              <TouchableOpacity
                key={mode.id}
                style={[
                  styles.modeOption,
                  {
                    backgroundColor: selectedMode === mode.id
                      ? mode.color + '15'
                      : colors.surface,
                    borderColor: selectedMode === mode.id
                      ? mode.color
                      : colors.border,
                  }
                ]}
                onPress={() => handleSelectMode(mode.id)}
              >
                <View style={styles.modeHeader}>
                  <View style={[styles.iconContainer, { backgroundColor: mode.color + '20' }]}>
                    <Ionicons name={mode.icon} size={24} color={mode.color} />
                  </View>
                  <View style={styles.modeInfo}>
                    <Text style={[styles.modeName, { color: colors.text }]}>
                      {mode.name}
                    </Text>
                    <Text style={[styles.modeDescription, { color: colors.textSecondary }]}>
                      {mode.description}
                    </Text>
                  </View>
                  {selectedMode === mode.id && (
                    <Ionicons name="checkmark-circle" size={24} color={mode.color} />
                  )}
                </View>

                <View style={styles.capabilities}>
                  {mode.capabilities.map((capability, index) => (
                    <View key={index} style={styles.capabilityTag}>
                      <Text style={[styles.capabilityText, { color: mode.color }]}>
                        {capability}
                      </Text>
                    </View>
                  ))}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </BlurView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  container: {
    width: SCREEN_WIDTH * 0.9,
    maxWidth: 400,
    backgroundColor: 'rgba(28, 28, 30, 0.98)',
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: Typography.h2.fontSize,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: Spacing.sm,
  },
  content: {
    padding: Spacing.lg,
  },
  modeOption: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    marginBottom: Spacing.md,
  },
  modeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  modeInfo: {
    flex: 1,
  },
  modeName: {
    fontSize: Typography.h3.fontSize,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  modeDescription: {
    fontSize: Typography.body.fontSize,
    lineHeight: 20,
  },
  capabilities: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  capabilityTag: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    marginRight: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  capabilityText: {
    fontSize: Typography.caption.fontSize,
    fontWeight: '500',
  },
});
