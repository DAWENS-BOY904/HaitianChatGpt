import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Linking,
  ActivityIndicator,
  useColorScheme,
  StatusBar,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useSubscription } from '../hooks/useSubscription';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAlert, useAuth, getSupabaseClient } from '@/template';
import { useFocusEffect } from '@react-navigation/native';
import { FunctionsHttpError } from '@supabase/supabase-js';
import Constants from 'expo-constants';

// ── RevenueCat SDK (lazy loaded) ──────────────────────────────────────────
let PurchasesModule: any = null;

async function getPurchases() {
  if (PurchasesModule) return PurchasesModule;
  try {
    const rc = await import('react-native-purchases');
    PurchasesModule = rc.default || rc.Purchases || rc;
    return PurchasesModule;
  } catch {
    return null;
  }
}

// ── Environment config ───────────────────────────────────────────────────
const RC_IOS_KEY_HARDCODED = 'appl_LCOBkSEKCqNFllINWlYWexOVaHf';
const RC_ANDROID_KEY_HARDCODED = 'goog_htwkRFMSklkJWsTytqppHVTxkkP';

const ENV = {
  RC_IOS_KEY:
    Constants.expoConfig?.extra?.revenueCatIosKey ||
    process.env.EXPO_PUBLIC_RC_IOS_KEY ||
    RC_IOS_KEY_HARDCODED,
  RC_ANDROID_KEY:
    Constants.expoConfig?.extra?.revenueCatAndroidKey ||
    process.env.EXPO_PUBLIC_RC_ANDROID_KEY ||
    RC_ANDROID_KEY_HARDCODED,
  IS_EXPO_GO: Constants.appOwnership === 'expo',
};

function getRCApiKey(): string {
  if (Platform.OS === 'ios') return ENV.RC_IOS_KEY;
  if (Platform.OS === 'android') return ENV.RC_ANDROID_KEY;
  return '';
}

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

// ── Stripe price IDs ──
const STRIPE_PRICES = {
  plus: 'price_1TPUrzE0VkO7z1Vnlgj45978',
};

// ── Apple IAP product IDs ──
const APPLE_PRODUCT_ID = Platform.select({
  ios: 'app.dawinix.go.monthly',
  android: 'app.dawinix.go.monthly',
  default: 'app.dawinix.go.monthly',
});

// ── Plan assets ──
const GO_LOGO = require('../assets/images/plan-go.png');
const PLUS_LOGO = require('../assets/images/plan-plus.png');

// ── Theme tokens ──
function useThemeTokens() {
  const scheme = useColorScheme();
  const dark = scheme !== 'light';
  return {
    dark,
    bg: dark ? '#000000' : '#F2F2F7',
    card: dark ? 'rgba(28,28,30,0.85)' : 'rgba(255,255,255,0.75)',
    cardBorder: dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
    text: dark ? '#FFFFFF' : '#000000',
    textSec: dark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)',
    textTertiary: dark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.3)',
    surface: dark ? 'rgba(44,44,46,0.9)' : 'rgba(255,255,255,0.9)',
    surfaceBorder: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
    blurTint: (dark ? 'dark' : 'light') as 'dark' | 'light',
    bottomBg: dark ? 'rgba(0,0,0,0.95)' : 'rgba(242,242,247,0.97)',
    gradientStart: dark ? '#0a0a0a' : '#E8E8F0',
    gradientEnd: dark ? '#111111' : '#F8F8FF',
    featureCheckInactive: dark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)',
    featureDash: dark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.2)',
    restoreText: dark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.55)',
    toggleBg: dark ? 'rgba(28,28,30,0.95)' : 'rgba(255,255,255,0.9)',
    toggleActive: dark ? '#3A3A3C' : '#E5E5EA',
    toggleTextInactive: dark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)',
    noteText: dark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
    webBtnBg: dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
    webBtnBorder: dark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.12)',
    webBtnText: dark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.7)',
  };
}

// ── RevenueCat Helper ─────────────────────────────────────────────────────
class RevenueCatHelper {
  private static isConfigured = false;
  private static Purchases: any = null;

