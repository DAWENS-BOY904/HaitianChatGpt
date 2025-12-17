import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, ScrollView, Platform, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '@/template';
import { useRouter } from 'expo-router';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSupabaseClient } from '@/template';
import { StripeProvider, useStripe, CardField } from '@stripe/stripe-react-native';

export default function PaymentMethodsScreenWrapper() {
  // Wrap the screen with StripeProvider
  return (
    <StripeProvider publishableKey="pk_test_XXXX">
      <PaymentMethodsScreen />
    </StripeProvider>
  );
}

function PaymentMethodsScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const supabase = getSupabaseClient();
  const { confirmPayment, presentApplePay, presentGooglePay } = useStripe();

  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [showAddCard, setShowAddCard] = useState(false);
  const [cardName, setCardName] = useState('');
  const [amount, setAmount] = useState('1000'); // amount in cents for demo

  useEffect(() => {
    loadPaymentMethods();
  }, []);

  // Load saved payment methods from Supabase
  const loadPaymentMethods = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('payment_methods')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (data) setPaymentMethods(data);
  };

  // Helper to detect card brand
  const detectCardBrand = (number: string) => {
    if (number.startsWith('4')) return 'Visa';
    if (number.startsWith('5')) return 'Mastercard';
    if (number.startsWith('3')) return 'Amex';
    return 'Unknown';
  };

  // ------------------- PAYMENT HANDLERS -------------------

  // 1️⃣ Credit/Debit Card Payment
  const handleAddCreditCard = async (cardDetails: any) => {
    if (!user || !cardDetails.complete) {
      Alert.alert('Error', 'Please complete card details');
      return;
    }

    try {
      // Call your backend to create a PaymentIntent
      const res = await fetch('https://your-backend.com/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: parseInt(amount), currency: 'usd' }),
      });
      const { clientSecret } = await res.json();

      // Confirm payment with Stripe
      const { paymentIntent, error } = await confirmPayment(clientSecret, {
        paymentMethodType: 'Card',
        paymentMethodData: {
          billingDetails: { name: cardName },
        },
      });

      if (error) {
        Alert.alert('Payment failed', error.message || 'Unknown error');
      } else if (paymentIntent) {
        Alert.alert('Success', 'Payment successful!');

        // Save safe info to Supabase (last 4 digits, brand)
        const lastFour = cardDetails?.number?.slice(-4) || '';
        const cardBrand = detectCardBrand(lastFour);

        await supabase.from('payment_methods').insert({
          user_id: user.id,
          payment_type: 'credit_card',
          card_last_four: lastFour,
          card_brand: cardBrand,
          is_default: paymentMethods.length === 0,
        });

        await loadPaymentMethods();
        setShowAddCard(false);
        setCardName('');
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to process payment');
      console.log(err);
    }
  };

  // 2️⃣ Apple Pay
  const handleAddApplePay = async () => {
    if (!user) return;
    try {
      const { error } = await presentApplePay({
        cartItems: [{ label: 'Total', amount: (parseInt(amount) / 100).toFixed(2) }],
        country: 'US',
        currency: 'USD',
      });

      if (error) return Alert.alert('Apple Pay failed', error.message);

      // Confirm payment via your backend
      const res = await fetch('https://your-backend.com/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: parseInt(amount), currency: 'usd' }),
      });
      const { clientSecret } = await res.json();
      await confirmPayment(clientSecret, { type: 'ApplePay' });

      Alert.alert('Success', 'Apple Pay added!');
      await supabase.from('payment_methods').insert({
        user_id: user.id,
        payment_type: 'apple_pay',
        is_default: paymentMethods.length === 0,
      });
      await loadPaymentMethods();
    } catch (err) {
      console.log(err);
      Alert.alert('Error', 'Apple Pay failed');
    }
  };

  // 3️⃣ Google Pay
  const handleAddGooglePay = async () => {
    if (!user) return;
    try {
      const { error } = await presentGooglePay({
        amount: (parseInt(amount) / 100).toFixed(2),
        currencyCode: 'USD',
      });

      if (error) return Alert.alert('Google Pay failed', error.message);

      // Confirm payment via backend
      const res = await fetch('https://your-backend.com/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: parseInt(amount), currency: 'usd' }),
      });
      const { clientSecret } = await res.json();
      await confirmPayment(clientSecret, { type: 'GooglePay' });

      Alert.alert('Success', 'Google Pay added!');
      await supabase.from('payment_methods').insert({
        user_id: user.id,
        payment_type: 'google_pay',
        is_default: paymentMethods.length === 0,
      });
      await loadPaymentMethods();
    } catch (err) {
      console.log(err);
      Alert.alert('Error', 'Google Pay failed');
    }
  };

  // Delete saved payment
  const handleDeletePayment = async (id: string) => {
    Alert.alert('Delete Payment', 'Are you sure?', [
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

  // ------------------- STYLES -------------------
  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, paddingTop: Platform.OS === 'android' ? insets.top : 0 },
    header: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
    backButton: { padding: Spacing.xs, marginRight: Spacing.sm },
    headerTitle: { ...Typography.heading, color: colors.text },
    content: { padding: Spacing.md },
    sectionTitle: { ...Typography.heading, color: colors.text, marginBottom: Spacing.md },
    addButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.sm, borderWidth: 1, borderColor: colors.border, gap: Spacing.md },
    addButtonText: { ...Typography.body, color: colors.text, flex: 1 },
    paymentItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.sm, borderWidth: 1, borderColor: colors.border },
    paymentInfo: { flex: 1, marginLeft: Spacing.md },
    paymentType: { ...Typography.body, color: colors.text, fontWeight: '600' },
    defaultBadge: { backgroundColor: colors.primary, paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: BorderRadius.sm, marginRight: Spacing.sm },
    defaultText: { ...Typography.caption, color: '#FFFFFF', fontSize: 10 },
    deleteButton: { padding: Spacing.xs },
    cardForm: { backgroundColor: colors.card, borderRadius: BorderRadius.md, padding: Spacing.md, marginTop: Spacing.md },
    formTitle: { ...Typography.heading, color: colors.text, marginBottom: Spacing.md },
    button: { flex: 1, padding: Spacing.md, borderRadius: BorderRadius.sm, alignItems: 'center' },
    primaryButton: { backgroundColor: colors.primary },
    buttonText: { ...Typography.body, fontWeight: '600', color: '#fff' },
  });

  // ------------------- RENDER -------------------
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
        </TouchableOpacity>

        <TouchableOpacity style={styles.addButton} onPress={handleAddGooglePay}>
          <Ionicons name="logo-google" size={24} color={colors.text} />
          <Text style={styles.addButtonText}>Google Pay</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.addButton} onPress={() => setShowAddCard(!showAddCard)}>
          <Ionicons name="card" size={24} color={colors.text} />
          <Text style={styles.addButtonText}>Credit/Debit Card</Text>
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

            <CardField
              postalCodeEnabled={false}
              placeholder={{ number: '4242 4242 4242 4242' }}
              cardStyle={{ backgroundColor: colors.inputBackground, textColor: colors.text }}
              style={{ height: 50, marginVertical: 10 }}
              onCardChange={(cardDetails) => (cardFieldRef.current = cardDetails)}
            />

            <TouchableOpacity
              style={[styles.button, styles.primaryButton]}
              onPress={() => handleAddCreditCard(cardFieldRef.current)}
            >
              <Text style={styles.buttonText}>Add Card</Text>
            </TouchableOpacity>
          </View>
        )}

        {paymentMethods.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: Spacing.xl }]}>Your Payment Methods</Text>
            {paymentMethods.map((method) => (
              <View key={method.id} style={styles.paymentItem}>
                <Ionicons
                  name={
                    method.payment_type === 'apple_pay' ? 'logo-apple' :
                    method.payment_type === 'google_pay' ? 'logo-google' : 'card'
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
                </View>
                {method.is_default && (
                  <View style={styles.defaultBadge}>
                    <Text style={styles.defaultText}>DEFAULT</Text>
                  </View>
                )}
                <TouchableOpacity style={styles.deleteButton} onPress={() => handleDeletePayment(method.id)}>
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
