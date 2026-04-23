import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Linking,
  ActivityIndicator,
  ImageBackground,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSubscription } from '../hooks/useSubscription';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAlert, useAuth, getSupabaseClient } from '@/template';
import * as WebBrowser from 'expo-web-browser';
import { useFocusEffect } from '@react-navigation/native';
import { FunctionsHttpError } from '@supabase/supabase-js';

// ── Feature comparison rows ──
const GO_FEATURES = [
  { label: 'Basic AI models', free: true, plan: true },
  { label: 'More daily messages', free: false, plan: true },
  { label: '10 image uploads / session', free: false, plan: true },
  { label: '10 file uploads / session', free: false, plan: true },
  { label: 'Group chat creation', free: false, plan: true },
  { label: 'Longer conversation memory', free: false, plan: true },
];

const PLUS_FEATURES = [
  { label: 'Basic AI models', free: true, plan: true },
  { label: 'Advanced AI models', free: false, plan: true },
  { label: 'Unlimited smart messages', free: false, plan: true },
  { label: '20 image uploads / session', free: false, plan: true },
  { label: '20 file uploads / session', free: false, plan: true },
  { label: 'Early access to new features', free: false, plan: true },
  { label: 'Agents & deep research', free: false, plan: true },
  { label: 'Extended conversation memory', free: false, plan: true },
  { label: 'Priority support', free: false, plan: true },
];

// ── Stripe price IDs (real recurring monthly) ──
const STRIPE_PRICES = {
  plus: 'price_1TPUrzE0VkO7z1Vnlgj45978', // $19.99/month
};

// ── Apple IAP product IDs (Go plan) ──
const APPLE_PRODUCT_ID = Platform.select({
  ios: 'com.dawinix.go.monthly',
  default: 'com.dawinix.go.monthly',
});

// ── RevenueCat API key ──
const RC_API_KEY = Platform.select({
  ios: process.env.EXPO_PUBLIC_RC_IOS_KEY || '',
  android: process.env.EXPO_PUBLIC_RC_ANDROID_KEY || '',
  default: '',
});

// ── Plan assets ──
const GO_LOGO = require('../assets/images/plan-go.png');
const PLUS_LOGO = require('../assets/images/plan-plus.png');
const BG_IMAGE = 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&h=1200&fit=crop';

