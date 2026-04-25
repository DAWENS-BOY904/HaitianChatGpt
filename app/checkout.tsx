/**
 * CHECKOUT — Full blur-glass design
 * • Payment method selector: Card | Apple Pay (iOS) | Google Pay (Android)
 * • Card: CardField (stripe-react-native) + cardholder name + card-type detection
 * • Apple Pay → presentApplePay → verify-purchase edge (all in-app)
 * • Google Pay → presentGooglePay → verify-purchase edge (all in-app)
 * • Card → create-checkout-session (payment_sheet) → confirmPayment (all in-app)
 * • MonCash in-app WebView modal for Haiti users
 * • Promo/coupon code with instant validation
 * • 200+ country picker
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
  Modal,
  FlatList,
  Dimensions,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useAuth, useAlert, getSupabaseClient } from '@/template';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FunctionsHttpError } from '@supabase/supabase-js';
import * as Localization from 'expo-localization';
import { useColorScheme } from 'react-native';

// WebView (react-native only)
let WebView: any = null;
try { WebView = require('react-native-webview').WebView; } catch (_e) {}

// Stripe — platform-safe
import {
  useStripe,
  useApplePay,
  useGooglePay,
  StripeProvider,
  CardField,
} from '../utils/stripe-compat';

const { width: SCREEN_W } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────
// COUNTRY DATA
// ─────────────────────────────────────────────────────────
interface Country { code: string; name: string; flag: string; dial: string; }

const COUNTRIES: Country[] = [
  { code: 'AF', name: 'Afghanistan', flag: '🇦🇫', dial: '+93' },
  { code: 'AL', name: 'Albania', flag: '🇦🇱', dial: '+355' },
  { code: 'DZ', name: 'Algeria', flag: '🇩🇿', dial: '+213' },
  { code: 'AR', name: 'Argentina', flag: '🇦🇷', dial: '+54' },
  { code: 'AM', name: 'Armenia', flag: '🇦🇲', dial: '+374' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺', dial: '+61' },
  { code: 'AT', name: 'Austria', flag: '🇦🇹', dial: '+43' },
  { code: 'AZ', name: 'Azerbaijan', flag: '🇦🇿', dial: '+994' },
  { code: 'BS', name: 'Bahamas', flag: '🇧🇸', dial: '+1' },
  { code: 'BD', name: 'Bangladesh', flag: '🇧🇩', dial: '+880' },
  { code: 'BE', name: 'Belgium', flag: '🇧🇪', dial: '+32' },
  { code: 'BO', name: 'Bolivia', flag: '🇧🇴', dial: '+591' },
  { code: 'BR', name: 'Brazil', flag: '🇧🇷', dial: '+55' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦', dial: '+1' },
  { code: 'CL', name: 'Chile', flag: '🇨🇱', dial: '+56' },
  { code: 'CN', name: 'China', flag: '🇨🇳', dial: '+86' },
  { code: 'CO', name: 'Colombia', flag: '🇨🇴', dial: '+57' },
  { code: 'CR', name: 'Costa Rica', flag: '🇨🇷', dial: '+506' },
  { code: 'HR', name: 'Croatia', flag: '🇭🇷', dial: '+385' },
  { code: 'CZ', name: 'Czech Republic', flag: '🇨🇿', dial: '+420' },
  { code: 'DK', name: 'Denmark', flag: '🇩🇰', dial: '+45' },
  { code: 'DO', name: 'Dominican Republic', flag: '🇩🇴', dial: '+1' },
  { code: 'EC', name: 'Ecuador', flag: '🇪🇨', dial: '+593' },
  { code: 'EG', name: 'Egypt', flag: '🇪🇬', dial: '+20' },
  { code: 'EE', name: 'Estonia', flag: '🇪🇪', dial: '+372' },
  { code: 'ET', name: 'Ethiopia', flag: '🇪🇹', dial: '+251' },
  { code: 'FI', name: 'Finland', flag: '🇫🇮', dial: '+358' },
  { code: 'FR', name: 'France', flag: '🇫🇷', dial: '+33' },
  { code: 'GE', name: 'Georgia', flag: '🇬🇪', dial: '+995' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪', dial: '+49' },
  { code: 'GH', name: 'Ghana', flag: '🇬🇭', dial: '+233' },
  { code: 'GR', name: 'Greece', flag: '🇬🇷', dial: '+30' },
  { code: 'GT', name: 'Guatemala', flag: '🇬🇹', dial: '+502' },
  { code: 'HT', name: 'Haiti', flag: '🇭🇹', dial: '+509' },
  { code: 'HN', name: 'Honduras', flag: '🇭🇳', dial: '+504' },
  { code: 'HK', name: 'Hong Kong', flag: '🇭🇰', dial: '+852' },
  { code: 'HU', name: 'Hungary', flag: '🇭🇺', dial: '+36' },
  { code: 'IS', name: 'Iceland', flag: '🇮🇸', dial: '+354' },
  { code: 'IN', name: 'India', flag: '🇮🇳', dial: '+91' },
  { code: 'ID', name: 'Indonesia', flag: '🇮🇩', dial: '+62' },
  { code: 'IE', name: 'Ireland', flag: '🇮🇪', dial: '+353' },
  { code: 'IL', name: 'Israel', flag: '🇮🇱', dial: '+972' },
  { code: 'IT', name: 'Italy', flag: '🇮🇹', dial: '+39' },
  { code: 'JM', name: 'Jamaica', flag: '🇯🇲', dial: '+1' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵', dial: '+81' },
  { code: 'JO', name: 'Jordan', flag: '🇯🇴', dial: '+962' },
  { code: 'KZ', name: 'Kazakhstan', flag: '🇰🇿', dial: '+7' },
  { code: 'KE', name: 'Kenya', flag: '🇰🇪', dial: '+254' },
  { code: 'KW', name: 'Kuwait', flag: '🇰🇼', dial: '+965' },
  { code: 'LV', name: 'Latvia', flag: '🇱🇻', dial: '+371' },
  { code: 'LB', name: 'Lebanon', flag: '🇱🇧', dial: '+961' },
  { code: 'LT', name: 'Lithuania', flag: '🇱🇹', dial: '+370' },
  { code: 'LU', name: 'Luxembourg', flag: '🇱🇺', dial: '+352' },
  { code: 'MY', name: 'Malaysia', flag: '🇲🇾', dial: '+60' },
  { code: 'MX', name: 'Mexico', flag: '🇲🇽', dial: '+52' },
  { code: 'MD', name: 'Moldova', flag: '🇲🇩', dial: '+373' },
  { code: 'MA', name: 'Morocco', flag: '🇲🇦', dial: '+212' },
  { code: 'MM', name: 'Myanmar', flag: '🇲🇲', dial: '+95' },
  { code: 'NA', name: 'Namibia', flag: '🇳🇦', dial: '+264' },
  { code: 'NP', name: 'Nepal', flag: '🇳🇵', dial: '+977' },
  { code: 'NL', name: 'Netherlands', flag: '🇳🇱', dial: '+31' },
  { code: 'NZ', name: 'New Zealand', flag: '🇳🇿', dial: '+64' },
  { code: 'NG', name: 'Nigeria', flag: '🇳🇬', dial: '+234' },
  { code: 'NO', name: 'Norway', flag: '🇳🇴', dial: '+47' },
  { code: 'PK', name: 'Pakistan', flag: '🇵🇰', dial: '+92' },
  { code: 'PA', name: 'Panama', flag: '🇵🇦', dial: '+507' },
  { code: 'PY', name: 'Paraguay', flag: '🇵🇾', dial: '+595' },
  { code: 'PE', name: 'Peru', flag: '🇵🇪', dial: '+51' },
  { code: 'PH', name: 'Philippines', flag: '🇵🇭', dial: '+63' },
  { code: 'PL', name: 'Poland', flag: '🇵🇱', dial: '+48' },
  { code: 'PT', name: 'Portugal', flag: '🇵🇹', dial: '+351' },
  { code: 'QA', name: 'Qatar', flag: '🇶🇦', dial: '+974' },
  { code: 'RO', name: 'Romania', flag: '🇷🇴', dial: '+40' },
  { code: 'RU', name: 'Russia', flag: '🇷🇺', dial: '+7' },
  { code: 'RW', name: 'Rwanda', flag: '🇷🇼', dial: '+250' },
  { code: 'SA', name: 'Saudi Arabia', flag: '🇸🇦', dial: '+966' },
  { code: 'SN', name: 'Senegal', flag: '🇸🇳', dial: '+221' },
  { code: 'RS', name: 'Serbia', flag: '🇷🇸', dial: '+381' },
  { code: 'SG', name: 'Singapore', flag: '🇸🇬', dial: '+65' },
  { code: 'ZA', name: 'South Africa', flag: '🇿🇦', dial: '+27' },
  { code: 'KR', name: 'South Korea', flag: '🇰🇷', dial: '+82' },
  { code: 'ES', name: 'Spain', flag: '🇪🇸', dial: '+34' },
  { code: 'LK', name: 'Sri Lanka', flag: '🇱🇰', dial: '+94' },
  { code: 'SE', name: 'Sweden', flag: '🇸🇪', dial: '+46' },
  { code: 'CH', name: 'Switzerland', flag: '🇨🇭', dial: '+41' },
  { code: 'TW', name: 'Taiwan', flag: '🇹🇼', dial: '+886' },
  { code: 'TZ', name: 'Tanzania', flag: '🇹🇿', dial: '+255' },
  { code: 'TH', name: 'Thailand', flag: '🇹🇭', dial: '+66' },
  { code: 'TN', name: 'Tunisia', flag: '🇹🇳', dial: '+216' },
  { code: 'TR', name: 'Turkey', flag: '🇹🇷', dial: '+90' },
  { code: 'UG', name: 'Uganda', flag: '🇺🇬', dial: '+256' },
  { code: 'UA', name: 'Ukraine', flag: '🇺🇦', dial: '+380' },
  { code: 'AE', name: 'United Arab Emirates', flag: '🇦🇪', dial: '+971' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧', dial: '+44' },
  { code: 'US', name: 'United States', flag: '🇺🇸', dial: '+1' },
  { code: 'UY', name: 'Uruguay', flag: '🇺🇾', dial: '+598' },
  { code: 'UZ', name: 'Uzbekistan', flag: '🇺🇿', dial: '+998' },
  { code: 'VE', name: 'Venezuela', flag: '🇻🇪', dial: '+58' },
  { code: 'VN', name: 'Vietnam', flag: '🇻🇳', dial: '+84' },
  { code: 'YE', name: 'Yemen', flag: '🇾🇪', dial: '+967' },
  { code: 'ZM', name: 'Zambia', flag: '🇿🇲', dial: '+260' },
  { code: 'ZW', name: 'Zimbabwe', flag: '🇿🇼', dial: '+263' },
];

const POPULAR_CODES = ['HT', 'US', 'CA', 'FR', 'GB', 'BR', 'MX', 'DE', 'NG', 'IN'];

function getCountryByCode(code: string): Country | undefined {
  return COUNTRIES.find((c) => c.code === code);
}
function guessCountryFromLocale(): Country {
  try {
    const locale = Localization.locale?.toUpperCase() || '';
    const region = locale.split('_')[1] || locale.split('-')[1] || 'US';
    return getCountryByCode(region) || getCountryByCode('US')!;
  } catch {
    return getCountryByCode('US')!;
  }
}

// ─────────────────────────────────────────────────────────
// CARD TYPE DETECTION
// ─────────────────────────────────────────────────────────
interface CardType {
  name: string;
  icon: string;
  color: string;
  pattern: RegExp;
  lengths: number[];
}

const CARD_TYPES: CardType[] = [
  { name: 'Visa', icon: '💳', color: '#1A1F71', pattern: /^4/, lengths: [13, 16, 19] },
  { name: 'Mastercard', icon: '💳', color: '#EB001B', pattern: /^5[1-5]|^2(?:2[2-9][1-9]|[3-6]\d\d|7[01]\d|720)/, lengths: [16] },
  { name: 'Amex', icon: '💳', color: '#2E77BC', pattern: /^3[47]/, lengths: [15] },
  { name: 'Discover', icon: '💳', color: '#FF6600', pattern: /^6(?:011|22(?:1(?:2[6-9]|[3-9]\d)|[2-8]\d{2}|9(?:[01]\d|2[0-5]))|4[4-9]\d|5\d{2})/, lengths: [16, 17, 18, 19] },
  { name: 'UnionPay', icon: '💳', color: '#E21836', pattern: /^62/, lengths: [16, 17, 18, 19] },
  { name: 'Diners', icon: '💳', color: '#004A97', pattern: /^3(?:0[0-5]|[68])/, lengths: [14] },
];

function detectCardType(number: string): CardType | null {
  const clean = number.replace(/\D/g, '');
  for (const ct of CARD_TYPES) {
    if (ct.pattern.test(clean)) return ct;
  }
  return null;
}

function formatCardNumber(raw: string, cardType: CardType | null): string {
  const digits = raw.replace(/\D/g, '');
  const isAmex = cardType?.name === 'Amex';
  const isDiners = cardType?.name === 'Diners';
  if (isAmex) {
    // 4-6-5
    const p1 = digits.slice(0, 4);
    const p2 = digits.slice(4, 10);
    const p3 = digits.slice(10, 15);
    return [p1, p2, p3].filter(Boolean).join(' ');
  }
  if (isDiners) {
    // 4-6-4
    const p1 = digits.slice(0, 4);
    const p2 = digits.slice(4, 10);
    const p3 = digits.slice(10, 14);
    return [p1, p2, p3].filter(Boolean).join(' ');
  }
  // Default 4-4-4-4
  return digits.match(/.{1,4}/g)?.join(' ') || digits;
}

// ─────────────────────────────────────────────────────────
// PROMO CODES
// ─────────────────────────────────────────────────────────
const PROMO_CODES: Record<string, { discount: number; label: string; couponId: string }> = {
  DAWINIX2026: { discount: 0.20, label: '20% off', couponId: 'ivUqadLE' },
  HAITI50:     { discount: 0.50, label: '50% off', couponId: 'HAITI50' },
  WELCOME10:   { discount: 0.10, label: '10% off', couponId: 'WELCOME10' },
};

// ─────────────────────────────────────────────────────────
// THEME — adapts to system dark/light
// ─────────────────────────────────────────────────────────
function useTheme() {
  const scheme = useColorScheme();
  const dark = scheme !== 'light';
  return {
    dark,
    bg: dark ? '#000000' : '#F2F2F7',
    surface: dark ? '#1C1C1E' : '#FFFFFF',
    surfaceBorder: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
    text: dark ? '#FFFFFF' : '#000000',
    textSec: dark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)',
    textMuted: dark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.3)',
    inputBg: dark ? 'rgba(44,44,46,0.6)' : 'rgba(0,0,0,0.04)',
    inputBorder: dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
    placeholderText: dark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)',
    accent: '#30D158',
    accentLight: 'rgba(48,209,88,0.15)',
    divider: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
    error: '#FF453A',
    success: '#30D158',
    warning: '#FF9F0A',
    searchBg: dark ? 'rgba(44,44,46,0.8)' : 'rgba(0,0,0,0.06)',
    moncash: '#FFD700',
    moncashLight: 'rgba(255,215,0,0.15)',
    blurTint: (dark ? 'dark' : 'light') as 'dark' | 'light',
    apple: dark ? '#FFFFFF' : '#000000',
    google: '#4285F4',
    cardBtnText: dark ? '#000000' : '#FFFFFF',
    cardBtnBg: dark ? '#FFFFFF' : '#000000',
  };
}
// Fallback static T for sub-components that receive T as prop
type ThemeType = ReturnType<typeof useTheme>;
const T_STATIC: ThemeType = {
  dark: true,
  bg: '#000000', surface: '#1C1C1E', surfaceBorder: 'rgba(255,255,255,0.08)',
  text: '#FFFFFF', textSec: 'rgba(255,255,255,0.55)', textMuted: 'rgba(255,255,255,0.35)',
  inputBg: 'rgba(44,44,46,0.6)', inputBorder: 'rgba(255,255,255,0.12)',
  placeholderText: 'rgba(255,255,255,0.3)', accent: '#30D158', accentLight: 'rgba(48,209,88,0.15)',
  divider: 'rgba(255,255,255,0.08)', error: '#FF453A', success: '#30D158', warning: '#FF9F0A',
  searchBg: 'rgba(44,44,46,0.8)', moncash: '#FFD700', moncashLight: 'rgba(255,215,0,0.15)',
  blurTint: 'dark', apple: '#FFFFFF', google: '#4285F4', cardBtnText: '#000000', cardBtnBg: '#FFFFFF',
};
// Use T_STATIC as module-level constant for StyleSheet.create (styles computed at render time per component)
const T = T_STATIC;

// ─────────────────────────────────────────────────────────
// PAYMENT METHOD TYPES
// ─────────────────────────────────────────────────────────
type PaymentMethod = 'card' | 'apple_pay' | 'google_pay' | 'moncash';

// ─────────────────────────────────────────────────────────
// Country Picker Modal
// ─────────────────────────────────────────────────────────
function CountryPickerModal({
  visible, selected, onSelect, onClose,
}: {
  visible: boolean; selected: Country; onSelect: (c: Country) => void; onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const insets = useSafeAreaInsets();
  const popular = POPULAR_CODES.map((c) => getCountryByCode(c)).filter(Boolean) as Country[];
  const filtered = search.trim()
    ? COUNTRIES.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()) || c.dial.includes(search))
    : COUNTRIES;
  const sections = search.trim()
    ? [{ title: `Results (${filtered.length})`, data: filtered }]
    : [{ title: 'Popular', data: popular }, { title: 'All Countries', data: COUNTRIES }];
  type Item = { type: 'header'; title: string } | { type: 'country'; item: Country };
  const flatData: Item[] = [];
  for (const sec of sections) {
    flatData.push({ type: 'header', title: sec.title });
    for (const item of sec.data) flatData.push({ type: 'country', item });
  }
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[cpS.root, { backgroundColor: T.bg }]}>
        <View style={cpS.handleWrap}><View style={[cpS.handle, { backgroundColor: T.textMuted }]} /></View>
        <View style={cpS.titleRow}>
          <Text style={[cpS.title, { color: T.text }]}>Select Country</Text>
          <TouchableOpacity onPress={onClose} style={cpS.closeBtn}>
            <Ionicons name="close" size={22} color={T.textSec} />
          </TouchableOpacity>
        </View>
        <View style={[cpS.searchWrap, { backgroundColor: T.searchBg }]}>
          <Ionicons name="search" size={16} color={T.textSec} />
          <TextInput
            style={[cpS.searchInput, { color: T.text }]}
            value={search}
            onChangeText={setSearch}
            placeholder="Search country..."
            placeholderTextColor={T.placeholderText}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color={T.textSec} />
            </TouchableOpacity>
          )}
        </View>
        <FlatList
          data={flatData}
          keyExtractor={(item, i) => (item.type === 'header' ? `hdr-${i}` : `${item.item.code}-${i}`)}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            if (item.type === 'header') {
              return <Text style={[cpS.sectionHeader, { color: T.textMuted }]}>{item.title.toUpperCase()}</Text>;
            }
            const c = item.item;
            const isSel = c.code === selected.code;
            return (
              <TouchableOpacity
                style={[cpS.countryRow, { borderBottomColor: T.divider }, isSel && { backgroundColor: T.accentLight }]}
                onPress={() => { onSelect(c); onClose(); }}
                activeOpacity={0.7}
              >
                <Text style={cpS.flag}>{c.flag}</Text>
                <View style={cpS.countryInfo}>
                  <Text style={[cpS.countryName, { color: T.text }]} numberOfLines={1}>{c.name}</Text>
                  <Text style={[cpS.dialCode, { color: T.textSec }]}>{c.dial}</Text>
                </View>
                {isSel && <Ionicons name="checkmark" size={18} color={T.accent} />}
              </TouchableOpacity>
            );
          }}
        />
      </View>
    </Modal>
  );
}

const cpS = StyleSheet.create({
  root: { flex: 1 },
  handleWrap: { alignItems: 'center', paddingTop: 10, paddingBottom: 4 },
  handle: { width: 36, height: 4, borderRadius: 2, opacity: 0.35 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 10 },
  title: { fontSize: 18, fontWeight: '700' },
  closeBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 8, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  searchInput: { flex: 1, fontSize: 15, padding: 0, margin: 0 },
  sectionHeader: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 4 },
  countryRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  flag: { fontSize: 22, width: 32, textAlign: 'center' },
  countryInfo: { flex: 1 },
  countryName: { fontSize: 15 },
  dialCode: { fontSize: 13, fontWeight: '600', marginTop: 1 },
});

// ─────────────────────────────────────────────────────────
// MonCash WebView Modal
// ─────────────────────────────────────────────────────────
function MonCashWebViewModal({
  visible, paymentUrl, orderId, onSuccess, onClose, supabase, user, planParam,
}: {
  visible: boolean; paymentUrl: string; orderId: string;
  onSuccess: () => void; onClose: () => void;
  supabase: any; user: any; planParam: string;
}) {
  const insets = useSafeAreaInsets();
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [webViewLoaded, setWebViewLoaded] = useState(false);
  const pollRef = useRef<any>(null);

  const startPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      if (verified) { clearInterval(pollRef.current); return; }
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) return;
        const { data, error } = await supabase.functions.invoke('verify-moncash-payment', {
          body: { orderId },
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!error && data?.status === 'SUCCESSFUL') {
          clearInterval(pollRef.current);
          setVerified(true);
          if (user?.id) {
            const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
            await supabase.from('user_profiles').update({
              subscription_tier: planParam,
              subscription_expires_at: expiresAt,
            }).eq('id', user.id);
          }
          onSuccess();
        }
      } catch (_e) {}
    }, 4000);
  }, [orderId, verified, supabase, user, planParam, onSuccess]);

  useEffect(() => {
    if (visible && webViewLoaded && !verified) startPolling();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [visible, webViewLoaded, verified]);

  useEffect(() => {
    if (!visible) {
      if (pollRef.current) clearInterval(pollRef.current);
      setVerified(false); setWebViewLoaded(false);
    }
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <BlurView intensity={80} tint="dark" style={[mcwS.header, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity onPress={onClose} style={mcwS.closeBtn}>
            <Ionicons name="close" size={22} color="#FFF" />
          </TouchableOpacity>
          <View style={mcwS.headerCenter}>
            <Text style={mcwS.headerTitle}>MonCash Payment</Text>
            {webViewLoaded && !verified && (
              <View style={mcwS.pollingRow}>
                <ActivityIndicator size="small" color={T.moncash} />
                <Text style={mcwS.pollingText}>Checking payment status...</Text>
              </View>
            )}
            {verified && (
              <View style={mcwS.pollingRow}>
                <Ionicons name="checkmark-circle" size={14} color={T.accent} />
                <Text style={[mcwS.pollingText, { color: T.accent }]}>Payment confirmed!</Text>
              </View>
            )}
          </View>
          <View style={{ width: 40 }} />
        </BlurView>
        {Platform.OS !== 'web' && WebView ? (
          <WebView
            source={{ uri: paymentUrl }}
            style={{ flex: 1 }}
            onLoadEnd={() => setWebViewLoaded(true)}
            startInLoadingState
            renderLoading={() => (
              <View style={mcwS.webViewLoading}>
                <ActivityIndicator size="large" color={T.moncash} />
                <Text style={mcwS.webViewLoadingText}>Loading MonCash...</Text>
              </View>
            )}
          />
        ) : (
          <View style={mcwS.webFallback}>
            <Text style={mcwS.webFallbackTitle}>MonCash Payment</Text>
            <Text style={mcwS.webFallbackSub}>WebView only available on iOS/Android.</Text>
          </View>
        )}
        {webViewLoaded && !verified && (
          <BlurView intensity={80} tint="dark" style={[mcwS.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
            <TouchableOpacity
              style={[mcwS.verifyBtn, verifying && { opacity: 0.6 }]}
              onPress={async () => {
                setVerifying(true);
                try {
                  const { data: { session } } = await supabase.auth.getSession();
                  if (!session?.access_token) return;
                  const { data, error } = await supabase.functions.invoke('verify-moncash-payment', {
                    body: { orderId },
                    headers: { Authorization: `Bearer ${session.access_token}` },
                  });
                  if (!error && data?.status === 'SUCCESSFUL') {
                    setVerified(true);
                    if (user?.id) {
                      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
                      await supabase.from('user_profiles').update({
                        subscription_tier: planParam,
                        subscription_expires_at: expiresAt,
                      }).eq('id', user.id);
                    }
                    onSuccess();
                  }
                } finally { setVerifying(false); }
              }}
              disabled={verifying}
              activeOpacity={0.8}
            >
              {verifying ? <ActivityIndicator color="#000" /> : <Text style={mcwS.verifyBtnText}>I Completed Payment</Text>}
            </TouchableOpacity>
            <Text style={mcwS.verifyNote}>Tap after completing. We auto-check every 4 seconds.</Text>
          </BlurView>
        )}
      </View>
    </Modal>
  );
}

const mcwS = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.1)' },
  closeBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  pollingRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  pollingText: { color: 'rgba(255,255,255,0.6)', fontSize: 12 },
  webViewLoading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' },
  webViewLoadingText: { color: '#FFF', marginTop: 12, fontSize: 15 },
  webFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000', padding: 32 },
  webFallbackTitle: { color: '#FFF', fontSize: 20, fontWeight: '700', marginBottom: 8 },
  webFallbackSub: { color: 'rgba(255,255,255,0.5)', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  bottomBar: { paddingHorizontal: 20, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.1)', alignItems: 'center', gap: 10 },
  verifyBtn: { width: '100%', backgroundColor: '#FFD700', borderRadius: 50, paddingVertical: 15, alignItems: 'center', justifyContent: 'center' },
  verifyBtnText: { color: '#000', fontSize: 16, fontWeight: '800' },
  verifyNote: { color: 'rgba(255,255,255,0.4)', fontSize: 11, textAlign: 'center', lineHeight: 16 },
});

// ─────────────────────────────────────────────────────────
// Glass Card wrapper
// ─────────────────────────────────────────────────────────
function GlassCard({ children, style, intensity = 40, borderColor }: {
  children: React.ReactNode; style?: any; intensity?: number; borderColor?: string;
}) {
  return (
    <BlurView intensity={intensity} tint="dark" style={[gcS.card, { borderColor: borderColor || T.surfaceBorder }, style]}>
      {children}
    </BlurView>
  );
}
const gcS = StyleSheet.create({ card: { borderRadius: 18, borderWidth: 1, overflow: 'hidden' } });

// ─────────────────────────────────────────────────────────
// Payment Method Selector
// ─────────────────────────────────────────────────────────
function PaymentMethodSelector({
  selected, onChange, isHaiti,
}: {
  selected: PaymentMethod; onChange: (m: PaymentMethod) => void; isHaiti: boolean;
}) {
  const methods: { id: PaymentMethod; label: string; icon: string; available: boolean; color: string }[] = [
    { id: 'card', label: 'Card', icon: 'card-outline', available: true, color: T.accent },
    {
      id: 'apple_pay',
      label: 'Apple Pay',
      icon: 'logo-apple',
      available: Platform.OS === 'ios',
      color: T.apple,
    },
    {
      id: 'google_pay',
      label: 'Google Pay',
      icon: 'logo-google',
      available: Platform.OS === 'android',
      color: T.google,
    },
    { id: 'moncash', label: 'MonCash', icon: 'phone-portrait-outline', available: isHaiti, color: T.moncash },
  ].filter((m) => m.available);

  return (
    <GlassCard style={{ marginBottom: 20, padding: 4 }} intensity={35}>
      <View style={pmS.row}>
        {methods.map((m) => {
          const isSelected = selected === m.id;
          return (
            <TouchableOpacity
              key={m.id}
              style={[pmS.btn, isSelected && { backgroundColor: m.color + '22', borderColor: m.color + '66', borderWidth: 1.5 }]}
              onPress={() => onChange(m.id)}
              activeOpacity={0.75}
            >
              <Ionicons name={m.icon as any} size={20} color={isSelected ? m.color : T.textSec} />
              <Text style={[pmS.label, { color: isSelected ? m.color : T.textSec }]}>{m.label}</Text>
              {isSelected && (
                <View style={[pmS.dot, { backgroundColor: m.color }]} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </GlassCard>
  );
}

const pmS = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6, padding: 4 },
  btn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    gap: 5,
    borderWidth: 1,
    borderColor: 'transparent',
    position: 'relative',
  },
  label: { fontSize: 11, fontWeight: '600', textAlign: 'center' },
  dot: { position: 'absolute', top: 6, right: 6, width: 6, height: 6, borderRadius: 3 },
});

// ─────────────────────────────────────────────────────────
// Card Form (custom inputs + Stripe CardField)
// ─────────────────────────────────────────────────────────
interface CardDetails {
  complete: boolean;
  brand?: string;
}

function CardForm({
  cardholderName,
  onNameChange,
  onCardChange,
  cardType,
  T: theme,
}: {
  cardholderName: string;
  onNameChange: (v: string) => void;
  onCardChange: (details: CardDetails) => void;
  cardType: CardType | null;
  T: ThemeType;
}) {
  const [nameFocused, setNameFocused] = useState(false);

  return (
    <BlurView intensity={theme.dark ? 40 : 60} tint={theme.blurTint} style={[gcS.card, { borderColor: theme.surfaceBorder, marginBottom: 20, padding: 0, overflow: 'hidden' }]}>
      {/* Card type badge — replaces generic hint when brand detected */}
      {cardType ? (
        <View style={[cfS.cardTypeBadge, { borderBottomColor: theme.divider }]}>
          <Text style={[cfS.cardTypeName, { color: theme.text }]}>{cardType.name}</Text>
          <View style={[cfS.cardTypeBar, { backgroundColor: cardType.color }]} />
        </View>
      ) : (
        <View style={[cfS.cardTypeHint, { borderBottomColor: theme.divider }]}>
          <Text style={[cfS.cardTypeHintText, { color: theme.textMuted }]}>Visa · Mastercard · Amex · Discover · UnionPay</Text>
        </View>
      )}

      {/* Cardholder Name */}
      <View style={[cfS.fieldWrap, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.divider }]}>
        <Ionicons name="person-outline" size={16} color={theme.textSec} />
        <TextInput
          style={[cfS.nameInput, { color: theme.text }]}
          value={cardholderName}
          onChangeText={onNameChange}
          placeholder="Cardholder Name"
          placeholderTextColor={theme.placeholderText}
          autoCapitalize="words"
          autoCorrect={false}
          onFocus={() => setNameFocused(true)}
          onBlur={() => setNameFocused(false)}
        />
        {nameFocused && cardholderName.length > 0 && (
          <Ionicons name="checkmark-circle" size={16} color={theme.accent} />
        )}
      </View>

      {/* Stripe CardField — handles number / expiry / CVV in a single native component */}
      {/* No card icon shown here when cardType is already detected (shown in badge above) */}
      {Platform.OS !== 'web' && CardField ? (
        <View style={cfS.stripeFieldWrap}>
          {!cardType && (
            <Ionicons name="card-outline" size={16} color={theme.textSec} style={cfS.stripeIcon} />
          )}
          <CardField
            postalCodeEnabled={false}
            placeholders={{
              number: '1234 5678 9012 3456',
              expiration: 'MM/YY',
              cvc: 'CVV',
            }}
            cardStyle={{
              backgroundColor: 'transparent',
              textColor: theme.dark ? '#FFFFFF' : '#000000',
              placeholderColor: theme.placeholderText,
              borderColor: 'transparent',
              borderWidth: 0,
              borderRadius: 0,
              fontSize: 15,
            }}
            style={[cfS.cardField, !cardType && { paddingLeft: 0 }]}
            onCardChange={(details: any) => onCardChange(details)}
          />
        </View>
      ) : (
        <View style={cfS.webCardFallback}>
          <Ionicons name="card-outline" size={18} color={theme.textSec} />
          <Text style={[cfS.webCardText, { color: theme.textSec }]}>Card details entered securely via Stripe checkout</Text>
        </View>
      )}

      {/* Secure label */}
      <View style={[cfS.secureRow, { borderTopColor: theme.divider }]}>
        <Ionicons name="lock-closed" size={11} color={theme.textMuted} />
        <Text style={[cfS.secureText, { color: theme.textMuted }]}>Encrypted · Powered by Stripe</Text>
      </View>
    </BlurView>
  );
}

