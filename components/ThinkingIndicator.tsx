import React, { useEffect, useRef, memo } from 'react';
import { View, Text, StyleSheet, Animated, Easing, ViewStyle, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type IntentType = 'message' | 'image' | 'file' | 'web_search';

interface ThinkingIndicatorProps {
  userMessage?: string;
  completed?: boolean;
  style?: ViewStyle;
  mode?: string;
}

const INTENT_KEYWORDS: Record<IntentType, string[]> = {
  image: [
    'logo', 'image', 'img', 'design', 'picture', 'photo', 'draw', 'generate', 'create image',
    'create a logo', 'make a logo', 'design a logo', 'create an image', 'make an image',
    'create art', 'illustration', 'sketch', 'paint', 'banner', 'icon', 'thumbnail', 'visual',
    'kreye', 'desine', 'fe foto', 'fe imaj', 'fe logo',
    'créer', 'générer', 'dessiner', 'crear', 'generar',
  ],
  file: ['file', 'pdf', 'document', 'spreadsheet', 'excel', 'csv', 'download', 'chatbot', 'html', 'code', 'create', 'build', 'write', 'script'],
  web_search: ['search', 'find', 'look up', 'google', 'browse', 'web', 'search for', 'latest', 'current', 'news'],
  message: [],
};

function detectIntent(message?: string, mode?: string): IntentType {
  if (mode === 'creating_image' || mode === 'editing_image') return 'image';
  if (!message) return 'message';
  const msg = message.toLowerCase();
  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
    if (keywords.some(kw => msg.includes(kw))) return intent as IntentType;
  }
  return 'message';
}

// ── Rotating ring ──
const RotatingRing = memo(function RotatingRing({ color, size = 32 }: { color: string; size?: number }) {
  const rotation = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.timing(rotation, { toValue: 1, duration: 1200, easing: Easing.linear, useNativeDriver: true })
    );
    anim.start();
    return () => anim.stop();
  }, []);
  const rotate = rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <Animated.View style={{ width: size, height: size, transform: [{ rotate }] }}>
      <View style={{
        width: size, height: size, borderRadius: size / 2,
        borderWidth: 2.5, borderColor: 'transparent',
        borderTopColor: color, borderRightColor: color + '55',
      }} />
    </Animated.View>
  );
});

// ── Pulsing icon ──
const PulsingIcon = memo(function PulsingIcon({
  name, color, size = 14, bgColor,
}: { name: keyof typeof Ionicons.glyphMap; color: string; size?: number; bgColor: string }) {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.18, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);
  return (
    <Animated.View style={{
      width: 32, height: 32, borderRadius: 16,
      backgroundColor: bgColor,
      alignItems: 'center', justifyContent: 'center',
      transform: [{ scale }],
    }}>
      <Ionicons name={name} size={size} color={color} />
    </Animated.View>
  );
});

// ── Ring + icon combo ──
const SpinningBadge = memo(function SpinningBadge({
  icon, iconColor, ringColor, bgColor,
}: { icon: keyof typeof Ionicons.glyphMap; iconColor: string; ringColor: string; bgColor: string }) {
  return (
    <View style={{ width: 38, height: 38, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ position: 'absolute' }}>
        <RotatingRing color={ringColor} size={38} />
      </View>
      <PulsingIcon name={icon} color={iconColor} size={15} bgColor={bgColor} />
    </View>
  );
});

// ── 3-dot typing animation ──
const ThinkingDots = memo(function ThinkingDots({ color }: { color: string }) {
  const dots = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];
  useEffect(() => {
    const anims = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(dot, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0.25, duration: 300, useNativeDriver: true }),
          Animated.delay(500 - i * 160),
        ])
      )
    );
    anims.forEach(a => a.start());
    return () => anims.forEach(a => a.stop());
  }, []);
  return (
    <View style={dotStyles.row}>
      {dots.map((dot, i) => (
        <Animated.View key={i} style={[dotStyles.dot, { backgroundColor: color, opacity: dot }]} />
      ))}
    </View>
  );
});
const dotStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
});

