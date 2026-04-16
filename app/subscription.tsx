import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Linking,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useSubscription } from '../hooks/useSubscription';
import { useRouter } from 'expo-router';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAlert } from '@/template';
import * as InAppPurchases from 'expo-in-app-purchases';
import { supabase } from '../lib/supabase'; // Adjust path to your supabase client

// ── Feature comparison rows ──
const GO_FEATURES = [
  { label: 'Basic models', free: true, plan: true },
  { label: 'More messages', free: false, plan: true },
  { label: 'More uploads', free: false, plan: true },
  { label: 'More image creation', free: false, plan: true },
  { label: 'Longer memory', free: false, plan: true },
];

const PLUS_FEATURES = [
  { label: 'Basic models', free: true, plan: true },
  { label: 'Smarter models', free: false, plan: true },
  { label: 'More messages and uploads', free: false, plan: true },
  { label: 'More image creation', free: false, plan: true },
  { label: 'Early access to new features', free: false, plan: true },
  { label: 'Agents and deep research', free: false, plan: true },
  { label: 'More memory', free: false, plan: true },
];

// Product IDs from App Store Connect / Google Play Console
const PRODUCT_IDS = {
  go: Platform.select({
    ios: 'com.dawinix.go.monthly',
    android: 'com.dawinix.go.monthly',
  }),
  plus: Platform.select({
    ios: 'com.dawinix.plus.monthly',
    android: 'com.dawinix.plus.monthly',
  }),
  go_yearly: Platform.select({
    ios: 'com.dawinix.go.yearly',
    android: 'com.dawinix.go.yearly',
  }),
  plus_yearly: Platform.select({
    ios: 'com.dawinix.plus.yearly',
    android: 'com.dawinix.plus.yearly',
  }),
};

// Supabase Edge Function URL
const SUPABASE_FUNCTION_URL = 'https://njpuoozygqtpvlzhnjpu.supabase.co/functions/v1/verify-purchase';

