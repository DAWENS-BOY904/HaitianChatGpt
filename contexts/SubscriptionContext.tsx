import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getSupabaseClient } from '@/template';
import { useAuth } from '@/template';

export type SubscriptionTier = 'free' | 'pro' | 'plus';

export interface SubscriptionContextType {
  tier: SubscriptionTier;
  isPro: boolean;
  isPlus: boolean;
  isUnlimited: boolean;
  expiresAt: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
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
        const now = new Date();
        const expiry = data.subscription_expires_at ? new Date(data.subscription_expires_at) : null;
        const isActive = data.is_lifetime_member || !expiry || expiry > now;

        if (isActive && (data.subscription_tier === 'plus' || data.subscription_tier === 'pro')) {
          setTier(data.subscription_tier as SubscriptionTier);
        } else {
          setTier('free');
        }
        setExpiresAt(data.subscription_expires_at || null);
      }
    } catch (_e) {
      setTier('free');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscription();
  }, [user?.id]);

  const isPro = tier === 'pro' || tier === 'plus';
  const isPlus = tier === 'plus';
  const isUnlimited = tier === 'pro' || tier === 'plus';

  return (
    <SubscriptionContext.Provider
      value={{
        tier,
        isPro,
        isPlus,
        isUnlimited,
        expiresAt,
        loading,
        refresh: fetchSubscription,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}
