/**
 * PHONE ENTRY - PHONE AUTHENTICATION
 * Static Country List, Auto-Detection & Formatting (no external deps)
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useRouter } from 'expo-router';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSupabaseClient } from '@/template';
import * as Localization from 'expo-localization';

// ==================== TYPES ====================

interface Country {
  code: string;
  name: string;
  dialCode: string;
  flag: string;
  region: string;
}

// ==================== STATIC COUNTRY DATA ====================

const COUNTRIES: Country[] = [
  // North America
  { code: 'US', name: 'United States', dialCode: '+1', flag: '🇺🇸', region: 'North America' },
  { code: 'CA', name: 'Canada', dialCode: '+1', flag: '🇨🇦', region: 'North America' },
  { code: 'MX', name: 'Mexico', dialCode: '+52', flag: '🇲🇽', region: 'North America' },
  { code: 'HT', name: 'Haiti', dialCode: '+509', flag: '🇭🇹', region: 'North America' },
  { code: 'CU', name: 'Cuba', dialCode: '+53', flag: '🇨🇺', region: 'North America' },
  { code: 'DO', name: 'Dominican Republic', dialCode: '+1', flag: '🇩🇴', region: 'North America' },
  { code: 'JM', name: 'Jamaica', dialCode: '+1', flag: '🇯🇲', region: 'North America' },
  { code: 'BS', name: 'Bahamas', dialCode: '+1', flag: '🇧🇸', region: 'North America' },
  { code: 'BZ', name: 'Belize', dialCode: '+501', flag: '🇧🇿', region: 'North America' },
  { code: 'CR', name: 'Costa Rica', dialCode: '+506', flag: '🇨🇷', region: 'North America' },
  { code: 'SV', name: 'El Salvador', dialCode: '+503', flag: '🇸🇻', region: 'North America' },
  { code: 'GT', name: 'Guatemala', dialCode: '+502', flag: '🇬🇹', region: 'North America' },
  { code: 'HN', name: 'Honduras', dialCode: '+504', flag: '🇭🇳', region: 'North America' },
  { code: 'NI', name: 'Nicaragua', dialCode: '+505', flag: '🇳🇮', region: 'North America' },
  { code: 'PA', name: 'Panama', dialCode: '+507', flag: '🇵🇦', region: 'North America' },
  { code: 'TT', name: 'Trinidad and Tobago', dialCode: '+1', flag: '🇹🇹', region: 'North America' },
  // South America
  { code: 'BR', name: 'Brazil', dialCode: '+55', flag: '🇧🇷', region: 'South America' },
  { code: 'AR', name: 'Argentina', dialCode: '+54', flag: '🇦🇷', region: 'South America' },
  { code: 'CL', name: 'Chile', dialCode: '+56', flag: '🇨🇱', region: 'South America' },
  { code: 'CO', name: 'Colombia', dialCode: '+57', flag: '🇨🇴', region: 'South America' },
  { code: 'PE', name: 'Peru', dialCode: '+51', flag: '🇵🇪', region: 'South America' },
  { code: 'VE', name: 'Venezuela', dialCode: '+58', flag: '🇻🇪', region: 'South America' },
  { code: 'EC', name: 'Ecuador', dialCode: '+593', flag: '🇪🇨', region: 'South America' },
  { code: 'BO', name: 'Bolivia', dialCode: '+591', flag: '🇧🇴', region: 'South America' },
  { code: 'PY', name: 'Paraguay', dialCode: '+595', flag: '🇵🇾', region: 'South America' },
  { code: 'UY', name: 'Uruguay', dialCode: '+598', flag: '🇺🇾', region: 'South America' },
  { code: 'GY', name: 'Guyana', dialCode: '+592', flag: '🇬🇾', region: 'South America' },
  // Europe
  { code: 'GB', name: 'United Kingdom', dialCode: '+44', flag: '🇬🇧', region: 'Europe' },
  { code: 'FR', name: 'France', dialCode: '+33', flag: '🇫🇷', region: 'Europe' },
  { code: 'DE', name: 'Germany', dialCode: '+49', flag: '🇩🇪', region: 'Europe' },
  { code: 'IT', name: 'Italy', dialCode: '+39', flag: '🇮🇹', region: 'Europe' },
  { code: 'ES', name: 'Spain', dialCode: '+34', flag: '🇪🇸', region: 'Europe' },
  { code: 'PT', name: 'Portugal', dialCode: '+351', flag: '🇵🇹', region: 'Europe' },
  { code: 'NL', name: 'Netherlands', dialCode: '+31', flag: '🇳🇱', region: 'Europe' },
  { code: 'BE', name: 'Belgium', dialCode: '+32', flag: '🇧🇪', region: 'Europe' },
  { code: 'CH', name: 'Switzerland', dialCode: '+41', flag: '🇨🇭', region: 'Europe' },
  { code: 'AT', name: 'Austria', dialCode: '+43', flag: '🇦🇹', region: 'Europe' },
  { code: 'SE', name: 'Sweden', dialCode: '+46', flag: '🇸🇪', region: 'Europe' },
  { code: 'NO', name: 'Norway', dialCode: '+47', flag: '🇳🇴', region: 'Europe' },
  { code: 'DK', name: 'Denmark', dialCode: '+45', flag: '🇩🇰', region: 'Europe' },
  { code: 'FI', name: 'Finland', dialCode: '+358', flag: '🇫🇮', region: 'Europe' },
  { code: 'PL', name: 'Poland', dialCode: '+48', flag: '🇵🇱', region: 'Europe' },
  { code: 'CZ', name: 'Czech Republic', dialCode: '+420', flag: '🇨🇿', region: 'Europe' },
  { code: 'HU', name: 'Hungary', dialCode: '+36', flag: '🇭🇺', region: 'Europe' },
  { code: 'RO', name: 'Romania', dialCode: '+40', flag: '🇷🇴', region: 'Europe' },
  { code: 'BG', name: 'Bulgaria', dialCode: '+359', flag: '🇧🇬', region: 'Europe' },
  { code: 'HR', name: 'Croatia', dialCode: '+385', flag: '🇭🇷', region: 'Europe' },
  { code: 'IE', name: 'Ireland', dialCode: '+353', flag: '🇮🇪', region: 'Europe' },
  { code: 'GR', name: 'Greece', dialCode: '+30', flag: '🇬🇷', region: 'Europe' },
  { code: 'RU', name: 'Russia', dialCode: '+7', flag: '🇷🇺', region: 'Europe' },
  { code: 'UA', name: 'Ukraine', dialCode: '+380', flag: '🇺🇦', region: 'Europe' },
  { code: 'TR', name: 'Turkey', dialCode: '+90', flag: '🇹🇷', region: 'Europe' },
  // Africa
  { code: 'ZA', name: 'South Africa', dialCode: '+27', flag: '🇿🇦', region: 'Africa' },
  { code: 'NG', name: 'Nigeria', dialCode: '+234', flag: '🇳🇬', region: 'Africa' },
  { code: 'EG', name: 'Egypt', dialCode: '+20', flag: '🇪🇬', region: 'Africa' },
  { code: 'KE', name: 'Kenya', dialCode: '+254', flag: '🇰🇪', region: 'Africa' },
  { code: 'ET', name: 'Ethiopia', dialCode: '+251', flag: '🇪🇹', region: 'Africa' },
  { code: 'GH', name: 'Ghana', dialCode: '+233', flag: '🇬🇭', region: 'Africa' },
  { code: 'TZ', name: 'Tanzania', dialCode: '+255', flag: '🇹🇿', region: 'Africa' },
  { code: 'MA', name: 'Morocco', dialCode: '+212', flag: '🇲🇦', region: 'Africa' },
  { code: 'DZ', name: 'Algeria', dialCode: '+213', flag: '🇩🇿', region: 'Africa' },
  { code: 'TN', name: 'Tunisia', dialCode: '+216', flag: '🇹🇳', region: 'Africa' },
  { code: 'SN', name: 'Senegal', dialCode: '+221', flag: '🇸🇳', region: 'Africa' },
  { code: 'CI', name: 'Ivory Coast', dialCode: '+225', flag: '🇨🇮', region: 'Africa' },
  { code: 'CM', name: 'Cameroon', dialCode: '+237', flag: '🇨🇲', region: 'Africa' },
  { code: 'CD', name: 'DR Congo', dialCode: '+243', flag: '🇨🇩', region: 'Africa' },
  { code: 'AO', name: 'Angola', dialCode: '+244', flag: '🇦🇴', region: 'Africa' },
  { code: 'MZ', name: 'Mozambique', dialCode: '+258', flag: '🇲🇿', region: 'Africa' },
  { code: 'MG', name: 'Madagascar', dialCode: '+261', flag: '🇲🇬', region: 'Africa' },
  { code: 'MU', name: 'Mauritius', dialCode: '+230', flag: '🇲🇺', region: 'Africa' },
  // Asia
  { code: 'CN', name: 'China', dialCode: '+86', flag: '🇨🇳', region: 'Asia' },
  { code: 'JP', name: 'Japan', dialCode: '+81', flag: '🇯🇵', region: 'Asia' },
  { code: 'IN', name: 'India', dialCode: '+91', flag: '🇮🇳', region: 'Asia' },
  { code: 'KR', name: 'South Korea', dialCode: '+82', flag: '🇰🇷', region: 'Asia' },
  { code: 'ID', name: 'Indonesia', dialCode: '+62', flag: '🇮🇩', region: 'Asia' },
  { code: 'TH', name: 'Thailand', dialCode: '+66', flag: '🇹🇭', region: 'Asia' },
  { code: 'VN', name: 'Vietnam', dialCode: '+84', flag: '🇻🇳', region: 'Asia' },
  { code: 'MY', name: 'Malaysia', dialCode: '+60', flag: '🇲🇾', region: 'Asia' },
  { code: 'PH', name: 'Philippines', dialCode: '+63', flag: '🇵🇭', region: 'Asia' },
  { code: 'SG', name: 'Singapore', dialCode: '+65', flag: '🇸🇬', region: 'Asia' },
  { code: 'BD', name: 'Bangladesh', dialCode: '+880', flag: '🇧🇩', region: 'Asia' },
  { code: 'PK', name: 'Pakistan', dialCode: '+92', flag: '🇵🇰', region: 'Asia' },
  { code: 'LK', name: 'Sri Lanka', dialCode: '+94', flag: '🇱🇰', region: 'Asia' },
  { code: 'NP', name: 'Nepal', dialCode: '+977', flag: '🇳🇵', region: 'Asia' },
  { code: 'SA', name: 'Saudi Arabia', dialCode: '+966', flag: '🇸🇦', region: 'Asia' },
  { code: 'AE', name: 'UAE', dialCode: '+971', flag: '🇦🇪', region: 'Asia' },
  { code: 'QA', name: 'Qatar', dialCode: '+974', flag: '🇶🇦', region: 'Asia' },
  { code: 'KW', name: 'Kuwait', dialCode: '+965', flag: '🇰🇼', region: 'Asia' },
  { code: 'BH', name: 'Bahrain', dialCode: '+973', flag: '🇧🇭', region: 'Asia' },
  { code: 'OM', name: 'Oman', dialCode: '+968', flag: '🇴🇲', region: 'Asia' },
  { code: 'JO', name: 'Jordan', dialCode: '+962', flag: '🇯🇴', region: 'Asia' },
  { code: 'LB', name: 'Lebanon', dialCode: '+961', flag: '🇱🇧', region: 'Asia' },
  { code: 'IL', name: 'Israel', dialCode: '+972', flag: '🇮🇱', region: 'Asia' },
  { code: 'IR', name: 'Iran', dialCode: '+98', flag: '🇮🇷', region: 'Asia' },
  { code: 'AF', name: 'Afghanistan', dialCode: '+93', flag: '🇦🇫', region: 'Asia' },
  { code: 'TW', name: 'Taiwan', dialCode: '+886', flag: '🇹🇼', region: 'Asia' },
  { code: 'HK', name: 'Hong Kong', dialCode: '+852', flag: '🇭🇰', region: 'Asia' },
  // Oceania
  { code: 'AU', name: 'Australia', dialCode: '+61', flag: '🇦🇺', region: 'Oceania' },
  { code: 'NZ', name: 'New Zealand', dialCode: '+64', flag: '🇳🇿', region: 'Oceania' },
  { code: 'FJ', name: 'Fiji', dialCode: '+679', flag: '🇫🇯', region: 'Oceania' },
  { code: 'PG', name: 'Papua New Guinea', dialCode: '+675', flag: '🇵🇬', region: 'Oceania' },
];

// Sort alphabetically within each region
const SORTED_COUNTRIES = [...COUNTRIES].sort((a, b) => a.name.localeCompare(b.name));

// ==================== UTILITY FUNCTIONS ====================

function basicValidatePhone(number: string): boolean {
  const digits = number.replace(/\D/g, '');
  return digits.length >= 6 && digits.length <= 15;
}

function formatPhoneDisplay(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  if (digits.length <= 10) return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 10)} ${digits.slice(10)}`;
}

// ==================== MAIN COMPONENT ====================

export default function PhoneEntryScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const supabase = getSupabaseClient();

  const [selectedCountry, setSelectedCountry] = useState<Country>(
    SORTED_COUNTRIES.find(c => c.code === 'US') || SORTED_COUNTRIES[0]
  );
  const [phoneNumber, setPhoneNumber] = useState('');
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const phoneInputRef = useRef<TextInput>(null);

  const filteredCountries = useMemo(() => {
    if (!searchQuery.trim()) return SORTED_COUNTRIES;
    const q = searchQuery.toLowerCase();
    return SORTED_COUNTRIES.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.dialCode.includes(q) ||
      c.code.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const groupedCountries = useMemo(() => {
    const groups: Record<string, Country[]> = {};
    filteredCountries.forEach(c => {
      if (!groups[c.region]) groups[c.region] = [];
      groups[c.region].push(c);
    });
    const order = ['North America', 'South America', 'Europe', 'Africa', 'Asia', 'Oceania'];
    return Object.entries(groups).sort(([a], [b]) => {
      const ia = order.indexOf(a), ib = order.indexOf(b);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });
  }, [filteredCountries]);

  // Auto-detect country on mount
  useEffect(() => {
    try {
      const region = (Localization as any).region || '';
      if (region) {
        const found = SORTED_COUNTRIES.find(c => c.code === region.toUpperCase());
        if (found) setSelectedCountry(found);
      }
    } catch (_) {}
  }, []);

  const handleCountrySelect = useCallback((country: Country) => {
    setSelectedCountry(country);
    setShowCountryPicker(false);
    setSearchQuery('');
    setTimeout(() => phoneInputRef.current?.focus(), 100);
  }, []);

  const handlePhoneChange = (text: string) => {
    const digits = text.replace(/\D/g, '');
    setPhoneNumber(digits);
    setError('');
  };

  const handleContinue = async () => {
    if (!phoneNumber.trim()) {
      setError('Please enter your phone number');
      return;
    }
    if (!basicValidatePhone(phoneNumber)) {
      setError('Please enter a valid phone number');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const fullPhone = `${selectedCountry.dialCode}${phoneNumber}`;

      const { error: otpError } = await supabase.auth.signInWithOtp({
        phone: fullPhone,
      });

      if (otpError) throw otpError;

      router.push({
        pathname: '/verify-code',
        params: {
          phone: fullPhone,
          formattedPhone: `${selectedCountry.flag} ${selectedCountry.dialCode} ${formatPhoneDisplay(phoneNumber)}`,
          countryCode: selectedCountry.code,
        },
      });
    } catch (err: any) {
      setError(err.message || 'Failed to send verification code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    centered: { justifyContent: 'center', alignItems: 'center' },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.md,
      paddingTop: insets.top + Spacing.sm,
      paddingBottom: Spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: { padding: Spacing.sm },
    headerTitle: { ...Typography.heading, fontSize: 20, marginLeft: Spacing.md, flex: 1, color: colors.text },
    content: { flex: 1, padding: Spacing.xl },
    title: { ...Typography.heading, fontSize: 28, fontWeight: '700', marginBottom: Spacing.sm, color: colors.text },
    subtitle: { ...Typography.body, color: colors.textSecondary, marginBottom: Spacing.xl, fontSize: 16 },
    label: { ...Typography.body, fontWeight: '600', marginBottom: Spacing.sm, color: colors.text },
    inputGroup: { marginBottom: Spacing.xl },
    countrySelector: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      marginBottom: Spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    flag: { fontSize: 32, marginRight: Spacing.sm },
    countryInfo: { flex: 1 },
    countryName: { ...Typography.body, fontWeight: '600', color: colors.text },
    dialCode: { ...Typography.caption, color: colors.textSecondary },
    phoneInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: BorderRadius.lg,
      borderWidth: 2,
      borderColor: colors.border,
      paddingHorizontal: Spacing.md,
    },
    dialCodePrefix: {
      ...Typography.body,
      fontSize: 18,
      fontWeight: '600',
      color: colors.textSecondary,
      marginRight: Spacing.sm,
    },
    phoneInput: {
      flex: 1,
      ...Typography.body,
      fontSize: 18,
      color: colors.text,
      paddingVertical: Platform.OS === 'ios' ? Spacing.md : Spacing.sm,
    },
    hintText: { ...Typography.caption, color: colors.textSecondary, marginTop: Spacing.sm },
    errorText: { ...Typography.caption, color: '#FF453A', marginTop: Spacing.sm },
    continueButton: {
      backgroundColor: colors.primary,
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
      alignItems: 'center',
      marginTop: 'auto',
    },
    continueButtonDisabled: { opacity: 0.5 },
    continueButtonText: { ...Typography.body, color: '#FFFFFF', fontWeight: '700', fontSize: 18 },
    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: {
      backgroundColor: colors.background,
      borderTopLeftRadius: BorderRadius.xl,
      borderTopRightRadius: BorderRadius.xl,
      maxHeight: '85%',
      paddingTop: Spacing.md,
      paddingBottom: Math.max(insets.bottom, Spacing.md),
    },
    modalHandle: {
      width: 40, height: 4, borderRadius: 2,
      backgroundColor: colors.border,
      alignSelf: 'center', marginBottom: Spacing.md,
    },
    modalHeader: { paddingHorizontal: Spacing.md, marginBottom: Spacing.md },
    modalTitle: { ...Typography.heading, fontSize: 20, marginBottom: Spacing.md, color: colors.text },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: BorderRadius.md,
      paddingHorizontal: Spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    searchIcon: { marginRight: Spacing.sm },
    searchInput: { flex: 1, ...Typography.body, color: colors.text, paddingVertical: Spacing.md },
    sectionHeader: {
      backgroundColor: colors.background,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    sectionHeaderText: {
      ...Typography.caption,
      fontWeight: '700',
      color: colors.primary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    countryItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: Spacing.md,
      borderRadius: BorderRadius.md,
      marginHorizontal: Spacing.md,
      marginBottom: 2,
    },
    countryItemSelected: { backgroundColor: `${colors.primary}18` },
    countryItemFlag: { fontSize: 26, marginRight: Spacing.md, width: 36, textAlign: 'center' },
    countryItemInfo: { flex: 1 },
    countryItemName: { ...Typography.body, fontWeight: '500', color: colors.text },
    countryItemCode: { ...Typography.caption, color: colors.textSecondary },
    emptyContainer: { padding: Spacing.xl, alignItems: 'center' },
    emptyText: { ...Typography.body, color: colors.textSecondary, marginTop: Spacing.md },
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Phone Login</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>Enter your phone</Text>
        <Text style={styles.subtitle}>
          {"We'll send you a verification code to confirm your number"}
        </Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Country</Text>
          <TouchableOpacity style={styles.countrySelector} onPress={() => setShowCountryPicker(true)}>
            <Text style={styles.flag}>{selectedCountry.flag}</Text>
            <View style={styles.countryInfo}>
              <Text style={styles.countryName}>{selectedCountry.name}</Text>
              <Text style={styles.dialCode}>{selectedCountry.dialCode}</Text>
            </View>
            <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          <Text style={styles.label}>Phone Number</Text>
          <View style={[styles.phoneInputContainer, phoneNumber.length > 0 && { borderColor: colors.primary }]}>
            <Text style={styles.dialCodePrefix}>{selectedCountry.dialCode}</Text>
            <TextInput
              ref={phoneInputRef}
              style={styles.phoneInput}
              placeholder="Phone number"
              placeholderTextColor={colors.textSecondary}
              keyboardType="phone-pad"
              value={formatPhoneDisplay(phoneNumber)}
              onChangeText={handlePhoneChange}
              autoFocus
              textContentType="telephoneNumber"
              autoComplete="tel"
            />
          </View>

          {error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : (
            <Text style={styles.hintText}>
              {'Enter your phone number without the country code'}
            </Text>
          )}
        </View>

        <TouchableOpacity
          style={[
            styles.continueButton,
            (loading || !phoneNumber) && styles.continueButtonDisabled,
          ]}
          onPress={handleContinue}
          disabled={loading || !phoneNumber}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.continueButtonText}>Continue</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Country Picker Modal */}
      <Modal
        visible={showCountryPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCountryPicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowCountryPicker(false)}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHandle} />

            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Country</Text>
              <View style={styles.searchContainer}>
                <Ionicons name="search" size={20} color={colors.textSecondary} style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search country or code..."
                  placeholderTextColor={colors.textSecondary}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoFocus
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {groupedCountries.map(([region, regionCountries]) => (
                <View key={region}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionHeaderText}>{region}</Text>
                  </View>
                  {regionCountries.map(country => (
                    <TouchableOpacity
                      key={country.code}
                      style={[
                        styles.countryItem,
                        selectedCountry.code === country.code && styles.countryItemSelected,
                      ]}
                      onPress={() => handleCountrySelect(country)}
                    >
                      <Text style={styles.countryItemFlag}>{country.flag}</Text>
                      <View style={styles.countryItemInfo}>
                        <Text style={styles.countryItemName}>{country.name}</Text>
                        <Text style={styles.countryItemCode}>{country.dialCode}</Text>
                      </View>
                      {selectedCountry.code === country.code && (
                        <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              ))}

              {filteredCountries.length === 0 && (
                <View style={styles.emptyContainer}>
                  <Ionicons name="search-outline" size={48} color={colors.textSecondary} />
                  <Text style={styles.emptyText}>No countries found</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

