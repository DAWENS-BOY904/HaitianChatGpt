import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Linking,
  Clipboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../hooks/useTheme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAlert } from '@/template';

// ─────────────────────────────────────────────────────────────
// CODE BLOCK
// ─────────────────────────────────────────────────────────────
function CodeBlock({ code, language = 'ts' }: { code: string; language?: string }) {
  const { isDark } = useTheme();
  const { showAlert } = useAlert();

  const copy = () => {
    Clipboard.setString(code);
    showAlert('Copied', 'Code copied to clipboard');
  };

  return (
    <View style={[codeStyles.wrapper, { backgroundColor: isDark ? '#0d0d0d' : '#1e1e1e' }]}>
      <View style={codeStyles.header}>
        <Text style={codeStyles.lang}>{language}</Text>
        <TouchableOpacity onPress={copy} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="copy-outline" size={16} color="#888" />
        </TouchableOpacity>
      </View>
      <Text style={codeStyles.code} selectable>
        {code}
      </Text>
    </View>
  );
}

const codeStyles = StyleSheet.create({
  wrapper: { borderRadius: 10, overflow: 'hidden', marginVertical: 8 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#111' },
  lang: { color: '#888', fontSize: 12, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  code: { color: '#d4d4d4', fontSize: 12, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', padding: 14, lineHeight: 20 },
});

// ─────────────────────────────────────────────────────────────
// STEP CARD
// ─────────────────────────────────────────────────────────────
function StepCard({ step, title, children, done = false }: { step: number; title: string; children: React.ReactNode; done?: boolean }) {
  const [expanded, setExpanded] = useState(step === 1);
  const { colors, isDark } = useTheme();

  return (
    <View style={[stepStyles.card, { backgroundColor: isDark ? '#1C1C1E' : '#F9F9F9', borderColor: isDark ? '#3A3A3C' : '#E0E0E5' }]}>
      <TouchableOpacity style={stepStyles.header} onPress={() => setExpanded(e => !e)} activeOpacity={0.7}>
        <View style={[stepStyles.badge, { backgroundColor: done ? '#34C759' : colors.primary }]}>
          {done ? (
            <Ionicons name="checkmark" size={14} color="#FFF" />
          ) : (
            <Text style={stepStyles.badgeText}>{step}</Text>
          )}
        </View>
        <Text style={[stepStyles.title, { color: colors.text }]}>{title}</Text>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textSecondary} />
      </TouchableOpacity>
      {expanded && <View style={stepStyles.body}>{children}</View>}
    </View>
  );
}

const stepStyles = StyleSheet.create({
  card: { borderRadius: 12, marginBottom: 12, borderWidth: 1, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  badge: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  title: { flex: 1, fontSize: 15, fontWeight: '600' },
  body: { paddingHorizontal: 16, paddingBottom: 16 },
});

// ─────────────────────────────────────────────────────────────
// INFO ROW
// ─────────────────────────────────────────────────────────────
function InfoRow({ icon, label, value, url }: { icon: string; label: string; value: string; url?: string }) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      style={[infoStyles.row, { borderColor: colors.border }]}
      onPress={url ? () => Linking.openURL(url) : undefined}
      activeOpacity={url ? 0.7 : 1}
    >
      <Ionicons name={icon as any} size={18} color={colors.textSecondary} style={{ width: 24 }} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{label}</Text>
        <Text style={{ color: url ? '#007AFF' : colors.text, fontSize: 14, marginTop: 2 }}>{value}</Text>
      </View>
      {url && <Ionicons name="open-outline" size={16} color="#007AFF" />}
    </TouchableOpacity>
  );
}

const infoStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
});

