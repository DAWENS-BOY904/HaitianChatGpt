/**
 * PHONE ENTRY - IMPROVED PHONE AUTHENTICATION
 * Dynamic Country List, Auto-Detection & Better Formatting
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
  Alert,
  Platform,
  FlatList,
  ListRenderItem,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useRouter } from 'expo-router';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSupabaseClient } from '@/template';
import * as Localization from 'expo-localization';
import { parsePhoneNumberFromString, AsYouType, getCountries, getCountryCallingCode } from 'libphonenumber-js';

// ==================== TYPES ====================

interface Country {
  code: string;           // ISO 3166-1 alpha-2 (e.g., 'US', 'HT')
  name: string;           // Country name
  dialCode: string;       // E.164 calling code (e.g., '+1', '+509')
  flag: string;           // Emoji flag
  region: string;         // Continent/region for grouping
}

// ==================== UTILITY FUNCTIONS ====================

/**
 * Convert country code to emoji flag
 */
function getFlagEmoji(countryCode: string): string {
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

/**
 * Get country name from code using Intl API
 */
function getCountryName(code: string): string {
  try {
    const displayNames = new Intl.DisplayNames(['en'], { type: 'region' });
    return displayNames.of(code) || code;
  } catch {
    return code;
  }
}

/**
 * Build complete country list from libphonenumber-js
 */
function buildCountryList(): Country[] {
  const countries = getCountries();
  
  return countries.map(code => {
    const dialCode = getCountryCallingCode(code);
    return {
      code,
      name: getCountryName(code),
      dialCode: `+${dialCode}`,
      flag: getFlagEmoji(code),
      region: getRegionForCountry(code),
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Get region/continent for grouping
 */
function getRegionForCountry(code: string): string {
  const regions: Record<string, string[]> = {
    'North America': ['US', 'CA', 'MX', 'HT', 'CU', 'DO', 'JM', 'PR', 'BS', 'BZ', 'CR', 'SV', 'GT', 'HN', 'NI', 'PA'],
    'South America': ['BR', 'AR', 'CL', 'CO', 'PE', 'VE', 'EC', 'BO', 'PY', 'UY', 'GY', 'SR', 'GF'],
    'Europe': ['GB', 'FR', 'DE', 'IT', 'ES', 'PT', 'NL', 'BE', 'CH', 'AT', 'SE', 'NO', 'DK', 'FI', 'PL', 'CZ', 'HU', 'RO', 'BG', 'HR', 'SI', 'SK', 'LT', 'LV', 'EE', 'IE', 'GR', 'CY', 'MT', 'LU', 'IS', 'AL', 'BA', 'MK', 'MD', 'ME', 'RS', 'UA', 'BY', 'RU', 'TR'],
    'Africa': ['ZA', 'NG', 'EG', 'KE', 'ET', 'GH', 'UG', 'TZ', 'MZ', 'ZW', 'ZM', 'MW', 'NA', 'BW', 'SZ', 'LS', 'MG', 'MU', 'SC', 'KM', 'DZ', 'MA', 'TN', 'LY', 'SD', 'SS', 'CF', 'CM', 'TD', 'NE', 'ML', 'BF', 'SN', 'GM', 'GW', 'GN', 'SL', 'LR', 'CI', 'TG', 'BJ', 'GH', 'GQ', 'GA', 'CG', 'CD', 'AO', 'ST', 'ER', 'DJ', 'SO', 'RW', 'BI', 'UG', 'KE', 'TZ', 'MW', 'MZ', 'ZM', 'ZW', 'BW', 'NA', 'ZA', 'SZ', 'LS', 'MG', 'MU', 'KM', 'SC'],
    'Asia': ['CN', 'JP', 'IN', 'KR', 'ID', 'TH', 'VN', 'MY', 'PH', 'SG', 'KH', 'LA', 'MM', 'BD', 'PK', 'LK', 'NP', 'BT', 'MV', 'AF', 'IR', 'IQ', 'SA', 'YE', 'OM', 'AE', 'QA', 'BH', 'KW', 'JO', 'LB', 'SY', 'IL', 'PS', 'TR', 'CY', 'AM', 'GE', 'AZ', 'KZ', 'UZ', 'TM', 'KG', 'TJ', 'MN', 'KP', 'TW', 'HK', 'MO'],
    'Oceania': ['AU', 'NZ', 'PG', 'FJ', 'SB', 'VU', 'NC', 'PF', 'WS', 'TO', 'KI', 'TV', 'NR', 'PW', 'MH', 'FM', 'AS', 'CK', 'NU', 'TK', 'WF', 'PN', 'GU', 'MP'],
  };

  for (const [region, codes] of Object.entries(regions)) {
    if (codes.includes(code)) return region;
  }
  return 'Other';
}

/**
 * Format phone number as user types
 */
function formatAsYouType(number: string, countryCode: string): string {
  try {
    const asYouType = new AsYouType(countryCode as any);
    return asYouType.input(number);
  } catch {
    return number;
  }
}

/**
 * Validate phone number
 */
function isValidPhoneNumber(number: string, countryCode: string): boolean {
  try {
    const phoneNumber = parsePhoneNumberFromString(number, countryCode as any);
    return phoneNumber?.isValid() || false;
  } catch {
    return false;
  }
}

// ==================== MAIN COMPONENT ====================

export default function PhoneEntryScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const supabase = getSupabaseClient();

  // State
  const [countries, setCountries] = useState<Country[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [formattedNumber, setFormattedNumber] = useState('');
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState('');

  const phoneInputRef = useRef<TextInput>(null);

  // Memoized filtered countries
  const filteredCountries = useMemo(() => {
    if (!searchQuery.trim()) return countries;
    
    const query = searchQuery.toLowerCase();
    return countries.filter(country =>
      country.name.toLowerCase().includes(query) ||
      country.dialCode.includes(query) ||
      country.code.toLowerCase().includes(query)
    );
  }, [countries, searchQuery]);

  // Group countries by region for better UX
  const groupedCountries = useMemo(() => {
    const groups: Record<string, Country[]> = {};
    
    filteredCountries.forEach(country => {
      if (!groups[country.region]) {
        groups[country.region] = [];
      }
      groups[country.region].push(country);
    });

    // Sort regions
    const regionOrder = ['North America', 'South America', 'Europe', 'Africa', 'Asia', 'Oceania', 'Other'];
    return Object.entries(groups).sort(([a], [b]) => {
      const indexA = regionOrder.indexOf(a);
      const indexB = regionOrder.indexOf(b);
      return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
    });
  }, [filteredCountries]);

  // Initialize countries and detect user's country
  useEffect(() => {
    const initialize = async () => {
      try {
        // Build country list
        const countryList = buildCountryList();
        setCountries(countryList);

        // Auto-detect country
        await detectAndSetCountry(countryList);
      } catch (err) {
        console.error('Failed to initialize:', err);
        // Fallback to US if detection fails
        const us = buildCountryList().find(c => c.code === 'US');
        if (us) setSelectedCountry(us);
      } finally {
        setInitialLoading(false);
      }
    };

    initialize();
  }, []);

  // Auto-format phone number as user types
  useEffect(() => {
    if (!selectedCountry) return;
    
    const formatted = formatAsYouType(phoneNumber, selectedCountry.code);
    setFormattedNumber(formatted);
  }, [phoneNumber, selectedCountry]);

  /**
   * Auto-detect country from device locale
   */
  const detectAndSetCountry = async (countryList: Country[]) => {
    try {
      // Get locale from device
      const locale = Localization.locale; // e.g., "en-US", "fr-FR", "ht-HT"
      const regionCode = Localization.region; // e.g., "US", "FR", "HT"
      
      console.log('📍 Device locale:', locale, 'Region:', regionCode);

      // Try region first (most accurate)
      let detectedCode = regionCode;

      // Fallback to parsing from locale string
      if (!detectedCode && locale) {
        const parts = locale.split(/[-_]/);
        detectedCode = parts[parts.length - 1];
      }

      if (detectedCode) {
        const detectedCountry = countryList.find(
          c => c.code === detectedCode.toUpperCase()
        );

        if (detectedCountry) {
          setSelectedCountry(detectedCountry);
          console.log('✅ Auto-detected country:', detectedCountry.name);
          return;
        }
      }

      // Final fallback to US
      const usCountry = countryList.find(c => c.code === 'US');
      if (usCountry) {
        setSelectedCountry(usCountry);
        console.log('⚠️ Could not detect country, defaulting to US');
      }
    } catch (err) {
      console.error('Country detection failed:', err);
      // Default to US
      const usCountry = countryList.find(c => c.code === 'US');
      if (usCountry) setSelectedCountry(usCountry);
    }
  };

  const handleCountrySelect = useCallback((country: Country) => {
    setSelectedCountry(country);
    setShowCountryPicker(false);
    setSearchQuery('');
    setPhoneNumber('');
    setFormattedNumber('');
    
    // Focus phone input after selection
    setTimeout(() => phoneInputRef.current?.focus(), 100);
  }, []);

  const handleContinue = async () => {
    if (!selectedCountry) {
      setError('Please select a country');
      return;
    }

    if (!phoneNumber.trim()) {
      setError('Please enter your phone number');
      return;
    }

    // Validate phone number
    if (!isValidPhoneNumber(phoneNumber, selectedCountry.code)) {
      setError('Please enter a valid phone number');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const fullPhoneNumber = `${selectedCountry.dialCode}${phoneNumber.replace(/\D/g, '')}`;
      console.log('📞 Sending OTP to:', fullPhoneNumber);

      // Supabase Phone Auth
      const { data, error: otpError } = await supabase.auth.signInWithOtp({
        phone: fullPhoneNumber,
      });

      if (otpError) {
        console.error('❌ OTP send failed:', otpError);
        throw otpError;
      }

      console.log('✅ OTP sent successfully');

      // Navigate to verification
      router.push({
        pathname: '/verify-code',
        params: {
          phone: fullPhoneNumber,
          formattedPhone: `${selectedCountry.flag} ${selectedCountry.dialCode} ${formattedNumber}`,
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

  // Render country item
  const renderCountryItem: ListRenderItem<Country> = useCallback(({ item: country }) => (
    <TouchableOpacity
      style={[
        styles.countryItem,
        selectedCountry?.code === country.code && styles.countryItemSelected,
      ]}
      onPress={() => handleCountrySelect(country)}
    >
      <Text style={styles.countryItemFlag}>{country.flag}</Text>
      <View style={styles.countryItemInfo}>
        <Text style={styles.countryItemName}>{country.name}</Text>
        <Text style={styles.countryItemCode}>{country.dialCode}</Text>
      </View>
      {selectedCountry?.code === country.code && (
        <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
      )}
    </TouchableOpacity>
  ), [selectedCountry, handleCountrySelect, colors.primary]);

  // Render section header
  const renderSectionHeader = (title: string) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{title}</Text>
    </View>
  );

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    centered: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      ...Typography.body,
      marginTop: Spacing.md,
      color: colors.textSecondary,
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
      color: colors.text,
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
      color: colors.text,
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
    hintText: {
      ...Typography.caption,
      color: colors.textSecondary,
      marginTop: Spacing.sm,
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
    // Modal Styles
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: colors.background,
      borderTopLeftRadius: BorderRadius.xl,
      borderTopRightRadius: BorderRadius.xl,
      maxHeight: '85%',
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
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: BorderRadius.md,
      paddingHorizontal: Spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    searchIcon: {
      marginRight: Spacing.sm,
    },
    searchInput: {
      flex: 1,
      ...Typography.body,
      color: colors.text,
      paddingVertical: Spacing.md,
    },
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
      color: colors.text,
    },
    countryItemCode: {
      ...Typography.caption,
      color: colors.textSecondary,
    },
  });

  if (initialLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading countries...</Text>
      </View>
    );
  }

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
          We'll send you a verification code to confirm your number
        </Text>

        <View style={styles.inputGroup}>
          {/* Country Selector */}
          <Text style={styles.label}>Country</Text>
          <TouchableOpacity
            style={styles.countrySelector}
            onPress={() => setShowCountryPicker(true)}
          >
            <Text style={styles.flag}>{selectedCountry?.flag || '🌍'}</Text>
            <View style={styles.countryInfo}>
              <Text style={styles.countryName}>
                {selectedCountry?.name || 'Select Country'}
              </Text>
              <Text style={styles.dialCode}>
                {selectedCountry?.dialCode || ''}
              </Text>
            </View>
            <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          {/* Phone Input */}
          <Text style={styles.label}>Phone Number</Text>
          <View style={[
            styles.phoneInputContainer,
            phoneNumber.length > 0 && styles.phoneInputContainerFocused
          ]}>
            <Text style={styles.dialCodePrefix}>
              {selectedCountry?.dialCode || '+1'}
            </Text>
            <TextInput
              ref={phoneInputRef}
              style={styles.phoneInput}
              placeholder="Phone number"
              placeholderTextColor={colors.textSecondary}
              keyboardType="phone-pad"
              value={formattedNumber}
              onChangeText={(text) => {
                // Only allow digits and formatting characters
                const cleaned = text.replace(/[^\d\s\-\(\)\+]/g, '');
                setPhoneNumber(cleaned);
              }}
              autoFocus
              textContentType="telephoneNumber"
              autoComplete="tel"
            />
          </View>

          {error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : (
            <Text style={styles.hintText}>
              Example: {selectedCountry?.dialCode} {formatAsYouType('5551234567', selectedCountry?.code || 'US').replace(/^\+\d+\s*/, '')}
            </Text>
          )}
        </View>

        {/* Continue Button */}
        <TouchableOpacity
          style={[
            styles.continueButton,
            (loading || !phoneNumber || !selectedCountry) && styles.continueButtonDisabled
          ]}
          onPress={handleContinue}
          disabled={loading || !phoneNumber || !selectedCountry}
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
                <Ionicons 
                  name="search" 
                  size={20} 
                  color={colors.textSecondary} 
                  style={styles.searchIcon}
                />
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
              {groupedCountries.map(([region, countries]) => (
                <View key={region}>
                  {renderSectionHeader(region)}
                  {countries.map(country => (
                    <View key={country.code}>
                      {renderCountryItem({ item: country, index: 0, separators: { highlight: () => {}, unhighlight: () => {}, updateProps: () => {} } })}
                    </View>
                  ))}
                </View>
              ))}
              
              {filteredCountries.length === 0 && (
                <View style={[styles.centered, { padding: Spacing.xl }]}>
                  <Ionicons name="search-outline" size={48} color={colors.textSecondary} />
                  <Text style={[styles.hintText, { marginTop: Spacing.md }]}>
                    No countries found
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}
