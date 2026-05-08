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
  isGroupMode?: boolean;
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
    if (intent === 'message') continue;
    if (keywords.some(kw => msg.includes(kw))) return intent as IntentType;
  }
  return 'message';
}

// ── Shimmer glow border around containers ──────────────────────────────────
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

// ── Single pulsing round dot ─────────────────────────────────────────────────
const ThinkingDots = memo(function ThinkingDots({ color }: { color: string }) {
  const scale = useRef(new Animated.Value(0.5)).current;
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale, { toValue: 1.3, duration: 600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(scale, { toValue: 0.5, duration: 600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.4, duration: 600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <View style={dotStyles.row}>
      <Animated.View style={[dotStyles.dot, { backgroundColor: color, opacity, transform: [{ scale }] }]} />
    </View>
  );
});
const dotStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4 },
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

// ── Cycling status labels (Thinking / Analyzing / Generating) ───────────────
const STATUS_CYCLES: Record<IntentType, string[]> = {
  message:    ['Thinking…', 'Analyzing…', 'Generating…', 'Refining…'],
  image:      ['Thinking…', 'Designing…', 'Rendering…', 'Polishing…'],
  file:       ['Analyzing…', 'Writing code…', 'Generating…', 'Finalizing…'],
  web_search: ['Searching…', 'Browsing…', 'Reading…', 'Summarizing…'],
};

function useCyclingLabel(intent: IntentType): string {
  const labels = STATUS_CYCLES[intent] || STATUS_CYCLES.message;
  const [idx, setIdx] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const cycle = setInterval(() => {
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
        setIdx(i => (i + 1) % labels.length);
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      });
    }, 2200);
    return () => clearInterval(cycle);
  }, [intent, labels.length]);

  return labels[idx];
}

// ── Dynamic step label hook ────────────────────────────────────────────────
type StepConfig = { label: string; minSec: number; maxSec: number };

function useStepLabel(intent: IntentType, elapsed: number): string {
  const steps: Record<IntentType, StepConfig[]> = {
    message: [
      { label: 'Thinking…', minSec: 0, maxSec: 3 },
      { label: 'Analyzing your question…', minSec: 3, maxSec: 7 },
      { label: 'Generating response…', minSec: 7, maxSec: 15 },
      { label: 'Refining answer…', minSec: 15, maxSec: 999 },
    ],
    image: [
      { label: 'Thinking…', minSec: 0, maxSec: 3 },
      { label: 'Designing composition…', minSec: 3, maxSec: 9 },
      { label: 'Rendering image…', minSec: 9, maxSec: 20 },
      { label: 'Applying final details…', minSec: 20, maxSec: 999 },
    ],
    file: [
      { label: 'Analyzing request…', minSec: 0, maxSec: 3 },
      { label: 'Writing code…', minSec: 3, maxSec: 9 },
      { label: 'Building file structure…', minSec: 9, maxSec: 18 },
      { label: 'Finalizing output…', minSec: 18, maxSec: 999 },
    ],
    web_search: [
      { label: 'Searching the web…', minSec: 0, maxSec: 3 },
      { label: 'Browsing results…', minSec: 3, maxSec: 7 },
      { label: 'Reading pages…', minSec: 7, maxSec: 13 },
      { label: 'Summarizing findings…', minSec: 13, maxSec: 999 },
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

// ── Fade+scale entry wrapper ─────────────────────────────────────────────
const AnimatedEntry = memo(function AnimatedEntry({ children, style }: { children: React.ReactNode; style?: any }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.92)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, tension: 260, friction: 22, useNativeDriver: true }),
    ]).start();
  }, []);
  return (
    <Animated.View style={[{ opacity, transform: [{ scale }] }, style]}>
      {children}
    </Animated.View>
  );
});

