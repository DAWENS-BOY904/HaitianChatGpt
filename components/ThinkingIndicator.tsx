// ThinkingIndicator.tsx
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { Spacing, Typography, BorderRadius } from '../constants/theme';

/* ======================================================
   TYPES
====================================================== */
type IntentType = 'message' | 'image' | 'file' | 'web_search';

interface ThinkingIndicatorProps {
  userMessage?: string;
  completed?: boolean;
}

/* ======================================================
   INTENT DETECTION
====================================================== */
function detectIntent(message?: string): IntentType {
  if (!message) return 'message';
  const msg = message.toLowerCase();

  if (
    msg.includes('logo') ||
    msg.includes('image') ||
    msg.includes('img') ||
    msg.includes('design')
  ) {
    return 'image';
  }

  if (
    msg.includes('file') ||
    msg.includes('pdf') ||
    msg.includes('document')
  ) {
    return 'file';
  }

  if (
    msg.includes('search') ||
    msg.includes('find') ||
    msg.includes('link') ||
    msg.includes('website')
  ) {
    return 'web_search';
  }

  return 'message';
}

/* ======================================================
   THINKING / COMPLETED TEXT
====================================================== */
function getStatusText(
  intent: IntentType,
  message?: string,
  completed?: boolean
) {
  if (completed) {
    switch (intent) {
      case 'image':
        return message?.toLowerCase().includes('logo')
          ? 'Logo created'
          : 'Image created';

      case 'file':
        return 'File ready';

      case 'web_search':
        return 'Search completed';

      default:
        return 'Done';
    }
  }

  // LOADING STATE
  switch (intent) {
    case 'image':
      return 'Creating image…';

    case 'file':
      return 'Creating file…';

    case 'web_search': {
      const keyword = message
        ?.replace(/search|find|link|website/gi, '')
        .trim();
      return `Searching web${keyword ? `: ${keyword}` : '…'}`;
    }

    default:
      return 'Thinking…';
  }
}

/* ======================================================
   MAIN COMPONENT
====================================================== */
export function ThinkingIndicator({
  userMessage = '',
  completed = false,
}: ThinkingIndicatorProps) {
  const { colors } = useTheme();
  const intent = detectIntent(userMessage);
  const text = getStatusText(intent, userMessage, completed);

  return (
    <View style={styles.container}>
      <ThinkingRow
        text={text}
        color={completed ? '#34C759' : colors.primary}
        animate={!completed}
      />
    </View>
  );
}

/* ======================================================
   SINGLE ROW
====================================================== */
function ThinkingRow({
  text,
  color,
  animate,
}: {
  text: string;
  color: string;
  animate: boolean;
}) {
  const dot = useRef(new Animated.Value(0)).current;
  const animation = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (!animate) {
      dot.setValue(1);
      animation.current?.stop();
      return;
    }

    animation.current = Animated.loop(
      Animated.sequence([
        Animated.timing(dot, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(dot, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ])
    );

    animation.current.start();

    return () => animation.current?.stop();
  }, [animate]);

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
    marginLeft: Spacing.sm,
  },
});
