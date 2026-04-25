/**
 * CHECKOUT — Premium dark-glass redesign
 * • Real SVG-style card brand logos (Visa, Mastercard, Amex, Discover, UnionPay)
 * • Full BlurView glass panels throughout
 * • Contact: email + phone with world-wide country-code picker
 * • Coupon / promo code → Stripe discount
 * • Card: Stripe CardField (cardholder name + number/expiry/CVV)
 * • Apple Pay / Google Pay: Stripe in-app PaymentSheet
 * • MonCash: edge-function → in-app WebBrowser (Haiti & USA only)
 */

import React, { useState, useEffect } from 'react';
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
    bg: dark ? '#080808' : '#F0F0F5',
    surface: dark ? 'rgba(22,22,26,0.92)' : 'rgba(255,255,255,0.78)',
    surfaceBorder: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)',
    text: dark ? '#FFFFFF' : '#0A0A0A',
    textSec: dark ? 'rgba(255,255,255,0.48)' : 'rgba(0,0,0,0.44)',
    textMuted: dark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.28)',
    inputBg: dark ? 'rgba(38,38,42,0.95)' : 'rgba(255,255,255,0.95)',
    inputBorder: dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)',
    placeholderText: dark ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.28)',
    headerBorder: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
    bottomBorder: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)',
    tabInactive: dark ? 'rgba(38,38,42,0.85)' : 'rgba(228,228,234,0.95)',
    tabInactiveText: dark ? 'rgba(255,255,255,0.40)' : 'rgba(0,0,0,0.40)',
    cardFieldBg: dark ? '#1E1E22' : '#F4F4F8',
    divider: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
    secureText: dark ? 'rgba(255,255,255,0.30)' : 'rgba(0,0,0,0.28)',
    blurTint: (dark ? 'dark' : 'light') as 'dark' | 'light',
    couponApplied: '#30D158',
    couponError: '#FF453A',
    modalBg: dark ? '#1C1C1E' : '#FFFFFF',
    searchBg: dark ? '#2C2C2E' : '#F2F2F7',
    planCardGlow: dark ? 'rgba(107,92,231,0.18)' : 'rgba(107,92,231,0.10)',
  };
}

// ─────────────────────────────────────────────────────────
// SVG-style Card Brand Logos
// ─────────────────────────────────────────────────────────
function VisaLogo({ width = 48, height = 30 }: { width?: number; height?: number }) {
  return (
    <View style={[cardBrandStyles.base, { width, height, backgroundColor: '#1A1F71', borderRadius: 5 }]}>
      <Text style={[cardBrandStyles.visaText]}>VISA</Text>
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
// Country codes
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
  { code: '+225', country: 'CI', flag: '🇨🇮', name: 'Ivory Coast', format: '## ## ## ##' },
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
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' }}>
        <TouchableOpacity style={{ flex: 1 }} onPress={onClose} />
        <View style={[cpStyles.sheet, { backgroundColor: T.modalBg, paddingBottom: insets.bottom + 16 }]}>
          <View style={[cpStyles.handle, { backgroundColor: T.textMuted }]} />
          <Text style={[cpStyles.title, { color: T.text }]}>Select Country Code</Text>
          <View style={[cpStyles.searchRow, { backgroundColor: T.searchBg }]}>
            <Ionicons name="search" size={15} color={T.textSec} />
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
                <Ionicons name="close-circle" size={15} color={T.textSec} />
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
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingTop: 12,
  },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 14, opacity: 0.3 },
  title: { fontSize: 17, fontWeight: '700', textAlign: 'center', marginBottom: 14, paddingHorizontal: 16 },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginBottom: 8, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 11,
  },
  searchInput: { flex: 1, fontSize: 15, padding: 0 },
  countryRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth, gap: 12,
  },
  flag: { fontSize: 22 },
  countryName: { flex: 1, fontSize: 15 },
  countryCode: { fontSize: 14, fontWeight: '600' },
});

