import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getSupabaseClient } from '@/template';
import { useAuth } from '@/template';

export type SubscriptionTier = 'free' | 'plus' | 'pro';

interface SubscriptionLimits {
  messagesPerDay: number;
  canUploadMedia: boolean;
  canCreateGroups: boolean;
  maxGroupMembers: number;
  canUseAdvancedAI: boolean;
  imageUploadsPerSession: number;
  fileUploadsPerSession: number;
}

const FREE_LIMITS: SubscriptionLimits = {
  messagesPerDay: 40,
  canUploadMedia: true,
  canCreateGroups: false,
  maxGroupMembers: 0,
  canUseAdvancedAI: false,
  imageUploadsPerSession: 4,
  fileUploadsPerSession: 1,
};

const PLUS_LIMITS: SubscriptionLimits = {
  messagesPerDay: 99999,
  canUploadMedia: true,
  canCreateGroups: true,
  maxGroupMembers: 64,
  canUseAdvancedAI: true,
  imageUploadsPerSession: 10,
  fileUploadsPerSession: 10,
};

interface SubscriptionContextType {
  tier: SubscriptionTier;
  isPro: boolean;
  limits: SubscriptionLimits;
  messageCount: number;
  canSendMessage: () => boolean;
  incrementMessageCount: () => Promise<void>;
  refreshSubscription: () => Promise<void>;
  loading: boolean;
}

export const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const supabase = getSupabaseClient();

  const [tier, setTier] = useState<SubscriptionTier>('free');
  const [messageCount, setMessageCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadSubscription = async () => {
    if (!user?.id) {
      setTier('free');
      setMessageCount(0);
      setLoading(false);
      return;
    }
    try {
      const { data } = await supabase
        .from('user_profiles')
        .select('subscription_tier, message_count_today, last_message_reset')
        .eq('id', user.id)
        .single();

      if (data) {
        // Reset daily count if it's a new day
        const lastReset = data.last_message_reset ? new Date(data.last_message_reset) : null;
        const now = new Date();
        const isNewDay = !lastReset || (
          now.getDate() !== lastReset.getDate() ||
          now.getMonth() !== lastReset.getMonth() ||
          now.getFullYear() !== lastReset.getFullYear()
        );

        if (isNewDay) {
          await supabase
            .from('user_profiles')
            .update({ message_count_today: 0, last_message_reset: now.toISOString() } as any)
            .eq('id', user.id);
          setMessageCount(0);
        } else {
          setMessageCount(data.message_count_today || 0);
        }

        const rawTier = data.subscription_tier || 'free';
        setTier(rawTier === 'plus' || rawTier === 'pro' ? rawTier : 'free');
      }
    } catch (_e) {
      setTier('free');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubscription();
  }, [user?.id]);

  const isPro = tier === 'plus' || tier === 'pro';
  const limits = isPro ? PLUS_LIMITS : FREE_LIMITS;

  const canSendMessage = (): boolean => {
    if (isPro) return true;
    return messageCount < limits.messagesPerDay;
  };

  const incrementMessageCount = async () => {
    const newCount = messageCount + 1;
    setMessageCount(newCount);
    if (user?.id) {
      try {
        await supabase
          .from('user_profiles')
          .update({ message_count_today: newCount } as any)
          .eq('id', user.id);
      } catch (_e) {}
    }
  };

  const refreshSubscription = async () => {
    await loadSubscription();
  };

  return (
    <SubscriptionContext.Provider
      value={{
        tier,
        isPro,
        limits,
        messageCount,
        canSendMessage,
        incrementMessageCount,
        refreshSubscription,
        loading,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}
