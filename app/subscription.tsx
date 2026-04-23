
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Linking,
  Alert,
  ActivityIndicator,
  ImageBackground,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useSubscription } from '../hooks/useSubscription';
import { useRouter } from 'expo-router';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAlert, useAuth, getSupabaseClient } from '@/template';
import * as WebBrowser from 'expo-web-browser';
import { useFocusEffect } from '@react-navigation/native';

// ── Feature comparison rows ──
const GO_FEATURES = [
  { label: 'Basic models', free: true, plan: true },
  { label: 'More messages', free: false, plan: true },
  { label: 'More uploads', free: false, plan: true },
  { label: 'More image creation', free: false, plan: true },
  { label: 'Longer memory', free: false, plan: true },
];

const PLUS_FEATURES = [
  { label: 'Basic models', free: true, plan: true },
  { label: 'Smarter models', free: false, plan: true },
  { label: 'More messages and uploads', free: false, plan: true },
  { label: 'More image creation', free: false, plan: true },
  { label: 'Early access to new features', free: false, plan: true },
  { label: 'Agents and deep research', free: false, plan: true },
  { label: 'More memory', free: false, plan: true },
];

// ── Stripe price IDs (real, recurring monthly) ──
const STRIPE_PRICES: Record<string, string> = {
  go:   'price_1SjmtpE0VkO7z1Vn1lpvP0PC', // $10/month – Premium Monthly
  plus: 'price_1ShK60E0VkO7z1VnHAKICksq', // $20/month – Premium (higher tier)
};

// Product IDs from App Store Connect / Google Play Console
const PRODUCT_IDS = {
  go: Platform.select({ ios: 'com.dawinix.go.monthly', android: 'com.dawinix.go.monthly' }) || 'com.dawinix.go.monthly',
  plus: Platform.select({ ios: 'com.dawinix.plus.monthly', android: 'com.dawinix.plus.monthly' }) || 'com.dawinix.plus.monthly',
};

// RevenueCat API key per platform — set via Expo env vars
const RC_API_KEY = Platform.select({
  ios: process.env.EXPO_PUBLIC_RC_IOS_KEY || '',
  android: process.env.EXPO_PUBLIC_RC_ANDROID_KEY || '',
  default: '',
});

// Local generated plan logos
const GO_LOGO = require('../assets/images/plan-go.png');
const PLUS_LOGO = require('../assets/images/plan-plus.png');
const MAP_BACKGROUND = 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&h=1200&fit=crop'; // dark space/neige bg

