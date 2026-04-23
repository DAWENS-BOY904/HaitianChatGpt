import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSubscription } from '../hooks/useSubscription';
import { useAuth } from '@/template';

const PLAN_BENEFITS: Record<string, { icon: string; label: string }[]> = {
  plus: [
    { icon: 'sparkles', label: 'Advanced AI models unlocked' },
    { icon: 'infinite', label: 'Unlimited smart messages' },
    { icon: 'images', label: '20 image uploads per session' },
    { icon: 'document', label: '20 file uploads per session' },
    { icon: 'flash', label: 'Early access to new features' },
    { icon: 'search', label: 'Agents & deep research' },
    { icon: 'headset', label: 'Priority support' },
  ],
  go: [
    { icon: 'chatbubbles', label: 'More daily messages' },
    { icon: 'images', label: '10 image uploads per session' },
    { icon: 'document', label: '10 file uploads per session' },
    { icon: 'people', label: 'Group chat creation' },
    { icon: 'time', label: 'Longer conversation memory' },
  ],
  free: [
    { icon: 'checkmark-circle', label: 'Basic AI models' },
    { icon: 'chatbubble', label: '35 messages per day' },
    { icon: 'image', label: '4 image uploads per session' },
  ],
};

export default function SubscriptionSuccessScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { tier, refreshSubscription } = useSubscription();
  const { user } = useAuth();

  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const planName = tier === 'plus' ? 'Dawinix Plus' : tier === 'go' ? 'Dawinix Go' : 'Dawinix';
  const planColor = tier === 'plus' ? '#6B5CE7' : tier === 'go' ? '#34C759' : '#10A37F';
  const benefits = PLAN_BENEFITS[tier] || PLAN_BENEFITS.free;
  const couponApplied = tier === 'plus';

  useEffect(() => {
    // Refresh subscription context on mount
    refreshSubscription?.();

    // Entry animation sequence
    Animated.sequence([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 200,
        friction: 15,
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    // Pulse the checkmark
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Background glow */}
      <View style={[styles.glowCircle, { backgroundColor: planColor + '18' }]} />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Animated checkmark */}
        <Animated.View style={[styles.iconWrap, { transform: [{ scale: scaleAnim }] }]}>
          <View style={[styles.iconRing, { borderColor: planColor + '55', shadowColor: planColor }]}>
            <View style={[styles.iconInner, { backgroundColor: planColor }]}>
              <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                <Ionicons name="checkmark" size={52} color="#FFF" />
              </Animated.View>
            </View>
          </View>
        </Animated.View>

        <Animated.View
          style={[
            styles.content,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          {/* Title */}
          <Text style={styles.title}>You're all set!</Text>
          <Text style={[styles.planName, { color: planColor }]}>{planName} activated</Text>

          {user?.email ? (
            <Text style={styles.emailNote}>
              Subscription linked to{' '}
              <Text style={{ color: 'rgba(255,255,255,0.85)', fontWeight: '600' }}>
                {user.email}
              </Text>
            </Text>
          ) : null}

          {/* Coupon badge */}
          {couponApplied ? (
            <View style={styles.couponBadge}>
              <Ionicons name="pricetag" size={14} color="#FFD60A" />
              <Text style={styles.couponText}>
                {'  '}DAWINIX2026 — 20% discount applied
              </Text>
            </View>
          ) : null}

          {/* Benefits list */}
          <View style={[styles.benefitsCard, { borderColor: planColor + '33' }]}>
            <Text style={[styles.benefitsTitle, { color: planColor }]}>
              {tier === 'plus' ? '✨ Plus' : tier === 'go' ? '⚡ Go' : ''} Plan Includes
            </Text>
            {benefits.map((b, i) => (
              <View
                key={b.label}
                style={[
                  styles.benefitRow,
                  i < benefits.length - 1 && styles.benefitRowBorder,
                ]}
              >
                <View style={[styles.benefitIcon, { backgroundColor: planColor + '22' }]}>
                  <Ionicons name={b.icon as any} size={16} color={planColor} />
                </View>
                <Text style={styles.benefitLabel}>{b.label}</Text>
              </View>
            ))}
          </View>

          {/* Apple billing note */}
          {tier === 'go' && Platform.OS === 'ios' ? (
            <View style={styles.billingNote}>
              <Ionicons name="logo-apple" size={14} color="rgba(255,255,255,0.5)" />
              <Text style={styles.billingNoteText}>
                {'  '}Billed by Apple. Manage in Settings → Apple ID → Subscriptions.
              </Text>
            </View>
          ) : null}

          {/* Stripe billing note */}
          {tier === 'plus' ? (
            <View style={styles.billingNote}>
              <Ionicons name="card-outline" size={14} color="rgba(255,255,255,0.5)" />
              <Text style={styles.billingNoteText}>
                {'  '}Billed via Stripe. Manage anytime from Settings → Subscription.
              </Text>
            </View>
          ) : null}
        </Animated.View>
      </ScrollView>

      {/* Bottom CTA */}
      <Animated.View
        style={[
          styles.bottomCTA,
          { paddingBottom: insets.bottom + 20, opacity: fadeAnim },
        ]}
      >
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: planColor }]}
          onPress={() => router.replace('/home')}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryBtnText}>Start chatting</Text>
          <Ionicons name="arrow-forward" size={18} color="#FFF" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => router.replace('/subscription')}
          activeOpacity={0.7}
        >
          <Text style={styles.secondaryBtnText}>View subscription details</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  glowCircle: {
    position: 'absolute',
    top: -120,
    alignSelf: 'center',
    width: 400,
    height: 400,
    borderRadius: 200,
  },
  scroll: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 60,
  },

  // Icon
  iconWrap: {
    marginBottom: 32,
  },
  iconRing: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 30,
    elevation: 16,
  },
  iconInner: {
    width: 110,
    height: 110,
    borderRadius: 55,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Content
  content: {
    width: '100%',
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  planName: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 10,
  },
  emailNote: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    marginBottom: 16,
  },

  // Coupon
  couponBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,214,10,0.12)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,214,10,0.3)',
    marginBottom: 24,
  },
  couponText: {
    color: '#FFD60A',
    fontSize: 13,
    fontWeight: '600',
  },

  // Benefits
  benefitsCard: {
    width: '100%',
    backgroundColor: 'rgba(17,17,17,0.95)',
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 20,
  },
  benefitsTitle: {
    fontSize: 14,
    fontWeight: '700',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  benefitRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  benefitIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitLabel: {
    color: '#FFF',
    fontSize: 15,
    flex: 1,
  },

  // Billing note
  billingNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  billingNoteText: {
    flex: 1,
    fontSize: 12,
    color: 'rgba(255,255,255,0.45)',
    lineHeight: 18,
  },

  // Bottom CTA
  bottomCTA: {
    paddingHorizontal: 24,
    paddingTop: 16,
    backgroundColor: 'rgba(0,0,0,0.95)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
    gap: 12,
  },
  primaryBtn: {
    width: '100%',
    borderRadius: 50,
    paddingVertical: 17,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFF',
  },
  secondaryBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  secondaryBtnText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    textDecorationLine: 'underline',
  },
});
