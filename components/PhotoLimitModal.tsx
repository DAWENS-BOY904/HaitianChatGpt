/**
 * PhotoLimitModal — shown when a free user exceeds the photo upload limit.
 * Displays real-time countdown to when the limit resets.
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Platform,
  Animated,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useRouter } from 'expo-router';

interface PhotoLimitModalProps {
  visible: boolean;
  onClose: () => void;
  /** Unix timestamp (ms) when the limit resets */
  resetAtMs: number;
  /** Current AI model name, shown in the message */
  modelName?: string;
}

function formatTimeRemaining(ms: number): { label: string; detail: string } {
  if (ms <= 0) return { label: 'now', detail: '' };

  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return { label: `${days} day${days !== 1 ? 's' : ''}`, detail: '' };
  }
  if (hours > 0) {
    return {
      label: `${hours}h ${minutes}m`,
      detail: minutes === 0 ? '' : `${minutes} min left`,
    };
  }
  if (minutes > 0) {
    return {
      label: `${minutes} min`,
      detail: `${minutes} min left`,
    };
  }
  return {
    label: `${seconds}s`,
    detail: 'less than a minute',
  };
}

function formatResetTime(ms: number): string {
  if (ms <= 0) return 'now';
  const resetDate = new Date(Date.now() + ms);
  const hours = resetDate.getHours();
  const minutes = resetDate.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const h = hours % 12 || 12;
  const m = minutes.toString().padStart(2, '0');
  return `${h}:${m} ${ampm}`;
}

export function PhotoLimitModal({
  visible,
  onClose,
  resetAtMs,
  modelName = 'DNX-5.5',
}: PhotoLimitModalProps) {
  const { isDark } = useTheme();
  const router = useRouter();
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  // Real-time remaining ms
  const [remainingMs, setRemainingMs] = useState(() => Math.max(0, resetAtMs - Date.now()));

  useEffect(() => {
    if (!visible) return;
    // Update every 30 seconds for live countdown
    const update = () => setRemainingMs(Math.max(0, resetAtMs - Date.now()));
    update();
    const interval = setInterval(update, 30_000);
    return () => clearInterval(interval);
  }, [visible, resetAtMs]);

  useEffect(() => {
    if (visible) {
      scaleAnim.setValue(0.92);
      opacityAnim.setValue(0);
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, tension: 200, friction: 18, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const { label: timeLabel, detail: timeDetail } = formatTimeRemaining(remainingMs);
  const resetTimeStr = formatResetTime(remainingMs);

  const cardBg = isDark ? 'rgba(28,28,32,0.98)' : 'rgba(255,255,255,0.98)';
  const textC = isDark ? '#FFFFFF' : '#000000';
  const subC = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)';
  const divC = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        {Platform.OS === 'ios' ? (
          <BlurView intensity={isDark ? 55 : 42} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.52)' }]} />
        )}

        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />

        <Animated.View
          style={[
            styles.sheet,
            { backgroundColor: cardBg, opacity: opacityAnim, transform: [{ scale: scaleAnim }] },
          ]}
        >
          {/* Close button */}
          <TouchableOpacity style={[styles.closeBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)' }]} onPress={onClose}>
            <Ionicons name="close" size={16} color={textC} />
          </TouchableOpacity>

          {/* Icon */}
          <View style={[styles.iconCircle, { backgroundColor: isDark ? 'rgba(255,149,0,0.15)' : 'rgba(255,149,0,0.1)', borderColor: 'rgba(255,149,0,0.35)' }]}>
            <Ionicons name="image-outline" size={26} color="#FF9500" />
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: textC }]}>
            Attachments are not available
          </Text>

          {/* Subtitle */}
          <Text style={[styles.subtitle, { color: subC }]}>
            {`Please try again after your ${modelName} limit resets after `}
            <Text style={{ color: textC, fontWeight: '700' }}>{resetTimeStr}</Text>
            {timeDetail ? (
              <Text style={{ color: '#FF9500', fontWeight: '600' }}>{` (${timeDetail})`}</Text>
            ) : null}
          </Text>

          {/* Countdown pill */}
          {remainingMs > 0 ? (
            <View style={[styles.countdownPill, { backgroundColor: isDark ? 'rgba(255,149,0,0.12)' : 'rgba(255,149,0,0.08)', borderColor: 'rgba(255,149,0,0.3)' }]}>
              <Ionicons name="time-outline" size={14} color="#FF9500" />
              <Text style={{ color: '#FF9500', fontSize: 13, fontWeight: '600' }}>
                {`Resets in ${timeLabel}`}
              </Text>
            </View>
          ) : null}

          {/* Divider */}
          <View style={[styles.divider, { backgroundColor: divC }]} />

          {/* Get Plus CTA */}
          <TouchableOpacity
            style={styles.plusBtn}
            onPress={() => { onClose(); router.push('/subscription'); }}
            activeOpacity={0.85}
          >
            <Ionicons name="sparkles" size={16} color="#FFF" style={{ marginRight: 6 }} />
            <Text style={styles.plusBtnText}>Get Plus — Unlimited uploads</Text>
          </TouchableOpacity>

          {/* Dismiss link */}
          <TouchableOpacity onPress={onClose} style={styles.dismissBtn} activeOpacity={0.7}>
            <Text style={[styles.dismissText, { color: subC }]}>Not now</Text>
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
    paddingTop: 24,
    paddingBottom: 40,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 20,
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 14,
    paddingHorizontal: 8,
  },
  countdownPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginBottom: 20,
  },
  divider: {
    width: '100%',
    height: StyleSheet.hairlineWidth,
    marginBottom: 20,
  },
  plusBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    borderRadius: 50,
    paddingVertical: 15,
    width: '100%',
    marginBottom: 12,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  plusBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  dismissBtn: {
    paddingVertical: 8,
  },
  dismissText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
