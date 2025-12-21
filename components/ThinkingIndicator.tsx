// ThinkingIndicator.tsx
import React, { useEffect, useState, useRef } from 'react';
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

  if (msg.includes('edit') && (msg.includes('image') || msg.includes('photo')))
    return 'edit_image';

  if (msg.includes('image') || msg.includes('photo') || msg.includes('img'))
    return 'image';

  if (
    msg.includes('file') ||
    msg.includes('document') ||
    msg.includes('pdf') ||
    msg.includes('upload')
  )
    return 'file';

  if (
    msg.includes('search') ||
    msg.includes('find') ||
    msg.includes('example') ||
    msg.includes('internet') ||
    msg.includes('google')
  )
    return 'web_search';

  return 'message';
}

/* ======================================================
   THINKING STEPS (5 MODELS EACH)
====================================================== */
const THINKING_MAP: Record<IntentType, ThinkingModel[]> = {
  message: [
    { model: 'Chat-A', text: 'Understanding message intent' },
    { model: 'Chat-B', text: 'Thinking about response' },
    { model: 'Chat-C', text: 'Structuring reply' },
    { model: 'Chat-D', text: 'Optimizing clarity' },
    { model: 'Chat-E', text: 'Finalizing answer' },
  ],

  image: [
    { model: 'Vision-A', text: 'Analyzing image concept' },
    { model: 'Vision-B', text: 'Designing visual layout' },
    { model: 'Vision-C', text: 'Generating image assets' },
    { model: 'Vision-D', text: 'Rendering image details' },
    { model: 'Vision-E', text: 'Finalizing image quality' },
  ],

  edit_image: [
    { model: 'Edit-A', text: 'Analyzing existing image' },
    { model: 'Edit-B', text: 'Detecting edit zones' },
    { model: 'Edit-C', text: 'Applying modifications' },
    { model: 'Edit-D', text: 'Optimizing edits' },
    { model: 'Edit-E', text: 'Rendering final image' },
  ],

  file: [
    { model: 'File-A', text: 'Reading file content' },
    { model: 'File-B', text: 'Analyzing file structure' },
    { model: 'File-C', text: 'Extracting key data' },
    { model: 'File-D', text: 'Validating information' },
    { model: 'File-E', text: 'Preparing final file' },
  ],

  web_search: [
    { model: 'Web-A', text: 'Searching the web' },
    { model: 'Web-B', text: 'Scanning online examples' },
    { model: 'Web-C', text: 'Filtering best results' },
    { model: 'Web-D', text: 'Summarizing findings' },
    { model: 'Web-E', text: 'Preparing web response' },
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
  const steps = THINKING_MAP[intent];

  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    setStepIndex(0);

    const interval = setInterval(() => {
      setStepIndex(prev => {
        if (prev >= steps.length - 1) {
          clearInterval(interval);
          return prev;
        }
        return prev + 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [userMessage]);

  const current = steps[stepIndex];

  return (
    <View style={styles.container}>
      <ThinkingRow
        model={current.model}
        text={completed ? 'Done' : current.text}
        color={completed ? '#34C759' : colors.primary}
      />
    </View>
  );
}

/* ======================================================
   SINGLE ROW (EDIT MODE)
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
        Animated.timing(dot, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(dot, { toValue: 0, duration: 400, useNativeDriver: true }),
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
