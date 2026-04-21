import React, { useEffect, useRef, memo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  ViewStyle,
  Dimensions,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type IntentType = 'message' | 'image' | 'file' | 'web_search';

interface ThinkingIndicatorProps {
  userMessage?: string;
  completed?: boolean;
  style?: ViewStyle;
  mode?: string;
  onCancel?: () => void;
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

// ── Shimmer glow border around container ──────────────────────────────────
const ShimmerGlowBorder = memo(function ShimmerGlowBorder({
  color,
  visible,
}: {
  color: string;
  visible: boolean;
}) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(anim, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [visible]);

  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.85] });
  const shadowRadius = anim.interpolate({ inputRange: [0, 1], outputRange: [4, 14] });

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFillObject,
        {
          borderRadius: 18,
          borderWidth: 1.5,
          borderColor: color,
          opacity,
          ...Platform.select({
            ios: { shadowColor: color, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius },
            android: { elevation: 6 },
          }),
        },
      ]}
      pointerEvents="none"
    />
  );
});

// ── Rotating ring ──────────────────────────────────────────────────────────
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

// ── Pulsing icon ──────────────────────────────────────────────────────────
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

// ── Ring + icon combo ──────────────────────────────────────────────────────
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

// ── 3-dot typing animation ─────────────────────────────────────────────────
const ThinkingDots = memo(function ThinkingDots({ color }: { color: string }) {
  const dots = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ];
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

// ── Shimmer label (fading) ─────────────────────────────────────────────────
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

// ── Dynamic step label hook ────────────────────────────────────────────────
type StepConfig = { label: string; minSec: number; maxSec: number };

function useStepLabel(intent: IntentType, elapsed: number): string {
  const steps: Record<IntentType, StepConfig[]> = {
    message: [
      { label: 'Step 1: Understanding your question…', minSec: 0, maxSec: 4 },
      { label: 'Step 2: Gathering knowledge…', minSec: 4, maxSec: 9 },
      { label: 'Step 3: Composing your answer…', minSec: 9, maxSec: 18 },
      { label: 'Step 4: Refining response…', minSec: 18, maxSec: 999 },
    ],
    image: [
      { label: 'Step 1: Interpreting your prompt…', minSec: 0, maxSec: 4 },
      { label: 'Step 2: Designing composition…', minSec: 4, maxSec: 10 },
      { label: 'Step 3: Rendering image…', minSec: 10, maxSec: 22 },
      { label: 'Step 4: Applying final details…', minSec: 22, maxSec: 999 },
    ],
    file: [
      { label: 'Step 1: Analyzing request…', minSec: 0, maxSec: 4 },
      { label: 'Step 2: Writing code…', minSec: 4, maxSec: 10 },
      { label: 'Step 3: Building file structure…', minSec: 10, maxSec: 20 },
      { label: 'Step 4: Finalizing output…', minSec: 20, maxSec: 999 },
    ],
    web_search: [
      { label: 'Step 1: Formulating search query…', minSec: 0, maxSec: 3 },
      { label: 'Step 2: Browsing the web…', minSec: 3, maxSec: 8 },
      { label: 'Step 3: Reading results…', minSec: 8, maxSec: 14 },
      { label: 'Step 4: Summarizing findings…', minSec: 14, maxSec: 999 },
    ],
  };

  const list = steps[intent] || steps.message;
  const current = list.find(s => elapsed >= s.minSec && elapsed < s.maxSec) || list[list.length - 1];
  return current.label;
}

// ── Elapsed-time hook ──────────────────────────────────────────────────────
function useElapsedSeconds(): number {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());
  useEffect(() => {
    startRef.current = Date.now();
    setElapsed(0);
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 500);
    return () => clearInterval(id);
  }, []);
  return elapsed;
}

// ── Full shimmer image card ───────────────────────────────────────────────
const ImageShimmerCard = memo(function ImageShimmerCard({
  isDark,
  accentColor,
  elapsed,
  onCancel,
  stepLabel,
}: {
  isDark: boolean;
  accentColor: string;
  elapsed: number;
  onCancel?: () => void;
  stepLabel: string;
}) {
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
  const backgroundColor = shimmer.interpolate({ inputRange: [0, 0.5, 1], outputRange: [bg1, bg2, bg3] });

  const cardW = Math.min(SCREEN_WIDTH - 32, 360);
  const cardH = Math.round(cardW * 1.1);
  const elapsedLabel = elapsed >= 5 ? ` (${elapsed}s)` : '';

  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 6 }}>
      <Text style={{ color: isDark ? 'rgba(255,255,255,0.85)' : '#111', fontSize: 20, fontWeight: '400', marginBottom: 6 }}>
        Creating image
      </Text>
      <Text style={{ color: isDark ? 'rgba(255,255,255,0.45)' : '#666', fontSize: 13, marginBottom: 12 }}>
        {stepLabel}{elapsedLabel}
      </Text>

      <View style={{ position: 'relative' }}>
        <Animated.View
          style={{
            width: cardW,
            height: cardH,
            borderRadius: 20,
            backgroundColor,
            overflow: 'hidden',
          }}
        >
          <ShimmerGlowBorder color={accentColor} visible />
          <View
            style={{
              ...StyleSheet.absoluteFillObject,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)',
            }}
          />
        </Animated.View>

        {/* Cancel button — appears after 10s */}
        {elapsed >= 10 && onCancel ? (
          <TouchableOpacity
            style={{
              position: 'absolute',
              bottom: 16,
              right: 16,
              backgroundColor: 'rgba(0,0,0,0.6)',
              borderRadius: 20,
              paddingHorizontal: 14,
              paddingVertical: 8,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
            }}
            onPress={onCancel}
          >
            <Ionicons name="stop-circle-outline" size={16} color="#FFF" />
            <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '600' }}>Cancel</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
});

