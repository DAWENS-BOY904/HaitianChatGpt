import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';

interface ThinkingIndicatorProps {
  userMessage?: string;
  completed: boolean;
  mode: 'thinking' | 'creating_image' | 'analyzing' | 'editing_image';
  onCancel?: () => void;
  isGroupMode?: boolean;
  isWebSearch?: boolean;
  isFileAnalysis?: boolean;
}

export function ThinkingIndicator({
  completed,
  mode,
  onCancel,
  isGroupMode,
  isWebSearch,
  isFileAnalysis,
}: ThinkingIndicatorProps) {
  const { isDark } = useTheme();
  const pulse = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    if (!completed) {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1, duration: 550, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 0.5, duration: 550, useNativeDriver: true }),
        ])
      );
      anim.start();
      return () => anim.stop();
    } else {
      pulse.setValue(1);
    }
  }, [completed]);

  if (completed) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, gap: 6 }}>
        <Ionicons name="checkmark-circle" size={16} color="#34C759" />
        <Text style={{ color: '#34C759', fontSize: 14, fontWeight: '500' }}>Done</Text>
      </View>
    );
  }

  // Determine label and dot color based on context
  let label = 'Thinking';
  let dotColor = isDark ? '#FFFFFF' : '#000000';

  if (isWebSearch) {
    label = 'Searching web';
    dotColor = '#5AC8FA';
  } else if (mode === 'creating_image') {
    label = 'Creating image';
    dotColor = '#BF5AF2';
  } else if (mode === 'analyzing' || isFileAnalysis) {
    label = 'Analyzing file';
    dotColor = '#FF9F0A';
  } else if (mode === 'editing_image') {
    label = 'Editing image';
    dotColor = '#FF453A';
  } else if (isGroupMode) {
    label = 'Responding';
  }

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 8 }}>
      {/* Single theme-aware pulsing dot */}
      <Animated.View
        style={{
          width: 8, height: 8, borderRadius: 4,
          backgroundColor: dotColor,
          opacity: pulse,
        }}
      />
      <Text style={{ color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.55)', fontSize: 14, fontWeight: '500' }}>
        {label}
        <Text style={{ color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.28)' }}>...</Text>
      </Text>
      {onCancel ? (
        <TouchableOpacity onPress={onCancel} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <View style={{
            width: 22, height: 22, borderRadius: 11,
            backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Ionicons name="stop" size={10} color={isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.45)'} />
          </View>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
