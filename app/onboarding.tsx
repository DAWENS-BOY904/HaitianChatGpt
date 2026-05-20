import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  StatusBar,
  Platform,
  FlatList,
  ViewToken,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const ONBOARDING_KEY = 'dawinix_onboarding_complete';

export async function hasSeenOnboarding(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(ONBOARDING_KEY);
    return val === 'true';
  } catch {
    return false;
  }
}

export async function markOnboardingComplete(): Promise<void> {
  try {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
  } catch {}
}

// ─── Onboarding slides data ───────────────────────────────────────────────────
const SLIDES = [
  {
    id: '1',
    image: require('../assets/images/onboarding-1.png'),
    title: 'Meet Your AI Assistant',
    subtitle:
      'Dawinix brings the power of GPT-4o, Claude, and Gemini into one elegant chat experience. Ask anything — get instant, intelligent answers.',
    accent: '#10A37F',
    gradientStart: '#000000',
    gradientEnd: '#0A1A12',
    chipLabel: 'AI Chat',
    chipIcon: '✦',
  },
  {
    id: '2',
    image: require('../assets/images/onboarding-2.png'),
    title: 'Talk, Listen & Create',
    subtitle:
      'Use your voice to chat hands-free, generate AI images, analyze photos, and even identify songs with Shazam — all in one place.',
    accent: '#5AC8FA',
    gradientStart: '#000000',
    gradientEnd: '#001A2E',
    chipLabel: 'Voice & Vision',
    chipIcon: '🎙',
  },
  {
    id: '3',
    image: require('../assets/images/onboarding-3.png'),
    title: 'Unlock Your Full Potential',
    subtitle:
      'Upgrade to Plus for unlimited messages, advanced AI models, file uploads, group chats, and priority access to every new feature.',
    accent: '#BF5AF2',
    gradientStart: '#000000',
    gradientEnd: '#1A0A2E',
    chipLabel: 'Premium',
    chipIcon: '✦',
  },
];

// ─── Dot indicator ─────────────────────────────────────────────────────────────
function DotIndicator({ count, active, accent }: { count: number; active: number; accent: string }) {
  return (
    <View style={dotStyles.row}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={[
            dotStyles.dot,
            {
              width: i === active ? 24 : 7,
              backgroundColor: i === active ? accent : 'rgba(255,255,255,0.3)',
            },
          ]}
        />
      ))}
    </View>
  );
}

const dotStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { height: 7, borderRadius: 4, transition: 'all 0.3s' },
});

// ─── Single slide component ───────────────────────────────────────────────────
function OnboardingSlide({
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
  const translateY = scrollX.interpolate({ inputRange, outputRange: [40, 0, -40], extrapolate: 'clamp' });
  const imageScale = scrollX.interpolate({ inputRange, outputRange: [0.88, 1, 0.88], extrapolate: 'clamp' });

  return (
    <View style={[slideStyles.slide, { width: SCREEN_W }]}>
      {/* Hero image */}
      <Animated.View style={[slideStyles.imageWrap, { transform: [{ scale: imageScale }] }]}>
        <Image
          source={slide.image}
          style={slideStyles.image}
          contentFit="cover"
          transition={300}
        />
        {/* Gradient overlay on image bottom */}
        <LinearGradient
          colors={['transparent', slide.gradientEnd]}
          style={slideStyles.imageGradient}
        />
        {/* Chip badge */}
        <View style={[slideStyles.chip, { backgroundColor: slide.accent + '22', borderColor: slide.accent + '55' }]}>
          <Text style={{ fontSize: 13 }}>{slide.chipIcon} </Text>
          <Text style={[slideStyles.chipText, { color: slide.accent }]}>{slide.chipLabel}</Text>
        </View>
      </Animated.View>

      {/* Text content */}
      <Animated.View style={[slideStyles.textBlock, { opacity, transform: [{ translateY }] }]}>
        <Text style={slideStyles.title}>{slide.title}</Text>
        <Text style={slideStyles.subtitle}>{slide.subtitle}</Text>
      </Animated.View>
    </View>
  );
}

const slideStyles = StyleSheet.create({
  slide: { flex: 1, alignItems: 'center' },
  imageWrap: {
    width: SCREEN_W - 40,
    height: SCREEN_H * 0.48,
    borderRadius: 28,
    overflow: 'hidden',
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.55,
    shadowRadius: 24,
    elevation: 18,
  },
  image: { width: '100%', height: '100%' },
  imageGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '45%',
  },
  chip: {
    position: 'absolute',
    top: 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 50,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backdropFilter: 'blur(10px)',
  },
  chipText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
  textBlock: {
    paddingHorizontal: 28,
    paddingTop: 28,
    alignItems: 'center',
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 36,
    letterSpacing: -0.3,
    marginBottom: 14,
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.62)',
    textAlign: 'center',
    lineHeight: 23,
  },
});

// ─── Main onboarding screen ───────────────────────────────────────────────────
export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef<FlatList>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const slide = SLIDES[currentIndex];

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index ?? 0);
    }
  }).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const handleNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
    } else {
      handleFinish();
    }
  };

  const handleFinish = async () => {
    await markOnboardingComplete();
    router.replace('/login');
  };

  const isLast = currentIndex === SLIDES.length - 1;
  const accent = slide.accent;

  return (
    <View style={[styles.container, { backgroundColor: '#000' }]}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        {/* Background gradient that shifts per slide */}
        <LinearGradient
          colors={[slide.gradientStart, slide.gradientEnd]}
          style={StyleSheet.absoluteFillObject}
        />

        {/* Skip button — top right */}
        <TouchableOpacity
          style={[styles.skipBtn, { top: insets.top + 12 }]}
          onPress={handleFinish}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>

        {/* Slides */}
        <Animated.FlatList
          ref={flatListRef}
          data={SLIDES}
          keyExtractor={(item) => item.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          bounces={false}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
            useNativeDriver: true,
          })}
          scrollEventThrottle={16}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          renderItem={({ item, index }) => (
            <OnboardingSlide slide={item} index={index} scrollX={scrollX} />
          )}
          style={{ flex: 1, marginTop: insets.top + 48 }}
        />

        {/* Bottom controls */}
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 24) + 16 }]}>
          {/* Dot indicators */}
          <DotIndicator count={SLIDES.length} active={currentIndex} accent={accent} />

          {/* Continue / Get Started button */}
          <TouchableOpacity
            style={[styles.nextBtn, { backgroundColor: accent }]}
            onPress={handleNext}
            activeOpacity={0.86}
          >
            <Text style={styles.nextBtnText}>
              {isLast ? 'Get Started' : 'Continue'}
            </Text>
          </TouchableOpacity>

          {/* Bottom fine-print on last screen */}
          {isLast ? (
            <Text style={styles.finePrint}>
              By continuing you agree to our Terms & Privacy Policy
            </Text>
          ) : null}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  skipBtn: {
    position: 'absolute',
    right: 20,
    zIndex: 10,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  skipText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 14,
    fontWeight: '600',
  },
  bottomBar: {
    paddingHorizontal: 28,
    paddingTop: 20,
    alignItems: 'center',
    gap: 20,
  },
  nextBtn: {
    width: '100%',
    borderRadius: 50,
    paddingVertical: 17,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  nextBtnText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  finePrint: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
  },
});