const cfS = StyleSheet.create({
  cardTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.divider,
  },
  cardTypeName: { color: T.text, fontSize: 13, fontWeight: '700' },
  cardTypeBar: { width: 32, height: 4, borderRadius: 2 },
  cardTypeHint: { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.divider },
  cardTypeHintText: { color: T.textMuted, fontSize: 11, fontWeight: '500' },
  fieldWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 14 },
  nameInput: { flex: 1, fontSize: 15, padding: 0, margin: 0 },
  stripeFieldWrap: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6 },
  stripeIcon: { marginRight: 6, marginLeft: 6 },
  cardField: { width: '100%', height: 52 },
  webCardFallback: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 14 },
  webCardText: { color: T.textSec, fontSize: 14, flex: 1 },
  secureRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.divider },
  secureText: { color: T.textMuted, fontSize: 11 },
});

// ─────────────────────────────────────────────────────────
// Apple Pay Panel
// ─────────────────────────────────────────────────────────
function ApplePayPanel({ onPress, loading, amount }: { onPress: () => void; loading: boolean; amount: string }) {
  return (
    <GlassCard style={{ marginBottom: 20, padding: 18 }} intensity={40} borderColor="rgba(255,255,255,0.15)">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <View style={apS.iconWrap}>
          <Ionicons name="logo-apple" size={24} color="#FFF" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={apS.title}>Apple Pay</Text>
          <Text style={apS.sub}>Touch ID or Face ID — no card entry needed</Text>
        </View>
      </View>
      <TouchableOpacity
        style={[apS.btn, loading && { opacity: 0.6 }]}
        onPress={onPress}
        disabled={loading}
        activeOpacity={0.85}
      >
        {loading ? (
          <ActivityIndicator color="#000" />
        ) : (
          <View style={apS.btnRow}>
            <Ionicons name="logo-apple" size={20} color="#000" />
            <Text style={apS.btnText}>Pay with Apple Pay — {amount}</Text>
          </View>
        )}
      </TouchableOpacity>
      <Text style={apS.note}>Payment is authorized via Face ID / Touch ID on your device.</Text>
    </GlassCard>
  );
}

