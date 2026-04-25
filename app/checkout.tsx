/**
 * CHECKOUT — Premium dark-glass redesign v3
 * • Custom country picker with FlatList modal (web-compatible, no native-only deps)
 * • Phone validation via libphonenumber-js
 * • Full BlurView glass panels with glow borders
 * • Real SVG-style card brand logos
 * • Coupon / promo code → Stripe discount
 * • Card: Stripe CardField (cardholder name + number/expiry/CVV)
 * • Apple Pay / Google Pay: Stripe in-app PaymentSheet
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

const { width: SCREEN_W } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────
// libphonenumber-js (web-compatible)
// ─────────────────────────────────────────────────────────
let parsePhoneNumberFn: ((phone: string, country: string) => any) | null = null;
try {
  const lib = require('libphonenumber-js');
  parsePhoneNumberFn = lib.parsePhoneNumber;
} catch (_) {}

function validatePhone(national: string, countryCode: string): boolean {
  if (!parsePhoneNumberFn || !national || !countryCode) return false;
  try {
    const fullNumber = national.startsWith('+') ? national : national;
    const parsed = parsePhoneNumberFn(national, countryCode as any);
    return parsed?.isValid?.() ?? false;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────
// Country data (200+ entries)
// ─────────────────────────────────────────────────────────
interface Country {
  code: string;   // ISO 3166-1 alpha-2
  name: string;
  flag: string;   // emoji flag
  dial: string;   // e.g. "+1"
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
  { code: 'CV', name: 'Cabo Verde', flag: '🇨🇻', dial: '+238' },
  { code: 'KH', name: 'Cambodia', flag: '🇰🇭', dial: '+855' },
  { code: 'CM', name: 'Cameroon', flag: '🇨🇲', dial: '+237' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦', dial: '+1' },
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
  { code: 'DO', name: 'Dominican Republic', flag: '🇩🇴', dial: '+1' },
  { code: 'EC', name: 'Ecuador', flag: '🇪🇨', dial: '+593' },
  { code: 'EG', name: 'Egypt', flag: '🇪🇬', dial: '+20' },
  { code: 'SV', name: 'El Salvador', flag: '🇸🇻', dial: '+503' },
  { code: 'GQ', name: 'Equatorial Guinea', flag: '🇬🇶', dial: '+240' },
  { code: 'ER', name: 'Eritrea', flag: '🇪🇷', dial: '+291' },
  { code: 'EE', name: 'Estonia', flag: '🇪🇪', dial: '+372' },
  { code: 'SZ', name: 'Eswatini', flag: '🇸🇿', dial: '+268' },
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
  { code: 'GT', name: 'Guatemala', flag: '🇬🇹', dial: '+502' },
  { code: 'GN', name: 'Guinea', flag: '🇬🇳', dial: '+224' },
  { code: 'GW', name: 'Guinea-Bissau', flag: '🇬🇼', dial: '+245' },
  { code: 'GY', name: 'Guyana', flag: '🇬🇾', dial: '+592' },
  { code: 'HT', name: 'Haiti', flag: '🇭🇹', dial: '+509' },
  { code: 'HN', name: 'Honduras', flag: '🇭🇳', dial: '+504' },
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
  { code: 'KI', name: 'Kiribati', flag: '🇰🇮', dial: '+686' },
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
  { code: 'MH', name: 'Marshall Islands', flag: '🇲🇭', dial: '+692' },
  { code: 'MR', name: 'Mauritania', flag: '🇲🇷', dial: '+222' },
  { code: 'MU', name: 'Mauritius', flag: '🇲🇺', dial: '+230' },
  { code: 'MX', name: 'Mexico', flag: '🇲🇽', dial: '+52' },
  { code: 'FM', name: 'Micronesia', flag: '🇫🇲', dial: '+691' },
  { code: 'MD', name: 'Moldova', flag: '🇲🇩', dial: '+373' },
  { code: 'MC', name: 'Monaco', flag: '🇲🇨', dial: '+377' },
  { code: 'MN', name: 'Mongolia', flag: '🇲🇳', dial: '+976' },
  { code: 'ME', name: 'Montenegro', flag: '🇲🇪', dial: '+382' },
  { code: 'MA', name: 'Morocco', flag: '🇲🇦', dial: '+212' },
  { code: 'MZ', name: 'Mozambique', flag: '🇲🇿', dial: '+258' },
  { code: 'MM', name: 'Myanmar', flag: '🇲🇲', dial: '+95' },
  { code: 'NA', name: 'Namibia', flag: '🇳🇦', dial: '+264' },
  { code: 'NR', name: 'Nauru', flag: '🇳🇷', dial: '+674' },
  { code: 'NP', name: 'Nepal', flag: '🇳🇵', dial: '+977' },
  { code: 'NL', name: 'Netherlands', flag: '🇳🇱', dial: '+31' },
  { code: 'NZ', name: 'New Zealand', flag: '🇳🇿', dial: '+64' },
  { code: 'NI', name: 'Nicaragua', flag: '🇳🇮', dial: '+505' },
  { code: 'NE', name: 'Niger', flag: '🇳🇪', dial: '+227' },
  { code: 'NG', name: 'Nigeria', flag: '🇳🇬', dial: '+234' },
  { code: 'NO', name: 'Norway', flag: '🇳🇴', dial: '+47' },
  { code: 'OM', name: 'Oman', flag: '🇴🇲', dial: '+968' },
  { code: 'PK', name: 'Pakistan', flag: '🇵🇰', dial: '+92' },
  { code: 'PW', name: 'Palau', flag: '🇵🇼', dial: '+680' },
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
  { code: 'ST', name: 'São Tomé & Príncipe', flag: '🇸🇹', dial: '+239' },
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
// Custom Country Picker Modal
// ─────────────────────────────────────────────────────────
interface CountryPickerModalProps {
  visible: boolean;
  selected: Country;
  onSelect: (c: Country) => void;
  onClose: () => void;
  T: ReturnType<typeof useT>;
  accentColor: string;
}

function CountryPickerModal({ visible, selected, onSelect, onClose, T, accentColor }: CountryPickerModalProps) {
  const [search, setSearch] = useState('');
  const insets = useSafeAreaInsets();

  const popular = POPULAR_CODES.map((c) => getCountryByCode(c)).filter(Boolean) as Country[];
  const filtered = search.trim()
    ? COUNTRIES.filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.dial.includes(search) ||
        c.code.toLowerCase().includes(search.toLowerCase())
      )
    : COUNTRIES;

  const sections = search.trim()
    ? [{ title: 'Results', data: filtered }]
    : [
        { title: 'Popular', data: popular },
        { title: 'All countries', data: COUNTRIES },
      ];

  // Flatten for FlatList
  type Item = { type: 'header'; title: string } | { type: 'country'; item: Country };
  const flatData: Item[] = [];
  for (const sec of sections) {
    flatData.push({ type: 'header', title: sec.title });
    for (const item of sec.data) {
      flatData.push({ type: 'country', item });
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[cpStyles.root, { backgroundColor: T.modalBg }]}>
        {/* Handle */}
        <View style={cpStyles.handleWrap}>
          <View style={[cpStyles.handle, { backgroundColor: T.textMuted }]} />
        </View>

        {/* Title row */}
        <View style={cpStyles.titleRow}>
          <Text style={[cpStyles.title, { color: T.text }]}>Select Country</Text>
          <TouchableOpacity onPress={onClose} style={cpStyles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={22} color={T.textSec} />
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={[cpStyles.searchWrap, { backgroundColor: T.searchBg }]}>
          <Ionicons name="search" size={16} color={T.textSec} />
          <TextInput
            style={[cpStyles.searchInput, { color: T.text }]}
            value={search}
            onChangeText={setSearch}
            placeholder="Search country or code…"
            placeholderTextColor={T.placeholderText}
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />
          {search.length > 0 && Platform.OS !== 'ios' && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color={T.textSec} />
            </TouchableOpacity>
          )}
        </View>

        <FlatList
          data={flatData}
          keyExtractor={(item, i) =>
            item.type === 'header' ? `hdr-${i}` : `${item.item.code}-${i}`
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            if (item.type === 'header') {
              return (
                <Text style={[cpStyles.sectionHeader, { color: T.textMuted }]}>
                  {item.title.toUpperCase()}
                </Text>
              );
            }
            const c = item.item;
            const isSelected = c.code === selected.code;
            return (
              <TouchableOpacity
                style={[
                  cpStyles.countryRow,
                  { borderBottomColor: T.divider },
                  isSelected && { backgroundColor: accentColor + '12' },
                ]}
                onPress={() => { onSelect(c); onClose(); }}
                activeOpacity={0.7}
              >
                <Text style={cpStyles.flag}>{c.flag}</Text>
                <View style={cpStyles.countryInfo}>
                  <Text style={[cpStyles.countryName, { color: T.text }]} numberOfLines={1}>
                    {c.name}
                  </Text>
                  <Text style={[cpStyles.dialCode, { color: T.textSec }]}>{c.dial}</Text>
                </View>
                {isSelected && (
                  <Ionicons name="checkmark-circle" size={20} color={accentColor} />
                )}
              </TouchableOpacity>
            );
          }}
        />
      </View>
    </Modal>
  );
}