// ── Shimmer label ──
const ShimmerLabel = memo(function ShimmerLabel({ text, color }: { text: string; color: string }) {
  const opacity = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);
  return (
    <Animated.Text style={{ color, fontSize: 13, fontWeight: '500', opacity }}>
      {text}
    </Animated.Text>
  );
});

// ── Full shimmer image card (like the reference) ──
const ImageShimmerCard = memo(function ImageShimmerCard({ isDark }: { isDark: boolean }) {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        Animated.timing(shimmer, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  const bg1 = isDark ? '#1a1a2e' : '#e8e8f0';
  const bg2 = isDark ? '#16213e' : '#d0d0e0';
  const bg3 = isDark ? '#0f0f23' : '#c0c0d0';

  const backgroundColor = shimmer.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [bg1, bg2, bg3],
  });

  const cardW = Math.min(SCREEN_WIDTH - 32, 360);
  const cardH = Math.round(cardW * 1.1); // slightly taller than wide — similar to reference

  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 6 }}>
      <Text style={{ color: isDark ? 'rgba(255,255,255,0.85)' : '#111', fontSize: 20, fontWeight: '400', marginBottom: 14 }}>
        Creating image
      </Text>
      <Animated.View
        style={{
          width: cardW,
          height: cardH,
          borderRadius: 20,
          backgroundColor,
          overflow: 'hidden',
        }}
      >
        {/* inner glow overlay */}
        <View
          style={{
            ...StyleSheet.absoluteFillObject,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)',
          }}
        />
      </Animated.View>
    </View>
  );
});

export function ThinkingIndicator({ userMessage = '', completed = false, style, mode }: ThinkingIndicatorProps) {
  const { colors, isDark } = useTheme();
  const intent = detectIntent(userMessage, mode);

  // ── Completed state ──
  if (completed) {
    const doneMap: Record<IntentType, string> = {
      image: '✨ Image created',
      file: '📄 File ready',
      web_search: '🔍 Search complete',
      message: '✓ Done',
    };
    return (
      <View style={[styles.wrapper, style]}>
        <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '500' }}>{doneMap[intent]}</Text>
      </View>
    );
  }

  // ── Image creation — show shimmer card ──
  if (intent === 'image') {
    return (
      <View style={[styles.imageWrapper, style]}>
        <ImageShimmerCard isDark={isDark} />
      </View>
    );
  }

  // ── Web search ──
  if (intent === 'web_search') {
    const q = userMessage?.replace(/search|find|look up|google|browse|web|latest|news|current/gi, '').trim();
    const label = q && q.length > 3 ? `Searching "${q.slice(0, 28)}${q.length > 28 ? '…' : ''}"` : 'Searching the web...';
    return (
      <View style={[styles.wrapper, style]}>
        <SpinningBadge icon="globe-outline" iconColor="#5AC8FA" ringColor="#5AC8FA" bgColor="rgba(90,200,250,0.15)" />
        <ShimmerLabel text={label} color={colors.textSecondary} />
      </View>
    );
  }

  // ── File / code generation ──
  if (intent === 'file') {
    return (
      <View style={[styles.wrapper, style]}>
        <SpinningBadge icon="code-slash-outline" iconColor="#FF9F0A" ringColor="#FF9F0A" bgColor="rgba(255,159,10,0.15)" />
        <ShimmerLabel text="Generating..." color={colors.textSecondary} />
      </View>
    );
  }

  // ── Default: brain icon + dots ──
  return (
    <View style={[styles.wrapper, style]}>
      <SpinningBadge
        icon="bulb-outline"
        iconColor={isDark ? '#A8A8B3' : '#666'}
        ringColor={isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.15)'}
        bgColor={isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)'}
      />
      <ThinkingDots color={colors.textSecondary} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  imageWrapper: {
    paddingVertical: 10,
  },
});
