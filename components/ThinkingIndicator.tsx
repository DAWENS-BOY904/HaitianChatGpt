// ThinkingIndicator.tsx
import React, { useEffect, useRef, memo } from 'react';
import { View, Text, StyleSheet, Animated, ViewStyle } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { Spacing, Typography, BorderRadius } from '../constants/theme';

type IntentType = 'message' | 'image' | 'file' | 'web_search';

interface ThinkingIndicatorProps {
  userMessage?: string;
  completed?: boolean;
  style?: ViewStyle;
}

// Keywords mapped to intents for easy extension
const INTENT_KEYWORDS: Record<IntentType, string[]> = {
  image: ['logo', 'image', 'img', 'design', 'picture', 'photo', 'draw', 'generate'],
  file: ['file', 'pdf', 'document', 'spreadsheet', 'excel', 'csv', 'download'],
  web_search: ['search', 'find', 'look up', 'google', 'browse', 'web'],
  message: [],
};

function detectIntent(message?: string): IntentType {
  if (!message) return 'message';
  const msg = message.toLowerCase();
  
  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
    if (keywords.some(kw => msg.includes(kw))) {
      return intent as IntentType;
    }
  }
  return 'message';
}

function getStatusText(
  intent: IntentType,
  message?: string,
  completed?: boolean
): string {
  const pastTense: Record<IntentType, string> = {
    image: 'Image created',
    file: 'File ready',
    web_search: 'Search completed',
    message: 'Done',
  };

  const presentTense: Record<IntentType, string | ((msg?: string) => string)> = {
    image: 'Creating image…',
    file: 'Creating file…',
    web_search: (msg) => {
      const query = msg?.replace(/search|find|look up|google|browse|web/gi, '').trim();
      return query ? `Searching: ${query}` : 'Searching web…';
    },
    message: 'Thinking…',
  };

  if (completed) {
    // Special case for logo-specific messaging
    if (intent === 'image' && message?.toLowerCase().includes('logo')) {
      return 'Logo created';
    }
    return pastTense[intent];
  }

  const text = presentTense[intent];
  return typeof text === 'function' ? text(message) : text;
}

// Memoized row component to prevent re-renders
const ThinkingRow = memo(function ThinkingRow({
  text,
  color,
  animate,
}: {
  text: string;
  color: string;
  animate: boolean;
}) {
  const pulseAnim = useRef(new Animated.Value(0.5)).current;
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (!animate) {
      pulseAnim.setValue(1);
      animationRef.current?.stop();
      return;
    }

    animationRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.5,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    );

    animationRef.current.start();

    return () => {
      animationRef.current?.stop();
    };
  }, [animate]);

  return (
    <View style={styles.row}>
      <Text style={styles.text} numberOfLines={2} ellipsizeMode="tail">
        {text}
      </Text>
      <Animated.View
        style={[
          styles.dot,
          {
            backgroundColor: color,
            opacity: pulseAnim,
            transform: [{ scale: pulseAnim }],
          },
        ]}
      />
    </View>
  );
});

export function ThinkingIndicator({
  userMessage = '',
  completed = false,
  style,
}: ThinkingIndicatorProps) {
  const { colors } = useTheme();
  const intent = detectIntent(userMessage);
  const text = getStatusText(intent, userMessage, completed);

  // Use theme color instead of hardcoded
  const indicatorColor = completed ? colors.success : colors.primary;

  return (
    <View style={[styles.container, style]}>
      <ThinkingRow 
        text={text} 
        color={indicatorColor} 
        animate={!completed} 
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1c1c1e', // Consider moving to theme.colors.surfaceElevated
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    minHeight: 48, // Prevent layout shift
  },
  text: {
    ...Typography.body,
    color: '#fff', // Consider theme.colors.textPrimary
    flex: 1,
    marginRight: Spacing.sm, // Ensure space before dot
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4, // Fixed value clearer than BorderRadius.full for circles
    marginLeft: Spacing.sm,
    flexShrink: 0, // Prevent dot from being squished
  },
});