export default function SubscriptionScreen() {
  const { colors, isDark } = useTheme();
  const { tier, restorePurchases } = useSubscription();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [selectedPlan, setSelectedPlan] = useState<'go' | 'plus'>('go');
  const [isLoading, setIsLoading] = useState(false);
  const [products, setProducts] = useState<InAppPurchases.IAPItemDetails[]>([]);

  const features = selectedPlan === 'go' ? GO_FEATURES : PLUS_FEATURES;
  const planColor = '#6B5CE7'; // Purple like ChatGPT
  const planPrice = selectedPlan === 'go' ? '$8.00' : '$19.99';
  const planLabel = selectedPlan === 'go' ? 'Get Dawinix Go' : 'Get Dawinix Plus';
  const planSubtitle = selectedPlan === 'go'
    ? 'Keep chatting with expanded access'
    : 'Do more with advanced intelligence';

  // Initialize IAP on mount
  React.useEffect(() => {
    initializeIAP();
    return () => {
      InAppPurchases.disconnectAsync();
    };
  }, []);

  const initializeIAP = async () => {
    try {
      await InAppPurchases.connectAsync();
      const { responseCode, results } = await InAppPurchases.getProductsAsync([
        PRODUCT_IDS.go!,
        PRODUCT_IDS.plus!,
        PRODUCT_IDS.go_yearly!,
        PRODUCT_IDS.plus_yearly!,
      ]);
      
      if (responseCode === InAppPurchases.IAPResponseCode.OK && results) {
        setProducts(results);
      }
    } catch (error) {
      console.error('IAP initialization error:', error);
    }
  };

  // Call Supabase Edge Function to verify purchase
  const verifyPurchaseWithSupabase = async (
    receipt: string,
    transactionId: string,
    productId: string,
    isSandbox = false
  ): Promise<boolean> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('User not authenticated');
      }

      const response = await fetch(`${SUPABASE_FUNCTION_URL}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          platform: Platform.OS === 'ios' ? 'ios' : 'android',
          receipt: receipt,
          transactionId: transactionId,
          productId: productId,
          isSandbox: isSandbox || __DEV__, // Auto-detect sandbox in dev
        }),
      });

      const result = await response.json();

      if (!result.success) {
        console.error('Verification failed:', result.error);
        showAlert('Verification Failed', result.error || 'Could not verify purchase');
        return false;
      }

      console.log('✅ Purchase verified:', result);
      
      // Update local subscription state
      // You might want to refresh the subscription context here
      return true;
      
    } catch (error) {
      console.error('Error calling verify function:', error);
      showAlert('Error', 'Failed to verify purchase. Please try again.');
      return false;
    }
  };

  const handleUpgrade = async () => {
    setIsLoading(true);
    
    try {
      const productId = selectedPlan === 'go' ? PRODUCT_IDS.go : PRODUCT_IDS.plus;
      
      if (!productId) {
        showAlert('Error', 'Product not available');
        return;
      }

      // Start purchase flow
      const { responseCode, results } = await InAppPurchases.requestPurchaseAsync(productId);

      if (responseCode === InAppPurchases.IAPResponseCode.OK && results) {
        const purchase = results[0];
        
        if (!purchase) {
          showAlert('Error', 'Purchase failed');
          return;
        }

        // Prepare receipt data based on platform
        let receiptData: string;
        
        if (Platform.OS === 'ios') {
          // iOS: transactionReceipt is base64 encoded
          receiptData = purchase.transactionReceipt;
        } else {
          // Android: need to stringify the purchase object
          receiptData = JSON.stringify({
            productId: purchase.productId,
            purchaseToken: purchase.purchaseToken,
            orderId: purchase.orderId,
          });
        }

        // Verify with Supabase Edge Function
        const verified = await verifyPurchaseWithSupabase(
          receiptData,
          purchase.orderId || purchase.transactionId,
          purchase.productId,
          __DEV__ // Sandbox in development
        );

        if (verified) {
          // Finish the transaction (acknowledge to Apple/Google)
          await InAppPurchases.finishTransactionAsync(purchase, true);
          
          showAlert('Success', 'Your subscription is now active!');
          router.back();
        } else {
          // Don't finish transaction if verification failed
          // This allows retry
        }
      } else if (responseCode === InAppPurchases.IAPResponseCode.USER_CANCELED) {
        // User cancelled, no action needed
        console.log('User cancelled purchase');
      } else {
        showAlert('Error', 'Purchase failed. Please try again.');
      }
    } catch (error) {
      console.error('Purchase error:', error);
      showAlert('Error', 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async () => {
    setIsLoading(true);
    try {
      const { responseCode, results } = await InAppPurchases.getPurchaseHistoryAsync();
      
      if (responseCode === InAppPurchases.IAPResponseCode.OK && results) {
        let restored = false;
        
        for (const purchase of results) {
          const receiptData = Platform.OS === 'ios' 
            ? purchase.transactionReceipt
            : JSON.stringify({
                productId: purchase.productId,
                purchaseToken: purchase.purchaseToken,
                orderId: purchase.orderId,
              });

          const verified = await verifyPurchaseWithSupabase(
            receiptData,
            purchase.orderId || purchase.transactionId,
            purchase.productId,
            __DEV__
          );

          if (verified) {
            await InAppPurchases.finishTransactionAsync(purchase, true);
            restored = true;
          }
        }

        if (restored) {
          showAlert('Success', 'Purchases restored successfully');
        } else {
          showAlert('Info', 'No active purchases found');
        }
      }
    } catch (error) {
      console.error('Restore error:', error);
      showAlert('Error', 'Failed to restore purchases');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePurchaseOnWeb = () => {
    if (selectedPlan === 'plus') {
      Linking.openURL('https://dawinix.com/subscription');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: '#000' }]}>
      {/* Close button */}
      <TouchableOpacity
        style={[styles.closeBtn, { top: insets.top + 12 }]}
        onPress={() => router.back()}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="close" size={22} color="rgba(255,255,255,0.7)" />
      </TouchableOpacity>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 56, paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Star icon */}
        <View style={[styles.iconWrap, { backgroundColor: planColor }]}>
          <Ionicons name="sparkles" size={28} color="#FFF" />
        </View>

        {/* Title */}
        <Text style={styles.title}>{planLabel}</Text>
        <Text style={styles.subtitle}>{planSubtitle}</Text>

        {/* Plan Toggle */}
        <View style={styles.toggle}>
          <TouchableOpacity
            style={[styles.toggleBtn, selectedPlan === 'go' && styles.toggleBtnActive]}
            onPress={() => setSelectedPlan('go')}
          >
            <Text style={[styles.toggleText, selectedPlan === 'go' && styles.toggleTextActive]}>
              Go
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, selectedPlan === 'plus' && styles.toggleBtnActive]}
            onPress={() => setSelectedPlan('plus')}
          >
            <Text style={[styles.toggleText, selectedPlan === 'plus' && styles.toggleTextActive]}>
              Plus
            </Text>
          </TouchableOpacity>
        </View>

        {/* Feature Comparison Table */}
        <View style={styles.featureCard}>
          {/* Header row */}
          <View style={styles.featureRow}>
            <Text style={styles.featureHeaderLabel}>Features</Text>
            <Text style={styles.featureHeaderFree}>Free</Text>
            <Text style={[styles.featureHeaderPlan, { color: planColor }]}>
              {selectedPlan === 'go' ? 'Go' : 'Plus'}
            </Text>
          </View>

          {features.map((f, i) => (
            <View
              key={f.label}
              style={[styles.featureRow, i < features.length - 1 && styles.featureRowBorder]}
            >
              <Text style={styles.featureLabel}>{f.label}</Text>
              <View style={styles.featureCheck}>
                {f.free ? (
                  <Ionicons name="checkmark" size={18} color="rgba(255,255,255,0.7)" />
                ) : (
                  <Text style={styles.featureDash}>—</Text>
                )}
              </View>
              <View style={styles.featureCheck}>
                <Ionicons name="checkmark" size={18} color={planColor} />
              </View>
            </View>
          ))}
        </View>

        {/* Restore Purchases Link */}
        <TouchableOpacity onPress={handleRestore} style={styles.restoreBtn}>
          <Text style={styles.restoreText}>Restore Purchases</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Bottom CTA */}
      <View style={[styles.bottomCTA, { paddingBottom: insets.bottom + 20 }]}>
        <TouchableOpacity 
          style={[styles.upgradeBtn, isLoading && styles.upgradeBtnDisabled]} 
          onPress={handleUpgrade}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.upgradeBtnText}>Upgrade for {planPrice}</Text>
          )}
        </TouchableOpacity>

        {selectedPlan === 'plus' && (
          <TouchableOpacity onPress={handlePurchaseOnWeb} style={{ marginTop: 12 }}>
            <Text style={styles.webLink}>
              Purchase on web {'↗'}
            </Text>
          </TouchableOpacity>
        )}

        <Text style={styles.legalText}>
          Auto-renews monthly. Cancel anytime.
          {selectedPlan === 'go' ? '\nThis plan may include ads. ' : ' '}
          <Text style={[styles.legalText, { textDecorationLine: 'underline' }]}>Learn more</Text>
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  closeBtn: {
    position: 'absolute',
    right: 20,
    zIndex: 10,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#6B5CE7',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    marginBottom: 28,
  },
  toggle: {
    flexDirection: 'row',
    backgroundColor: '#1C1C1E',
    borderRadius: 30,
    padding: 4,
    marginBottom: 28,
    width: '100%',
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 26,
    alignItems: 'center',
  },
  toggleBtnActive: {
    backgroundColor: '#2C2C2E',
  },
  toggleText: {
    fontSize: 16,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.4)',
  },
  toggleTextActive: {
    color: '#FFF',
    fontWeight: '700',
  },
  featureCard: {
    width: '100%',
    backgroundColor: '#111',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
    marginBottom: 20,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  featureRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  featureHeaderLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.4)',
  },
  featureHeaderFree: {
    width: 52,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    color: '#FFF',
  },
  featureHeaderPlan: {
    width: 52,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '700',
  },
  featureLabel: {
    flex: 1,
    fontSize: 15,
    color: '#FFF',
    fontWeight: '400',
  },
  featureCheck: {
    width: 52,
    alignItems: 'center',
  },
  featureDash: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.3)',
    lineHeight: 22,
  },
  restoreBtn: {
    marginTop: 8,
    padding: 12,
  },
  restoreText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    textDecorationLine: 'underline',
  },
  bottomCTA: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingTop: 16,
    backgroundColor: '#000',
    alignItems: 'center',
  },
  upgradeBtn: {
    width: '100%',
    backgroundColor: '#FFF',
    borderRadius: 50,
    paddingVertical: 17,
    alignItems: 'center',
  },
  upgradeBtnDisabled: {
    opacity: 0.6,
  },
  upgradeBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000',
  },
  webLink: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
    textDecorationLine: 'underline',
    marginBottom: 10,
  },
  legalText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 17,
  },
});
