import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  FlatList,
  Animated,
  Platform,
  StatusBar,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../hooks/useTheme';

export const ONBOARDING_DONE_KEY = 'onboarding_completed_v1';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// ─── Slide Data ──────────────────────────────────────────────────────────────
const SLIDES = [
  {
    id: '1',
    image: require('../assets/images/onboarding-1.png'),
    accentColor: '#10A37F',
    badge: 'AI CHAT',
    badgeIcon: 'chatbubbles-outline' as const,
    title: 'Chat with the\nSmartest AI',
    subtitle:
      'Ask anything — get instant, accurate answers powered by the latest GPT, Claude, and Gemini models. Context-aware conversations that actually remember what you said.',
    features: [
      { icon: 'flash-outline' as const, label: 'Instant smart replies' },
      { icon: 'layers-outline' as const, label: 'Multi-model AI support' },
      { icon: 'time-outline' as const, label: 'Full conversation memory' },
    ],
  },
  {
    id: '2',
    image: require('../assets/images/onboarding-2.png'),
    accentColor: '#5AC8FA',
    badge: 'VOICE MODE',
    badgeIcon: 'mic-outline' as const,
    title: 'Talk, Listen &\nCreate with Voice',
    subtitle:
      'Speak naturally and get spoken-back AI responses. Upload images, files, or audio — Dawinix can see, hear, and understand everything you share.',
    features: [
      { icon: 'mic-outline' as const, label: 'Voice input & output' },
      { icon: 'image-outline' as const, label: 'Image & file analysis' },
      { icon: 'globe-outline' as const, label: 'Multi-language support' },
    ],
  },
  {
    id: '3',
    image: require('../assets/images/onboarding-3.png'),
    accentColor: '#FFD60A',
    badge: 'GO PLUS',
    badgeIcon: 'star-outline' as const,
    title: 'Unlock the Full\nAI Experience',
    subtitle:
      'Upgrade to Go or Plus for unlimited messages, advanced AI models, image generation, group chats, and priority access to every new feature.',
    features: [
      { icon: 'infinite-outline' as const, label: 'Unlimited messages' },
      { icon: 'color-wand-outline' as const, label: 'AI image generation' },
      { icon: 'people-outline' as const, label: 'Group AI chats' },
    ],
  },
];

