/**
 * CHECKOUT PAGE - In-app Stripe PaymentSheet + MonCash (Haiti)
 * Card + Apple Pay + Google Pay + MonCash
 * After success → check-subscription → update tier → /subscription-success
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth, useAlert, getSupabaseClient } from '@/template';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSubscription } from '../hooks/useSubscription';
import { FunctionsHttpError } from '@supabase/supabase-js';
import * as WebBrowser from 'expo-web-browser';

// ---------- stripe-react-native (native only) ----------
let StripeProvider: React.ComponentType<any> | null = null;
let useStripe: (() => { initPaymentSheet: any; presentPaymentSheet: any }) | null = null;

if (Platform.OS !== 'web') {
  try {
    const stripeLib = require('@stripe/stripe-react-native');
    StripeProvider = stripeLib.StripeProvider;
    useStripe = stripeLib.useStripe;
  } catch (_e) {
    // library not installed — graceful degradation
  }
}

// ── Stripe publishable key ──
const STRIPE_PUBLISHABLE_KEY =
  process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ||
  'pk_live_51TPUrUE0VkO7z1VnRqkzCbmYPxjnq7sguPT50wDpUHCEBBEcaBXVy8iFxoAWcT5nxQ5kfMJjMEGVjhYaXv5OB9cT00mdXajb91';

// ── Stripe price for Plus plan ──
const PLUS_PRICE_ID = 'price_1TPUrzE0VkO7z1Vnlgj45978'; // $19.99/month

// ── MonCash config ──
const MONCASH_SANDBOX_GATEWAY = 'https://sandbox.moncashbutton.digicelgroup.com/Moncash-middleware/Payment/Redirect';
const isHaitiUser = (user: any) => {
  if (!user) return false;
  const country = user.user_metadata?.country || user.user_metadata?.address?.country;
  const phone = user.phone || user.user_metadata?.phone || '';
  return country === 'HT' || country === 'Haiti' || phone.startsWith('+509') || phone.startsWith('509');
};

// ---------- Inner component (uses useStripe hook) ----------
function CheckoutInner() {
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const { refreshSubscription } = useSubscription();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const supabase = getSupabaseClient();
  const params = useLocalSearchParams();

  // Accept plan / priceId from params (defaults to plus)
  const plan = (params.plan as string) || 'plus';
  const priceId = (params.priceId as string) || PLUS_PRICE_ID;

  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [paymentSheetReady, setPaymentSheetReady] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<'stripe' | 'moncash'>('stripe');

  // Safely call useStripe — only if available
  const stripeHook = useStripe ? useStripe() : null;
  const initPaymentSheet = stripeHook?.initPaymentSheet;
  const presentPaymentSheet = stripeHook?.presentPaymentSheet;

  const planLabel = plan === 'plus' ? 'Dawinix Plus' : 'Dawinix Go';
  const planPriceUSD = plan === 'plus' ? '$19.99' : '$8.00';
  const planPriceHTG = plan === 'plus' ? '2,650 HTG' : '1,060 HTG'; // Approximate conversion
  const planColor = plan === 'plus' ? '#6B5CE7' : '#34C759';
  const showMonCash = isHaitiUser(user);

  // ── Initialize Stripe PaymentSheet ──
  const initSheet = useCallback(async () => {
    if (!initPaymentSheet || !user) return;
    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      // Ask edge function for a PaymentIntent (subscription mode)
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: { plan, priceId, mode: 'payment_sheet' },
        headers: { Authorization: `Bearer ${token}` },
      });

      if (error) {
        let msg = error.message;
        if (error instanceof FunctionsHttpError) {
          try { msg = await error.context?.text() || msg; } catch (_e) {}
        }
        throw new Error(msg);
      }

      // Edge function returns { clientSecret, customerId, ephemeralKey }
      // (or falls back to a hosted-checkout URL — handled below)
      const { clientSecret, ephemeralKey, customerId, url } = data || {};

      // Fallback: if edge returns a hosted URL instead of clientSecret, open browser
      if (!clientSecret && url) {
        await WebBrowser.openBrowserAsync(url, {
          presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
        });
        setTimeout(() => refreshSubscription?.(), 2000);
        router.back();
        return;
      }

      if (!clientSecret) throw new Error('No PaymentIntent client secret returned');

      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: 'Dawinix AI',
        customerId: customerId ?? undefined,
        customerEphemeralKeySecret: ephemeralKey ?? undefined,
        paymentIntentClientSecret: clientSecret,
        allowsDelayedPaymentMethods: false,
        defaultBillingDetails: {
          email: user.email,
        },
        applePay: {
          merchantCountryCode: 'US',
        },
        googlePay: {
          merchantCountryCode: 'US',
          testEnv: false,
          currencyCode: 'usd',
        },
        style: 'alwaysDark',
        returnURL: 'dawinixht://checkout/return',
      });

      if (initError) throw new Error(initError.message);
      setPaymentSheetReady(true);
    } catch (err: any) {
      showAlert('Setup Error', err?.message || 'Could not initialize payment. Please try again.');
    } finally {
      setLoading(false);
      setReady(true);
    }
  }, [initPaymentSheet, user, supabase, plan, priceId, showAlert, refreshSubscription, router]);

  useEffect(() => {
    initSheet();
  }, []);

  // ── MonCash Payment Flow ──
  const handleMonCashPay = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      // 1. Call edge function to create MonCash payment token
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: { 
          plan, 
          priceId, 
          mode: 'moncash',
          amount: plan === 'plus' ? 2650 : 1060, // HTG amount
          orderId: `DWNX-${user.id}-${Date.now()}`
        },
        headers: { Authorization: `Bearer ${token}` },
      });

      if (error) throw new Error(error.message);
      if (!data?.paymentUrl) throw new Error('No MonCash payment URL returned');

      // 2. Open MonCash hosted gateway
      const result = await WebBrowser.openBrowserAsync(data.paymentUrl, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
        controlsColor: '#6B5CE7',
      });

      // 3. Handle return from gateway
      if (result.type === 'dismiss') {
        // Poll for payment verification
        await verifyMonCashPayment(data.orderId);
      }
    } catch (err: any) {
      showAlert('MonCash Error', err?.message || 'Could not process MonCash payment.');
    } finally {
      setLoading(false);
    }
  };

  // ── Verify MonCash Payment ──
  const verifyMonCashPayment = async (orderId: string) => {
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) return;

      // Poll edge function for payment status
      const { data, error } = await supabase.functions.invoke('verify-moncash-payment', {
        body: { orderId },
        headers: { Authorization: `Bearer ${token}` },
      });

      if (error) throw new Error(error.message);

      if (data?.status === 'success') {
        // Payment succeeded — sync subscription tier
        await supabase.from('user_profiles').update({
          subscription_tier: plan,
          subscription_expires_at: data?.subscription_end || null,
          billing_info: { ...data?.billingInfo, provider: 'moncash' }
        }).eq('id', user?.id);

        await refreshSubscription?.();
        router.replace('/subscription-success');
      } else {
        showAlert('Payment Pending', 'Your MonCash payment is being processed. We will update your account shortly.');
      }
    } catch (err: any) {
      showAlert('Verification Error', err?.message || 'Could not verify payment status.');
    }
  };

  // ── Present PaymentSheet and handle result ──
  const handleStripePay = async () => {
    if (!presentPaymentSheet || !paymentSheetReady) {
      showAlert('Not Available', 'In-app payments are not available here. Please use the "Buy on Web" option from the subscription screen.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await presentPaymentSheet();

      if (error) {
        if (error.code === 'Canceled') {
          return;
        }
        throw new Error(error.message);
      }

      // ── Payment succeeded — sync subscription tier ──
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (token) {
        const { data: subData } = await supabase.functions.invoke('check-subscription', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (user?.id) {
          await supabase.from('user_profiles').update({
            subscription_tier: subData?.plan || plan,
            subscription_expires_at: subData?.subscription_end || null,
          }).eq('id', user.id);
        }
      }

      await refreshSubscription?.();
      router.replace('/subscription-success');
    } catch (err: any) {
      showAlert('Payment Failed', err?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePay = () => {
    if (selectedMethod === 'moncash') {
      handleMonCashPay();
    } else {
      handleStripePay();
    }
  };

  // ── Plan benefit list ──
  const benefits =
    plan === 'plus'
      ? [
          'Advanced AI models',
          'Unlimited messages',
          '20 image & file uploads per session',
          'Agents & deep research',
          'Priority support',
          'DAWINIX2026 — 20% discount',
        ]
      : [
          'More daily messages',
          '10 image & file uploads per session',
          'Group chat creation',
          'Longer conversation memory',
        ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Checkout</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Plan card */}
        <View style={[styles.planCard, { borderColor: planColor + '55' }]}>
          <View style={[styles.planBadge, { backgroundColor: planColor }]}>
            <Text style={styles.planBadgeText}>
              {plan === 'plus' ? '✨ PLUS' : '⚡ GO'}
            </Text>
          </View>
          <Text style={styles.planName}>{planLabel}</Text>
          <Text style={[styles.planPrice, { color: planColor }]}>
            {showMonCash && selectedMethod === 'moncash' ? planPriceHTG : planPriceUSD}
            <Text style={styles.planPriceSuffix}>/month</Text>
          </Text>
          {plan === 'plus' ? (
            <View style={styles.couponRow}>
              <Ionicons name="pricetag" size={13} color="#FFD60A" />
              <Text style={styles.couponText}> DAWINIX2026 — 20% off applied</Text>
            </View>
          ) : null}
        </View>

        {/* Benefits */}
        <View style={styles.benefitsCard}>
          <Text style={[styles.benefitsTitle, { color: planColor }]}>What you get</Text>
          {benefits.map((b) => (
            <View key={b} style={styles.benefitRow}>
              <Ionicons name="checkmark-circle" size={18} color={planColor} />
              <Text style={styles.benefitText}>{b}</Text>
            </View>
          ))}
        </View>

        {/* Payment Method Selector */}
        <View style={styles.paymentSelector}>
          <Text style={styles.paymentSelectorTitle}>Payment Method</Text>
          
          {/* Stripe Option */}
          <TouchableOpacity
            style={[
              styles.paymentOption,
              selectedMethod === 'stripe' && styles.paymentOptionActive,
              { borderColor: selectedMethod === 'stripe' ? planColor : 'rgba(255,255,255,0.1)' }
            ]}
            onPress={() => setSelectedMethod('stripe')}
          >
            <View style={styles.paymentOptionLeft}>
              <Ionicons 
                name="card-outline" 
                size={22} 
                color={selectedMethod === 'stripe' ? planColor : 'rgba(255,255,255,0.6)'} 
              />
              <View style={styles.paymentOptionText}>
                <Text style={[styles.paymentOptionLabel, selectedMethod === 'stripe' && { color: '#FFF' }]}>
                  Card / Apple Pay / Google Pay
                </Text>
                <Text style={styles.paymentOptionSub}>
                  Secure payment via Stripe
                </Text>
              </View>
            </View>
            {selectedMethod === 'stripe' && (
              <Ionicons name="checkmark-circle" size={22} color={planColor} />
            )}
          </TouchableOpacity>

          {/* MonCash Option (Haiti only) */}
          {showMonCash && (
            <TouchableOpacity
              style={[
                styles.paymentOption,
                selectedMethod === 'moncash' && styles.paymentOptionActive,
                { borderColor: selectedMethod === 'moncash' ? '#DC143C' : 'rgba(255,255,255,0.1)' }
              ]}
              onPress={() => setSelectedMethod('moncash')}
            >
              <View style={styles.paymentOptionLeft}>
                <View style={[styles.moncashIcon, { backgroundColor: '#DC143C' }]}>
                  <Text style={styles.moncashIconText}>M</Text>
                </View>
                <View style={styles.paymentOptionText}>
                  <Text style={[styles.paymentOptionLabel, selectedMethod === 'moncash' && { color: '#FFF' }]}>
                    MonCash
                  </Text>
                  <Text style={styles.paymentOptionSub}>
                    Pay with Digicel MonCash (Haiti)
                  </Text>
                </View>
              </View>
              {selectedMethod === 'moncash' && (
                <Ionicons name="checkmark-circle" size={22} color="#DC143C" />
              )}
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.secureNote}>
          <Ionicons name="lock-closed" size={12} color="rgba(255,255,255,0.4)" />
          {'  '}Payments are processed securely by {selectedMethod === 'moncash' ? 'Digicel MonCash' : 'Stripe'}.{'\n'}
          Cancel anytime from Settings → Subscription.
        </Text>
      </ScrollView>

      {/* Bottom CTA */}
      <View style={[styles.bottomCTA, { paddingBottom: insets.bottom + 20 }]}>
        {loading ? (
          <View style={[styles.payBtn, { backgroundColor: selectedMethod === 'moncash' ? '#DC143C' : planColor, opacity: 0.7 }]}>
            <ActivityIndicator color="#FFF" />
            <Text style={styles.payBtnText}>
              {selectedMethod === 'moncash' ? 'Processing MonCash...' : (paymentSheetReady ? 'Processing...' : 'Setting up...')}
            </Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[
              styles.payBtn, 
              { backgroundColor: selectedMethod === 'moncash' ? '#DC143C' : planColor },
              !paymentSheetReady && selectedMethod === 'stripe' && styles.btnDisabled
            ]}
            onPress={handlePay}
            disabled={!ready && selectedMethod === 'stripe'}
            activeOpacity={0.85}
          >
            {selectedMethod === 'moncash' ? (
              <>
                <View style={[styles.moncashIconSmall, { backgroundColor: '#FFF' }]}>
                  <Text style={[styles.moncashIconTextSmall, { color: '#DC143C' }]}>M</Text>
                </View>
                <Text style={styles.payBtnText}>
                  Pay with MonCash · {planPriceHTG}/mo
                </Text>
              </>
            ) : (
              <>
                {Platform.OS === 'ios' ? (
                  <Ionicons name="logo-apple" size={20} color="#FFF" />
                ) : (
                  <Ionicons name="card-outline" size={20} color="#FFF" />
                )}
                <Text style={styles.payBtnText}>
                  {Platform.OS === 'ios'
                    ? `Pay with Apple Pay · ${planPriceUSD}/mo`
                    : `Pay · ${planPriceUSD}/mo`}
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ---------- Root export: wrap with StripeProvider on native ----------
export default function CheckoutScreen() {
  if (Platform.OS === 'web' || !StripeProvider) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center', padding: 32 }]}>
        <Ionicons name="card-outline" size={48} color="rgba(255,255,255,0.4)" />
        <Text style={{ color: '#FFF', fontSize: 20, fontWeight: '700', marginTop: 16, textAlign: 'center' }}>
          In-app payments unavailable
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 15, marginTop: 10, textAlign: 'center', lineHeight: 22 }}>
          Please use the "Buy on Web" option from the subscription screen to complete your purchase.
        </Text>
      </View>
    );
  }

  return (
    <StripeProvider
      publishableKey={STRIPE_PUBLISHABLE_KEY}
      merchantIdentifier="merchant.com.dawinix.ht"
      urlScheme="dawinixht"
    >
      <CheckoutInner />
    </StripeProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 28,
    alignItems: 'center',
  },

  // Plan card
  planCard: {
    width: '100%',
    backgroundColor: 'rgba(17,17,17,0.95)',
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
  },
  planBadge: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginBottom: 14,
  },
  planBadgeText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
  },
  planName: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 8,
  },
  planPrice: {
    fontSize: 38,
    fontWeight: '800',
    marginBottom: 12,
  },
  planPriceSuffix: {
    fontSize: 18,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.6)',
  },
  couponRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,214,10,0.12)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,214,10,0.3)',
  },
  couponText: {
    color: '#FFD60A',
    fontSize: 13,
    fontWeight: '600',
  },

  // Benefits
  benefitsCard: {
    width: '100%',
    backgroundColor: 'rgba(17,17,17,0.95)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 16,
    marginBottom: 20,
  },
  benefitsTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 14,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  benefitText: {
    color: '#FFF',
    fontSize: 15,
    flex: 1,
  },

  // Payment Selector
  paymentSelector: {
    width: '100%',
    marginBottom: 20,
  },
  paymentSelectorTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(17,17,17,0.95)',
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 16,
    marginBottom: 10,
  },
  paymentOptionActive: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  paymentOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  paymentOptionText: {
    flex: 1,
  },
  paymentOptionLabel: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  paymentOptionSub: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 13,
  },
  moncashIcon: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moncashIconText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
  },
  moncashIconSmall: {
    width: 22,
    height: 22,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moncashIconTextSmall: {
    fontSize: 12,
    fontWeight: '800',
  },

  secureNote: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 8,
    marginBottom: 20,
  },

  // Bottom CTA
  bottomCTA: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingTop: 16,
    backgroundColor: 'rgba(0,0,0,0.95)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
    gap: 10,
  },
  payBtn: {
    width: '100%',
    borderRadius: 50,
    paddingVertical: 17,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  payBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFF',
  },
  btnDisabled: {
    opacity: 0.55,
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  cancelBtnText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.45)',
  },
});
please run this in supabase :create table if not exists public.moncash_transactions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  order_id text not null unique,
  plan text not null,
  amount integer not null,
  currency text default 'HTG',
  status text default 'pending', -- pending, completed, failed
  token text,
  payment_details jsonb,
  created_at timestamptz default now(),
  verified_at timestamptz,
  updated_at timestamptz default now()
);

-- Enable RLS
alter table public.moncash_transactions enable row level security;

-- Policies
create policy "Users can view own moncash transactions"
  on public.moncash_transactions for select
  using (auth.uid() = user_id);

-- Index for faster lookups
create index idx_moncash_transactions_order_id on public.moncash_transactions(order_id);
create index idx_moncash_transactions_user_id on public.moncash_transactions(user_id); and if need more make it real with no demo.