  static async init(): Promise<boolean> {
    if (this.isConfigured) return true;

    const Purchases = await getPurchases();
    if (!Purchases) {
      console.log('[RevenueCat] SDK not available');
      return false;
    }

    this.Purchases = Purchases;
    const apiKey = getRCApiKey();

    if (!apiKey) {
      console.log('[RevenueCat] No API key configured');
      return false;
    }

    try {
      await Purchases.configure({ apiKey });
      this.isConfigured = true;
      console.log('[RevenueCat] Configured successfully');
      return true;
    } catch (err: any) {
      console.log('[RevenueCat] Configure failed:', err.message);
      return false;
    }
  }

  static async getOfferings() {
    if (!this.isConfigured) await this.init();
    if (!this.Purchases) throw new Error('RevenueCat not initialized');
    return this.Purchases.getOfferings();
  }

  static async purchasePackage(pkg: any) {
    if (!this.Purchases) throw new Error('RevenueCat not initialized');
    return this.Purchases.purchasePackage(pkg);
  }

  static async restorePurchases() {
    if (!this.Purchases) throw new Error('RevenueCat not initialized');
    return this.Purchases.restorePurchases();
  }

  static async getCustomerInfo() {
    if (!this.Purchases) throw new Error('RevenueCat not initialized');
    return this.Purchases.getCustomerInfo();
  }
}