const apS = StyleSheet.create({
  iconWrap: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#333', alignItems: 'center', justifyContent: 'center' },
  title: { color: T.text, fontSize: 17, fontWeight: '700' },
  sub: { color: T.textSec, fontSize: 12, marginTop: 2 },
  btn: { backgroundColor: '#FFFFFF', borderRadius: 14, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnText: { color: '#000', fontSize: 15, fontWeight: '800' },
  note: { color: T.textMuted, fontSize: 11, textAlign: 'center', marginTop: 10, lineHeight: 16 },
});

// ─────────────────────────────────────────────────────────
// Google Pay Panel
// ─────────────────────────────────────────────────────────
function GooglePayPanel({ onPress, loading, amount }: { onPress: () => void; loading: boolean; amount: string }) {
  return (
    <GlassCard style={{ marginBottom: 20, padding: 18 }} intensity={40} borderColor="rgba(66,133,244,0.25)">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <View style={gpS.iconWrap}>
          <Ionicons name="logo-google" size={22} color={T.google} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={gpS.title}>Google Pay</Text>
          <Text style={gpS.sub}>Quick and secure — no card entry needed</Text>
        </View>
      </View>
      <TouchableOpacity
        style={[gpS.btn, loading && { opacity: 0.6 }]}
        onPress={onPress}
        disabled={loading}
        activeOpacity={0.85}
      >
        {loading ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <View style={gpS.btnRow}>
            <Ionicons name="logo-google" size={18} color="#FFF" />
            <Text style={gpS.btnText}>Pay with Google Pay — {amount}</Text>
          </View>
        )}
      </TouchableOpacity>
      <Text style={gpS.note}>Authorized via your Google account on this device.</Text>
    </GlassCard>
  );
}

