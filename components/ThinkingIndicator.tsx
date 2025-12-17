import React from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { Spacing, Typography, BorderRadius } from '../constants/theme';

interface ThinkingIndicatorProps {
  model?: string;
}

export function ThinkingIndicator({ model = 'AI' }: ThinkingIndicatorProps) {
  const { colors } = useTheme();
  const [dot1] = React.useState(new Animated.Value(0));
  const [dot2] = React.useState(new Animated.Value(0));
  const [dot3] = React.useState(new Animated.Value(0));

  React.useEffect(() => {
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

  const styles = StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      alignSelf: 'flex-start',
      gap: Spacing.sm,
    },
    text: {
      ...Typography.body,
      color: colors.textSecondary,
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
      backgroundColor: colors.primary,
      paddingHorizontal: Spacing.xs,
      paddingVertical: 2,
      borderRadius: BorderRadius.sm,
      marginLeft: Spacing.xs,
    },
    modelText: {
      ...Typography.small,
      color: '#FFFFFF',
      fontSize: 10,
      fontWeight: '600',
    },
  });

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Thinking</Text>
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
  );
}
