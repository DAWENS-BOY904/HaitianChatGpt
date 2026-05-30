
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
  ImageBackground,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSubscription } from '../hooks/useSubscription';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAlert, useAuth, getSupabaseClient } from '@/template';
import { useFocusEffect } from '@react-navigation/native';
import { FunctionsHttpError } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { BlurView } from 'expo-blur';

const { width: SCREEN_W } = Dimensions.get('window');

// ── RevenueCat SDK ────────────────────────────────────────────────────────
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

// ── Environment ───────────────────────────────────────────────────────────
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
  animal_monthly: 'app.dawinix.animal.monthly',
  animal_annual: 'app.dawinix.animal.annual',
  lite_monthly: 'app.dawinix.lite.monthly',
  lite_annual: 'app.dawinix.lite.annual',
  super_monthly: 'app.dawinix.super.monthly',
  super_annual: 'app.dawinix.super.annual',
};

// ── Plan Config ───────────────────────────────────────────────────────────
type PlanKey = 'animal' | 'lite' | 'super';

interface PlanConfig {
  key: PlanKey;
  label: string;
  tagline: string;
  accentColor: string;
  accentGlow: string;
  monthly: string;
  annual: string;
  annualPerMonth: string;
  savePct: string;
  trialDays?: number;
  features: Array<{ icon: string; title: string; subtitle?: string }>;
}

const PLANS: PlanConfig[] = [
  {
    key: 'animal',
    label: 'Animal',
    tagline: 'Perfect for pet lovers & explorers',
    accentColor: '#FF9500',
    accentGlow: 'rgba(255,149,0,0.18)',
    monthly: '$4.99',
    annual: '$49.99',
    annualPerMonth: '$4.17',
    savePct: '16%',
    features: [
      { icon: 'images-outline', title: 'Unlimited photo uploads' },
      { icon: 'camera-outline', title: '20 photos per session' },
      { icon: 'time-outline', title: '40 photos per 24 hours' },
      { icon: 'chatbubble-ellipses-outline', title: 'Standard conversations in Chat' },
      { icon: 'hardware-chip-outline', title: '1x AI agent on Basic mode' },
      { icon: 'color-palette-outline', title: 'Try out AI image creation', subtitle: 'Limited access' },
    ],
  },
  {
    key: 'lite',
    label: 'Lite',
    tagline: 'Keep chatting with higher usage',
    accentColor: '#FF6B35',
    accentGlow: 'rgba(255,107,53,0.18)',
    monthly: '$10',
    annual: '$100',
    annualPerMonth: '$8.33',
    savePct: '17%',
    features: [
      { icon: 'images-outline', title: 'Unlimited photo uploads' },
      { icon: 'camera-outline', title: '20 photos per session' },
      { icon: 'time-outline', title: '40 photos per 24 hours' },
      { icon: 'chatbubble-ellipses-outline', title: '2x longer conversations in Chat' },
      { icon: 'hardware-chip-outline', title: '1x AI agent on Expert mode' },
      { icon: 'color-palette-outline', title: 'Try out AI image & video creation' },
      { icon: 'arrow-up-circle-outline', title: 'Increased limits at regular speed' },
    ],
  },
  {
    key: 'super',
    label: 'Super',
    tagline: 'Unlock the full power',
    accentColor: '#FF6B35',
    accentGlow: 'rgba(255,107,53,0.22)',
    monthly: '$30',
    annual: '$300',
    annualPerMonth: '$25',
    savePct: '17%',
    trialDays: 3,
    features: [
      { icon: 'images-outline', title: 'Unlimited photo uploads' },
      { icon: 'camera-outline', title: '50 photos per session' },
      { icon: 'time-outline', title: '100 photos per 24 hours' },
      { icon: 'rocket-outline', title: '5x longer conversations in Chat' },
      { icon: 'people-outline', title: '4x AI agents on Expert mode', subtitle: 'Collaborating to get you the best answers' },
      { icon: 'sparkles-outline', title: 'Make stunning AI images & videos', subtitle: 'With HD 720p, 30-second video' },
      { icon: 'folder-open-outline', title: 'Upload more files for smarter help' },
      { icon: 'flash-outline', title: 'Lightning-fast replies' },
    ],
  },
];

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