const cpStyles = StyleSheet.create({
  root: { flex: 1 },
  handleWrap: { alignItems: 'center', paddingTop: 10, paddingBottom: 4 },
  handle: { width: 36, height: 4, borderRadius: 2, opacity: 0.35 },
  titleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 10,
  },
  title: { fontSize: 18, fontWeight: '700' },
  closeBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginBottom: 8, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 11,
  },
  searchInput: { flex: 1, fontSize: 15, padding: 0, margin: 0 },
  sectionHeader: {
    fontSize: 11, fontWeight: '700', letterSpacing: 0.8,
    paddingHorizontal: 20, paddingTop: 14, paddingBottom: 4,
  },
  countryRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 20, paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  flag: { fontSize: 24, width: 32, textAlign: 'center' },
  countryInfo: { flex: 1 },
  countryName: { fontSize: 15 },
  dialCode: { fontSize: 13, fontWeight: '600', marginTop: 1 },
});

// ─────────────────────────────────────────────────────────
// Custom Phone Input (Flag + Dial + National number)
// ─────────────────────────────────────────────────────────
interface PhoneInputProps {
  country: Country;
  value: string;
  onChange: (val: string) => void;
  onCountryPress: () => void;
  focused: boolean;
  accentColor: string;
  T: ReturnType<typeof useT>;
}

