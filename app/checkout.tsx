
/**
 * CHECKOUT — Full in-app payment (redesigned with BlurView)
 * • Contact: email (editable) + phone with country-code picker
 * • Coupon / promo code field → Stripe discount
 * • Card: Stripe CardField (cardholder name + number/expiry/CVV)
 * • Apple Pay: Stripe in-app sheet (iOS)
 * • Google Pay: Stripe in-app sheet (Android)
 * • MonCash: edge-function → in-app WebBrowser (Haiti & USA only)
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useAuth, useAlert, getSupabaseClient } from '@/template';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSubscription } from '../hooks/useSubscription';
import { FunctionsHttpError } from '@supabase/supabase-js';
import * as WebBrowser from 'expo-web-browser';

// ─────────────────────────────────────────────────────────
// Theme
// ─────────────────────────────────────────────────────────
function useT() {
  const dark = useColorScheme() !== 'light';
  return {
    dark,
    bg: dark ? '#0A0A0A' : '#F2F2F7',
    surface: dark ? 'rgba(28,28,30,0.85)' : 'rgba(255,255,255,0.75)',
    surfaceBorder: dark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.08)',
    text: dark ? '#FFFFFF' : '#000000',
    textSec: dark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)',
    textMuted: dark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)',
    inputBg: dark ? 'rgba(44,44,46,0.9)' : 'rgba(255,255,255,0.9)',
    inputBorder: dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
    placeholderText: dark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)',
    headerBorder: dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)',
    bottomBg: dark ? 'rgba(10,10,10,0.98)' : 'rgba(242,242,247,0.98)',
    bottomBorder: dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.09)',
    tabInactive: dark ? 'rgba(44,44,46,0.8)' : 'rgba(229,229,234,0.9)',
    tabInactiveText: dark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)',
    cardFieldBg: dark ? '#2C2C2E' : '#F8F8F8',
    divider: dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)',
    secureText: dark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.3)',
    blurTint: (dark ? 'dark' : 'light') as 'dark' | 'light',
    couponApplied: '#34C759',
    couponError: '#FF3B30',
    modalBg: dark ? '#1C1C1E' : '#FFFFFF',
    modalBorder: dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
    searchBg: dark ? '#2C2C2E' : '#F2F2F7',
  };
}

// ─────────────────────────────────────────────────────────
// Country codes (world-wide)
// ─────────────────────────────────────────────────────────
const COUNTRY_CODES = [
  { code: '+1', country: 'US', flag: '🇺🇸', name: 'United States', format: '(###) ###-####' },
  { code: '+509', country: 'HT', flag: '🇭🇹', name: 'Haiti', format: '####-####' },
  { code: '+1', country: 'CA', flag: '🇨🇦', name: 'Canada', format: '(###) ###-####' },
  { code: '+44', country: 'GB', flag: '🇬🇧', name: 'United Kingdom', format: '#### ######' },
  { code: '+33', country: 'FR', flag: '🇫🇷', name: 'France', format: '## ## ## ## ##' },
  { code: '+49', country: 'DE', flag: '🇩🇪', name: 'Germany', format: '#### #######' },
  { code: '+39', country: 'IT', flag: '🇮🇹', name: 'Italy', format: '### ### ####' },
  { code: '+34', country: 'ES', flag: '🇪🇸', name: 'Spain', format: '### ### ###' },
  { code: '+55', country: 'BR', flag: '🇧🇷', name: 'Brazil', format: '(##) #####-####' },
  { code: '+52', country: 'MX', flag: '🇲🇽', name: 'Mexico', format: '### ### ####' },
  { code: '+57', country: 'CO', flag: '🇨🇴', name: 'Colombia', format: '### ### ####' },
  { code: '+54', country: 'AR', flag: '🇦🇷', name: 'Argentina', format: '### ###-####' },
  { code: '+56', country: 'CL', flag: '🇨🇱', name: 'Chile', format: '# #### ####' },
  { code: '+58', country: 'VE', flag: '🇻🇪', name: 'Venezuela', format: '###-###-####' },
  { code: '+1-876', country: 'JM', flag: '🇯🇲', name: 'Jamaica', format: '(876) ###-####' },
  { code: '+1-809', country: 'DO', flag: '🇩🇴', name: 'Dominican Republic', format: '(###) ###-####' },
  { code: '+1-246', country: 'BB', flag: '🇧🇧', name: 'Barbados', format: '(246) ###-####' },
  { code: '+596', country: 'MQ', flag: '🇲🇶', name: 'Martinique', format: '#### ####' },
  { code: '+590', country: 'GP', flag: '🇬🇵', name: 'Guadeloupe', format: '#### ####' },
  { code: '+81', country: 'JP', flag: '🇯🇵', name: 'Japan', format: '##-####-####' },
  { code: '+82', country: 'KR', flag: '🇰🇷', name: 'South Korea', format: '###-####-####' },
  { code: '+86', country: 'CN', flag: '🇨🇳', name: 'China', format: '### #### ####' },
  { code: '+91', country: 'IN', flag: '🇮🇳', name: 'India', format: '##### #####' },
  { code: '+971', country: 'AE', flag: '🇦🇪', name: 'UAE', format: '## ### ####' },
  { code: '+966', country: 'SA', flag: '🇸🇦', name: 'Saudi Arabia', format: '## ### ####' },
  { code: '+27', country: 'ZA', flag: '🇿🇦', name: 'South Africa', format: '## ### ####' },
  { code: '+234', country: 'NG', flag: '🇳🇬', name: 'Nigeria', format: '### ### ####' },
  { code: '+254', country: 'KE', flag: '🇰🇪', name: 'Kenya', format: '### ### ###' },
  { code: '+233', country: 'GH', flag: '🇬🇭', name: 'Ghana', format: '### ### ####' },
  { code: '+237', country: 'CM', flag: '🇨🇲', name: 'Cameroon', format: '#### ####' },
  { code: '+225', country: 'CI', flag: '🇨🇮', name: "Ivory Coast", format: '## ## ## ##' },
  { code: '+221', country: 'SN', flag: '🇸🇳', name: 'Senegal', format: '## ### ## ##' },
  { code: '+243', country: 'CD', flag: '🇨🇩', name: 'DR Congo', format: '### ### ###' },
  { code: '+20', country: 'EG', flag: '🇪🇬', name: 'Egypt', format: '### ### ####' },
  { code: '+212', country: 'MA', flag: '🇲🇦', name: 'Morocco', format: '###-######' },
  { code: '+213', country: 'DZ', flag: '🇩🇿', name: 'Algeria', format: '### ## ## ##' },
  { code: '+216', country: 'TN', flag: '🇹🇳', name: 'Tunisia', format: '## ### ###' },
  { code: '+61', country: 'AU', flag: '🇦🇺', name: 'Australia', format: '#### ### ###' },
  { code: '+64', country: 'NZ', flag: '🇳🇿', name: 'New Zealand', format: '### ### ####' },
  { code: '+7', country: 'RU', flag: '🇷🇺', name: 'Russia', format: '(###) ###-##-##' },
  { code: '+380', country: 'UA', flag: '🇺🇦', name: 'Ukraine', format: '## ### ## ##' },
  { code: '+48', country: 'PL', flag: '🇵🇱', name: 'Poland', format: '### ### ###' },
  { code: '+31', country: 'NL', flag: '🇳🇱', name: 'Netherlands', format: '## ### ####' },
  { code: '+32', country: 'BE', flag: '🇧🇪', name: 'Belgium', format: '### ## ## ##' },
  { code: '+41', country: 'CH', flag: '🇨🇭', name: 'Switzerland', format: '## ### ## ##' },
  { code: '+46', country: 'SE', flag: '🇸🇪', name: 'Sweden', format: '##-### ## ##' },
  { code: '+47', country: 'NO', flag: '🇳🇴', name: 'Norway', format: '### ## ###' },
  { code: '+45', country: 'DK', flag: '🇩🇰', name: 'Denmark', format: '## ## ## ##' },
  { code: '+358', country: 'FI', flag: '🇫🇮', name: 'Finland', format: '## ### ####' },
];

type CountryEntry = typeof COUNTRY_CODES[0];

// Format raw digits into country pattern
function formatPhoneDigits(digits: string, pattern: string): string {
  let result = '';
  let di = 0;
  for (let i = 0; i < pattern.length && di < digits.length; i++) {
    if (pattern[i] === '#') {
      result += digits[di++];
    } else {
      result += pattern[i];
      if (di < digits.length && digits[di] === pattern[i]) di++;
    }
  }
  return result;
}

// ─────────────────────────────────────────────────────────
// Stripe (native only — graceful web fallback)
// ─────────────────────────────────────────────────────────
let StripeProvider: React.ComponentType<any> | null = null;
let CardField: React.ComponentType<any> | null = null;
let useStripe: (() => {
  confirmPayment: any;
  initPaymentSheet: any;
  presentPaymentSheet: any;
  createPaymentMethod: any;
}) | null = null;
let useApplePay: (() => {
  isApplePaySupported: boolean;
  presentApplePay: any;
  confirmApplePayPayment: any;
}) | null = null;
let useGooglePay: (() => {
  isGooglePaySupported: (opts: any) => Promise<boolean>;
  initGooglePay: any;
  presentGooglePay: any;
}) | null = null;

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
// Country Picker Modal
// ─────────────────────────────────────────────────────────
function CountryPickerModal({
  visible,
  onClose,
  onSelect,
  T,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (c: CountryEntry) => void;
  T: ReturnType<typeof useT>;
}) {
  const [search, setSearch] = useState('');
  const insets = useSafeAreaInsets();

  const filtered = COUNTRY_CODES.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.code.includes(search) ||
      c.country.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <TouchableOpacity style={{ flex: 1 }} onPress={onClose} />
        <View
          style={[
            cpStyles.sheet,
            { backgroundColor: T.modalBg, paddingBottom: insets.bottom + 16, borderColor: T.modalBorder },
          ]}
        >
          <View style={[cpStyles.handle, { backgroundColor: T.textMuted }]} />
          <Text style={[cpStyles.title, { color: T.text }]}>Select Country Code</Text>

          {/* Search */}
          <View style={[cpStyles.searchRow, { backgroundColor: T.searchBg }]}>
            <Ionicons name="search" size={16} color={T.textSec} />
            <TextInput
              style={[cpStyles.searchInput, { color: T.text }]}
              value={search}
              onChangeText={setSearch}
              placeholder="Search country or code…"
              placeholderTextColor={T.placeholderText}
              autoCapitalize="none"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={16} color={T.textSec} />
              </TouchableOpacity>
            )}
          </View>

          <FlatList
            data={filtered}
            keyExtractor={(item, i) => `${item.country}-${i}`}
            showsVerticalScrollIndicator={false}
            style={{ maxHeight: 380 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[cpStyles.countryRow, { borderBottomColor: T.divider }]}
                onPress={() => { onSelect(item); onClose(); setSearch(''); }}
              >
                <Text style={cpStyles.flag}>{item.flag}</Text>
                <Text style={[cpStyles.countryName, { color: T.text }]}>{item.name}</Text>
                <Text style={[cpStyles.countryCode, { color: T.textSec }]}>{item.code}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

const cpStyles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    borderWidth: 1,
    borderBottomWidth: 0,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
    opacity: 0.3,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    padding: 0,
  },
  countryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  flag: { fontSize: 22 },
  countryName: { flex: 1, fontSize: 15 },
  countryCode: { fontSize: 14, fontWeight: '600' },
});

