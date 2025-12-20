import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { Spacing, Typography, BorderRadius } from '../constants/theme';

interface ThinkingIndicatorProps {
  mode?: 'thinking' | 'creating_image' | 'creating_file' | 'editing_image' | 'analyzing';
  model?: string;
}

export function ThinkingIndicator({ mode = 'thinking', model = 'AI' }: ThinkingIndicatorProps) {
  const { colors } = useTheme();
  const glowAnim = useRef(new Animated.Value(0)).current;
  const [dot1] = React.useState(new Animated.Value(0));
  const [dot2] = React.useState(new Animated.Value(0));
  const [dot3] = React.useState(new Animated.Value(0));

  useEffect(() => {
    // Glow effect animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Dots animation
    const animateDot = (dotValue: Animated.Value, delay: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dotValue, {
            toValue: 1,
            duration: 400,
            easing: Easing.ease,
            useNativeDriver: true,
          }),
          Animated.timing(dotValue, {
            toValue: 0,
            duration: 400,
            easing: Easing.ease,
            useNativeDriver: true,
          }),
        ])
      ).start();
    };

    animateDot(dot1, 0);
    animateDot(dot2, 200);
    animateDot(dot3, 400);
  }, []);

  const getModeText = () => {
    switch (mode) {
      case 'creating_image':
        return 'Creating image';
      case 'creating_file':
        return 'Creating file';
      case 'editing_image':
        return 'Editing image';
      case 'analyzing':
        return 'Analyzing';
      case 'thinking':
      default:
        return 'Thinking';
    }
  };

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.8],
  });

  const styles = StyleSheet.create({
    container: {
      padding: Spacing.md,
      marginVertical: Spacing.sm,
    },
    content: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      alignSelf: 'flex-start',
      gap: Spacing.sm,
    },
    glowContainer: {
      position: 'relative',
    },
    glow: {
      position: 'absolute',
      top: -4,
      left: -4,
      right: -4,
      bottom: -4,
      backgroundColor: colors.primary,
      borderRadius: BorderRadius.md,
      opacity: 0.2,
    },
    text: {
      ...Typography.body,
      color: colors.text,
      fontWeight: '500',
    },
    dotsContainer: {
      flexDirection: 'row',
      gap: 4,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: BorderRadius.full,
      backgroundColor: colors.primary,
    },
    modelBadge: {
      backgroundColor: `${colors.primary}20`,
      paddingHorizontal: Spacing.xs,
      paddingVertical: 2,
      borderRadius: BorderRadius.sm,
      marginLeft: Spacing.xs,
    },
    modelText: {
      ...Typography.small,
      color: colors.primary,
      fontSize: 10,
      fontWeight: '600',
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.glowContainer}>
        <Animated.View 
          style={[
            styles.glow,
            {
              opacity: glowOpacity,
            },
          ]} 
        />
        <View style={styles.content}>
          <Text style={styles.text}>{getModeText()}</Text>
          <View style={styles.dotsContainer}>
            <Animated.View 
              style={[
                styles.dot,
                {
                  opacity: dot1,
                  transform: [{ scale: dot1 }],
                },
              ]} 
            />
            <Animated.View 
              style={[
                styles.dot,
                {
                  opacity: dot2,
                  transform: [{ scale: dot2 }],
                },
              ]} 
            />
            <Animated.View 
              style={[
                styles.dot,
                {
                  opacity: dot3,
                  transform: [{ scale: dot3 }],
                },
              ]} 
            />
          </View>
          <View style={styles.modelBadge}>
            <Text style={styles.modelText}>{model.toUpperCase()}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}
