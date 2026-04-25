/**
 * CHECKOUT — Full in-app payment
 * • Contact: email (editable) + phone
 * • Card: Stripe CardField (name, number, expiry, CVV) — native only
 * • Apple Pay: Stripe in-app sheet (iOS)
 * • Google Pay: Stripe in-app sheet (Android)
 * • MonCash: edge-function → in-app WebBrowser (Haiti)
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
  TextInput,
  KeyboardAvoidingView,
  useColorScheme,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth, useAlert, getSupabaseClient } from '@/template';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSubscription } from '../hooks/useSubscription';
import { FunctionsHttpError } from '@supabase/supabase-js';
import * as WebBrowser from 'expo-web-browser';

// ─────────────────────────────────────────────────────────
// Theme
// ─────────────────────────────────────────────────────────
function useT() {
  const dark = useColorScheme() !== 'light';
  return {
    dark,
    bg: dark ? '#0A0A0A' : '#F2F2F7',
    surface: dark ? '#1C1C1E' : '#FFFFFF',
    surfaceBorder: dark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.08)',
    text: dark ? '#FFFFFF' : '#000000',
    textSec: dark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)',
    textMuted: dark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)',
    inputBg: dark ? '#2C2C2E' : '#F2F2F7',
    inputBorder: dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
    inputFocusBorder: '#6B5CE7',
    placeholderText: dark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)',
    headerBorder: dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)',
    bottomBg: dark ? 'rgba(10,10,10,0.98)' : 'rgba(242,242,247,0.98)',
    bottomBorder: dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.09)',
    tabInactive: dark ? '#2C2C2E' : '#E5E5EA',
    tabInactiveText: dark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)',
    cardFieldBg: dark ? '#2C2C2E' : '#F8F8F8',
    divider: dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)',
    secureText: dark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.3)',
    blurTint: (dark ? 'dark' : 'light') as 'dark' | 'light',
  };
}

// ─────────────────────────────────────────────────────────
// Stripe (native only — graceful web fallback)
// ─────────────────────────────────────────────────────────
let StripeProvider: React.ComponentType<any> | null = null;
let CardField: React.ComponentType<any> | null = null;
let useStripe: (() => {
  confirmPayment: any;
  initPaymentSheet: any;
  presentPaymentSheet: any;
  createPaymentMethod: any;
}) | null = null;
let useApplePay: (() => {
  isApplePaySupported: boolean;
  presentApplePay: any;
  confirmApplePayPayment: any;
}) | null = null;
let useGooglePay: (() => {
  isGooglePaySupported: (opts: any) => Promise<boolean>;
  initGooglePay: any;
  presentGooglePay: any;
}) | null = null;

if (Platform.OS !== 'web') {
  try {
    const lib = require('@stripe/stripe-react-native');
    StripeProvider = lib.StripeProvider;
    CardField = lib.CardField;
    useStripe = lib.useStripe;
    useApplePay = lib.useApplePay;
    useGooglePay = lib.useGooglePay;
  } catch (_e) {}
}

// ─────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────
const STRIPE_PK =
  process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ||
  'pk_live_51TPUrUE0VkO7z1VnRqkzCbmYPxjnq7sguPT50wDpUHCEBBEcaBXVy8iFxoAWcT5nxQ5kfMJjMEGVjhYaXv5OB9cT00mdXajb91';

const PLUS_PRICE_ID = 'price_1TPUrzE0VkO7z1Vnlgj45978';

const isHaitiUser = (user: any) => {
  if (!user) return false;
  const country = user.user_metadata?.country || '';
  const phone = user.phone || user.user_metadata?.phone || '';
  return country === 'HT' || country === 'Haiti' || phone.startsWith('+509');
};

// Payment tabs
type PayMethod = 'card' | 'apple' | 'google' | 'moncash';

// ─────────────────────────────────────────────────────────
// Inner checkout (has access to Stripe hooks)
// ─────────────────────────────────────────────────────────
function CheckoutInner() {
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const { refreshSubscription } = useSubscription();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const supabase = getSupabaseClient();
  const params = useLocalSearchParams();
  const T = useT();

  const plan = (params.plan as string) || 'plus';
  const priceId = (params.priceId as string) || PLUS_PRICE_ID;
  const planColor = plan === 'plus' ? '#6B5CE7' : '#34C759';
  const planLabel = plan === 'plus' ? 'Dawinix Plus' : 'Dawinix Go';
  const planPriceUSD = plan === 'plus' ? '$19.99' : '$8.00';
  const planPriceHTG = plan === 'plus' ? '2,650' : '1,060';
  const planAmountCents = plan === 'plus' ? 1999 : 800;
  const planAmountHTG = plan === 'plus' ? 2650 : 1060;

  // ── Contact info ──
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState('');
  const [focusedField, setFocusedField] = useState<string | null>(null);

  // ── Card holder name (CardField handles number/expiry/cvv natively) ──
  const [cardholderName, setCardholderName] = useState('');
  const [cardReady, setCardReady] = useState(false);

  // ── Payment method tab ──
  const showMoncash = isHaitiUser(user);
  const defaultTab: PayMethod = Platform.OS === 'ios' ? 'apple' : Platform.OS === 'android' ? 'google' : 'card';
  const [method, setMethod] = useState<PayMethod>(showMoncash ? 'moncash' : defaultTab);

  // ── Google Pay support ──
  const [googlePayReady, setGooglePayReady] = useState(false);

  // ── Apple Pay ──
  const applePay = useApplePay ? useApplePay() : null;
  const isApplePaySupported = applePay?.isApplePaySupported ?? false;

  // ── Google Pay ──
  const googlePay = useGooglePay ? useGooglePay() : null;

  // ── Stripe core ──
  const stripe = useStripe ? useStripe() : null;

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'android' || !googlePay) return;
    googlePay
      .isGooglePaySupported({ testEnv: false })
      .then((ok: boolean) => setGooglePayReady(ok))
      .catch(() => setGooglePayReady(false));
  }, []);

  // ── Benefits list ──
  const benefits =
    plan === 'plus'
      ? ['Advanced AI models', 'Unlimited messages', '20 uploads / session', 'Agents & deep research', 'Priority support']
      : ['More daily messages', '10 uploads / session', 'Group chat', 'Longer memory'];

  // ─────────────────────────────────────────
  // Get PaymentIntent secret from edge fn
  // ─────────────────────────────────────────
  const getClientSecret = async (token: string) => {
    const { data, error } = await supabase.functions.invoke('create-checkout-session', {
      body: { plan, priceId, mode: 'payment_sheet' },
      headers: { Authorization: `Bearer ${token}` },
    });
    if (error) {
      let msg = error.message;
      if (error instanceof FunctionsHttpError) {
        try { msg = await error.context?.text() || msg; } catch (_) {}
      }
      throw new Error(msg);
    }
    return data as { clientSecret?: string; ephemeralKey?: string; customerId?: string; url?: string };
  };

  // ─────────────────────────────────────────
  // Post-payment: sync subscription tier
  // ─────────────────────────────────────────
  const syncSubscription = async (token: string) => {
    const { data: subData } = await supabase.functions.invoke('check-subscription', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (user?.id) {
      await supabase.from('user_profiles').update({
        subscription_tier: subData?.plan || plan,
        subscription_expires_at: subData?.subscription_end || null,
      }).eq('id', user.id);
    }
    await refreshSubscription?.();
    router.replace('/subscription-success');
  };

  // ─────────────────────────────────────────
  // Card payment via Stripe PaymentSheet
  // ─────────────────────────────────────────
  const handleCardPay = async () => {
    if (!stripe) { showAlert('Error', 'Stripe not available'); return; }
    if (!cardReady) { showAlert('Incomplete', 'Please fill in your card details.'); return; }
    if (!cardholderName.trim()) { showAlert('Required', 'Please enter the cardholder name.'); return; }

    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const secretData = await getClientSecret(token);
      if (!secretData.clientSecret) throw new Error('No payment secret returned');

      const { error: initErr } = await stripe.initPaymentSheet({
        merchantDisplayName: 'Dawinix AI',
        customerId: secretData.customerId,
        customerEphemeralKeySecret: secretData.ephemeralKey,
        paymentIntentClientSecret: secretData.clientSecret,
        defaultBillingDetails: { name: cardholderName, email },
        allowsDelayedPaymentMethods: false,
        returnURL: 'dawinixht://checkout/return',
      });
      if (initErr) throw new Error(initErr.message);

      const { error: presentErr } = await stripe.presentPaymentSheet();
      if (presentErr) {
        if (presentErr.code === 'Canceled') return;
        throw new Error(presentErr.message);
      }
      await syncSubscription(token);
    } catch (err: any) {
      showAlert('Payment Failed', err?.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────
  // Apple Pay (in-app, no browser)
  // ─────────────────────────────────────────
  const handleApplePay = async () => {
    if (!applePay || !isApplePaySupported || !stripe) {
      showAlert('Not Available', 'Apple Pay is not available on this device.');
      return;
    }
    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const secretData = await getClientSecret(token);
      if (!secretData.clientSecret) throw new Error('No payment secret');

      const { error: initErr } = await stripe.initPaymentSheet({
        merchantDisplayName: 'Dawinix AI',
        customerId: secretData.customerId,
        customerEphemeralKeySecret: secretData.ephemeralKey,
        paymentIntentClientSecret: secretData.clientSecret,
        applePay: { merchantCountryCode: 'US' },
        defaultBillingDetails: { email },
        returnURL: 'dawinixht://checkout/return',
      });
      if (initErr) throw new Error(initErr.message);

      const { error: presentErr } = await stripe.presentPaymentSheet();
      if (presentErr) {
        if (presentErr.code === 'Canceled') return;
        throw new Error(presentErr.message);
      }
      await syncSubscription(token);
    } catch (err: any) {
      showAlert('Apple Pay Failed', err?.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────
  // Google Pay (in-app, no browser)
  // ─────────────────────────────────────────
  const handleGooglePay = async () => {
    if (!googlePay || !googlePayReady || !stripe) {
      showAlert('Not Available', 'Google Pay is not available on this device.');
      return;
    }
    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const secretData = await getClientSecret(token);
      if (!secretData.clientSecret) throw new Error('No payment secret');

      const { error: initErr } = await stripe.initPaymentSheet({
        merchantDisplayName: 'Dawinix AI',
        customerId: secretData.customerId,
        customerEphemeralKeySecret: secretData.ephemeralKey,
        paymentIntentClientSecret: secretData.clientSecret,
        googlePay: { merchantCountryCode: 'US', testEnv: false, currencyCode: 'usd' },
        defaultBillingDetails: { email },
        returnURL: 'dawinixht://checkout/return',
      });
      if (initErr) throw new Error(initErr.message);

      const { error: presentErr } = await stripe.presentPaymentSheet();
      if (presentErr) {
        if (presentErr.code === 'Canceled') return;
        throw new Error(presentErr.message);
      }
      await syncSubscription(token);
    } catch (err: any) {
      showAlert('Google Pay Failed', err?.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────
  // MonCash — edge function only, no web
  // ─────────────────────────────────────────
  const handleMonCash = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const orderId = `DWNX-${user.id}-${Date.now()}`;

      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: { plan, priceId, mode: 'moncash', amount: planAmountHTG, orderId, phone, email },
        headers: { Authorization: `Bearer ${token}` },
      });

      if (error) {
        let msg = error.message;
        if (error instanceof FunctionsHttpError) {
          try { msg = await error.context?.text() || msg; } catch (_) {}
        }
        throw new Error(msg);
      }
      if (!data?.paymentUrl) throw new Error('No MonCash payment URL returned from server');

      // Open MonCash gateway in-app (WebBrowser, not Linking)
      const result = await WebBrowser.openBrowserAsync(data.paymentUrl, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
        controlsColor: '#DC143C',
      });

      if (result.type === 'dismiss') {
        await verifyMonCash(data.orderId || orderId, token);
      }
    } catch (err: any) {
      showAlert('MonCash Error', err?.message || 'Could not process MonCash payment.');
    } finally {
      setLoading(false);
    }
  };

  const verifyMonCash = async (orderId: string, token: string) => {
    const { data, error } = await supabase.functions.invoke('verify-moncash-payment', {
      body: { orderId },
      headers: { Authorization: `Bearer ${token}` },
    });
    if (error) { showAlert('Verification Error', error.message); return; }
    if (data?.status === 'success') {
      if (user?.id) {
        await supabase.from('user_profiles').update({
          subscription_tier: plan,
          subscription_expires_at: data?.subscription_end || null,
          billing_info: { provider: 'moncash' },
        }).eq('id', user.id);
      }
      await refreshSubscription?.();
      router.replace('/subscription-success');
    } else {
      showAlert('Payment Pending', 'Your MonCash payment is being processed. We will update your account shortly.');
    }
  };

  // ─────────────────────────────────────────
  // Main pay handler
  // ─────────────────────────────────────────
  const handlePay = () => {
    switch (method) {
      case 'card': return handleCardPay();
      case 'apple': return handleApplePay();
      case 'google': return handleGooglePay();
      case 'moncash': return handleMonCash();
    }
  };

  // ─────────────────────────────────────────
  // Pay button label
  // ─────────────────────────────────────────
  const payLabel = () => {
    if (loading) return '';
    switch (method) {
      case 'card': return `Pay ${planPriceUSD}/mo with Card`;
      case 'apple': return `Pay with Apple Pay · ${planPriceUSD}/mo`;
      case 'google': return `Pay with Google Pay · ${planPriceUSD}/mo`;
      case 'moncash': return `Pay with MonCash · ${planPriceHTG} HTG/mo`;
    }
  };

  const payBtnColor = method === 'moncash' ? '#DC143C' : planColor;
  const payBtnDisabled = method === 'card' && (!cardReady || !cardholderName.trim());

  // ─────────────────────────────────────────
  // Stripe CardField theme
  // ─────────────────────────────────────────
  const cardFieldStyle = {
    backgroundColor: T.cardFieldBg,
    textColor: T.text,
    placeholderColor: T.placeholderText,
    borderColor: focusedField === 'card' ? planColor : T.inputBorder,
    borderWidth: focusedField === 'card' ? 1.5 : 1,
    borderRadius: 12,
    cursorColor: planColor,
  };

  // ─────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: T.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: T.headerBorder }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={24} color={T.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: T.text }]}>Checkout</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 130 }]}
      >
        {/* ── Plan summary card ── */}
        <View style={[styles.planCard, { backgroundColor: T.surface, borderColor: planColor + '44' }]}>
          <View style={[styles.planBadge, { backgroundColor: planColor }]}>
            <Text style={styles.planBadgeText}>{plan === 'plus' ? '✨ PLUS' : '⚡ GO'}</Text>
          </View>
          <Text style={[styles.planName, { color: T.text }]}>{planLabel}</Text>
          <Text style={[styles.planPrice, { color: planColor }]}>
            {method === 'moncash' ? `${planPriceHTG} HTG` : planPriceUSD}
            <Text style={[styles.planPricePer, { color: T.textSec }]}>/month</Text>
          </Text>
          <View style={styles.benefitsRow}>
            {benefits.map((b) => (
              <View key={b} style={styles.benefitChip}>
                <Ionicons name="checkmark-circle" size={13} color={planColor} />
                <Text style={[styles.benefitChipText, { color: T.textSec }]}>{b}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Contact info ── */}
        <View style={[styles.section, { backgroundColor: T.surface, borderColor: T.surfaceBorder }]}>
          <Text style={[styles.sectionTitle, { color: T.textSec }]}>CONTACT INFORMATION</Text>

          {/* Email */}
          <View style={styles.fieldRow}>
            <Ionicons name="mail-outline" size={18} color={T.textSec} style={styles.fieldIcon} />
            <View style={styles.fieldContent}>
              <Text style={[styles.fieldLabel, { color: T.textSec }]}>Email</Text>
              <TextInput
                style={[styles.fieldInput, { color: T.text }]}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                placeholderTextColor={T.placeholderText}
                placeholder="your@email.com"
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField(null)}
              />
            </View>
            {focusedField === 'email' && <View style={[styles.focusIndicator, { backgroundColor: planColor }]} />}
          </View>

          <View style={[styles.divider, { backgroundColor: T.divider }]} />

          {/* Phone */}
          <View style={styles.fieldRow}>
            <Ionicons name="call-outline" size={18} color={T.textSec} style={styles.fieldIcon} />
            <View style={styles.fieldContent}>
              <Text style={[styles.fieldLabel, { color: T.textSec }]}>Phone (optional)</Text>
              <TextInput
                style={[styles.fieldInput, { color: T.text }]}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholderTextColor={T.placeholderText}
                placeholder="+1 (555) 000-0000"
                onFocus={() => setFocusedField('phone')}
                onBlur={() => setFocusedField(null)}
              />
            </View>
            {focusedField === 'phone' && <View style={[styles.focusIndicator, { backgroundColor: planColor }]} />}
          </View>
        </View>

        {/* ── Payment method tabs ── */}
        <Text style={[styles.sectionHeader, { color: T.textSec }]}>PAYMENT METHOD</Text>
        <View style={styles.tabs}>
          {(
            [
              { key: 'card', label: 'Card', icon: 'card-outline' },
              ...(Platform.OS === 'ios' && isApplePaySupported ? [{ key: 'apple', label: 'Apple Pay', icon: 'logo-apple' }] : []),
              ...(Platform.OS === 'android' && googlePayReady ? [{ key: 'google', label: 'Google Pay', icon: 'logo-google' }] : []),
              ...(showMoncash ? [{ key: 'moncash', label: 'MonCash', icon: 'phone-portrait-outline' }] : []),
            ] as { key: PayMethod; label: string; icon: string }[]
          ).map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.tab,
                { backgroundColor: method === tab.key ? planColor : T.tabInactive },
              ]}
              onPress={() => setMethod(tab.key)}
            >
              <Ionicons
                name={tab.icon as any}
                size={15}
                color={method === tab.key ? '#FFF' : T.tabInactiveText}
              />
              <Text
                style={[
                  styles.tabText,
                  { color: method === tab.key ? '#FFF' : T.tabInactiveText },
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Card entry (Stripe CardField) ── */}
        {method === 'card' && (
          <View style={[styles.section, { backgroundColor: T.surface, borderColor: T.surfaceBorder }]}>
            <Text style={[styles.sectionTitle, { color: T.textSec }]}>CARD DETAILS</Text>

            {/* Cardholder name */}
            <View style={styles.fieldRow}>
              <Ionicons name="person-outline" size={18} color={T.textSec} style={styles.fieldIcon} />
              <View style={styles.fieldContent}>
                <Text style={[styles.fieldLabel, { color: T.textSec }]}>Name on card</Text>
                <TextInput
                  style={[styles.fieldInput, { color: T.text }]}
                  value={cardholderName}
                  onChangeText={setCardholderName}
                  autoCapitalize="words"
                  autoCorrect={false}
                  placeholderTextColor={T.placeholderText}
                  placeholder="Full name"
                  onFocus={() => setFocusedField('name')}
                  onBlur={() => setFocusedField(null)}
                />
              </View>
              {focusedField === 'name' && <View style={[styles.focusIndicator, { backgroundColor: planColor }]} />}
            </View>

            <View style={[styles.divider, { backgroundColor: T.divider }]} />

            {/* Stripe CardField: number + expiry + CVV (all in one native field) */}
            {CardField ? (
              <View style={styles.cardFieldWrap}>
                <Text style={[styles.fieldLabel, { color: T.textSec, marginBottom: 8 }]}>
                  Card number · Expiry · CVV
                </Text>
                <CardField
                  postalCodeEnabled={false}
                  placeholders={{ number: '4242 4242 4242 4242', expiration: 'MM/YY', cvc: 'CVV' }}
                  cardStyle={cardFieldStyle}
                  style={styles.cardField}
                  onCardChange={(details: any) => setCardReady(details.complete)}
                  onFocus={() => setFocusedField('card')}
                />
              </View>
            ) : (
              <View style={styles.cardFieldFallback}>
                <Ionicons name="card-outline" size={24} color={T.textMuted} />
                <Text style={[styles.cardFieldFallbackText, { color: T.textSec }]}>
                  Card entry requires the native app. Use Apple Pay, Google Pay, or install the app.
                </Text>
              </View>
            )}

            <View style={styles.cardBrands}>
              {['Visa', 'MC', 'Amex', 'Discover'].map((b) => (
                <View key={b} style={[styles.cardBrandChip, { borderColor: T.inputBorder }]}>
                  <Text style={[styles.cardBrandText, { color: T.textMuted }]}>{b}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── Apple Pay info ── */}
        {method === 'apple' && (
          <View style={[styles.section, { backgroundColor: T.surface, borderColor: T.surfaceBorder }]}>
            <View style={styles.payMethodInfo}>
              <View style={[styles.payMethodIconBig, { backgroundColor: '#000' }]}>
                <Ionicons name="logo-apple" size={32} color="#FFF" />
              </View>
              <Text style={[styles.payMethodInfoTitle, { color: T.text }]}>Apple Pay</Text>
              <Text style={[styles.payMethodInfoSub, { color: T.textSec }]}>
                Complete your payment securely using Touch ID or Face ID. No card details required.
              </Text>
            </View>
          </View>
        )}

        {/* ── Google Pay info ── */}
        {method === 'google' && (
          <View style={[styles.section, { backgroundColor: T.surface, borderColor: T.surfaceBorder }]}>
            <View style={styles.payMethodInfo}>
              <View style={[styles.payMethodIconBig, { backgroundColor: '#4285F4' }]}>
                <Ionicons name="logo-google" size={28} color="#FFF" />
              </View>
              <Text style={[styles.payMethodInfoTitle, { color: T.text }]}>Google Pay</Text>
              <Text style={[styles.payMethodInfoSub, { color: T.textSec }]}>
                Complete your purchase instantly using Google Pay — no card entry required.
              </Text>
            </View>
          </View>
        )}

        {/* ── MonCash info ── */}
        {method === 'moncash' && (
          <View style={[styles.section, { backgroundColor: T.surface, borderColor: T.surfaceBorder }]}>
            <View style={styles.payMethodInfo}>
              <View style={[styles.payMethodIconBig, { backgroundColor: '#DC143C' }]}>
                <Text style={styles.moncashBigIcon}>M</Text>
              </View>
              <Text style={[styles.payMethodInfoTitle, { color: T.text }]}>MonCash</Text>
              <Text style={[styles.payMethodInfoSub, { color: T.textSec }]}>
                Pay securely with your Digicel MonCash account.{'\n'}Amount: {planPriceHTG} HTG/month
              </Text>
              <View style={[styles.moncashNote, { backgroundColor: 'rgba(220,20,60,0.08)', borderColor: 'rgba(220,20,60,0.2)' }]}>
                <Ionicons name="information-circle-outline" size={14} color="#DC143C" />
                <Text style={[styles.moncashNoteText, { color: '#DC143C' }]}>
                  You will be redirected to the MonCash payment gateway within the app.
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Secure note */}
        <View style={styles.secureRow}>
          <Ionicons name="lock-closed" size={12} color={T.secureText} />
          <Text style={[styles.secureText, { color: T.secureText }]}>
            {'  '}Payments secured by {method === 'moncash' ? 'Digicel MonCash' : 'Stripe'}. Cancel anytime.
          </Text>
        </View>
      </ScrollView>

      {/* ── Bottom CTA ── */}
      <View
        style={[
          styles.bottomBar,
          { backgroundColor: T.bottomBg, borderTopColor: T.bottomBorder, paddingBottom: insets.bottom + 16 },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.payBtn,
            { backgroundColor: payBtnColor },
            (loading || payBtnDisabled) && styles.payBtnDisabled,
          ]}
          onPress={handlePay}
          disabled={loading || payBtnDisabled}
          activeOpacity={0.85}
        >
          {loading ? (
            <>
              <ActivityIndicator color="#FFF" size="small" />
              <Text style={styles.payBtnText}>Processing…</Text>
            </>
          ) : (
            <>
              {method === 'apple' && <Ionicons name="logo-apple" size={20} color="#FFF" />}
              {method === 'google' && <Ionicons name="logo-google" size={18} color="#FFF" />}
              {method === 'card' && <Ionicons name="card-outline" size={20} color="#FFF" />}
              {method === 'moncash' && (
                <View style={styles.moncashIconSmall}>
                  <Text style={styles.moncashIconSmallText}>M</Text>
                </View>
              )}
              <Text style={styles.payBtnText}>{payLabel()}</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()}>
          <Text style={[styles.cancelText, { color: T.textSec }]}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─────────────────────────────────────────────────────────
// Root export — wrap with StripeProvider on native
// ─────────────────────────────────────────────────────────
export default function CheckoutScreen() {
  const T = useT();

  if (Platform.OS === 'web' || !StripeProvider) {
    return (
      <View style={[styles.webFallback, { backgroundColor: T.bg }]}>
        <Ionicons name="card-outline" size={52} color={T.textMuted} />
        <Text style={[styles.webFallbackTitle, { color: T.text }]}>
          In-app payments unavailable
        </Text>
        <Text style={[styles.webFallbackSub, { color: T.textSec }]}>
          Please use the "Buy on Web" option on the subscription screen to complete your purchase.
        </Text>
      </View>
    );
  }

  return (
    <StripeProvider
      publishableKey={STRIPE_PK}
      merchantIdentifier="merchant.com.dawinix.ht"
      urlScheme="dawinixht"
    >
      <CheckoutInner />
    </StripeProvider>
  );
}

// ─────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 20,
    gap: 14,
  },

  // Plan card
  planCard: {
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 20,
    alignItems: 'center',
    gap: 6,
  },
  planBadge: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 5,
    marginBottom: 4,
  },
  planBadgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  planName: {
    fontSize: 22,
    fontWeight: '700',
  },
  planPrice: {
    fontSize: 34,
    fontWeight: '800',
  },
  planPricePer: {
    fontSize: 16,
    fontWeight: '500',
  },
  benefitsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'center',
    marginTop: 6,
  },
  benefitChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  benefitChipText: {
    fontSize: 12,
  },

  // Section card
  section: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 4,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: 4,
    marginBottom: 8,
  },

  // Field rows
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    position: 'relative',
  },
  fieldIcon: {
    marginRight: 12,
  },
  fieldContent: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
  },
  fieldInput: {
    fontSize: 16,
    fontWeight: '400',
    padding: 0,
    margin: 0,
  },
  focusIndicator: {
    position: 'absolute',
    right: 0,
    top: 8,
    bottom: 8,
    width: 3,
    borderRadius: 2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 46,
  },

  // Card field
  cardFieldWrap: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    paddingTop: 8,
  },
  cardField: {
    width: '100%',
    height: 52,
  },
  cardFieldFallback: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 16,
    opacity: 0.7,
  },
  cardFieldFallbackText: {
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  cardBrands: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  cardBrandChip: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  cardBrandText: {
    fontSize: 11,
    fontWeight: '600',
  },

  // Payment method tabs
  tabs: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 50,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Payment method info block
  payMethodInfo: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
    gap: 10,
  },
  payMethodIconBig: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  payMethodInfoTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  payMethodInfoSub: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  moncashBigIcon: {
    color: '#FFF',
    fontSize: 36,
    fontWeight: '900',
  },
  moncashNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 4,
  },
  moncashNoteText: {
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
  },

  // Secure
  secureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  secureText: {
    fontSize: 12,
    lineHeight: 18,
  },

  // Bottom bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
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
  payBtnDisabled: {
    opacity: 0.5,
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '500',
  },
  moncashIconSmall: {
    width: 22,
    height: 22,
    borderRadius: 5,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moncashIconSmallText: {
    color: '#DC143C',
    fontSize: 13,
    fontWeight: '900',
  },

  // Web fallback
  webFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  webFallbackTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  webFallbackSub: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
});
hello ai please please add a coupon/promo code input field to the checkout page. When the user enters a code and taps Apply, call the Stripe edge function to validate and apply a discount, then update the displayed price accordingly and in number allow listcountryn world number select code country and input number with format (305)896-2443 by code country number and redesign checkout page and all in blur add moncash for haiti-usa only.