export default function SubscriptionScreen() {
  const { colors, isDark } = useTheme();
  const { tier, restorePurchases } = useSubscription();
  const { showAlert } = useAlert();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const supabase = getSupabaseClient();

  const [selectedPlan, setSelectedPlan] = useState<'go' | 'plus'>('go');
  const [isLoading, setIsLoading] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [subscriptionInfo, setSubscriptionInfo] = useState<{
    subscribed: boolean;
    plan: string | null;
    subscription_end: string | null;
  } | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [isManaging, setIsManaging] = useState(false);

  // ── Check subscription status via Stripe ──
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

  // Check on focus and when user changes
  useFocusEffect(
    useCallback(() => {
      checkSubscriptionStatus();
      // Also listen for deep-link return from Stripe
      const handleUrl = ({ url }: { url: string }) => {
        if (url.includes('subscription/success')) {
          setTimeout(() => checkSubscriptionStatus(), 2000);
          showAlert('Payment Successful!', 'Your subscription is now active. Enjoy premium access!');
        }
      };
      const sub = Linking.addEventListener('url', handleUrl);
      return () => sub.remove();
    }, [checkSubscriptionStatus]),
  );

  const features = selectedPlan === 'go' ? GO_FEATURES : PLUS_FEATURES;
  const planColor = '#6B5CE7';
  const planPrice = selectedPlan === 'go' ? '$8.00' : '$19.99';
  const planLabel = selectedPlan === 'go' ? 'Get Dawinix Go' : 'Get Dawinix Plus';
  const planSubtitle = selectedPlan === 'go'
    ? 'Keep chatting with expanded access'
    : 'Do more with advanced intelligence';

  const currentLogo = selectedPlan === 'go' ? GO_LOGO : PLUS_LOGO;

  // ── Open Stripe checkout in browser ──
  const purchaseWithStripe = async (plan: 'go' | 'plus') => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Not authenticated');

    const { data, error } = await supabase.functions.invoke('create-checkout-session', {
      body: {
        plan,
        priceId: STRIPE_PRICES[plan],
      },
      headers: { Authorization: `Bearer ${session.access_token}` },
    });

    if (error) {
      let errMsg = error.message;
      try {
        const { FunctionsHttpError } = await import('@supabase/supabase-js');
        if (error instanceof FunctionsHttpError) {
          const txt = await error.context?.text?.();
          errMsg = txt || errMsg;
        }
      } catch (_e) {}
      throw new Error(errMsg);
    }

    if (!data?.url) throw new Error('No checkout URL returned');

    // Open Stripe hosted checkout — Apple Pay & Google Pay work automatically
    try {
      await WebBrowser.openBrowserAsync(data.url, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
        enableBarCollapsing: true,
      });
    } catch (_e) {
      // Fallback to system browser
      await Linking.openURL(data.url);
    }

    // Refresh subscription status after returning
    setTimeout(() => checkSubscriptionStatus(), 1500);
  };

  // ── Open Stripe customer portal (manage / cancel) ──
  const handleManageSubscription = async () => {
    if (!user || isManaging) return;
    setIsManaging(true);
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
      setIsManaging(false);
    }
  };

  const purchaseWithRevenueCat = async (productId: string, planName: string, priceStr: string) => {
    try {
      const Purchases = require('react-native-purchases').default;

      const apiKey = RC_API_KEY ||
        (Platform.OS === 'ios'
          ? (process.env.EXPO_PUBLIC_RC_IOS_KEY || '')
          : (process.env.EXPO_PUBLIC_RC_ANDROID_KEY || ''));

      if (!apiKey) {
        router.push({ pathname: '/checkout', params: { plan: planName } });
        return;
      }

      try { Purchases.configure({ apiKey }); } catch (_configErr) {}

      const offerings = await Purchases.getOfferings();
      const offering = offerings.current;

      if (!offering) {
        throw new Error('No offerings available. Please try again later.');
      }

      const pkg = offering.availablePackages.find(
        (p: any) =>
          p.product.productIdentifier === productId ||
          p.product.identifier === productId
      );

      if (!pkg) {
        throw new Error(`Product ${productId} not found. Check App Store/Play Console configuration.`);
      }

      const { customerInfo, productIdentifier } = await Purchases.purchasePackage(pkg);

      const receipt: string = (customerInfo as any).latestExpirationDate
        ? JSON.stringify(customerInfo)
        : '';

      const transactionId: string = (customerInfo as any).originalAppUserId || Date.now().toString();

      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) throw new Error('User not authenticated');

      const { data, error } = await supabase.functions.invoke('verify-purchase', {
        body: {
          platform: Platform.OS === 'ios' ? 'ios' : 'android',
          receipt,
          transactionId,
          productId: productIdentifier,
          isSandbox: __DEV__,
        },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || 'Purchase verification failed');
      }

      if (user?.id) {
        await supabase.from('user_profiles').update({
          subscription_tier: planName === 'go' ? 'go' : 'plus',
          subscription_expires_at: data.subscription?.expiresAt || null,
        }).eq('id', user.id);
      }

      const renewalDate = data.subscription?.expiresAt
        ? new Date(data.subscription.expiresAt).toLocaleDateString()
        : 'next month';

      await supabase.functions.invoke('send-admin-email', {
        body: {
          recipientIds: user?.id ? [user.id] : [],
          subject: `Welcome to Dawinix ${planName === 'go' ? 'Go' : 'Plus'}!`,
          message: `Your subscription has been activated.\n\nPlan: Dawinix ${planName === 'go' ? 'Go' : 'Plus'}\nPrice: ${priceStr}/month\nNext renewal: ${renewalDate}\n\nThank you for subscribing!`,
        },
      }).catch(console.error);

      showAlert('Subscription Activated!', `Welcome to Dawinix ${planName === 'go' ? 'Go' : 'Plus'}! Your subscription is now active.`);
      router.back();
    } catch (err: any) {
      if (err?.code === '1' || err?.message?.includes('cancel') || err?.userCancelled) {
        return;
      }
      if (err?.message?.includes('Cannot find module') || err?.message?.includes('NativeModule')) {
        router.push({ pathname: '/checkout', params: { plan: planName } });
        return;
      }
      throw err;
    }
  };

  const handleUpgrade = async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      // Always use Stripe for web/real payment (works on iOS + Android via hosted page)
      // RevenueCat handles native in-app purchases if configured
      if (Platform.OS !== 'web') {
        try {
          const Purchases = require('react-native-purchases').default;
          const apiKey = RC_API_KEY ||
            (Platform.OS === 'ios'
              ? (process.env.EXPO_PUBLIC_RC_IOS_KEY || '')
              : (process.env.EXPO_PUBLIC_RC_ANDROID_KEY || ''));
          if (apiKey) {
            const productId = selectedPlan === 'go' ? PRODUCT_IDS.go : PRODUCT_IDS.plus;
            const priceStr = selectedPlan === 'go' ? '$8.00' : '$19.99';
            await purchaseWithRevenueCat(productId, selectedPlan, priceStr);
            setIsLoading(false);
            return;
          }
        } catch (rcErr: any) {
          // RC not available or failed — fall through to Stripe
          if (!rcErr?.userCancelled) {
            console.log('[subscription] RC failed, using Stripe:', rcErr?.message);
          } else {
            setIsLoading(false);
            return;
          }
        }
      }
      // Stripe hosted checkout (with Apple Pay / Google Pay automatically)
      await purchaseWithStripe(selectedPlan);
    } catch (error: any) {
      showAlert('Purchase Failed', error?.message || 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async () => {
    setIsRestoring(true);
    try {
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
            showAlert('Restored', 'Your subscription has been restored.');
            return;
          }
        }
      } catch (e) {}
      await restorePurchases();
      showAlert('Restored', 'Your purchases have been restored.');
    } catch (error) {
      showAlert('Error', 'Failed to restore purchases. Please contact support.');
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <ImageBackground
      source={{ uri: MAP_BACKGROUND }}
      style={styles.container}
      imageStyle={styles.mapBackground}
    >
      <View style={styles.overlay} />

      <TouchableOpacity
        style={[styles.closeBtn, { top: insets.top + 12 }]}
        onPress={() => router.back()}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="close" size={22} color="#FFF" />
      </TouchableOpacity>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 56, paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Plan logo card with neige/glass effect */}
        <View style={styles.logoCard}>
          {/* Outer glow ring */}
          <View style={[styles.logoGlowRing, {
            borderColor: selectedPlan === 'go' ? 'rgba(52,199,89,0.6)' : 'rgba(107,92,231,0.7)',
            shadowColor: selectedPlan === 'go' ? '#34C759' : '#6B5CE7',
          }]}>
            <Image
              source={currentLogo}
              style={styles.logoImage}
              contentFit="cover"
              transition={300}
            />
            {/* Neige/frost overlay */}
            <View style={styles.frostOverlay} />
            {/* Plan label pill */}
            <View style={[styles.planPill, {
              backgroundColor: selectedPlan === 'go' ? '#34C759' : '#6B5CE7'
            }]}>
              <Text style={styles.planPillText}>
                {selectedPlan === 'go' ? '⚡ GO' : '✨ PLUS'}
              </Text>
            </View>
          </View>
        </View>

        <Text style={styles.title}>{planLabel}</Text>
        <Text style={styles.subtitle}>{planSubtitle}</Text>

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

        <View style={styles.featureCard}>
          <View style={styles.featureRow}>
            <Text style={styles.featureHeaderLabel}>Features</Text>
            <Text style={styles.featureHeaderFree}>Free</Text>
            <Text style={[styles.featureHeaderPlan, { color: planColor }]}>
              {selectedPlan === 'go' ? 'Go' : 'Plus'}
            </Text>
          </View>
          {features.map((f, i) => (
            <View key={f.label} style={[styles.featureRow, i < features.length - 1 && styles.featureRowBorder]}>
              <Text style={styles.featureLabel}>{f.label}</Text>
              <View style={styles.featureCheck}>
                {f.free ? (
                  <Ionicons name="checkmark" size={18} color="rgba(255,255,255,0.7)" />
                ) : (
                  <Text style={styles.featureDash}>—</Text>
                )}
              </View>
              <View style={styles.featureCheck}>
                <Ionicons name="checkmark" size={18} color={planColor} />
              </View>
            </View>
          ))}
        </View>

        <TouchableOpacity onPress={handleRestore} style={styles.restoreBtn} disabled={isRestoring}>
          {isRestoring ? (
            <ActivityIndicator color="rgba(255,255,255,0.8)" size="small" />
          ) : (
            <Text style={styles.restoreText}>Restore Purchases</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      <View style={[styles.bottomCTA, { paddingBottom: insets.bottom + 20 }]}>
        {/* Subscription status badge */}
        {user && subscriptionInfo?.subscribed && (
          <View style={styles.activeBadge}>
            <Ionicons name="checkmark-circle" size={16} color="#34C759" />
            <Text style={styles.activeBadgeText}>
              {subscriptionInfo.plan?.toUpperCase()} active
              {subscriptionInfo.subscription_end
                ? ` · renews ${new Date(subscriptionInfo.subscription_end).toLocaleDateString()}`
                : ''}
            </Text>
          </View>
        )}

        {user && subscriptionInfo?.subscribed ? (
          // Already subscribed — show manage button
          <TouchableOpacity
            style={[styles.upgradeBtn, { backgroundColor: '#2C2C2E', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' }, isManaging && styles.upgradeBtnDisabled]}
            onPress={handleManageSubscription}
            disabled={isManaging}
          >
            {isManaging ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={[styles.upgradeBtnText, { color: '#FFF' }]}>Manage Subscription</Text>
            )}
          </TouchableOpacity>
        ) : (
          // Not subscribed — show upgrade button
          <TouchableOpacity
            style={[styles.upgradeBtn, isLoading && styles.upgradeBtnDisabled]}
            onPress={handleUpgrade}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.upgradeBtnText}>Upgrade for {planPrice}/month</Text>
            )}
          </TouchableOpacity>
        )}

        {/* Refresh status */}
        {user && (
          <TouchableOpacity
            onPress={checkSubscriptionStatus}
            style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}
            disabled={checkingStatus}
          >
            {checkingStatus ? (
              <ActivityIndicator size="small" color="rgba(255,255,255,0.5)" />
            ) : (
              <Ionicons name="refresh" size={14} color="rgba(255,255,255,0.5)" />
            )}
            <Text style={styles.webLink}>Refresh Status</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.legalText}>
          Auto-renews monthly. Cancel anytime via Manage Subscription.{'\n'}
          Apple Pay &amp; Google Pay available at checkout.{'\n'}
          <Text style={[styles.legalText, { textDecorationLine: 'underline' }]}>Learn more</Text>
        </Text>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  mapBackground: { opacity: 0.3 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
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
  scrollContent: {
    alignItems: 'center',
    paddingHorizontal: 24,
    zIndex: 1,
  },
  logoCard: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    marginTop: 8,
  },
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
  logoImage: {
    width: '100%',
    height: '100%',
  },
  frostOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.06)',
    // Neige/ice texture illusion via layered transparency
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
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    marginBottom: 28,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  toggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(28,28,30,0.9)',
    borderRadius: 30,
    padding: 4,
    marginBottom: 28,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  toggleBtn: { flex: 1, paddingVertical: 12, borderRadius: 26, alignItems: 'center' },
  toggleBtnActive: { backgroundColor: '#2C2C2E' },
  toggleText: { fontSize: 16, fontWeight: '500', color: 'rgba(255,255,255,0.4)' },
  toggleTextActive: { color: '#FFF', fontWeight: '700' },
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
  restoreBtn: { marginTop: 8, padding: 12 },
  restoreText: { fontSize: 14, color: 'rgba(255,255,255,0.8)', textDecorationLine: 'underline' },
  bottomCTA: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingTop: 16,
    backgroundColor: 'rgba(0,0,0,0.9)',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  upgradeBtn: {
    width: '100%',
    backgroundColor: '#FFF',
    borderRadius: 50,
    paddingVertical: 17,
    alignItems: 'center',
  },
  upgradeBtnDisabled: { opacity: 0.6 },
  upgradeBtnText: { fontSize: 17, fontWeight: '700', color: '#000' },
  activeBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(52,199,89,0.12)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(52,199,89,0.25)' },
  activeBadgeText: { color: '#34C759', fontSize: 13, fontWeight: '600' },
  webLink: { fontSize: 13, fontWeight: '500', color: 'rgba(255,255,255,0.5)', textDecorationLine: 'underline', marginBottom: 4 },
  legalText: { fontSize: 12, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginTop: 8, lineHeight: 17 },
});