// ─────────────────────────────────────────────────────────
// Reusable Glass Section
// ─────────────────────────────────────────────────────────
function GlassSection({ T, children, style }: { T: ReturnType<typeof useT>; children: React.ReactNode; style?: any }) {
  return (
    <BlurView
      intensity={52}
      tint={T.blurTint}
      style={[{ borderRadius: 20, borderWidth: 1, borderColor: T.surfaceBorder, overflow: 'hidden' }, style]}
    >
      {children}
    </BlurView>
  );
}

// ─────────────────────────────────────────────────────────
// Field Row
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
      <View style={[s.fieldIconWrap, { backgroundColor: focused ? accentColor + '20' : T.tabInactive }]}>
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
  const [selectedCountry, setSelectedCountry] = useState<CountryEntry>(COUNTRY_CODES[0]);
  const [phoneRaw, setPhoneRaw] = useState('');
  const [countryPickerVisible, setCountryPickerVisible] = useState(false);
  const handlePhoneChange = (text: string) => setPhoneRaw(text.replace(/\D/g, ''));
  const formattedPhone = formatPhoneDigits(phoneRaw, selectedCountry.format);
  const fullPhone = `${selectedCountry.code} ${formattedPhone}`.trim();

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
          setCouponResult({ valid: true, discountPct: data.percent_off, discountAmt: data.amount_off ? data.amount_off / 100 : undefined, message: data.message || 'Discount applied!' });
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
      await supabase.from('user_profiles').update({ subscription_tier: subData?.plan || plan, subscription_expires_at: subData?.subscription_end || null }).eq('id', user.id);
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
        merchantDisplayName: 'Dawinix AI', customerId: secretData.customerId,
        customerEphemeralKeySecret: secretData.ephemeralKey, paymentIntentClientSecret: secretData.clientSecret,
        defaultBillingDetails: { name: cardholderName, email, phone: fullPhone },
        allowsDelayedPaymentMethods: false, returnURL: 'dawinixht://checkout/return',
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
        merchantDisplayName: 'Dawinix AI', customerId: secretData.customerId,
        customerEphemeralKeySecret: secretData.ephemeralKey, paymentIntentClientSecret: secretData.clientSecret,
        applePay: { merchantCountryCode: 'US' }, defaultBillingDetails: { email, phone: fullPhone },
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
        merchantDisplayName: 'Dawinix AI', customerId: secretData.customerId,
        customerEphemeralKeySecret: secretData.ephemeralKey, paymentIntentClientSecret: secretData.clientSecret,
        googlePay: { merchantCountryCode: 'US', testEnv: false, currencyCode: 'usd' },
        defaultBillingDetails: { email, phone: fullPhone }, returnURL: 'dawinixht://checkout/return',
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
      body: { orderId }, headers: { Authorization: `Bearer ${token}` },
    });
    if (error) { showAlert('Verification Error', error.message); return; }
    if (data?.status === 'success') {
      if (user?.id) {
        await supabase.from('user_profiles').update({
          subscription_tier: plan, subscription_expires_at: data?.subscription_end || null,
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

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: T.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* ── Header ── */}
      <BlurView
        intensity={70}
        tint={T.blurTint}
        style={[s.header, { paddingTop: insets.top + 10, borderBottomColor: T.headerBorder }]}
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
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 150 }]}
      >
        {/* ── Plan card ── */}
        <GlassSection T={T} style={{ borderColor: planColor + '50' }}>
          <View style={s.planCardInner}>
            {/* Left: info */}
            <View style={s.planLeft}>
              <View style={[s.planBadge, { backgroundColor: planColor }]}>
                <Text style={s.planBadgeText}>{plan === 'plus' ? '✦ PLUS' : '⚡ GO'}</Text>
              </View>
              <Text style={[s.planName, { color: T.text }]}>{planLabel}</Text>
              <Text style={[s.planSub, { color: T.textSec }]}>Monthly subscription</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                {benefits.map((b) => (
                  <View key={b} style={s.benefitRow}>
                    <View style={[s.benefitDot, { backgroundColor: planColor }]} />
                    <Text style={[s.benefitText, { color: T.textSec }]}>{b}</Text>
                  </View>
                ))}
              </View>
            </View>
            {/* Right: price */}
            <View style={s.planRight}>
              {displayOriginalPrice && (
                <Text style={[s.originalPrice, { color: T.textMuted }]}>{displayOriginalPrice}</Text>
              )}
              <Text style={[s.planPrice, { color: planColor }]}>{displayPrice}</Text>
              <Text style={[s.planPricePer, { color: T.textMuted }]}>/ month</Text>
              {couponResult?.valid && (
                <View style={[s.discountBadge, { backgroundColor: T.couponApplied + '20' }]}>
                  <Ionicons name="pricetag" size={10} color={T.couponApplied} />
                  <Text style={[s.discountBadgeText, { color: T.couponApplied }]}>
                    {couponResult.discountPct ? `-${couponResult.discountPct}%` : ''}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </GlassSection>

        {/* ── Contact ── */}
        <GlassSection T={T}>
          <Text style={[s.sectionLabel, { color: T.textSec }]}>CONTACT INFORMATION</Text>
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
          <FieldRow icon="call-outline" label="Phone (optional)" focused={focusedField === 'phone'} accentColor={planColor} T={T}>
            <View style={s.phoneRow}>
              <TouchableOpacity
                style={[s.countryBtn, { backgroundColor: T.tabInactive }]}
                onPress={() => setCountryPickerVisible(true)}
              >
                <Text style={s.countryFlag}>{selectedCountry.flag}</Text>
                <Text style={[s.countryCodeTxt, { color: T.text }]}>{selectedCountry.code}</Text>
                <Ionicons name="chevron-down" size={11} color={T.textSec} />
              </TouchableOpacity>
              <TextInput
                style={[s.phoneInput, { color: T.text, flex: 1 }]}
                value={formattedPhone}
                onChangeText={handlePhoneChange}
                keyboardType="phone-pad"
                placeholder={selectedCountry.format.replace(/#/g, '0')}
                placeholderTextColor={T.placeholderText}
                onFocus={() => setFocusedField('phone')}
                onBlur={() => setFocusedField(null)}
              />
            </View>
          </FieldRow>
        </GlassSection>

        {/* ── Promo code ── */}
        <GlassSection T={T}>
          <Text style={[s.sectionLabel, { color: T.textSec }]}>PROMO CODE</Text>
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
            <View style={[s.couponMsg, { backgroundColor: couponResult.valid ? T.couponApplied + '14' : T.couponError + '14', marginHorizontal: 16, marginBottom: 12, borderRadius: 12 }]}>
              <Ionicons name={couponResult.valid ? 'checkmark-circle' : 'close-circle'} size={14} color={couponResult.valid ? T.couponApplied : T.couponError} />
              <Text style={[s.couponMsgText, { color: couponResult.valid ? T.couponApplied : T.couponError }]}>{couponResult.message}</Text>
            </View>
          )}
        </GlassSection>

        {/* ── Payment method tabs ── */}
        <Text style={[s.sectionLabel, { color: T.textSec, marginLeft: 2 }]}>PAYMENT METHOD</Text>
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
          <GlassSection T={T}>
            <Text style={[s.sectionLabel, { color: T.textSec }]}>CARD DETAILS</Text>
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

            {/* Card brand logos */}
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
          <GlassSection T={T}>
            <View style={s.payInfoCard}>
              <View style={[s.payIconBig, { backgroundColor: '#000' }]}>
                <Ionicons name="logo-apple" size={30} color="#FFF" />
              </View>
              <Text style={[s.payInfoTitle, { color: T.text }]}>Apple Pay</Text>
              <Text style={[s.payInfoSub, { color: T.textSec }]}>
                Authenticate with Face ID or Touch ID.{'\n'}No card details required.
              </Text>
              <View style={[s.payInfoAmount, { borderColor: planColor + '40', backgroundColor: planColor + '10' }]}>
                <Text style={[s.payInfoAmountText, { color: planColor }]}>{displayPrice} / month</Text>
              </View>
            </View>
          </GlassSection>
        )}

        {/* ── Google Pay ── */}
        {method === 'google' && (
          <GlassSection T={T}>
            <View style={s.payInfoCard}>
              <View style={[s.payIconBig, { backgroundColor: '#FFFFFF' }]}>
                <Text style={{ fontSize: 24 }}>G</Text>
              </View>
              <Text style={[s.payInfoTitle, { color: T.text }]}>Google Pay</Text>
              <Text style={[s.payInfoSub, { color: T.textSec }]}>
                Fast and secure — no card entry required.{'\n'}Uses your Google account payment method.
              </Text>
              <View style={[s.payInfoAmount, { borderColor: planColor + '40', backgroundColor: planColor + '10' }]}>
                <Text style={[s.payInfoAmountText, { color: planColor }]}>{displayPrice} / month</Text>
              </View>
            </View>
          </GlassSection>
        )}

        {/* ── MonCash ── */}
        {method === 'moncash' && (
          <GlassSection T={T} style={{ borderColor: 'rgba(220,20,60,0.25)' }}>
            <View style={s.payInfoCard}>
              <View style={[s.payIconBig, { backgroundColor: '#DC143C' }]}>
                <Text style={s.moncashM}>M</Text>
              </View>
              <Text style={[s.payInfoTitle, { color: T.text }]}>MonCash</Text>
              <Text style={[s.payInfoSub, { color: T.textSec }]}>
                Pay securely with your Digicel MonCash account.{'\n'}
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

      {/* ── Bottom CTA ── */}
      <BlurView
        intensity={85}
        tint={T.blurTint}
        style={[s.bottomBar, { paddingBottom: insets.bottom + 18, borderTopColor: T.bottomBorder }]}
      >
        <View style={s.totalRow}>
          <Text style={[s.totalLabel, { color: T.textSec }]}>Total today</Text>
          <Text style={[s.totalPrice, { color: T.text }]}>{method === 'moncash' ? `${planPriceHTG} HTG` : displayPrice}</Text>
        </View>
        <TouchableOpacity
          style={[s.payBtn, { backgroundColor: payBtnColor }, (loading || payBtnDisabled) && s.payBtnDisabled]}
          onPress={handlePay}
          disabled={loading || payBtnDisabled}
          activeOpacity={0.87}
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
  scroll: { paddingHorizontal: 16, paddingTop: 18, gap: 12 },

  // Plan card
  planCardInner: { flexDirection: 'row', padding: 18, gap: 12, alignItems: 'flex-start' },
  planLeft: { flex: 1 },
  planBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start', marginBottom: 6 },
  planBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  planName: { fontSize: 20, fontWeight: '800', marginBottom: 2 },
  planSub: { fontSize: 12 },
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

  // Section
  sectionLabel: {
    fontSize: 11, fontWeight: '700', letterSpacing: 0.7,
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 2,
  },

  // Field
  fieldRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12, gap: 12, position: 'relative',
  },
  fieldIconWrap: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  fieldContent: { flex: 1 },
  fieldLabel: { fontSize: 10, fontWeight: '600', marginBottom: 3, letterSpacing: 0.2 },
  fieldInput: { fontSize: 15, fontWeight: '400', padding: 0, margin: 0 },
  focusBar: { position: 'absolute', right: 0, top: 10, bottom: 10, width: 3, borderRadius: 2 },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 62 },

  // Phone
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  countryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 10, paddingHorizontal: 8, paddingVertical: 6,
  },
  countryFlag: { fontSize: 18 },
  countryCodeTxt: { fontSize: 13, fontWeight: '600' },
  phoneInput: { fontSize: 15, padding: 0 },

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
  tabsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
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
  secureRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 4 },
  secureText: { fontSize: 12, lineHeight: 18 },

  // Bottom bar
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 18, paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth, gap: 8, overflow: 'hidden',
  },
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 4,
  },
  totalLabel: { fontSize: 13, fontWeight: '500' },
  totalPrice: { fontSize: 18, fontWeight: '800' },
  payBtn: {
    width: '100%', borderRadius: 50, paddingVertical: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 8,
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
