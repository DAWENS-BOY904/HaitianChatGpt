import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';

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

// ─── Responsive breakpoints ───────────────────────────────────────────────────
const BREAKPOINTS = {
  mobile: 768,
  tablet: 1024,
  desktop: 1440,
};

function useResponsive() {
  const { width, height } = useWindowDimensions();
  return {
    width,
    height,
    isMobile: width < BREAKPOINTS.mobile,
    isTablet: width >= BREAKPOINTS.mobile && width < BREAKPOINTS.desktop,
    isDesktop: width >= BREAKPOINTS.desktop,
    isWide: width >= BREAKPOINTS.tablet,
  };
}

// ─── Dot indicator ─────────────────────────────────────────────────────────────
function DotIndicator({ count, active, accent }: { count: number; active: number; accent: string }) {
  return (
    <View style={dotStyles.row}>
      {Array.from({ length: count }).map((_, i) => (
        <Animated.View
          key={i}
          style={[
            dotStyles.dot,
            {
              width: i === active ? 28 : 8,
              backgroundColor: i === active ? accent : 'rgba(255,255,255,0.25)',
              opacity: i === active ? 1 : 0.6,
            },
          ]}
        />
      ))}
    </View>
  );
}

const dotStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { height: 8, borderRadius: 4 },
});

// ─── Single slide component ───────────────────────────────────────────────────
function OnboardingSlide({
  slide,
  index,
  scrollX,
  isDesktop,
  isWide,
  contentWidth,
}: {
  slide: (typeof SLIDES)[0];
  index: number;
  scrollX: Animated.Value;
  isDesktop: boolean;
  isWide: boolean;
  contentWidth: number;
}) {
  const inputRange = [
    (index - 1) * contentWidth,
    index * contentWidth,
    (index + 1) * contentWidth,
  ];

  const opacity = scrollX.interpolate({
    inputRange,
    outputRange: [0, 1, 0],
    extrapolate: 'clamp',
  });

  const translateY = scrollX.interpolate({
    inputRange,
    outputRange: [50, 0, -50],
    extrapolate: 'clamp',
  });

  const imageScale = scrollX.interpolate({
    inputRange,
    outputRange: [0.85, 1, 0.85],
    extrapolate: 'clamp',
  });

  const imageTranslateX = scrollX.interpolate({
    inputRange,
    outputRange: [isDesktop ? -60 : -30, 0, isDesktop ? 60 : 30],
    extrapolate: 'clamp',
  });

  // Desktop: side-by-side layout
  if (isDesktop) {
    return (
      <View style={[slideStyles.slideDesktop, { width: contentWidth }]}>
        {/* Left: Image */}
        <Animated.View
          style={[
            slideStyles.imageWrapDesktop,
            {
              transform: [{ scale: imageScale }, { translateX: imageTranslateX }],
            },
          ]}
        >
          <Image
            source={slide.image}
            style={slideStyles.imageDesktop}
            contentFit="cover"
            transition={400}
          />
          <LinearGradient
            colors={['transparent', slide.gradientEnd]}
            style={slideStyles.imageGradientDesktop}
          />
          <View
            style={[
              slideStyles.chip,
              {
                backgroundColor: slide.accent + '22',
                borderColor: slide.accent + '55',
              },
            ]}
          >
            <Text style={{ fontSize: 14 }}>{slide.chipIcon} </Text>
            <Text style={[slideStyles.chipText, { color: slide.accent }]}>
              {slide.chipLabel}
            </Text>
          </View>
        </Animated.View>

        {/* Right: Text content */}
        <Animated.View
          style={[
            slideStyles.textBlockDesktop,
            { opacity, transform: [{ translateY }] },
          ]}
        >
          <Text style={slideStyles.titleDesktop}>{slide.title}</Text>
          <Text style={slideStyles.subtitleDesktop}>{slide.subtitle}</Text>
        </Animated.View>
      </View>
    );
  }

  // Mobile / Tablet: stacked layout
  return (
    <View style={[slideStyles.slide, { width: contentWidth }]}>
      {/* Hero image */}
      <Animated.View
        style={[
          isWide ? slideStyles.imageWrapTablet : slideStyles.imageWrap,
          { transform: [{ scale: imageScale }, { translateX: imageTranslateX }] },
        ]}
      >
        <Image
          source={slide.image}
          style={isWide ? slideStyles.imageTablet : slideStyles.image}
          contentFit="cover"
          transition={300}
        />
        <LinearGradient
          colors={['transparent', slide.gradientEnd]}
          style={isWide ? slideStyles.imageGradientTablet : slideStyles.imageGradient}
        />
        <View
          style={[
            slideStyles.chip,
            {
              backgroundColor: slide.accent + '22',
              borderColor: slide.accent + '55',
            },
          ]}
        >
          <Text style={{ fontSize: 13 }}>{slide.chipIcon} </Text>
          <Text style={[slideStyles.chipText, { color: slide.accent }]}>
            {slide.chipLabel}
          </Text>
        </View>
      </Animated.View>

      {/* Text content */}
      <Animated.View
        style={[
          isWide ? slideStyles.textBlockTablet : slideStyles.textBlock,
          { opacity, transform: [{ translateY }] },
        ]}
      >
        <Text style={isWide ? slideStyles.titleTablet : slideStyles.title}>
          {slide.title}
        </Text>
        <Text style={isWide ? slideStyles.subtitleTablet : slideStyles.subtitle}>
          {slide.subtitle}
        </Text>
      </Animated.View>
    </View>
  );
}

