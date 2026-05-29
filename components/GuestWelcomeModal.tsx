import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Platform,
  Animated,
  Easing,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { useTheme } from '../hooks/useTheme';

interface GuestWelcomeModalProps {
  visible: boolean;
  onDismiss: () => void;
  messageLimit?: number;
}

export function GuestWelcomeModal({
  visible,
  onDismiss,
  messageLimit = 20,
}: GuestWelcomeModalProps) {
  const { isDark } = useTheme();
  const router = useRouter();
  const slideAnim = useRef(new Animated.Value(60)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacityAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
    } else {
      opacityAnim.setValue(0);
      slideAnim.setValue(60);
    }
  }, [visible]);

  const textColor = isDark ? '#FFFFFF' : '#000000';
  const subColor = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)';
  const cardBg = isDark ? 'rgba(28,28,32,0.98)' : 'rgba(255,255,255,0.98)';
  const divColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';

  const features = [
    { icon: 'chatbubble-ellipses-outline', label: `${messageLimit} free messages to try` },
    { icon: 'image-outline', label: 'Upload & analyze images' },
    { icon: 'search-outline', label: 'Live web search results' },
    { icon: 'code-slash-outline', label: 'Code in any language' },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        {Platform.OS === 'ios' ? (
          <BlurView intensity={isDark ? 55 : 45} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.52)' }]} />
        )}

        <Animated.View
          style={[
            styles.sheet,
            { backgroundColor: cardBg, opacity: opacityAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          {/* Handle */}
          <View style={[styles.handle, { backgroundColor: isDark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.18)' }]} />

          {/* Logo / icon */}
          <View style={[styles.iconWrap, { backgroundColor: '#10A37F' }]}>
            <Ionicons name="sparkles" size={28} color="#FFFFFF" />
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: textColor }]}>Welcome to Dawinix</Text>
          <Text style={[styles.subtitle, { color: subColor }]}>
            Your AI assistant, available for free. No account required to get started.
          </Text>

          {/* Feature list */}
          <View style={[styles.featureBox, { borderColor: divColor, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }]}>
            {features.map((f, i) => (
              <View
                key={f.label}
                style={[
                  styles.featureRow,
                  i < features.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: divColor },
                ]}
              >
                <View style={[styles.featureIconWrap, { backgroundColor: '#10A37F22' }]}>
                  <Ionicons name={f.icon as any} size={16} color="#10A37F" />
                </View>
                <Text style={[styles.featureLabel, { color: isDark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.8)' }]}>
                  {f.label}
                </Text>
              </View>
            ))}
          </View>

          {/* Limit note */}
          <View style={[styles.limitNote, { backgroundColor: isDark ? 'rgba(255,159,10,0.1)' : 'rgba(255,159,10,0.08)', borderColor: 'rgba(255,159,10,0.3)' }]}>
            <Ionicons name="information-circle-outline" size={15} color="#FF9F0A" style={{ marginTop: 1 }} />
            <Text style={[styles.limitNoteText, { color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.65)' }]}>
              Guest mode includes <Text style={{ color: '#FF9F0A', fontWeight: '700' }}>{messageLimit} free messages</Text>. Sign up for unlimited access and to save your chats.
            </Text>
          </View>

          {/* CTAs */}
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: '#10A37F' }]}
            onPress={() => { onDismiss(); router.push('/login'); }}
            activeOpacity={0.82}
          >
            <Text style={styles.primaryBtnText}>Create free account</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryBtn, { borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)', backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.04)' }]}
            onPress={() => { onDismiss(); router.push('/login'); }}
            activeOpacity={0.75}
          >
            <Text style={[styles.secondaryBtnText, { color: textColor }]}>Log in</Text>
          </TouchableOpacity>

          {/* Continue as guest */}
          <TouchableOpacity onPress={onDismiss} style={styles.guestBtn} activeOpacity={0.7}>
            <Text style={[styles.guestBtnText, { color: subColor }]}>
              Continue as guest
            </Text>
            <Text style={[styles.guestBtnSub, { color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)' }]}>
              {messageLimit} messages · no account needed
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 20,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  iconWrap: {
    width: 62,
    height: 62,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 16,
    shadowColor: '#10A37F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 20,
  },
  featureBox: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    marginBottom: 14,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 12,
  },
  featureIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureLabel: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  limitNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 20,
  },
  limitNoteText: {
    fontSize: 13,
    lineHeight: 19,
    flex: 1,
  },
  primaryBtn: {
    borderRadius: 50,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#10A37F',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryBtn: {
    borderRadius: 50,
    paddingVertical: 15,
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: 16,
  },
  secondaryBtnText: {
    fontSize: 16,
    fontWeight: '600',
  },
  guestBtn: {
    alignItems: 'center',
    paddingVertical: 6,
    gap: 3,
  },
  guestBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  guestBtnSub: {
    fontSize: 12,
  },
});
