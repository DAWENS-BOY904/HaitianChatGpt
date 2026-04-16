
import React, { useState, useEffect } from 'react';
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
  Image,
  ImageBackground,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useSubscription } from '../hooks/useSubscription';
import { useRouter } from 'expo-router';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAlert, useAuth, getSupabaseClient } from '@/template';

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
  go: Platform.select({ ios: 'com.dawinix.go.monthly', android: 'com.dawinix.go.monthly' }) || 'com.dawinix.go.monthly',
  plus: Platform.select({ ios: 'com.dawinix.plus.monthly', android: 'com.dawinix.plus.monthly' }) || 'com.dawinix.plus.monthly',
};

// RevenueCat API key per platform — set via Expo env vars
const RC_API_KEY = Platform.select({
  ios: process.env.EXPO_PUBLIC_RC_IOS_KEY || '',
  android: process.env.EXPO_PUBLIC_RC_ANDROID_KEY || '',
  default: '',
});

// ── IMAJ POU PLANN YO ──
// Mete URL imaj ou isit la, oswa itilize require() pou lokal imaj
const GO_PALM_IMAGE = 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&h=300&fit=crop'; // Plaj ak palmis
const PLUS_PALM_IMAGE = 'https://images.unsplash.com/photo-1546484396-fb3fc6f95f98?w=400&h=300&fit=crop'; // Palmis pi bèl/luks
const MAP_BACKGROUND = 'https://images.unsplash.com/photo-1524661135-423995f22d0b?w=600&h=800&fit=crop'; // Imaj kat/satelit

