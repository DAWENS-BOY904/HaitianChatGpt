/**
 * PHONE ENTRY - PRODUCTION PHONE AUTHENTICATION
 * Real Supabase Phone Auth with Country Detection & Auto-Formatting
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useRouter } from 'expo-router';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSupabaseClient } from '@/template';

// ==================== COUNTRY DATA ====================

interface Country {
  code: string;
  name: string;
  dialCode: string;
  flag: string;
  format?: string;
}

const COUNTRIES: Country[] = [
  { code: 'US', name: 'United States', dialCode: '+1', flag: '🇺🇸', format: '(###) ###-####' },
  { code: 'HT', name: 'Haiti', dialCode: '+509', flag: '🇭🇹', format: '## ## ####' },
  { code: 'CA', name: 'Canada', dialCode: '+1', flag: '🇨🇦', format: '(###) ###-####' },
  { code: 'GB', name: 'United Kingdom', dialCode: '+44', flag: '🇬🇧', format: '#### ######' },
  { code: 'FR', name: 'France', dialCode: '+33', flag: '🇫🇷', format: '# ## ## ## ##' },
  { code: 'DE', name: 'Germany', dialCode: '+49', flag: '🇩🇪', format: '### #######' },
  { code: 'IT', name: 'Italy', dialCode: '+39', flag: '🇮🇹', format: '### ### ####' },
  { code: 'ES', name: 'Spain', dialCode: '+34', flag: '🇪🇸', format: '### ## ## ##' },
  { code: 'CN', name: 'China', dialCode: '+86', flag: '🇨🇳', format: '### #### ####' },
  { code: 'JP', name: 'Japan', dialCode: '+81', flag: '🇯🇵', format: '##-####-####' },
  { code: 'IN', name: 'India', dialCode: '+91', flag: '🇮🇳', format: '##### #####' },
  { code: 'BR', name: 'Brazil', dialCode: '+55', flag: '🇧🇷', format: '(##) #####-####' },
  { code: 'MX', name: 'Mexico', dialCode: '+52', flag: '🇲🇽', format: '### ### ####' },
  { code: 'AU', name: 'Australia', dialCode: '+61', flag: '🇦🇺', format: '### ### ###' },
  { code: 'RU', name: 'Russia', dialCode: '+7', flag: '🇷🇺', format: '(###) ###-##-##' },
  { code: 'ZA', name: 'South Africa', dialCode: '+27', flag: '🇿🇦', format: '## ### ####' },
  { code: 'NG', name: 'Nigeria', dialCode: '+234', flag: '🇳🇬', format: '### ### ####' },
  { code: 'EG', name: 'Egypt', dialCode: '+20', flag: '🇪🇬', format: '### ### ####' },
  { code: 'KR', name: 'South Korea', dialCode: '+82', flag: '🇰🇷', format: '##-####-####' },
  { code: 'AR', name: 'Argentina', dialCode: '+54', flag: '🇦🇷', format: '## ####-####' },
];

// ==================== PHONE FORMATTER ====================

function formatPhoneNumber(number: string, format?: string): string {
  if (!format) return number;
  
  const digits = number.replace(/\D/g, '');
  let formatted = '';
  let digitIndex = 0;
  
  for (let i = 0; i < format.length && digitIndex < digits.length; i++) {
    if (format[i] === '#') {
      formatted += digits[digitIndex];
      digitIndex++;
    } else {
      formatted += format[i];
    }
  }
  
  return formatted;
}

// ==================== MAIN COMPONENT ====================

export default function PhoneEntryScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const supabase = getSupabaseClient();
  
  const [selectedCountry, setSelectedCountry] = useState<Country>(COUNTRIES[0]);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [formattedNumber, setFormattedNumber] = useState('');
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const phoneInputRef = useRef<TextInput>(null);

  // Auto-detect country on mount
  useEffect(() => {
    detectCountry();
  }, []);

  // Auto-format phone number as user types
  useEffect(() => {
    const digits = phoneNumber.replace(/\D/g, '');
    const formatted = formatPhoneNumber(digits, selectedCountry.format);
    setFormattedNumber(formatted);
  }, [phoneNumber, selectedCountry]);

  const detectCountry = () => {
    // Try to detect country from locale
    try {
      const locale = Platform.OS === 'web' 
        ? navigator.language 
        : require('expo-localization').locale;
      
      const countryCode = locale.split('-')[1] || locale.split('_')[1];
      
      if (countryCode) {
        const detectedCountry = COUNTRIES.find(c => c.code === countryCode.toUpperCase());
        if (detectedCountry) {
          setSelectedCountry(detectedCountry);
          console.log('✅ Auto-detected country:', detectedCountry.name);
        }
      }
    } catch (err) {
      console.log('Could not auto-detect country:', err);
    }
  };

  const handleCountrySelect = (country: Country) => {
    setSelectedCountry(country);
    setShowCountryPicker(false);
    setSearchQuery('');
    setTimeout(() => phoneInputRef.current?.focus(), 100);
  };

  const handleContinue = async () => {
    if (!phoneNumber.trim()) {
      setError('Please enter your phone number');
      return;
    }

    const digits = phoneNumber.replace(/\D/g, '');
    if (digits.length < 8) {
      setError('Phone number is too short');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const fullPhoneNumber = `${selectedCountry.dialCode}${digits}`;
      console.log('📞 Sending OTP to:', fullPhoneNumber);

      // CRITICAL: Real Supabase Phone Auth
      const { data, error: otpError } = await supabase.auth.signInWithOtp({
        phone: fullPhoneNumber,
      });

      if (otpError) {
        console.error('❌ OTP send failed:', otpError);
        throw otpError;
      }

      console.log('✅ OTP sent successfully');

      // Navigate to OTP verification page
      router.push({
        pathname: '/verify-code',
        params: {
          phone: fullPhoneNumber,
          formattedPhone: `${selectedCountry.dialCode} ${formattedNumber}`,
          countryCode: selectedCountry.code,
        },
      });
    } catch (err: any) {
      console.error('Phone auth error:', err);
      setError(err.message || 'Failed to send verification code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const filteredCountries = COUNTRIES.filter(country =>
    country.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    country.dialCode.includes(searchQuery)
  );

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.md,
      paddingTop: insets.top + Spacing.sm,
      paddingBottom: Spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: {
      padding: Spacing.sm,
    },
    headerTitle: {
      ...Typography.heading,
      fontSize: 20,
      marginLeft: Spacing.md,
      flex: 1,
    },
    content: {
      flex: 1,
      padding: Spacing.xl,
    },
    title: {
      ...Typography.heading,
      fontSize: 28,
      fontWeight: '700',
      marginBottom: Spacing.sm,
    },
    subtitle: {
      ...Typography.body,
      color: colors.textSecondary,
      marginBottom: Spacing.xl,
      fontSize: 16,
    },
    inputGroup: {
      marginBottom: Spacing.xl,
    },
    label: {
      ...Typography.body,
      fontWeight: '600',
      marginBottom: Spacing.sm,
    },
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
    flag: {
      fontSize: 32,
      marginRight: Spacing.sm,
    },
    countryInfo: {
      flex: 1,
    },
    countryName: {
      ...Typography.body,
      fontWeight: '600',
    },
    dialCode: {
      ...Typography.caption,
      color: colors.textSecondary,
    },
    phoneInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: BorderRadius.lg,
      borderWidth: 2,
      borderColor: colors.border,
      paddingHorizontal: Spacing.md,
    },
    phoneInputContainerFocused: {
      borderColor: colors.primary,
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
    errorText: {
      ...Typography.caption,
      color: colors.danger,
      marginTop: Spacing.sm,
    },
    continueButton: {
      backgroundColor: colors.primary,
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
      alignItems: 'center',
      marginTop: 'auto',
    },
    continueButtonDisabled: {
      opacity: 0.5,
    },
    continueButtonText: {
      ...Typography.body,
      color: '#FFFFFF',
      fontWeight: '700',
      fontSize: 18,
    },
    // Country Picker Modal
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: colors.background,
      borderTopLeftRadius: BorderRadius.xl,
      borderTopRightRadius: BorderRadius.xl,
      maxHeight: '80%',
      paddingTop: Spacing.md,
      paddingBottom: Math.max(insets.bottom, Spacing.md),
    },
    modalHandle: {
      width: 40,
      height: 4,
      backgroundColor: colors.border,
      borderRadius: 2,
      alignSelf: 'center',
      marginBottom: Spacing.md,
    },
    modalHeader: {
      paddingHorizontal: Spacing.md,
      marginBottom: Spacing.md,
    },
    modalTitle: {
      ...Typography.heading,
      fontSize: 20,
      marginBottom: Spacing.md,
    },
    searchInput: {
      backgroundColor: colors.surface,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      ...Typography.body,
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.border,
    },
    countryList: {
      paddingHorizontal: Spacing.md,
    },
    countryItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: Spacing.md,
      borderRadius: BorderRadius.md,
      marginBottom: Spacing.xs,
    },
    countryItemSelected: {
      backgroundColor: `${colors.primary}15`,
    },
    countryItemFlag: {
      fontSize: 28,
      marginRight: Spacing.md,
      width: 40,
      textAlign: 'center',
    },
    countryItemInfo: {
      flex: 1,
    },
    countryItemName: {
      ...Typography.body,
      fontWeight: '500',
    },
    countryItemCode: {
      ...Typography.caption,
      color: colors.textSecondary,
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Phone Login</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>Enter your phone</Text>
        <Text style={styles.subtitle}>
          We'll send you a verification code to confirm your number
        </Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Country</Text>
          <TouchableOpacity
            style={styles.countrySelector}
            onPress={() => setShowCountryPicker(true)}
          >
            <Text style={styles.flag}>{selectedCountry.flag}</Text>
            <View style={styles.countryInfo}>
              <Text style={styles.countryName}>{selectedCountry.name}</Text>
              <Text style={styles.dialCode}>{selectedCountry.dialCode}</Text>
            </View>
            <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          <Text style={styles.label}>Phone Number</Text>
          <View style={[styles.phoneInputContainer]}>
            <Text style={styles.dialCodePrefix}>{selectedCountry.dialCode}</Text>
            <TextInput
              ref={phoneInputRef}
              style={styles.phoneInput}
              placeholder="Phone number"
              placeholderTextColor={colors.textSecondary}
              keyboardType="phone-pad"
              value={formattedNumber}
              onChangeText={(text) => {
                const digits = text.replace(/\D/g, '');
                setPhoneNumber(digits);
              }}
              autoFocus
            />
          </View>

          {error && <Text style={styles.errorText}>{error}</Text>}
        </View>

        <TouchableOpacity
          style={[styles.continueButton, (loading || !phoneNumber) && styles.continueButtonDisabled]}
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
              <TextInput
                style={styles.searchInput}
                placeholder="Search countries..."
                placeholderTextColor={colors.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            <ScrollView style={styles.countryList} showsVerticalScrollIndicator={false}>
              {filteredCountries.map((country) => (
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
                    <Ionicons name="checkmark" size={24} color={colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}