// ─────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────
export default function RevenueCatSetupScreen() {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const primaryText = isDark ? '#FFF' : '#000';
  const secondaryText = isDark ? '#8E8E93' : '#6C6C70';
  const cardBg = isDark ? '#1C1C1E' : '#F2F2F7';
  const bg = isDark ? '#000' : '#F2F2F7';

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      {/* Header */}
      <View style={[hdrStyles.header, {
        backgroundColor: isDark ? '#1C1C1E' : '#FFF',
        paddingTop: insets.top + 8,
        borderBottomColor: isDark ? '#3A3A3C' : '#E0E0E5',
      }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={24} color={primaryText} />
        </TouchableOpacity>
        <Text style={[hdrStyles.title, { color: primaryText }]}>RevenueCat Setup</Text>
        <TouchableOpacity onPress={() => Linking.openURL('https://docs.revenuecat.com')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="help-circle-outline" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }} showsVerticalScrollIndicator={false}>

        {/* Intro Banner */}
        <View style={[bannerStyles.banner, { backgroundColor: isDark ? '#1C2B1C' : '#E8F5E9' }]}>
          <Ionicons name="checkmark-circle" size={20} color="#34C759" />
          <Text style={[bannerStyles.text, { color: isDark ? '#A5D6A7' : '#1B5E20' }]}>
            Follow these steps to enable real in-app purchases for the Go plan. All steps are required before going live.
          </Text>
        </View>

        {/* Product IDs */}
        <View style={[productStyles.box, { backgroundColor: cardBg, borderColor: isDark ? '#3A3A3C' : '#E0E0E5' }]}>
          <Text style={[productStyles.label, { color: secondaryText }]}>Product IDs to register</Text>
          {[
            { id: 'com.dawinix.go.monthly', label: 'Go Plan · Monthly', price: '$9.99/mo' },
            { id: 'com.dawinix.go.yearly', label: 'Go Plan · Yearly', price: '$79.99/yr' },
          ].map(p => (
            <View key={p.id} style={[productStyles.row, { borderColor: isDark ? '#3A3A3C' : '#E5E5E5' }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: primaryText, fontWeight: '600', fontSize: 14 }}>{p.label}</Text>
                <Text style={{ color: '#007AFF', fontSize: 12, marginTop: 2, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>{p.id}</Text>
              </View>
              <Text style={{ color: secondaryText, fontSize: 13 }}>{p.price}</Text>
            </View>
          ))}
        </View>

        {/* STEP 1 */}
        <StepCard step={1} title="Create RevenueCat Account & Project">
          <Text style={{ color: secondaryText, fontSize: 14, marginBottom: 10, lineHeight: 20 }}>
            Sign up at RevenueCat and create a new project named "HaitianChatGpt".
          </Text>
          <InfoRow icon="globe-outline" label="Dashboard" value="app.revenuecat.com" url="https://app.revenuecat.com" />
          <InfoRow icon="document-text-outline" label="Quick Start" value="docs.revenuecat.com/docs/getting-started" url="https://docs.revenuecat.com/docs/getting-started" />
        </StepCard>

        {/* STEP 2 */}
        <StepCard step={2} title="Get Your API Keys">
          <Text style={{ color: secondaryText, fontSize: 14, marginBottom: 10, lineHeight: 20 }}>
            In the RevenueCat dashboard go to{' '}
            <Text style={{ color: primaryText, fontWeight: '600' }}>Project Settings → API Keys</Text>.
            Copy your iOS and Android public keys.
          </Text>
          <View style={[noticeStyles.notice, { backgroundColor: isDark ? '#2C2400' : '#FFF8E1', borderColor: '#F9A825' }]}>
            <Ionicons name="warning-outline" size={16} color="#F9A825" />
            <Text style={{ color: isDark ? '#FFD54F' : '#795548', fontSize: 13, flex: 1 }}>
              Use <Text style={{ fontWeight: '700' }}>Public SDK keys</Text> — never secret keys — in client code.
            </Text>
          </View>
          <Text style={{ color: secondaryText, fontSize: 13, marginTop: 8, marginBottom: 4 }}>Add to OnSpace Secrets panel:</Text>
          <CodeBlock language="env" code={`REVENUECAT_IOS_KEY=appl_xxxxxxxxxxxxxxxxxxxxxxxxxx
REVENUECAT_ANDROID_KEY=goog_xxxxxxxxxxxxxxxxxxxxxxxxxx`} />
          <Text style={{ color: secondaryText, fontSize: 13, marginTop: 8 }}>
            Then in your app code (e.g. services/subscription.ts):
          </Text>
          <CodeBlock language="typescript" code={`import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import { Platform } from 'react-native';

export function initRevenueCat() {
  const apiKey = Platform.OS === 'ios'
    ? process.env.EXPO_PUBLIC_RC_IOS_KEY!
    : process.env.EXPO_PUBLIC_RC_ANDROID_KEY!;

  Purchases.setLogLevel(LOG_LEVEL.DEBUG); // remove in prod
  Purchases.configure({ apiKey });
}`} />
        </StepCard>

        {/* STEP 3 */}
        <StepCard step={3} title="Register Products in App Store Connect">
          <Text style={{ color: secondaryText, fontSize: 14, marginBottom: 10, lineHeight: 20 }}>
            In App Store Connect, go to your app → <Text style={{ fontWeight: '600', color: primaryText }}>Subscriptions</Text> → create a Subscription Group called "Go Plan".
          </Text>
          {[
            { label: '1. Create Subscription Group', value: 'Name: "Go Plan"' },
            { label: '2. Add Monthly Product', value: 'ID: com.dawinix.go.monthly · $9.99' },
            { label: '3. Add Yearly Product', value: 'ID: com.dawinix.go.yearly · $79.99' },
            { label: '4. Set Duration', value: 'Monthly = 1 Month · Yearly = 1 Year' },
            { label: '5. Add Localization', value: 'English (US) display name + description' },
          ].map((item, i) => (
            <View key={i} style={[listStyles.item, { borderColor: isDark ? '#3A3A3C' : '#E5E5E5' }]}>
              <View style={[listStyles.dot, { backgroundColor: colors.primary }]} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: primaryText, fontSize: 14, fontWeight: '600' }}>{item.label}</Text>
                <Text style={{ color: secondaryText, fontSize: 13, marginTop: 2 }}>{item.value}</Text>
              </View>
            </View>
          ))}
          <InfoRow icon="globe-outline" label="App Store Connect" value="appstoreconnect.apple.com" url="https://appstoreconnect.apple.com" />
        </StepCard>

        {/* STEP 4 */}
        <StepCard step={4} title="Register Products in Google Play Console">
          <Text style={{ color: secondaryText, fontSize: 14, marginBottom: 10, lineHeight: 20 }}>
            In Google Play Console go to{' '}
            <Text style={{ fontWeight: '600', color: primaryText }}>Monetize → Subscriptions</Text>.
          </Text>
          {[
            { label: '1. Create Subscription', value: 'ID: com.dawinix.go.monthly' },
            { label: '2. Add Base Plan', value: 'Monthly autorenewing · $9.99' },
            { label: '3. Add Offer (optional)', value: 'Free trial 7 days' },
            { label: '4. Repeat for yearly', value: 'ID: com.dawinix.go.yearly · $79.99' },
          ].map((item, i) => (
            <View key={i} style={[listStyles.item, { borderColor: isDark ? '#3A3A3C' : '#E5E5E5' }]}>
              <View style={[listStyles.dot, { backgroundColor: '#34A853' }]} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: primaryText, fontSize: 14, fontWeight: '600' }}>{item.label}</Text>
                <Text style={{ color: secondaryText, fontSize: 13, marginTop: 2 }}>{item.value}</Text>
              </View>
            </View>
          ))}
          <InfoRow icon="globe-outline" label="Google Play Console" value="play.google.com/console" url="https://play.google.com/console" />
        </StepCard>

        {/* STEP 5 */}
        <StepCard step={5} title="Add Products to RevenueCat">
          <Text style={{ color: secondaryText, fontSize: 14, marginBottom: 10, lineHeight: 20 }}>
            In RevenueCat dashboard: <Text style={{ fontWeight: '600', color: primaryText }}>Products → + New → Import from stores</Text>.
          </Text>
          <CodeBlock language="text" code={`Products to add:
  iOS:     com.dawinix.go.monthly
           com.dawinix.go.yearly
  Android: com.dawinix.go.monthly:monthly-base
           com.dawinix.go.yearly:yearly-base

Entitlements:
  Name: "pro"
  Attach: all 4 products above`} />
        </StepCard>

        {/* STEP 6 */}
        <StepCard step={6} title="Purchase Flow Code">
          <Text style={{ color: secondaryText, fontSize: 14, marginBottom: 10, lineHeight: 20 }}>
            This is the full purchase + verify flow used in <Text style={{ fontWeight: '600', color: primaryText }}>app/subscription.tsx</Text>.
          </Text>
          <CodeBlock language="typescript" code={`import Purchases from 'react-native-purchases';
import { getSupabaseClient } from '@/template';

export async function purchaseGoPlan(
  packageId: string,  // 'com.dawinix.go.monthly'
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Get packages from RevenueCat
    const offerings = await Purchases.getOfferings();
    const pkg = offerings.current?.availablePackages
      .find(p => p.product.identifier === packageId);
    if (!pkg) throw new Error('Package not found');

    // 2. Purchase
    const { customerInfo } = await Purchases.purchasePackage(pkg);

    // 3. Verify with backend
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.functions.invoke('verify-purchase', {
      body: {
        userId,
        platform: Platform.OS,
        productId: packageId,
        customerInfo: JSON.stringify(customerInfo),
      },
    });
    if (error) throw new Error(error.message);

    return { success: true };
  } catch (e: any) {
    if (e?.userCancelled) return { success: false };
    return { success: false, error: e.message };
  }
}`} />
        </StepCard>

        {/* STEP 7 */}
        <StepCard step={7} title="Test with Sandbox Accounts">
          <Text style={{ color: secondaryText, fontSize: 14, marginBottom: 8, lineHeight: 20 }}>
            <Text style={{ fontWeight: '600', color: primaryText }}>iOS:</Text> Create a Sandbox Tester in App Store Connect → Users & Access → Sandbox Testers. Sign out of your Apple ID on device, sign in with sandbox account.
          </Text>
          <Text style={{ color: secondaryText, fontSize: 14, marginBottom: 8, lineHeight: 20 }}>
            <Text style={{ fontWeight: '600', color: primaryText }}>Android:</Text> Add your Google account as a License Tester in Play Console → Setup → License Testing.
          </Text>
          <View style={[noticeStyles.notice, { backgroundColor: isDark ? '#0D1F30' : '#E3F2FD', borderColor: '#1976D2' }]}>
            <Ionicons name="information-circle-outline" size={16} color="#1976D2" />
            <Text style={{ color: isDark ? '#90CAF9' : '#0D47A1', fontSize: 13, flex: 1 }}>
              Use RevenueCat's Customer Lookup to verify purchases in real-time during testing.
            </Text>
          </View>
          <InfoRow icon="bug-outline" label="RevenueCat Customer Lookup" value="app.revenuecat.com/customers" url="https://app.revenuecat.com/customers" />
        </StepCard>

        {/* Final note */}
        <View style={[bannerStyles.banner, { backgroundColor: isDark ? '#1C1C2E' : '#EDE7F6', marginTop: 8 }]}>
          <Ionicons name="rocket-outline" size={20} color="#7C4DFF" />
          <Text style={[bannerStyles.text, { color: isDark ? '#CE93D8' : '#4A148C' }]}>
            Once all steps are done, go live purchases will work. Never ship with LOG_LEVEL.DEBUG in production.
          </Text>
        </View>

      </ScrollView>
    </View>
  );
}

const hdrStyles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { flex: 1, fontSize: 17, fontWeight: '600', textAlign: 'center' },
});

const bannerStyles = StyleSheet.create({
  banner: { flexDirection: 'row', gap: 10, borderRadius: 12, padding: 14, marginBottom: 16, alignItems: 'flex-start' },
  text: { flex: 1, fontSize: 13, lineHeight: 19 },
});

const noticeStyles = StyleSheet.create({
  notice: { flexDirection: 'row', gap: 8, borderRadius: 8, padding: 10, borderWidth: 1, marginVertical: 8, alignItems: 'flex-start' },
});

const productStyles = StyleSheet.create({
  box: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
});

const listStyles = StyleSheet.create({
  item: { flexDirection: 'row', gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, alignItems: 'flex-start' },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
});