function CustomPhoneInput({ country, value, onChange, onCountryPress, focused, accentColor, T }: PhoneInputProps) {
  return (
    <View style={[piStyles.root, focused && { borderColor: accentColor + '60' }]}>
      <TouchableOpacity style={[piStyles.flagBtn, { backgroundColor: T.tabInactive }]} onPress={onCountryPress} activeOpacity={0.7}>
        <Text style={piStyles.flag}>{country.flag}</Text>
        <Text style={[piStyles.dial, { color: T.text }]}>{country.dial}</Text>
        <Ionicons name="chevron-down" size={12} color={T.textSec} />
      </TouchableOpacity>
      <TextInput
        style={[piStyles.input, { color: T.text }]}
        value={value}
        onChangeText={onChange}
        keyboardType="phone-pad"
        placeholder="Phone number"
        placeholderTextColor={T.placeholderText}
      />
    </View>
  );
}

const piStyles = StyleSheet.create({
  root: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 0, marginTop: 2,
  },
  flagBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8,
  },
  flag: { fontSize: 18 },
  dial: { fontSize: 14, fontWeight: '600' },
  input: { flex: 1, fontSize: 15, padding: 0, margin: 0 },
});

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
  };
}

// ─────────────────────────────────────────────────────────
// SVG-style Card Brand Logos
// ─────────────────────────────────────────────────────────
function VisaLogo({ width = 48, height = 30 }: { width?: number; height?: number }) {
  return (
    <View style={[cbStyles.base, { width, height, backgroundColor: '#1A1F71', borderRadius: 5 }]}>
      <Text style={cbStyles.visaText}>VISA</Text>
    </View>
  );
}
function MastercardLogo({ width = 48, height = 30 }: { width?: number; height?: number }) {
  return (
    <View style={[cbStyles.base, { width, height, backgroundColor: '#252525', borderRadius: 5, overflow: 'hidden' }]}>
      <View style={[cbStyles.mcLeft, { backgroundColor: '#EB001B' }]} />
      <View style={[cbStyles.mcRight, { backgroundColor: '#F79E1B' }]} />
      <View style={[cbStyles.mcOverlap, { backgroundColor: '#FF5F00' }]} />
      <Text style={cbStyles.mcText}>mc</Text>
    </View>
  );
}
function AmexLogo({ width = 48, height = 30 }: { width?: number; height?: number }) {
  return (
    <View style={[cbStyles.base, { width, height, backgroundColor: '#2E77BC', borderRadius: 5 }]}>
      <Text style={cbStyles.amexText}>AMEX</Text>
    </View>
  );
}
function DiscoverLogo({ width = 48, height = 30 }: { width?: number; height?: number }) {
  return (
    <View style={[cbStyles.base, { width, height, backgroundColor: '#FFFFFF', borderRadius: 5, borderWidth: 1, borderColor: '#E0E0E0' }]}>
      <Text style={cbStyles.discoverText}>DISC</Text>
      <View style={cbStyles.discoverDot} />
    </View>
  );
}
function UnionPayLogo({ width = 48, height = 30 }: { width?: number; height?: number }) {
  return (
    <View style={[cbStyles.base, { width, height, backgroundColor: '#CE0000', borderRadius: 5 }]}>
      <Text style={cbStyles.unionpayText}>UP</Text>
    </View>
  );
}

