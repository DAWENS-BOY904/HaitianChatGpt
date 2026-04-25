/**
 * CHECKOUT — Premium dark-glass redesign v2
 * • Auto-detect country via device locale (200+ countries via react-native-international-phone-number)
 * • Full BlurView glass panels with glow borders
 * • Real SVG-style card brand logos
 * • Contact: email + auto-detect phone with premium country picker
 * • Coupon / promo code → Stripe discount
 * • Card: Stripe CardField (cardholder name + number/expiry/CVV)
 * • Apple Pay / Google Pay: Stripe in-app PaymentSheet
 * • MonCash: edge-function → in-app WebBrowser (Haiti & USA only)
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
  TextInput,
  KeyboardAvoidingView,
  useColorScheme,
  Modal,
  FlatList,
  Dimensions,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth, useAlert, getSupabaseClient } from '@/template';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSubscription } from '../hooks/useSubscription';
import { FunctionsHttpError } from '@supabase/supabase-js';
import * as WebBrowser from 'expo-web-browser';
import * as Localization from 'expo-localization';

// ── Auto-detect phone input with 200+ countries ──
// npm install react-native-international-phone-number react-native-safe-area-context
import PhoneInput, {
  ICountry,
  getAllCountries,
  getCountryByCca2,
  isValidPhoneNumber,
} from 'react-native-international-phone-number';

const { width: SCREEN_W } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────
// Theme
// ─────────────────────────────────────────────────────────
function useT() {
  const dark = useColorScheme() !== 'light';
  return {
    dark,
    bg: dark ? '#050505' : '#F2F2F7',
    surface: dark ? 'rgba(22,22,28,0.88)' : 'rgba(255,255,255,0.82)',
    surfaceBorder: dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
    text: dark ? '#FFFFFF' : '#0A0A0A',
    textSec: dark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.42)',
    textMuted: dark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.25)',
    inputBg: dark ? 'rgba(32,32,38,0.95)' : 'rgba(255,255,255,0.95)',
    inputBorder: dark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.09)',
    placeholderText: dark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)',
    headerBorder: dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
    bottomBorder: dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.07)',
    tabInactive: dark ? 'rgba(38,38,44,0.85)' : 'rgba(228,228,234,0.95)',
    tabInactiveText: dark ? 'rgba(255,255,255,0.38)' : 'rgba(0,0,0,0.38)',
    cardFieldBg: dark ? '#1C1C22' : '#F4F4F8',
    divider: dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
    secureText: dark ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.26)',
    blurTint: (dark ? 'dark' : 'light') as 'dark' | 'light',
    couponApplied: '#30D158',
    couponError: '#FF453A',
    modalBg: dark ? '#1C1C1E' : '#FFFFFF',
    searchBg: dark ? '#2C2C2E' : '#F2F2F7',
    planCardGlow: dark ? 'rgba(107,92,231,0.15)' : 'rgba(107,92,231,0.08)',
    glassGlow: dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
  };
}

// ─────────────────────────────────────────────────────────
// SVG-style Card Brand Logos
// ─────────────────────────────────────────────────────────
function VisaLogo({ width = 48, height = 30 }: { width?: number; height?: number }) {
  return (
    <View style={[cardBrandStyles.base, { width, height, backgroundColor: '#1A1F71', borderRadius: 5 }]}>
      <Text style={cardBrandStyles.visaText}>VISA</Text>
    </View>
  );
}

function MastercardLogo({ width = 48, height = 30 }: { width?: number; height?: number }) {
  return (
    <View style={[cardBrandStyles.base, { width, height, backgroundColor: '#252525', borderRadius: 5, overflow: 'hidden' }]}>
      <View style={[cardBrandStyles.mcLeft, { backgroundColor: '#EB001B' }]} />
      <View style={[cardBrandStyles.mcRight, { backgroundColor: '#F79E1B' }]} />
      <View style={[cardBrandStyles.mcOverlap, { backgroundColor: '#FF5F00' }]} />
      <Text style={cardBrandStyles.mcText}>mc</Text>
    </View>
  );
}

function AmexLogo({ width = 48, height = 30 }: { width?: number; height?: number }) {
  return (
    <View style={[cardBrandStyles.base, { width, height, backgroundColor: '#2E77BC', borderRadius: 5 }]}>
      <Text style={cardBrandStyles.amexText}>AMEX</Text>
    </View>
  );
}

function DiscoverLogo({ width = 48, height = 30 }: { width?: number; height?: number }) {
  return (
    <View style={[cardBrandStyles.base, { width, height, backgroundColor: '#FFFFFF', borderRadius: 5, borderWidth: 1, borderColor: '#E0E0E0' }]}>
      <Text style={cardBrandStyles.discoverText}>DISC</Text>
      <View style={cardBrandStyles.discoverDot} />
    </View>
  );
}

function UnionPayLogo({ width = 48, height = 30 }: { width?: number; height?: number }) {
  return (
    <View style={[cardBrandStyles.base, { width, height, backgroundColor: '#CE0000', borderRadius: 5 }]}>
      <Text style={cardBrandStyles.unionpayText}>UP</Text>
    </View>
  );
}

const cardBrandStyles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', position: 'relative' },
  visaText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900', fontStyle: 'italic', letterSpacing: 0.5 },
  mcLeft: { position: 'absolute', left: 6, width: 18, height: 18, borderRadius: 9, top: 6 },
  mcRight: { position: 'absolute', right: 6, width: 18, height: 18, borderRadius: 9, top: 6 },
  mcOverlap: { position: 'absolute', alignSelf: 'center', width: 9, height: 18, top: 6 },
  mcText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900', zIndex: 10 },
  amexText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  discoverText: { color: '#231F20', fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  discoverDot: { position: 'absolute', right: 5, bottom: 5, width: 12, height: 12, borderRadius: 6, backgroundColor: '#F76F20' },
  unionpayText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
});

// ─────────────────────────────────────────────────────────
// Stripe (native only)
// ─────────────────────────────────────────────────────────
let StripeProvider: React.ComponentType<any> | null = null;
let CardField: React.ComponentType<any> | null = null;
let useStripe: (() => any) | null = null;
let useApplePay: (() => any) | null = null;
let useGooglePay: (() => any) | null = null;

if (Platform.OS !== 'web') {
  try {
    const lib = require('@stripe/stripe-react-native');
    StripeProvider = lib.StripeProvider;
    CardField = lib.CardField;
    useStripe = lib.useStripe;
    useApplePay = lib.useApplePay;
    useGooglePay = lib.useGooglePay;
  } catch (_e) {}
}

// ─────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────
const STRIPE_PK =
  process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ||
  'pk_live_51RjvcRE0VkO7z1VngDeBXrHSrAe6uRiOl47oNZ2R3i0xoBP7UeVWxcvsWAO2rhSgRmCS2773WNHHCyvlVSZrmBtW00Qs95QFc3';

const PLUS_PRICE_ID = 'price_1TPUrzE0VkO7z1Vnlgj45978';

const isHaitiOrUSAUser = (user: any) => {
  if (!user) return false;
  const country = user.user_metadata?.country || '';
  const phone = user.phone || user.user_metadata?.phone || '';
  return (
    country === 'HT' || country === 'Haiti' || phone.startsWith('+509') ||
    country === 'US' || country === 'United States' || phone.startsWith('+1')
  );
};

type PayMethod = 'card' | 'apple' | 'google' | 'moncash';

// ─────────────────────────────────────────────────────────
// Reusable Glass Section with Glow Border
// ─────────────────────────────────────────────────────────
function GlassSection({ T, children, style, glowColor }: { T: ReturnType<typeof useT>; children: React.ReactNode; style?: any; glowColor?: string }) {
  return (
    <View style={[{ marginBottom: 14 }, style]}>
      {/* Glow layer behind */}
      {glowColor && (
        <View style={[s.glowLayer, { backgroundColor: glowColor, opacity: T.dark ? 0.12 : 0.06 }]} />
      )}
      <BlurView
        intensity={60}
        tint={T.blurTint}
        style={[s.glassBase, { borderColor: T.surfaceBorder, backgroundColor: T.surface }]}
      >
        {children}
      </BlurView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────
