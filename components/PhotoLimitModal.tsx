/**
 * PhotoLimitModal — shown when a free user exceeds the photo upload limit.
 * Free plan: 5 photos per hour. Displays real-time countdown to exact reset.
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
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Config ───────────────────────────────────────────────────────────────────
export const FREE_PHOTO_LIMIT = 5;          // max photos per window
export const PHOTO_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const STORAGE_KEY = 'photo_upload_log';     // list of upload timestamps (ms)

// ─── Helpers ─────────────────────────────────────────────────────────────────
/** Returns the current photo log (timestamps within the last hour). */
async function getPhotoLog(): Promise<number[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const all: number[] = raw ? JSON.parse(raw) : [];
    const cutoff = Date.now() - PHOTO_LIMIT_WINDOW_MS;
    return all.filter(ts => ts > cutoff);
  } catch {
    return [];
  }
}

/** Record a new photo upload; returns updated count within the window. */
export async function recordPhotoUpload(): Promise<number> {
  const log = await getPhotoLog();
  log.push(Date.now());
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(log));
  return log.length;
}

/**
 * Check if the user is within the free limit.
 * Returns `{ allowed: true }` or `{ allowed: false, resetAtMs: number }`.
 */
export async function checkPhotoLimit(isPaidPlan: boolean): Promise<
  { allowed: true } | { allowed: false; resetAtMs: number; used: number }
> {
  if (isPaidPlan) return { allowed: true };
  const log = await getPhotoLog();
  if (log.length < FREE_PHOTO_LIMIT) return { allowed: true };
  // Oldest upload within the window determines when the slot frees up
  const oldest = Math.min(...log);
  const resetAtMs = oldest + PHOTO_LIMIT_WINDOW_MS;
  return { allowed: false, resetAtMs, used: log.length };
}

// ─── Formatting ──────────────────────────────────────────────────────────────
function formatCountdown(ms: number): string {
  if (ms <= 0) return 'now';
  const totalSecs = Math.ceil(ms / 1000);
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m} min${m !== 1 ? 's' : ''} ${s}s`;
  return `${s}s`;
}

function formatClockTime(ms: number): string {
  if (ms <= 0) return 'now';
  const d = new Date(ms);
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${m} ${ampm}`;
}

// ─── Component ────────────────────────────────────────────────────────────────
interface PhotoLimitModalProps {
  visible: boolean;
  onClose: () => void;
  /** Unix timestamp (ms) when the oldest upload in the window expires */
  resetAtMs: number;
  /** Model name shown in the modal title */
  modelName?: string;
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

  const [remainingMs, setRemainingMs] = useState(() => Math.max(0, resetAtMs - Date.now()));

  // Tick every second so the countdown stays accurate
  useEffect(() => {
    if (!visible) return;
    const tick = () => setRemainingMs(Math.max(0, resetAtMs - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
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

  const countdown = formatCountdown(remainingMs);
  const clockTime = formatClockTime(resetAtMs);

  const cardBg = isDark ? 'rgba(28,28,32,0.98)' : 'rgba(255,255,255,0.98)';
  const textC  = isDark ? '#FFFFFF' : '#000000';
  const subC   = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)';
  const divC   = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <BlurView
          intensity={isDark ? 55 : 42}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />

        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />

        <Animated.View
          style={[
            styles.sheet,
            { backgroundColor: cardBg, opacity: opacityAnim, transform: [{ scale: scaleAnim }] },
          ]}
        >
          {/* Close */}
          <TouchableOpacity
            style={[styles.closeBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)' }]}
            onPress={onClose}
          >
            <Ionicons name="close" size={16} color={textC} />
          </TouchableOpacity>

          {/* Icon */}
          <View style={[styles.iconCircle, { backgroundColor: isDark ? 'rgba(255,149,0,0.15)' : 'rgba(255,149,0,0.1)', borderColor: 'rgba(255,149,0,0.35)' }]}>
            <Ionicons name="image-outline" size={26} color="#FF9500" />
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: textC }]}>
            {`Attachments aren't available with this model`}
          </Text>

          {/* Body */}
          <Text style={[styles.subtitle, { color: subC }]}>
            {`Please try again after your ${modelName} photo limit resets at `}
            <Text style={{ color: textC, fontWeight: '700' }}>{clockTime}</Text>
            {remainingMs > 0 ? (
              <Text style={{ color: '#FF9500', fontWeight: '600' }}>
                {`  (${countdown} left)`}
              </Text>
            ) : null}
          </Text>

          {/* Live countdown pill */}
          {remainingMs > 0 ? (
            <View style={[styles.countdownPill, { backgroundColor: isDark ? 'rgba(255,149,0,0.12)' : 'rgba(255,149,0,0.08)', borderColor: 'rgba(255,149,0,0.3)' }]}>
              <Ionicons name="time-outline" size={14} color="#FF9500" />
              <Text style={{ color: '#FF9500', fontSize: 13, fontWeight: '600' }}>
                {`Resets in ${countdown}`}
              </Text>
            </View>
          ) : (
            <View style={[styles.countdownPill, { backgroundColor: isDark ? 'rgba(52,199,89,0.12)' : 'rgba(52,199,89,0.08)', borderColor: 'rgba(52,199,89,0.3)' }]}>
              <Ionicons name="checkmark-circle-outline" size={14} color="#34C759" />
              <Text style={{ color: '#34C759', fontSize: 13, fontWeight: '600' }}>Limit reset — try again!</Text>
            </View>
          )}

          {/* Free plan info */}
          <View style={[styles.infoBox, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', borderColor: divC }]}>
            <Ionicons name="information-circle-outline" size={14} color={subC} />
            <Text style={{ color: subC, fontSize: 12, lineHeight: 17, flex: 1 }}>
              {`Free plan: ${FREE_PHOTO_LIMIT} photo uploads per hour. Upgrade to Plus for unlimited uploads.`}
            </Text>
          </View>

          {/* Divider */}
          <View style={[styles.divider, { backgroundColor: divC }]} />

          {/* CTA */}
          <TouchableOpacity
            style={styles.plusBtn}
            onPress={() => { onClose(); router.push('/subscription'); }}
            activeOpacity={0.85}
          >
            <Ionicons name="sparkles" size={16} color="#FFF" style={{ marginRight: 6 }} />
            <Text style={styles.plusBtnText}>Get Plus — Unlimited uploads</Text>
          </TouchableOpacity>

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
    marginBottom: 14,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
    width: '100%',
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
After the photo limit resets (1 hour after the oldest upload), trigger a local push notification that says 'Your photo upload limit has reset — you can now upload 5 more photos.