// ─── Dot Indicator ───────────────────────────────────────────────────────────
function DotIndicator({ count, active }: { count: number; active: number }) {
  return (
    <View style={dotStyles.row}>
      {Array.from({ length: count }).map((_, i) => {
        const isActive = i === active;
        const accentColor = SLIDES[active].accentColor;
        return (
          <Animated.View
            key={i}
            style={[
              dotStyles.dot,
              {
                width: isActive ? 24 : 8,
                backgroundColor: isActive ? accentColor : 'rgba(255,255,255,0.28)',
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const dotStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { height: 8, borderRadius: 4 },
});

// ─── Feature Row ─────────────────────────────────────────────────────────────
function FeatureRow({
  icon,
  label,
  accentColor,
}: {
  icon: string;
  label: string;
  accentColor: string;
}) {
  return (
    <View style={featureStyles.row}>
      <View style={[featureStyles.iconWrap, { backgroundColor: accentColor + '22' }]}>
        <Ionicons name={icon as any} size={16} color={accentColor} />
      </View>
      <Text style={featureStyles.label}>{label}</Text>
    </View>
  );
}

const featureStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { color: 'rgba(255,255,255,0.85)', fontSize: 15, fontWeight: '500' },
});

// ─── Individual Slide ─────────────────────────────────────────────────────────
function SlideItem({
  slide,
  index,
  scrollX,
}: {
  slide: (typeof SLIDES)[0];
  index: number;
  scrollX: Animated.Value;
}) {
  const inputRange = [(index - 1) * SCREEN_W, index * SCREEN_W, (index + 1) * SCREEN_W];
  const opacity = scrollX.interpolate({ inputRange, outputRange: [0, 1, 0], extrapolate: 'clamp' });
  const translateY = scrollX.interpolate({
    inputRange,
    outputRange: [30, 0, 30],
    extrapolate: 'clamp',
  });

  const imageH = Math.min(SCREEN_H * 0.42, 340);

  return (
    <View style={{ width: SCREEN_W }}>
      {/* Hero Image */}
      <View style={[slideStyles.imageContainer, { height: imageH }]}>
        <Image
          source={slide.image}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={400}
        />
        {/* gradient overlay */}
        <View style={slideStyles.imageGradient} />
      </View>

      {/* Text content */}
      <Animated.View
        style={[slideStyles.textContent, { opacity, transform: [{ translateY }] }]}
      >
        {/* Badge */}
        <View style={[slideStyles.badge, { backgroundColor: slide.accentColor + '22', borderColor: slide.accentColor + '55' }]}>
          <Ionicons name={slide.badgeIcon} size={12} color={slide.accentColor} />
          <Text style={[slideStyles.badgeText, { color: slide.accentColor }]}>{slide.badge}</Text>
        </View>

        {/* Title */}
        <Text style={slideStyles.title}>{slide.title}</Text>

        {/* Subtitle */}
        <Text style={slideStyles.subtitle}>{slide.subtitle}</Text>

        {/* Features */}
        <View style={{ marginTop: 8 }}>
          {slide.features.map((f) => (
            <FeatureRow key={f.label} icon={f.icon} label={f.label} accentColor={slide.accentColor} />
          ))}
        </View>
      </Animated.View>
    </View>
  );
}

const slideStyles = StyleSheet.create({
  imageContainer: { width: SCREEN_W, overflow: 'hidden' },
  imageGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    // Simulate gradient: bottom fade to black
    bottom: 0,
    top: '45%',
    backgroundImage: undefined,
  },
  textContent: { paddingHorizontal: 28, paddingTop: 24 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    borderRadius: 50,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 14,
  },
  badgeText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  title: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '800',
    lineHeight: 37,
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 22,
  },
});

// ─── Main Onboarding Screen ───────────────────────────────────────────────────
export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const [currentIndex, setCurrentIndex] = useState(0);

  const markDoneAndNavigate = useCallback(async (dest: '/home' | '/login') => {
    await AsyncStorage.setItem(ONBOARDING_DONE_KEY, 'true');
    router.replace(dest);
  }, [router]);

  const goNext = useCallback(() => {
    if (currentIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
    } else {
      markDoneAndNavigate('/login');
    }
  }, [currentIndex, markDoneAndNavigate]);

  const isLast = currentIndex === SLIDES.length - 1;
  const accentColor = SLIDES[currentIndex].accentColor;

  return (
    <View style={mainStyles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* Skip button */}
      <View style={[mainStyles.skipRow, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={mainStyles.skipBtn}
          onPress={() => markDoneAndNavigate('/login')}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={mainStyles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      {/* Slides */}
      <Animated.FlatList
        ref={flatListRef}
        data={SLIDES}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
          useNativeDriver: false,
        })}
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
          setCurrentIndex(idx);
        }}
        renderItem={({ item, index }) => (
          <SlideItem slide={item} index={index} scrollX={scrollX} />
        )}
        style={{ flex: 1 }}
        contentContainerStyle={{ alignItems: 'flex-start' }}
      />

      {/* Bottom Controls */}
      <View style={[mainStyles.bottomRow, { paddingBottom: Math.max(insets.bottom, 20) + 16 }]}>
        {/* Dots */}
        <DotIndicator count={SLIDES.length} active={currentIndex} />

        {/* Buttons row */}
        <View style={mainStyles.buttonsGroup}>
          {/* Get Started / Continue */}
          <TouchableOpacity
            style={[mainStyles.continueBtn, { backgroundColor: accentColor }]}
            onPress={goNext}
            activeOpacity={0.85}
          >
            <Text style={mainStyles.continueBtnText}>
              {isLast ? 'Get Started' : 'Continue'}
            </Text>
            <Ionicons
              name={isLast ? 'rocket-outline' : 'arrow-forward'}
              size={18}
              color="#000"
            />
          </TouchableOpacity>

          {/* Sign in link — shown on last slide */}
          {isLast ? (
            <TouchableOpacity
              style={mainStyles.signinBtn}
              onPress={() => markDoneAndNavigate('/login')}
              activeOpacity={0.75}
            >
              <Text style={mainStyles.signinText}>Already have an account? Log in</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const mainStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  skipRow: {
    position: 'absolute',
    top: 0,
    right: 20,
    zIndex: 100,
  },
  skipBtn: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  skipText: { color: 'rgba(255,255,255,0.75)', fontSize: 14, fontWeight: '600' },
  bottomRow: {
    paddingHorizontal: 28,
    paddingTop: 24,
    gap: 20,
  },
  buttonsGroup: { gap: 12 },
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 50,
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  continueBtnText: { color: '#000', fontSize: 17, fontWeight: '800' },
  signinBtn: { alignItems: 'center', paddingVertical: 4 },
  signinText: { color: 'rgba(255,255,255,0.5)', fontSize: 14 },
});