export default function SubscriptionScreen() {
  const { tier, restorePurchases } = useSubscription();
  const { showAlert } = useAlert();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const supabase = getSupabaseClient();

  const [selectedPlan, setSelectedPlan] = useState<'go' | 'plus'>('go');
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [managing, setManaging] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [subscriptionInfo, setSubscriptionInfo] = useState<{
    subscribed: boolean;
    plan: string | null;
    subscription_end: string | null;
  } | null>(null);

  // ── Check subscription status ──
  const checkSubscriptionStatus = useCallback(async () => {
    if (!user) return;
    setCheckingStatus(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      const { data, error } = await supabase.functions.invoke('check-subscription', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!error && data) {
        setSubscriptionInfo({
          subscribed: data.subscribed ?? false,
          plan: data.plan ?? null,
          subscription_end: data.subscription_end ?? null,
        });
      }
    } catch (e) {
      console.log('[subscription] check failed:', e);
    } finally {
      setCheckingStatus(false);
    }
  }, [user, supabase]);

  useFocusEffect(
    useCallback(() => {
      checkSubscriptionStatus();
      const handleUrl = ({ url }: { url: string }) => {
        if (url.includes('subscription/success') || url.includes('subscription-success')) {
          setTimeout(() => checkSubscriptionStatus(), 2000);
        }
      };
      const sub = Linking.addEventListener('url', handleUrl);
      return () => sub.remove();
    }, [checkSubscriptionStatus]),
  );

  // ──────────────────────────────────────────
  // GO PLAN → Apple IAP via RevenueCat
  // ──────────────────────────────────────────
  const purchaseGoWithAppleIAP = async () => {
    if (Platform.OS === 'web') {
      showAlert('Not available', 'Apple IAP is only available on iPhone. Use "Buy on Web" instead.');
      return;
    }

    try {
      const Purchases = require('react-native-purchases').default;
      const apiKey = RC_API_KEY ||
        (Platform.OS === 'ios'
          ? (process.env.EXPO_PUBLIC_RC_IOS_KEY || '')
          : (process.env.EXPO_PUBLIC_RC_ANDROID_KEY || ''));

      if (!apiKey) {
        // No RevenueCat key — fall back to Stripe for Go
        await purchasePlusWithStripe('go');
        return;
      }

      // Configure RevenueCat
      try { Purchases.configure({ apiKey }); } catch (_e) {}

      // Fetch offerings
      const offerings = await Purchases.getOfferings();
      const offering = offerings.current;

      if (!offering) {
        throw new Error('No App Store offerings available. Please check App Store Connect configuration.');
      }

      // Find Go package
      const pkg = offering.availablePackages.find(
        (p: any) =>
          p.product.productIdentifier === APPLE_PRODUCT_ID ||
          p.product.identifier === APPLE_PRODUCT_ID ||
          p.packageType === 'MONTHLY',
      );

      if (!pkg) {
        throw new Error(`Go plan (${APPLE_PRODUCT_ID}) not found in App Store. Please contact support.`);
      }

      // Trigger Apple purchase sheet (Face ID / Apple Pay)
      const { customerInfo } = await Purchases.purchasePackage(pkg);

      // Build receipt for verify-purchase
      const receiptData = JSON.stringify(customerInfo);
      const transactionId = (customerInfo as any).originalAppUserId || `rc_${Date.now()}`;

      // Verify with edge function
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('verify-purchase', {
        body: {
          platform: 'ios',
          receipt: receiptData,
          transactionId,
          productId: APPLE_PRODUCT_ID,
          isSandbox: __DEV__,
        },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) {
        let errMsg = error.message;
        if (error instanceof FunctionsHttpError) {
          try { errMsg = await error.context?.text() || errMsg; } catch (_e) {}
        }
        throw new Error(errMsg);
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Purchase verification failed');
      }

      // Sync user profile tier
      if (user?.id) {
        await supabase.from('user_profiles').update({
          subscription_tier: 'go',
          subscription_expires_at: data.subscription?.expiresAt || null,
        }).eq('id', user.id);
      }

      showAlert('Subscribed to Go!', 'Your Dawinix Go plan is now active. Enjoy expanded access!');
      await checkSubscriptionStatus();
      router.push('/subscription-success');
    } catch (err: any) {
      // User cancelled — silent
      if (
        err?.userCancelled ||
        err?.code === '1' ||
        err?.message?.includes('cancel') ||
        err?.message?.includes('PurchaseCancelledError')
      ) {
        return;
      }

      // RevenueCat module not available — fall back to Stripe Go
      if (
        err?.message?.includes('Cannot find module') ||
        err?.message?.includes('NativeModule') ||
        err?.message?.includes('not available')
      ) {
        console.log('[subscription] RC not available, falling back to Stripe Go');
        await purchasePlusWithStripe('go');
        return;
      }

      throw err;
    }
  };

  // ──────────────────────────────────────────
  // PLUS PLAN → Stripe hosted checkout
  // ──────────────────────────────────────────
  const purchasePlusWithStripe = async (plan: 'go' | 'plus' = 'plus') => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Not authenticated');

    const priceId = plan === 'plus' ? STRIPE_PRICES.plus : STRIPE_PRICES.plus;

    const { data, error } = await supabase.functions.invoke('create-checkout-session', {
      body: { plan, priceId },
      headers: { Authorization: `Bearer ${session.access_token}` },
    });

    if (error) {
      let errMsg = error.message;
      if (error instanceof FunctionsHttpError) {
        try { errMsg = await error.context?.text() || errMsg; } catch (_e) {}
      }
      throw new Error(errMsg);
    }

    if (!data?.url) throw new Error('No checkout URL returned from Stripe');

    // Open Stripe hosted checkout — Apple Pay & Google Pay activate automatically
    try {
      await WebBrowser.openBrowserAsync(data.url, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
        enableBarCollapsing: true,
      });
    } catch (_e) {
      await Linking.openURL(data.url);
    }

    // Sync after returning
    setTimeout(() => checkSubscriptionStatus(), 2000);
  };

  // ──────────────────────────────────────────
  // Manage subscription (Stripe portal)
  // ──────────────────────────────────────────
  const handleManage = async () => {
    if (!user || managing) return;
    setManaging(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');
      const { data, error } = await supabase.functions.invoke('customer-portal', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error || !data?.url) throw new Error(error?.message || 'Could not open portal');
      try {
        await WebBrowser.openBrowserAsync(data.url, {
          presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
        });
      } catch (_e) {
        await Linking.openURL(data.url);
      }
      setTimeout(() => checkSubscriptionStatus(), 1500);
    } catch (err: any) {
      showAlert('Error', err?.message || 'Failed to open subscription management');
    } finally {
      setManaging(false);
    }
  };

  // ──────────────────────────────────────────
  // Main purchase handler
  // ──────────────────────────────────────────
  const handleUpgrade = async () => {
    if (loading) return;
    setLoading(true);
    try {
      if (selectedPlan === 'go') {
        // Go plan → Apple IAP (or Stripe fallback)
        await purchaseGoWithAppleIAP();
      } else {
        // Plus plan → Stripe hosted checkout (card + Apple Pay)
        await purchasePlusWithStripe('plus');
      }
    } catch (err: any) {
      showAlert('Purchase Failed', err?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── "Buy on Web" (Plus only) — opens Stripe web checkout ──
  const handleBuyOnWeb = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await purchasePlusWithStripe('plus');
    } catch (err: any) {
      showAlert('Error', err?.message || 'Could not open web checkout');
    } finally {
      setLoading(false);
    }
  };

  // ── Restore purchases ──
  const handleRestore = async () => {
    setRestoring(true);
    try {
      // Try RevenueCat first
      if (Platform.OS !== 'web') {
        try {
          const Purchases = require('react-native-purchases').default;
          const apiKey = RC_API_KEY ||
            (Platform.OS === 'ios'
              ? (process.env.EXPO_PUBLIC_RC_IOS_KEY || '')
              : (process.env.EXPO_PUBLIC_RC_ANDROID_KEY || ''));
          if (apiKey) {
            try { Purchases.configure({ apiKey }); } catch (_e) {}
            const customerInfo = await Purchases.restorePurchases();
            const hasActive = Object.keys(customerInfo.entitlements.active).length > 0;
            if (hasActive && user?.id) {
              await supabase.from('user_profiles').update({ subscription_tier: 'go' }).eq('id', user.id);
              showAlert('Purchases Restored', 'Your Dawinix Go subscription has been restored.');
              await checkSubscriptionStatus();
              return;
            }
          }
        } catch (_e) {}
      }
      // Fall back to DB restore
      await restorePurchases();
      await checkSubscriptionStatus();
      showAlert('Purchases Restored', 'Your purchases have been restored successfully.');
    } catch (_e) {
      showAlert('No Purchases Found', 'No previous purchases were found for this account.');
    } finally {
      setRestoring(false);
    }
  };

  // ── Derived display values ──
  const planColor = selectedPlan === 'go' ? '#34C759' : '#6B5CE7';
  const planPrice = selectedPlan === 'go' ? '$8.00' : '$19.99';
  const features = selectedPlan === 'go' ? GO_FEATURES : PLUS_FEATURES;
  const currentLogo = selectedPlan === 'go' ? GO_LOGO : PLUS_LOGO;
  const isAlreadySubscribed = subscriptionInfo?.subscribed ?? false;

  // ── Apple IAP label ──
  const goButtonLabel = Platform.OS === 'ios'
    ? ' Subscribe with Apple'
    : 'Subscribe — Go Plan';

  // ── Plus button label ──
  const plusButtonLabel = Platform.OS === 'ios'
    ? 'Pay with Card or Apple Pay'
    : Platform.OS === 'android'
      ? 'Pay with Card or Google Pay'
      : 'Checkout';

  return (
    <ImageBackground
      source={{ uri: BG_IMAGE }}
      style={styles.container}
      imageStyle={styles.mapBackground}
    >
      <View style={styles.overlay} />

      {/* Close */}
      <TouchableOpacity
        style={[styles.closeBtn, { top: insets.top + 12 }]}
        onPress={() => router.back()}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="close" size={22} color="#FFF" />
      </TouchableOpacity>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 56, paddingBottom: insets.bottom + 160 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Logo card */}
        <View style={styles.logoCard}>
          <View style={[styles.logoGlowRing, {
            borderColor: selectedPlan === 'go' ? 'rgba(52,199,89,0.6)' : 'rgba(107,92,231,0.7)',
            shadowColor: planColor,
          }]}>
            <Image source={currentLogo} style={styles.logoImage} contentFit="cover" transition={300} />
            <View style={styles.frostOverlay} />
            <View style={[styles.planPill, { backgroundColor: planColor }]}>
              <Text style={styles.planPillText}>
                {selectedPlan === 'go' ? '⚡ GO' : '✨ PLUS'}
              </Text>
            </View>
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title}>
          {selectedPlan === 'go' ? 'Dawinix Go' : 'Dawinix Plus'}
        </Text>
        <Text style={styles.subtitle}>
          {selectedPlan === 'go'
            ? 'Expanded access via Apple subscription'
            : 'Advanced intelligence via Stripe checkout'}
        </Text>

        {/* Plan toggle */}
        <View style={styles.toggle}>
          <TouchableOpacity
            style={[styles.toggleBtn, selectedPlan === 'go' && styles.toggleBtnActive]}
            onPress={() => setSelectedPlan('go')}
          >
            <Text style={[styles.toggleText, selectedPlan === 'go' && styles.toggleTextActive]}>Go</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, selectedPlan === 'plus' && styles.toggleBtnActive]}
            onPress={() => setSelectedPlan('plus')}
          >
            <Text style={[styles.toggleText, selectedPlan === 'plus' && styles.toggleTextActive]}>Plus</Text>
          </TouchableOpacity>
        </View>

        {/* Payment method explainer */}
        <View style={[styles.paymentBadge, { borderColor: planColor + '55', backgroundColor: planColor + '11' }]}>
          {selectedPlan === 'go' ? (
            <View style={styles.paymentBadgeRow}>
              <Ionicons name="logo-apple" size={18} color={planColor} />
              <Text style={[styles.paymentBadgeText, { color: planColor }]}>
                {'  '}Apple In-App Purchase · Face ID
              </Text>
            </View>
          ) : (
            <View style={styles.paymentBadgeRow}>
              <Ionicons name="card-outline" size={18} color={planColor} />
              <Text style={[styles.paymentBadgeText, { color: planColor }]}>
                {'  '}Card · Apple Pay · Google Pay via Stripe
              </Text>
            </View>
          )}
        </View>

        {/* Features table */}
        <View style={styles.featureCard}>
          <View style={styles.featureRow}>
            <Text style={styles.featureHeaderLabel}>Features</Text>
            <Text style={styles.featureHeaderFree}>Free</Text>
            <Text style={[styles.featureHeaderPlan, { color: planColor }]}>
              {selectedPlan === 'go' ? 'Go' : 'Plus'}
            </Text>
          </View>
          {features.map((f, i) => (
            <View
              key={f.label}
              style={[styles.featureRow, i < features.length - 1 && styles.featureRowBorder]}
            >
              <Text style={styles.featureLabel}>{f.label}</Text>
              <View style={styles.featureCheck}>
                {f.free
                  ? <Ionicons name="checkmark" size={18} color="rgba(255,255,255,0.7)" />
                  : <Text style={styles.featureDash}>—</Text>}
              </View>
              <View style={styles.featureCheck}>
                <Ionicons name="checkmark" size={18} color={planColor} />
              </View>
            </View>
          ))}
        </View>

        {/* Restore */}
        <TouchableOpacity onPress={handleRestore} style={styles.restoreBtn} disabled={restoring}>
          {restoring
            ? <ActivityIndicator color="rgba(255,255,255,0.8)" size="small" />
            : <Text style={styles.restoreText}>Restore Purchases</Text>}
        </TouchableOpacity>
      </ScrollView>

      {/* ── Bottom CTA ── */}
      <View style={[styles.bottomCTA, { paddingBottom: insets.bottom + 20 }]}>

        {/* Active subscription badge */}
        {user && isAlreadySubscribed && (
          <View style={styles.activeBadge}>
            <Ionicons name="checkmark-circle" size={16} color="#34C759" />
            <Text style={styles.activeBadgeText}>
              {subscriptionInfo?.plan?.toUpperCase()} active
              {subscriptionInfo?.subscription_end
                ? ` · renews ${new Date(subscriptionInfo.subscription_end).toLocaleDateString()}`
                : ''}
            </Text>
          </View>
        )}

        {isAlreadySubscribed ? (
          /* Already subscribed → manage */
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: '#2C2C2E', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' }]}
            onPress={handleManage}
            disabled={managing}
          >
            {managing
              ? <ActivityIndicator color="#FFF" />
              : <Text style={[styles.primaryBtnText, { color: '#FFF' }]}>Manage Subscription</Text>}
          </TouchableOpacity>
        ) : selectedPlan === 'go' ? (
          /* ── GO PLAN: Apple IAP ── */
          <>
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: '#000', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }, loading && styles.btnDisabled]}
              onPress={handleUpgrade}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <View style={styles.btnRow}>
                  <Ionicons name="logo-apple" size={20} color="#FFF" />
                  <Text style={[styles.primaryBtnText, { color: '#FFF' }]}>
                    {goButtonLabel} — {planPrice}/mo
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            <Text style={styles.appleNote}>
              Billed via Apple. Manage in Settings → Subscriptions.
            </Text>
          </>
        ) : (
          /* ── PLUS PLAN: Stripe checkout ── */
          <>
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: '#FFF' }, loading && styles.btnDisabled]}
              onPress={handleUpgrade}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#000" />
              ) : (
                <View style={styles.btnRow}>
                  <Ionicons name="card-outline" size={20} color="#000" />
                  <Text style={styles.primaryBtnText}>
                    {plusButtonLabel} — {planPrice}/mo
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            {/* "Buy on Web" button for Plus */}
            <TouchableOpacity
              style={[styles.webBtn, loading && styles.btnDisabled]}
              onPress={handleBuyOnWeb}
              disabled={loading}
            >
              <Ionicons name="globe-outline" size={16} color="rgba(255,255,255,0.8)" />
              <Text style={styles.webBtnText}>Buy on Web</Text>
              <Ionicons name="open-outline" size={14} color="rgba(255,255,255,0.5)" />
            </TouchableOpacity>

            <Text style={styles.appleNote}>
              Apple Pay &amp; Google Pay available at Stripe checkout.{'\n'}
              DAWINIX2026 — 20% off applied automatically.
            </Text>
          </>
        )}

        {/* Refresh status */}
        {user && (
          <TouchableOpacity
            onPress={checkSubscriptionStatus}
            style={styles.refreshBtn}
            disabled={checkingStatus}
          >
            {checkingStatus
              ? <ActivityIndicator size="small" color="rgba(255,255,255,0.5)" />
              : <Ionicons name="refresh" size={14} color="rgba(255,255,255,0.5)" />}
            <Text style={styles.refreshText}>Refresh Status</Text>
          </TouchableOpacity>
        )}
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  mapBackground: { opacity: 0.3 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.72)' },
  closeBtn: {
    position: 'absolute',
    right: 20,
    zIndex: 10,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 16,
  },
  scroll: { alignItems: 'center', paddingHorizontal: 24 },

  // Logo
  logoCard: { alignItems: 'center', marginBottom: 24, marginTop: 8 },
  logoGlowRing: {
    width: 160,
    height: 160,
    borderRadius: 40,
    borderWidth: 2.5,
    overflow: 'hidden',
    position: 'relative',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 24,
    elevation: 16,
  },
  logoImage: { width: '100%', height: '100%' },
  frostOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.3)',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.15)',
  },
  planPill: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
  },
  planPillText: { color: '#FFF', fontSize: 13, fontWeight: '800', letterSpacing: 1 },

  // Text
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    marginBottom: 22,
  },

  // Toggle
  toggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(28,28,30,0.9)',
    borderRadius: 30,
    padding: 4,
    marginBottom: 20,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  toggleBtn: { flex: 1, paddingVertical: 12, borderRadius: 26, alignItems: 'center' },
  toggleBtnActive: { backgroundColor: '#2C2C2E' },
  toggleText: { fontSize: 16, fontWeight: '500', color: 'rgba(255,255,255,0.4)' },
  toggleTextActive: { color: '#FFF', fontWeight: '700' },

  // Payment badge
  paymentBadge: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 20,
  },
  paymentBadgeRow: { flexDirection: 'row', alignItems: 'center' },
  paymentBadgeText: { fontSize: 14, fontWeight: '600' },

  // Feature table
  featureCard: {
    width: '100%',
    backgroundColor: 'rgba(17,17,17,0.95)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
    marginBottom: 20,
  },
  featureRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 15 },
  featureRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.1)' },
  featureHeaderLabel: { flex: 1, fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.4)' },
  featureHeaderFree: { width: 52, textAlign: 'center', fontSize: 13, fontWeight: '600', color: '#FFF' },
  featureHeaderPlan: { width: 52, textAlign: 'center', fontSize: 13, fontWeight: '700' },
  featureLabel: { flex: 1, fontSize: 15, color: '#FFF', fontWeight: '400' },
  featureCheck: { width: 52, alignItems: 'center' },
  featureDash: { fontSize: 18, color: 'rgba(255,255,255,0.3)', lineHeight: 22 },

  // Restore
  restoreBtn: { marginTop: 4, padding: 12 },
  restoreText: { fontSize: 14, color: 'rgba(255,255,255,0.8)', textDecorationLine: 'underline' },

  // Bottom CTA
  bottomCTA: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingTop: 16,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    gap: 8,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(52,199,89,0.12)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(52,199,89,0.25)',
  },
  activeBadgeText: { color: '#34C759', fontSize: 13, fontWeight: '600' },

  // Primary button
  primaryBtn: {
    width: '100%',
    borderRadius: 50,
    paddingVertical: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { fontSize: 17, fontWeight: '700', color: '#000' },
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnDisabled: { opacity: 0.6 },

  // "Buy on Web" button
  webBtn: {
    width: '100%',
    borderRadius: 50,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  webBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
  },

  // Apple / legal note
  appleNote: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 8,
  },

  // Refresh
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  refreshText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
  },
});
