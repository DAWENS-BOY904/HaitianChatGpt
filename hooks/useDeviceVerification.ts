/**
 * useDeviceVerification — detects new device logins and triggers
 * send-verification-code + redirects to /new-device-verify.
 *
 * Works on Web (desktop) only. Mobile devices are identified by
 * a stable UUID stored in AsyncStorage.
 */
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { getSupabaseClient } from '@/template';

const KNOWN_DEVICES_KEY_PREFIX = 'known_devices_v2_';

/** Generate a stable device fingerprint */
async function getDeviceFingerprint(): Promise<string> {
  // On web, use userAgent + platform combination
  if (Platform.OS === 'web') {
    try {
      const ua = typeof navigator !== 'undefined' ? navigator.userAgent : 'web';
      const plat = typeof navigator !== 'undefined' ? (navigator as any).platform || '' : '';
      // Hash-like fingerprint based on UA
      let hash = 0;
      const str = ua + plat;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return `web-${Math.abs(hash).toString(16)}`;
    } catch (_e) {
      return 'web-unknown';
    }
  }

  // On native, use a stable UUID stored in AsyncStorage
  try {
    const stored = await AsyncStorage.getItem('device_fingerprint_v2');
    if (stored) return stored;
    const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
    const fp = `${Platform.OS}-${uuid}`;
    await AsyncStorage.setItem('device_fingerprint_v2', fp);
    return fp;
  } catch (_e) {
    return `${Platform.OS}-fallback`;
  }
}

/** Get OS/device description for the verification email */
function getDeviceDescription(): { deviceName: string; os: string } {
  if (Platform.OS === 'web') {
    try {
      const ua = (typeof navigator !== 'undefined' ? navigator.userAgent : '') || '';
      let os = 'Web Browser';
      let deviceName = 'Web Browser';

      if (ua.includes('Windows')) { os = 'Windows'; deviceName = 'Windows Computer'; }
      else if (ua.includes('Mac')) { os = 'macOS'; deviceName = 'Mac Computer'; }
      else if (ua.includes('Linux')) { os = 'Linux'; deviceName = 'Linux Computer'; }
      else if (ua.includes('iPhone')) { os = 'iOS (Safari)'; deviceName = 'iPhone (Browser)'; }
      else if (ua.includes('Android')) { os = 'Android (Chrome)'; deviceName = 'Android (Browser)'; }

      return { deviceName, os };
    } catch (_e) {
      return { deviceName: 'Web Browser', os: 'Web' };
    }
  }
  return {
    deviceName: Platform.OS === 'ios' ? 'iPhone / iPad' : 'Android Device',
    os: Platform.OS === 'ios' ? 'iOS' : 'Android',
  };
}

interface UseDeviceVerificationOptions {
  userId: string | undefined;
  userEmail: string | undefined;
  /** Skip verification on mobile native devices (default: true) */
  skipOnNative?: boolean;
}

export function useDeviceVerification({
  userId,
  userEmail,
  skipOnNative = true,
}: UseDeviceVerificationOptions) {
  const router = useRouter();
  const checkedRef = useRef(false);
  const supabase = getSupabaseClient();

  useEffect(() => {
    if (!userId || !userEmail) { checkedRef.current = false; return; }
    if (checkedRef.current) return;
    // Skip verification on native mobile if configured
    if (skipOnNative && Platform.OS !== 'web') return;

    checkedRef.current = true;

    (async () => {
      try {
        const fingerprint = await getDeviceFingerprint();
        const storageKey = `${KNOWN_DEVICES_KEY_PREFIX}${userId}`;
        const raw = await AsyncStorage.getItem(storageKey);
        const knownDevices: string[] = raw ? JSON.parse(raw) : [];

        if (knownDevices.includes(fingerprint)) {
          // Known device — no verification needed
          return;
        }

        // New device — send verification email
        const { deviceName, os } = getDeviceDescription();
        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        // Best-effort geolocation via IP (non-blocking)
        let location = 'Unknown Location';
        try {
          const geoRes = await Promise.race([
            fetch('https://ipapi.co/json/'),
            new Promise<null>((_, rej) => setTimeout(() => rej(null), 3000)),
          ]) as Response | null;
          if (geoRes && geoRes.ok) {
            const geoData = await geoRes.json();
            if (geoData?.city && geoData?.country_name) {
              location = `${geoData.city}, ${geoData.country_name}`;
            }
          }
        } catch (_geoErr) {}

        // Invoke edge function to send verification email
        try {
          await supabase.functions.invoke('send-verification-code', {
            body: {
              email: userEmail,
              type: 'new_device',
              deviceInfo: { deviceName, os, location, time: timeStr },
            },
          });
        } catch (_emailErr) {
          // Non-fatal — still redirect to verify screen
        }

        // Redirect to device verification screen
        router.push({
          pathname: '/new-device-verify',
          params: {
            deviceName,
            os,
            location,
            time: timeStr,
          },
        } as any);

        // Mark device as known after successful verification
        // (The verify screen will call markDeviceKnown when user approves)
        await AsyncStorage.setItem(
          'pending_device_fingerprint',
          JSON.stringify({ fingerprint, userId, storageKey })
        );

      } catch (_err) {
        // Silent fail — never block login
      }
    })();
  }, [userId, userEmail]);

  /**
   * Call this from the verify screen after the user confirms it's them.
   * Adds the device fingerprint to the known devices list.
   */
  const markDeviceKnown = async () => {
    try {
      const raw = await AsyncStorage.getItem('pending_device_fingerprint');
      if (!raw) return;
      const { fingerprint, userId: uid, storageKey } = JSON.parse(raw);
      const existing = await AsyncStorage.getItem(storageKey);
      const known: string[] = existing ? JSON.parse(existing) : [];
      if (!known.includes(fingerprint)) known.push(fingerprint);
      // Keep only last 10 devices
      if (known.length > 10) known.splice(0, known.length - 10);
      await AsyncStorage.setItem(storageKey, JSON.stringify(known));
      await AsyncStorage.removeItem('pending_device_fingerprint');
    } catch (_e) {}
  };

  return { markDeviceKnown };
}
