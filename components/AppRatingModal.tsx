/**
 * AppRatingModal — shows native App Store / Play Store rating prompt
 * after the user has sent enough messages.
 */
import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Platform,
  Animated,
  Linking,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import AsyncStorage from '@react-native-async-storage/async-storage';

const RATING_SHOWN_KEY = 'app_rating_shown_v2';
const RATING_TRIGGER_MESSAGES = 10; // show after 10 messages

interface AppRatingModalProps {
  messageCount: number;
}

export function AppRatingModal({ messageCount }: AppRatingModalProps) {
  const { isDark } = useTheme();
  const [visible, setVisible] = useState(false);
  const [rated, setRated] = useState(false);
  const [selectedStars, setSelectedStars] = useState(0);
  const [step, setStep] = useState<'rate' | 'thanks'>('rate');
  const scaleAnim = useRef(new Animated.Value(0.88)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (messageCount < RATING_TRIGGER_MESSAGES) return;
    AsyncStorage.getItem(RATING_SHOWN_KEY).then(val => {
      if (!val) {
        // Delay 1.5s after trigger
        const timer = setTimeout(() => setVisible(true), 1500);
        return () => clearTimeout(timer);
      }
    }).catch(() => {});
  }, [messageCount]);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, tension: 200, friction: 18, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const handleClose = async () => {
    setVisible(false);
    await AsyncStorage.setItem(RATING_SHOWN_KEY, 'true').catch(() => {});
  };

  const handleStarPress = (star: number) => {
    setSelectedStars(star);
    // Auto-advance after short delay
    setTimeout(() => {
      setStep('thanks');
      if (star >= 4) {
        // Trigger native review or open store
        triggerStoreReview();
      }
    }, 300);
  };

  const triggerStoreReview = async () => {
    try {
      if (Platform.OS !== 'web') {
        // Try expo-store-review if available
        try {
          const StoreReview = require('expo-store-review');
          if (await StoreReview.isAvailableAsync()) {
            await StoreReview.requestReview();
            return;
          }
        } catch (_e) {}
      }
      // Fallback: open store URL
      const storeUrl = Platform.OS === 'ios'
        ? 'https://apps.apple.com/app/dawinix/id6749600012'
        : 'https://play.google.com/store/apps/details?id=com.dawinix.app';
      Linking.openURL(storeUrl).catch(() => {});
    } catch (_e) {}
  };

  const handleWriteReview = async () => {
    const storeUrl = Platform.OS === 'ios'
      ? 'https://apps.apple.com/app/dawinix/id6749600012?action=write-review'
      : 'https://play.google.com/store/apps/details?id=com.dawinix.app&reviewType=0';
    Linking.openURL(storeUrl).catch(() => {});
    handleClose();
  };

  if (!visible) return null;

  const cardBg = isDark ? 'rgba(30,30,34,0.98)' : 'rgba(255,255,255,0.98)';
  const textC = isDark ? '#FFFFFF' : '#000000';
  const subC = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)';
  const divC = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.09)';

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        {Platform.OS === 'ios' ? (
          <BlurView intensity={isDark ? 55 : 45} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.55)' }]} />
        )}

        <Animated.View style={[
          styles.card,
          { backgroundColor: cardBg, transform: [{ scale: scaleAnim }], opacity: opacityAnim },
        ]}>
          {/* App icon */}
          <View style={styles.iconWrap}>
            <Image
              source={require('../assets/images/logo.png')}
              style={styles.appIcon}
              contentFit="cover"
            />
          </View>

          {step === 'rate' ? (
            <>
              <Text style={[styles.title, { color: textC }]}>Enjoying Dawinix?</Text>
              <Text style={[styles.subtitle, { color: subC }]}>Tap a star to rate it on the App Store.</Text>

              <View style={[styles.divider, { backgroundColor: divC }]} />

              {/* Stars */}
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map(star => (
                  <TouchableOpacity
                    key={star}
                    onPress={() => handleStarPress(star)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={star <= selectedStars ? 'star' : 'star-outline'}
                      size={38}
                      color={star <= selectedStars ? '#FF9500' : '#4A90D9'}
                    />
                  </TouchableOpacity>
                ))}
              </View>

              <View style={[styles.divider, { backgroundColor: divC }]} />

              <TouchableOpacity style={[styles.notNowBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]} onPress={handleClose} activeOpacity={0.75}>
                <Text style={[styles.notNowText, { color: textC }]}>Not Now</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={[styles.title, { color: textC }]}>Thanks for your feedback.</Text>
              <Text style={[styles.subtitle, { color: subC }]}>You can also write a review.</Text>

              <View style={[styles.divider, { backgroundColor: divC }]} />

              {/* Show selected stars */}
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map(star => (
                  <Ionicons key={star} name={star <= selectedStars ? 'star' : 'star-outline'} size={38} color={star <= selectedStars ? '#FF9500' : '#4A90D9'} />
                ))}
              </View>

              <View style={[styles.divider, { backgroundColor: divC }]} />

              <TouchableOpacity style={[styles.reviewBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)' }]} onPress={handleWriteReview} activeOpacity={0.75}>
                <Text style={[styles.reviewBtnText, { color: textC }]}>Write a Review</Text>
              </TouchableOpacity>

              <View style={[styles.divider, { backgroundColor: divC }]} />

              <TouchableOpacity style={[styles.notNowBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]} onPress={handleClose} activeOpacity={0.75}>
                <Text style={[styles.notNowText, { color: textC }]}>OK</Text>
              </TouchableOpacity>
            </>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 24,
    alignItems: 'center',
    paddingTop: 28,
  },
  iconWrap: {
    marginBottom: 14,
  },
  appIcon: {
    width: 72,
    height: 72,
    borderRadius: 18,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
    paddingHorizontal: 20,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 18,
    paddingHorizontal: 20,
    lineHeight: 20,
  },
  divider: {
    width: '100%',
    height: StyleSheet.hairlineWidth,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 20,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  notNowBtn: {
    width: '100%',
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notNowText: {
    fontSize: 17,
    fontWeight: '500',
  },
  reviewBtn: {
    width: '100%',
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewBtnText: {
    fontSize: 17,
    fontWeight: '600',
  },
});
