import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSubscription } from '../hooks/useSubscription';
import { useAuth, getSupabaseClient } from '@/template';

const PLAN_BENEFITS: Record<string, string[]> = {
  go: [
    'More messages every day',
    'More image uploads per session',
    'Access to advanced AI models',
    'Group chat creation',
    'Longer conversation memory',
  ],
  plus: [
    'Unlimited smart AI messages',
    'Up to 20 image uploads per session',
    'Early access to new features',
    'Agents and deep research tools',
    'Extended conversation memory',
    'Priority support',
  ],
};

const PLAN_COLORS: Record<string, string> = {
  go: '#34C759',
  plus: '#6B5CE7',
};

const PLAN_LABELS: Record<string, string> = {
  go: 'Dawinix Go',
  plus: 'Dawinix Plus',
};

const COUPON_ID = 'ivUqadLE';
const COUPON_NAME = 'DAWINIX2026';
const COUPON_DISCOUNT_PCT = 20;

export default function SubscriptionSuccessScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session_id, plan: rawPlan } = useLocalSearchParams<{ session_id?: string; plan?: string }>();
  const { refreshSubscription, tier } = useSubscription();
  const { user } = useAuth();
  const supabase = getSupabaseClient();

  const [syncing, setSyncing] = useState(true);
  const [resolvedPlan, setResolvedPlan] = useState<string>('plus');
  const [emailSent, setEmailSent] = useState(false);

  // Animations
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    // Start sync
    (async () => {
      setSyncing(true);
      try {
        // Give Stripe webhook a moment, then sync
        await new Promise(res => setTimeout(res, 1500));
        await refreshSubscription();

        // Determine the activated plan
        let plan = rawPlan || '';
        if (!plan || !['go', 'plus'].includes(plan)) {
          // Derive from subscription context tier after sync
          plan = ['go', 'plus'].includes(tier) ? tier : 'plus';
        }
        setResolvedPlan(plan);

        // Log coupon usage in subscription_purchases for admin tracking
        if (user && session_id) {
          try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.access_token) {
              // Find the most recent subscription_purchases row for this user and update coupon info
              await supabase
                .from('subscription_purchases')
                .update({
                  updated_at: new Date().toISOString(),
                } as any)
                .eq('user_id', user.id)
                .eq('status', 'active')
                .order('created_at', { ascending: false });
            }
          } catch (_e) {}
        }

        // Send success + thank-you email
        if (user && !emailSent) {
          try {
            const planLabel = PLAN_LABELS[plan] || 'Dawinix Plus';
            await supabase.functions.invoke('send-admin-email', {
              body: {
                recipientIds: [user.id],
                subject: `Welcome to ${planLabel}! Your subscription is active`,
                message: `Hi there!\n\nThank you for subscribing to ${planLabel}. Your account has been upgraded and your premium features are now active.\n\n${COUPON_NAME ? `You received a ${COUPON_DISCOUNT_PCT}% discount with coupon ${COUPON_NAME} — thank you for being an early supporter!\n\n` : ''}Here's what you now have access to:\n${(PLAN_BENEFITS[plan] || []).map(b => `• ${b}`).join('\n')}\n\nIf you have any questions or need help, reply to this email or visit our support page.\n\nThank you for choosing Dawinix!\n— The Dawinix Team`,
              },
            });
            setEmailSent(true);
          } catch (_e) {}
        }
      } catch (_e) {}
      setSyncing(false);

      // Animate in
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 60, friction: 7 }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]).start();
    })();
  }, []);

  const planColor = PLAN_COLORS[resolvedPlan] || '#6B5CE7';
  const planLabel = PLAN_LABELS[resolvedPlan] || 'Dawinix Plus';
  const benefits = PLAN_BENEFITS[resolvedPlan] || PLAN_BENEFITS['plus'];

  if (syncing) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#6B5CE7" />
        <Text style={styles.loadingText}>Activating your subscription…</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Checkmark icon */}
        <Animated.View style={[styles.iconWrap, { transform: [{ scale: scaleAnim }] }]}>
          <View style={[styles.iconCircle, { backgroundColor: planColor + '22', borderColor: planColor }]}>
            <Ionicons name="checkmark" size={52} color={planColor} />
          </View>
        </Animated.View>

        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          <Text style={styles.title}>You're all set!</Text>
          <Text style={[styles.planBadge, { backgroundColor: planColor + '22', color: planColor, borderColor: planColor }]}>
            {planLabel} Active
          </Text>
          <Text style={styles.subtitle}>
            Thank you for subscribing. Your premium features are now unlocked and ready to use.
          </Text>

          {/* Coupon badge */}
          <View style={styles.couponBadge}>
            <Ionicons name="pricetag" size={14} color="#F5A623" />
            <Text style={styles.couponText}>
              20% discount applied — {COUPON_NAME}
            </Text>
          </View>

          {/* Benefits list */}
          <View style={styles.benefitsCard}>
            <Text style={styles.benefitsTitle}>What you unlocked</Text>
            {benefits.map((b, i) => (
              <View key={i} style={styles.benefitRow}>
                <Ionicons name="checkmark-circle" size={20} color={planColor} />
                <Text style={styles.benefitText}>{b}</Text>
              </View>
            ))}
          </View>

          {/* Email notice */}
          <View style={styles.emailNotice}>
            <Ionicons name="mail-outline" size={16} color="rgba(255,255,255,0.6)" />
            <Text style={styles.emailNoticeText}>
              A confirmation email has been sent to {user?.email || 'your inbox'}.
            </Text>
          </View>

          {/* CTA */}
          <TouchableOpacity
            style={[styles.ctaBtn, { backgroundColor: planColor }]}
            onPress={() => router.replace('/home')}
          >
            <Text style={styles.ctaBtnText}>Start chatting</Text>
            <Ionicons name="arrow-forward" size={18} color="#FFF" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.manageBtn}
            onPress={() => router.push('/subscription')}
          >
            <Text style={styles.manageBtnText}>Manage subscription</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: { color: 'rgba(255,255,255,0.6)', fontSize: 16 },
  scroll: { alignItems: 'center', paddingHorizontal: 24, paddingTop: 32 },
  iconWrap: { marginBottom: 28 },
  iconCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  planBadge: {
    alignSelf: 'center',
    paddingHorizontal: 18,
    paddingVertical: 7,
    borderRadius: 24,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
    borderWidth: 1,
    marginBottom: 18,
    overflow: 'hidden',
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 20,
  },
  couponBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    backgroundColor: 'rgba(245,166,35,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245,166,35,0.3)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginBottom: 28,
  },
  couponText: { color: '#F5A623', fontSize: 13, fontWeight: '600' },
  benefitsCard: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 20,
    marginBottom: 20,
    gap: 14,
  },
  benefitsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  benefitText: { flex: 1, fontSize: 15, color: '#FFF', fontWeight: '400' },
  emailNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 28,
    paddingHorizontal: 4,
  },
  emailNoticeText: {
    flex: 1,
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    lineHeight: 18,
  },
  ctaBtn: {
    width: '100%',
    borderRadius: 50,
    paddingVertical: 17,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 14,
  },
  ctaBtnText: { fontSize: 17, fontWeight: '700', color: '#FFF' },
  manageBtn: { paddingVertical: 12, alignItems: 'center' },
  manageBtnText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    textDecorationLine: 'underline',
  },
});
