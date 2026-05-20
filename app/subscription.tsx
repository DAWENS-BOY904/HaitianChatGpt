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
  StatusBar,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSubscription } from '../hooks/useSubscription';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAlert, useAuth, getSupabaseClient } from '@/template';
import { useFocusEffect } from '@react-navigation/native';
import { FunctionsHttpError } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const { height: SCREEN_H } = Dimensions.get('window');

// ── RevenueCat SDK (lazy loaded — not available on web) ───────────────────
let PurchasesModule: any = null;
async function getPurchases() {
  if (Platform.OS === 'web') return null;
  if (PurchasesModule) return PurchasesModule;
  try {
    const rc = await import('react-native-purchases');
    PurchasesModule = rc.default || (rc as any).Purchases || rc;
    return PurchasesModule;
  } catch { return null; }
}

// ── Environment config ────────────────────────────────────────────────────
const RC_IOS_KEY_HARDCODED = 'appl_LCOBkSEKCqNFllINWlYWexOVaHf';
const RC_ANDROID_KEY_HARDCODED = 'goog_htwkRFMSklkJWsTytqppHVTxkkP';
const ENV = {
  RC_IOS_KEY: Constants.expoConfig?.extra?.revenueCatIosKey || process.env.EXPO_PUBLIC_RC_IOS_KEY || RC_IOS_KEY_HARDCODED,
  RC_ANDROID_KEY: Constants.expoConfig?.extra?.revenueCatAndroidKey || process.env.EXPO_PUBLIC_RC_ANDROID_KEY || RC_ANDROID_KEY_HARDCODED,
  IS_EXPO_GO: Constants.appOwnership === 'expo',
};
function getRCApiKey() {
  if (Platform.OS === 'ios') return ENV.RC_IOS_KEY;
  if (Platform.OS === 'android') return ENV.RC_ANDROID_KEY;
  return '';
}

// ── Product IDs ───────────────────────────────────────────────────────────
const RC_PRODUCTS = {
  go_monthly: 'app.dawinix.go.monthly',
  go_annual: 'app.dawinix.go.annual',
  plus_monthly: 'app.dawinix.plus.monthly',
  plus_annual: 'app.dawinix.plus.annual',
};

// ── Pricing ───────────────────────────────────────────────────────────────
const PRICING = {
  go: { monthly: '$7.99', annual: '$47.99', annualPerMonth: '$4.00', savePct: '50%' },
  plus: { monthly: '$9.99', annual: '$59.99', annualPerMonth: '$5.00', savePct: '50%' },
};

// ── Features ──────────────────────────────────────────────────────────────
const GO_FEATURES = [
  'Basic AI models',
  'More daily messages',
  '10 image uploads / session',
  '10 file uploads / session',
  'Group chat creation',
  'Longer conversation memory',
];

const PLUS_FEATURES = [
  'Everything in Go',
  'Advanced AI (GPT-4o & Claude)',
  'Unlimited daily usage',
  '50 images per day',
  '50 file uploads per session',
  'Group chat creation',
  'Longer conversation memory',
  'Priority access to new features',
  'No ads',
];

const GO_LOGO = require('../assets/images/plan-go.png');