// ── Main ThinkingIndicator ────────────────────────────────────────────────
export function ThinkingIndicator({
  userMessage = '',
  completed = false,
  style,
  mode,
  onCancel,
}: ThinkingIndicatorProps) {
  const { colors, isDark } = useTheme();
  const intent = detectIntent(userMessage, mode);
  const elapsed = useElapsedSeconds();
  const stepLabel = useStepLabel(intent, elapsed);

  // Accent color (green default)
  const accentColor = '#10A37F';
  const glowColor =
    intent === 'image' ? '#8B5CF6'
    : intent === 'web_search' ? '#5AC8FA'
    : intent === 'file' ? '#FF9F0A'
    : accentColor;

  const showCancel = elapsed >= 10 && !!onCancel;
  const elapsedLabel = elapsed >= 5 ? ` (${elapsed}s)` : '';

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
        <ImageShimmerCard
          isDark={isDark}
          accentColor="#8B5CF6"
          elapsed={elapsed}
          onCancel={onCancel}
          stepLabel={stepLabel}
        />
      </View>
    );
  }

  // ── Web search ──
  if (intent === 'web_search') {
    const q = userMessage?.replace(/search|find|look up|google|browse|web|latest|news|current/gi, '').trim();
    const baseQ = q && q.length > 3 ? `"${q.slice(0, 28)}${q.length > 28 ? '…' : ''}"` : '';
    return (
      <View style={[styles.containerCard, { borderColor: isDark ? 'rgba(90,200,250,0.25)' : 'rgba(90,200,250,0.4)' }, style]}>
        <ShimmerGlowBorder color="#5AC8FA" visible />
        <View style={styles.rowContent}>
          <SpinningBadge icon="globe-outline" iconColor="#5AC8FA" ringColor="#5AC8FA" bgColor="rgba(90,200,250,0.15)" />
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>
              {stepLabel}{elapsedLabel}
            </Text>
            {baseQ ? <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Searching {baseQ}</Text> : null}
          </View>
          {showCancel && (
            <TouchableOpacity onPress={onCancel} style={styles.cancelBtn}>
              <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  // ── File / code generation ──
  if (intent === 'file') {
    return (
      <View style={[styles.containerCard, { borderColor: isDark ? 'rgba(255,159,10,0.25)' : 'rgba(255,159,10,0.4)' }, style]}>
        <ShimmerGlowBorder color="#FF9F0A" visible />
        <View style={styles.rowContent}>
          <SpinningBadge icon="code-slash-outline" iconColor="#FF9F0A" ringColor="#FF9F0A" bgColor="rgba(255,159,10,0.15)" />
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>
              {stepLabel}{elapsedLabel}
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Generating code & files…</Text>
          </View>
          {showCancel && (
            <TouchableOpacity onPress={onCancel} style={styles.cancelBtn}>
              <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  // ── Default: message thinking ──
  const ringColor = isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)';
  const iconColor = isDark ? '#A8A8B3' : '#666';
  const bgColor = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)';
  const borderColor = isDark ? 'rgba(16,163,127,0.2)' : 'rgba(16,163,127,0.3)';

  return (
    <View style={[styles.containerCard, { borderColor }, style]}>
      <ShimmerGlowBorder color={accentColor} visible />
      <View style={styles.rowContent}>
        <SpinningBadge icon="bulb-outline" iconColor={iconColor} ringColor={ringColor} bgColor={bgColor} />
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>
            {stepLabel}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <ThinkingDots color={colors.textSecondary} />
            {elapsed >= 5 ? (
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{elapsed}s</Text>
            ) : null}
          </View>
        </View>
        {showCancel && (
          <TouchableOpacity onPress={onCancel} style={styles.cancelBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>
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
  containerCard: {
    marginHorizontal: 12,
    marginVertical: 6,
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  rowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  imageWrapper: {
    paddingVertical: 10,
  },
  cancelBtn: {
    padding: 4,
  },
});