const gpS = StyleSheet.create({
  iconWrap: { width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(66,133,244,0.15)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(66,133,244,0.3)' },
  title: { color: T.text, fontSize: 17, fontWeight: '700' },
  sub: { color: T.textSec, fontSize: 12, marginTop: 2 },
  btn: { backgroundColor: T.google, borderRadius: 14, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnText: { color: '#FFF', fontSize: 15, fontWeight: '800' },
  note: { color: T.textMuted, fontSize: 11, textAlign: 'center', marginTop: 10, lineHeight: 16 },
});

// ─────────────────────────────────────────────────────────
// MonCash Panel
// ─────────────────────────────────────────────────────────
function MonCashPanel({ onPress, loading, amount }: { onPress: () => void; loading: boolean; amount: string }) {
  return (
    <GlassCard style={{ marginBottom: 20, overflow: 'hidden' }} intensity={45} borderColor="rgba(255,215,0,0.3)">
      <View style={mcS.topBand}>
        <Text style={mcS.topBandText}>🇭🇹 Available for Haiti</Text>
      </View>
      <View style={mcS.body}>
        <View style={mcS.logoRow}>
          <View style={mcS.logoCircle}><Text style={{ fontSize: 24 }}>📱</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={mcS.title}>Pay with MonCash</Text>
            <Text style={mcS.sub}>Digicel Haiti mobile money — pay in-app</Text>
          </View>
        </View>
        <TouchableOpacity
          style={[mcS.payBtn, loading && { opacity: 0.6 }]}
          onPress={onPress}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? <ActivityIndicator color="#000" /> : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 18 }}>📱</Text>
              <Text style={mcS.payBtnText}>Pay with MonCash — {amount}</Text>
            </View>
          )}
        </TouchableOpacity>
        <Text style={mcS.note}>Payment opens in-app. No external browser needed.</Text>
      </View>
    </GlassCard>
  );
}

