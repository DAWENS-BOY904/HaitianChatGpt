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

// ── RevenueCat SDK (lazy loaded — not available on web) ───────────────────
let PurchasesModule: any = null;

async function getPurchases() {
  if (Platform.OS === 'web') return null;
  if (PurchasesModule) return PurchasesModule;
  try {
    const rc = await import('react-native-purchases');
    PurchasesModule = rc.default || (rc as any).Purchases || rc;
    return PurchasesModule;
  } catch {
    return null;
  }
}

// ── Environment config ────────────────────────────────────────────────────
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

// ── RevenueCat product IDs ────────────────────────────────────────────────
const RC_PRODUCTS = {
  go: Platform.select({
    ios: 'app.dawinix.go.monthly',
    android: 'app.dawinix.go.monthly',
    default: 'app.dawinix.go.monthly',
  }) as string,
  plus: Platform.select({
    ios: 'app.dawinix.plus.monthly',
    android: 'app.dawinix.plus.monthly',
    default: 'app.dawinix.plus.monthly',
  }) as string,
};

// ── Feature comparison rows ───────────────────────────────────────────────
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

// ── Plan assets ───────────────────────────────────────────────────────────
const GO_LOGO = require('../assets/images/plan-go.png');
const PLUS_LOGO = require('../assets/images/plan-plus.png');

// ── Theme tokens ──────────────────────────────────────────────────────────
function useThemeTokens() {
  const scheme = useColorScheme();
  const dark = scheme !== 'light';
  return {
    dark,
    bg: dark ? '#000000' : '#F2F2F7',
    cardBorder: dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
    text: dark ? '#FFFFFF' : '#000000',
    textSec: dark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)',
    textTertiary: dark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.3)',
    surfaceBorder: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
    blurTint: (dark ? 'dark' : 'light') as 'dark' | 'light',
    bottomBg: dark ? 'rgba(0,0,0,0.95)' : 'rgba(242,242,247,0.97)',
    gradientStart: dark ? '#0a0a0a' : '#E8E8F0',
    gradientEnd: dark ? '#111111' : '#F8F8FF',
    featureCheckInactive: dark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)',
    featureDash: dark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.2)',
    restoreText: dark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.55)',
    toggleTextInactive: dark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)',
    noteText: dark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
  };
}

// ── RevenueCat Helper ─────────────────────────────────────────────────────
class RevenueCatHelper {
  private static isConfigured = false;
  private static Purchases: any = null;

