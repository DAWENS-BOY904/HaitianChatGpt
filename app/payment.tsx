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

export default function PaymentMethodsScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const supabase = getSupabaseClient();

  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [showAddCard, setShowAddCard] = useState(false);
  const [cardName, setCardName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvv, setCvv] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadPaymentMethods();
  }, []);

  const loadPaymentMethods = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('payment_methods')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (data) setPaymentMethods(data);
  };

  const detectCardBrand = (number: string) => {
    const cleaned = number.replace(/\s/g, '');
    if (cleaned.startsWith('4')) return 'Visa';
    if (/^5[1-5]/.test(cleaned)) return 'Mastercard';
    if (/^3[47]/.test(cleaned)) return 'Amex';
    if (cleaned.startsWith('6')) return 'Discover';
    return 'Card';
  };

  const formatCardNumber = (text: string) => {
    const cleaned = text.replace(/\s/g, '');
    const chunks = cleaned.match(/.{1,4}/g) || [];
    return chunks.join(' ').substring(0, 19);
  };

  const formatExpiryDate = (text: string) => {
    const cleaned = text.replace(/\D/g, '');
    if (cleaned.length >= 2) {
      return `${cleaned.substring(0, 2)}/${cleaned.substring(2, 4)}`;
    }
    return cleaned;
  };

  const handleAddApplePay = async () => {
    if (!user) return;

    if (Platform.OS !== 'ios') {
      showAlert('Not Available', 'Apple Pay is only available on iOS devices');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.from('payment_methods').insert({
        user_id: user.id,
        payment_type: 'apple_pay',
        is_default: paymentMethods.length === 0,
      });

      if (error) throw error;

      showAlert('Success', 'Apple Pay added successfully');
      await loadPaymentMethods();
    } catch (err) {
      showAlert('Error', 'Failed to add Apple Pay');
    } finally {
      setLoading(false);
    }
  };

  const handleAddGooglePay = async () => {
    if (!user) return;

    if (Platform.OS !== 'android') {
      showAlert('Not Available', 'Google Pay is only available on Android devices');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.from('payment_methods').insert({
        user_id: user.id,
        payment_type: 'google_pay',
        is_default: paymentMethods.length === 0,
      });

      if (error) throw error;

      showAlert('Success', 'Google Pay added successfully');
      await loadPaymentMethods();
    } catch (err) {
      showAlert('Error', 'Failed to add Google Pay');
    } finally {
      setLoading(false);
    }
  };

  const handleAddCreditCard = async () => {
    if (!cardName.trim() || !cardNumber.trim() || !expiryDate.trim() || !cvv.trim()) {
      showAlert('Error', 'Please fill in all card details');
      return;
    }

    const cleaned = cardNumber.replace(/\s/g, '');
    if (cleaned.length < 13 || cleaned.length > 19) {
      showAlert('Error', 'Invalid card number');
      return;
    }

    if (!/^\d{2}\/\d{2}$/.test(expiryDate)) {
      showAlert('Error', 'Invalid expiry date (MM/YY)');
      return;
    }

    if (cvv.length < 3 || cvv.length > 4) {
      showAlert('Error', 'Invalid CVV');
      return;
    }

    setLoading(true);

    try {
      const cardBrand = detectCardBrand(cleaned);
      const lastFour = cleaned.slice(-4);

      const { error } = await supabase.from('payment_methods').insert({
        user_id: user.id,
        payment_type: 'credit_card',
        card_last_four: lastFour,
        card_brand: cardBrand,
        is_default: paymentMethods.length === 0,
      });

      if (error) throw error;

      showAlert('Success', 'Card added successfully');
      await loadPaymentMethods();

      setCardName('');
      setCardNumber('');
      setExpiryDate('');
      setCvv('');
      setShowAddCard(false);
    } catch (err) {
      showAlert('Error', 'Failed to add card');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePayment = async (id: string) => {
    showAlert('Delete Payment Method', 'Are you sure you want to delete this payment method?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase
            .from('payment_methods')
            .delete()
            .eq('id', id);

          if (error) {
            showAlert('Error', 'Failed to delete payment method');
          } else {
            await loadPaymentMethods();
          }
        },
      },
    ]);
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
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      marginBottom: Spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
      gap: Spacing.md,
    },
    addButtonDisabled: {
      opacity: 0.5,
    },
    addButtonText: {
      ...Typography.body,
      color: colors.text,
      flex: 1,
    },
    paymentItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      marginBottom: Spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    paymentInfo: {
      flex: 1,
      marginLeft: Spacing.md,
    },
    paymentType: {
      ...Typography.body,
      color: colors.text,
      fontWeight: '600',
    },
    defaultBadge: {
      backgroundColor: colors.primary,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 4,
      borderRadius: BorderRadius.sm,
      marginRight: Spacing.sm,
    },
    defaultText: {
      ...Typography.caption,
      color: '#FFFFFF',
      fontSize: 10,
      fontWeight: '600',
    },
    deleteButton: {
      padding: Spacing.xs,
    },
    cardForm: {
      backgroundColor: colors.card,
      borderRadius: BorderRadius.md,
      padding: Spacing.lg,
      marginTop: Spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    formTitle: {
      ...Typography.heading,
      color: colors.text,
      marginBottom: Spacing.md,
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
    },
    buttonRow: {
      flexDirection: 'row',
      gap: Spacing.md,
      marginTop: Spacing.md,
    },
    button: {
      flex: 1,
      padding: Spacing.md,
      borderRadius: BorderRadius.sm,
      alignItems: 'center',
    },
    primaryButton: {
      backgroundColor: colors.primary,
    },
    secondaryButton: {
      backgroundColor: colors.border,
    },
    buttonText: {
      ...Typography.body,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    secondaryButtonText: {
      ...Typography.body,
      fontWeight: '600',
      color: colors.text,
    },
    emptyState: {
      padding: Spacing.xl,
      alignItems: 'center',
    },
    emptyText: {
      ...Typography.body,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: Spacing.md,
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
        <Text style={styles.headerTitle}>Payment Methods</Text>
      </View>

      <ScrollView style={styles.content}>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push('/billing')}
          disabled={loading}
        >
          <Ionicons name="document-text" size={24} color={colors.text} />
          <Text style={styles.addButtonText}>Billing Information</Text>
          <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Add Payment Method</Text>

        <TouchableOpacity
          style={[
            styles.addButton,
            Platform.OS !== 'ios' && styles.addButtonDisabled,
          ]}
          onPress={handleAddApplePay}
          disabled={loading || Platform.OS !== 'ios'}
        >
          <Ionicons name="logo-apple" size={24} color={colors.text} />
          <Text style={styles.addButtonText}>
            Apple Pay {Platform.OS !== 'ios' && '(iOS only)'}
          </Text>
          <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.addButton,
            Platform.OS !== 'android' && styles.addButtonDisabled,
          ]}
          onPress={handleAddGooglePay}
          disabled={loading || Platform.OS !== 'android'}
        >
          <Ionicons name="logo-google" size={24} color={colors.text} />
          <Text style={styles.addButtonText}>
            Google Pay {Platform.OS !== 'android' && '(Android only)'}
          </Text>
          <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowAddCard(!showAddCard)}
          disabled={loading}
        >
          <Ionicons name="card" size={24} color={colors.text} />
          <Text style={styles.addButtonText}>Credit/Debit Card</Text>
          <Ionicons
            name={showAddCard ? 'chevron-up' : 'chevron-forward'}
            size={20}
            color={colors.textSecondary}
          />
        </TouchableOpacity>

        {showAddCard && (
          <View style={styles.cardForm}>
            <Text style={styles.formTitle}>Card Details</Text>

            <TextInput
              style={styles.input}
              placeholder="Cardholder Name"
              placeholderTextColor={colors.textSecondary}
              value={cardName}
              onChangeText={setCardName}
              autoCapitalize="words"
            />

            <TextInput
              style={styles.input}
              placeholder="Card Number"
              placeholderTextColor={colors.textSecondary}
              value={cardNumber}
              onChangeText={(text) => setCardNumber(formatCardNumber(text))}
              keyboardType="number-pad"
              maxLength={19}
            />

            <View style={styles.row}>
              <TextInput
                style={styles.inputHalf}
                placeholder="MM/YY"
                placeholderTextColor={colors.textSecondary}
                value={expiryDate}
                onChangeText={(text) => setExpiryDate(formatExpiryDate(text))}
                keyboardType="number-pad"
                maxLength={5}
              />

              <TextInput
                style={styles.inputHalf}
                placeholder="CVV"
                placeholderTextColor={colors.textSecondary}
                value={cvv}
                onChangeText={(text) => setCvv(text.replace(/\D/g, ''))}
                keyboardType="number-pad"
                maxLength={4}
                secureTextEntry
              />
            </View>

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.button, styles.secondaryButton]}
                onPress={() => {
                  setShowAddCard(false);
                  setCardName('');
                  setCardNumber('');
                  setExpiryDate('');
                  setCvv('');
                }}
              >
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.primaryButton]}
                onPress={handleAddCreditCard}
                disabled={loading}
              >
                <Text style={styles.buttonText}>
                  {loading ? 'Adding...' : 'Add Card'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {paymentMethods.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>Your Payment Methods</Text>
            {paymentMethods.map((method) => (
              <View key={method.id} style={styles.paymentItem}>
                <Ionicons
                  name={
                    method.payment_type === 'apple_pay'
                      ? 'logo-apple'
                      : method.payment_type === 'google_pay'
                      ? 'logo-google'
                      : 'card'
                  }
                  size={24}
                  color={colors.text}
                />
                <View style={styles.paymentInfo}>
                  <Text style={styles.paymentType}>
                    {method.payment_type === 'apple_pay'
                      ? 'Apple Pay'
                      : method.payment_type === 'google_pay'
                      ? 'Google Pay'
                      : `${method.card_brand} •••• ${method.card_last_four}`}
                  </Text>
                </View>
                {method.is_default && (
                  <View style={styles.defaultBadge}>
                    <Text style={styles.defaultText}>DEFAULT</Text>
                  </View>
                )}
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleDeletePayment(method.id)}
                >
                  <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                </TouchableOpacity>
              </View>
            ))}
          </>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons
              name="wallet-outline"
              size={64}
              color={colors.textSecondary}
            />
            <Text style={styles.emptyText}>
              No payment methods added yet.{'\n'}Add a payment method to get started.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