// ── Theme constants ───────────────────────────────────────────────────────
const GREEN = '#2ECC5A';
const DARK_BG = '#060606';
const CARD_BG = 'rgba(16,40,22,0.92)';
const CARD_BORDER = 'rgba(46,204,90,0.22)';
const UNSELECTED_CARD = 'rgba(28,28,30,0.85)';
const UNSELECTED_BORDER = 'rgba(255,255,255,0.08)';

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

  const [selectedPlan, setSelectedPlan] = useState<'go' | 'plus'>('plus');
  const [billingCycle, setBillingCycle] = useState<'annual' | 'monthly'>('annual');
  const [loading, setLoading] = useState(false);
  const [webLoading, setWebLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [managing, setManaging] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [subscriptionInfo, setSubscriptionInfo] = useState<{
    subscribed: boolean; plan: string | null; subscription_end: string | null;
  } | null>(null);
  const isMounted = useRef(true);

  useEffect(() => { return () => { isMounted.current = false; }; }, []);

  const safe = useCallback(<S,>(setter: React.Dispatch<React.SetStateAction<S>>, value: S) => {
    if (isMounted.current) setter(value);
  }, []);

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
    } catch { console.log('[subscription] status check failed'); }
    finally { safe(setCheckingStatus, false); }
  }, [user, supabase, safe]);

  useFocusEffect(useCallback(() => { checkSubscriptionStatus(); }, [checkSubscriptionStatus]));

  const checkRCAvailable = async (): Promise<boolean> => {
    if (Platform.OS === 'web') {
      showAlert('Not Available', 'In-App Purchases are not available on web. Use "Buy on Web" below.');
      return false;
    }
    if (ENV.IS_EXPO_GO) {
      showAlert('Development Build Required', 'In-App Purchases require a development build.\n\nBuild with EAS:\n\neas build --profile development');
      return false;
    }
    const Purchases = await getPurchases();
    if (!Purchases) { showAlert('SDK Missing', 'Please run:\n\nnpx expo install react-native-purchases'); return false; }
    if (!getRCApiKey()) { showAlert('Configuration Error', 'RevenueCat API key is missing.'); return false; }
    return true;
  };

  const purchaseWithRC = async () => {
    const ok = await checkRCAvailable();
    if (!ok) return;
    safe(setLoading, true);
    try {
      const configured = await RevenueCatHelper.init();
      if (!configured) throw new Error('Failed to configure RevenueCat. Check your API keys.');
      const offerings = await RevenueCatHelper.getOfferings();
      const offering = offerings.current;
      if (!offering) throw new Error('No offerings available. Check App Store Connect setup.');

      const productKey = `${selectedPlan}_${billingCycle}` as keyof typeof RC_PRODUCTS;
      const productId = RC_PRODUCTS[productKey];

      let pkg = offering.availablePackages.find(
        (p: any) => p.product?.productIdentifier === productId || p.product?.identifier === productId,
      );

      if (!pkg) {
        const pkgType = billingCycle === 'annual' ? 'ANNUAL' : 'MONTHLY';
        pkg = offering.availablePackages.find((p: any) => p.packageType === pkgType)
          || offering.availablePackages[0];
      }

      if (!pkg) throw new Error(`${selectedPlan} ${billingCycle} plan not found. Contact support.`);

      const { customerInfo } = await RevenueCatHelper.purchasePackage(pkg);
      const receiptData = JSON.stringify(customerInfo);
      const transactionId = customerInfo?.originalAppUserId || `rc_${Date.now()}`;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('verify-purchase', {
        body: { platform: Platform.OS, receipt: receiptData, transactionId, productId, isSandbox: __DEV__ },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) {
        let msg = error.message;
        if (error instanceof FunctionsHttpError) { try { msg = await error.context?.text() || msg; } catch { /* ignore */ } }
        throw new Error(msg);
      }

      if (user?.id) {
        await supabase.from('user_profiles').update({
          subscription_tier: selectedPlan,
          subscription_expires_at: data?.subscription?.expiresAt || null,
        }).eq('id', user.id);
      }

      showAlert(
        `Subscribed to ${selectedPlan === 'go' ? 'Go' : 'Plus'}!`,
        `Your Dawinix ${selectedPlan === 'go' ? 'Go' : 'Plus'} plan is now active. Enjoy!`,
      );
      await checkSubscriptionStatus();
      router.push('/subscription-success');
    } catch (err: any) {
      if (err?.userCancelled || err?.code === '1' || String(err?.message).toLowerCase().includes('cancel')) return;
      showAlert('Purchase Failed', err?.message || 'Something went wrong. Please try again.');
    } finally { safe(setLoading, false); }
  };

  // ── Web Purchase via Stripe checkout (connected to RevenueCat via webhook) ──
  const purchaseOnWeb = async () => {
    if (webLoading) return;
    safe(setWebLoading, true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        showAlert('Sign In Required', 'Please sign in to purchase on web.');
        return;
      }
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: { plan: selectedPlan, mode: 'hosted' },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) {
        let msg = error.message;
        if (error instanceof FunctionsHttpError) { try { msg = await error.context?.text() || msg; } catch { /* ignore */ } }
        throw new Error(msg);
      }
      const url = data?.url;
      if (!url) throw new Error('No checkout URL received.');
      await Linking.openURL(url);
    } catch (err: any) {
      showAlert('Web Purchase Error', err?.message || 'Could not open web checkout. Please try again.');
    } finally { safe(setWebLoading, false); }
  };

  const handleManage = async () => {
    if (managing) return;
    safe(setManaging, true);
    try {
      if (Platform.OS === 'ios') await Linking.openURL('https://apps.apple.com/account/subscriptions');
      else if (Platform.OS === 'android') await Linking.openURL('https://play.google.com/store/account/subscriptions');
      else await Linking.openURL('https://app.revenuecat.com');
    } catch { showAlert('Error', 'Could not open subscription management.'); }
    finally { safe(setManaging, false); }
  };

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
    } catch { showAlert('No Purchases Found', 'No previous purchases were found for this account.'); }
    finally { safe(setRestoring, false); }
  };

  const features = selectedPlan === 'go' ? GO_FEATURES : PLUS_FEATURES;
  const pricing = PRICING[selectedPlan];
  const currentPrice = billingCycle === 'annual' ? pricing.annualPerMonth : pricing.monthly;
  const isSubscribed = subscriptionInfo?.subscribed ?? false;

  const subscribeLabel = Platform.OS === 'ios'
    ? `Subscribe with Apple — ${currentPrice}/mo`
    : Platform.OS === 'android'
      ? `Subscribe with Google — ${currentPrice}/mo`
      : `Subscribe — ${currentPrice}/mo`;

  const BOTTOM_BAR_H = isSubscribed ? 130 : selectedPlan === 'plus' ? 180 : 140;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={DARK_BG} />

      {/* Subtle green glow */}
      <View style={styles.glowTop} />

      {/* Close button */}
      <View style={[styles.closeWrap, { top: insets.top + 10 }]}>
        <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="close" size={17} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 48, paddingBottom: BOTTOM_BAR_H + 16 },
        ]}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* App Icon + Title */}
        <View style={styles.header}>
          <View style={styles.iconWrap}>
            <View style={styles.iconGlow} />
            <View style={styles.iconCard}>
              <Image source={GO_LOGO} style={styles.iconImage} contentFit="cover" transition={200} />
            </View>
          </View>
          <Text style={styles.title}>Dawinix Go</Text>
          <Text style={styles.subtitle}>Unlock the full power of Dawinix Go{'\n'}and take your productivity to the next level.</Text>
        </View>

        {/* Plan Toggle */}
        <View style={styles.planToggleWrap}>
          {(['go', 'plus'] as const).map((plan) => (
            <TouchableOpacity
              key={plan}
              style={[styles.planToggleBtn, selectedPlan === plan && styles.planToggleBtnActive]}
              onPress={() => setSelectedPlan(plan)}
            >
              {selectedPlan === plan && (
                <LinearGradient colors={['#1a7a32', GREEN]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
              )}
              <Text style={[styles.planToggleText, selectedPlan === plan && styles.planToggleTextActive]}>
                {plan === 'go' ? '⚡ Go' : '✦ Plus'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Feature List Card */}
        <View style={styles.featureCard}>
          <Text style={styles.featureCardTitle}>
            {selectedPlan === 'go' ? 'GO PLAN FEATURES' : 'PLUS PLAN FEATURES'}
          </Text>
          {features.map((feature, i) => (
            <View
              key={feature}
              style={[
                styles.featureRow,
                i < features.length - 1 && styles.featureRowBorder,
              ]}
            >
              <Ionicons name="checkmark-circle" size={20} color={GREEN} />
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
        </View>

        {/* Billing Cycle — Annual */}
        <TouchableOpacity
          style={[styles.billingCard, billingCycle === 'annual' && styles.billingCardActive]}
          onPress={() => setBillingCycle('annual')}
          activeOpacity={0.8}
        >
          {billingCycle === 'annual' && (
            <View style={styles.saveBadge}>
              <Text style={styles.saveBadgeText}>SAVE {pricing.savePct}</Text>
            </View>
          )}
          <View style={styles.billingCardRow}>
            <View>
              <Text style={styles.billingCycleLabel}>Annual</Text>
              <Text style={styles.billingCyclePrice}>{pricing.annual} / year</Text>
            </View>
            <View style={styles.billingRight}>
              <Text style={[styles.billingPerMonth, billingCycle === 'annual' && { color: GREEN }]}>
                {pricing.annualPerMonth} / mo
              </Text>
              {billingCycle === 'annual'
                ? <Ionicons name="checkmark-circle" size={22} color={GREEN} />
                : <View style={styles.emptyCircle} />}
            </View>
          </View>
        </TouchableOpacity>

        {/* Billing Cycle — Monthly */}
        <TouchableOpacity
          style={[styles.billingCard, billingCycle === 'monthly' && styles.billingCardActive]}
          onPress={() => setBillingCycle('monthly')}
          activeOpacity={0.8}
        >
          <View style={styles.billingCardRow}>
            <View>
              <Text style={styles.billingCycleLabel}>Monthly</Text>
              <Text style={styles.billingCyclePrice}>{pricing.monthly} / month</Text>
            </View>
            <View style={styles.billingRight}>
              {billingCycle === 'monthly'
                ? <Ionicons name="checkmark-circle" size={22} color={GREEN} />
                : <View style={styles.emptyCircle} />}
            </View>
          </View>
        </TouchableOpacity>

        {/* Cancel anytime */}
        <View style={styles.cancelRow}>
          <Ionicons name="shield-checkmark" size={13} color={GREEN} />
          <Text style={styles.cancelText}>Cancel anytime. No hidden fees.</Text>
        </View>

        {/* Restore */}
        <TouchableOpacity onPress={handleRestore} style={styles.restoreBtn} disabled={restoring}>
          {restoring
            ? <ActivityIndicator color="rgba(255,255,255,0.4)" size="small" />
            : <Text style={styles.restoreText}>Restore Purchases</Text>}
        </TouchableOpacity>
      </ScrollView>

      {/* ── Bottom CTA Bar ── */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 10 }]}>
        {/* Active badge */}
        {user && isSubscribed && (
          <View style={styles.activeBadge}>
            <Ionicons name="checkmark-circle" size={13} color={GREEN} />
            <Text style={styles.activeBadgeText}>
              {subscriptionInfo?.plan?.toUpperCase()} active
              {subscriptionInfo?.subscription_end
                ? ` · renews ${new Date(subscriptionInfo.subscription_end).toLocaleDateString()}`
                : ''}
            </Text>
          </View>
        )}

        {isSubscribed ? (
          /* Manage button */
          <TouchableOpacity style={styles.manageBtn} onPress={handleManage} disabled={managing}>
            {managing
              ? <ActivityIndicator color="#fff" />
              : (
                <View style={styles.btnRow}>
                  <Ionicons name={Platform.OS === 'ios' ? 'logo-apple' : 'logo-google-playstore'} size={17} color="#fff" />
                  <Text style={styles.subscribeBtnText}>Manage Subscription</Text>
                </View>
              )}
          </TouchableOpacity>
        ) : (
          <>
            {/* Primary subscribe button (native IAP) */}
            {Platform.OS !== 'web' && (
              <TouchableOpacity
                style={[styles.subscribeBtn, loading && { opacity: 0.6 }]}
                onPress={purchaseWithRC}
                disabled={loading}
              >
                <LinearGradient
                  colors={['#23a844', GREEN, '#23a844']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFill}
                />
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : (
                    <View style={styles.btnRow}>
                      <Ionicons
                        name={Platform.OS === 'ios' ? 'logo-apple' : 'logo-google-playstore'}
                        size={19}
                        color="#fff"
                      />
                      <Text style={styles.subscribeBtnText}>{subscribeLabel}</Text>
                    </View>
                  )}
              </TouchableOpacity>
            )}

            {/* Web purchase — always shown for Plus; on web it's the primary button */}
            {(selectedPlan === 'plus' || Platform.OS === 'web') && (
              <TouchableOpacity
                style={[styles.webBtn, Platform.OS === 'web' && styles.webBtnPrimary, webLoading && { opacity: 0.6 }]}
                onPress={purchaseOnWeb}
                disabled={webLoading}
              >
                {webLoading
                  ? <ActivityIndicator color={Platform.OS === 'web' ? '#fff' : GREEN} size="small" />
                  : (
                    <View style={styles.btnRow}>
                      <Ionicons name="globe-outline" size={17} color={Platform.OS === 'web' ? '#fff' : GREEN} />
                      <Text style={[styles.webBtnText, Platform.OS === 'web' && { color: '#fff' }]}>
                        {Platform.OS === 'web' ? `Subscribe on Web — ${currentPrice}/mo` : 'Buy on Web instead'}
                      </Text>
                    </View>
                  )}
              </TouchableOpacity>
            )}
          </>
        )}

        {/* Billing note */}
        <Text style={styles.billingNote}>
          {Platform.OS === 'ios'
            ? 'Billed via Apple. Manage in Settings — Subscriptions.'
            : Platform.OS === 'android'
              ? 'Billed via Google Play. Manage in Play Store — Subscriptions.'
              : 'Secure payment via Stripe.'}
        </Text>

        {/* Refresh status */}
        {user && (
          <TouchableOpacity style={styles.refreshBtn} onPress={checkSubscriptionStatus} disabled={checkingStatus}>
            {checkingStatus
              ? <ActivityIndicator size="small" color="rgba(255,255,255,0.25)" />
              : <Ionicons name="refresh" size={11} color="rgba(255,255,255,0.25)" />}
            <Text style={styles.refreshText}>Refresh Status</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: DARK_BG },

  glowTop: {
    position: 'absolute',
    top: -70,
    alignSelf: 'center',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(46,204,90,0.07)',
  },

  closeWrap: { position: 'absolute', left: 16, zIndex: 20 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.11)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  scroll: { alignItems: 'center', paddingHorizontal: 18 },

  // Header
  header: { alignItems: 'center', marginBottom: 16 },
  iconWrap: { alignItems: 'center', marginBottom: 10, position: 'relative' },
  iconGlow: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(46,204,90,0.15)',
    top: 2,
  },
  iconCard: {
    width: 80,
    height: 80,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(46,204,90,0.32)',
    shadowColor: GREEN,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 10,
  },
  iconImage: { width: '100%', height: '100%' },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.5,
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
    lineHeight: 19,
  },

  // Plan toggle
  planToggleWrap: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 50,
    padding: 4,
    width: '100%',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden',
  },
  planToggleBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 46,
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  planToggleBtnActive: {},
  planToggleText: { fontSize: 14, fontWeight: '500', color: 'rgba(255,255,255,0.35)', zIndex: 1 },
  planToggleTextActive: { color: '#fff', fontWeight: '700', zIndex: 1 },

  // Feature card
  featureCard: {
    width: '100%',
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    marginBottom: 12,
    shadowColor: GREEN,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 5,
  },
  featureCardTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: GREEN,
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    gap: 10,
  },
  featureRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(46,204,90,0.10)',
  },
  featureText: { fontSize: 14, color: '#fff', fontWeight: '400', flex: 1, lineHeight: 19 },

  // Billing cards
  billingCard: {
    width: '100%',
    backgroundColor: UNSELECTED_CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: UNSELECTED_BORDER,
    padding: 14,
    marginBottom: 8,
    overflow: 'visible',
    position: 'relative',
  },
  billingCardActive: {
    backgroundColor: CARD_BG,
    borderColor: CARD_BORDER,
    shadowColor: GREEN,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  saveBadge: {
    position: 'absolute',
    top: -11,
    left: 14,
    backgroundColor: '#c8a227',
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 2,
    zIndex: 2,
  },
  saveBadgeText: { fontSize: 10, fontWeight: '800', color: '#000', letterSpacing: 0.5 },
  billingCardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 2 },
  billingCycleLabel: { fontSize: 15, fontWeight: '600', color: '#fff', marginBottom: 2 },
  billingCyclePrice: { fontSize: 12, color: 'rgba(255,255,255,0.38)' },
  billingRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  billingPerMonth: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.85)' },
  emptyCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.22)',
  },

  cancelRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6, marginBottom: 2 },
  cancelText: { fontSize: 12, color: 'rgba(255,255,255,0.4)' },

  restoreBtn: { paddingVertical: 10, paddingHorizontal: 16 },
  restoreText: { fontSize: 12, color: 'rgba(255,255,255,0.3)', textDecorationLine: 'underline' },

  // Bottom bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 18,
    paddingTop: 12,
    backgroundColor: 'rgba(6,6,6,0.97)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    gap: 6,
  },

  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(46,204,90,0.1)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(46,204,90,0.2)',
    marginBottom: 2,
  },
  activeBadgeText: { color: GREEN, fontSize: 12, fontWeight: '600' },

  subscribeBtn: {
    width: '100%',
    height: 50,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: GREEN,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 9,
  },
  manageBtn: {
    width: '100%',
    height: 50,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },

  // Web purchase button
  webBtn: {
    width: '100%',
    height: 44,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(46,204,90,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(46,204,90,0.25)',
  },
  webBtnPrimary: {
    backgroundColor: CARD_BG,
    borderColor: CARD_BORDER,
    shadowColor: GREEN,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  webBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: GREEN,
  },

  btnRow: { flexDirection: 'row', alignItems: 'center', gap: 7, zIndex: 1 },
  subscribeBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },

  billingNote: { fontSize: 10, color: 'rgba(255,255,255,0.25)', textAlign: 'center' },
  refreshBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingVertical: 2 },
  refreshText: { fontSize: 10, color: 'rgba(255,255,255,0.2)' },
});
implement web purchases in app/subscription.tsx using the RevenueCat REST API v2 instead of Stripe: call the RevenueCat API to create a purchase or redirect to a hosted paywall, then verify entitlements server-side via the check-subscription edge function.