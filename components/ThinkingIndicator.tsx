import React, { useEffect, useRef, memo } from 'react';
import { View, Text, StyleSheet, Animated, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';

type IntentType = 'message' | 'image' | 'file' | 'web_search';

interface ThinkingIndicatorProps {
  userMessage?: string;
  completed?: boolean;
  style?: ViewStyle;
  mode?: string;
}

const INTENT_KEYWORDS: Record<IntentType, string[]> = {
  image: ['logo', 'image', 'img', 'design', 'picture', 'photo', 'draw', 'generate', 'create image'],
  file: ['file', 'pdf', 'document', 'spreadsheet', 'excel', 'csv', 'download', 'chatbot', 'html', 'code', 'create', 'build', 'write'],
  web_search: ['search', 'find', 'look up', 'google', 'browse', 'web', 'search for'],
  message: [],
};

function detectIntent(message?: string): IntentType {
  if (!message) return 'message';
  const msg = message.toLowerCase();
  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
    if (keywords.some(kw => msg.includes(kw))) return intent as IntentType;
  }
  return 'message';
}

function getStatusText(intent: IntentType, message?: string, completed?: boolean): string {
  if (completed) {
    const done: Record<IntentType, string> = {
      image: 'Image created ✨', file: 'File ready 📄', web_search: 'Search completed 🔍', message: 'Done',
    };
    return done[intent];
  }
  const present: Record<IntentType, string | ((msg?: string) => string)> = {
    image: 'Creating image...',
    file: 'Analyzing...',
    web_search: (msg) => {
      const q = msg?.replace(/search|find|look up|google|browse|web/gi, '').trim();
      return q ? `Searching for ${q}...` : 'Searching web...';
    },
    message: 'Analyzing...',
  };
  const t = present[intent];
  return typeof t === 'function' ? t(message) : t;
}

// Simple 3-dot typing animation — no background, no container
const ThinkingDots = memo(function ThinkingDots({ color }: { color: string }) {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animate = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 350, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 350, useNativeDriver: true }),
          Animated.delay(700 - delay),
        ])
      );
    const a1 = animate(dot1, 0);
    const a2 = animate(dot2, 200);
    const a3 = animate(dot3, 400);
    a1.start(); a2.start(); a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, []);

  return (
    <View style={dotStyles.row}>
      {[dot1, dot2, dot3].map((dot, i) => (
        <Animated.View
          key={i}
          style={[dotStyles.dot, { backgroundColor: color, opacity: dot }]}
        />
      ))}
    </View>
  );
});

const dotStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3 },
});

export function ThinkingIndicator({ userMessage = '', completed = false, style }: ThinkingIndicatorProps) {
  const { colors } = useTheme();
  const intent = detectIntent(userMessage);
  const dotColor = colors.textSecondary || '#888';

  if (completed) {
    const doneMap: Record<IntentType, string> = {
      image: '✨ Image created',
      file: '📄 File ready',
      web_search: '🔍 Search complete',
      message: '✓ Done',
    };
    return (
      <View style={[styles.wrapper, style]}>
        <Text style={[styles.text, { color: colors.textSecondary }]}>{doneMap[intent]}</Text>
      </View>
    );
  }

  if (intent === 'image') {
    return (
      <View style={[styles.imageWrapper, style]}>
        <View style={[styles.iconCircle, { backgroundColor: `${colors.primary}15` }]}>
          <Ionicons name="color-palette-outline" size={18} color={colors.primary} />
        </View>
        <Text style={[styles.text, { color: colors.textSecondary }]}>Creating image...</Text>
        <ThinkingDots color={dotColor} />
      </View>
    );
  }

  if (intent === 'web_search') {
    const q = userMessage?.replace(/search|find|look up|google|browse|web/gi, '').trim();
    return (
      <View style={[styles.wrapper, style]}>
        <Ionicons name="globe-outline" size={15} color={colors.textSecondary} />
        <Text style={[styles.text, { color: colors.textSecondary }]} numberOfLines={1}>
          {q ? `Searching for ${q}...` : 'Searching web...'}
        </Text>
        <ThinkingDots color={dotColor} />
      </View>
    );
  }

  // Default thinking state — clean 3-dot animation
  return (
    <View style={[styles.wrapper, style]}>
      <ThinkingDots color={dotColor} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  imageWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  iconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 14,
    fontWeight: '400',
  },
});
Enhance the ThinkingIndicator with a smoother pulsing brain icon animation and a rotating progress ring that shows estimated response time based on message complexity and fix streaming.
