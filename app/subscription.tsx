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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useSubscription } from '../hooks/useSubscription';
import { useRouter } from 'expo-router';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAlert } from '@/template';

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

// Stripe checkout links (one-time links you can update)
const STRIPE_PLUS_URL = 'https://buy.stripe.com/plus_19_99';
const STRIPE_GO_URL = 'https://buy.stripe.com/go_8_00';

export default function SubscriptionScreen() {
  const { colors, isDark } = useTheme();
  const { tier, restorePurchases } = useSubscription();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [selectedPlan, setSelectedPlan] = useState<'go' | 'plus'>('go');

  const features = selectedPlan === 'go' ? GO_FEATURES : PLUS_FEATURES;
  const planColor = '#6B5CE7'; // Purple like ChatGPT
  const planPrice = selectedPlan === 'go' ? '$8.00' : '$19.99';
  const planLabel = selectedPlan === 'go' ? 'Get Dawinix Go' : 'Get Dawinix Plus';
  const planSubtitle = selectedPlan === 'go'
    ? 'Keep chatting with expanded access'
    : 'Do more with advanced intelligence';

  const handleUpgrade = async () => {
    if (selectedPlan === 'go') {
      // Go plan: direct Stripe checkout (Apple Pay preferred on iOS)
      router.push({
        pathname: '/stripe-checkout',
        params: {
          priceId: 'price_go_800',
          planName: 'Dawinix Go',
          amount: '8',
          method: Platform.OS === 'ios' ? 'apple_pay' : 'card',
        },
      });
    } else {
      // Plus plan: choose payment method
      Alert.alert(
        'Dawinix Plus — $19.99/month',
        'Choose your payment method',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: Platform.OS === 'ios' ? 'Apple Pay' : 'Pay Now',
            onPress: () => {
              router.push({
                pathname: '/stripe-checkout',
                params: {
                  priceId: 'price_1SjmtpE0VkO7z1Vn1lpvP0PC',
                  planName: 'Dawinix Plus',
                  amount: '19.99',
                  method: Platform.OS === 'ios' ? 'apple_pay' : 'card',
                },
              });
            },
          },
          {
            text: 'Pay with Card',
            onPress: () => {
              router.push({
                pathname: '/stripe-checkout',
                params: {
                  priceId: 'price_1SjmtpE0VkO7z1Vn1lpvP0PC',
                  planName: 'Dawinix Plus',
                  amount: '19.99',
                  method: 'card',
                },
              });
            },
          },
        ]
      );
    }
  };

  const handlePurchaseOnWeb = () => {
    if (selectedPlan === 'plus') {
      Linking.openURL('https://dawinix.com/subscription');
    }
    // Go plan: no web purchase
  };

  const handleRestore = async () => {
    const { error } = await restorePurchases();
    if (error) {
      showAlert('Error', error);
    } else {
      showAlert('Success', 'Purchases restored successfully');
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
      </ScrollView>

      {/* Bottom CTA */}
      <View style={[styles.bottomCTA, { paddingBottom: insets.bottom + 20 }]}>
        <TouchableOpacity style={styles.upgradeBtn} onPress={handleUpgrade}>
          <Text style={styles.upgradeBtnText}>Upgrade for {planPrice}</Text>
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
