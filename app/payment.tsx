import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, ScrollView, Platform } from 'react-native';
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

    if (data) {
      setPaymentMethods(data);
    }
  };

  const handleAddApplePay = async () => {
    if (!user) return;

    const { error } = await supabase
      .from('payment_methods')
      .insert({
        user_id: user.id,
        payment_type: 'apple_pay',
        is_default: paymentMethods.length === 0,
      });

    if (!error) {
      showAlert('Success', 'Apple Pay added successfully');
      await loadPaymentMethods();
    }
  };

  const handleAddGooglePay = async () => {
    if (!user) return;

    const { error } = await supabase
      .from('payment_methods')
      .insert({
        user_id: user.id,
        payment_type: 'google_pay',
        is_default: paymentMethods.length === 0,
      });

    if (!error) {
      showAlert('Success', 'Google Pay added successfully');
      await loadPaymentMethods();
    }
  };

  const handleAddCreditCard = async () => {
    if (!cardName || !cardNumber || !expiryDate || !cvv) {
      showAlert('Error', 'Please fill in all fields');
      return;
    }

    if (!user) return;

    const lastFour = cardNumber.slice(-4);
    const cardBrand = detectCardBrand(cardNumber);

    const { error } = await supabase
      .from('payment_methods')
      .insert({
        user_id: user.id,
        payment_type: 'credit_card',
        card_last_four: lastFour,
        card_brand: cardBrand,
        is_default: paymentMethods.length === 0,
      });

    if (!error) {
      showAlert('Success', 'Credit card added successfully');
      setShowAddCard(false);
      setCardName('');
      setCardNumber('');
      setExpiryDate('');
      setCvv('');
      await loadPaymentMethods();
    }
  };

  const detectCardBrand = (number: string) => {
    if (number.startsWith('4')) return 'Visa';
    if (number.startsWith('5')) return 'Mastercard';
    if (number.startsWith('3')) return 'Amex';
    return 'Unknown';
  };

  const handleDeletePayment = async (id: string) => {
    showAlert('Delete Payment Method', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('payment_methods').delete().eq('id', id);
          await loadPaymentMethods();
        },
      },
    ]);
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingTop: Platform.select({ ios: insets.top, android: insets.top, default: 0 }),
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
    paymentDetails: {
      ...Typography.caption,
      color: colors.textSecondary,
      marginTop: 2,
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
    },
    deleteButton: {
      padding: Spacing.xs,
    },
    cardForm: {
      backgroundColor: colors.card,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      marginTop: Spacing.md,
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
      ...Typography.body,
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: Spacing.md,
    },
    row: {
      flexDirection: 'row',
      gap: Spacing.md,
    },
    halfInput: {
      flex: 1,
    },
    formButtons: {
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
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    buttonText: {
      ...Typography.body,
      fontWeight: '600',
    },
    primaryButtonText: {
      color: '#FFFFFF',
    },
    secondaryButtonText: {
      color: colors.text,
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payment Methods</Text>
      </View>

      <ScrollView style={styles.content}>
        <Text style={styles.sectionTitle}>Add Payment Method</Text>

        <TouchableOpacity style={styles.addButton} onPress={handleAddApplePay}>
          <Ionicons name="logo-apple" size={24} color={colors.text} />
          <Text style={styles.addButtonText}>Apple Pay</Text>
          <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.addButton} onPress={handleAddGooglePay}>
          <Ionicons name="logo-google" size={24} color={colors.text} />
          <Text style={styles.addButtonText}>Google Pay</Text>
          <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.addButton} onPress={() => setShowAddCard(!showAddCard)}>
          <Ionicons name="card" size={24} color={colors.text} />
          <Text style={styles.addButtonText}>Credit/Debit Card</Text>
          <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
        </TouchableOpacity>

        {showAddCard && (
          <View style={styles.cardForm}>
            <Text style={styles.formTitle}>Add Card</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Cardholder Name"
              placeholderTextColor={colors.textSecondary}
              value={cardName}
              onChangeText={setCardName}
            />

            <TextInput
              style={styles.input}
              placeholder="Card Number"
              placeholderTextColor={colors.textSecondary}
              value={cardNumber}
              onChangeText={setCardNumber}
              keyboardType="number-pad"
              maxLength={16}
            />

            <View style={styles.row}>
              <TextInput
                style={[styles.input, styles.halfInput]}
                placeholder="MM/YY"
                placeholderTextColor={colors.textSecondary}
                value={expiryDate}
                onChangeText={setExpiryDate}
                maxLength={5}
              />

              <TextInput
                style={[styles.input, styles.halfInput]}
                placeholder="CVV"
                placeholderTextColor={colors.textSecondary}
                value={cvv}
                onChangeText={setCvv}
                keyboardType="number-pad"
                maxLength={4}
                secureTextEntry
              />
            </View>

            <View style={styles.formButtons}>
              <TouchableOpacity 
                style={[styles.button, styles.secondaryButton]}
                onPress={() => setShowAddCard(false)}
              >
                <Text style={[styles.buttonText, styles.secondaryButtonText]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.button, styles.primaryButton]}
                onPress={handleAddCreditCard}
              >
                <Text style={[styles.buttonText, styles.primaryButtonText]}>Add Card</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {paymentMethods.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: Spacing.xl }]}>
              Your Payment Methods
            </Text>

            {paymentMethods.map((method) => (
              <View key={method.id} style={styles.paymentItem}>
                <Ionicons 
                  name={
                    method.payment_type === 'apple_pay' ? 'logo-apple' :
                    method.payment_type === 'google_pay' ? 'logo-google' :
                    'card'
                  } 
                  size={24} 
                  color={colors.text} 
                />
                <View style={styles.paymentInfo}>
                  <Text style={styles.paymentType}>
                    {method.payment_type === 'apple_pay' ? 'Apple Pay' :
                     method.payment_type === 'google_pay' ? 'Google Pay' :
                     `${method.card_brand} •••• ${method.card_last_four}`}
                  </Text>
                  {method.is_default && (
                    <Text style={styles.paymentDetails}>Default</Text>
                  )}
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
        )}
      </ScrollView>
    </View>
  );
}
