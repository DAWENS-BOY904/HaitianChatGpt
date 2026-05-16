import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, StyleSheet, Alert, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { getSupabaseClient } from '@/template';
import { useAlert } from '@/template';
import { router } from 'expo-router';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AdminPayoutScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();
  const [loading, setLoading] = useState(false);
  const [payoutMethods, setPayoutMethods] = useState<any[]>([]);
  const [payoutHistory, setPayoutHistory] = useState<any[]>([]);
  const [showAddMethod, setShowAddMethod] = useState(false);
  const [methodType, setMethodType] = useState<'bank_account' | 'credit_card' | 'debit_card'>('bank_account');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [routingNumber, setRoutingNumber] = useState('');
  const [bankName, setBankName] = useState('');
  const [payoutAmount, setPayoutAmount] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const supabase = getSupabaseClient();

  useEffect(() => {
    loadPayoutData();
  }, []);

  const loadPayoutData = async () => {
    setLoading(true);
    try {
      const { data: methods } = await supabase
        .from('payout_methods')
        .select('*')
        .order('created_at', { ascending: false });

      const { data: history } = await supabase
        .from('payouts')
        .select('*')
        .order('requested_at', { ascending: false })
        .limit(20);

      setPayoutMethods(methods || []);
      setPayoutHistory(history || []);
      
      if (methods && methods.length > 0) {
        const defaultMethod = methods.find(m => m.is_default);
        setSelectedMethod(defaultMethod?.id || methods[0].id);
      }
    } catch (error) {
      console.error('Payout data load error:', error);
    }
    setLoading(false);
  };

  const handleAddPayoutMethod = async () => {
    if (!accountName || !accountNumber) {
      showAlert('Error', 'Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('payout_methods')
        .insert({
          method_type: methodType,
          account_name: accountName,
          account_number: accountNumber,
          routing_number: routingNumber || null,
          bank_name: bankName || null,
          card_last_four: accountNumber.slice(-4),
          is_default: payoutMethods.length === 0,
        });

      if (error) throw error;

      showAlert('Success', 'Payout method added successfully');
      setShowAddMethod(false);
      setAccountName('');
      setAccountNumber('');
      setRoutingNumber('');
      setBankName('');
      await loadPayoutData();
    } catch (error: any) {
      showAlert('Error', error.message || 'Failed to add payout method');
    }
    setLoading(false);
  };

  const handleRequestPayout = async () => {
    const amount = parseFloat(payoutAmount);
    if (!amount || amount <= 0) {
      showAlert('Error', 'Please enter a valid amount');
      return;
    }

    if (!selectedMethod) {
      showAlert('Error', 'Please select a payout method');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('request-payout', {
        body: {
          amount,
          payoutMethodId: selectedMethod,
        },
      });

      if (error) throw error;

      showAlert('Success', 'Payout request submitted successfully');
      setPayoutAmount('');
      await loadPayoutData();
    } catch (error: any) {
      showAlert('Error', error.message || 'Failed to request payout');
    }
    setLoading(false);
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
    },
    headerTitle: {
      ...Typography.heading,
      color: colors.text,
      marginLeft: Spacing.sm,
      flex: 1,
    },
    content: {
      flex: 1,
    },
    section: {
      padding: Spacing.md,
    },
    sectionTitle: {
      ...Typography.heading,
      fontSize: 18,
      color: colors.text,
      marginBottom: Spacing.md,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      marginBottom: Spacing.md,
    },
    label: {
      ...Typography.body,
      color: colors.textSecondary,
      marginBottom: Spacing.xs,
    },
    input: {
      backgroundColor: colors.inputBackground,
      borderRadius: BorderRadius.sm,
      padding: Spacing.md,
      ...Typography.body,
      color: colors.text,
      marginBottom: Spacing.md,
    },
    methodTypeSelector: {
      flexDirection: 'row',
      gap: Spacing.sm,
      marginBottom: Spacing.md,
    },
    methodTypeButton: {
      flex: 1,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
      borderRadius: BorderRadius.sm,
      backgroundColor: colors.surface,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    methodTypeButtonActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    methodTypeText: {
      ...Typography.body,
      color: colors.text,
      fontSize: 14,
    },
    methodTypeTextActive: {
      color: '#FFFFFF',
      fontWeight: '600',
    },
    button: {
      backgroundColor: colors.primary,
      borderRadius: BorderRadius.sm,
      paddingVertical: Spacing.md,
      alignItems: 'center',
      marginBottom: Spacing.sm,
    },
    buttonText: {
      ...Typography.body,
      color: '#FFFFFF',
      fontWeight: '600',
    },
    secondaryButton: {
      backgroundColor: colors.surface,
      borderRadius: BorderRadius.sm,
      paddingVertical: Spacing.md,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    secondaryButtonText: {
      ...Typography.body,
      color: colors.text,
      fontWeight: '600',
    },
    methodItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: Spacing.md,
      backgroundColor: colors.surface,
      borderRadius: BorderRadius.sm,
      marginBottom: Spacing.sm,
      borderWidth: 2,
      borderColor: colors.border,
    },
    methodItemSelected: {
      borderColor: colors.primary,
      backgroundColor: `${colors.primary}10`,
    },
    methodInfo: {
      flex: 1,
      marginLeft: Spacing.sm,
    },
    methodName: {
      ...Typography.body,
      color: colors.text,
      fontWeight: '600',
    },
    methodDetails: {
      ...Typography.caption,
      color: colors.textSecondary,
      marginTop: 2,
    },
    historyItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    historyInfo: {
      flex: 1,
    },
    historyAmount: {
      ...Typography.body,
      color: colors.text,
      fontWeight: '600',
    },
    historyDate: {
      ...Typography.caption,
      color: colors.textSecondary,
      marginTop: 2,
    },
    historyStatus: {
      paddingVertical: 4,
      paddingHorizontal: Spacing.sm,
      borderRadius: BorderRadius.sm,
    },
    historyStatusText: {
      ...Typography.caption,
      fontSize: 11,
      fontWeight: '600',
    },
    addMethodButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.xs,
      padding: Spacing.md,
      backgroundColor: colors.surface,
      borderRadius: BorderRadius.sm,
      borderWidth: 2,
      borderColor: colors.border,
      borderStyle: 'dashed',
    },
    addMethodButtonText: {
      ...Typography.body,
      color: colors.primary,
      fontWeight: '600',
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cash Out</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Request Payout Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Request Payout</Text>
          <View style={styles.card}>
            <Text style={styles.label}>Amount (USD)</Text>
            <TextInput
              style={styles.input}
              placeholder="0.00"
              placeholderTextColor={colors.textSecondary}
              value={payoutAmount}
              onChangeText={setPayoutAmount}
              keyboardType="decimal-pad"
            />

            <Text style={styles.label}>Payout Method</Text>
            {payoutMethods.length === 0 ? (
              <TouchableOpacity
                style={styles.addMethodButton}
                onPress={() => setShowAddMethod(true)}
              >
                <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
                <Text style={styles.addMethodButtonText}>Add Payout Method</Text>
              </TouchableOpacity>
            ) : (
              <>
                {payoutMethods.map(method => (
                  <TouchableOpacity
                    key={method.id}
                    style={[
                      styles.methodItem,
                      selectedMethod === method.id && styles.methodItemSelected,
                    ]}
                    onPress={() => setSelectedMethod(method.id)}
                  >
                    <Ionicons
                      name={
                        method.method_type === 'bank_account'
                          ? 'business-outline'
                          : 'card-outline'
                      }
                      size={24}
                      color={selectedMethod === method.id ? colors.primary : colors.text}
                    />
                    <View style={styles.methodInfo}>
                      <Text style={styles.methodName}>{method.account_name}</Text>
                      <Text style={styles.methodDetails}>
                        {method.method_type === 'bank_account'
                          ? `${method.bank_name} • ****${method.card_last_four}`
                          : `Card ending in ${method.card_last_four}`}
                      </Text>
                    </View>
                    {selectedMethod === method.id && (
                      <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={styles.addMethodButton}
                  onPress={() => setShowAddMethod(true)}
                >
                  <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
                  <Text style={styles.addMethodButtonText}>Add New Method</Text>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity
              style={styles.button}
              onPress={handleRequestPayout}
              disabled={loading || !payoutAmount || !selectedMethod}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>Request Payout</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Add Payout Method Section */}
        {showAddMethod && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Add Payout Method</Text>
            <View style={styles.card}>
              <View style={styles.methodTypeSelector}>
                <TouchableOpacity
                  style={[
                    styles.methodTypeButton,
                    methodType === 'bank_account' && styles.methodTypeButtonActive,
                  ]}
                  onPress={() => setMethodType('bank_account')}
                >
                  <Text
                    style={[
                      styles.methodTypeText,
                      methodType === 'bank_account' && styles.methodTypeTextActive,
                    ]}
                  >
                    Bank Account
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.methodTypeButton,
                    methodType === 'credit_card' && styles.methodTypeButtonActive,
                  ]}
                  onPress={() => setMethodType('credit_card')}
                >
                  <Text
                    style={[
                      styles.methodTypeText,
                      methodType === 'credit_card' && styles.methodTypeTextActive,
                    ]}
                  >
                    Credit Card
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.methodTypeButton,
                    methodType === 'debit_card' && styles.methodTypeButtonActive,
                  ]}
                  onPress={() => setMethodType('debit_card')}
                >
                  <Text
                    style={[
                      styles.methodTypeText,
                      methodType === 'debit_card' && styles.methodTypeTextActive,
                    ]}
                  >
                    Debit Card
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>Account/Card Holder Name</Text>
              <TextInput
                style={styles.input}
                placeholder="John Doe"
                placeholderTextColor={colors.textSecondary}
                value={accountName}
                onChangeText={setAccountName}
              />

              <Text style={styles.label}>
                {methodType === 'bank_account' ? 'Account Number' : 'Card Number'}
              </Text>
              <TextInput
                style={styles.input}
                placeholder={methodType === 'bank_account' ? '1234567890' : '1234 5678 9012 3456'}
                placeholderTextColor={colors.textSecondary}
                value={accountNumber}
                onChangeText={setAccountNumber}
                keyboardType="numeric"
              />

              {methodType === 'bank_account' && (
                <>
                  <Text style={styles.label}>Routing Number</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="123456789"
                    placeholderTextColor={colors.textSecondary}
                    value={routingNumber}
                    onChangeText={setRoutingNumber}
                    keyboardType="numeric"
                  />

                  <Text style={styles.label}>Bank Name</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Bank of America"
                    placeholderTextColor={colors.textSecondary}
                    value={bankName}
                    onChangeText={setBankName}
                  />
                </>
              )}

              <TouchableOpacity
                style={styles.button}
                onPress={handleAddPayoutMethod}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.buttonText}>Add Method</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => setShowAddMethod(false)}
              >
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Payout History */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payout History</Text>
          {payoutHistory.length === 0 ? (
            <Text style={styles.label}>No payout history</Text>
          ) : (
            payoutHistory.map(payout => (
              <View key={payout.id} style={styles.historyItem}>
                <View style={styles.historyInfo}>
                  <Text style={styles.historyAmount}>
                    ${parseFloat(payout.amount).toFixed(2)}
                  </Text>
                  <Text style={styles.historyDate}>
                    {new Date(payout.requested_at).toLocaleDateString()}
                  </Text>
                </View>
                <View
                  style={[
                    styles.historyStatus,
                    {
                      backgroundColor:
                        payout.status === 'completed'
                          ? `${colors.success}20`
                          : payout.status === 'failed'
                          ? `${colors.danger}20`
                          : `${colors.warning}20`,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.historyStatusText,
                      {
                        color:
                          payout.status === 'completed'
                            ? colors.success
                            : payout.status === 'failed'
                            ? colors.danger
                            : colors.warning,
                      },
                    ]}
                  >
                    {payout.status.toUpperCase()}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}