export default function SubscriptionScreen() {
  const { tier, restorePurchases } = useSubscription();
  const { showAlert } = useAlert();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const supabase = getSupabaseClient();
  const T = useThemeTokens();

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
  const isMounted = useRef(true);

  useEffect(() => {
    return () => { isMounted.current = false; };
  }, []);

  const safeSetState = useCallback(<T,>(setter: React.Dispatch<React.SetStateAction<T>>, value: T) => {
    if (isMounted.current) setter(value);
  }, []);

  // ── Check subscription status ──
  const checkSubscriptionStatus = useCallback(async () => {
    if (!user) return;
    safeSetState(setCheckingStatus, true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      const { data, error } = await supabase.functions.invoke('check-subscription', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!error && data) {
        safeSetState(setSubscriptionInfo, {
          subscribed: data.subscribed ?? false,
          plan: data.plan ?? null,
          subscription_end: data.subscription_end ?? null,
        });
      }
    } catch (e) {
      console.log('[subscription] check failed');
    } finally {
      safeSetState(setCheckingStatus, false);
    }
  }, [user, supabase, safeSetState]);

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

  // ── Check RevenueCat availability ──
  const checkRevenueCatAvailable = async (): Promise<boolean> => {
    // Expo Go doesn't support native IAP
    if (ENV.IS_EXPO_GO) {
      showAlert(
        'Development Build Required',
        'In-App Purchases require a development build.\n\nPlease build with EAS:\n\neas build --profile development'
      );
      return false;
    }

    // Web doesn't support IAP
    if (Platform.OS === 'web') {
      showAlert('Not Available', 'Apple In-App Purchase is only available on mobile devices.');
      return false;
    }

    // Check if SDK is available
    const Purchases = await getPurchases();
    if (!Purchases) {
      showAlert(
        'Not Available',
        'In-App Purchase SDK is not installed. Please run:\n\nnpx expo install react-native-purchases'
      );
      return false;
    }

    // Check API key
    const apiKey = getRCApiKey();
    if (!apiKey) {
      showAlert(
        'Configuration Error',
        'RevenueCat API key is missing.\n\nPlease add to app.json:\n"extra": {\n  "revenueCatIosKey": "your_key",\n  "revenueCatAndroidKey": "your_key"\n}'
      );
      return false;
    }

    return true;
  };

  // ──────────────────────────────────────────
  // GO PLAN → Apple IAP via RevenueCat
  // ──────────────────────────────────────────
  const purchaseGoWithAppleIAP = async () => {
    // Check availability first
    const isAvailable = await checkRevenueCatAvailable();
    if (!isAvailable) return;

    safeSetState(setLoading, true);
    try {
      // Initialize RevenueCat
      const configured = await RevenueCatHelper.init();
      if (!configured) {
        throw new Error('Failed to configure RevenueCat');
      }

      // Get offerings
      const offerings = await RevenueCatHelper.getOfferings();
      const offering = offerings.current;

      if (!offering) {
        throw new Error('No App Store offerings available. Please check App Store Connect configuration.');
      }

      // Find the package
      const pkg = offering.availablePackages.find(
        (p: any) =>
          p.product?.productIdentifier === APPLE_PRODUCT_ID ||
          p.product?.identifier === APPLE_PRODUCT_ID ||
          p.packageType === 'MONTHLY',
      );

      if (!pkg) {
        throw new Error(`Go plan (${APPLE_PRODUCT_ID}) not found in App Store. Please contact support.`);
      }

      // Purchase
      const { customerInfo } = await RevenueCatHelper.purchasePackage(pkg);

      // Verify purchase with backend
      const receiptData = JSON.stringify(customerInfo);
      const transactionId = customerInfo?.originalAppUserId || `rc_${Date.now()}`;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('verify-purchase', {
        body: {
          platform: Platform.OS,
          receipt: receiptData,
          transactionId,
          productId: APPLE_PRODUCT_ID,
          isSandbox: !ENV.IS_EXPO_GO && __DEV__,
        },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) {
        let errMsg = error.message;
        if (error instanceof FunctionsHttpError) {
          try { errMsg = await error.context?.text() || errMsg; } catch { /* ignore */ }
        }
        throw new Error(errMsg);
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Purchase verification failed');
      }

      // Update user profile
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
      // Handle cancellation
      if (
        err?.userCancelled ||
        err?.code === '1' ||
        err?.code === 'PURCHASE_CANCELLED' ||
        err?.message?.toLowerCase().includes('cancel')
      ) {
        return;
      }

      // Handle configuration errors
      if (err?.message?.includes('configure') || err?.message?.includes('not initialized')) {
        showAlert(
          'Configuration Error',
          'RevenueCat is not properly configured. Please check your API keys and try again.'
        );
        return;
      }

      // Handle store errors
      if (err?.message?.includes('STORE_PROBLEM') || err?.message?.includes('store')) {
        showAlert(
          'App Store Error',
          'There was a problem connecting to the App Store. Please try again later.'
        );
        return;
      }

      showAlert('Purchase Failed', err?.message || 'Something went wrong with the purchase.');
    } finally {
      safeSetState(setLoading, false);
    }
  };

  // ──────────────────────────────────────────
  // PLUS PLAN → Stripe hosted checkout
  // ──────────────────────────────────────────
  const purchasePlusWithStripe = async (plan: 'go' | 'plus' = 'plus') => {
    safeSetState(setLoading, true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const priceId = STRIPE_PRICES.plus;

      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: { plan, priceId },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) {
        let errMsg = error.message;
        if (error instanceof FunctionsHttpError) {
          try { errMsg = await error.context?.text() || errMsg; } catch { /* ignore */ }
        }
        throw new Error(errMsg);
      }

      if (!data?.url) throw new Error('No checkout URL returned from Stripe');

      await Linking.openURL(data.url);
      setTimeout(() => checkSubscriptionStatus(), 2000);
    } catch (err: any) {
      showAlert('Error', err?.message || 'Could not open checkout');
    } finally {
      safeSetState(setLoading, false);
    }
  };

  // ── Manage subscription (Stripe portal) ──
  const handleManage = async () => {
    if (!user || managing) return;
    safeSetState(setManaging, true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');
      const { data, error } = await supabase.functions.invoke('customer-portal', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error || !data?.url) throw new Error(error?.message || 'Could not open portal');
      await Linking.openURL(data.url);
      setTimeout(() => checkSubscriptionStatus(), 1500);
    } catch (err: any) {
      showAlert('Error', err?.message || 'Failed to open subscription management');
    } finally {
      safeSetState(setManaging, false);
    }
  };

  // ── Main purchase handler ──
  const handleUpgrade = async () => {
    if (loading) return;
    if (selectedPlan === 'go') {
      await purchaseGoWithAppleIAP();
    } else {
      router.push('/checkout');
    }
  };

  // ── "Buy on Web" (Plus only) ──
  const handleBuyOnWeb = async () => {
    if (loading) return;
    await purchasePlusWithStripe('plus');
  };

  // ── Restore purchases ──
  const handleRestore = async () => {
    safeSetState(setRestoring, true);
    try {
      // Try RevenueCat first
      if (!ENV.IS_EXPO_GO && Platform.OS !== 'web') {
        try {
          const configured = await RevenueCatHelper.init();
          if (configured) {
            const customerInfo = await RevenueCatHelper.restorePurchases();
            const hasActive = Object.keys(customerInfo.entitlements?.active || {}).length > 0;
            if (hasActive && user?.id) {
              await supabase.from('user_profiles').update({ subscription_tier: 'go' }).eq('id', user.id);
              showAlert('Purchases Restored', 'Your Dawinix Go subscription has been restored.');
              await checkSubscriptionStatus();
              return;
            }
          }
        } catch {
          // RevenueCat restore failed, try fallback
        }
      }

      // Fallback to hook restore
      await restorePurchases();
      await checkSubscriptionStatus();
      showAlert('Purchases Restored', 'Your purchases have been restored successfully.');
    } catch {
      showAlert('No Purchases Found', 'No previous purchases were found for this account.');
    } finally {
      safeSetState(setRestoring, false);
    }
  };

  // ── Derived values ──
  const planColor = selectedPlan === 'go' ? '#34C759' : '#6B5CE7';
  const planPrice = selectedPlan === 'go' ? '$8.00' : '$19.99';
  const features = selectedPlan === 'go' ? GO_FEATURES : PLUS_FEATURES;
  const currentLogo = selectedPlan === 'go' ? GO_LOGO : PLUS_LOGO;
  const isAlreadySubscribed = subscriptionInfo?.subscribed ?? false;

  const goButtonLabel = Platform.OS === 'ios' ? 'Subscribe with Apple' : 'Subscribe — Go Plan';
  const plusButtonLabel = Platform.OS === 'ios'
    ? 'Pay with Card or Apple Pay'
    : Platform.OS === 'android'
      ? 'Pay with Card or Google Pay'
      : 'Checkout';

  return (
    <View style={[styles.root, { backgroundColor: T.bg }]}>
      <LinearGradient
        colors={[T.gradientStart, T.gradientEnd, T.gradientStart]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.blob1, { backgroundColor: planColor }]} />
      <View style={[styles.blob2, { backgroundColor: selectedPlan === 'go' ? '#0096FF' : '#FF2D55' }]} />

      {/* Close button */}
      <View style={[styles.closeWrap, { top: insets.top + 12 }]}>
        {Platform.OS === 'ios' ? (
          <BlurView intensity={40} tint={T.blurTint} style={styles.closeBlur} experimentalBlurMethod="dimezisBlurView">
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => router.back()}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={20} color={T.text} />
            </TouchableOpacity>
          </BlurView>
        ) : (
          <View style={[styles.closeBlur, { backgroundColor: T.dark ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.7)' }]}>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => router.back()}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={20} color={T.text} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 64, paddingBottom: insets.bottom + 180 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Logo card */}
        <View style={styles.logoCard}>
          <View
            style={[
              styles.logoGlowRing,
              {
                borderColor: planColor + '99',
                shadowColor: planColor,
              },
            ]}
          >
            <Image source={currentLogo} style={styles.logoImage} contentFit="cover" transition={300} />
            <BlurView intensity={12} tint={T.blurTint} style={StyleSheet.absoluteFill} />
            <View style={[styles.planPill, { backgroundColor: planColor }]}>
              <Text style={styles.planPillText}>
                {selectedPlan === 'go' ? '⚡ GO' : '✨ PLUS'}
              </Text>
            </View>
          </View>
        </View>

        {/* Title */}
        <Text style={[styles.title, { color: T.text }]}>
          {selectedPlan === 'go' ? 'Dawinix Go' : 'Dawinix Plus'}
        </Text>
        <Text style={[styles.subtitle, { color: T.textSec }]}>
          {selectedPlan === 'go'
            ? 'Expanded access via Apple subscription'
            : 'Advanced intelligence via Stripe checkout'}
        </Text>

        {/* Plan toggle */}
        {Platform.OS === 'ios' ? (
          <BlurView intensity={60} tint={T.blurTint} style={[styles.toggle, { borderColor: T.cardBorder }]} experimentalBlurMethod="dimezisBlurView">
            {(['go', 'plus'] as const).map((p) => (
              <TouchableOpacity
                key={p}
                style={[
                  styles.toggleBtn,
                  selectedPlan === p && { backgroundColor: planColor + (T.dark ? 'CC' : 'DD') },
                ]}
                onPress={() => setSelectedPlan(p)}
              >
                <Text
                  style={[
                    styles.toggleText,
                    { color: selectedPlan === p ? '#FFF' : T.toggleTextInactive },
                    selectedPlan === p && { fontWeight: '700' },
                  ]}
                >
                  {p === 'go' ? '⚡ Go' : '✨ Plus'}
                </Text>
              </TouchableOpacity>
            ))}
          </BlurView>
        ) : (
          <View style={[styles.toggle, { borderColor: T.cardBorder, backgroundColor: T.dark ? 'rgba(28,28,30,0.85)' : 'rgba(255,255,255,0.75)' }]}>
            {(['go', 'plus'] as const).map((p) => (
              <TouchableOpacity
                key={p}
                style={[
                  styles.toggleBtn,
                  selectedPlan === p && { backgroundColor: planColor + (T.dark ? 'CC' : 'DD') },
                ]}
                onPress={() => setSelectedPlan(p)}
              >
                <Text
                  style={[
                    styles.toggleText,
                    { color: selectedPlan === p ? '#FFF' : T.toggleTextInactive },
                    selectedPlan === p && { fontWeight: '700' },
                  ]}
                >
                  {p === 'go' ? '⚡ Go' : '✨ Plus'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Payment badge */}
        {Platform.OS === 'ios' ? (
          <BlurView
            intensity={50}
            tint={T.blurTint}
            style={[styles.paymentBadge, { borderColor: planColor + '55' }]}
            experimentalBlurMethod="dimezisBlurView"
          >
            <View style={styles.paymentBadgeRow}>
              <Ionicons
                name={selectedPlan === 'go' ? 'logo-apple' : 'card-outline'}
                size={18}
                color={planColor}
              />
              <Text style={[styles.paymentBadgeText, { color: planColor }]}>
                {'  '}
                {selectedPlan === 'go'
                  ? 'Apple In-App Purchase · Face ID'
                  : 'Card · Apple Pay · Google Pay via Stripe'}
              </Text>
            </View>
          </BlurView>
        ) : (
          <View style={[styles.paymentBadge, { borderColor: planColor + '55', backgroundColor: T.dark ? 'rgba(28,28,30,0.7)' : 'rgba(255,255,255,0.6)' }]}>
            <View style={styles.paymentBadgeRow}>
              <Ionicons
                name={selectedPlan === 'go' ? 'logo-apple' : 'card-outline'}
                size={18}
                color={planColor}
              />
              <Text style={[styles.paymentBadgeText, { color: planColor }]}>
                {'  '}
                {selectedPlan === 'go'
                  ? 'Apple In-App Purchase · Face ID'
                  : 'Card · Apple Pay · Google Pay via Stripe'}
              </Text>
            </View>
          </View>
        )}

        {/* Features table */}
        {Platform.OS === 'ios' ? (
          <BlurView
            intensity={55}
            tint={T.blurTint}
            style={[styles.featureCard, { borderColor: T.cardBorder }]}
            experimentalBlurMethod="dimezisBlurView"
          >
            <View style={[styles.featureRow, { borderBottomColor: T.surfaceBorder, borderBottomWidth: StyleSheet.hairlineWidth }]}>
              <Text style={[styles.featureHeaderLabel, { color: T.textSec }]}>Features</Text>
              <Text style={[styles.featureHeaderFree, { color: T.text }]}>Free</Text>
              <Text style={[styles.featureHeaderPlan, { color: planColor }]}>
                {selectedPlan === 'go' ? 'Go' : 'Plus'}
              </Text>
            </View>
            {features.map((f, i) => (
              <View
                key={f.label}
                style={[
                  styles.featureRow,
                  i < features.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.surfaceBorder },
                ]}
              >
                <Text style={[styles.featureLabel, { color: T.text }]}>{f.label}</Text>
                <View style={styles.featureCheck}>
                  {f.free
                    ? <Ionicons name="checkmark" size={18} color={T.featureCheckInactive} />
                    : <Text style={[styles.featureDash, { color: T.featureDash }]}>—</Text>}
                </View>
                <View style={styles.featureCheck}>
                  <Ionicons name="checkmark-circle" size={18} color={planColor} />
                </View>
              </View>
            ))}
          </BlurView>
        ) : (
          <View style={[styles.featureCard, { borderColor: T.cardBorder, backgroundColor: T.dark ? 'rgba(28,28,30,0.85)' : 'rgba(255,255,255,0.75)' }]}>
            <View style={[styles.featureRow, { borderBottomColor: T.surfaceBorder, borderBottomWidth: StyleSheet.hairlineWidth }]}>
              <Text style={[styles.featureHeaderLabel, { color: T.textSec }]}>Features</Text>
              <Text style={[styles.featureHeaderFree, { color: T.text }]}>Free</Text>
              <Text style={[styles.featureHeaderPlan, { color: planColor }]}>
                {selectedPlan === 'go' ? 'Go' : 'Plus'}
              </Text>
            </View>
            {features.map((f, i) => (
              <View
                key={f.label}
                style={[
                  styles.featureRow,
                  i < features.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.surfaceBorder },
                ]}
              >
                <Text style={[styles.featureLabel, { color: T.text }]}>{f.label}</Text>
                <View style={styles.featureCheck}>
                  {f.free
                    ? <Ionicons name="checkmark" size={18} color={T.featureCheckInactive} />
                    : <Text style={[styles.featureDash, { color: T.featureDash }]}>—</Text>}
                </View>
                <View style={styles.featureCheck}>
                  <Ionicons name="checkmark-circle" size={18} color={planColor} />
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Restore */}
        <TouchableOpacity onPress={handleRestore} style={styles.restoreBtn} disabled={restoring}>
          {restoring
            ? <ActivityIndicator color={T.restoreText} size="small" />
            : <Text style={[styles.restoreText, { color: T.restoreText }]}>Restore Purchases</Text>}
        </TouchableOpacity>
      </ScrollView>

      {/* ── Bottom CTA ── */}
      {Platform.OS === 'ios' ? (
        <BlurView
          intensity={80}
          tint={T.blurTint}
          style={[styles.bottomCTA, { paddingBottom: insets.bottom + 20, borderTopColor: T.cardBorder }]}
          experimentalBlurMethod="dimezisBlurView"
        >
          {user && isAlreadySubscribed && (
            <View style={styles.activeBadge}>
              <Ionicons name="checkmark-circle" size={15} color="#34C759" />
              <Text style={styles.activeBadgeText}>
                {subscriptionInfo?.plan?.toUpperCase()} active
                {subscriptionInfo?.subscription_end
                  ? ` · renews ${new Date(subscriptionInfo.subscription_end).toLocaleDateString()}`
                  : ''}
              </Text>
            </View>
          )}

          {isAlreadySubscribed ? (
            <TouchableOpacity
              style={[
                styles.primaryBtn,
                { backgroundColor: T.dark ? '#2C2C2E' : '#E5E5EA', borderWidth: 1, borderColor: T.cardBorder },
              ]}
              onPress={handleManage}
              disabled={managing}
            >
              {managing
                ? <ActivityIndicator color={T.text} />
                : <Text style={[styles.primaryBtnText, { color: T.text }]}>Manage Subscription</Text>}
            </TouchableOpacity>
          ) : selectedPlan === 'go' ? (
            <>
              <TouchableOpacity
                style={[
                  styles.primaryBtn,
                  { backgroundColor: '#000', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
                  loading && styles.btnDisabled,
                ]}
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
              <Text style={[styles.note, { color: T.noteText }]}>
                Billed via Apple. Manage in Settings — Subscriptions.
              </Text>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={[
                  styles.primaryBtn,
                  { backgroundColor: T.dark ? '#FFF' : '#000' },
                  loading && styles.btnDisabled,
                ]}
                onPress={() => router.push({ pathname: '/checkout', params: { plan: 'plus', priceId: STRIPE_PRICES.plus, price: '19.99', name: 'Dawinix Plus' } })}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={T.dark ? '#000' : '#FFF'} />
                ) : (
                  <View style={styles.btnRow}>
                    <Ionicons name="card-outline" size={20} color={T.dark ? '#000' : '#FFF'} />
                    <Text style={[styles.primaryBtnText, { color: T.dark ? '#000' : '#FFF' }]}>
                      {plusButtonLabel} — {planPrice}/mo
                    </Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.webBtn,
                  { backgroundColor: T.webBtnBg, borderColor: T.webBtnBorder },
                  loading && styles.btnDisabled,
                ]}
                onPress={handleBuyOnWeb}
                disabled={loading}
              >
                <Ionicons name="globe-outline" size={16} color={T.webBtnText} />
                <Text style={[styles.webBtnText, { color: T.webBtnText }]}>Buy on Web</Text>
                <Ionicons name="open-outline" size={14} color={T.textTertiary} />
              </TouchableOpacity>

              <Text style={[styles.note, { color: T.noteText }]}>
                {'Apple Pay & Google Pay available at checkout. DAWINIX2026 — 20% off applied automatically.'}
              </Text>
            </>
          )}

          {user && (
            <TouchableOpacity
              onPress={checkSubscriptionStatus}
              style={styles.refreshBtn}
              disabled={checkingStatus}
            >
              {checkingStatus
                ? <ActivityIndicator size="small" color={T.textTertiary} />
                : <Ionicons name="refresh" size={13} color={T.textTertiary} />}
              <Text style={[styles.refreshText, { color: T.textTertiary }]}>Refresh Status</Text>
            </TouchableOpacity>
          )}
        </BlurView>
      ) : (
        <View
          style={[styles.bottomCTA, { paddingBottom: insets.bottom + 20, borderTopColor: T.cardBorder, backgroundColor: T.bottomBg }]}
        >
          {user && isAlreadySubscribed && (
            <View style={styles.activeBadge}>
              <Ionicons name="checkmark-circle" size={15} color="#34C759" />
              <Text style={styles.activeBadgeText}>
                {subscriptionInfo?.plan?.toUpperCase()} active
                {subscriptionInfo?.subscription_end
                  ? ` · renews ${new Date(subscriptionInfo.subscription_end).toLocaleDateString()}`
                  : ''}
              </Text>
            </View>
          )}

          {isAlreadySubscribed ? (
            <TouchableOpacity
              style={[
                styles.primaryBtn,
                { backgroundColor: T.dark ? '#2C2C2E' : '#E5E5EA', borderWidth: 1, borderColor: T.cardBorder },
              ]}
              onPress={handleManage}
              disabled={managing}
            >
              {managing
                ? <ActivityIndicator color={T.text} />
                : <Text style={[styles.primaryBtnText, { color: T.text }]}>Manage Subscription</Text>}
            </TouchableOpacity>
          ) : selectedPlan === 'go' ? (
            <>
              <TouchableOpacity
                style={[
                  styles.primaryBtn,
                  { backgroundColor: '#000', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
                  loading && styles.btnDisabled,
                ]}
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
              <Text style={[styles.note, { color: T.noteText }]}>
                Billed via Apple. Manage in Settings — Subscriptions.
              </Text>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={[
                  styles.primaryBtn,
                  { backgroundColor: T.dark ? '#FFF' : '#000' },
                  loading && styles.btnDisabled,
                ]}
                onPress={() => router.push({ pathname: '/checkout', params: { plan: 'plus', priceId: STRIPE_PRICES.plus, price: '19.99', name: 'Dawinix Plus' } })}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={T.dark ? '#000' : '#FFF'} />
                ) : (
                  <View style={styles.btnRow}>
                    <Ionicons name="card-outline" size={20} color={T.dark ? '#000' : '#FFF'} />
                    <Text style={[styles.primaryBtnText, { color: T.dark ? '#000' : '#FFF' }]}>
                      {plusButtonLabel} — {planPrice}/mo
                    </Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.webBtn,
                  { backgroundColor: T.webBtnBg, borderColor: T.webBtnBorder },
                  loading && styles.btnDisabled,
                ]}
                onPress={handleBuyOnWeb}
                disabled={loading}
              >
                <Ionicons name="globe-outline" size={16} color={T.webBtnText} />
                <Text style={[styles.webBtnText, { color: T.webBtnText }]}>Buy on Web</Text>
                <Ionicons name="open-outline" size={14} color={T.textTertiary} />
              </TouchableOpacity>

              <Text style={[styles.note, { color: T.noteText }]}>
                {'Apple Pay & Google Pay available at checkout. DAWINIX2026 — 20% off applied automatically.'}
              </Text>
            </>
          )}

          {user && (
            <TouchableOpacity
              onPress={checkSubscriptionStatus}
              style={styles.refreshBtn}
              disabled={checkingStatus}
            >
              {checkingStatus
                ? <ActivityIndicator size="small" color={T.textTertiary} />
                : <Ionicons name="refresh" size={13} color={T.textTertiary} />}
              <Text style={[styles.refreshText, { color: T.textTertiary }]}>Refresh Status</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, position: 'relative', overflow: 'hidden', paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0 },

  blob1: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    top: -80,
    left: -60,
    opacity: 0.18,
    filter: 'blur(60px)' as any,
  },
  blob2: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    bottom: 120,
    right: -80,
    opacity: 0.15,
    filter: 'blur(60px)' as any,
  },

  closeWrap: {
    position: 'absolute',
    right: 20,
    zIndex: 10,
    borderRadius: 18,
    overflow: 'hidden',
  },
  closeBlur: { borderRadius: 18 },
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },

  scroll: { alignItems: 'center', paddingHorizontal: 20 },

  logoCard: { alignItems: 'center', marginBottom: 20, marginTop: 8 },
  logoGlowRing: {
    width: 148,
    height: 148,
    borderRadius: 36,
    borderWidth: 2,
    overflow: 'hidden',
    position: 'relative',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.65,
    shadowRadius: 28,
    elevation: 18,
  },
  logoImage: { width: '100%', height: '100%' },
  planPill: {
    position: 'absolute',
    bottom: 10,
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
    zIndex: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
  },
  planPillText: { color: '#FFF', fontSize: 12, fontWeight: '800', letterSpacing: 0.8 },

  title: {
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },

  toggle: {
    flexDirection: 'row',
    borderRadius: 28,
    padding: 4,
    marginBottom: 16,
    width: '100%',
    borderWidth: 1,
    overflow: 'hidden',
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 24,
    alignItems: 'center',
  },
  toggleText: { fontSize: 15, fontWeight: '500' },

  paymentBadge: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  paymentBadgeRow: { flexDirection: 'row', alignItems: 'center' },
  paymentBadgeText: { fontSize: 13, fontWeight: '600' },

  featureCard: {
    width: '100%',
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 16,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  featureHeaderLabel: { flex: 1, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  featureHeaderFree: { width: 50, textAlign: 'center', fontSize: 12, fontWeight: '600' },
  featureHeaderPlan: { width: 50, textAlign: 'center', fontSize: 12, fontWeight: '700' },
  featureLabel: { flex: 1, fontSize: 14, fontWeight: '400' },
  featureCheck: { width: 50, alignItems: 'center' },
  featureDash: { fontSize: 16, lineHeight: 20 },

  restoreBtn: { marginTop: 4, padding: 12 },
  restoreText: { fontSize: 13, textDecorationLine: 'underline' },

  bottomCTA: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: 1,
    alignItems: 'center',
    gap: 8,
    overflow: 'hidden',
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(52,199,89,0.12)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(52,199,89,0.25)',
  },
  activeBadgeText: { color: '#34C759', fontSize: 12, fontWeight: '600' },

  primaryBtn: {
    width: '100%',
    borderRadius: 50,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { fontSize: 16, fontWeight: '700' },
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnDisabled: { opacity: 0.55 },

  webBtn: {
    width: '100%',
    borderRadius: 50,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    borderWidth: 1,
  },
  webBtnText: { fontSize: 14, fontWeight: '600' },

  note: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 8,
  },

  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
  },
  refreshText: { fontSize: 11 },
});