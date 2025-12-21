// ThinkingIndicator.tsx
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { Spacing, Typography, BorderRadius } from '../constants/theme';

/* ======================================================
   TYPES
====================================================== */
type IntentType =
  | 'file'
  | 'image'
  | 'edit_image'
  | 'web_search'
  | 'message';

interface ThinkingModel {
  id: string;
  model: string;
  text: string;
}

interface ThinkingIndicatorProps {
  userMessage?: string;
  completed?: boolean;
}

/* ======================================================
   AUTO INTENT DETECTION
====================================================== */
function detectIntent(message?: string): IntentType {
  if (!message) return 'message';
  const msg = message.toLowerCase();

  if (msg.includes('edit') && (msg.includes('image') || msg.includes('photo'))) {
    return 'edit_image';
  }

  if (msg.includes('image') || msg.includes('photo') || msg.includes('img')) {
    return 'image';
  }

  if (
    msg.includes('file') ||
    msg.includes('document') ||
    msg.includes('pdf') ||
    msg.includes('upload')
  ) {
    return 'file';
  }

  if (
    msg.includes('search') ||
    msg.includes('find') ||
    msg.includes('example') ||
    msg.includes('internet') ||
    msg.includes('google')
  ) {
    return 'web_search';
  }

  return 'message';
}

/* ======================================================
   5 THINKING MODELS PER INTENT
====================================================== */
const THINKING_MAP: Record<IntentType, ThinkingModel[]> = {
  image: [
    { id: 'i1', model: 'Vision-A', text: 'Analyzing image concept' },
    { id: 'i2', model: 'Vision-B', text: 'Designing visual layout' },
    { id: 'i3', model: 'Vision-C', text: 'Generating image assets' },
    { id: 'i4', model: 'Vision-D', text: 'Rendering image details' },
    { id: 'i5', model: 'Vision-E', text: 'Finalizing image quality' },
  ],

  edit_image: [
    { id: 'e1', model: 'Edit-A', text: 'Analyzing existing image' },
    { id: 'e2', model: 'Edit-B', text: 'Detecting edit zones' },
    { id: 'e3', model: 'Edit-C', text: 'Applying modifications' },
    { id: 'e4', model: 'Edit-D', text: 'Optimizing edits' },
    { id: 'e5', model: 'Edit-E', text: 'Rendering final image' },
  ],

  file: [
    { id: 'f1', model: 'File-A', text: 'Reading file content' },
    { id: 'f2', model: 'File-B', text: 'Analyzing file structure' },
    { id: 'f3', model: 'File-C', text: 'Extracting key data' },
    { id: 'f4', model: 'File-D', text: 'Validating information' },
    { id: 'f5', model: 'File-E', text: 'Preparing final file' },
  ],

  web_search: [
    { id: 'w1', model: 'Web-A', text: 'Searching the web' },
    { id: 'w2', model: 'Web-B', text: 'Scanning online examples' },
    { id: 'w3', model: 'Web-C', text: 'Filtering best results' },
    { id: 'w4', model: 'Web-D', text: 'Summarizing findings' },
    { id: 'w5', model: 'Web-E', text: 'Preparing web response' },
  ],

  message: [
    { id: 'm1', model: 'Chat-A', text: 'Understanding message intent' },
    { id: 'm2', model: 'Chat-B', text: 'Thinking about response' },
    { id: 'm3', model: 'Chat-C', text: 'Structuring reply' },
    { id: 'm4', model: 'Chat-D', text: 'Optimizing clarity' },
    { id: 'm5', model: 'Chat-E', text: 'Finalizing answer' },
  ],
};

/* ======================================================
   MAIN COMPONENT
====================================================== */
export function ThinkingIndicator({
  userMessage = '',
  completed = false,
}: ThinkingIndicatorProps) {
  const { colors } = useTheme();
  const intent = detectIntent(userMessage);
  const models = THINKING_MAP[intent];

  return (
    <View style={styles.container}>
      {models.map(item => (
        <ThinkingRow
          key={item.id}
          model={item.model}
          text={completed ? 'Done' : item.text}
          color={completed ? '#34C759' : colors.primary}
        />
      ))}
    </View>
  );
}

/* ======================================================
   SINGLE THINKING ROW
====================================================== */
function ThinkingRow({
  model,
  text,
  color,
}: {
  model: string;
  text: string;
  color: string;
}) {
  const dot = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(dot, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(dot, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  return (
    <View style={styles.row}>
      <Text style={styles.text}>{text}</Text>

      <Animated.View
        style={[
          styles.dot,
          {
            backgroundColor: color,
            opacity: dot,
            transform: [{ scale: dot }],
          },
        ]}
      />

      <View style={[styles.badge, { backgroundColor: `${color}20` }]}>
        <Text style={[styles.badgeText, { color }]}>{model}</Text>
      </View>
    </View>
  );
}

/* ======================================================
   STYLES
====================================================== */
const styles = StyleSheet.create({
  container: {
    padding: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1c1c1e',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  text: {
    ...Typography.body,
    color: '#fff',
    flex: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: BorderRadius.full,
    marginHorizontal: Spacing.sm,
  },
  badge: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  badgeText: {
    ...Typography.small,
    fontSize: 10,
    fontWeight: '600',
  },
});
