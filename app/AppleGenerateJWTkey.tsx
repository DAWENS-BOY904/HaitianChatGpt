import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Clipboard,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';

// ── Generates a proper Apple Client Secret (JWT) for Supabase Sign In with Apple ──
// Reference: https://developer.apple.com/documentation/accountorganizationaldatasharing/creating-a-client-secret

async function base64urlEncode(arrayBuffer: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const b64 = btoa(binary);
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function generateAppleClientSecret(params: {
  teamId: string;
  keyId: string;
  clientId: string;
  privateKey: string;
}): Promise<string> {
  const { teamId, keyId, clientId, privateKey } = params;

  const now = Math.floor(Date.now() / 1000);
  const exp = now + 15777000; // ~6 months

  // JWT Header
  const header = { alg: 'ES256', kid: keyId };
  const payload = {
    iss: teamId,
    iat: now,
    exp,
    aud: 'https://appleid.apple.com',
    sub: clientId,
  };

  const encHeader = await base64urlEncode(
    new TextEncoder().encode(JSON.stringify(header))
  );
  const encPayload = await base64urlEncode(
    new TextEncoder().encode(JSON.stringify(payload))
  );
  const signingInput = `${encHeader}.${encPayload}`;

  // Clean up PEM key
  const pemClean = privateKey
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/-----BEGIN EC PRIVATE KEY-----/g, '')
    .replace(/-----END EC PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '');

  // Import the EC P-256 private key
  const keyBuffer = Uint8Array.from(atob(pemClean), c => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyBuffer,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  // Sign
  const sigBuffer = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    cryptoKey,
    new TextEncoder().encode(signingInput)
  );

  const encSig = await base64urlEncode(sigBuffer);
  return `${signingInput}.${encSig}`;
}

export default function AppleGenerateJWTKeyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();

  const [teamId, setTeamId] = useState('');
  const [keyId, setKeyId] = useState('');
  const [clientId, setClientId] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [result, setResult] = useState('');
  const [expiry, setExpiry] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const bg = isDark ? '#000000' : '#F2F2F7';
  const cardBg = isDark ? '#1C1C1E' : '#FFFFFF';
  const primaryText = isDark ? '#FFFFFF' : '#000000';
  const secondaryText = '#8E8E93';
  const divider = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const inputBg = isDark ? '#2C2C2E' : '#F2F2F7';

  const handleGenerate = async () => {
    setError('');
    if (!teamId.trim() || !keyId.trim() || !clientId.trim() || !privateKey.trim()) {
      setError('All fields are required.');
      return;
    }
    if (teamId.length !== 10) {
      setError('Team ID must be exactly 10 characters.');
      return;
    }
    if (keyId.length !== 10) {
      setError('Key ID must be exactly 10 characters.');
      return;
    }
    if (!privateKey.includes('PRIVATE KEY')) {
      setError('Private key must be a valid PEM key (include BEGIN/END lines).');
      return;
    }

    setLoading(true);
    setResult('');
    try {
      const jwt = await generateAppleClientSecret({ teamId, keyId, clientId, privateKey });
      const expiryDate = new Date(Date.now() + 15777000 * 1000).toLocaleDateString();
      setResult(jwt);
      setExpiry(expiryDate);
    } catch (e: any) {
      setError(`Generation failed: ${e?.message || 'Invalid key format. Make sure you paste the full .p8 file content.'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    Clipboard.setString(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingTop: insets.top + 12,
      paddingBottom: 12,
      paddingHorizontal: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: divider,
    },
    backBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: isDark ? '#2C2C2E' : 'rgba(0,0,0,0.08)',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
    },
    headerTitle: { fontSize: 17, fontWeight: '600', color: primaryText, flex: 1 },
    content: { paddingHorizontal: 16, paddingTop: 20 },
    infoCard: {
      backgroundColor: isDark ? '#0A2540' : '#EBF5FF',
      borderRadius: 14,
      padding: 14,
      marginBottom: 20,
      flexDirection: 'row',
      gap: 10,
    },
    infoTitle: { fontSize: 14, fontWeight: '600', color: isDark ? '#4DA6FF' : '#0066CC', marginBottom: 4 },
    infoText: { fontSize: 13, color: isDark ? '#99CCFF' : '#004999', lineHeight: 19 },
    sectionLabel: {
      fontSize: 13,
      color: secondaryText,
      fontWeight: '500',
      marginBottom: 8,
      marginLeft: 4,
    },
    card: {
      backgroundColor: cardBg,
      borderRadius: 14,
      padding: 16,
      marginBottom: 20,
      gap: 14,
    },
    fieldLabel: { fontSize: 13, color: secondaryText, marginBottom: 6, fontWeight: '500' },
    input: {
      backgroundColor: inputBg,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      color: primaryText,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    textArea: {
      backgroundColor: inputBg,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 13,
      color: primaryText,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      minHeight: 130,
      textAlignVertical: 'top',
    },
    hint: { fontSize: 11, color: secondaryText, marginTop: 4, lineHeight: 16 },
    generateBtn: {
      backgroundColor: '#000000',
      borderRadius: 50,
      paddingVertical: 15,
      alignItems: 'center',
      marginBottom: 24,
    },
    generateBtnText: { fontSize: 17, fontWeight: '700', color: '#FFFFFF' },
    errorBox: {
      backgroundColor: isDark ? '#3A1215' : '#FFF0F0',
      borderRadius: 10,
      padding: 12,
      marginBottom: 16,
      flexDirection: 'row',
      gap: 8,
      alignItems: 'flex-start',
    },
    errorText: { color: '#FF453A', fontSize: 14, flex: 1, lineHeight: 20 },
    resultCard: {
      backgroundColor: isDark ? '#0D2E1A' : '#F0FFF4',
      borderRadius: 14,
      padding: 16,
      marginBottom: 20,
    },
    resultHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    resultTitle: { fontSize: 16, fontWeight: '700', color: isDark ? '#34C759' : '#1A7A3A' },
    copyBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: isDark ? '#1A4A29' : '#D6F5E3',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
    },
    copyBtnText: { fontSize: 13, fontWeight: '600', color: isDark ? '#34C759' : '#1A7A3A' },
    jwtBox: {
      backgroundColor: isDark ? '#0A1F11' : '#FFFFFF',
      borderRadius: 10,
      padding: 12,
      marginBottom: 12,
    },
    jwtText: {
      fontSize: 11,
      color: isDark ? '#66DD88' : '#1A5C2E',
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      lineHeight: 17,
    },
    expiryText: { fontSize: 13, color: isDark ? '#66DD88' : '#1A7A3A', marginBottom: 14 },
    stepsTitle: { fontSize: 14, fontWeight: '700', color: isDark ? '#34C759' : '#1A7A3A', marginBottom: 8 },
    stepRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
    stepNum: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: isDark ? '#1A4A29' : '#D6F5E3',
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepNumText: { fontSize: 11, fontWeight: '700', color: isDark ? '#34C759' : '#1A7A3A' },
    stepText: { fontSize: 13, color: isDark ? '#AAF0C4' : '#1A5C2E', flex: 1, lineHeight: 19 },
    warningBox: {
      backgroundColor: isDark ? '#3A2A00' : '#FFFBEB',
      borderRadius: 10,
      padding: 12,
      flexDirection: 'row',
      gap: 8,
      marginTop: 10,
    },
    warningText: { fontSize: 13, color: isDark ? '#FFD60A' : '#A05C00', flex: 1, lineHeight: 19 },
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={18} color={primaryText} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Apple JWT Key Generator</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Info Banner */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={20} color={isDark ? '#4DA6FF' : '#0066CC'} />
          <View style={{ flex: 1 }}>
            <Text style={styles.infoTitle}>Why is this needed?</Text>
            <Text style={styles.infoText}>
              Supabase requires a signed JWT (client secret) for Apple Sign In — not the raw .p8 private key. 
              This tool generates that JWT securely on your device using your Apple Developer credentials.
              The token is valid for 6 months.
            </Text>
          </View>
        </View>

        {/* Credentials Form */}
        <Text style={styles.sectionLabel}>Apple Developer Credentials</Text>
        <View style={styles.card}>
          <View>
            <Text style={styles.fieldLabel}>Team ID *</Text>
            <TextInput
              style={styles.input}
              value={teamId}
              onChangeText={setTeamId}
              placeholder="ABCD123456"
              placeholderTextColor={secondaryText}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={10}
            />
            <Text style={styles.hint}>Apple Developer → Membership → Team ID (10 chars)</Text>
          </View>

          <View>
            <Text style={styles.fieldLabel}>Key ID *</Text>
            <TextInput
              style={styles.input}
              value={keyId}
              onChangeText={setKeyId}
              placeholder="XYZ789ABCD"
              placeholderTextColor={secondaryText}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={10}
            />
            <Text style={styles.hint}>Apple Developer → Keys → Sign In with Apple Key → Key ID (10 chars)</Text>
          </View>

          <View>
            <Text style={styles.fieldLabel}>Service ID (Client ID) *</Text>
            <TextInput
              style={styles.input}
              value={clientId}
              onChangeText={setClientId}
              placeholder="com.yourdomain.signin"
              placeholderTextColor={secondaryText}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.hint}>Apple Developer → Identifiers → Services IDs → Identifier</Text>
          </View>

          <View>
            <Text style={styles.fieldLabel}>Private Key (.p8 file content) *</Text>
            <TextInput
              style={styles.textArea}
              value={privateKey}
              onChangeText={setPrivateKey}
              placeholder={'-----BEGIN PRIVATE KEY-----\nMIGTAgEAMBMGByqGSM49AgEGCCqGSM49...\n-----END PRIVATE KEY-----'}
              placeholderTextColor={secondaryText}
              multiline
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.hint}>Paste the full content of the .p8 file downloaded from Apple Developer (include BEGIN/END lines)</Text>
          </View>
        </View>

        {/* Error */}
        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={18} color="#FF453A" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Generate Button */}
        <TouchableOpacity style={styles.generateBtn} onPress={handleGenerate} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.generateBtnText}>Generate Client Secret</Text>
          )}
        </TouchableOpacity>

        {/* Result */}
        {result ? (
          <View style={styles.resultCard}>
            <View style={styles.resultHeader}>
              <Text style={styles.resultTitle}>✅ Client Secret Generated</Text>
              <TouchableOpacity style={styles.copyBtn} onPress={handleCopy}>
                <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={14} color={isDark ? '#34C759' : '#1A7A3A'} />
                <Text style={styles.copyBtnText}>{copied ? 'Copied!' : 'Copy'}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.jwtBox}>
              <Text style={styles.jwtText} numberOfLines={6} selectable>{result}</Text>
            </View>

            <Text style={styles.expiryText}>⏰ Expires: {expiry} (valid for 6 months)</Text>

            <Text style={styles.stepsTitle}>📋 Next Steps</Text>
            {[
              'Copy the client secret above',
              'Open Supabase Dashboard → Authentication → Providers → Apple',
              `Paste the JWT into the "Secret Key (JWT)" field`,
              `Fill in Service ID: ${clientId || 'your-service-id'}`,
              `Fill in Team ID: ${teamId || 'your-team-id'} and Key ID: ${keyId || 'your-key-id'}`,
              'Toggle "Enable Apple provider" to ON and click Save',
              'Test Apple Sign In on your login page',
            ].map((step, i) => (
              <View key={i} style={styles.stepRow}>
                <View style={styles.stepNum}>
                  <Text style={styles.stepNumText}>{i + 1}</Text>
                </View>
                <Text style={styles.stepText}>{step}</Text>
              </View>
            ))}

            <View style={styles.warningBox}>
              <Ionicons name="warning" size={16} color={isDark ? '#FFD60A' : '#A05C00'} />
              <Text style={styles.warningText}>
                This JWT expires in 6 months. You will need to regenerate a new client secret before then and update it in Supabase.
              </Text>
            </View>
          </View>
        ) : null}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}
