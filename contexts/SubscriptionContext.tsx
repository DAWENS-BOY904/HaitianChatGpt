import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { getSupabaseClient } from '@/template';
import { useAuth } from '@/template';

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
}

export const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const supabase = getSupabaseClient();

  const [tier, setTier] = useState<SubscriptionTier>('free');
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchSubscription = async () => {
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
      }
    } catch {
      setTier('free');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscription();
  }, [user?.id]);

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
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}
