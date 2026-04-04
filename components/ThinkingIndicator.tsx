/**
 * THINKING INDICATOR - PRODUCTION READY
 * Shows real-time AI processing with beautiful animations
 * Changed from "Analyzing" to "Thinking" per requirements
 */

import React, { useEffect, useRef, memo } from 'react';
import { View, Text, StyleSheet, Animated, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { Spacing, Typography, BorderRadius } from '../constants/theme';

type IntentType = 'message' | 'image' | 'file' | 'web_search';

interface ThinkingIndicatorProps {
  userMessage?: string;
  completed?: boolean;
  style?: ViewStyle;
}

// Keywords mapped to intents
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
    image: 'Image created ✨',
    file: 'File ready 📄',
    web_search: 'Search completed 🔍',
    message: 'Done ✓',
  };

  const presentTense: Record<IntentType, string | ((msg?: string) => string)> = {
    image: 'Creating image...',
    file: 'Analyzing...',
    web_search: (msg) => {
      const query = msg?.replace(/search|find|look up|google|browse|web/gi, '').trim();
      return query ? `Searching for ${query}...` : 'Searching web...';
    },
    message: 'Thinking...',
  };

  if (completed) {
    if (intent === 'image' && message?.toLowerCase().includes('logo')) {
      return 'Logo created ✨';
    }
    return pastTense[intent];
  }

  const text = presentTense[intent];
  return typeof text === 'function' ? text(message) : text;
}

function getIcon(intent: IntentType): keyof typeof Ionicons.glyphMap {
  const iconMap: Record<IntentType, keyof typeof Ionicons.glyphMap> = {
    image: 'image',
    file: 'code-slash',
    web_search: 'search',
    message: 'bulb',
  };
  return iconMap[intent];
}

// Memoized animated thinking component
const ThinkingAnimation = memo(function ThinkingAnimation({
  text,
  icon,
  color,
  animate,
}: {
  text: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  animate: boolean;
}) {
  const { colors } = useTheme();
  const pulseAnim = useRef(new Animated.Value(0.6)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (!animate) {
      pulseAnim.setValue(1);
      rotateAnim.setValue(0);
      animationRef.current?.stop();
      return;
    }

    animationRef.current = Animated.parallel([
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0.6,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ),
      Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        })
      ),
    ]);

    animationRef.current.start();

    return () => {
      animationRef.current?.stop();
    };
  }, [animate]);

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <Animated.View 
        style={[
          styles.iconContainer,
          { 
            opacity: pulseAnim,
            transform: [{ rotate: rotation }],
          },
        ]}
      >
        <Ionicons name={icon} size={20} color={color} />
      </Animated.View>
      
      <Text style={[styles.text, { color: colors.text }]}>
        {text}
      </Text>
      
      {animate && (
        <View style={styles.dotsContainer}>
          <Animated.View style={[styles.dot, { backgroundColor: color, opacity: pulseAnim }]} />
          <Animated.View style={[styles.dot, { backgroundColor: color, opacity: pulseAnim }]} />
          <Animated.View style={[styles.dot, { backgroundColor: color, opacity: pulseAnim }]} />
        </View>
      )}
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
  const icon = getIcon(intent);
  const indicatorColor = completed ? colors.success : colors.primary;

  return (
    <View style={[styles.wrapper, style]}>
      <ThinkingAnimation 
        text={text} 
        icon={icon}
        color={indicatorColor} 
        animate={!completed} 
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    minHeight: 56,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  text: {
    ...Typography.body,
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 6,
    marginLeft: Spacing.sm,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});

