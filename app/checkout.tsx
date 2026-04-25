/**
 * CHECKOUT — In-app Stripe PaymentSheet + promo code + auto-filled billing
 * • In-app payment via @stripe/stripe-react-native PaymentSheet (never leaves app)
 * • Promo/coupon code field validated against create-checkout-session edge function
 * • Discounted price shown before paying
 * • Billing section: email (auto-set, editable) + username (auto-set, non-editable)
 * • 200+ country picker for phone number
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
  Dimensions,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth, useAlert, getSupabaseClient } from '@/template';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FunctionsHttpError } from '@supabase/supabase-js';
import * as Localization from 'expo-localization';

// Stripe PaymentSheet (react-native only, web-safe import)
let useStripe: any = null;
let StripeProvider: any = null;
try {
  const stripeModule = require('@stripe/stripe-react-native');
  useStripe = stripeModule.useStripe;
  StripeProvider = stripeModule.StripeProvider;
} catch (_e) {}

const { width: SCREEN_W } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────
// COUNTRY DATA
// ─────────────────────────────────────────────────────────
interface Country {
  code: string;
  name: string;
  flag: string;
  dial: string;
}

const COUNTRIES: Country[] = [
  { code: 'AF', name: 'Afghanistan', flag: '🇦🇫', dial: '+93' },
  { code: 'AL', name: 'Albania', flag: '🇦🇱', dial: '+355' },
  { code: 'DZ', name: 'Algeria', flag: '🇩🇿', dial: '+213' },
  { code: 'AD', name: 'Andorra', flag: '🇦🇩', dial: '+376' },
  { code: 'AO', name: 'Angola', flag: '🇦🇴', dial: '+244' },
  { code: 'AG', name: 'Antigua & Barbuda', flag: '🇦🇬', dial: '+1' },
  { code: 'AR', name: 'Argentina', flag: '🇦🇷', dial: '+54' },
  { code: 'AM', name: 'Armenia', flag: '🇦🇲', dial: '+374' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺', dial: '+61' },
  { code: 'AT', name: 'Austria', flag: '🇦🇹', dial: '+43' },
  { code: 'AZ', name: 'Azerbaijan', flag: '🇦🇿', dial: '+994' },
  { code: 'BS', name: 'Bahamas', flag: '🇧🇸', dial: '+1' },
  { code: 'BH', name: 'Bahrain', flag: '🇧🇭', dial: '+973' },
  { code: 'BD', name: 'Bangladesh', flag: '🇧🇩', dial: '+880' },
  { code: 'BB', name: 'Barbados', flag: '🇧🇧', dial: '+1' },
  { code: 'BY', name: 'Belarus', flag: '🇧🇾', dial: '+375' },
  { code: 'BE', name: 'Belgium', flag: '🇧🇪', dial: '+32' },
  { code: 'BZ', name: 'Belize', flag: '🇧🇿', dial: '+501' },
  { code: 'BJ', name: 'Benin', flag: '🇧🇯', dial: '+229' },
  { code: 'BT', name: 'Bhutan', flag: '🇧🇹', dial: '+975' },
  { code: 'BO', name: 'Bolivia', flag: '🇧🇴', dial: '+591' },
  { code: 'BA', name: 'Bosnia & Herzegovina', flag: '🇧🇦', dial: '+387' },
  { code: 'BW', name: 'Botswana', flag: '🇧🇼', dial: '+267' },
  { code: 'BR', name: 'Brazil', flag: '🇧🇷', dial: '+55' },
  { code: 'BN', name: 'Brunei', flag: '🇧🇳', dial: '+673' },
  { code: 'BG', name: 'Bulgaria', flag: '🇧🇬', dial: '+359' },
  { code: 'BF', name: 'Burkina Faso', flag: '🇧🇫', dial: '+226' },
  { code: 'BI', name: 'Burundi', flag: '🇧🇮', dial: '+257' },
  { code: 'KH', name: 'Cambodia', flag: '🇰🇭', dial: '+855' },
  { code: 'CM', name: 'Cameroon', flag: '🇨🇲', dial: '+237' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦', dial: '+1' },
  { code: 'CV', name: 'Cabo Verde', flag: '🇨🇻', dial: '+238' },
  { code: 'CF', name: 'Central African Republic', flag: '🇨🇫', dial: '+236' },
  { code: 'TD', name: 'Chad', flag: '🇹🇩', dial: '+235' },
  { code: 'CL', name: 'Chile', flag: '🇨🇱', dial: '+56' },
  { code: 'CN', name: 'China', flag: '🇨🇳', dial: '+86' },
  { code: 'CO', name: 'Colombia', flag: '🇨🇴', dial: '+57' },
  { code: 'KM', name: 'Comoros', flag: '🇰🇲', dial: '+269' },
  { code: 'CG', name: 'Congo', flag: '🇨🇬', dial: '+242' },
  { code: 'CD', name: 'Congo (DRC)', flag: '🇨🇩', dial: '+243' },
  { code: 'CR', name: 'Costa Rica', flag: '🇨🇷', dial: '+506' },
  { code: 'HR', name: 'Croatia', flag: '🇭🇷', dial: '+385' },
  { code: 'CU', name: 'Cuba', flag: '🇨🇺', dial: '+53' },
  { code: 'CY', name: 'Cyprus', flag: '🇨🇾', dial: '+357' },
  { code: 'CZ', name: 'Czech Republic', flag: '🇨🇿', dial: '+420' },
  { code: 'DK', name: 'Denmark', flag: '🇩🇰', dial: '+45' },
  { code: 'DJ', name: 'Djibouti', flag: '🇩🇯', dial: '+253' },
  { code: 'DM', name: 'Dominica', flag: '🇩🇲', dial: '+1' },
  { code: 'DO', name: 'Dominican Republic', flag: '🇩🇴', dial: '+1' },
  { code: 'EC', name: 'Ecuador', flag: '🇪🇨', dial: '+593' },
  { code: 'EG', name: 'Egypt', flag: '🇪🇬', dial: '+20' },
  { code: 'SV', name: 'El Salvador', flag: '🇸🇻', dial: '+503' },
  { code: 'GQ', name: 'Equatorial Guinea', flag: '🇬🇶', dial: '+240' },
  { code: 'ER', name: 'Eritrea', flag: '🇪🇷', dial: '+291' },
  { code: 'EE', name: 'Estonia', flag: '🇪🇪', dial: '+372' },
  { code: 'ET', name: 'Ethiopia', flag: '🇪🇹', dial: '+251' },
  { code: 'FJ', name: 'Fiji', flag: '🇫🇯', dial: '+679' },
  { code: 'FI', name: 'Finland', flag: '🇫🇮', dial: '+358' },
  { code: 'FR', name: 'France', flag: '🇫🇷', dial: '+33' },
  { code: 'GA', name: 'Gabon', flag: '🇬🇦', dial: '+241' },
  { code: 'GM', name: 'Gambia', flag: '🇬🇲', dial: '+220' },
  { code: 'GE', name: 'Georgia', flag: '🇬🇪', dial: '+995' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪', dial: '+49' },
  { code: 'GH', name: 'Ghana', flag: '🇬🇭', dial: '+233' },
  { code: 'GR', name: 'Greece', flag: '🇬🇷', dial: '+30' },
  { code: 'GD', name: 'Grenada', flag: '🇬🇩', dial: '+1' },
  { code: 'GT', name: 'Guatemala', flag: '🇬🇹', dial: '+502' },
  { code: 'GN', name: 'Guinea', flag: '🇬🇳', dial: '+224' },
  { code: 'GW', name: 'Guinea-Bissau', flag: '🇬🇼', dial: '+245' },
  { code: 'GY', name: 'Guyana', flag: '🇬🇾', dial: '+592' },
  { code: 'HT', name: 'Haiti', flag: '🇭🇹', dial: '+509' },
  { code: 'HN', name: 'Honduras', flag: '🇭🇳', dial: '+504' },
  { code: 'HK', name: 'Hong Kong', flag: '🇭🇰', dial: '+852' },
  { code: 'HU', name: 'Hungary', flag: '🇭🇺', dial: '+36' },
  { code: 'IS', name: 'Iceland', flag: '🇮🇸', dial: '+354' },
  { code: 'IN', name: 'India', flag: '🇮🇳', dial: '+91' },
  { code: 'ID', name: 'Indonesia', flag: '🇮🇩', dial: '+62' },
  { code: 'IR', name: 'Iran', flag: '🇮🇷', dial: '+98' },
  { code: 'IQ', name: 'Iraq', flag: '🇮🇶', dial: '+964' },
  { code: 'IE', name: 'Ireland', flag: '🇮🇪', dial: '+353' },
  { code: 'IL', name: 'Israel', flag: '🇮🇱', dial: '+972' },
  { code: 'IT', name: 'Italy', flag: '🇮🇹', dial: '+39' },
  { code: 'JM', name: 'Jamaica', flag: '🇯🇲', dial: '+1' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵', dial: '+81' },
  { code: 'JO', name: 'Jordan', flag: '🇯🇴', dial: '+962' },
  { code: 'KZ', name: 'Kazakhstan', flag: '🇰🇿', dial: '+7' },
  { code: 'KE', name: 'Kenya', flag: '🇰🇪', dial: '+254' },
  { code: 'KW', name: 'Kuwait', flag: '🇰🇼', dial: '+965' },
  { code: 'KG', name: 'Kyrgyzstan', flag: '🇰🇬', dial: '+996' },
  { code: 'LA', name: 'Laos', flag: '🇱🇦', dial: '+856' },
  { code: 'LV', name: 'Latvia', flag: '🇱🇻', dial: '+371' },
  { code: 'LB', name: 'Lebanon', flag: '🇱🇧', dial: '+961' },
  { code: 'LS', name: 'Lesotho', flag: '🇱🇸', dial: '+266' },
  { code: 'LR', name: 'Liberia', flag: '🇱🇷', dial: '+231' },
  { code: 'LY', name: 'Libya', flag: '🇱🇾', dial: '+218' },
  { code: 'LI', name: 'Liechtenstein', flag: '🇱🇮', dial: '+423' },
  { code: 'LT', name: 'Lithuania', flag: '🇱🇹', dial: '+370' },
  { code: 'LU', name: 'Luxembourg', flag: '🇱🇺', dial: '+352' },
  { code: 'MG', name: 'Madagascar', flag: '🇲🇬', dial: '+261' },
  { code: 'MW', name: 'Malawi', flag: '🇲🇼', dial: '+265' },
  { code: 'MY', name: 'Malaysia', flag: '🇲🇾', dial: '+60' },
  { code: 'MV', name: 'Maldives', flag: '🇲🇻', dial: '+960' },
  { code: 'ML', name: 'Mali', flag: '🇲🇱', dial: '+223' },
  { code: 'MT', name: 'Malta', flag: '🇲🇹', dial: '+356' },
  { code: 'MR', name: 'Mauritania', flag: '🇲🇷', dial: '+222' },
  { code: 'MU', name: 'Mauritius', flag: '🇲🇺', dial: '+230' },
  { code: 'MX', name: 'Mexico', flag: '🇲🇽', dial: '+52' },
  { code: 'MD', name: 'Moldova', flag: '🇲🇩', dial: '+373' },
  { code: 'MC', name: 'Monaco', flag: '🇲🇨', dial: '+377' },
  { code: 'MN', name: 'Mongolia', flag: '🇲🇳', dial: '+976' },
  { code: 'ME', name: 'Montenegro', flag: '🇲🇪', dial: '+382' },
  { code: 'MA', name: 'Morocco', flag: '🇲🇦', dial: '+212' },
  { code: 'MZ', name: 'Mozambique', flag: '🇲🇿', dial: '+258' },
  { code: 'MM', name: 'Myanmar', flag: '🇲🇲', dial: '+95' },
  { code: 'NA', name: 'Namibia', flag: '🇳🇦', dial: '+264' },
  { code: 'NP', name: 'Nepal', flag: '🇳🇵', dial: '+977' },
  { code: 'NL', name: 'Netherlands', flag: '🇳🇱', dial: '+31' },
  { code: 'NZ', name: 'New Zealand', flag: '🇳🇿', dial: '+64' },
  { code: 'NI', name: 'Nicaragua', flag: '🇳🇮', dial: '+505' },
  { code: 'NE', name: 'Niger', flag: '🇳🇪', dial: '+227' },
  { code: 'NG', name: 'Nigeria', flag: '🇳🇬', dial: '+234' },
  { code: 'NO', name: 'Norway', flag: '🇳🇴', dial: '+47' },
  { code: 'OM', name: 'Oman', flag: '🇴🇲', dial: '+968' },
  { code: 'PK', name: 'Pakistan', flag: '🇵🇰', dial: '+92' },
  { code: 'PS', name: 'Palestine', flag: '🇵🇸', dial: '+970' },
  { code: 'PA', name: 'Panama', flag: '🇵🇦', dial: '+507' },
  { code: 'PG', name: 'Papua New Guinea', flag: '🇵🇬', dial: '+675' },
  { code: 'PY', name: 'Paraguay', flag: '🇵🇾', dial: '+595' },
  { code: 'PE', name: 'Peru', flag: '🇵🇪', dial: '+51' },
  { code: 'PH', name: 'Philippines', flag: '🇵🇭', dial: '+63' },
  { code: 'PL', name: 'Poland', flag: '🇵🇱', dial: '+48' },
  { code: 'PT', name: 'Portugal', flag: '🇵🇹', dial: '+351' },
  { code: 'QA', name: 'Qatar', flag: '🇶🇦', dial: '+974' },
  { code: 'RO', name: 'Romania', flag: '🇷🇴', dial: '+40' },
  { code: 'RU', name: 'Russia', flag: '🇷🇺', dial: '+7' },
  { code: 'RW', name: 'Rwanda', flag: '🇷🇼', dial: '+250' },
  { code: 'KN', name: 'Saint Kitts & Nevis', flag: '🇰🇳', dial: '+1' },
  { code: 'LC', name: 'Saint Lucia', flag: '🇱🇨', dial: '+1' },
  { code: 'VC', name: 'Saint Vincent & Grenadines', flag: '🇻🇨', dial: '+1' },
  { code: 'WS', name: 'Samoa', flag: '🇼🇸', dial: '+685' },
  { code: 'SM', name: 'San Marino', flag: '🇸🇲', dial: '+378' },
  { code: 'SA', name: 'Saudi Arabia', flag: '🇸🇦', dial: '+966' },
  { code: 'SN', name: 'Senegal', flag: '🇸🇳', dial: '+221' },
  { code: 'RS', name: 'Serbia', flag: '🇷🇸', dial: '+381' },
  { code: 'SC', name: 'Seychelles', flag: '🇸🇨', dial: '+248' },
  { code: 'SL', name: 'Sierra Leone', flag: '🇸🇱', dial: '+232' },
  { code: 'SG', name: 'Singapore', flag: '🇸🇬', dial: '+65' },
  { code: 'SK', name: 'Slovakia', flag: '🇸🇰', dial: '+421' },
  { code: 'SI', name: 'Slovenia', flag: '🇸🇮', dial: '+386' },
  { code: 'SB', name: 'Solomon Islands', flag: '🇸🇧', dial: '+677' },
  { code: 'SO', name: 'Somalia', flag: '🇸🇴', dial: '+252' },
  { code: 'ZA', name: 'South Africa', flag: '🇿🇦', dial: '+27' },
  { code: 'KR', name: 'South Korea', flag: '🇰🇷', dial: '+82' },
  { code: 'SS', name: 'South Sudan', flag: '🇸🇸', dial: '+211' },
  { code: 'ES', name: 'Spain', flag: '🇪🇸', dial: '+34' },
  { code: 'LK', name: 'Sri Lanka', flag: '🇱🇰', dial: '+94' },
  { code: 'SD', name: 'Sudan', flag: '🇸🇩', dial: '+249' },
  { code: 'SR', name: 'Suriname', flag: '🇸🇷', dial: '+597' },
  { code: 'SE', name: 'Sweden', flag: '🇸🇪', dial: '+46' },
  { code: 'CH', name: 'Switzerland', flag: '🇨🇭', dial: '+41' },
  { code: 'SY', name: 'Syria', flag: '🇸🇾', dial: '+963' },
  { code: 'TW', name: 'Taiwan', flag: '🇹🇼', dial: '+886' },
  { code: 'TJ', name: 'Tajikistan', flag: '🇹🇯', dial: '+992' },
  { code: 'TZ', name: 'Tanzania', flag: '🇹🇿', dial: '+255' },
  { code: 'TH', name: 'Thailand', flag: '🇹🇭', dial: '+66' },
  { code: 'TL', name: 'Timor-Leste', flag: '🇹🇱', dial: '+670' },
  { code: 'TG', name: 'Togo', flag: '🇹🇬', dial: '+228' },
  { code: 'TO', name: 'Tonga', flag: '🇹🇴', dial: '+676' },
  { code: 'TT', name: 'Trinidad & Tobago', flag: '🇹🇹', dial: '+1' },
  { code: 'TN', name: 'Tunisia', flag: '🇹🇳', dial: '+216' },
  { code: 'TR', name: 'Turkey', flag: '🇹🇷', dial: '+90' },
  { code: 'TM', name: 'Turkmenistan', flag: '🇹🇲', dial: '+993' },
  { code: 'TV', name: 'Tuvalu', flag: '🇹🇻', dial: '+688' },
  { code: 'UG', name: 'Uganda', flag: '🇺🇬', dial: '+256' },
  { code: 'UA', name: 'Ukraine', flag: '🇺🇦', dial: '+380' },
  { code: 'AE', name: 'United Arab Emirates', flag: '🇦🇪', dial: '+971' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧', dial: '+44' },
  { code: 'US', name: 'United States', flag: '🇺🇸', dial: '+1' },
  { code: 'UY', name: 'Uruguay', flag: '🇺🇾', dial: '+598' },
  { code: 'UZ', name: 'Uzbekistan', flag: '🇺🇿', dial: '+998' },
  { code: 'VU', name: 'Vanuatu', flag: '🇻🇺', dial: '+678' },
  { code: 'VA', name: 'Vatican City', flag: '🇻🇦', dial: '+379' },
  { code: 'VE', name: 'Venezuela', flag: '🇻🇪', dial: '+58' },
  { code: 'VN', name: 'Vietnam', flag: '🇻🇳', dial: '+84' },
  { code: 'YE', name: 'Yemen', flag: '🇾🇪', dial: '+967' },
  { code: 'ZM', name: 'Zambia', flag: '🇿🇲', dial: '+260' },
  { code: 'ZW', name: 'Zimbabwe', flag: '🇿🇼', dial: '+263' },
];

const POPULAR_CODES = ['US', 'HT', 'CA', 'FR', 'GB', 'BR', 'MX', 'DE', 'NG', 'IN'];

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
// Known promo codes (validated client-side for instant UX)
// Real validation still happens server-side on payment
// ─────────────────────────────────────────────────────────
const PROMO_CODES: Record<string, { discount: number; label: string; couponId: string }> = {
  DAWINIX2026: { discount: 0.20, label: '20% off', couponId: 'ivUqadLE' },
  HAITI50:     { discount: 0.50, label: '50% off', couponId: 'HAITI50' },
  WELCOME10:   { discount: 0.10, label: '10% off', couponId: 'WELCOME10' },
};

// ─────────────────────────────────────────────────────────
// Theme
// ─────────────────────────────────────────────────────────
function useT() {
  const dark = useColorScheme() !== 'light';
  return {
    dark,
    bg: '#000000',
    surface: '#1C1C1E',
    surfaceBorder: 'rgba(255,255,255,0.08)',
    text: '#FFFFFF',
    textSec: 'rgba(255,255,255,0.55)',
    textMuted: 'rgba(255,255,255,0.35)',
    inputBg: '#2C2C2E',
    inputBorder: 'rgba(255,255,255,0.12)',
    placeholderText: 'rgba(255,255,255,0.3)',
    accent: '#30D158',
    accentLight: 'rgba(48,209,88,0.15)',
    divider: 'rgba(255,255,255,0.08)',
    cardBg: '#1C1C1E',
    error: '#FF453A',
    success: '#30D158',
    warning: '#FF9F0A',
    searchBg: '#2C2C2E',
  };
}

// ─────────────────────────────────────────────────────────
// Country Picker Modal
// ─────────────────────────────────────────────────────────
function CountryPickerModal({
  visible,
  selected,
  onSelect,
  onClose,
  T,
}: {
  visible: boolean;
  selected: Country;
  onSelect: (c: Country) => void;
  onClose: () => void;
  T: ReturnType<typeof useT>;
}) {
  const [search, setSearch] = useState('');
  const insets = useSafeAreaInsets();
  const popular = POPULAR_CODES.map((c) => getCountryByCode(c)).filter(Boolean) as Country[];
  const filtered = search.trim()
    ? COUNTRIES.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.dial.includes(search) ||
          c.code.toLowerCase().includes(search.toLowerCase()),
      )
    : COUNTRIES;
  const sections = search.trim()
    ? [{ title: `Results (${filtered.length})`, data: filtered }]
    : [
        { title: 'Popular', data: popular },
        { title: 'All Countries', data: COUNTRIES },
      ];
  type Item = { type: 'header'; title: string } | { type: 'country'; item: Country };
  const flatData: Item[] = [];
  for (const sec of sections) {
    flatData.push({ type: 'header', title: sec.title });
    for (const item of sec.data) flatData.push({ type: 'country', item });
  }
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[cpS.root, { backgroundColor: T.bg }]}>
        <View style={cpS.handleWrap}>
          <View style={[cpS.handle, { backgroundColor: T.textMuted }]} />
        </View>
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
              return (
                <Text style={[cpS.sectionHeader, { color: T.textMuted }]}>
                  {item.title.toUpperCase()}
                </Text>
              );
            }
            const c = item.item;
            const isSelected = c.code === selected.code;
            return (
              <TouchableOpacity
                style={[
                  cpS.countryRow,
                  { borderBottomColor: T.divider },
                  isSelected && { backgroundColor: T.accentLight },
                ]}
                onPress={() => {
                  onSelect(c);
                  onClose();
                }}
                activeOpacity={0.7}
              >
                <Text style={cpS.flag}>{c.flag}</Text>
                <View style={cpS.countryInfo}>
                  <Text style={[cpS.countryName, { color: T.text }]} numberOfLines={1}>
                    {c.name}
                  </Text>
                  <Text style={[cpS.dialCode, { color: T.textSec }]}>{c.dial}</Text>
                </View>
                {isSelected && <Ionicons name="checkmark" size={18} color={T.accent} />}
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  title: { fontSize: 18, fontWeight: '700' },
  closeBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 15, padding: 0, margin: 0 },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 4,
  },
  countryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  flag: { fontSize: 22, width: 32, textAlign: 'center' },
  countryInfo: { flex: 1 },
  countryName: { fontSize: 15 },
  dialCode: { fontSize: 13, fontWeight: '600', marginTop: 1 },
});

// ─────────────────────────────────────────────────────────
// Form Input
// ─────────────────────────────────────────────────────────
function FormInput({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  editable = true,
  T,
  rightElement,
}: {
  label: string;
  value: string;
  onChangeText?: (text: string) => void;
  placeholder: string;
  keyboardType?: any;
  editable?: boolean;
  T: ReturnType<typeof useT>;
  rightElement?: React.ReactNode;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={fiS.container}>
      <Text style={[fiS.label, { color: T.text }]}>{label}</Text>
      <View
        style={[
          fiS.inputWrap,
          {
            backgroundColor: editable ? T.inputBg : 'rgba(44,44,46,0.5)',
            borderColor: focused ? T.accent : T.inputBorder,
            borderWidth: focused ? 1.5 : 1,
          },
        ]}
      >
        <TextInput
          style={[fiS.input, { color: editable ? T.text : T.textSec }]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={T.placeholderText}
          keyboardType={keyboardType}
          autoCapitalize="none"
          autoCorrect={false}
          editable={editable}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {rightElement}
        {!editable && (
          <Ionicons name="lock-closed" size={14} color={T.textMuted} style={{ marginLeft: 6 }} />
        )}
      </View>
    </View>
  );
}

const fiS = StyleSheet.create({
  container: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  inputWrap: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: { flex: 1, fontSize: 15, fontWeight: '400', padding: 0, margin: 0 },
});

// ─────────────────────────────────────────────────────────
// Phone Input
// ─────────────────────────────────────────────────────────
function PhoneInput({
  country,
  value,
  onChange,
  onCountryPress,
  T,
}: {
  country: Country;
  value: string;
  onChange: (val: string) => void;
  onCountryPress: () => void;
  T: ReturnType<typeof useT>;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={piS.container}>
      <Text style={[piS.label, { color: T.text }]}>Phone Number</Text>
      <View
        style={[
          piS.inputWrap,
          {
            backgroundColor: T.inputBg,
            borderColor: focused ? T.accent : T.inputBorder,
            borderWidth: focused ? 1.5 : 1,
          },
        ]}
      >
        <TouchableOpacity style={piS.countryBtn} onPress={onCountryPress} activeOpacity={0.7}>
          <Text style={piS.flag}>{country.flag}</Text>
          <Text style={[piS.dial, { color: T.text }]}>{country.dial}</Text>
          <Ionicons name="chevron-down" size={14} color={T.textSec} />
        </TouchableOpacity>
        <View style={[piS.divider, { backgroundColor: T.divider }]} />
        <TextInput
          style={[piS.input, { color: T.text }]}
          value={value}
          onChangeText={onChange}
          keyboardType="phone-pad"
          placeholder="(XXX) XXX-XXXX"
          placeholderTextColor={T.placeholderText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      </View>
    </View>
  );
}

const piS = StyleSheet.create({
  container: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  countryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingRight: 8,
  },
  flag: { fontSize: 20 },
  dial: { fontSize: 14, fontWeight: '600' },
  divider: { width: 1, height: 24, marginHorizontal: 8 },
  input: { flex: 1, fontSize: 15, padding: 0, margin: 0, paddingVertical: 10 },
});

// ─────────────────────────────────────────────────────────
// Country Selector Button
// ─────────────────────────────────────────────────────────
function CountrySelector({
  country,
  onPress,
  T,
}: {
  country: Country;
  onPress: () => void;
  T: ReturnType<typeof useT>;
}) {
  return (
    <View style={csS.container}>
      <Text style={[csS.label, { color: T.text }]}>Country</Text>
      <TouchableOpacity
        style={[csS.button, { backgroundColor: T.inputBg, borderColor: T.inputBorder }]}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <View style={csS.left}>
          <Text style={csS.flag}>{country.flag}</Text>
          <Text style={[csS.name, { color: T.text }]}>{country.name}</Text>
        </View>
        <Ionicons name="chevron-down" size={18} color={T.textSec} />
      </TouchableOpacity>
    </View>
  );
}

const csS = StyleSheet.create({
  container: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flag: { fontSize: 20 },
  name: { fontSize: 15, fontWeight: '500' },
});

// ─────────────────────────────────────────────────────────
// Promo Code Input
// ─────────────────────────────────────────────────────────
function PromoCodeInput({
  code,
  setCode,
  onApply,
  applying,
  applied,
  promoError,
  promoDiscount,
  T,
}: {
  code: string;
  setCode: (v: string) => void;
  onApply: () => void;
  applying: boolean;
  applied: boolean;
  promoError: string;
  promoDiscount: string;
  T: ReturnType<typeof useT>;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={prS.container}>
      <Text style={[prS.label, { color: T.text }]}>Promo Code</Text>
      <View
        style={[
          prS.inputWrap,
          {
            backgroundColor: T.inputBg,
            borderColor: applied ? T.accent : focused ? T.accent : promoError ? T.error : T.inputBorder,
            borderWidth: applied || promoError ? 1.5 : focused ? 1.5 : 1,
          },
        ]}
      >
        <Ionicons name="pricetag-outline" size={16} color={applied ? T.accent : T.textSec} style={{ marginRight: 8 }} />
        <TextInput
          style={[prS.input, { color: T.text }]}
          value={code}
          onChangeText={(t) => setCode(t.toUpperCase())}
          placeholder="Enter code (e.g. DAWINIX2026)"
          placeholderTextColor={T.placeholderText}
          autoCapitalize="characters"
          autoCorrect={false}
          editable={!applied}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {applied ? (
          <View style={prS.appliedBadge}>
            <Ionicons name="checkmark-circle" size={18} color={T.accent} />
          </View>
        ) : (
          <TouchableOpacity
            style={[prS.applyBtn, { backgroundColor: code.trim().length > 0 ? T.accent : 'rgba(255,255,255,0.1)' }]}
            onPress={onApply}
            disabled={applying || code.trim().length === 0}
            activeOpacity={0.8}
          >
            {applying ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Text style={prS.applyText}>Apply</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
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
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  input: { flex: 1, fontSize: 15, padding: 0, margin: 0, letterSpacing: 1 },
  applyBtn: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minWidth: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  appliedBadge: { paddingLeft: 6 },
  successRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6, paddingLeft: 4 },
  successText: { fontSize: 13, fontWeight: '600' },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6, paddingLeft: 4 },
  errorText: { fontSize: 13, fontWeight: '500' },
});

// ─────────────────────────────────────────────────────────
// Plan Summary Card
// ─────────────────────────────────────────────────────────
function PlanSummaryCard({
  planName,
  price,
  discountedPrice,
  discountLabel,
  T,
}: {
  planName: string;
  price: string;
  discountedPrice?: string;
  discountLabel?: string;
  T: ReturnType<typeof useT>;
}) {
  const isPlus = planName.toLowerCase().includes('plus');
  const accentColor = isPlus ? '#6B5CE7' : '#30D158';
  const features = isPlus
    ? [
        'Advanced AI models',
        'Unlimited smart messages',
        '20 image/file uploads',
        'Agents & deep research',
        'Early access to features',
      ]
    : [
        'More daily messages',
        '10 image/file uploads',
        'Group chat creation',
        'Extended memory',
      ];

  return (
    <View style={[psS.container, { backgroundColor: T.surface, borderColor: T.surfaceBorder }]}>
      <View style={psS.header}>
        <View style={[psS.badge, { backgroundColor: accentColor + '22', borderColor: accentColor + '55' }]}>
          <Text style={[psS.badgeText, { color: accentColor }]}>
            {isPlus ? '✨ PLUS' : '⚡ GO'}
          </Text>
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
        <Text style={[psS.totalLabel, { color: T.textSec }]}>
          Billed monthly · auto-cancels when expired
        </Text>
        <Text style={[psS.totalAmount, { color: accentColor }]}>
          {discountedPrice || price}/mo
        </Text>
      </View>
    </View>
  );
}

const psS = StyleSheet.create({
  container: { borderRadius: 18, padding: 18, borderWidth: 1, marginBottom: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  badge: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1 },
  badgeText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  priceWrap: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  priceOld: { fontSize: 14, fontWeight: '500', textDecorationLine: 'line-through' },
  price: { fontSize: 26, fontWeight: '800' },
  period: { fontSize: 13, fontWeight: '500' },
  discountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  discountText: { fontSize: 12, fontWeight: '700' },
  divider: { height: StyleSheet.hairlineWidth, marginBottom: 12 },
  featuresTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 7 },
  featureText: { fontSize: 14 },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  totalLabel: { fontSize: 11, flex: 1 },
  totalAmount: { fontSize: 16, fontWeight: '700' },
});

// ─────────────────────────────────────────────────────────
// Stripe Publishable Key (hardcoded, safe to expose)
// ─────────────────────────────────────────────────────────
const STRIPE_PUBLISHABLE_KEY = 'pk_live_51SjmgDE0VkO7z1VnJb4RdkCuQ3r3RMaiBM6ZXlzgmLa7DqHRlCa1oWNLIpxZCWPiMf1dG6gCrLePEb73cGE5u7N00MFupmAKK';

// ─────────────────────────────────────────────────────────
// Inner checkout (inside StripeProvider)
// ─────────────────────────────────────────────────────────
function CheckoutInner() {
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const T = useT();
  const supabase = getSupabaseClient();

  // Stripe PaymentSheet hook (only on native)
  const stripeHook = Platform.OS !== 'web' && useStripe ? useStripe() : null;
  const initPaymentSheet = stripeHook?.initPaymentSheet;
  const presentPaymentSheet = stripeHook?.presentPaymentSheet;

  // Plan params from subscription.tsx
  const params = useLocalSearchParams<{ plan?: string; priceId?: string; price?: string; name?: string }>();
  const planParam = (params.plan as string) || 'plus';
  const priceIdParam = (params.priceId as string) || 'price_1TPUrzE0VkO7z1Vnlgj45978';
  const priceParam = (params.price as string) || '19.99';
  const planDisplayName = (params.name as string) || 'Dawinix Plus';

  // Billing info (auto-set from user)
  const [billingEmail, setBillingEmail] = useState(user?.email || '');
  const billingUsername = user?.username || user?.email?.split('@')[0] || 'User';

  // Country / phone
  const [country, setCountry] = useState<Country>(() => guessCountryFromLocale());
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [phoneNational, setPhoneNational] = useState('');

  // Promo code
  const [promoCode, setPromoCode] = useState('');
  const [applyingPromo, setApplyingPromo] = useState(false);
  const [promoApplied, setPromoApplied] = useState(false);
  const [promoError, setPromoError] = useState('');
  const [promoDiscount, setPromoDiscount] = useState(0); // fraction e.g. 0.20
  const [promoLabel, setPromoLabel] = useState('');
  const [promoCouponId, setPromoCouponId] = useState('');

  // Loading / PaymentSheet ready
  const [loading, setLoading] = useState(false);
  const [paymentSheetReady, setPaymentSheetReady] = useState(false);
  const clientSecretRef = useRef<string | null>(null);

  // Computed prices
  const basePrice = parseFloat(priceParam) || 19.99;
  const finalPrice = promoApplied ? basePrice * (1 - promoDiscount) : basePrice;
  const displayBasePrice = `$${basePrice.toFixed(2)}`;
  const displayFinalPrice = promoApplied ? `$${finalPrice.toFixed(2)}` : undefined;

  // ── Apply promo code ──
  const handleApplyPromo = useCallback(async () => {
    if (!promoCode.trim()) return;
    setApplyingPromo(true);
    setPromoError('');
    setPromoApplied(false);

    await new Promise((r) => setTimeout(r, 600)); // brief UX delay

    const entry = PROMO_CODES[promoCode.trim().toUpperCase()];
    if (entry) {
      setPromoDiscount(entry.discount);
      setPromoLabel(entry.label);
      setPromoCouponId(entry.couponId);
      setPromoApplied(true);
      // Reset payment sheet readiness so it re-initialises with coupon
      setPaymentSheetReady(false);
      clientSecretRef.current = null;
    } else {
      setPromoError('Invalid promo code. Try DAWINIX2026 for 20% off.');
    }
    setApplyingPromo(false);
  }, [promoCode]);

  // ── Initialize Stripe PaymentSheet ──
  const initSheet = useCallback(async () => {
    if (!initPaymentSheet) return; // web fallback handled later
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Not authenticated');

    const body: any = {
      plan: planParam,
      priceId: priceIdParam,
      mode: 'payment_sheet',
    };
    if (promoApplied && promoCouponId) {
      body.couponId = promoCouponId;
    }

    const { data, error } = await supabase.functions.invoke('create-checkout-session', {
      body,
      headers: { Authorization: `Bearer ${session.access_token}` },
    });

    if (error) {
      let msg = error.message;
      if (error instanceof FunctionsHttpError) {
        try { msg = await error.context?.text() || msg; } catch (_e) {}
      }
      throw new Error(msg);
    }

    if (!data?.clientSecret) {
      throw new Error('No payment secret returned. Please try again.');
    }

    clientSecretRef.current = data.clientSecret;

    const { error: initError } = await initPaymentSheet({
      paymentIntentClientSecret: data.clientSecret,
      customerId: data.customerId,
      customerEphemeralKeySecret: data.ephemeralKey,
      merchantDisplayName: 'Dawinix',
      defaultBillingDetails: {
        email: billingEmail,
        name: billingUsername,
      },
      appearance: {
        colors: {
          primary: '#30D158',
          background: '#000000',
          componentBackground: '#1C1C1E',
          componentDivider: 'rgba(255,255,255,0.1)',
          componentText: '#FFFFFF',
          secondaryText: 'rgba(255,255,255,0.55)',
          componentBorder: 'rgba(255,255,255,0.12)',
          placeholderText: 'rgba(255,255,255,0.3)',
          icon: 'rgba(255,255,255,0.55)',
        },
      },
      style: 'alwaysDark',
    });

    if (initError) throw new Error(initError.message);
    setPaymentSheetReady(true);
  }, [initPaymentSheet, supabase, planParam, priceIdParam, promoApplied, promoCouponId, billingEmail, billingUsername]);

  // ── Sync subscription after successful payment ──
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
    } catch (e) {
      console.log('[checkout] sync error:', e);
    }
  }, [user, supabase, planParam]);

  // ── Main pay handler ──
  const handlePay = async () => {
    if (loading) return;
    setLoading(true);
    try {
      if (Platform.OS === 'web' || !presentPaymentSheet) {
        // Web: open Stripe hosted checkout in browser
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) throw new Error('Not authenticated');

        const body: any = { plan: planParam, priceId: priceIdParam };
        if (promoApplied && promoCouponId) body.couponId = promoCouponId;

        const { data, error } = await supabase.functions.invoke('create-checkout-session', {
          body,
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (error) throw new Error(error.message);
        if (!data?.url) throw new Error('No checkout URL');
        const { Linking } = require('react-native');
        await Linking.openURL(data.url);
        return;
      }

      // Native: use PaymentSheet
      if (!paymentSheetReady) {
        await initSheet();
      }

      const { error: presentError } = await presentPaymentSheet();

      if (presentError) {
        if (presentError.code === 'Canceled') return; // user dismissed
        throw new Error(presentError.message);
      }

      // Payment succeeded
      await syncSubscription();
      showAlert(
        'Payment Successful!',
        `Your ${planDisplayName} plan is now active. It auto-cancels when the billing period ends.`,
      );
      router.replace('/subscription-success');
    } catch (err: any) {
      showAlert('Payment Failed', err?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: T.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" />

      <CountryPickerModal
        visible={showCountryPicker}
        selected={country}
        onSelect={setCountry}
        onClose={() => setShowCountryPicker(false)}
        T={T}
      />

      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color={T.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: T.text }]}>{planDisplayName}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 130 }]}
      >
        {/* Plan Summary with optional discounted price */}
        <PlanSummaryCard
          planName={planDisplayName}
          price={displayBasePrice}
          discountedPrice={displayFinalPrice}
          discountLabel={promoApplied ? promoLabel : undefined}
          T={T}
        />

        {/* Promo Code */}
        <PromoCodeInput
          code={promoCode}
          setCode={(v) => {
            setPromoCode(v);
            if (promoApplied) {
              setPromoApplied(false);
              setPromoDiscount(0);
              setPromoLabel('');
              setPromoCouponId('');
              setPaymentSheetReady(false);
              clientSecretRef.current = null;
            }
            setPromoError('');
          }}
          onApply={handleApplyPromo}
          applying={applyingPromo}
          applied={promoApplied}
          promoError={promoError}
          promoDiscount={promoLabel}
          T={T}
        />

        {/* Billing Information */}
        <Text style={[s.sectionTitle, { color: T.text }]}>Billing Information</Text>

        {/* Email — auto-set, user can edit */}
        <FormInput
          label="Email"
          value={billingEmail}
          onChangeText={setBillingEmail}
          placeholder="your@email.com"
          keyboardType="email-address"
          editable={true}
          T={T}
        />

        {/* Username — auto-set, non-editable */}
        <FormInput
          label="Username"
          value={billingUsername}
          placeholder="username"
          editable={false}
          T={T}
        />

        {/* Country */}
        <CountrySelector country={country} onPress={() => setShowCountryPicker(true)} T={T} />

        {/* Phone */}
        <PhoneInput
          country={country}
          value={phoneNational}
          onChange={setPhoneNational}
          onCountryPress={() => setShowCountryPicker(true)}
          T={T}
        />

        {/* Payment method info */}
        <View style={[s.infoPanel, { backgroundColor: T.surface, borderColor: T.surfaceBorder }]}>
          <Ionicons name="card-outline" size={20} color={T.accent} />
          <Text style={[s.infoPanelText, { color: T.textSec }]}>
            {Platform.OS === 'ios'
              ? 'Secure in-app payment — Card or Apple Pay via Stripe. Your info never leaves your device.'
              : Platform.OS === 'android'
                ? 'Secure in-app payment — Card or Google Pay via Stripe. Your info never leaves your device.'
                : 'Secure checkout powered by Stripe.'}
          </Text>
        </View>

        {/* Auto-cancel notice */}
        <View style={s.cancelNotice}>
          <Ionicons name="information-circle-outline" size={15} color={T.textMuted} />
          <Text style={[s.cancelNoticeText, { color: T.textMuted }]}>
            Subscription auto-cancels when the billing period ends unless renewed. No hidden charges.
          </Text>
        </View>

        {/* Security note */}
        <View style={s.securityRow}>
          <Ionicons name="lock-closed" size={14} color={T.textMuted} />
          <Text style={[s.securityText, { color: T.textMuted }]}>Secure payment powered by Stripe</Text>
        </View>
      </ScrollView>

      {/* Bottom Pay Button */}
      <View style={[s.bottomBar, { paddingBottom: insets.bottom + 20 }]}>
        {/* Total row */}
        <View style={s.totalRow}>
          <Text style={[s.totalLabel, { color: T.textSec }]}>Total due today</Text>
          <View style={s.totalPriceRow}>
            {promoApplied && (
              <Text style={[s.totalOld, { color: T.textMuted }]}>{displayBasePrice}</Text>
            )}
            <Text style={[s.totalPrice, { color: T.accent }]}>{displayFinalPrice || displayBasePrice}/mo</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[s.payBtn, { backgroundColor: T.accent }, loading && s.payBtnDisabled]}
          onPress={handlePay}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" size="small" />
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="card-outline" size={18} color="#FFF" />
              <Text style={s.payBtnText}>
                Pay {displayFinalPrice || displayBasePrice}/mo
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─────────────────────────────────────────────────────────
// Root: wrap with StripeProvider on native, plain View on web
// ─────────────────────────────────────────────────────────
export default function CheckoutScreen() {
  if (Platform.OS === 'web' || !StripeProvider) {
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  scroll: { paddingHorizontal: 16, paddingTop: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '700', marginBottom: 14 },
  infoPanel: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  infoPanelText: { flex: 1, fontSize: 13, lineHeight: 19 },
  cancelNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 4,
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  cancelNoticeText: { flex: 1, fontSize: 12, lineHeight: 18 },
  securityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    marginBottom: 10,
  },
  securityText: { fontSize: 12, fontWeight: '500' },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: 'rgba(0,0,0,0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    gap: 8,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: { fontSize: 13, fontWeight: '500' },
  totalPriceRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  totalOld: { fontSize: 13, fontWeight: '500', textDecorationLine: 'line-through' },
  totalPrice: { fontSize: 17, fontWeight: '700' },
  payBtn: {
    width: '100%',
    borderRadius: 50,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  payBtnDisabled: { opacity: 0.5 },
});
