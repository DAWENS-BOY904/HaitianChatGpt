import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';

type ThinkingMode = 'thinking' | 'creating_image' | 'analyzing' | 'editing_image';

interface ThinkingIndicatorProps {
  userMessage?: string;
  completed?: boolean;
  mode?: ThinkingMode;
  onCancel?: () => void;
  isGroupMode?: boolean;
}

export function ThinkingIndicator({
  userMessage,
  completed = false,
  mode = 'thinking',
  onCancel,
  isGroupMode = false,
}: ThinkingIndicatorProps) {
  const { colors, isDark } = useTheme();
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (completed) return;
    const anim = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 350, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 350, useNativeDriver: true }),
          Animated.delay(700 - delay),
        ])
      );
    const a1 = anim(dot1, 0);
    const a2 = anim(dot2, 200);
    const a3 = anim(dot3, 400);
    a1.start(); a2.start(); a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, [completed]);

  const getLabel = () => {
    if (completed) return 'Done';
    switch (mode) {
      case 'creating_image': return 'Creating image…';
      case 'analyzing': return 'Analyzing…';
      case 'editing_image': return 'Editing image…';
      default: return isGroupMode ? 'Dawinix is thinking…' : 'Thinking…';
    }
  };

  const getIcon = (): any => {
    switch (mode) {
      case 'creating_image': return 'color-palette-outline';
      case 'analyzing': return 'eye-outline';
      case 'editing_image': return 'brush-outline';
      default: return 'sparkles-outline';
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)' }]}>
      <View style={styles.row}>
        <View style={[styles.iconWrap, { backgroundColor: isDark ? 'rgba(16,163,127,0.18)' : 'rgba(16,163,127,0.12)' }]}>
          <Ionicons name={getIcon()} size={16} color="#10A37F" />
        </View>
        <Text style={[styles.label, { color: isDark ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.65)' }]}>
          {getLabel()}
        </Text>
        {!completed && (
          <View style={styles.dots}>
            {[dot1, dot2, dot3].map((dot, i) => (
              <Animated.View
                key={i}
                style={[
                  styles.dot,
                  { backgroundColor: '#10A37F', opacity: dot, transform: [{ scale: dot.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.2] }) }] },
                ]}
              />
            ))}
          </View>
        )}
        {completed && <Ionicons name="checkmark-circle" size={16} color="#34C759" style={{ marginLeft: 6 }} />}
        {onCancel && !completed && (
          <TouchableOpacity onPress={onCancel} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={styles.cancelBtn}>
            <View style={[styles.stopBox, { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)' }]}>
              <View style={[styles.stopIcon, { backgroundColor: isDark ? '#FFF' : '#000' }]} />
            </View>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  cancelBtn: {
    marginLeft: 4,
  },
  stopBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopIcon: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
});
please remove this function to home page 