// Section Header with line accent
// ─────────────────────────────────────────────────────────
function SectionHeader({ label, T, accentColor }: { label: string; T: ReturnType<typeof useT>; accentColor?: string }) {
  return (
    <View style={s.sectionHeaderRow}>
      <View style={[s.sectionLine, { backgroundColor: accentColor || T.textMuted, opacity: 0.4 }]} />
      <Text style={[s.sectionLabel, { color: T.textSec }]}>{label}</Text>
      <View style={[s.sectionLine, { backgroundColor: accentColor || T.textMuted, opacity: 0.4, flex: 1 }]} />
    </View>
  );
}

// ─────────────────────────────────────────────────────────
// Field Row with animated focus
// ─────────────────────────────────────────────────────────
function FieldRow({
  icon,
  label,
  focused,
  accentColor,
  T,
  children,
}: {
  icon: string;
  label: string;
  focused: boolean;
  accentColor: string;
  T: ReturnType<typeof useT>;
  children: React.ReactNode;
}) {
  return (
    <View style={s.fieldRow}>
      <View style={[s.fieldIconWrap, { backgroundColor: focused ? accentColor + '18' : T.tabInactive }]}>
        <Ionicons name={icon as any} size={17} color={focused ? accentColor : T.textSec} />
      </View>
      <View style={s.fieldContent}>
        <Text style={[s.fieldLabel, { color: focused ? accentColor : T.textSec }]}>{label}</Text>
        {children}
      </View>
      {focused && <View style={[s.focusBar, { backgroundColor: accentColor }]} />}
    </View>
  );
}