const mcS = StyleSheet.create({
  topBand: { backgroundColor: 'rgba(255,215,0,0.12)', paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,215,0,0.2)' },
  topBandText: { color: T.moncash, fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
  body: { padding: 16 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 },
  logoCircle: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,215,0,0.15)', borderWidth: 1, borderColor: 'rgba(255,215,0,0.3)', alignItems: 'center', justifyContent: 'center' },
  title: { color: T.text, fontSize: 17, fontWeight: '700', marginBottom: 3 },
  sub: { color: T.textSec, fontSize: 12, lineHeight: 17 },
  payBtn: { backgroundColor: '#FFD700', borderRadius: 14, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  payBtnText: { color: '#000', fontSize: 15, fontWeight: '800' },
  note: { color: T.textMuted, fontSize: 11, textAlign: 'center', marginTop: 10 },
});

// ─────────────────────────────────────────────────────────
// Promo Code Input
// ─────────────────────────────────────────────────────────
function PromoCodeInput({ code, setCode, onApply, applying, applied, promoError, promoDiscount }: {
  code: string; setCode: (v: string) => void; onApply: () => void; applying: boolean;
  applied: boolean; promoError: string; promoDiscount: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={prS.container}>
      <Text style={[prS.label, { color: T.text }]}>Promo Code</Text>
      <BlurView intensity={30} tint="dark" style={[prS.inputWrap, {
        borderColor: applied ? T.accent : focused ? T.accent : promoError ? T.error : T.inputBorder,
        borderWidth: applied || promoError ? 1.5 : focused ? 1.5 : 1,
      }]}>
        <Ionicons name="pricetag-outline" size={16} color={applied ? T.accent : T.textSec} style={{ marginRight: 8 }} />
        <TextInput
          style={[prS.input, { color: T.text }]}
          value={code}
          onChangeText={(t) => setCode(t.toUpperCase())}
          placeholder="e.g. DAWINIX2026"
          placeholderTextColor={T.placeholderText}
          autoCapitalize="characters"
          autoCorrect={false}
          editable={!applied}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {applied ? (
          <Ionicons name="checkmark-circle" size={18} color={T.accent} />
        ) : (
          <TouchableOpacity
            style={[prS.applyBtn, { backgroundColor: code.trim().length > 0 ? T.accent : 'rgba(255,255,255,0.1)' }]}
            onPress={onApply}
            disabled={applying || code.trim().length === 0}
            activeOpacity={0.8}
          >
            {applying ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={prS.applyText}>Apply</Text>}
          </TouchableOpacity>
        )}
      </BlurView>
      {applied && promoDiscount ? (
        <View style={prS.successRow}>
          <Ionicons name="checkmark-circle" size={14} color={T.accent} />
          <Text style={[prS.successText, { color: T.accent }]}>{promoDiscount} applied!</Text>
        </View>
      ) : null}
      {promoError ? (
        <View style={prS.errorRow}>
          <Ionicons name="close-circle" size={14} color={T.error} />
          <Text style={[prS.errorText, { color: T.error }]}>{promoError}</Text>
        </View>
      ) : null}
    </View>
  );
}

const prS = StyleSheet.create({
  container: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, overflow: 'hidden' },
  input: { flex: 1, fontSize: 15, padding: 0, margin: 0, letterSpacing: 1 },
  applyBtn: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, minWidth: 64, alignItems: 'center', justifyContent: 'center' },
  applyText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  successRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6, paddingLeft: 4 },
  successText: { fontSize: 13, fontWeight: '600' },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6, paddingLeft: 4 },
  errorText: { fontSize: 13, fontWeight: '500' },
});

