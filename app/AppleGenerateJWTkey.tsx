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
import * as Crypto from 'expo-crypto';

// ── JWT Generation for Apple Sign In ──
// Using pure JS implementation with expo-crypto for SHA256 hashing
// NO Web Crypto API needed!

function base64UrlEncode(str: string): string {
  // Convert string to base64, then make it URL-safe
  const base64 = btoa(str);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str: string): string {
  // Restore base64 from base64url
  let padding = '';
  const padLen = 4 - (str.length % 4);
  if (padLen !== 4) {
    padding = '='.repeat(padLen);
  }
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/') + padding;
  return atob(base64);
}

// Convert hex string to Uint8Array
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

// Convert Uint8Array to hex string
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Convert string to Uint8Array
function stringToBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

// ── ECDSA Signature Implementation using expo-crypto ──
// Apple requires ES256 (ECDSA with P-256 curve and SHA-256)
// Since we don't have Web Crypto, we'll use a pure JS implementation

// P-256 curve parameters
const P256 = {
  p: BigInt('0xFFFFFFFF00000001000000000000000000000000FFFFFFFFFFFFFFFFFFFFFFFF'),
  a: BigInt('0xFFFFFFFF00000001000000000000000000000000FFFFFFFFFFFFFFFFFFFFFFFC'),
  b: BigInt('0x5AC635D8AA3A93E7B3EBBD55769886BC651D06B0CC53B0F63BCE3C3E27D2604B'),
  n: BigInt('0xFFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551'),
  Gx: BigInt('0x6B17D1F2E12C4247F8BCE6E563A440F277037D812DEB33A0F4A13945D898C296'),
  Gy: BigInt('0x4FE342E2FE1A7F9B8EE7EB4A7C0F9E162BCE33576B315ECECBB6406837BF51F5'),
};

// Point on elliptic curve
interface ECPoint {
  x: BigInt;
  y: BigInt;
  infinity?: boolean;
}

// Modular inverse using extended Euclidean algorithm
function modInverse(a: BigInt, m: BigInt): BigInt {
  let t = BigInt(0), newT = BigInt(1);
  let r = m, newR = a;
  
  while (newR !== BigInt(0)) {
    const quotient = r / newR;
    [t, newT] = [newT, t - quotient * newT];
    [r, newR] = [newR, r - quotient * newR];
  }
  
  if (r > BigInt(1)) throw new Error('Not invertible');
  if (t < BigInt(0)) t += m;
  return t;
}

// Point addition on P-256
function pointAdd(P: ECPoint, Q: ECPoint): ECPoint {
  if (P.infinity) return Q;
  if (Q.infinity) return P;
  
  let lambda: BigInt;
  if (P.x === Q.x && P.y === Q.y) {
    // Point doubling
    const num = (BigInt(3) * P.x * P.x + P256.a) % P256.p;
    const den = modInverse(BigInt(2) * P.y % P256.p, P256.p);
    lambda = (num * den) % P256.p;
  } else {
    // Point addition
    const num = (Q.y - P.y + P256.p) % P256.p;
    const den = modInverse((Q.x - P.x + P256.p) % P256.p, P256.p);
    lambda = (num * den) % P256.p;
  }
  
  const x3 = (lambda * lambda - P.x - Q.x + BigInt(2) * P256.p) % P256.p;
  const y3 = (lambda * (P.x - x3) - P.y + P256.p) % P256.p;
  
  return { x: x3, y: y3 };
}

// Scalar multiplication
function scalarMultiply(k: BigInt, P: ECPoint): ECPoint {
  let result: ECPoint = { x: BigInt(0), y: BigInt(0), infinity: true };
  let addend = P;
  let scalar = k;
  
  while (scalar > BigInt(0)) {
    if (scalar & BigInt(1)) {
      result = pointAdd(result, addend);
    }
    addend = pointAdd(addend, addend);
    scalar = scalar >> BigInt(1);
  }
  
  return result;
}

// Parse PKCS#8 private key to get the raw key bytes
function parsePKCS8PrivateKey(pem: string): Uint8Array {
  // Remove PEM headers and whitespace
  const clean = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/-----BEGIN EC PRIVATE KEY-----/g, '')
    .replace(/-----END EC PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '');
  
  if (!clean) throw new Error('Private key is empty after stripping PEM headers.');
  
  try {
    return Uint8Array.from(atob(clean), c => c.charCodeAt(0));
  } catch {
    throw new Error('Failed to decode private key — make sure you paste the full .p8 content including BEGIN/END lines.');
  }
}

