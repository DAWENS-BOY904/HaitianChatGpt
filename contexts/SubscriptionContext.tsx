//
import React, { createContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { getSupabaseClient } from '@/template';
import { useAuth } from '@/template';
import * as Notifications from 'expo-notifications';

// ── Notification setup ────────────────────────────────────────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

async function scheduleRenewalNotification(daysLeft: number): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    // Cancel any previously scheduled renewal reminders
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of scheduled) {
      if ((n.content.data as any)?.type === 'subscription_renewal') {
        await Notifications.cancelScheduledNotificationAsync(n.identifier);
      }
    }

    const body =
      daysLeft <= 0
        ? 'Your subscription has expired. Renew now to keep full access.'
        : daysLeft === 1
        ? 'Your subscription expires tomorrow! Tap to renew.'
        : `Your subscription expires in ${daysLeft} days. Tap to renew.`;

    // Show immediately as a local notification
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Subscription Expiring Soon',
        body,
        sound: true,
        data: { type: 'subscription_renewal', screen: 'subscription' },
      },
      trigger: null, // fire immediately
    });
  } catch (err) {
    console.log('[SubscriptionContext] Notification error (non-fatal):', err);
  }
}

export type SubscriptionTier = 'free' | 'lite' | 'super' | 'go' | 'plus';

export interface SubscriptionContextType {
  tier: SubscriptionTier;
  isLite: boolean;    // lite or above
  isSuper: boolean;   // super only
  isPaid: boolean;    // any paid tier
  expiresAt: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
  restorePurchases: () => Promise<void>;
  upgradeTierOptimistic: (tier: SubscriptionTier, expiresAt?: string | null) => void;
}

export const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const supabase = getSupabaseClient();

  const [tier, setTier] = useState<SubscriptionTier>('free');
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchSubscription = useCallback(async () => {
    if (!user?.id) {
      setTier('free');
      setExpiresAt(null);
      return;
    }
    setLoading(true);
    try {
      const { data } = await supabase
        .from('user_profiles')
        .select('subscription_tier, subscription_expires_at, is_lifetime_member')
        .eq('id', user.id)
        .single();

      if (data) {
        const now    = new Date();
        const expiry = data.subscription_expires_at ? new Date(data.subscription_expires_at) : null;
        const active = data.is_lifetime_member || !expiry || expiry > now;

        const rawTier = (data.subscription_tier as string) ?? 'free';
        const paidTiers: SubscriptionTier[] = ['lite', 'super', 'go', 'plus'];
        if (active && paidTiers.includes(rawTier as SubscriptionTier)) {
          setTier(rawTier as SubscriptionTier);
        } else {
          setTier('free');
        }
        setExpiresAt(data.subscription_expires_at || null);

        // ── Renewal reminder notification ─────────────────────────────
        if (
          !data.is_lifetime_member &&
          expiry &&
          paidTiers.includes(rawTier as SubscriptionTier)
        ) {
          const msLeft = expiry.getTime() - now.getTime();
          const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
          if (daysLeft <= 3) {
            const permitted = await requestNotificationPermissions();
            if (permitted) {
              await scheduleRenewalNotification(daysLeft);
            }
          }
        }
      }
    } catch {
      setTier('free');
    } finally {
      setLoading(false);
    }
  }, [user?.id, supabase]);

  // Fetch when user changes
  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  // Background → foreground AppState refresh
  useEffect(() => {
    let lastState: AppStateStatus = AppState.currentState;
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (lastState.match(/inactive|background/) && nextState === 'active') {
        fetchSubscription();
      }
      lastState = nextState;
    });
    return () => sub.remove();
  }, [fetchSubscription]);

  // Optimistic tier upgrade — called immediately after a successful purchase
  const upgradeTierOptimistic = useCallback((newTier: SubscriptionTier, expiresAtDate?: string | null) => {
    setTier(newTier);
    if (expiresAtDate !== undefined) setExpiresAt(expiresAtDate ?? null);
  }, []);

  // Legacy restore — RC SDK restore is now handled directly in subscription.tsx
  const restorePurchases = async () => {
    await fetchSubscription();
  };

  const isPaid  = tier !== 'free';
  const isLite  = tier === 'lite' || tier === 'super' || tier === 'go' || tier === 'plus';
  const isSuper = tier === 'super' || tier === 'plus';

  return (
    <SubscriptionContext.Provider
      value={{
        tier,
        isLite,
        isSuper,
        isPaid,
        expiresAt,
        loading,
        refresh: fetchSubscription,
        restorePurchases,
        upgradeTierOptimistic,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}