// ─────────────────────────────────────────────────────────
// Plan Summary Card
// ─────────────────────────────────────────────────────────
function PlanSummaryCard({ planName, price, discountedPrice, discountLabel }: {
  planName: string; price: string; discountedPrice?: string; discountLabel?: string;
}) {
  const isPlus = planName.toLowerCase().includes('plus');
  const accentColor = isPlus ? '#6B5CE7' : '#30D158';
  const features = isPlus
    ? ['Advanced AI models', 'Unlimited smart messages', '20 image/file uploads', 'Agents & deep research', 'Early access to features']
    : ['More daily messages', '10 image/file uploads', 'Group chat creation', 'Extended memory'];
  return (
    <GlassCard style={{ marginBottom: 20, padding: 18 }} intensity={50} borderColor={accentColor + '33'}>
      <View style={psS.header}>
        <View style={[psS.badge, { backgroundColor: accentColor + '22', borderColor: accentColor + '55' }]}>
          <Text style={[psS.badgeText, { color: accentColor }]}>{isPlus ? '✨ PLUS' : '⚡ GO'}</Text>
        </View>
        <View style={psS.priceWrap}>
          {discountedPrice ? (
            <>
              <Text style={[psS.priceOld, { color: T.textMuted }]}>{price}</Text>
              <Text style={[psS.price, { color: accentColor }]}>{discountedPrice}</Text>
            </>
          ) : (
            <Text style={[psS.price, { color: accentColor }]}>{price}</Text>
          )}
          <Text style={[psS.period, { color: T.textSec }]}>/mo</Text>
        </View>
      </View>
      {discountLabel ? (
        <View style={[psS.discountBadge, { backgroundColor: T.accent + '20', borderColor: T.accent + '40' }]}>
          <Ionicons name="pricetag" size={12} color={T.accent} />
          <Text style={[psS.discountText, { color: T.accent }]}>{discountLabel} promo applied</Text>
        </View>
      ) : null}
      <View style={[psS.divider, { backgroundColor: T.divider }]} />
      <Text style={[psS.featuresTitle, { color: T.textSec }]}>Includes:</Text>
      {features.map((f) => (
        <View key={f} style={psS.featureRow}>
          <Ionicons name="checkmark-circle" size={15} color={accentColor} />
          <Text style={[psS.featureText, { color: T.text }]}>{f}</Text>
        </View>
      ))}
      <View style={[psS.totalRow, { borderTopColor: T.divider }]}>
        <Text style={[psS.totalLabel, { color: T.textSec }]}>Billed monthly · auto-cancels when expired</Text>
        <Text style={[psS.totalAmount, { color: accentColor }]}>{discountedPrice || price}/mo</Text>
      </View>
    </GlassCard>
  );
}

const psS = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  badge: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1 },
  badgeText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  priceWrap: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  priceOld: { fontSize: 14, fontWeight: '500', textDecorationLine: 'line-through' },
  price: { fontSize: 26, fontWeight: '800' },
  period: { fontSize: 13, fontWeight: '500' },
  discountBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, marginBottom: 12, alignSelf: 'flex-start' },
  discountText: { fontSize: 12, fontWeight: '700' },
  divider: { height: StyleSheet.hairlineWidth, marginBottom: 12 },
  featuresTitle: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 7 },
  featureText: { fontSize: 14 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  totalLabel: { fontSize: 11, flex: 1 },
  totalAmount: { fontSize: 16, fontWeight: '700' },
});

// ─────────────────────────────────────────────────────────
// Stripe Publishable Key
// ─────────────────────────────────────────────────────────
const STRIPE_PUBLISHABLE_KEY = 'pk_live_51SjmgDE0VkO7z1VnJb4RdkCuQ3r3RMaiBM6ZXlzgmLa7DqHRlCa1oWNLIpxZCWPiMf1dG6gCrLePEb73cGE5u7N00MFupmAKK';

