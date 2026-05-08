import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useAuth, useAlert } from '@/template';
import { useRouter } from 'expo-router';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSupabaseClient } from '@/template';

export default function BillingInfoScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const supabase = getSupabaseClient();

  const [name, setName] = useState('');
  const [country, setCountry] = useState('United States');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [phone, setPhone] = useState('');
  const [taxId, setTaxId] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadBillingInfo();
  }, []);

  const loadBillingInfo = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('user_profiles')
      .select('full_name, billing_info')
      .eq('id', user.id)
      .single();

    if (data) {
      setName(data.full_name || '');
      if (data.billing_info) {
        const info = data.billing_info;
        setCountry(info.country || '');
        setAddressLine1(info.address_line_1 || '');
        setAddressLine2(info.address_line_2 || '');
        setCity(info.city || '');
        setState(info.state || '');
        setZipCode(info.zip_code || '');
        setPhone(info.phone || '');
        setTaxId(info.tax_id || '');
      }
    }
  };

  const handleSave = async () => {
    if (!name.trim() || !addressLine1.trim() || !city.trim() || !zipCode.trim()) {
      showAlert('Error', 'Please fill in all required fields');
      return;
    }

    setLoading(true);

    const billingInfo = {
      country,
      address_line_1: addressLine1,
      address_line_2: addressLine2,
      city,
      state,
      zip_code: zipCode,
      phone,
      tax_id: taxId,
    };

    const { error } = await supabase
      .from('user_profiles')
      .update({
        full_name: name,
        billing_info: billingInfo,
      })
      .eq('id', user?.id);

    setLoading(false);

    if (error) {
      showAlert('Error', 'Failed to save billing information');
    } else {
      showAlert('Success', 'Billing information saved');
      router.back();
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingTop: Platform.select({
        ios: insets.top,
        android: insets.top,
      }),
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: {
      padding: Spacing.xs,
      marginRight: Spacing.sm,
    },
    headerTitle: {
      ...Typography.heading,
      color: colors.text,
      fontSize: 20,
    },
    content: {
      padding: Spacing.md,
    },
    sectionTitle: {
      ...Typography.heading,
      color: colors.text,
      marginBottom: Spacing.md,
      marginTop: Spacing.md,
    },
    input: {
      backgroundColor: colors.inputBackground,
      borderRadius: BorderRadius.sm,
      padding: Spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      color: colors.text,
      marginBottom: Spacing.md,
    },
    row: {
      flexDirection: 'row',
      gap: Spacing.md,
    },
    inputHalf: {
      flex: 1,
      backgroundColor: colors.inputBackground,
      borderRadius: BorderRadius.sm,
      padding: Spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      color: colors.text,
      marginBottom: Spacing.md,
    },
    saveButton: {
      backgroundColor: colors.text,
      borderRadius: BorderRadius.full,
      padding: Spacing.md,
      alignItems: 'center',
      marginTop: Spacing.lg,
    },
    saveButtonDisabled: {
      opacity: 0.5,
    },
    saveButtonText: {
      ...Typography.body,
      fontWeight: '600',
      color: colors.background,
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Billing information</Text>
      </View>

      <ScrollView style={styles.content}>
        <TextInput
          style={styles.input}
          placeholder="Name"
          placeholderTextColor={colors.textSecondary}
          value={name}
          onChangeText={setName}
        />

        <Text style={styles.sectionTitle}>Address</Text>

        <TextInput
          style={styles.input}
          placeholder="Country"
          placeholderTextColor={colors.textSecondary}
          value={country}
          onChangeText={setCountry}
        />

        <TextInput
          style={styles.input}
          placeholder="Address line 1"
          placeholderTextColor={colors.textSecondary}
          value={addressLine1}
          onChangeText={setAddressLine1}
        />

        <TextInput
          style={styles.input}
          placeholder="Address line 2"
          placeholderTextColor={colors.textSecondary}
          value={addressLine2}
          onChangeText={setAddressLine2}
        />

        <TextInput
          style={styles.input}
          placeholder="City"
          placeholderTextColor={colors.textSecondary}
          value={city}
          onChangeText={setCity}
        />

        <View style={styles.row}>
          <TextInput
            style={styles.inputHalf}
            placeholder="State"
            placeholderTextColor={colors.textSecondary}
            value={state}
            onChangeText={setState}
          />

          <TextInput
            style={styles.inputHalf}
            placeholder="ZIP (95014)"
            placeholderTextColor={colors.textSecondary}
            value={zipCode}
            onChangeText={setZipCode}
            keyboardType="number-pad"
          />
        </View>

        <Text style={styles.sectionTitle}>Phone number</Text>

        <TextInput
          style={styles.input}
          placeholder="+1 (201) 555-0123"
          placeholderTextColor={colors.textSecondary}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />

        <Text style={styles.sectionTitle}>Tax ID</Text>

        <TextInput
          style={styles.input}
          placeholder="ID type"
          placeholderTextColor={colors.textSecondary}
          value={taxId}
          onChangeText={setTaxId}
        />

        <TouchableOpacity
          style={[styles.saveButton, loading && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={loading}
        >
          <Text style={styles.saveButtonText}>
            {loading ? 'Saving...' : 'Save'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