// ── Main ThinkingIndicator ────────────────────────────────────────────────
export function ThinkingIndicator({
  userMessage = '',
  completed = false,
  style,
  mode,
  onCancel,
  isGroupMode = false,
}: ThinkingIndicatorProps) {
  const { colors, isDark } = useTheme();
  const intent = detectIntent(userMessage, mode);
  const elapsed = useElapsedSeconds();
  const stepLabel = useStepLabel(intent, elapsed);
  const cyclingLabel = useCyclingLabel(intent);

  // Accent color (green default)
  const accentColor = '#10A37F';

  const showCancel = elapsed >= 10 && !!onCancel;
  const elapsedLabel = elapsed >= 5 ? ` · ${elapsed}s` : '';

  // ── Completed state ──
  if (completed) {
    const doneMap: Record<IntentType, string> = {
      image: 'Image created',
      file: 'File ready',
      web_search: 'Search complete',
      message: 'Done',
    };
    return (
      <AnimatedEntry>
        <View style={[styles.wrapper, style]}>
          <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '500' }}>{doneMap[intent]}</Text>
        </View>
      </AnimatedEntry>
    );
  }

  // ── Image creation — show shimmer card ──
  if (intent === 'image') {
    return (
      <AnimatedEntry>
        <View style={[styles.imageWrapper, style]}>
          <ImageShimmerCard
            isDark={isDark}
            accentColor="#8B5CF6"
            elapsed={elapsed}
            onCancel={onCancel}
            stepLabel={stepLabel}
          />
        </View>
      </AnimatedEntry>
    );
  }

  // ── Web search ──
  if (intent === 'web_search') {
    const q = userMessage?.replace(/search|find|look up|google|browse|web|latest|news|current/gi, '').trim();
    const baseQ = q && q.length > 3 ? `"${q.slice(0, 28)}${q.length > 28 ? '…' : ''}"` : '';
    return (
      <AnimatedEntry>
        <View style={[styles.containerCard, { borderColor: isDark ? 'rgba(90,200,250,0.25)' : 'rgba(90,200,250,0.4)' }, style]}>
          <ShimmerGlowBorder color="#5AC8FA" visible />
          <View style={styles.rowContent}>
            <SpinningBadge icon="globe-outline" iconColor="#5AC8FA" ringColor="#5AC8FA" bgColor="rgba(90,200,250,0.15)" />
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>
                {stepLabel}{elapsedLabel}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <ThinkingDots color="#5AC8FA" />
                {baseQ ? <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Searching {baseQ}</Text> : null}
              </View>
            </View>
            {showCancel && (
              <TouchableOpacity onPress={onCancel} style={styles.cancelBtn}>
                <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </AnimatedEntry>
    );
  }

  // ── File / code generation ──
  if (intent === 'file') {
    return (
      <AnimatedEntry>
        <View style={[styles.containerCard, { borderColor: isDark ? 'rgba(255,159,10,0.25)' : 'rgba(255,159,10,0.4)' }, style]}>
          <ShimmerGlowBorder color="#FF9F0A" visible />
          <View style={styles.rowContent}>
            <SpinningBadge icon="code-slash-outline" iconColor="#FF9F0A" ringColor="#FF9F0A" bgColor="rgba(255,159,10,0.15)" />
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>
                {stepLabel}{elapsedLabel}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <ThinkingDots color="#FF9F0A" />
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Building…</Text>
              </View>
            </View>
            {showCancel && (
              <TouchableOpacity onPress={onCancel} style={styles.cancelBtn}>
                <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </AnimatedEntry>
    );
  }

  // ── Default: message thinking ──
  const iconColor = isDark ? '#A8A8B3' : '#888';
  const bgColor = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)';
  const borderColor = isDark ? 'rgba(16,163,127,0.25)' : 'rgba(16,163,127,0.35)';
  // Card background — dark enough in both modes so white dots are visible
  const cardBg = isDark ? 'rgba(28,28,30,0.96)' : 'rgba(50,50,50,0.88)';
  // Dots are always white — they show on the dark card background
  const dotsColor = '#FFFFFF';

  // Group mode — ChatGPT-style inline text indicator
  if (isGroupMode) {
    return (
      <AnimatedEntry>
        <GroupThinkingIndicator isDark={isDark} colors={colors} onCancel={onCancel} showCancel={showCancel} elapsed={elapsed} />
      </AnimatedEntry>
    );
  }

  return (
    <AnimatedEntry>
      <View style={[styles.containerCard, { borderColor, backgroundColor: cardBg }, style]}>
        <ShimmerGlowBorder color={accentColor} visible />
        <View style={styles.rowContent}>
          <SpinningBadge icon="sparkles-outline" iconColor={iconColor} ringColor={accentColor + '55'} bgColor={bgColor} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>
              {cyclingLabel}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <ThinkingDots color={dotsColor} />
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
    </AnimatedEntry>
  );
}

// ── Group chat "Dawinix is taking a look" indicator ──────────────────────
const GroupThinkingIndicator = memo(function GroupThinkingIndicator({
  isDark, colors, onCancel, showCancel, elapsed,
}: { isDark: boolean; colors: any; onCancel?: () => void; showCancel: boolean; elapsed: number }) {
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const makeDot = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 1, duration: 300, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0.3, duration: 300, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.delay(600 - delay),
        ])
      );
    const a1 = makeDot(dot1, 0);
    const a2 = makeDot(dot2, 200);
    const a3 = makeDot(dot3, 400);
    a1.start(); a2.start(); a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, []);

  const dotColor = isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.45)';
  const textColor = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)';

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 6 }}>
      <Text style={{ color: textColor, fontSize: 14, fontWeight: '400' }}>Dawinix is taking a look</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginLeft: 2 }}>
        {[dot1, dot2, dot3].map((dot, i) => (
          <Animated.View key={i} style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: dotColor, opacity: dot }} />
        ))}
      </View>
      {showCancel && onCancel ? (
        <TouchableOpacity onPress={onCancel} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ marginLeft: 8 }}>
          <Ionicons name="stop-circle-outline" size={18} color={textColor} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
});

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