// ── Feature Row ───────────────────────────────────────────────────────────
function FeatureRow({ icon, title, subtitle, accentColor, isLast }: {
  icon: string; title: string; subtitle?: string; accentColor: string; isLast?: boolean;
}) {
  return (
    <View style={[fr.row, !isLast && fr.border]}>
      <View style={[fr.iconWrap, { backgroundColor: 'rgba(255,255,255,0.07)' }]}>
        <Ionicons name={icon as any} size={20} color="#FFFFFF" />
      </View>
      <View style={fr.textWrap}>
        <Text style={fr.title}>{title}</Text>
        {subtitle ? <Text style={fr.sub}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

const fr = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 14 },
  border: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.07)' },
  iconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  textWrap: { flex: 1 },
  title: { color: '#FFFFFF', fontSize: 16, fontWeight: '500', lineHeight: 22 },
  sub: { color: 'rgba(255,255,255,0.45)', fontSize: 13, marginTop: 2 },
});

export default function SubscriptionScreen() {
  const { restorePurchases } = useSubscription();
  const { showAlert } = useAlert();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const supabase = getSupabaseClient();

  const [activePlanIdx, setActivePlanIdx] = useState(2); // default: Super
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [loading, setLoading] = useState(false);
  const [webLoading, setWebLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [managing, setManaging] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [subscriptionInfo, setSubscriptionInfo] = useState<{
    subscribed: boolean; plan: string | null; subscription_end: string | null; provider?: string;
  } | null>(null);
  const isMounted = useRef(true);

  useEffect(() => { return () => { isMounted.current = false; }; }, []);

  const safe = useCallback(<S,>(setter: React.Dispatch<React.SetStateAction<S>>, value: S) => {
    if (isMounted.current) setter(value);
  }, []);

  const plan = PLANS[activePlanIdx];
  const accent = plan.accentColor;

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
          provider: data.provider ?? undefined,
        });
      }
    } catch { console.log('[subscription] status check failed'); }
    finally { safe(setCheckingStatus, false); }
  }, [user, supabase, safe]);

  useFocusEffect(useCallback(() => { checkSubscriptionStatus(); }, [checkSubscriptionStatus]));

  const checkRCAvailable = async (): Promise<boolean> => {
    if (Platform.OS === 'web') {
      showAlert('Not Available', 'In-App Purchases are not available on web. Use web billing below.');
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

      const productKey = `${plan.key}_${billingCycle}` as keyof typeof RC_PRODUCTS;
      const productId = RC_PRODUCTS[productKey];

      let pkg = offering.availablePackages.find(
        (p: any) => p.product?.productIdentifier === productId || p.product?.identifier === productId,
      );

      if (!pkg) {
        const pkgType = billingCycle === 'annual' ? 'ANNUAL' : 'MONTHLY';
        pkg = offering.availablePackages.find((p: any) => p.packageType === pkgType)
          || offering.availablePackages[0];
      }

      if (!pkg) throw new Error(`${plan.label} ${billingCycle} plan not found. Contact support.`);

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
          subscription_tier: plan.key,
          subscription_expires_at: data?.subscription?.expiresAt || null,
        }).eq('id', user.id);
      }

      showAlert(`Subscribed to ${plan.label}!`, `Your ${plan.label} plan is now active. Enjoy!`);
      await checkSubscriptionStatus();
      router.push('/subscription-success');
    } catch (err: any) {
      if (err?.userCancelled || err?.code === '1' || String(err?.message).toLowerCase().includes('cancel')) return;
      showAlert('Purchase Failed', err?.message || 'Something went wrong. Please try again.');
    } finally { safe(setLoading, false); }
  };

  const purchaseOnWeb = async () => {
    if (webLoading) return;
    safe(setWebLoading, true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        showAlert('Sign In Required', 'Please sign in to purchase on web.');
        return;
      }
      const { data, error } = await supabase.functions.invoke('revenuecat-web-checkout', {
        body: { plan: plan.key, billingCycle },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) {
        let msg = error.message;
        if (error instanceof FunctionsHttpError) { try { msg = await error.context?.text() || msg; } catch { /* ignore */ } }
        throw new Error(msg);
      }
      const url = data?.url;
      if (!url) throw new Error('No checkout URL received.');
      if (Platform.OS !== 'web') {
        try {
          const wb = require('../utils/web-browser.native');
          if (typeof wb?.openInAppBrowser === 'function') { wb.openInAppBrowser(url); return; }
        } catch { /* fall through */ }
      }
      await Linking.openURL(url);
    } catch (err: any) {
      showAlert('Web Purchase Error', err?.message || 'Could not open web checkout. Please try again.');
    } finally { safe(setWebLoading, false); }
  };

  const handleManage = async () => {
    if (managing) return;
    safe(setManaging, true);
    try {
      if (subscriptionInfo?.provider === 'revenuecat') {
        await Linking.openURL('https://app.revenuecat.com/billing');
      } else if (Platform.OS === 'ios') {
        await Linking.openURL('https://apps.apple.com/account/subscriptions');
      } else if (Platform.OS === 'android') {
        await Linking.openURL('https://play.google.com/store/account/subscriptions');
      } else {
        await Linking.openURL('https://app.revenuecat.com/billing');
      }
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
            const activeKey = Object.keys(active)[0].toLowerCase();
            const activePlan: PlanKey = activeKey.includes('super') ? 'super' : activeKey.includes('lite') ? 'lite' : 'animal';
            await supabase.from('user_profiles').update({ subscription_tier: activePlan }).eq('id', user.id);
            showAlert('Purchases Restored', `Your ${activePlan} subscription has been restored.`);
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

  const isSubscribed = subscriptionInfo?.subscribed ?? false;
  const hasTrial = plan.trialDays && !isSubscribed;

  // ── Price display ─────────────────────────────────────────────────────
  const monthlyPrice = plan.monthly;
  const annualPrice = plan.annual;
  const annualPerMonth = plan.annualPerMonth;

  const ctaLabel = hasTrial
    ? `Start ${plan.trialDays}-day free trial`
    : `Upgrade to ${plan.label}`;

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Background glow blobs */}
      <View style={[s.glowBlob, { backgroundColor: plan.accentGlow, top: -60, right: -40 }]} />
      <View style={[s.glowBlob, { backgroundColor: plan.accentGlow, bottom: 100, left: -60, opacity: 0.5 }]} />

      {/* Close */}
      <TouchableOpacity
        style={[s.closeBtn, { top: insets.top + 12 }]}
        onPress={() => router.back()}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Ionicons name="close" size={18} color="rgba(255,255,255,0.7)" />
      </TouchableOpacity>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[s.scroll, { paddingTop: insets.top + 56, paddingBottom: 220 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        <View style={s.headerWrap}>
          <Text style={s.headerTitle}>
            <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Dawinix </Text>
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontWeight: '300' }}>{plan.label}</Text>
          </Text>
          {hasTrial ? (
            <Text style={s.headerSub}>
              Try <Text style={{ color: accent, fontWeight: '700' }}>Free</Text> for {plan.trialDays} Days
            </Text>
          ) : (
            <Text style={s.headerSub}>{plan.tagline}</Text>
          )}
        </View>

        {/* 3-segment Plan Toggle */}
        <View style={s.segWrap}>
          {PLANS.map((p, i) => (
            <TouchableOpacity
              key={p.key}
              style={[
                s.segBtn,
                activePlanIdx === i && [s.segBtnActive, { borderColor: p.accentColor + '88' }],
              ]}
              onPress={() => setActivePlanIdx(i)}
              activeOpacity={0.75}
            >
              {activePlanIdx === i ? (
                Platform.OS === 'ios' ? (
                  <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
                ) : (
                  <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.1)' }]} />
                )
              ) : null}
              <Text style={[s.segText, activePlanIdx === i && { color: '#FFFFFF', fontWeight: '600' }]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Feature Card */}
        <View style={s.featureCard}>
          {Platform.OS === 'ios' ? (
            <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.04)' }]} />
          )}
          {plan.features.map((f, i) => (
            <FeatureRow
              key={`${plan.key}-${i}`}
              icon={f.icon}
              title={f.title}
              subtitle={f.subtitle}
              accentColor={accent}
              isLast={i === plan.features.length - 1}
            />
          ))}
        </View>

        {/* Billing cards */}
        <View style={s.billingRow}>
          {/* Monthly */}
          <TouchableOpacity
            style={[
              s.billingCard,
              billingCycle === 'monthly' && [s.billingCardActive, { borderColor: accent + '55' }],
            ]}
            onPress={() => setBillingCycle('monthly')}
            activeOpacity={0.8}
          >
            {billingCycle === 'monthly' ? (
              Platform.OS === 'ios' ? (
                <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFill} />
              ) : (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.07)' }]} />
              )
            ) : null}
            {hasTrial && billingCycle === 'monthly' ? (
              <View style={[s.freeBadge, { backgroundColor: accent }]}>
                <Text style={s.freeBadgeText}>FREE</Text>
              </View>
            ) : null}
            <Text style={s.billingLabel}>Monthly</Text>
            <Text style={[s.billingPrice, billingCycle === 'monthly' && { textDecorationLine: hasTrial ? 'line-through' : 'none', opacity: hasTrial ? 0.55 : 1 }]}>
              {monthlyPrice} <Text style={s.billingUnit}>/month</Text>
            </Text>
          </TouchableOpacity>

          {/* Annual */}
          <TouchableOpacity
            style={[
              s.billingCard,
              billingCycle === 'annual' && [s.billingCardActive, { borderColor: accent + '55' }],
            ]}
            onPress={() => setBillingCycle('annual')}
            activeOpacity={0.8}
          >
            {billingCycle === 'annual' ? (
              Platform.OS === 'ios' ? (
                <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFill} />
              ) : (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.07)' }]} />
              )
            ) : null}
            <View style={s.savePill}>
              <Text style={s.savePillText}>Save {plan.savePct}</Text>
            </View>
            <Text style={s.billingLabel}>Yearly</Text>
            <Text style={s.billingPrice}>
              {annualPrice} <Text style={s.billingUnit}>/year</Text>
            </Text>
            <Text style={s.billingPerMonth}>{annualPerMonth} /month</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ── Bottom CTA ── */}
      <View style={[s.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        {Platform.OS === 'ios' ? (
          <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(10,10,12,0.97)' }]} />
        )}

        {isSubscribed && subscriptionInfo ? (
          <>
            <View style={s.activeBadge}>
              <Ionicons name="checkmark-circle" size={14} color={accent} />
              <Text style={[s.activeBadgeText, { color: accent }]}>
                {subscriptionInfo.plan?.toUpperCase()} ACTIVE
                {subscriptionInfo.subscription_end
                  ? ` · renews ${new Date(subscriptionInfo.subscription_end).toLocaleDateString()}`
                  : ''}
              </Text>
            </View>
            <TouchableOpacity style={s.manageBtn} onPress={handleManage} disabled={managing}>
              {managing ? <ActivityIndicator color="#fff" /> : <Text style={s.manageBtnText}>Manage Subscription</Text>}
            </TouchableOpacity>
          </>
        ) : (
          <>
            {/* Primary CTA */}
            <TouchableOpacity
              style={[s.ctaBtn, (loading || webLoading) && { opacity: 0.6 }]}
              onPress={Platform.OS !== 'web' ? purchaseWithRC : purchaseOnWeb}
              disabled={loading || webLoading}
              activeOpacity={0.85}
            >
              {loading || webLoading ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={s.ctaBtnText}>{ctaLabel}</Text>
              )}
            </TouchableOpacity>

            {/* Renewal note */}
            {hasTrial ? (
              <Text style={s.renewNote}>
                Renews at {monthlyPrice} a month after trial, cancel anytime
              </Text>
            ) : (
              <Text style={s.renewNote}>Cancel anytime. No hidden fees.</Text>
            )}
          </>
        )}

        {/* Footer links */}
        <View style={s.footerRow}>
          <TouchableOpacity onPress={() => Linking.openURL('https://dawinix.com/terms').catch(() => {})}>
            <Text style={s.footerLink}>Terms of Service</Text>
          </TouchableOpacity>
          <Text style={s.footerDot}>·</Text>
          <TouchableOpacity onPress={() => Linking.openURL('https://dawinix.com/privacy').catch(() => {})}>
            <Text style={s.footerLink}>Privacy Policy</Text>
          </TouchableOpacity>
          <Text style={s.footerDot}>·</Text>
          <TouchableOpacity onPress={handleRestore} disabled={restoring}>
            {restoring ? (
              <ActivityIndicator size="small" color="rgba(255,255,255,0.35)" />
            ) : (
              <Text style={s.footerLink}>Restore Purchases</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#080808' },

  glowBlob: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
  },

  closeBtn: {
    position: 'absolute',
    left: 18,
    zIndex: 20,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  scroll: { alignItems: 'center', paddingHorizontal: 20 },

  // Header
  headerWrap: { alignItems: 'center', marginBottom: 24 },
  headerTitle: { fontSize: 34, letterSpacing: -0.5, marginBottom: 6 },
  headerSub: { fontSize: 17, color: 'rgba(255,255,255,0.6)', fontWeight: '400', textAlign: 'center' },

  // Segment
  segWrap: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 50,
    padding: 4,
    width: '100%',
    marginBottom: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  segBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 46,
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  segBtnActive: {},
  segText: { fontSize: 14, fontWeight: '400', color: 'rgba(255,255,255,0.38)', zIndex: 1 },

  // Feature card
  featureCard: {
    width: '100%',
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 16,
    paddingVertical: 4,
    marginBottom: 20,
    overflow: 'hidden',
  },

  // Billing cards
  billingRow: { flexDirection: 'row', width: '100%', gap: 12, marginBottom: 8 },
  billingCard: {
    flex: 1,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 16,
    minHeight: 100,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'flex-end',
  },
  billingCardActive: {
    borderWidth: 1,
  },
  freeBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    zIndex: 2,
  },
  freeBadgeText: { color: '#000', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  savePill: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(255,255,255,0.13)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    zIndex: 2,
  },
  savePillText: { color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '600' },
  billingLabel: { color: 'rgba(255,255,255,0.55)', fontSize: 13, fontWeight: '500', marginBottom: 6 },
  billingPrice: { color: '#FFFFFF', fontSize: 22, fontWeight: '700', lineHeight: 26 },
  billingUnit: { fontSize: 13, fontWeight: '400', color: 'rgba(255,255,255,0.55)' },
  billingPerMonth: { color: 'rgba(255,255,255,0.45)', fontSize: 12, marginTop: 3 },

  // Bottom bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    gap: 10,
    overflow: 'hidden',
  },

  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  activeBadgeText: { fontSize: 12, fontWeight: '600' },

  ctaBtn: {
    width: '100%',
    height: 54,
    borderRadius: 50,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  ctaBtnText: { color: '#000000', fontSize: 17, fontWeight: '700' },

  manageBtn: {
    width: '100%',
    height: 50,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  manageBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },

  renewNote: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.38)',
    textAlign: 'center',
    lineHeight: 17,
  },

  footerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'center' },
  footerLink: { fontSize: 12, color: 'rgba(255,255,255,0.3)' },
  footerDot: { fontSize: 12, color: 'rgba(255,255,255,0.2)' },
});