const slideStyles = StyleSheet.create({
  // Mobile styles
  slide: { flex: 1, alignItems: 'center' },
  imageWrap: {
    width: '100%',
    maxWidth: 380,
    height: '48%',
    minHeight: 320,
    borderRadius: 28,
    overflow: 'hidden',
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.5,
    shadowRadius: 32,
    elevation: 20,
  },
  image: { width: '100%', height: '100%' },
  imageGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
  },
  textBlock: {
    paddingHorizontal: 28,
    paddingTop: 28,
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-start',
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
    maxWidth: 340,
  },

  // Tablet styles
  imageWrapTablet: {
    width: '85%',
    maxWidth: 520,
    height: '52%',
    minHeight: 380,
    borderRadius: 32,
    overflow: 'hidden',
    marginTop: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.55,
    shadowRadius: 40,
    elevation: 24,
  },
  imageTablet: { width: '100%', height: '100%' },
  imageGradientTablet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '45%',
  },
  textBlockTablet: {
    paddingHorizontal: 48,
    paddingTop: 36,
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-start',
  },
  titleTablet: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 44,
    letterSpacing: -0.5,
    marginBottom: 16,
  },
  subtitleTablet: {
    fontSize: 17,
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'center',
    lineHeight: 26,
    maxWidth: 480,
  },

  // Desktop styles
  slideDesktop: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 80,
    gap: 60,
  },
  imageWrapDesktop: {
    width: '45%',
    maxWidth: 560,
    height: '70%',
    maxHeight: 600,
    borderRadius: 36,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.6,
    shadowRadius: 48,
    elevation: 28,
  },
  imageDesktop: { width: '100%', height: '100%' },
  imageGradientDesktop: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '40%',
  },
  textBlockDesktop: {
    width: '45%',
    maxWidth: 520,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  titleDesktop: {
    fontSize: 48,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'left',
    lineHeight: 56,
    letterSpacing: -0.8,
    marginBottom: 20,
  },
  subtitleDesktop: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'left',
    lineHeight: 28,
  },

  // Shared
  chip: {
    position: 'absolute',
    top: 20,
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 50,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  chipText: { fontSize: 13, fontWeight: '700', letterSpacing: 0.3 },
});

// ─── Main onboarding screen ───────────────────────────────────────────────────
export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height, isMobile, isTablet, isDesktop, isWide } = useResponsive();

  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef<FlatList>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const slide = SLIDES[currentIndex];

  // Calculate content width for proper paging
  const contentWidth = isDesktop ? width : width;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0) {
        setCurrentIndex(viewableItems[0].index ?? 0);
      }
    },
    []
  );

  const viewabilityConfig = useRef({
    viewAreaCoveragePercentThreshold: 50,
  }).current;

  const handleNext = useCallback(() => {
    if (currentIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({
        index: currentIndex + 1,
        animated: true,
      });
    } else {
      handleFinish();
    }
  }, [currentIndex]);

  const handleFinish = useCallback(async () => {
    await markOnboardingComplete();
    router.replace('/login');
  }, [router]);

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
          style={[
            styles.skipBtn,
            isDesktop && styles.skipBtnDesktop,
            { top: insets.top + (isDesktop ? 24 : 12) },
          ]}
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
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { x: scrollX } } }],
            { useNativeDriver: true }
          )}
          scrollEventThrottle={16}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          renderItem={({ item, index }) => (
            <OnboardingSlide
              slide={item}
              index={index}
              scrollX={scrollX}
              isDesktop={isDesktop}
              isWide={isWide}
              contentWidth={contentWidth}
            />
          )}
          style={{
            flex: 1,
            marginTop: isDesktop ? insets.top + 60 : insets.top + 48,
          }}
        />

        {/* Bottom controls */}
        <View
          style={[
            styles.bottomBar,
            isDesktop && styles.bottomBarDesktop,
            { paddingBottom: Math.max(insets.bottom, 24) + (isDesktop ? 24 : 16) },
          ]}
        >
          {/* Dot indicators */}
          <DotIndicator
            count={SLIDES.length}
            active={currentIndex}
            accent={accent}
          />

          {/* Continue / Get Started button */}
          <TouchableOpacity
            style={[
              styles.nextBtn,
              isDesktop && styles.nextBtnDesktop,
              { backgroundColor: accent },
            ]}
            onPress={handleNext}
            activeOpacity={0.86}
          >
            <Text style={styles.nextBtnText}>
              {isLast ? 'Get Started' : 'Continue'}
            </Text>
          </TouchableOpacity>

          {/* Bottom fine-print on last screen */}
          {isLast ? (
            <Text
              style={[
                styles.finePrint,
                isDesktop && styles.finePrintDesktop,
              ]}
            >
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
  skipBtnDesktop: {
    right: 48,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 24,
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
  bottomBarDesktop: {
    paddingHorizontal: 80,
    paddingTop: 28,
    gap: 24,
  },

  nextBtn: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 50,
    paddingVertical: 17,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  nextBtnDesktop: {
    maxWidth: 320,
    paddingVertical: 18,
    borderRadius: 50,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
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
  finePrintDesktop: {
    fontSize: 13,
    lineHeight: 19,
  },
});