export default function SubscriptionScreen() {
  const { colors, isDark } = useTheme();
  const { tier, restorePurchases } = useSubscription();
  const { showAlert } = useAlert();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const supabase = getSupabaseClient();

  const [selectedPlan, setSelectedPlan] = useState<'go' | 'plus'>('go');
  const [isLoading, setIsLoading] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const features = selectedPlan === 'go' ? GO_FEATURES : PLUS_FEATURES;
  const planColor = '#6B5CE7';
  const planPrice = selectedPlan === 'go' ? '$8.00' : '$19.99';
  const planLabel = selectedPlan === 'go' ? 'Get Dawinix Go' : 'Get Dawinix Plus';
  const planSubtitle = selectedPlan === 'go'
    ? 'Keep chatting with expanded access'
    : 'Do more with advanced intelligence';

  // Chwazi imaj ki koresponn ak plan an
  const currentPalmImage = selectedPlan === 'go' ? GO_PALM_IMAGE : PLUS_PALM_IMAGE;

  // ── Attempt real IAP via RevenueCat for Go plan ──
  const purchaseWithRevenueCat = async (productId: string, planName: string, priceStr: string) => {
    try {
      // Dynamically import RevenueCat (react-native-purchases)
      const Purchases = require('react-native-purchases').default;

      // CRITICAL FIX: Always configure before ANY call — singleton guard
      const apiKey = RC_API_KEY ||
        (Platform.OS === 'ios'
          ? (process.env.EXPO_PUBLIC_RC_IOS_KEY || '')
          : (process.env.EXPO_PUBLIC_RC_ANDROID_KEY || ''));

      if (!apiKey) {
        // RC not configured — fall back to Stripe checkout
        router.push({ pathname: '/checkout', params: { plan: planName } });
        return;
      }

      // Safe configure — RevenueCat ignores duplicate configure calls
      try {
        Purchases.configure({ apiKey });
      } catch (_configErr) {
        // Already configured — fine to continue
      }

      // Fetch available offerings
      const offerings = await Purchases.getOfferings();
      const offering = offerings.current;

      if (!offering) {
        throw new Error('No offerings available. Please try again later.');
      }

      // Find matching package
      const pkg = offering.availablePackages.find(
        (p: any) =>
          p.product.productIdentifier === productId ||
          p.product.identifier === productId
      );

      if (!pkg) {
        throw new Error(`Product ${productId} not found. Check App Store/Play Console configuration.`);
      }

      // Make the purchase
      const { customerInfo, productIdentifier } = await Purchases.purchasePackage(pkg);

      // Get the latest receipt / transaction
      const receipt: string = (customerInfo as any).latestExpirationDate
        ? JSON.stringify(customerInfo)
        : '';

      const transactionId: string = (customerInfo as any).originalAppUserId || Date.now().toString();

      // Verify with our backend
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) throw new Error('User not authenticated');

      const { data, error } = await supabase.functions.invoke('verify-purchase', {
        body: {
          platform: Platform.OS === 'ios' ? 'ios' : 'android',
          receipt,
          transactionId,
          productId: productIdentifier,
          isSandbox: __DEV__,
        },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || 'Purchase verification failed');
      }

      // Update subscription_tier in user_profiles
      if (user?.id) {
        await supabase.from('user_profiles').update({
          subscription_tier: planName === 'go' ? 'go' : 'plus',
          subscription_expires_at: data.subscription?.expiresAt || null,
        }).eq('id', user.id);
      }

      // Send confirmation email
      const renewalDate = data.subscription?.expiresAt
        ? new Date(data.subscription.expiresAt).toLocaleDateString()
        : 'next month';

      await supabase.functions.invoke('send-admin-email', {
        body: {
          recipientIds: user?.id ? [user.id] : [],
          subject: `Welcome to Dawinix ${planName === 'go' ? 'Go' : 'Plus'}!`,
          message: `Your subscription has been activated.\n\nPlan: Dawinix ${planName === 'go' ? 'Go' : 'Plus'}\nPrice: ${priceStr}/month\nNext renewal: ${renewalDate}\n\nThank you for subscribing!`,
        },
      }).catch(console.error); // Non-blocking

      showAlert('Subscription Activated!', `Welcome to Dawinix ${planName === 'go' ? 'Go' : 'Plus'}! Your subscription is now active.`);
      router.back();
    } catch (err: any) {
      // RevenueCat cancelled by user
      if (err?.code === '1' || err?.message?.includes('cancel') || err?.userCancelled) {
        return; // Silent cancel
      }
      // RevenueCat module not available (web/simulator) → fall back to Stripe checkout
      if (err?.message?.includes('Cannot find module') || err?.message?.includes('NativeModule')) {
        router.push({ pathname: '/checkout', params: { plan: planName } });
        return;
      }
      throw err;
    }
  };

  const handleUpgrade = async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      if (selectedPlan === 'go') {
        // Go plan: use real IAP (RevenueCat)
        await purchaseWithRevenueCat(PRODUCT_IDS.go, 'go', '$8.00');
      } else {
        // Plus plan: Stripe checkout (web)
        router.push({ pathname: '/checkout', params: { plan: 'plus' } });
      }
    } catch (error: any) {
      showAlert('Purchase Failed', error?.message || 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async () => {
    setIsRestoring(true);
    try {
      // Try RevenueCat restore first
      try {
        const Purchases = require('react-native-purchases').default;
        const apiKey = RC_API_KEY ||
          (Platform.OS === 'ios'
            ? (process.env.EXPO_PUBLIC_RC_IOS_KEY || '')
            : (process.env.EXPO_PUBLIC_RC_ANDROID_KEY || ''));
        if (apiKey) {
          try { Purchases.configure({ apiKey }); } catch (_e) {}
          const customerInfo = await Purchases.restorePurchases();
          const hasActive = Object.keys(customerInfo.entitlements.active).length > 0;
          if (hasActive && user?.id) {
            await supabase.from('user_profiles').update({ subscription_tier: 'go' }).eq('id', user.id);
            showAlert('Restored', 'Your subscription has been restored.');
            return;
          }
        }
      } catch (e) {
        // Fall through to context restore
      }
      await restorePurchases();
      showAlert('Restored', 'Your purchases have been restored.');
    } catch (error) {
      showAlert('Error', 'Failed to restore purchases. Please contact support.');
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <ImageBackground 
      source={{ uri: MAP_BACKGROUND }} 
      style={styles.container}
      imageStyle={styles.mapBackground}
    >
      {/* Overlay pou fè tèks li pi lisib sou kat la */}
      <View style={styles.overlay} />

      {/* Close button */}
      <TouchableOpacity
        style={[styles.closeBtn, { top: insets.top + 12 }]}
        onPress={() => router.back()}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="close" size={22} color="#FFF" />
      </TouchableOpacity>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 56, paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Palm Tree Image - Ranplase ikon an */}
        <View style={styles.imageContainer}>
          <Image 
            source={{ uri: currentPalmImage }} 
            style={styles.palmImage}
            resizeMode="cover"
          />
          {/* Badge sou imaj la */}
          <View style={[styles.planBadge, { backgroundColor: planColor }]}>
            <Text style={styles.planBadgeText}>
              {selectedPlan === 'go' ? 'GO' : 'PLUS'}
            </Text>
          </View>
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
            <Text style={[styles.toggleText, selectedPlan === 'go' && styles.toggleTextActive]}>Go</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, selectedPlan === 'plus' && styles.toggleBtnActive]}
            onPress={() => setSelectedPlan('plus')}
          >
            <Text style={[styles.toggleText, selectedPlan === 'plus' && styles.toggleTextActive]}>Plus</Text>
          </TouchableOpacity>
        </View>

        {/* Feature Comparison Table */}
        <View style={styles.featureCard}>
          <View style={styles.featureRow}>
            <Text style={styles.featureHeaderLabel}>Features</Text>
            <Text style={styles.featureHeaderFree}>Free</Text>
            <Text style={[styles.featureHeaderPlan, { color: planColor }]}>
              {selectedPlan === 'go' ? 'Go' : 'Plus'}
            </Text>
          </View>
          {features.map((f, i) => (
            <View key={f.label} style={[styles.featureRow, i < features.length - 1 && styles.featureRowBorder]}>
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

        {/* Restore Purchases */}
        <TouchableOpacity onPress={handleRestore} style={styles.restoreBtn} disabled={isRestoring}>
          {isRestoring ? (
            <ActivityIndicator color="rgba(255,255,255,0.8)" size="small" />
          ) : (
            <Text style={styles.restoreText}>Restore Purchases</Text>
          )}
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
            <Text style={styles.upgradeBtnText}>Upgrade for {planPrice}/month</Text>
          )}
        </TouchableOpacity>

        {selectedPlan === 'plus' && (
          <TouchableOpacity onPress={() => Linking.openURL('https://dawinix.com/subscription')} style={{ marginTop: 12 }}>
            <Text style={styles.webLink}>Purchase on web ↗</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.legalText}>
          Auto-renews monthly. Cancel anytime in Settings.{'\n'}
          {selectedPlan === 'go' ? 'This plan may include ads. ' : ''}
          <Text style={[styles.legalText, { textDecorationLine: 'underline' }]}>Learn more</Text>
        </Text>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1,
  },
  mapBackground: {
    opacity: 0.3, // Fè kat la semi-transparent
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)', // Sèv kòm overlay pou tèks la
  },
  closeBtn: {
    position: 'absolute',
    right: 20,
    zIndex: 10,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 16,
  },
  scrollContent: { 
    alignItems: 'center', 
    paddingHorizontal: 24,
    zIndex: 1,
  },
  // Nouvo style pou imaj palmis yo
  imageContainer: {
    width: 200,
    height: 140,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 20,
    position: 'relative',
    borderWidth: 3,
    borderColor: '#6B5CE7',
    shadowColor: '#6B5CE7',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
  },
  palmImage: {
    width: '100%',
    height: '100%',
  },
  planBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  planBadgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  title: { 
    fontSize: 28, 
    fontWeight: '700', 
    color: '#FFF', 
    textAlign: 'center', 
    marginBottom: 10, 
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: { 
    fontSize: 16, 
    color: 'rgba(255,255,255,0.8)', 
    textAlign: 'center', 
    marginBottom: 28,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  toggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(28,28,30,0.9)',
    borderRadius: 30,
    padding: 4,
    marginBottom: 28,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  toggleBtn: { flex: 1, paddingVertical: 12, borderRadius: 26, alignItems: 'center' },
  toggleBtnActive: { backgroundColor: '#2C2C2E' },
  toggleText: { fontSize: 16, fontWeight: '500', color: 'rgba(255,255,255,0.4)' },
  toggleTextActive: { color: '#FFF', fontWeight: '700' },
  featureCard: {
    width: '100%',
    backgroundColor: 'rgba(17,17,17,0.95)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
    marginBottom: 20,
  },
  featureRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 15 },
  featureRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.1)' },
  featureHeaderLabel: { flex: 1, fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.4)' },
  featureHeaderFree: { width: 52, textAlign: 'center', fontSize: 13, fontWeight: '600', color: '#FFF' },
  featureHeaderPlan: { width: 52, textAlign: 'center', fontSize: 13, fontWeight: '700' },
  featureLabel: { flex: 1, fontSize: 15, color: '#FFF', fontWeight: '400' },
  featureCheck: { width: 52, alignItems: 'center' },
  featureDash: { fontSize: 18, color: 'rgba(255,255,255,0.3)', lineHeight: 22 },
  restoreBtn: { marginTop: 8, padding: 12 },
  restoreText: { fontSize: 14, color: 'rgba(255,255,255,0.8)', textDecorationLine: 'underline' },
  bottomCTA: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingTop: 16,
    backgroundColor: 'rgba(0,0,0,0.9)',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  upgradeBtn: {
    width: '100%',
    backgroundColor: '#FFF',
    borderRadius: 50,
    paddingVertical: 17,
    alignItems: 'center',
  },
  upgradeBtnDisabled: { opacity: 0.6 },
  upgradeBtnText: { fontSize: 17, fontWeight: '700', color: '#000' },
  webLink: { fontSize: 14, fontWeight: '600', color: '#FFF', textDecorationLine: 'underline', marginBottom: 10 },
  legalText: { fontSize: 12, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginTop: 8, lineHeight: 17 },
});