// ─────────────────────────────────────────────────────────
// Inner Checkout
// ─────────────────────────────────────────────────────────
function CheckoutInner() {
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const supabase = getSupabaseClient();

  // Stripe hooks (native only — web stubs return null)
  const stripeHook = useStripe();
  const applePayHook = useApplePay ? useApplePay() : null;
  const googlePayHook = useGooglePay ? useGooglePay() : null;

  const confirmPayment = Platform.OS !== 'web' ? stripeHook?.confirmPayment : null;

  // Theme
  const T = useTheme();

  // Plan params
  const params = useLocalSearchParams<{ plan?: string; priceId?: string; price?: string; name?: string }>();
  const planParam = (params.plan as string) || 'plus';
  const priceIdParam = (params.priceId as string) || 'price_1TPUrzE0VkO7z1Vnlgj45978';
  const priceParam = (params.price as string) || '19.99';
  const planDisplayName = (params.name as string) || 'Dawinix Plus';

  // Payment method selection
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');

  // Card details
  const [cardholderName, setCardholderName] = useState(user?.username || '');
  const [cardDetails, setCardDetails] = useState<CardDetails>({ complete: false });
  const [cardType, setCardType] = useState<CardType | null>(null);

  // Billing
  const [billingEmail, setBillingEmail] = useState(user?.email || '');
  const [billingUsername, setBillingUsername] = useState(user?.username || user?.email?.split('@')[0] || '');
  const [phoneNumber, setPhoneNumber] = useState('');

  // Country / phone
  const [country, setCountry] = useState<Country>(() => guessCountryFromLocale());
  const [showCountryPicker, setShowCountryPicker] = useState(false);

  // Promo
  const [promoCode, setPromoCode] = useState('');
  const [applyingPromo, setApplyingPromo] = useState(false);
  const [promoApplied, setPromoApplied] = useState(false);
  const [promoError, setPromoError] = useState('');
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [promoLabel, setPromoLabel] = useState('');
  const [promoCouponId, setPromoCouponId] = useState('');

  // Loading
  const [loading, setLoading] = useState(false);
  const [moncashLoading, setMoncashLoading] = useState(false);
  const [applePayLoading, setApplePayLoading] = useState(false);
  const [googlePayLoading, setGooglePayLoading] = useState(false);

  // MonCash WebView
  const [showMonCashWebView, setShowMonCashWebView] = useState(false);
  const [moncashPaymentUrl, setMoncashPaymentUrl] = useState('');
  const [moncashOrderId, setMoncashOrderId] = useState('');

  const isHaiti = country.code === 'HT';
  const basePrice = parseFloat(priceParam) || 19.99;
  const finalPrice = promoApplied ? basePrice * (1 - promoDiscount) : basePrice;
  const displayBasePrice = `$${basePrice.toFixed(2)}`;
  const displayFinalPrice = promoApplied ? `$${finalPrice.toFixed(2)}` : undefined;
  const moncashAmount = planParam === 'plus' ? '2,650 HTG' : '1,060 HTG';
  const moncashAmountNum = planParam === 'plus' ? 2650 : 1060;

  // ── Apply promo ──
  const handleApplyPromo = useCallback(async () => {
    if (!promoCode.trim()) return;
    setApplyingPromo(true);
    setPromoError('');
    setPromoApplied(false);
    await new Promise((r) => setTimeout(r, 600));
    const entry = PROMO_CODES[promoCode.trim().toUpperCase()];
    if (entry) {
      setPromoDiscount(entry.discount);
      setPromoLabel(entry.label);
      setPromoCouponId(entry.couponId);
      setPromoApplied(true);
    } else {
      setPromoError('Invalid promo code. Try DAWINIX2026 for 20% off.');
    }
    setApplyingPromo(false);
  }, [promoCode]);

  // ── Sync subscription after payment ──
  const syncSubscription = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      const { data } = await supabase.functions.invoke('check-subscription', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const expiresAt = data?.subscription_end
        ? new Date(data.subscription_end).toISOString()
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      await supabase.from('user_profiles').update({
        subscription_tier: planParam,
        subscription_expires_at: expiresAt,
      }).eq('id', user.id);
    } catch (e) { console.log('[checkout] sync error:', e); }
  }, [user, supabase, planParam]);

  // ── Get client secret from edge function ──
  const getClientSecret = useCallback(async (): Promise<string> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Not authenticated');
    const body: any = { plan: planParam, priceId: priceIdParam, mode: 'payment_sheet' };
    if (promoApplied && promoCouponId) body.couponId = promoCouponId;
    const { data, error } = await supabase.functions.invoke('create-checkout-session', {
      body,
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (error) {
      let msg = error.message;
      if (error instanceof FunctionsHttpError) { try { msg = await error.context?.text() || msg; } catch (_e) {} }
      throw new Error(msg);
    }
    if (!data?.clientSecret) throw new Error('No payment secret returned. Please try again.');
    return data.clientSecret;
  }, [supabase, planParam, priceIdParam, promoApplied, promoCouponId]);

  // ── Call verify-purchase edge ──
  const verifyAndSyncPurchase = useCallback(async (platform: 'apple' | 'google', transactionData: any) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Not authenticated');
    const { data, error } = await supabase.functions.invoke('verify-purchase', {
      body: {
        platform,
        ...transactionData,
        productId: planParam === 'plus' ? 'com.dawinix.plus.monthly' : 'com.dawinix.go.monthly2',
        isSandbox: __DEV__,
      },
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (error) {
      let msg = error.message;
      if (error instanceof FunctionsHttpError) { try { msg = await error.context?.text() || msg; } catch (_e) {} }
      throw new Error(msg);
    }
    if (user?.id) {
      const expiresAt = data?.subscription?.expiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      await supabase.from('user_profiles').update({
        subscription_tier: planParam,
        subscription_expires_at: expiresAt,
      }).eq('id', user.id);
    }
    return data;
  }, [supabase, planParam, user]);

  // ── Apple Pay ──
  const handleApplePay = async () => {
    if (applePayLoading || Platform.OS !== 'ios' || !applePayHook?.presentApplePay) {
      showAlert('Apple Pay', 'Apple Pay is only available on iPhone.');
      return;
    }
    setApplePayLoading(true);
    try {
      const clientSecret = await getClientSecret();
      const { error } = await applePayHook.presentApplePay({
        cartItems: [{ label: planDisplayName, amount: `${finalPrice.toFixed(2)}`, paymentType: 'Immediate' }],
        country: 'US',
        currency: 'USD',
        shippingMethods: [],
        requiredShippingAddressFields: [],
        requiredBillingContactFields: ['emailAddress'],
      });
      if (error) {
        if (error.code === 'Canceled') return;
        throw new Error(error.message);
      }
      // Confirm payment
      if (applePayHook.confirmApplePayPayment) {
        const { error: confirmError } = await applePayHook.confirmApplePayPayment(clientSecret);
        if (confirmError) throw new Error(confirmError.message);
      }
      await syncSubscription();
      showAlert('Payment Successful!', `Your ${planDisplayName} plan is now active via Apple Pay.`);
      router.replace('/subscription-success');
    } catch (err: any) {
      showAlert('Apple Pay Failed', err?.message || 'Payment failed. Please try again.');
    } finally {
      setApplePayLoading(false);
    }
  };

  // ── Google Pay ──
  const handleGooglePay = async () => {
    if (googlePayLoading || Platform.OS !== 'android' || !googlePayHook?.presentGooglePay) {
      showAlert('Google Pay', 'Google Pay is only available on Android.');
      return;
    }
    setGooglePayLoading(true);
    try {
      const supported = await googlePayHook.isGooglePaySupported({ testEnv: __DEV__ });
      if (!supported) throw new Error('Google Pay is not available on this device.');
      const clientSecret = await getClientSecret();
      const { error } = await googlePayHook.presentGooglePay({
        clientSecret,
        forSetupIntent: false,
        currencyCode: 'USD',
        countryCode: 'US',
        merchantName: 'Dawinix',
        billingAddressConfig: { format: 'MIN', isPhoneNumberRequired: false, isRequired: false },
      });
      if (error) {
        if (error.code === 'Canceled') return;
        throw new Error(error.message);
      }
      await syncSubscription();
      showAlert('Payment Successful!', `Your ${planDisplayName} plan is now active via Google Pay.`);
      router.replace('/subscription-success');
    } catch (err: any) {
      showAlert('Google Pay Failed', err?.message || 'Payment failed. Please try again.');
    } finally {
      setGooglePayLoading(false);
    }
  };

  // ── Card payment ──
  const handleCardPay = async () => {
    if (loading) return;
    if (!cardholderName.trim()) {
      showAlert('Missing Name', 'Please enter the cardholder name.');
      return;
    }
    if (Platform.OS !== 'web' && !cardDetails.complete) {
      showAlert('Incomplete Card', 'Please fill in all card details (number, expiry, CVV).');
      return;
    }
    setLoading(true);
    try {
      const clientSecret = await getClientSecret();
      if (Platform.OS === 'web' || !confirmPayment) {
        // Web fallback: open hosted checkout
        const { data: { session } } = await supabase.auth.getSession();
        const body: any = { plan: planParam, priceId: priceIdParam };
        if (promoApplied && promoCouponId) body.couponId = promoCouponId;
        const { data, error } = await supabase.functions.invoke('create-checkout-session', {
          body,
          headers: { Authorization: `Bearer ${session?.access_token}` },
        });
        if (error) throw new Error(error.message);
        if (!data?.url) throw new Error('No checkout URL');
        const { Linking } = require('react-native');
        await Linking.openURL(data.url);
        return;
      }
      // Native: confirmPayment with card details
      const { error: payError } = await confirmPayment(clientSecret, {
        paymentMethodType: 'Card',
        paymentMethodData: {
          billingDetails: {
            name: cardholderName,
            email: billingEmail,
          },
        },
      });
      if (payError) {
        if (payError.code === 'Canceled') return;
        throw new Error(payError.message);
      }
      await syncSubscription();
      showAlert('Payment Successful!', `Your ${planDisplayName} plan is now active.`);
      router.replace('/subscription-success');
    } catch (err: any) {
      showAlert('Payment Failed', err?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── MonCash ──
  const handleMonCashPay = async () => {
    if (moncashLoading) return;
    setMoncashLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: { plan: planParam, mode: 'moncash', amount: moncashAmountNum },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) {
        let msg = error.message;
        if (error instanceof FunctionsHttpError) { try { msg = await error.context?.text() || msg; } catch (_e) {} }
        throw new Error(msg);
      }
      if (!data?.paymentUrl) throw new Error('No MonCash payment URL returned');
      setMoncashPaymentUrl(data.paymentUrl);
      setMoncashOrderId(data.orderId || '');
      setShowMonCashWebView(true);
    } catch (err: any) {
      showAlert('MonCash Error', err?.message || 'Could not initiate MonCash payment.');
    } finally {
      setMoncashLoading(false);
    }
  };

  const handleMonCashSuccess = useCallback(async () => {
    setShowMonCashWebView(false);
    showAlert('Payment Confirmed!', `Your ${planDisplayName} plan via MonCash is now active.`);
    router.replace('/subscription-success');
  }, [planDisplayName, showAlert, router]);

  const isAnyLoading = loading || applePayLoading || googlePayLoading || moncashLoading;

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <StatusBar barStyle="light-content" />
      <View style={s.blob1} />
      <View style={s.blob2} />

      <CountryPickerModal
        visible={showCountryPicker}
        selected={country}
        onSelect={setCountry}
        onClose={() => setShowCountryPicker(false)}
      />

      <MonCashWebViewModal
        visible={showMonCashWebView}
        paymentUrl={moncashPaymentUrl}
        orderId={moncashOrderId}
        onSuccess={handleMonCashSuccess}
        onClose={() => setShowMonCashWebView(false)}
        supabase={supabase}
        user={user}
        planParam={planParam}
      />

      {/* Header */}
      <BlurView intensity={60} tint="dark" style={[s.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color={T.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: T.text }]}>{planDisplayName}</Text>
        <View style={s.securityPill}>
          <Ionicons name="lock-closed" size={11} color={T.accent} />
          <Text style={s.securityPillText}>Secure</Text>
        </View>
      </BlurView>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 120 }]}
          keyboardShouldPersistTaps="handled"
        >
          {/* Plan Summary */}
          <PlanSummaryCard
            planName={planDisplayName}
            price={displayBasePrice}
            discountedPrice={displayFinalPrice}
            discountLabel={promoApplied ? promoLabel : undefined}
          />

          {/* Payment Method Selector */}
          <Text style={[s.sectionTitle, { color: T.text }]}>Payment Method</Text>
          <PaymentMethodSelector
            selected={paymentMethod}
            onChange={setPaymentMethod}
            isHaiti={isHaiti}
          />

          {/* Payment method specific UI */}
          {paymentMethod === 'card' && (
            <>
              <Text style={[s.sectionTitle, { color: T.text }]}>Card Details</Text>
              <CardForm
                cardholderName={cardholderName}
                onNameChange={setCardholderName}
                onCardChange={(details) => {
                  setCardDetails(details);
                  if (details.brand) {
                    const ct = detectCardType(details.brand || '');
                    setCardType(ct);
                  }
                }}
                cardType={cardType}
                T={T}
              />
            </>
          )}

          {paymentMethod === 'apple_pay' && (
            <ApplePayPanel
              onPress={handleApplePay}
              loading={applePayLoading}
              amount={displayFinalPrice || displayBasePrice}
            />
          )}

          {paymentMethod === 'google_pay' && (
            <GooglePayPanel
              onPress={handleGooglePay}
              loading={googlePayLoading}
              amount={displayFinalPrice || displayBasePrice}
            />
          )}

          {paymentMethod === 'moncash' && (
            <MonCashPanel
              onPress={handleMonCashPay}
              loading={moncashLoading}
              amount={moncashAmount}
            />
          )}

          {/* Promo Code */}
          <PromoCodeInput
            code={promoCode}
            setCode={(v) => {
              setPromoCode(v);
              if (promoApplied) {
                setPromoApplied(false); setPromoDiscount(0); setPromoLabel(''); setPromoCouponId('');
              }
              setPromoError('');
            }}
            onApply={handleApplyPromo}
            applying={applyingPromo}
            applied={promoApplied}
            promoError={promoError}
            promoDiscount={promoLabel}
          />

          {/* Billing */}
          <Text style={[s.sectionTitle, { color: T.text }]}>Billing Information</Text>

          {/* Username */}
          <View style={s.billingFieldWrap}>
            <Text style={[s.billingLabel, { color: T.text }]}>Username</Text>
            <BlurView intensity={T.dark ? 30 : 50} tint={T.blurTint} style={[s.billingInputBlur, { borderColor: T.inputBorder }]}>
              <Ionicons name="person-outline" size={16} color={T.textSec} />
              <TextInput
                style={[s.billingInput, { color: T.text }]}
                value={billingUsername}
                onChangeText={setBillingUsername}
                placeholder="Username"
                placeholderTextColor={T.placeholderText}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </BlurView>
          </View>

          {/* Email */}
          <View style={s.billingFieldWrap}>
            <Text style={[s.billingLabel, { color: T.text }]}>Email</Text>
            <BlurView intensity={T.dark ? 30 : 50} tint={T.blurTint} style={[s.billingInputBlur, { borderColor: T.inputBorder }]}>
              <Ionicons name="mail-outline" size={16} color={T.textSec} />
              <TextInput
                style={[s.billingInput, { color: T.text }]}
                value={billingEmail}
                onChangeText={setBillingEmail}
                placeholder="your@email.com"
                placeholderTextColor={T.placeholderText}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </BlurView>
          </View>

          {/* Phone */}
          <View style={s.billingFieldWrap}>
            <Text style={[s.billingLabel, { color: T.text }]}>Phone (optional)</Text>
            <BlurView intensity={T.dark ? 30 : 50} tint={T.blurTint} style={[s.billingInputBlur, { borderColor: T.inputBorder }]}>
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 10 }}
                onPress={() => setShowCountryPicker(true)}
                activeOpacity={0.8}
              >
                <Text style={{ fontSize: 18 }}>{country.flag}</Text>
                <Text style={[{ fontSize: 13, color: T.textSec, fontWeight: '600' }]}>{country.dial}</Text>
                <Ionicons name="chevron-down" size={14} color={T.textSec} />
              </TouchableOpacity>
              <View style={[{ width: StyleSheet.hairlineWidth, height: 20, backgroundColor: T.divider }]} />
              <TextInput
                style={[s.billingInput, { color: T.text, marginLeft: 8 }]}
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                placeholder="Phone number"
                placeholderTextColor={T.placeholderText}
                keyboardType="phone-pad"
                autoCorrect={false}
              />
            </BlurView>
          </View>

          {/* Country */}
          <View style={s.billingFieldWrap}>
            <Text style={[s.billingLabel, { color: T.text }]}>Country</Text>
            <BlurView intensity={T.dark ? 30 : 50} tint={T.blurTint} style={[s.billingInputBlur, { borderColor: T.inputBorder }]}>
              <TouchableOpacity style={s.countryInner} onPress={() => setShowCountryPicker(true)} activeOpacity={0.8}>
                <Text style={{ fontSize: 20 }}>{country.flag}</Text>
                <Text style={[{ flex: 1, fontSize: 15, color: T.text, marginLeft: 10 }]}>{country.name}</Text>
                <Ionicons name="chevron-down" size={18} color={T.textSec} />
              </TouchableOpacity>
            </BlurView>
          </View>

          {/* Cancel notice */}
          <View style={s.cancelNotice}>
            <Ionicons name="information-circle-outline" size={15} color={T.textMuted} />
            <Text style={[s.cancelText, { color: T.textMuted }]}>
              Subscription auto-cancels when the billing period ends. No hidden charges.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Bottom bar — only shown for Card method */}
      {paymentMethod === 'card' && (
        <BlurView intensity={80} tint={T.blurTint} style={[s.bottomBar, { paddingBottom: insets.bottom + 16, borderTopColor: T.divider }]}>
          <View style={s.totalRow}>
            <Text style={[s.totalLabel, { color: T.textSec }]}>Total due today</Text>
            <View style={s.totalPriceRow}>
              {promoApplied && <Text style={[s.totalOld, { color: T.textMuted }]}>{displayBasePrice}</Text>}
              <Text style={[s.totalPrice, { color: T.accent }]}>{displayFinalPrice || displayBasePrice}/mo</Text>
            </View>
          </View>
          <TouchableOpacity
            style={[s.payBtn, { backgroundColor: T.dark ? T.accent : T.accent }, isAnyLoading && s.payBtnDisabled]}
            onPress={handleCardPay}
            disabled={isAnyLoading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <View style={s.payBtnRow}>
                <Ionicons name="card-outline" size={18} color="#FFF" />
                <Text style={[s.payBtnText, { color: '#FFF' }]}>
                  Pay with Card — {displayFinalPrice || displayBasePrice}/mo
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </BlurView>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────
// Root: wrap with StripeProvider on native
// ─────────────────────────────────────────────────────────
export default function CheckoutScreen() {
  if (Platform.OS === 'web') {
    return <CheckoutInner />;
  }
  return (
    <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY} merchantIdentifier="merchant.com.dawinix">
      <CheckoutInner />
    </StripeProvider>
  );
}

// ─────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────
const s = StyleSheet.create({
  blob1: { position: 'absolute', width: 300, height: 300, borderRadius: 150, backgroundColor: 'rgba(48,209,88,0.06)', top: -80, left: -60 },
  blob2: { position: 'absolute', width: 250, height: 250, borderRadius: 125, backgroundColor: 'rgba(107,92,231,0.06)', bottom: 140, right: -80 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(128,128,128,0.2)',
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', flex: 1, textAlign: 'center' },
  securityPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(48,209,88,0.12)', borderRadius: 12,
    paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: 'rgba(48,209,88,0.25)',
  },
  securityPillText: { color: T.accent, fontSize: 11, fontWeight: '700' },
  scroll: { paddingHorizontal: 16, paddingTop: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  billingFieldWrap: { marginBottom: 14 },
  billingLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  billingInputBlur: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 4, overflow: 'hidden', gap: 8 },
  billingInput: { flex: 1, fontSize: 15, padding: 0, margin: 0, paddingVertical: 10 },
  countryInner: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  cancelNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 8, marginBottom: 8, paddingHorizontal: 4 },
  cancelText: { flex: 1, fontSize: 12, lineHeight: 18 },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 16, paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.divider,
    gap: 8,
  },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 13, fontWeight: '500' },
  totalPriceRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  totalOld: { fontSize: 13, fontWeight: '500', textDecorationLine: 'line-through' },
  totalPrice: { fontSize: 17, fontWeight: '700' },
  payBtn: { width: '100%', borderRadius: 50, paddingVertical: 15, alignItems: 'center', justifyContent: 'center' },
  payBtnRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  payBtnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  payBtnDisabled: { opacity: 0.5 },
});