// Simple ASN.1 parser for EC private key
function parseECPrivateKey(pkcs8Bytes: Uint8Array): { privateKey: BigInt, publicKey: ECPoint } {
  // This is a simplified parser - for production, consider using a library
  // For now, we'll extract the private key from the PKCS#8 structure
  
  let offset = 0;
  
  // Skip SEQUENCE tag and length
  if (pkcs8Bytes[offset++] !== 0x30) throw new Error('Invalid PKCS#8 format');
  
  // Read length
  let length = pkcs8Bytes[offset++];
  if (length & 0x80) {
    const numBytes = length & 0x7F;
    length = 0;
    for (let i = 0; i < numBytes; i++) {
      length = (length << 8) | pkcs8Bytes[offset++];
    }
  }
  
  // Skip version
  if (pkcs8Bytes[offset++] !== 0x02) throw new Error('Expected INTEGER');
  const versionLen = pkcs8Bytes[offset++];
  offset += versionLen;
  
  // Skip AlgorithmIdentifier
  if (pkcs8Bytes[offset++] !== 0x30) throw new Error('Expected SEQUENCE');
  const algoLen = pkcs8Bytes[offset++];
  offset += algoLen;
  
  // PrivateKey OCTET STRING
  if (pkcs8Bytes[offset++] !== 0x04) throw new Error('Expected OCTET STRING');
  let privKeyLen = pkcs8Bytes[offset++];
  if (privKeyLen & 0x80) {
    const numBytes = privKeyLen & 0x7F;
    privKeyLen = 0;
    for (let i = 0; i < numBytes; i++) {
      privKeyLen = (privKeyLen << 8) | pkcs8Bytes[offset++];
    }
  }
  
  // Now we're at the ECPrivateKey structure
  const ecPrivKey = pkcs8Bytes.slice(offset, offset + privKeyLen);
  let ecOffset = 0;
  
  // Skip version
  if (ecPrivKey[ecOffset++] !== 0x02) throw new Error('Expected INTEGER in EC key');
  const ecVersionLen = ecPrivKey[ecOffset++];
  ecOffset += ecVersionLen;
  
  // Private key
  if (ecPrivKey[ecOffset++] !== 0x04) throw new Error('Expected OCTET STRING for private key');
  const dLen = ecPrivKey[ecOffset++];
  const dBytes = ecPrivKey.slice(ecOffset, ecOffset + dLen);
  ecOffset += dLen;
  
  const d = BigInt('0x' + bytesToHex(dBytes));
  
  // Generate public key from private key
  const G: ECPoint = { x: P256.Gx, y: P256.Gy };
  const publicKey = scalarMultiply(d, G);
  
  return { privateKey: d, publicKey };
}

// Sign data using ECDSA (ES256)
async function ecdsaSign(privateKey: BigInt, data: Uint8Array): Promise<{ r: BigInt, s: BigInt }> {
  // Hash the data using expo-crypto SHA-256
  const hashHex = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    new TextDecoder().decode(data)
  );
  const hash = BigInt('0x' + hashHex);
  
  const n = P256.n;
  const G: ECPoint = { x: P256.Gx, y: P256.Gy };
  
  let r: BigInt, s: BigInt;
  let k: BigInt;
  
  // Generate deterministic k (RFC 6979 simplified)
  // In production, use proper RFC 6979
  const randomBytes = await Crypto.getRandomBytesAsync(32);
  k = BigInt('0x' + bytesToHex(randomBytes)) % n;
  if (k === BigInt(0)) k = BigInt(1);
  
  // Calculate R = k * G
  const R = scalarMultiply(k, G);
  r = R.x % n;
  
  // Calculate s = k^-1 * (hash + r * privateKey) mod n
  const kInv = modInverse(k, n);
  s = (kInv * (hash + r * privateKey)) % n;
  
  return { r, s };
}

// Main function to generate Apple client secret
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

  try {
    // Encode header and payload
    const encHeader = base64UrlEncode(JSON.stringify(header));
    const encPayload = base64UrlEncode(JSON.stringify(payload));
    const signingInput = `${encHeader}.${encPayload}`;

    // Parse private key
    const pkcs8Bytes = parsePKCS8PrivateKey(privateKey);
    const { privateKey: d } = parseECPrivateKey(pkcs8Bytes);

    // Sign with ECDSA
    const signature = await ecdsaSign(d, stringToBytes(signingInput));
    
    // Encode signature as DER
    const rHex = signature.r.toString(16).padStart(64, '0');
    const sHex = signature.s.toString(16).padStart(64, '0');
    
    const rBytes = hexToBytes(rHex);
    const sBytes = hexToBytes(sHex);
    
    // Simple DER encoding
    const rDer = new Uint8Array([0x02, rBytes.length, ...rBytes]);
    const sDer = new Uint8Array([0x02, sBytes.length, ...sBytes]);
    const seq = new Uint8Array([0x30, rDer.length + sDer.length, ...rDer, ...sDer]);
    
    const encSig = base64UrlEncode(
      String.fromCharCode(...seq)
    );

    return `${signingInput}.${encSig}`;

  } catch (error: any) {
    console.error('JWT Generation error:', error);
    throw new Error(`Failed to generate JWT: ${error.message}`);
  }
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
