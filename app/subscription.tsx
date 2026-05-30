import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
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

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

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
  lite_monthly: 'app.dawinix.lite.monthly',
  lite_annual: 'app.dawinix.lite.annual',
  super_monthly: 'app.dawinix.super.monthly',
  super_annual: 'app.dawinix.super.annual',
};

type PlanKey = 'lite' | 'super';

interface PlanConfig {
  key: PlanKey;
  label: string;
  displayTitle: string;
  tagline: string;
  trialTagline?: string;
  accentColor: string;
  monthly: string;
  monthlyRaw: string;
  annual: string;
  annualPerMonth: string;
  savePct: string;
  trialDays?: number;
  backgroundImage: any;
  features: Array<{ icon: string; title: string; subtitle?: string }>;
}

const PLANS: PlanConfig[] = [
  {
    key: 'lite',
    label: 'Lite',
    displayTitle: 'SuperGrok Lite',
    tagline: 'Keep chatting with higher usage',
    accentColor: '#FF6B35',
    monthly: '$10',
    monthlyRaw: '$10',
    annual: '$100',
    annualPerMonth: '$8.33',
    savePct: '17%',
    backgroundImage: require('../assets/images/lite-top-bg.png'),
    features: [
      { icon: 'rocket-outline', title: '2x longer conversations in Chat' },
      { icon: 'hardware-chip-outline', title: '1x AI agent on Expert mode' },
      { icon: 'color-palette-outline', title: 'Try out AI image & video creation' },
      { icon: 'arrow-up-circle-outline', title: 'Increased limits at regular speed' },
    ],
  },
  {
    key: 'super',
    label: 'SuperGrok',
    displayTitle: 'SuperGrok',
    tagline: 'Unlock the full power of Grok',
    trialTagline: 'Try Free for 3 Days',
    accentColor: '#FF6B35',
    monthly: '$30',
    monthlyRaw: '$30',
    annual: '$300',
    annualPerMonth: '$25',
    savePct: '17%',
    trialDays: 3,
    backgroundImage: require('../assets/images/super-top-bg.png'),
    features: [
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
function FeatureRow({ icon, title, subtitle, isLast }: {
  icon: string; title: string; subtitle?: string; isLast?: boolean;
}) {
  return (
    <View style={[fr.row, !isLast && fr.border]}>
      <View style={fr.iconWrap}>
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
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, gap: 14 },
  border: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.08)' },
  iconWrap: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  textWrap: { flex: 1 },
  title: { color: '#FFFFFF', fontSize: 15, fontWeight: '500', lineHeight: 21 },
  sub: { color: 'rgba(255,255,255,0.45)', fontSize: 12, marginTop: 2 },
});

export default function SubscriptionScreen() {
  const { restorePurchases } = useSubscription();
  const { showAlert } = useAlert();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const supabase = getSupabaseClient();

  const [activePlanIdx, setActivePlanIdx] = useState(1); // default: Super
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [loading, setLoading] = useState(false);
  const [webLoading, setWebLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [managing, setManaging] = useState(false);
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
  const isSubscribed = subscriptionInfo?.subscribed ?? false;
  const hasTrial = plan.trialDays && !isSubscribed;

  const checkSubscriptionStatus = useCallback(async () => {
    if (!user) return;
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
    } catch { /* ignore */ }
  }, [user, supabase, safe]);

  useFocusEffect(useCallback(() => { checkSubscriptionStatus(); }, [checkSubscriptionStatus]));

  const purchaseWithRC = async () => {
    if (Platform.OS === 'web') { purchaseOnWeb(); return; }
    if (ENV.IS_EXPO_GO) {
      showAlert('Development Build Required', 'In-App Purchases require a development build.');
      return;
    }
    safe(setLoading, true);
    try {
      const configured = await RevenueCatHelper.init();
      if (!configured) throw new Error('Failed to configure RevenueCat.');
      const offerings = await RevenueCatHelper.getOfferings();
      const offering = offerings.current;
      if (!offering) throw new Error('No offerings available.');

      const productKey = `${plan.key}_${billingCycle}` as keyof typeof RC_PRODUCTS;
      const productId = RC_PRODUCTS[productKey];
      let pkg = offering.availablePackages.find(
        (p: any) => p.product?.productIdentifier === productId || p.product?.identifier === productId,
      );
      if (!pkg) {
        const pkgType = billingCycle === 'annual' ? 'ANNUAL' : 'MONTHLY';
        pkg = offering.availablePackages.find((p: any) => p.packageType === pkgType) || offering.availablePackages[0];
      }
      if (!pkg) throw new Error(`${plan.label} ${billingCycle} plan not found.`);

      const { customerInfo } = await RevenueCatHelper.purchasePackage(pkg);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('verify-purchase', {
        body: { platform: Platform.OS, receipt: JSON.stringify(customerInfo), transactionId: customerInfo?.originalAppUserId || `rc_${Date.now()}`, productId, isSandbox: __DEV__ },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) { let msg = error.message; if (error instanceof FunctionsHttpError) { try { msg = await error.context?.text() || msg; } catch { /* ignore */ } } throw new Error(msg); }

      if (user?.id) {
        await supabase.from('user_profiles').update({ subscription_tier: plan.key, subscription_expires_at: data?.subscription?.expiresAt || null }).eq('id', user.id);
      }
      showAlert(`Subscribed to ${plan.label}!`, `Your ${plan.label} plan is now active.`);
      await checkSubscriptionStatus();
      router.push('/subscription-success');
    } catch (err: any) {
      if (err?.userCancelled || err?.code === '1' || String(err?.message).toLowerCase().includes('cancel')) return;
      showAlert('Purchase Failed', err?.message || 'Something went wrong.');
    } finally { safe(setLoading, false); }
  };

  const purchaseOnWeb = async () => {
    if (webLoading) return;
    safe(setWebLoading, true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) { showAlert('Sign In Required', 'Please sign in to purchase.'); return; }
      const { data, error } = await supabase.functions.invoke('revenuecat-web-checkout', {
        body: { plan: plan.key, billingCycle },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) { let msg = error.message; if (error instanceof FunctionsHttpError) { try { msg = await error.context?.text() || msg; } catch { /* ignore */ } } throw new Error(msg); }
      const url = data?.url;
      if (!url) throw new Error('No checkout URL received.');
      await Linking.openURL(url);
    } catch (err: any) {
      showAlert('Web Purchase Error', err?.message || 'Could not open web checkout.');
    } finally { safe(setWebLoading, false); }
  };

  const handleManage = async () => {
    if (managing) return;
    safe(setManaging, true);
    try {
      if (Platform.OS === 'ios') await Linking.openURL('https://apps.apple.com/account/subscriptions');
      else if (Platform.OS === 'android') await Linking.openURL('https://play.google.com/store/account/subscriptions');
      else await Linking.openURL('https://app.revenuecat.com/billing');
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
            const activePlan: PlanKey = activeKey.includes('super') ? 'super' : 'lite';
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

  // CTA label
  const ctaLabel = isSubscribed
    ? 'Manage Subscription'
    : hasTrial
      ? `Start ${plan.trialDays}-day free trial`
      : `Upgrade to ${plan.label === 'Lite' ? 'SuperGrok Lite' : 'SuperGrok'}`;

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Full-screen background image — changes per plan */}
      <ImageBackground
        source={plan.backgroundImage}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      >
        {/* Gradient overlay — dark at bottom, lighter at top */}
        <View style={s.bgOverlay} />
      </ImageBackground>

      {/* ── CONTENT (fixed, no scroll) ── */}
      <View style={[s.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>

        {/* Close button */}
        <TouchableOpacity
          style={s.closeBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={18} color="rgba(255,255,255,0.75)" />
        </TouchableOpacity>

        {/* Title */}
        <View style={s.titleWrap}>
          {plan.key === 'super' ? (
            <Text style={s.title}>SuperGrok</Text>
          ) : (
            <Text style={s.title}>
              <Text style={s.titleBold}>SuperGrok </Text>
              <Text style={s.titleLight}>Lite</Text>
            </Text>
          )}

          {/* Tagline */}
          {hasTrial ? (
            <Text style={s.tagline}>
              Try <Text style={{ color: accent, fontWeight: '700' }}>Free</Text> for {plan.trialDays} Days
            </Text>
          ) : (
            <Text style={s.tagline}>{plan.tagline}</Text>
          )}
        </View>

        {/* 2-segment Toggle */}
        <View style={s.segWrap}>
          {PLANS.map((p, i) => {
            const isActive = activePlanIdx === i;
            return (
              <TouchableOpacity
                key={p.key}
                style={[s.segBtn, isActive && [s.segBtnActive, { borderColor: accent + 'AA' }]]}
                onPress={() => setActivePlanIdx(i)}
                activeOpacity={0.75}
              >
                {isActive ? (
                  Platform.OS === 'ios' ? (
                    <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
                  ) : (
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.12)' }]} />
                  )
                ) : null}
                <Text style={[s.segText, isActive && { color: '#FFFFFF', fontWeight: '600' }]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Feature Card */}
        <View style={s.featureCard}>
          {Platform.OS === 'ios' ? (
            <BlurView intensity={18} tint="dark" style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(20,20,20,0.7)' }]} />
          )}
          {plan.features.map((f, i) => (
            <FeatureRow
              key={`${plan.key}-${i}`}
              icon={f.icon}
              title={f.title}
              subtitle={f.subtitle}
              isLast={i === plan.features.length - 1}
            />
          ))}
        </View>

        {/* Spacer */}
        <View style={{ flex: 1 }} />

        {/* Billing Cards */}
        <View style={s.billingRow}>
          {/* Monthly */}
          <TouchableOpacity
            style={[s.billingCard, billingCycle === 'monthly' && s.billingCardActive]}
            onPress={() => setBillingCycle('monthly')}
            activeOpacity={0.8}
          >
            {billingCycle === 'monthly' ? (
              Platform.OS === 'ios' ? (
                <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
              ) : (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.1)' }]} />
              )
            ) : (
              Platform.OS === 'ios' ? (
                <BlurView intensity={15} tint="dark" style={StyleSheet.absoluteFill} />
              ) : (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.04)' }]} />
              )
            )}
            {hasTrial && billingCycle === 'monthly' ? (
              <View style={[s.freeBadge, { backgroundColor: accent }]}>
                <Text style={s.freeBadgeText}>FREE</Text>
              </View>
            ) : null}
            <Text style={s.billingLabel}>Monthly</Text>
            <Text style={[
              s.billingPrice,
              hasTrial && billingCycle === 'monthly' && { textDecorationLine: 'line-through', opacity: 0.55 },
            ]}>
              {plan.monthly}{' '}
              <Text style={s.billingUnit}>/month</Text>
            </Text>
          </TouchableOpacity>

          {/* Annual */}
          <TouchableOpacity
            style={[s.billingCard, billingCycle === 'annual' && s.billingCardActive]}
            onPress={() => setBillingCycle('annual')}
            activeOpacity={0.8}
          >
            {billingCycle === 'annual' ? (
              Platform.OS === 'ios' ? (
                <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
              ) : (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.1)' }]} />
              )
            ) : (
              Platform.OS === 'ios' ? (
                <BlurView intensity={15} tint="dark" style={StyleSheet.absoluteFill} />
              ) : (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.04)' }]} />
              )
            )}
            <View style={s.savePill}>
              <Text style={s.savePillText}>Save {plan.savePct}</Text>
            </View>
            <Text style={s.billingLabel}>Yearly</Text>
            <Text style={s.billingPrice}>
              {plan.annual}{' '}
              <Text style={s.billingUnit}>/year</Text>
            </Text>
            <Text style={s.billingPerMonth}>{plan.annualPerMonth} /month</Text>
          </TouchableOpacity>
        </View>

        {/* CTA Button */}
        {isSubscribed ? (
          <TouchableOpacity style={s.ctaBtn} onPress={handleManage} disabled={managing}>
            {managing ? <ActivityIndicator color="#000" /> : <Text style={s.ctaBtnText}>Manage Subscription</Text>}
          </TouchableOpacity>
        ) : (
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
        )}

        {/* Renewal note */}
        {hasTrial && !isSubscribed ? (
          <Text style={s.renewNote}>
            Renews at {plan.monthly} a month after trial, cancel anytime
          </Text>
        ) : null}

        {/* Footer */}
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
  root: {
    flex: 1,
    backgroundColor: '#080808',
  },
  bgOverlay: {
    ...StyleSheet.absoluteFillObject,
    // Dark gradient effect: transparent at top, dark at bottom
    backgroundColor: 'transparent',
    // Bottom half darker
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    alignSelf: 'flex-start',
  },
  titleWrap: {
    alignItems: 'center',
    marginBottom: 18,
  },
  title: {
    fontSize: 36,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  titleBold: {
    fontSize: 36,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  titleLight: {
    fontSize: 36,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.55)',
  },
  tagline: {
    fontSize: 17,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '400',
    textAlign: 'center',
  },

  // 2-segment toggle
  segWrap: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 50,
    padding: 4,
    alignSelf: 'center',
    marginBottom: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  segBtn: {
    paddingVertical: 9,
    paddingHorizontal: 26,
    borderRadius: 46,
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  segBtnActive: {
    borderWidth: 1,
  },
  segText: {
    fontSize: 14,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.38)',
    zIndex: 1,
  },

  // Feature card
  featureCard: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 16,
    paddingVertical: 2,
    overflow: 'hidden',
  },

  // Billing
  billingRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  billingCard: {
    flex: 1,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    padding: 14,
    minHeight: 90,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'flex-end',
  },
  billingCardActive: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
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
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    zIndex: 2,
  },
  savePillText: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '600' },
  billingLabel: { color: 'rgba(255,255,255,0.55)', fontSize: 13, fontWeight: '500', marginBottom: 5 },
  billingPrice: { color: '#FFFFFF', fontSize: 22, fontWeight: '700', lineHeight: 26 },
  billingUnit: { fontSize: 13, fontWeight: '400', color: 'rgba(255,255,255,0.5)' },
  billingPerMonth: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 },

  // CTA
  ctaBtn: {
    width: '100%',
    height: 54,
    borderRadius: 50,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    shadowColor: '#FFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  ctaBtnText: { color: '#000000', fontSize: 17, fontWeight: '700' },

  renewNote: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.38)',
    textAlign: 'center',
    lineHeight: 17,
    marginBottom: 8,
  },

  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 4,
  },
  footerLink: { fontSize: 12, color: 'rgba(255,255,255,0.3)' },
  footerDot: { fontSize: 12, color: 'rgba(255,255,255,0.2)' },
});