const cbStyles = StyleSheet.create({
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
// Reusable Glass Section
// ─────────────────────────────────────────────────────────
function GlassSection({ T, children, style, glowColor }: { T: ReturnType<typeof useT>; children: React.ReactNode; style?: any; glowColor?: string }) {
  return (
    <View style={[{ marginBottom: 14 }, style]}>
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

function SectionHeader({ label, T, accentColor }: { label: string; T: ReturnType<typeof useT>; accentColor?: string }) {
  return (
    <View style={s.sectionHeaderRow}>
      <View style={[s.sectionLine, { backgroundColor: accentColor || T.textMuted, opacity: 0.4 }]} />
      <Text style={[s.sectionLabel, { color: T.textSec }]}>{label}</Text>
      <View style={[s.sectionLine, { backgroundColor: accentColor || T.textMuted, opacity: 0.4, flex: 1 }]} />
    </View>
  );
}

function FieldRow({
  icon, label, focused, accentColor, T, children,
}: {
  icon: string; label: string; focused: boolean; accentColor: string; T: ReturnType<typeof useT>; children: React.ReactNode;
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

  // ── Country picker state ──
  const [country, setCountry] = useState<Country>(() => guessCountryFromLocale());
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [phoneNational, setPhoneNational] = useState('');
  const phoneValid = phoneNational.length >= 4 && validatePhone(country.dial + phoneNational, country.code);
  const fullPhone = `${country.dial}${phoneNational}`;

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

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: T.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle={T.dark ? 'light-content' : 'dark-content'} />

      {/* Country Picker Modal */}
      <CountryPickerModal
        visible={showCountryPicker}
        selected={country}
        onSelect={setCountry}
        onClose={() => setShowCountryPicker(false)}
        T={T}
        accentColor={planColor}
      />

      {/* Header */}
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
        {/* Plan card */}
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

        {/* Contact */}
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
          <FieldRow icon="call-outline" label="Phone number" focused={focusedField === 'phone'} accentColor={planColor} T={T}>
            <CustomPhoneInput
              country={country}
              value={phoneNational}
              onChange={setPhoneNational}
              onCountryPress={() => setShowCountryPicker(true)}
              focused={focusedField === 'phone'}
              accentColor={planColor}
              T={T}
            />
          </FieldRow>
          {phoneNational.length > 3 && !phoneValid && (
            <View style={[s.couponMsg, { backgroundColor: T.couponError + '12', marginHorizontal: 16, marginBottom: 10, borderRadius: 10 }]}>
              <Ionicons name="alert-circle" size={13} color={T.couponError} />
              <Text style={[s.couponMsgText, { color: T.couponError }]}>Invalid phone number for {country.name}</Text>
            </View>
          )}
        </GlassSection>

        {/* Promo code */}
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
              marginHorizontal: 16, marginBottom: 12, borderRadius: 12,
            }]}>
              <Ionicons name={couponResult.valid ? 'checkmark-circle' : 'close-circle'} size={14} color={couponResult.valid ? T.couponApplied : T.couponError} />
              <Text style={[s.couponMsgText, { color: couponResult.valid ? T.couponApplied : T.couponError }]}>{couponResult.message}</Text>
            </View>
          )}
        </GlassSection>

        {/* Payment method tabs */}
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

        {/* Card entry */}
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
                <Text style={[s.fieldLabel, { color: T.textSec, marginBottom: 10 }]}>Card number · Expiry · CVV</Text>
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

        {/* Apple Pay */}
        {method === 'apple' && (
          <GlassSection T={T} glowColor="#000">
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

        {/* Google Pay */}
        {method === 'google' && (
          <GlassSection T={T} glowColor="#4285F4">
            <View style={s.payInfoCard}>
              <View style={[s.payIconBig, { backgroundColor: '#FFFFFF' }]}>
                <Text style={{ fontSize: 24, fontWeight: '800', color: '#4285F4' }}>G</Text>
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

        {/* MonCash */}
        {method === 'moncash' && (
          <GlassSection T={T} glowColor="#DC143C">
            <View style={s.payInfoCard}>
              <View style={[s.payIconBig, { backgroundColor: '#DC143C' }]}>
                <Text style={s.moncashM}>M</Text>
              </View>
              <Text style={[s.payInfoTitle, { color: T.text }]}>MonCash</Text>
              <Text style={[s.payInfoSub, { color: T.textSec }]}>
                Pay securely with your Digicel MonCash account.{'\n'}
                Available for Haiti and USA users.
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

        <View style={s.secureRow}>
          <Ionicons name="shield-checkmark" size={13} color={T.secureText} />
          <Text style={[s.secureText, { color: T.secureText }]}>
            {'  '}Secured by {method === 'moncash' ? 'Digicel MonCash' : 'Stripe'}  ·  Cancel anytime
          </Text>
        </View>
      </ScrollView>

      {/* Bottom CTA */}
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
  glowLayer: {
    position: 'absolute',
    top: -2, left: 8, right: 8, bottom: -2,
    borderRadius: 24,
  },
  glassBase: {
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
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
  scroll: { paddingHorizontal: 16, paddingTop: 20, gap: 12 },
  sectionHeaderRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6,
  },
  sectionLine: { width: 16, height: 2, borderRadius: 1 },
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
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
  tabsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 14 },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 11, borderRadius: 50,
    minWidth: 90, justifyContent: 'center',
  },
  tabText: { fontSize: 13, fontWeight: '600' },
  cardFallback: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    margin: 16, borderRadius: 12, padding: 14, borderWidth: 1, opacity: 0.7,
  },
  cardFallbackText: { fontSize: 13, flex: 1, lineHeight: 18 },
  cardBrandsRow: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 16, paddingTop: 6, flexWrap: 'wrap',
  },
  payInfoCard: { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 24, gap: 10 },
  payIconBig: { width: 72, height: 72, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  payInfoTitle: { fontSize: 20, fontWeight: '700' },
  payInfoSub: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  payInfoAmount: {
    borderWidth: 1, borderRadius: 22,
    paddingHorizontal: 16, paddingVertical: 8, marginTop: 4,
  },
  payInfoAmountText: { fontSize: 15, fontWeight: '700' },
  moncashM: { color: '#FFF', fontSize: 34, fontWeight: '900' },
  moncashNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, marginTop: 4,
  },
  moncashNoteText: { fontSize: 11, flex: 1, lineHeight: 16 },
  secureRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 6 },
  secureText: { fontSize: 12, lineHeight: 18 },
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
  webFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  webFallbackIcon: {
    width: 80, height: 80, borderRadius: 24, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, marginBottom: 4,
  },
  webFallbackTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  webFallbackSub: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
});
