import React, { useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, Modal, StyleSheet,
  Platform, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '../hooks/useTheme';

interface GuestWelcomeModalProps {
  visible: boolean;
  onDismiss: () => void;
  messageLimit?: number;
}

const FEATURES = [
  {
    icon: 'chatbubble-ellipses-outline',
    label: '20 free messages',
    sub: 'No account needed to start',
    color: '#10A37F',
  },
  {
    icon: 'image-outline',
    label: 'Image analysis',
    sub: 'Up to 3 photos per session as guest',
    color: '#5AC8FA',
  },
  {
    icon: 'person-outline',
    label: 'Unlimited history + features',
    sub: 'Create a free account to unlock all',
    color: '#BF5AF2',
  },
] as const;

export function GuestWelcomeModal({
  visible,
  onDismiss,
  messageLimit = 20,
}: GuestWelcomeModalProps) {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const slideAnim = useRef(new Animated.Value(80)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacityAnim, { toValue: 1, duration: 260, useNativeDriver: true }),
        Animated.spring(slideAnim, {
          toValue: 0, tension: 180, friction: 22, useNativeDriver: true,
        }),
      ]).start();
    } else {
      slideAnim.setValue(80);
      opacityAnim.setValue(0);
    }
  }, [visible]);

  const handleSignUp = () => {
    onDismiss();
    setTimeout(() => router.push('/signup'), 260);
  };

  const handleLogIn = () => {
    onDismiss();
    setTimeout(() => router.push('/login'), 260);
  };

  const bg = isDark ? '#111114' : '#FFFFFF';
  const textC = isDark ? '#FFFFFF' : '#000000';
  const subC = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)';
  const cardBg = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)';
  const divC = isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.07)';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <View style={s.backdrop}>
        {Platform.OS === 'ios' ? (
          <BlurView
            intensity={isDark ? 55 : 42}
            tint={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.62)' }]} />
        )}

        <Animated.View
          style={[
            s.sheet,
            {
              backgroundColor: bg,
              paddingBottom: insets.bottom + 28,
              opacity: opacityAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Handle bar */}
          <View style={[s.handle, { backgroundColor: divC }]} />

          {/* App icon */}
          <View style={s.iconWrap}>
            <View style={s.iconCircle}>
              <Ionicons name="sparkles" size={28} color="#FFF" />
            </View>
          </View>

          <Text style={[s.title, { color: textC }]}>Welcome to Dawinix</Text>
          <Text style={[s.subtitle, { color: subC }]}>
            Your AI assistant for everything — no sign‑up needed to get started.
          </Text>

          {/* Feature list */}
          <View
            style={[
              s.featureCard,
              { backgroundColor: cardBg, borderColor: divC },
            ]}
          >
            {FEATURES.map((item, i) => (
              <View
                key={i}
                style={[
                  s.featureRow,
                  i > 0 && {
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: divC,
                  },
                ]}
              >
                <View
                  style={[
                    s.featureIconWrap,
                    { backgroundColor: item.color + '22' },
                  ]}
                >
                  <Ionicons
                    name={item.icon as any}
                    size={17}
                    color={item.color}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.featureLabel, { color: textC }]}>
                    {item.label}
                  </Text>
                  <Text style={[s.featureSub, { color: subC }]}>
                    {item.sub}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          {/* Limit warning */}
          <View
            style={[
              s.limitRow,
              {
                backgroundColor: isDark
                  ? 'rgba(255,159,10,0.10)'
                  : 'rgba(255,159,10,0.08)',
                borderColor: 'rgba(255,159,10,0.30)',
              },
            ]}
          >
            <Ionicons name="time-outline" size={15} color="#FF9F0A" />
            <Text style={s.limitText}>
              Guest limit of{' '}
              <Text style={{ fontWeight: '700' }}>{messageLimit} messages</Text>{' '}
              resets every 24 hours after being reached.
            </Text>
          </View>

          {/* Primary CTA */}
          <TouchableOpacity
            style={s.primaryBtn}
            onPress={handleSignUp}
            activeOpacity={0.85}
          >
            <Text style={s.primaryBtnText}>Create a free account</Text>
          </TouchableOpacity>

          {/* Secondary CTA */}
          <TouchableOpacity
            style={[s.secondaryBtn, { borderColor: divC }]}
            onPress={handleLogIn}
            activeOpacity={0.8}
          >
            <Text style={[s.secondaryBtnText, { color: textC }]}>Log in</Text>
          </TouchableOpacity>

          {/* Dismiss */}
          <TouchableOpacity
            style={s.dismissBtn}
            onPress={onDismiss}
            activeOpacity={0.7}
          >
            <Text style={[s.dismissBtnText, { color: subC }]}>
              Continue as guest
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  handle: {
    width: 38, height: 4, borderRadius: 2,
    alignSelf: 'center', marginBottom: 24,
  },
  iconWrap: { alignItems: 'center', marginBottom: 16 },
  iconCircle: {
    width: 68, height: 68, borderRadius: 22,
    backgroundColor: '#10A37F',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#10A37F',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 14, elevation: 8,
  },
  title: { fontSize: 24, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  subtitle: {
    fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 20,
  },
  featureCard: {
    borderRadius: 18, borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden', marginBottom: 14,
  },
  featureRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 13, gap: 13,
  },
  featureIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  featureLabel: { fontSize: 14, fontWeight: '600' },
  featureSub: { fontSize: 12, marginTop: 1 },
  limitRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 13, paddingVertical: 11, marginBottom: 22,
  },
  limitText: { color: '#FF9F0A', fontSize: 13, flex: 1, lineHeight: 19 },
  primaryBtn: {
    borderRadius: 50, paddingVertical: 16,
    alignItems: 'center', marginBottom: 10,
    backgroundColor: '#10A37F',
  },
  primaryBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  secondaryBtn: {
    borderRadius: 50, paddingVertical: 15,
    alignItems: 'center', marginBottom: 8, borderWidth: 1.5,
  },
  secondaryBtnText: { fontSize: 16, fontWeight: '600' },
  dismissBtn: { paddingVertical: 12, alignItems: 'center' },
  dismissBtnText: { fontSize: 15 },
});