  static async init(): Promise<boolean> {
    if (this.isConfigured) return true;
    const Purchases = await getPurchases();
    if (!Purchases) return false;
    this.Purchases = Purchases;
    const apiKey = getRCApiKey();
    if (!apiKey) return false;
    try {
      await Purchases.configure({ apiKey });
      this.isConfigured = true;
      return true;
    } catch (err: any) {
      console.log('[RevenueCat] configure error:', err.message);
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
}

export default function SubscriptionScreen() {
  const { restorePurchases } = useSubscription();
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

  const safe = useCallback(<S,>(setter: React.Dispatch<React.SetStateAction<S>>, value: S) => {
    if (isMounted.current) setter(value);
  }, []);

  // ── Check subscription status (via backend) ───────────────────────────
  const checkSubscriptionStatus = useCallback(async () => {
    if (!user) return;
    safe(setCheckingStatus, true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      const { data, error } = await supabase.functions.invoke('check-subscription', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!error && data) {
        safe(setSubscriptionInfo, {
          subscribed: data.subscribed ?? false,
          plan: data.plan ?? null,
          subscription_end: data.subscription_end ?? null,
        });
      }
    } catch {
      console.log('[subscription] status check failed');
    } finally {
      safe(setCheckingStatus, false);
    }
  }, [user, supabase, safe]);

  useFocusEffect(
    useCallback(() => {
      checkSubscriptionStatus();
    }, [checkSubscriptionStatus]),
  );

  // ── Guard: check RevenueCat is usable ────────────────────────────────
  const checkRCAvailable = async (): Promise<boolean> => {
    if (Platform.OS === 'web') {
      showAlert('Not Available', 'In-App Purchases are not available on web. Please use the iOS or Android app.');
      return false;
    }
    if (ENV.IS_EXPO_GO) {
      showAlert(
        'Development Build Required',
        'In-App Purchases require a development build.\n\nBuild with EAS:\n\neas build --profile development',
      );
      return false;
    }
    const Purchases = await getPurchases();
    if (!Purchases) {
      showAlert('SDK Missing', 'Please run:\n\nnpx expo install react-native-purchases');
      return false;
    }
    if (!getRCApiKey()) {
      showAlert('Configuration Error', 'RevenueCat API key is missing. Please check app.json extra config.');
      return false;
    }
    return true;
  };

  // ── Core purchase via RevenueCat ──────────────────────────────────────
  const purchaseWithRC = async (plan: 'go' | 'plus') => {
    const ok = await checkRCAvailable();
    if (!ok) return;

    safe(setLoading, true);
    try {
      const configured = await RevenueCatHelper.init();
      if (!configured) throw new Error('Failed to configure RevenueCat. Check your API keys.');

      const offerings = await RevenueCatHelper.getOfferings();
      const offering = offerings.current;
      if (!offering) throw new Error('No offerings available in App Store. Check App Store Connect setup.');

      const productId = RC_PRODUCTS[plan];

      // Try to find matching package by product ID or by package type
      let pkg = offering.availablePackages.find(
        (p: any) =>
          p.product?.productIdentifier === productId ||
          p.product?.identifier === productId,
      );

      // Fallback: use MONTHLY package for go, ANNUAL or second package for plus
      if (!pkg) {
        if (plan === 'go') {
          pkg = offering.availablePackages.find((p: any) => p.packageType === 'MONTHLY');
        } else {
          pkg = offering.availablePackages.find(
            (p: any) => p.packageType === 'ANNUAL' || p.packageType === 'SIX_MONTH',
          ) || offering.availablePackages[1] || offering.availablePackages[0];
        }
      }

      if (!pkg) throw new Error(`${plan === 'go' ? 'Go' : 'Plus'} plan not found in offerings. Contact support.`);

      const { customerInfo } = await RevenueCatHelper.purchasePackage(pkg);

      // Verify with backend & update profile
      const receiptData = JSON.stringify(customerInfo);
      const transactionId = customerInfo?.originalAppUserId || `rc_${Date.now()}`;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('verify-purchase', {
        body: {
          platform: Platform.OS,
          receipt: receiptData,
          transactionId,
          productId,
          isSandbox: __DEV__,
        },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) {
        let msg = error.message;
        if (error instanceof FunctionsHttpError) {
          try { msg = await error.context?.text() || msg; } catch { /* ignore */ }
        }
        throw new Error(msg);
      }

      if (user?.id) {
        await supabase.from('user_profiles').update({
          subscription_tier: plan,
          subscription_expires_at: data?.subscription?.expiresAt || null,
        }).eq('id', user.id);
      }

      showAlert(
        plan === 'go' ? 'Subscribed to Go!' : 'Subscribed to Plus!',
        `Your Dawinix ${plan === 'go' ? 'Go' : 'Plus'} plan is now active. Enjoy!`,
      );
      await checkSubscriptionStatus();
      router.push('/subscription-success');
    } catch (err: any) {
      if (
        err?.userCancelled ||
        err?.code === '1' ||
        err?.code === 'PURCHASE_CANCELLED' ||
        String(err?.message).toLowerCase().includes('cancel')
      ) {
        return; // User cancelled — silent
      }
      showAlert('Purchase Failed', err?.message || 'Something went wrong. Please try again.');
    } finally {
      safe(setLoading, false);
    }
  };

  // ── Manage subscription (open device subscription settings) ──────────
  const handleManage = async () => {
    if (managing) return;
    safe(setManaging, true);
    try {
      if (Platform.OS === 'ios') {
        await Linking.openURL('https://apps.apple.com/account/subscriptions');
      } else if (Platform.OS === 'android') {
        await Linking.openURL('https://play.google.com/store/account/subscriptions');
      } else {
        await Linking.openURL('https://app.revenuecat.com');
      }
    } catch {
      showAlert('Error', 'Could not open subscription management.');
    } finally {
      safe(setManaging, false);
    }
  };

  // ── Restore purchases ─────────────────────────────────────────────────
  const handleRestore = async () => {
    safe(setRestoring, true);
    try {
      if (!ENV.IS_EXPO_GO && Platform.OS !== 'web') {
        const configured = await RevenueCatHelper.init();
        if (configured) {
          const customerInfo = await RevenueCatHelper.restorePurchases();
          const active = customerInfo.entitlements?.active || {};
          if (Object.keys(active).length > 0 && user?.id) {
            const activePlan = Object.keys(active)[0].toLowerCase().includes('plus') ? 'plus' : 'go';
            await supabase.from('user_profiles').update({ subscription_tier: activePlan }).eq('id', user.id);
            showAlert('Purchases Restored', `Your Dawinix ${activePlan === 'plus' ? 'Plus' : 'Go'} subscription has been restored.`);
            await checkSubscriptionStatus();
            return;
          }
        }
      }
      await restorePurchases();
      await checkSubscriptionStatus();
      showAlert('Purchases Restored', 'Your purchases have been restored successfully.');
    } catch {
      showAlert('No Purchases Found', 'No previous purchases were found for this account.');
    } finally {
      safe(setRestoring, false);
    }
  };

  // ── Derived ───────────────────────────────────────────────────────────
  const planColor = selectedPlan === 'go' ? '#34C759' : '#6B5CE7';
  const planPrice = selectedPlan === 'go' ? '$8.00' : '$19.99';
  const features = selectedPlan === 'go' ? GO_FEATURES : PLUS_FEATURES;
  const currentLogo = selectedPlan === 'go' ? GO_LOGO : PLUS_LOGO;
  const isAlreadySubscribed = subscriptionInfo?.subscribed ?? false;

  const subscribeLabel = Platform.OS === 'ios'
    ? `Subscribe with Apple — ${planPrice}/mo`
    : Platform.OS === 'android'
      ? `Subscribe with Google — ${planPrice}/mo`
      : `Subscribe — ${planPrice}/mo`;

  // ── Feature table (shared render) ─────────────────────────────────────
  const renderFeatureRows = () => (
    <>
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
    </>
  );

  // ── Bottom CTA content (shared) ───────────────────────────────────────
  const renderCTAContent = () => (
    <>
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
          style={[styles.primaryBtn, { backgroundColor: T.dark ? '#2C2C2E' : '#E5E5EA', borderWidth: 1, borderColor: T.cardBorder }]}
          onPress={handleManage}
          disabled={managing}
        >
          {managing
            ? <ActivityIndicator color={T.text} />
            : (
              <View style={styles.btnRow}>
                <Ionicons name={Platform.OS === 'ios' ? 'logo-apple' : 'logo-google-playstore'} size={18} color={T.text} />
                <Text style={[styles.primaryBtnText, { color: T.text }]}>Manage Subscription</Text>
              </View>
            )}
        </TouchableOpacity>
      ) : (
        <>
          <TouchableOpacity
            style={[
              styles.primaryBtn,
              { backgroundColor: planColor },
              loading && styles.btnDisabled,
            ]}
            onPress={() => purchaseWithRC(selectedPlan)}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <View style={styles.btnRow}>
                <Ionicons
                  name={Platform.OS === 'ios' ? 'logo-apple' : Platform.OS === 'android' ? 'logo-google-playstore' : 'storefront-outline'}
                  size={20}
                  color="#FFF"
                />
                <Text style={[styles.primaryBtnText, { color: '#FFF' }]}>{subscribeLabel}</Text>
              </View>
            )}
          </TouchableOpacity>
          <Text style={[styles.note, { color: T.noteText }]}>
            {Platform.OS === 'ios'
              ? 'Billed via Apple. Manage in Settings — Subscriptions.'
              : Platform.OS === 'android'
                ? 'Billed via Google Play. Manage in Play Store — Subscriptions.'
                : 'In-App Purchases available on iOS and Android.'}
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
    </>
  );

  return (
    <View style={[styles.root, { backgroundColor: T.bg }]}>
      <LinearGradient
        colors={[T.gradientStart, T.gradientEnd, T.gradientStart]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.blob1, { backgroundColor: planColor }]} />
      <View style={[styles.blob2, { backgroundColor: selectedPlan === 'go' ? '#0096FF' : '#FF2D55' }]} />

      {/* Close */}
      <View style={[styles.closeWrap, { top: insets.top + 12 }]}>
        {Platform.OS === 'ios' ? (
          <BlurView intensity={40} tint={T.blurTint} style={styles.closeBlur} experimentalBlurMethod="dimezisBlurView">
            <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={20} color={T.text} />
            </TouchableOpacity>
          </BlurView>
        ) : (
          <View style={[styles.closeBlur, { backgroundColor: T.dark ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.7)' }]}>
            <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={20} color={T.text} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 64, paddingBottom: insets.bottom + 200 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <View style={styles.logoCard}>
          <View style={[styles.logoGlowRing, { borderColor: planColor + '99', shadowColor: planColor }]}>
            <Image source={currentLogo} style={styles.logoImage} contentFit="cover" transition={300} />
            <BlurView intensity={12} tint={T.blurTint} style={StyleSheet.absoluteFill} />
            <View style={[styles.planPill, { backgroundColor: planColor }]}>
              <Text style={styles.planPillText}>{selectedPlan === 'go' ? '⚡ GO' : '✨ PLUS'}</Text>
            </View>
          </View>
        </View>

        {/* Title */}
        <Text style={[styles.title, { color: T.text }]}>
          {selectedPlan === 'go' ? 'Dawinix Go' : 'Dawinix Plus'}
        </Text>
        <Text style={[styles.subtitle, { color: T.textSec }]}>
          {selectedPlan === 'go'
            ? 'Expanded access via App Store subscription'
            : 'Advanced intelligence via App Store subscription'}
        </Text>

        {/* Plan toggle */}
        {Platform.OS === 'ios' ? (
          <BlurView intensity={60} tint={T.blurTint} style={[styles.toggle, { borderColor: T.cardBorder }]} experimentalBlurMethod="dimezisBlurView">
            {(['go', 'plus'] as const).map((p) => (
              <TouchableOpacity
                key={p}
                style={[styles.toggleBtn, selectedPlan === p && { backgroundColor: planColor + 'CC' }]}
                onPress={() => setSelectedPlan(p)}
              >
                <Text style={[styles.toggleText, { color: selectedPlan === p ? '#FFF' : T.toggleTextInactive }, selectedPlan === p && { fontWeight: '700' }]}>
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
                style={[styles.toggleBtn, selectedPlan === p && { backgroundColor: planColor + 'CC' }]}
                onPress={() => setSelectedPlan(p)}
              >
                <Text style={[styles.toggleText, { color: selectedPlan === p ? '#FFF' : T.toggleTextInactive }, selectedPlan === p && { fontWeight: '700' }]}>
                  {p === 'go' ? '⚡ Go' : '✨ Plus'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Payment badge */}
        {Platform.OS === 'ios' ? (
          <BlurView intensity={50} tint={T.blurTint} style={[styles.paymentBadge, { borderColor: planColor + '55' }]} experimentalBlurMethod="dimezisBlurView">
            <View style={styles.paymentBadgeRow}>
              <Ionicons name="logo-apple" size={18} color={planColor} />
              <Text style={[styles.paymentBadgeText, { color: planColor }]}>
                {'  Apple In-App Purchase · Face ID · RevenueCat'}
              </Text>
            </View>
          </BlurView>
        ) : (
          <View style={[styles.paymentBadge, { borderColor: planColor + '55', backgroundColor: T.dark ? 'rgba(28,28,30,0.7)' : 'rgba(255,255,255,0.6)' }]}>
            <View style={styles.paymentBadgeRow}>
              <Ionicons name={Platform.OS === 'android' ? 'logo-google-playstore' : 'storefront-outline'} size={18} color={planColor} />
              <Text style={[styles.paymentBadgeText, { color: planColor }]}>
                {Platform.OS === 'android'
                  ? '  Google Play · In-App Purchase · RevenueCat'
                  : '  In-App Purchase powered by RevenueCat'}
              </Text>
            </View>
          </View>
        )}

        {/* Features */}
        {Platform.OS === 'ios' ? (
          <BlurView intensity={55} tint={T.blurTint} style={[styles.featureCard, { borderColor: T.cardBorder }]} experimentalBlurMethod="dimezisBlurView">
            {renderFeatureRows()}
          </BlurView>
        ) : (
          <View style={[styles.featureCard, { borderColor: T.cardBorder, backgroundColor: T.dark ? 'rgba(28,28,30,0.85)' : 'rgba(255,255,255,0.75)' }]}>
            {renderFeatureRows()}
          </View>
        )}

        {/* Restore */}
        <TouchableOpacity onPress={handleRestore} style={styles.restoreBtn} disabled={restoring}>
          {restoring
            ? <ActivityIndicator color={T.restoreText} size="small" />
            : <Text style={[styles.restoreText, { color: T.restoreText }]}>Restore Purchases</Text>}
        </TouchableOpacity>
      </ScrollView>

      {/* Bottom CTA */}
      {Platform.OS === 'ios' ? (
        <BlurView
          intensity={80}
          tint={T.blurTint}
          style={[styles.bottomCTA, { paddingBottom: insets.bottom + 20, borderTopColor: T.cardBorder }]}
          experimentalBlurMethod="dimezisBlurView"
        >
          {renderCTAContent()}
        </BlurView>
      ) : (
        <View style={[styles.bottomCTA, { paddingBottom: insets.bottom + 20, borderTopColor: T.cardBorder, backgroundColor: T.bottomBg }]}>
          {renderCTAContent()}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0,
  },
  blob1: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    top: -80,
    left: -60,
    opacity: 0.18,
  },
  blob2: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    bottom: 120,
    right: -80,
    opacity: 0.15,
  },
  closeWrap: {
    position: 'absolute',
    right: 20,
    zIndex: 10,
    borderRadius: 18,
    overflow: 'hidden',
  },
  closeBlur: { borderRadius: 18 },
  closeBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
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
  title: { fontSize: 26, fontWeight: '700', textAlign: 'center', marginBottom: 6, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, textAlign: 'center', marginBottom: 20, lineHeight: 20 },
  toggle: {
    flexDirection: 'row',
    borderRadius: 28,
    padding: 4,
    marginBottom: 16,
    width: '100%',
    borderWidth: 1,
    overflow: 'hidden',
  },
  toggleBtn: { flex: 1, paddingVertical: 11, borderRadius: 24, alignItems: 'center' },
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
  featureCard: { width: '100%', borderRadius: 18, borderWidth: 1, overflow: 'hidden', marginBottom: 16 },
  featureRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
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
  note: { fontSize: 11, textAlign: 'center', lineHeight: 16, paddingHorizontal: 8 },
  refreshBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 2 },
  refreshText: { fontSize: 11 },
  dark: undefined as any,
});