// ─────────────────────────────────────────────────────────
// CheckoutInner
// ─────────────────────────────────────────────────────────
function CheckoutInner() {
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const { refreshSubscription } = useSubscription();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const supabase = getSupabaseClient();
  const params = useLocalSearchParams();
  const T = useT();

  const plan = (params.plan as string) || 'plus';
  const priceId = (params.priceId as string) || PLUS_PRICE_ID;
  const planColor = plan === 'plus' ? '#7C6FF7' : '#34C759';
  const planLabel = plan === 'plus' ? 'Dawinix Plus' : 'Dawinix Go';
  const planPriceUSD = plan === 'plus' ? 19.99 : 8.0;
  const planPriceHTG = plan === 'plus' ? 2650 : 1060;
  const planAmountHTG = plan === 'plus' ? 2650 : 1060;

  const [email, setEmail] = useState(user?.email || '');
  const [focusedField, setFocusedField] = useState<string | null>(null);

  // ── Auto-detect country from device locale ──
  const [selectedCountry, setSelectedCountry] = useState<ICountry | undefined>(undefined);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneValid, setPhoneValid] = useState(false);

  useEffect(() => {
    const locale = Localization.locale?.toUpperCase?.() || 'US';
    const regionCode = locale.split('_')[1] || locale.split('-')[1] || 'US';
    const country = getCountryByCca2(regionCode);
    if (country) {
      setSelectedCountry(country);
    } else {
      // Fallback to US
      setSelectedCountry(getCountryByCca2('US'));
    }
  }, []);

  const handlePhoneChange = useCallback((val: string) => {
    setPhoneNumber(val);
  }, []);

  const handleCountryChange = useCallback((country: ICountry) => {
    setSelectedCountry(country);
  }, []);

  useEffect(() => {
    if (selectedCountry && phoneNumber) {
      setPhoneValid(isValidPhoneNumber(phoneNumber, selectedCountry));
    }
  }, [phoneNumber, selectedCountry]);

  const fullPhone = selectedCountry?.idd?.root
    ? `${selectedCountry.idd.root}${selectedCountry.idd?.suffixes?.[0] || ''} ${phoneNumber}`
    : phoneNumber;

  const [cardholderName, setCardholderName] = useState('');
  const [cardReady, setCardReady] = useState(false);

  const [couponCode, setCouponCode] = useState('');
  const [couponApplying, setCouponApplying] = useState(false);
  const [couponResult, setCouponResult] = useState<{
    valid: boolean; discountPct?: number; discountAmt?: number; message: string;
  } | null>(null);

  const discountedPrice = couponResult?.valid
    ? couponResult.discountPct
      ? planPriceUSD * (1 - couponResult.discountPct / 100)
      : couponResult.discountAmt
        ? Math.max(0, planPriceUSD - couponResult.discountAmt)
        : planPriceUSD
    : planPriceUSD;
  const displayPrice = `$${discountedPrice.toFixed(2)}`;
  const displayOriginalPrice = couponResult?.valid ? `$${planPriceUSD.toFixed(2)}` : undefined;

  const showMoncash = isHaitiOrUSAUser(user);
  const defaultTab: PayMethod =
    Platform.OS === 'ios' ? 'apple' : Platform.OS === 'android' ? 'google' : 'card';
  const [method, setMethod] = useState<PayMethod>(showMoncash ? 'moncash' : defaultTab);

  const [googlePayReady, setGooglePayReady] = useState(false);
  const applePay = useApplePay ? useApplePay() : null;
  const isApplePaySupported = applePay?.isApplePaySupported ?? false;
  const googlePay = useGooglePay ? useGooglePay() : null;
  const stripe = useStripe ? useStripe() : null;
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'android' || !googlePay) return;
    googlePay.isGooglePaySupported({ testEnv: false })
      .then((ok: boolean) => setGooglePayReady(ok))
      .catch(() => setGooglePayReady(false));
  }, []);

  const benefits = plan === 'plus'
    ? ['GPT-5 & Gemini 3 Pro', 'Unlimited messages', '20 uploads/session', 'Deep research & agents', 'Priority support']
    : ['Extended daily messages', '10 uploads/session', 'Group chat', 'Longer memory'];

  // ── Apply coupon ──
  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponApplying(true);
    setCouponResult(null);
    try {
      const LOCAL_COUPONS: Record<string, { discountPct?: number; discountAmt?: number; message: string }> = {
        DAWINIX2026: { discountPct: 20, message: '20% off applied!' },
        HAITI50: { discountPct: 50, message: '50% off for Haiti users!' },
        WELCOME10: { discountPct: 10, message: '10% welcome discount!' },
      };
      const local = LOCAL_COUPONS[couponCode.trim().toUpperCase()];
      if (local) { setCouponResult({ valid: true, ...local }); return; }
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (token) {
        const { data, error } = await supabase.functions.invoke('create-checkout-session', {
          body: { mode: 'validate_coupon', couponCode: couponCode.trim() },
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!error && data?.valid) {
          setCouponResult({
            valid: true,
            discountPct: data.percent_off,
            discountAmt: data.amount_off ? data.amount_off / 100 : undefined,
            message: data.message || 'Discount applied!',
          });
          return;
        }
      }
      setCouponResult({ valid: false, message: 'Invalid or expired coupon code.' });
    } catch {
      setCouponResult({ valid: false, message: 'Could not validate coupon. Try again.' });
    } finally {
      setCouponApplying(false);
    }
  };

  // ── Get client secret ──
  const getClientSecret = async (token: string) => {
    const { data, error } = await supabase.functions.invoke('create-checkout-session', {
      body: { plan, priceId, mode: 'payment_sheet', couponCode: couponResult?.valid ? couponCode.trim() : undefined },
      headers: { Authorization: `Bearer ${token}` },
    });
    if (error) {
      let msg = error.message;
      if (error instanceof FunctionsHttpError) { try { msg = await error.context?.text() || msg; } catch (_) {} }
      throw new Error(msg);
    }
    return data as { clientSecret?: string; ephemeralKey?: string; customerId?: string; url?: string };
  };

  // ── Sync subscription ──
  const syncSubscription = async (token: string) => {
    const { data: subData } = await supabase.functions.invoke('check-subscription', { headers: { Authorization: `Bearer ${token}` } });
    if (user?.id) {
      await supabase.from('user_profiles').update({
        subscription_tier: subData?.plan || plan,
        subscription_expires_at: subData?.subscription_end || null,
      }).eq('id', user.id);
    }
    await refreshSubscription?.();
    router.replace('/subscription-success');
  };

  // ── Card payment ──
  const handleCardPay = async () => {
    if (!stripe) { showAlert('Error', 'Stripe not available'); return; }
    if (!cardReady) { showAlert('Incomplete', 'Please fill in your card details.'); return; }
    if (!cardholderName.trim()) { showAlert('Required', 'Please enter the cardholder name.'); return; }
    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) throw new Error('Not authenticated');
      const secretData = await getClientSecret(token);
      if (!secretData.clientSecret) throw new Error('No payment secret returned');
      const { error: initErr } = await stripe.initPaymentSheet({
        merchantDisplayName: 'Dawinix AI',
        customerId: secretData.customerId,
        customerEphemeralKeySecret: secretData.ephemeralKey,
        paymentIntentClientSecret: secretData.clientSecret,
        defaultBillingDetails: { name: cardholderName, email, phone: fullPhone },
        allowsDelayedPaymentMethods: false,
        returnURL: 'dawinixht://checkout/return',
      });
      if (initErr) throw new Error(initErr.message);
      const { error: presentErr } = await stripe.presentPaymentSheet();
      if (presentErr) { if (presentErr.code === 'Canceled') return; throw new Error(presentErr.message); }
      await syncSubscription(token);
    } catch (err: any) {
      showAlert('Payment Failed', err?.message || 'Something went wrong.');
    } finally { setLoading(false); }
  };

  // ── Apple Pay ──
  const handleApplePay = async () => {
    if (!applePay || !isApplePaySupported || !stripe) { showAlert('Not Available', 'Apple Pay is not available on this device.'); return; }
    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) throw new Error('Not authenticated');
      const secretData = await getClientSecret(token);
      if (!secretData.clientSecret) throw new Error('No payment secret');
      const { error: initErr } = await stripe.initPaymentSheet({
        merchantDisplayName: 'Dawinix AI',
        customerId: secretData.customerId,
        customerEphemeralKeySecret: secretData.ephemeralKey,
        paymentIntentClientSecret: secretData.clientSecret,
        applePay: { merchantCountryCode: 'US' },
        defaultBillingDetails: { email, phone: fullPhone },
        returnURL: 'dawinixht://checkout/return',
      });
      if (initErr) throw new Error(initErr.message);
      const { error: presentErr } = await stripe.presentPaymentSheet();
      if (presentErr) { if (presentErr.code === 'Canceled') return; throw new Error(presentErr.message); }
      await syncSubscription(token);
    } catch (err: any) {
      showAlert('Apple Pay Failed', err?.message || 'Something went wrong.');
    } finally { setLoading(false); }
  };

  // ── Google Pay ──
  const handleGooglePay = async () => {
    if (!googlePay || !googlePayReady || !stripe) { showAlert('Not Available', 'Google Pay is not available on this device.'); return; }
    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) throw new Error('Not authenticated');
      const secretData = await getClientSecret(token);
      if (!secretData.clientSecret) throw new Error('No payment secret');
      const { error: initErr } = await stripe.initPaymentSheet({
        merchantDisplayName: 'Dawinix AI',
        customerId: secretData.customerId,
        customerEphemeralKeySecret: secretData.ephemeralKey,
        paymentIntentClientSecret: secretData.clientSecret,
        googlePay: { merchantCountryCode: 'US', testEnv: false, currencyCode: 'usd' },
        defaultBillingDetails: { email, phone: fullPhone },
        returnURL: 'dawinixht://checkout/return',
      });
      if (initErr) throw new Error(initErr.message);
      const { error: presentErr } = await stripe.presentPaymentSheet();
      if (presentErr) { if (presentErr.code === 'Canceled') return; throw new Error(presentErr.message); }
      await syncSubscription(token);
    } catch (err: any) {
      showAlert('Google Pay Failed', err?.message || 'Something went wrong.');
    } finally { setLoading(false); }
  };

  // ── MonCash ──
  const handleMonCash = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) throw new Error('Not authenticated');
      const orderId = `DWNX-${user.id}-${Date.now()}`;
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: { plan, priceId, mode: 'moncash', amount: planAmountHTG, orderId, phone: fullPhone, email },
        headers: { Authorization: `Bearer ${token}` },
      });
      if (error) {
        let msg = error.message;
        if (error instanceof FunctionsHttpError) { try { msg = await error.context?.text() || msg; } catch (_) {} }
        throw new Error(msg);
      }
      if (!data?.paymentUrl) throw new Error('No MonCash payment URL returned');
      const result = await WebBrowser.openBrowserAsync(data.paymentUrl, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
        controlsColor: '#DC143C',
      });
      if (result.type === 'dismiss') await verifyMonCash(data.orderId || orderId, token);
    } catch (err: any) {
      showAlert('MonCash Error', err?.message || 'Could not process MonCash payment.');
    } finally { setLoading(false); }
  };

  const verifyMonCash = async (orderId: string, token: string) => {
    const { data, error } = await supabase.functions.invoke('verify-moncash-payment', {
      body: { orderId },
      headers: { Authorization: `Bearer ${token}` },
    });
    if (error) { showAlert('Verification Error', error.message); return; }
    if (data?.status === 'success') {
      if (user?.id) {
        await supabase.from('user_profiles').update({
          subscription_tier: plan,
          subscription_expires_at: data?.subscription_end || null,
          billing_info: { provider: 'moncash' },
        }).eq('id', user.id);
      }
      await refreshSubscription?.();
      router.replace('/subscription-success');
    } else {
      showAlert('Payment Pending', 'Your MonCash payment is being processed. We will update your account shortly.');
    }
  };

  const handlePay = () => {
    switch (method) {
      case 'card': return handleCardPay();
      case 'apple': return handleApplePay();
      case 'google': return handleGooglePay();
      case 'moncash': return handleMonCash();
    }
  };

  const payLabel = () => {
    if (loading) return 'Processing…';
    switch (method) {
      case 'card': return `Pay ${displayPrice}/mo`;
      case 'apple': return `Apple Pay  ·  ${displayPrice}/mo`;
      case 'google': return `Google Pay  ·  ${displayPrice}/mo`;
      case 'moncash': return `MonCash  ·  ${planPriceHTG} HTG/mo`;
      default: return 'Pay Now';
    }
  };

  const payBtnColor = method === 'moncash' ? '#DC143C' : planColor;
  const payBtnDisabled = method === 'card' && (!cardReady || !cardholderName.trim());

  type TabEntry = { key: PayMethod; label: string; icon: string };
  const tabs: TabEntry[] = [
    { key: 'card', label: 'Card', icon: 'card-outline' },
    ...(Platform.OS === 'ios' && isApplePaySupported
      ? [{ key: 'apple' as PayMethod, label: 'Apple Pay', icon: 'logo-apple' }]
      : []),
    ...(Platform.OS === 'android' && googlePayReady
      ? [{ key: 'google' as PayMethod, label: 'Google Pay', icon: 'logo-google' }]
      : []),
    ...(showMoncash ? [{ key: 'moncash' as PayMethod, label: 'MonCash', icon: 'phone-portrait-outline' }] : []),
  ];

  // ── Custom PhoneInput theme for dark/light ──
  const phoneInputStyles = {
    container: {
      backgroundColor: 'transparent',
      borderWidth: 0,
      borderRadius: 0,
      paddingVertical: 0,
      height: 44,
    },
    flagContainer: {
      backgroundColor: T.tabInactive,
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 6,
      gap: 4,
    },
    flag: { fontSize: 20 },
    caret: { fontSize: 12, color: T.textSec },
    divider: { backgroundColor: 'transparent', width: 8 },
    callingCode: { fontSize: 14, fontWeight: '600', color: T.text },
    input: {
      fontSize: 15,
      fontWeight: '400',
      color: T.text,
      padding: 0,
      margin: 0,
    },
  };

  const phoneModalStyles = {
    backdrop: { backgroundColor: 'rgba(0,0,0,0.55)' },
    container: {
      backgroundColor: T.modalBg,
      borderTopLeftRadius: 26,
      borderTopRightRadius: 26,
    },
    content: { paddingBottom: insets.bottom + 16 },
    dragHandleContainer: { paddingVertical: 12 },
    dragHandleIndicator: { width: 36, height: 4, borderRadius: 2, backgroundColor: T.textMuted, opacity: 0.4 },
    searchContainer: {
      backgroundColor: T.searchBg,
      borderRadius: 14,
      marginHorizontal: 16,
      marginBottom: 8,
      paddingHorizontal: 14,
      paddingVertical: 11,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    searchInput: { fontSize: 15, color: T.text, flex: 1, padding: 0 },
    list: { maxHeight: 420 },
    countryItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 13,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: T.divider,
      gap: 12,
    },
    flag: { fontSize: 22 },
    countryInfo: { flex: 1 },
    countryName: { fontSize: 15, color: T.text },
    callingCode: { fontSize: 14, fontWeight: '600', color: T.textSec },
    sectionTitle: { fontSize: 12, fontWeight: '700', color: T.textMuted, paddingHorizontal: 20, paddingVertical: 6 },
    closeButton: { padding: 16, alignItems: 'center' },
    closeButtonText: { fontSize: 15, fontWeight: '600', color: planColor },
    countryNotFoundContainer: { padding: 32, alignItems: 'center' },
    countryNotFoundMessage: { fontSize: 14, color: T.textSec },
    alphabetContainer: { position: 'absolute', right: 4, top: 60, bottom: 40, width: 20, alignItems: 'center' },
    alphabetLetter: { paddingVertical: 1.5, width: 20, alignItems: 'center' },
    alphabetLetterText: { fontSize: 10, color: T.textMuted },
    alphabetLetterTextActive: { fontSize: 10, fontWeight: '700', color: planColor },
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: T.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle={T.dark ? 'light-content' : 'dark-content'} />

      {/* ── Header with stronger blur ── */}
      <BlurView
        intensity={85}
        tint={T.blurTint}
        style={[s.header, { paddingTop: insets.top + 12, borderBottomColor: T.headerBorder }]}
      >
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={22} color={T.text} />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={[s.headerTitle, { color: T.text }]}>Secure Checkout</Text>
          <View style={s.headerSecurePill}>
            <Ionicons name="lock-closed" size={10} color="#30D158" />
            <Text style={s.headerSecureText}>256-bit SSL</Text>
          </View>
        </View>
        <View style={{ width: 38 }} />
      </BlurView>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 160 }]}
      >
        {/* ── Plan card with glow ── */}
        <GlassSection T={T} glowColor={planColor}>
          <LinearGradient
            colors={T.dark ? [planColor + '08', 'transparent'] : [planColor + '06', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.planGradient}
          >
            <View style={s.planCardInner}>
              <View style={s.planLeft}>
                <View style={[s.planBadge, { backgroundColor: planColor }]}>
                  <Text style={s.planBadgeText}>{plan === 'plus' ? '✦ PLUS' : '⚡ GO'}</Text>
                </View>
                <Text style={[s.planName, { color: T.text }]}>{planLabel}</Text>
                <Text style={[s.planSub, { color: T.textSec }]}>Monthly subscription</Text>
                <View style={s.benefitsWrap}>
                  {benefits.map((b) => (
                    <View key={b} style={s.benefitRow}>
                      <View style={[s.benefitDot, { backgroundColor: planColor }]} />
                      <Text style={[s.benefitText, { color: T.textSec }]}>{b}</Text>
                    </View>
                  ))}
                </View>
              </View>
              <View style={s.planRight}>
                {displayOriginalPrice && (
                  <Text style={[s.originalPrice, { color: T.textMuted }]}>{displayOriginalPrice}</Text>
                )}
                <Text style={[s.planPrice, { color: planColor }]}>{displayPrice}</Text>
                <Text style={[s.planPricePer, { color: T.textMuted }]}>/ month</Text>
                {couponResult?.valid && (
                  <View style={[s.discountBadge, { backgroundColor: T.couponApplied + '18' }]}>
                    <Ionicons name="pricetag" size={10} color={T.couponApplied} />
                    <Text style={[s.discountBadgeText, { color: T.couponApplied }]}>
                      {couponResult.discountPct ? `-${couponResult.discountPct}%` : 'Discount'}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </LinearGradient>
        </GlassSection>

        {/* ── Contact ── */}
        <GlassSection T={T}>
          <SectionHeader label="CONTACT INFORMATION" T={T} accentColor={planColor} />
          <FieldRow icon="mail-outline" label="Email address" focused={focusedField === 'email'} accentColor={planColor} T={T}>
            <TextInput
              style={[s.fieldInput, { color: T.text }]}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="your@email.com"
              placeholderTextColor={T.placeholderText}
              onFocus={() => setFocusedField('email')}
              onBlur={() => setFocusedField(null)}
            />
          </FieldRow>
          <View style={[s.divider, { backgroundColor: T.divider }]} />

          {/* Auto-detect phone with 200+ countries */}
          <FieldRow icon="call-outline" label="Phone number" focused={focusedField === 'phone'} accentColor={planColor} T={T}>
            <View style={{ marginTop: 2 }}>
              <PhoneInput
                value={phoneNumber}
                onChangePhoneNumber={handlePhoneChange}
                selectedCountry={selectedCountry}
                onChangeSelectedCountry={handleCountryChange}
                defaultCountry={selectedCountry?.cca2}
                placeholder="Phone number"
                phoneInputStyles={phoneInputStyles}
                modalStyles={phoneModalStyles}
                phoneInputPlaceholderTextColor={T.placeholderText}
                phoneInputSelectionColor={planColor}
                customCaret={() => <Ionicons name="chevron-down" size={12} color={T.textSec} />}
                language="eng"
                popularCountries={['US', 'HT', 'CA', 'FR', 'GB', 'BR', 'MX', 'DE']}
                onFocus={() => setFocusedField('phone')}
                onBlur={() => setFocusedField(null)}
              />
            </View>
          </FieldRow>
          {phoneNumber.length > 0 && !phoneValid && (
            <View style={[s.couponMsg, { backgroundColor: T.couponError + '12', marginHorizontal: 16, marginBottom: 10, borderRadius: 10 }]}>
              <Ionicons name="alert-circle" size={13} color={T.couponError} />
              <Text style={[s.couponMsgText, { color: T.couponError }]}>Invalid phone number for selected country</Text>
            </View>
          )}
        </GlassSection>

        {/* ── Promo code ── */}
        <GlassSection T={T}>
          <SectionHeader label="PROMO CODE" T={T} accentColor={planColor} />
          <FieldRow icon="pricetag-outline" label="Discount code" focused={focusedField === 'coupon'} accentColor={planColor} T={T}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TextInput
                style={[s.fieldInput, { color: T.text, flex: 1 }]}
                value={couponCode}
                onChangeText={(t) => { setCouponCode(t.toUpperCase()); setCouponResult(null); }}
                autoCapitalize="characters"
                autoCorrect={false}
                placeholder="e.g. DAWINIX2026"
                placeholderTextColor={T.placeholderText}
                onFocus={() => setFocusedField('coupon')}
                onBlur={() => setFocusedField(null)}
              />
              <TouchableOpacity
                style={[s.applyBtn, { backgroundColor: couponCode.trim().length > 0 ? planColor : T.tabInactive }]}
                onPress={handleApplyCoupon}
                disabled={couponApplying || couponCode.trim().length === 0}
              >
                {couponApplying
                  ? <ActivityIndicator size="small" color="#FFF" />
                  : <Text style={[s.applyBtnText, { color: couponCode.trim().length > 0 ? '#FFF' : T.tabInactiveText }]}>Apply</Text>}
              </TouchableOpacity>
            </View>
          </FieldRow>
          {couponResult && (
            <View style={[s.couponMsg, {
              backgroundColor: couponResult.valid ? T.couponApplied + '14' : T.couponError + '14',
              marginHorizontal: 16, marginBottom: 12, borderRadius: 12
            }]}>
              <Ionicons name={couponResult.valid ? 'checkmark-circle' : 'close-circle'} size={14} color={couponResult.valid ? T.couponApplied : T.couponError} />
              <Text style={[s.couponMsgText, { color: couponResult.valid ? T.couponApplied : T.couponError }]}>{couponResult.message}</Text>
            </View>
          )}
        </GlassSection>

        {/* ── Payment method tabs ── */}
        <SectionHeader label="PAYMENT METHOD" T={T} accentColor={planColor} />
        <View style={s.tabsRow}>
          {tabs.map((tab) => {
            const active = method === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[
                  s.tab,
                  {
                    backgroundColor: active ? (tab.key === 'moncash' ? '#DC143C' : planColor) : T.tabInactive,
                    flex: tabs.length > 2 ? 1 : undefined,
                    borderWidth: active ? 0 : 1,
                    borderColor: T.inputBorder,
                    shadowColor: active ? (tab.key === 'moncash' ? '#DC143C' : planColor) : 'transparent',
                    shadowOffset: { width: 0, height: active ? 3 : 0 },
                    shadowOpacity: active ? 0.3 : 0,
                    shadowRadius: active ? 6 : 0,
                    elevation: active ? 4 : 0,
                  },
                ]}
                onPress={() => setMethod(tab.key)}
              >
                <Ionicons name={tab.icon as any} size={16} color={active ? '#FFF' : T.tabInactiveText} />
                <Text style={[s.tabText, { color: active ? '#FFF' : T.tabInactiveText }]}>{tab.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Card entry ── */}
        {method === 'card' && (
          <GlassSection T={T} glowColor={planColor}>
            <SectionHeader label="CARD DETAILS" T={T} accentColor={planColor} />
            <FieldRow icon="person-outline" label="Name on card" focused={focusedField === 'cname'} accentColor={planColor} T={T}>
              <TextInput
                style={[s.fieldInput, { color: T.text }]}
                value={cardholderName}
                onChangeText={setCardholderName}
                autoCapitalize="words"
                autoCorrect={false}
                placeholder="Full name"
                placeholderTextColor={T.placeholderText}
                onFocus={() => setFocusedField('cname')}
                onBlur={() => setFocusedField(null)}
              />
            </FieldRow>
            <View style={[s.divider, { backgroundColor: T.divider }]} />

            {CardField ? (
              <View style={{ paddingHorizontal: 16, paddingVertical: 14 }}>
                <Text style={[s.fieldLabel, { color: T.textSec, marginBottom: 10 }]}>
                  Card number · Expiry · CVV
                </Text>
                <CardField
                  postalCodeEnabled={false}
                  placeholders={{ number: '4242 4242 4242 4242', expiration: 'MM/YY', cvc: 'CVV' }}
                  cardStyle={{
                    backgroundColor: T.cardFieldBg,
                    textColor: T.text,
                    placeholderColor: T.placeholderText,
                    borderColor: focusedField === 'card' ? planColor : T.inputBorder,
                    borderWidth: focusedField === 'card' ? 1.5 : 1,
                    borderRadius: 14,
                    cursorColor: planColor,
                  }}
                  style={{ width: '100%', height: 54 }}
                  onCardChange={(d: any) => setCardReady(d.complete)}
                  onFocus={() => setFocusedField('card')}
                />
              </View>
            ) : (
              <View style={[s.cardFallback, { borderColor: T.inputBorder }]}>
                <Ionicons name="card-outline" size={22} color={T.textMuted} />
                <Text style={[s.cardFallbackText, { color: T.textSec }]}>
                  Card entry requires the native app. Use Apple Pay, Google Pay, or install the iOS/Android app.
                </Text>
              </View>
            )}

            <View style={s.cardBrandsRow}>
              <VisaLogo width={46} height={28} />
              <MastercardLogo width={46} height={28} />
              <AmexLogo width={46} height={28} />
              <DiscoverLogo width={46} height={28} />
              <UnionPayLogo width={46} height={28} />
            </View>
          </GlassSection>
        )}

        {/* ── Apple Pay ── */}
        {method === 'apple' && (
          <GlassSection T={T} glowColor="#000">
            <View style={s.payInfoCard}>
              <View style={[s.payIconBig, { backgroundColor: '#000' }]}>
                <Ionicons name="logo-apple" size={30} color="#FFF" />
              </View>
              <Text style={[s.payInfoTitle, { color: T.text }]}>Apple Pay</Text>
              <Text style={[s.payInfoSub, { color: T.textSec }]}>
                Authenticate with Face ID or Touch ID.{'\\n'}No card details required.
              </Text>
              <View style={[s.payInfoAmount, { borderColor: planColor + '40', backgroundColor: planColor + '10' }]}>
                <Text style={[s.payInfoAmountText, { color: planColor }]}>{displayPrice} / month</Text>
              </View>
            </View>
          </GlassSection>
        )}

        {/* ── Google Pay ── */}
        {method === 'google' && (
          <GlassSection T={T} glowColor="#4285F4">
            <View style={s.payInfoCard}>
              <View style={[s.payIconBig, { backgroundColor: '#FFFFFF' }]}>
                <Text style={{ fontSize: 24, fontWeight: '800', color: '#4285F4' }}>G</Text>
              </View>
              <Text style={[s.payInfoTitle, { color: T.text }]}>Google Pay</Text>
              <Text style={[s.payInfoSub, { color: T.textSec }]}>
                Fast and secure — no card entry required.{'\\n'}Uses your Google account payment method.
              </Text>
              <View style={[s.payInfoAmount, { borderColor: planColor + '40', backgroundColor: planColor + '10' }]}>
                <Text style={[s.payInfoAmountText, { color: planColor }]}>{displayPrice} / month</Text>
              </View>
            </View>
          </GlassSection>
        )}

        {/* ── MonCash ── */}
        {method === 'moncash' && (
          <GlassSection T={T} glowColor="#DC143C" style={{ borderColor: 'rgba(220,20,60,0.20)' }}>
            <View style={s.payInfoCard}>
              <View style={[s.payIconBig, { backgroundColor: '#DC143C' }]}>
                <Text style={s.moncashM}>M</Text>
              </View>
              <Text style={[s.payInfoTitle, { color: T.text }]}>MonCash</Text>
              <Text style={[s.payInfoSub, { color: T.textSec }]}>
                Pay securely with your Digicel MonCash account.{'\\n'}
                Available for 🇭🇹 Haiti and 🇺🇸 USA users.
              </Text>
              <View style={[s.payInfoAmount, { borderColor: 'rgba(220,20,60,0.3)', backgroundColor: 'rgba(220,20,60,0.08)' }]}>
                <Text style={[s.payInfoAmountText, { color: '#DC143C' }]}>{planPriceHTG} HTG / month</Text>
              </View>
              <View style={[s.moncashNote, { backgroundColor: 'rgba(220,20,60,0.06)', borderColor: 'rgba(220,20,60,0.15)' }]}>
                <Ionicons name="information-circle-outline" size={13} color="#DC143C" />
                <Text style={[s.moncashNoteText, { color: '#DC143C' }]}>
                  You will be redirected to the MonCash payment gateway within the app.
                </Text>
              </View>
            </View>
          </GlassSection>
        )}

        {/* Secure note */}
        <View style={s.secureRow}>
          <Ionicons name="shield-checkmark" size={13} color={T.secureText} />
          <Text style={[s.secureText, { color: T.secureText }]}>
            {'  '}Secured by {method === 'moncash' ? 'Digicel MonCash' : 'Stripe'}  ·  Cancel anytime
          </Text>
        </View>
      </ScrollView>

      {/* ── Bottom CTA with stronger blur ── */}
      <BlurView
        intensity={90}
        tint={T.blurTint}
        style={[s.bottomBar, { paddingBottom: insets.bottom + 20, borderTopColor: T.bottomBorder }]}
      >
        <View style={s.totalRow}>
          <Text style={[s.totalLabel, { color: T.textSec }]}>Total today</Text>
          <View style={{ alignItems: 'flex-end' }}>
            {couponResult?.valid && method !== 'moncash' && (
              <Text style={[s.totalOriginal, { color: T.textMuted }]}>${planPriceUSD.toFixed(2)}</Text>
            )}
            <Text style={[s.totalPrice, { color: T.text }]}>
              {method === 'moncash' ? `${planPriceHTG} HTG` : displayPrice}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={[s.payBtn, { backgroundColor: payBtnColor }, (loading || payBtnDisabled) && s.payBtnDisabled]}
          onPress={handlePay}
          disabled={loading || payBtnDisabled}
          activeOpacity={0.85}
        >
          {loading ? (
            <>
              <ActivityIndicator color="#FFF" size="small" />
              <Text style={s.payBtnText}>Processing…</Text>
            </>
          ) : (
            <>
              {method === 'apple' && <Ionicons name="logo-apple" size={20} color="#FFF" />}
              {method === 'google' && <Text style={{ color: '#FFF', fontSize: 17, fontWeight: '700' }}>G</Text>}
              {method === 'card' && <Ionicons name="card" size={19} color="#FFF" />}
              {method === 'moncash' && (
                <View style={s.moncashBadgeSmall}><Text style={s.moncashBadgeSmallText}>M</Text></View>
              )}
              <Text style={s.payBtnText}>{payLabel()}</Text>
            </>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={s.cancelBtn} onPress={() => router.back()}>
          <Text style={[s.cancelText, { color: T.textSec }]}>Cancel subscription</Text>
        </TouchableOpacity>
      </BlurView>
    </KeyboardAvoidingView>
  );
}

// ─────────────────────────────────────────────────────────
// Root export
// ─────────────────────────────────────────────────────────
export default function CheckoutScreen() {
  const T = useT();
  if (Platform.OS === 'web' || !StripeProvider) {
    return (
      <View style={[s.webFallback, { backgroundColor: T.bg }]}>
        <View style={[s.webFallbackIcon, { borderColor: T.inputBorder }]}>
          <Ionicons name="card-outline" size={38} color={T.textMuted} />
        </View>
        <Text style={[s.webFallbackTitle, { color: T.text }]}>In-app payments unavailable</Text>
        <Text style={[s.webFallbackSub, { color: T.textSec }]}>
          Please use the "Buy on Web" option on the subscription screen to complete your purchase.
        </Text>
      </View>
    );
  }
  return (
    <StripeProvider
      publishableKey={STRIPE_PK}
      merchantIdentifier="merchant.com.dawinix.ht"
      urlScheme="dawinixht"
    >
      <CheckoutInner />
    </StripeProvider>
  );
}

// ─────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────
const s = StyleSheet.create({
  // Glow layer behind glass
  glowLayer: {
    position: 'absolute',
    top: -2, left: 8, right: 8, bottom: -2,
    borderRadius: 24,
    blurRadius: 20,
  },
  glassBase: {
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
    // subtle inner shadow feel
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { alignItems: 'center', gap: 4 },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  headerSecurePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(48,209,88,0.12)',
    borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3,
  },
  headerSecureText: { fontSize: 10, fontWeight: '600', color: '#30D158' },

  // Scroll
  scroll: { paddingHorizontal: 16, paddingTop: 20, gap: 12 },

  // Section header with line
  sectionHeaderRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6,
  },
  sectionLine: { width: 16, height: 2, borderRadius: 1 },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', letterSpacing: 0.8,
  },

  // Plan card
  planGradient: { borderRadius: 22 },
  planCardInner: { flexDirection: 'row', padding: 18, gap: 12, alignItems: 'flex-start' },
  planLeft: { flex: 1 },
  planBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start', marginBottom: 6 },
  planBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  planName: { fontSize: 20, fontWeight: '800', marginBottom: 2 },
  planSub: { fontSize: 12 },
  benefitsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 8 },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  benefitDot: { width: 4, height: 4, borderRadius: 2 },
  benefitText: { fontSize: 11 },
  planRight: { alignItems: 'flex-end', gap: 2 },
  originalPrice: { fontSize: 13, textDecorationLine: 'line-through' },
  planPrice: { fontSize: 30, fontWeight: '800' },
  planPricePer: { fontSize: 11, fontWeight: '500' },
  discountBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    borderRadius: 20, paddingHorizontal: 7, paddingVertical: 3, marginTop: 4,
  },
  discountBadgeText: { fontSize: 11, fontWeight: '700' },

  // Field
  fieldRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12, gap: 12, position: 'relative',
  },
  fieldIconWrap: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  fieldContent: { flex: 1 },
  fieldLabel: { fontSize: 10, fontWeight: '600', marginBottom: 3, letterSpacing: 0.2 },
  fieldInput: { fontSize: 15, fontWeight: '400', padding: 0, margin: 0 },
  focusBar: { position: 'absolute', right: 0, top: 10, bottom: 10, width: 3, borderRadius: 2 },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 64 },

  // Coupon
  applyBtn: {
    borderRadius: 22, paddingHorizontal: 16, paddingVertical: 8,
    alignItems: 'center', justifyContent: 'center', minWidth: 68,
  },
  applyBtnText: { fontSize: 13, fontWeight: '700' },
  couponMsg: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  couponMsgText: { fontSize: 12, fontWeight: '500', flex: 1 },

  // Payment tabs
  tabsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 14 },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 11, borderRadius: 50,
    minWidth: 90, justifyContent: 'center',
  },
  tabText: { fontSize: 13, fontWeight: '600' },

  // Card fallback
  cardFallback: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    margin: 16, borderRadius: 12, padding: 14, borderWidth: 1, opacity: 0.7,
  },
  cardFallbackText: { fontSize: 13, flex: 1, lineHeight: 18 },

  // Card brands row
  cardBrandsRow: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 16, paddingTop: 6, flexWrap: 'wrap',
  },

  // Pay info card
  payInfoCard: { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 24, gap: 10 },
  payIconBig: { width: 72, height: 72, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  payInfoTitle: { fontSize: 20, fontWeight: '700' },
  payInfoSub: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  payInfoAmount: {
    borderWidth: 1, borderRadius: 22,
    paddingHorizontal: 16, paddingVertical: 8, marginTop: 4,
  },
  payInfoAmountText: { fontSize: 15, fontWeight: '700' },

  // MonCash
  moncashM: { color: '#FFF', fontSize: 34, fontWeight: '900' },
  moncashNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, marginTop: 4,
  },
  moncashNoteText: { fontSize: 11, flex: 1, lineHeight: 16 },

  // Secure
  secureRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 6 },
  secureText: { fontSize: 12, lineHeight: 18 },

  // Bottom bar
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 18, paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth, gap: 10, overflow: 'hidden',
  },
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 4,
  },
  totalLabel: { fontSize: 13, fontWeight: '500' },
  totalOriginal: { fontSize: 13, textDecorationLine: 'line-through' },
  totalPrice: { fontSize: 20, fontWeight: '800' },
  payBtn: {
    width: '100%', borderRadius: 50, paddingVertical: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 10,
    elevation: 6,
  },
  payBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  payBtnDisabled: { opacity: 0.45 },
  cancelBtn: { alignItems: 'center', paddingVertical: 6 },
  cancelText: { fontSize: 13, fontWeight: '500' },
  moncashBadgeSmall: { width: 22, height: 22, borderRadius: 6, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  moncashBadgeSmallText: { color: '#DC143C', fontSize: 13, fontWeight: '900' },

  // Web fallback
  webFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  webFallbackIcon: {
    width: 80, height: 80, borderRadius: 24, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, marginBottom: 4,
  },
  webFallbackTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  webFallbackSub: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
});
please ai if see this make alll change read and make change Replace react-native-international-phone-number in checkout.tsx with a custom country picker built using libphonenumber-js and a FlatList modal, making it fully web-compatible without native-only library errors.