// ─────────────────────────────────────────────────────────
// Inner checkout
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
  const planColor = plan === 'plus' ? '#6B5CE7' : '#34C759';
  const planLabel = plan === 'plus' ? 'Dawinix Plus' : 'Dawinix Go';
  const planPriceUSD = plan === 'plus' ? 19.99 : 8.0;
  const planPriceHTG = plan === 'plus' ? 2650 : 1060;
  const planAmountHTG = plan === 'plus' ? 2650 : 1060;

  // ── Contact info ──
  const [email, setEmail] = useState(user?.email || '');
  const [focusedField, setFocusedField] = useState<string | null>(null);

  // ── Phone + country code ──
  const [selectedCountry, setSelectedCountry] = useState<CountryEntry>(COUNTRY_CODES[0]);
  const [phoneRaw, setPhoneRaw] = useState('');
  const [countryPickerVisible, setCountryPickerVisible] = useState(false);

  const handlePhoneChange = (text: string) => {
    const digits = text.replace(/\D/g, '');
    setPhoneRaw(digits);
  };
  const formattedPhone = formatPhoneDigits(phoneRaw, selectedCountry.format);
  const fullPhone = `${selectedCountry.code} ${formattedPhone}`.trim();

  // ── Card ──
  const [cardholderName, setCardholderName] = useState('');
  const [cardReady, setCardReady] = useState(false);

  // ── Coupon ──
  const [couponCode, setCouponCode] = useState('');
  const [couponApplying, setCouponApplying] = useState(false);
  const [couponResult, setCouponResult] = useState<{
    valid: boolean;
    discountPct?: number;
    discountAmt?: number;
    message: string;
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

  // ── Payment method ──
  const showMoncash = isHaitiOrUSAUser(user);
  const defaultTab: PayMethod =
    Platform.OS === 'ios' ? 'apple' : Platform.OS === 'android' ? 'google' : 'card';
  const [method, setMethod] = useState<PayMethod>(showMoncash ? 'moncash' : defaultTab);

  // ── Google Pay support ──
  const [googlePayReady, setGooglePayReady] = useState(false);

  // ── Stripe hooks ──
  const applePay = useApplePay ? useApplePay() : null;
  const isApplePaySupported = applePay?.isApplePaySupported ?? false;
  const googlePay = useGooglePay ? useGooglePay() : null;
  const stripe = useStripe ? useStripe() : null;

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'android' || !googlePay) return;
    googlePay
      .isGooglePaySupported({ testEnv: false })
      .then((ok: boolean) => setGooglePayReady(ok))
      .catch(() => setGooglePayReady(false));
  }, []);

  // ── Benefits ──
  const benefits =
    plan === 'plus'
      ? ['Advanced AI models', 'Unlimited messages', '20 uploads/session', 'Agents & deep research', 'Priority support']
      : ['More daily messages', '10 uploads/session', 'Group chat', 'Longer memory'];

  // ─────────────────────────────────────────
  // Apply coupon
  // ─────────────────────────────────────────
  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponApplying(true);
    setCouponResult(null);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;

      // Known local coupons (instant feedback)
      const LOCAL_COUPONS: Record<string, { discountPct?: number; discountAmt?: number; message: string }> = {
        DAWINIX2026: { discountPct: 20, message: '20% off applied!' },
        HAITI50: { discountPct: 50, message: '50% off for Haiti users!' },
        WELCOME10: { discountPct: 10, message: '10% welcome discount!' },
      };
      const local = LOCAL_COUPONS[couponCode.trim().toUpperCase()];
      if (local) {
        setCouponResult({ valid: true, ...local });
        setCouponApplying(false);
        return;
      }

      // Try server-side validation
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
            message: data.message || `${data.percent_off ?? data.amount_off}% off applied!`,
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

  // ─────────────────────────────────────────
  // Get PaymentIntent secret
  // ─────────────────────────────────────────
  const getClientSecret = async (token: string) => {
    const { data, error } = await supabase.functions.invoke('create-checkout-session', {
      body: {
        plan,
        priceId,
        mode: 'payment_sheet',
        couponCode: couponResult?.valid ? couponCode.trim() : undefined,
      },
      headers: { Authorization: `Bearer ${token}` },
    });
    if (error) {
      let msg = error.message;
      if (error instanceof FunctionsHttpError) {
        try { msg = await error.context?.text() || msg; } catch (_) {}
      }
      throw new Error(msg);
    }
    return data as { clientSecret?: string; ephemeralKey?: string; customerId?: string; url?: string };
  };

  // ─────────────────────────────────────────
  // Post-payment sync
  // ─────────────────────────────────────────
  const syncSubscription = async (token: string) => {
    const { data: subData } = await supabase.functions.invoke('check-subscription', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (user?.id) {
      await supabase.from('user_profiles').update({
        subscription_tier: subData?.plan || plan,
        subscription_expires_at: subData?.subscription_end || null,
      }).eq('id', user.id);
    }
    await refreshSubscription?.();
    router.replace('/subscription-success');
  };

  // ─────────────────────────────────────────
  // Card payment
  // ─────────────────────────────────────────
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
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────
  // Apple Pay
  // ─────────────────────────────────────────
  const handleApplePay = async () => {
    if (!applePay || !isApplePaySupported || !stripe) {
      showAlert('Not Available', 'Apple Pay is not available on this device.'); return;
    }
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
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────
  // Google Pay
  // ─────────────────────────────────────────
  const handleGooglePay = async () => {
    if (!googlePay || !googlePayReady || !stripe) {
      showAlert('Not Available', 'Google Pay is not available on this device.'); return;
    }
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
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────
  // MonCash (Haiti & USA only)
  // ─────────────────────────────────────────
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
    } finally {
      setLoading(false);
    }
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

  // ─────────────────────────────────────────
  // Main pay handler
  // ─────────────────────────────────────────
  const handlePay = () => {
    switch (method) {
      case 'card': return handleCardPay();
      case 'apple': return handleApplePay();
      case 'google': return handleGooglePay();
      case 'moncash': return handleMonCash();
    }
  };

  const payLabel = () => {
    if (loading) return '';
    switch (method) {
      case 'card': return `Pay ${displayPrice}/mo with Card`;
      case 'apple': return `Pay with Apple Pay · ${displayPrice}/mo`;
      case 'google': return `Pay with Google Pay · ${displayPrice}/mo`;
      case 'moncash': return `Pay with MonCash · ${planPriceHTG} HTG/mo`;
      default: return ''; // Added default case to satisfy TypeScript
    }
  };

  const payBtnColor = method === 'moncash' ? '#DC143C' : planColor;
  const payBtnDisabled = method === 'card' && (!cardReady || !cardholderName.trim());

  const cardFieldStyle = {
    backgroundColor: T.cardFieldBg,
    textColor: T.text,
    placeholderColor: T.placeholderText,
    borderColor: focusedField === 'card' ? planColor : T.inputBorder,
    borderWidth: focusedField === 'card' ? 1.5 : 1,
    borderRadius: 12,
    cursorColor: planColor,
  };

  // ─────────────────────────────────────────
  // Available payment tabs
  // ─────────────────────────────────────────
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

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: T.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <BlurView
        intensity={60}
        tint={T.blurTint}
        style={[s.header, { paddingTop: insets.top + 8, borderBottomColor: T.headerBorder }]}
      >
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={24} color={T.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: T.text }]}>Checkout</Text>
        <View style={{ width: 24 }} />
      </BlurView>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 140 }]}
      >
        {/* ── Plan summary card ── */}
        <BlurView
          intensity={55}
          tint={T.blurTint}
          style={[s.planCard, { borderColor: planColor + '44' }]}
        >
          <View style={[s.planBadge, { backgroundColor: planColor }]}>
            <Text style={s.planBadgeText}>{plan === 'plus' ? '✨ PLUS' : '⚡ GO'}</Text>
          </View>
          <Text style={[s.planName, { color: T.text }]}>{planLabel}</Text>
          <View style={s.priceRow}>
            {displayOriginalPrice && (
              <Text style={[s.originalPrice, { color: T.textMuted }]}>{displayOriginalPrice}</Text>
            )}
            <Text style={[s.planPrice, { color: planColor }]}>
              {displayPrice}
              <Text style={[s.planPricePer, { color: T.textSec }]}>/month</Text>
            </Text>
          </View>
          {couponResult?.valid && (
            <View style={[s.couponBadge, { backgroundColor: T.couponApplied + '22', borderColor: T.couponApplied + '55' }]}>
              <Ionicons name="checkmark-circle" size={13} color={T.couponApplied} />
              <Text style={[s.couponBadgeText, { color: T.couponApplied }]}>{couponResult.message}</Text>
            </View>
          )}
          <View style={s.benefitsRow}>
            {benefits.map((b) => (
              <View key={b} style={s.benefitChip}>
                <Ionicons name="checkmark-circle" size={13} color={planColor} />
                <Text style={[s.benefitChipText, { color: T.textSec }]}>{b}</Text>
              </View>
            ))}
          </View>
        </BlurView>

        {/* ── Contact info ── */}
        <BlurView
          intensity={50}
          tint={T.blurTint}
          style={[s.section, { borderColor: T.surfaceBorder }]}
        >
          <Text style={[s.sectionTitle, { color: T.textSec }]}>CONTACT INFORMATION</Text>

          {/* Email */}
          <View style={s.fieldRow}>
            <Ionicons name="mail-outline" size={18} color={T.textSec} style={s.fieldIcon} />
            <View style={s.fieldContent}>
              <Text style={[s.fieldLabel, { color: T.textSec }]}>Email</Text>
              <TextInput
                style={[s.fieldInput, { color: T.text }]}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                placeholderTextColor={T.placeholderText}
                placeholder="your@email.com"
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField(null)}
              />
            </View>
            {focusedField === 'email' && (
              <View style={[s.focusBar, { backgroundColor: planColor }]} />
            )}
          </View>

          <View style={[s.divider, { backgroundColor: T.divider }]} />

          {/* Phone with country-code picker */}
          <View style={[s.fieldRow, { paddingRight: 16 }]}>
            <Ionicons name="call-outline" size={18} color={T.textSec} style={s.fieldIcon} />
            <View style={s.fieldContent}>
              <Text style={[s.fieldLabel, { color: T.textSec }]}>Phone (optional)</Text>
              <View style={s.phoneInputRow}>
                {/* Country code selector */}
                <TouchableOpacity
                  style={[s.countryCodeBtn, { borderColor: T.inputBorder }]}
                  onPress={() => setCountryPickerVisible(true)}
                >
                  <Text style={s.countryFlag}>{selectedCountry.flag}</Text>
                  <Text style={[s.countryCodeText, { color: T.text }]}>{selectedCountry.code}</Text>
                  <Ionicons name="chevron-down" size={12} color={T.textSec} />
                </TouchableOpacity>

                {/* Number input */}
                <TextInput
                  style={[s.phoneInput, { color: T.text, flex: 1 }]}
                  value={formattedPhone}
                  onChangeText={handlePhoneChange}
                  keyboardType="phone-pad"
                  placeholderTextColor={T.placeholderText}
                  placeholder={selectedCountry.format.replace(/#/g, '0')}
                  onFocus={() => setFocusedField('phone')}
                  onBlur={() => setFocusedField(null)}
                />
              </View>
            </View>
            {focusedField === 'phone' && (
              <View style={[s.focusBar, { backgroundColor: planColor }]} />
            )}
          </View>
        </BlurView>

        {/* ── Coupon / Promo code ── */}
        <BlurView
          intensity={50}
          tint={T.blurTint}
          style={[s.section, { borderColor: T.surfaceBorder }]}
        >
          <Text style={[s.sectionTitle, { color: T.textSec }]}>PROMO CODE</Text>
          <View style={s.fieldRow}>
            <Ionicons name="pricetag-outline" size={18} color={T.textSec} style={s.fieldIcon} />
            <View style={[s.fieldContent, { flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
              <TextInput
                style={[s.fieldInput, { color: T.text, flex: 1 }]}
                value={couponCode}
                onChangeText={(t) => { setCouponCode(t.toUpperCase()); setCouponResult(null); }}
                autoCapitalize="characters"
                autoCorrect={false}
                placeholderTextColor={T.placeholderText}
                placeholder="Enter code (e.g. DAWINIX2026)"
                onFocus={() => setFocusedField('coupon')}
                onBlur={() => setFocusedField(null)}
              />
              <TouchableOpacity
                style={[
                  s.applyBtn,
                  {
                    backgroundColor: couponCode.trim().length > 0 ? planColor : T.tabInactive,
                  },
                ]}
                onPress={handleApplyCoupon}
                disabled={couponApplying || couponCode.trim().length === 0}
              >
                {couponApplying ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={[s.applyBtnText, { color: couponCode.trim().length > 0 ? '#FFF' : T.tabInactiveText }]}>
                    Apply
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
          {couponResult && (
            <View style={[s.couponMsg, { backgroundColor: couponResult.valid ? T.couponApplied + '15' : T.couponError + '15' }]}>
              <Ionicons
                name={couponResult.valid ? 'checkmark-circle' : 'close-circle'}
                size={14}
                color={couponResult.valid ? T.couponApplied : T.couponError}
              />
              <Text style={[s.couponMsgText, { color: couponResult.valid ? T.couponApplied : T.couponError }]}>
                {couponResult.message}
              </Text>
            </View>
          )}
        </BlurView>

        {/* ── Payment method tabs ── */}
        <Text style={[s.sectionHeader, { color: T.textSec }]}>PAYMENT METHOD</Text>
        <View style={s.tabs}>
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[s.tab, { backgroundColor: method === tab.key ? planColor : T.tabInactive }]}
              onPress={() => setMethod(tab.key)}
            >
              <Ionicons
                name={tab.icon as any}
                size={15}
                color={method === tab.key ? '#FFF' : T.tabInactiveText}
              />
              <Text style={[s.tabText, { color: method === tab.key ? '#FFF' : T.tabInactiveText }]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Card entry ── */}
        {method === 'card' && (
          <BlurView intensity={50} tint={T.blurTint} style={[s.section, { borderColor: T.surfaceBorder }]}>
            <Text style={[s.sectionTitle, { color: T.textSec }]}>CARD DETAILS</Text>
            <View style={s.fieldRow}>
              <Ionicons name="person-outline" size={18} color={T.textSec} style={s.fieldIcon} />
              <View style={s.fieldContent}>
                <Text style={[s.fieldLabel, { color: T.textSec }]}>Name on card</Text>
                <TextInput
                  style={[s.fieldInput, { color: T.text }]}
                  value={cardholderName}
                  onChangeText={setCardholderName}
                  autoCapitalize="words"
                  autoCorrect={false}
                  placeholderTextColor={T.placeholderText}
                  placeholder="Full name"
                  onFocus={() => setFocusedField('name')}
                  onBlur={() => setFocusedField(null)}
                />
              </View>
              {focusedField === 'name' && <View style={[s.focusBar, { backgroundColor: planColor }]} />}
            </View>

            <View style={[s.divider, { backgroundColor: T.divider }]} />

            {CardField ? (
              <View style={s.cardFieldWrap}>
                <Text style={[s.fieldLabel, { color: T.textSec, marginBottom: 8 }]}>
                  Card number · Expiry · CVV
                </Text>
                <CardField
                  postalCodeEnabled={false}
                  placeholders={{ number: '4242 4242 4242 4242', expiration: 'MM/YY', cvc: 'CVV' }}
                  cardStyle={cardFieldStyle}
                  style={s.cardField}
                  onCardChange={(details: any) => setCardReady(details.complete)}
                  onFocus={() => setFocusedField('card')}
                />
              </View>
            ) : (
              <View style={s.cardFieldFallback}>
                <Ionicons name="card-outline" size={24} color={T.textMuted} />
                <Text style={[s.cardFieldFallbackText, { color: T.textSec }]}>
                  Card entry requires the native app. Use Apple Pay, Google Pay, or install the app.
                </Text>
              </View>
            )}

            <View style={s.cardBrands}>
              {['Visa', 'MC', 'Amex', 'Discover'].map((b) => (
                <View key={b} style={[s.cardBrandChip, { borderColor: T.inputBorder }]}>
                  <Text style={[s.cardBrandText, { color: T.textMuted }]}>{b}</Text>
                </View>
              ))}
            </View>
          </BlurView>
        )}

        {/* ── Apple Pay info ── */}
        {method === 'apple' && (
          <BlurView intensity={50} tint={T.blurTint} style={[s.section, { borderColor: T.surfaceBorder }]}>
            <View style={s.payMethodInfo}>
              <View style={[s.payMethodIconBig, { backgroundColor: '#000' }]}>
                <Ionicons name="logo-apple" size={32} color="#FFF" />
              </View>
              <Text style={[s.payMethodInfoTitle, { color: T.text }]}>Apple Pay</Text>
              <Text style={[s.payMethodInfoSub, { color: T.textSec }]}>
                Complete your payment securely using Touch ID or Face ID. No card details required.
              </Text>
            </View>
          </BlurView>
        )}

        {/* ── Google Pay info ── */}
        {method === 'google' && (
          <BlurView intensity={50} tint={T.blurTint} style={[s.section, { borderColor: T.surfaceBorder }]}>
            <View style={s.payMethodInfo}>
              <View style={[s.payMethodIconBig, { backgroundColor: '#4285F4' }]}>
                <Ionicons name="logo-google" size={28} color="#FFF" />
              </View>
              <Text style={[s.payMethodInfoTitle, { color: T.text }]}>Google Pay</Text>
              <Text style={[s.payMethodInfoSub, { color: T.textSec }]}>
                Complete your purchase instantly using Google Pay — no card entry required.
              </Text>
            </View>
          </BlurView>
        )}

        {/* ── MonCash info (Haiti & USA only) ── */}
        {method === 'moncash' && (
          <BlurView intensity={50} tint={T.blurTint} style={[s.section, { borderColor: T.surfaceBorder }]}>
            <View style={s.payMethodInfo}>
              <View style={[s.payMethodIconBig, { backgroundColor: '#DC143C' }]}>
                <Text style={s.moncashBigIcon}>M</Text>
              </View>
              <Text style={[s.payMethodInfoTitle, { color: T.text }]}>MonCash</Text>
              <Text style={[s.payMethodInfoSub, { color: T.textSec }]}>
                Pay securely with your Digicel MonCash account.{'\n'}
                Available for Haiti 🇭🇹 and USA 🇺🇸 users.{'\n'}
                Amount: {planPriceHTG} HTG/month
              </Text>
              <View style={[s.moncashNote, { backgroundColor: 'rgba(220,20,60,0.08)', borderColor: 'rgba(220,20,60,0.2)' }]}>
                <Ionicons name="information-circle-outline" size={14} color="#DC143C" />
                <Text style={[s.moncashNoteText, { color: '#DC143C' }]}>
                  You will be redirected to the MonCash payment gateway within the app.
                </Text>
              </View>
            </View>
          </BlurView>
        )}

        {/* Secure note */}
        <View style={s.secureRow}>
          <Ionicons name="lock-closed" size={12} color={T.secureText} />
          <Text style={[s.secureText, { color: T.secureText }]}>
            {'  '}Payments secured by {method === 'moncash' ? 'Digicel MonCash' : 'Stripe'}. Cancel anytime.
          </Text>
        </View>
      </ScrollView>

      {/* ── Bottom CTA ── */}
      <BlurView
        intensity={80}
        tint={T.blurTint}
        style={[s.bottomBar, { paddingBottom: insets.bottom + 16, borderTopColor: T.bottomBorder }]}
      >
        <TouchableOpacity
          style={[
            s.payBtn,
            { backgroundColor: payBtnColor },
            (loading || payBtnDisabled) && s.payBtnDisabled,
          ]}
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
              {method === 'google' && <Ionicons name="logo-google" size={18} color="#FFF" />}
              {method === 'card' && <Ionicons name="card-outline" size={20} color="#FFF" />}
              {method === 'moncash' && (
                <View style={s.moncashIconSmall}>
                  <Text style={s.moncashIconSmallText}>M</Text>
                </View>
              )}
              <Text style={s.payBtnText}>{payLabel()}</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={s.cancelBtn} onPress={() => router.back()}>
          <Text style={[s.cancelText, { color: T.textSec }]}>Cancel</Text>
        </TouchableOpacity>
      </BlurView>

      {/* Country picker modal */}
      <CountryPickerModal
        visible={countryPickerVisible}
        onClose={() => setCountryPickerVisible(false)}
        onSelect={(c) => { setSelectedCountry(c); setPhoneRaw(''); }}
        T={T}
      />
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
        <Ionicons name="card-outline" size={52} color={T.textMuted} />
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 18, fontWeight: '700' },

  scroll: { paddingHorizontal: 16, paddingTop: 20, gap: 14 },

  // Plan card
  planCard: {
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 20,
    alignItems: 'center',
    gap: 6,
    overflow: 'hidden',
  },
  planBadge: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5, marginBottom: 4 },
  planBadgeText: { color: '#FFF', fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  planName: { fontSize: 22, fontWeight: '700' },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  originalPrice: { fontSize: 16, textDecorationLine: 'line-through', marginTop: 4 },
  planPrice: { fontSize: 34, fontWeight: '800' },
  planPricePer: { fontSize: 16, fontWeight: '500' },
  couponBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  couponBadgeText: { fontSize: 12, fontWeight: '600' },
  benefitsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginTop: 6 },
  benefitChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  benefitChipText: { fontSize: 12 },

  // Section
  section: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 4,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: 4,
    marginBottom: 8,
  },

  // Fields
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    position: 'relative',
  },
  fieldIcon: { marginRight: 12 },
  fieldContent: { flex: 1 },
  fieldLabel: { fontSize: 11, fontWeight: '600', marginBottom: 2 },
  fieldInput: { fontSize: 16, fontWeight: '400', padding: 0, margin: 0 },
  focusBar: {
    position: 'absolute',
    right: 0,
    top: 8,
    bottom: 8,
    width: 3,
    borderRadius: 2,
  },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 46 },

  // Phone
  phoneInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  countryCodeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  countryFlag: { fontSize: 18 },
  countryCodeText: { fontSize: 13, fontWeight: '600' },
  phoneInput: { fontSize: 16, padding: 0 },

  // Coupon
  applyBtn: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 64,
  },
  applyBtnText: { fontSize: 13, fontWeight: '700' },
  couponMsg: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  couponMsgText: { fontSize: 12, fontWeight: '500', flex: 1 },

  // Payment tabs
  tabs: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 50,
  },
  tabText: { fontSize: 13, fontWeight: '600' },

  // Card field
  cardFieldWrap: { paddingHorizontal: 16, paddingBottom: 14, paddingTop: 8 },
  cardField: { width: '100%', height: 52 },
  cardFieldFallback: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, opacity: 0.7 },
  cardFieldFallbackText: { fontSize: 13, flex: 1, lineHeight: 18 },
  cardBrands: { flexDirection: 'row', gap: 6, paddingHorizontal: 16, paddingBottom: 14 },
  cardBrandChip: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  cardBrandText: { fontSize: 11, fontWeight: '600' },

  // Payment method info
  payMethodInfo: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
    gap: 10,
  },
  payMethodIconBig: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  payMethodInfoTitle: { fontSize: 20, fontWeight: '700' },
  payMethodInfoSub: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  moncashBigIcon: { color: '#FFF', fontSize: 36, fontWeight: '900' },
  moncashNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 4,
  },
  moncashNoteText: { fontSize: 12, flex: 1, lineHeight: 16 },

  // Secure
  secureRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 4 },
  secureText: { fontSize: 12, lineHeight: 18 },

  // Bottom bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
    overflow: 'hidden',
  },
  payBtn: {
    width: '100%',
    borderRadius: 50,
    paddingVertical: 17,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  payBtnText: { fontSize: 17, fontWeight: '700', color: '#FFF' },
  payBtnDisabled: { opacity: 0.5 },
  cancelBtn: { alignItems: 'center', paddingVertical: 6 },
  cancelText: { fontSize: 14, fontWeight: '500' },
  moncashIconSmall: {
    width: 22,
    height: 22,
    borderRadius: 5,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moncashIconSmallText: { color: '#DC143C', fontSize: 13, fontWeight: '900' },

  // Web fallback
  webFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  webFallbackTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  webFallbackSub: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
});
hello ai if you see this make change dont skip make all change please in real time redesign checkout page like this photo:https://files.catbox.moe/0fxp2x.png and make it more better tout bgy stay fix bien ranje dont skip redesign settings lan real svg logo catd amex visa etc no demo
