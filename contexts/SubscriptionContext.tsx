import React, { createContext, ReactNode, useState, useEffect } from 'react';
import { useAuth } from '../template';
import { getSupabaseClient } from '../template';

export type SubscriptionTier = 'free' | 'premium_monthly' | 'premium_yearly' | 'lifetime';

interface SubscriptionLimits {
  messagesPerDay: number;
  canUploadMedia: boolean;
  canCreateGroups: boolean;
  maxGroupMembers: number;
  canUseAdvancedAI: boolean;
}

interface SubscriptionContextType {
  tier: SubscriptionTier;
  messageCountToday: number;
  limits: SubscriptionLimits;
  canSendMessage: () => boolean;
  incrementMessageCount: () => Promise<void>;
  upgradeSubscription: (plan: SubscriptionTier) => Promise<{ error: string | null }>;
  restorePurchases: () => Promise<{ error: string | null }>;
  loading: boolean;
}

export const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

const SUBSCRIPTION_LIMITS: Record<SubscriptionTier, SubscriptionLimits> = {
  free: {
    messagesPerDay: 20,
    canUploadMedia: false,
    canCreateGroups: false,
    maxGroupMembers: 0,
    canUseAdvancedAI: false,
  },
  premium_monthly: {
    messagesPerDay: 1000,
    canUploadMedia: true,
    canCreateGroups: true,
    maxGroupMembers: 256,
    canUseAdvancedAI: true,
  },
  premium_yearly: {
    messagesPerDay: 1000,
    canUploadMedia: true,
    canCreateGroups: true,
    maxGroupMembers: 256,
    canUseAdvancedAI: true,
  },
  lifetime: {
    messagesPerDay: 99999,
    canUploadMedia: true,
    canCreateGroups: true,
    maxGroupMembers: 512,
    canUseAdvancedAI: true,
  },
};

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [tier, setTier] = useState<SubscriptionTier>('free');
  const [messageCountToday, setMessageCountToday] = useState(0);
  const [loading, setLoading] = useState(true);
  const supabase = getSupabaseClient();

  useEffect(() => {
    if (user) {
      loadSubscriptionData();
    }
  }, [user]);

  const loadSubscriptionData = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('user_profiles')
      .select('subscription_tier, message_count_today, subscription_expires_at')
      .eq('id', user.id)
      .single();

    if (!error && data) {
      const currentTier = data.subscription_tier as SubscriptionTier;
      
      // Check if subscription expired
      if (data.subscription_expires_at && new Date(data.subscription_expires_at) < new Date()) {
        if (currentTier !== 'lifetime') {
          await supabase
            .from('user_profiles')
            .update({ subscription_tier: 'free' })
            .eq('id', user.id);
          setTier('free');
        } else {
          setTier(currentTier);
        }
      } else {
        setTier(currentTier);
      }

      setMessageCountToday(data.message_count_today || 0);
    }

    setLoading(false);
  };

  const limits = SUBSCRIPTION_LIMITS[tier];

  const canSendMessage = () => {
    return messageCountToday < limits.messagesPerDay;
  };

  const incrementMessageCount = async () => {
    if (!user) return;

    const newCount = messageCountToday + 1;
    setMessageCountToday(newCount);

    await supabase
      .from('user_profiles')
      .update({ message_count_today: newCount })
      .eq('id', user.id);
  };

  const upgradeSubscription = async (plan: SubscriptionTier) => {
    if (!user) return { error: 'Not authenticated' };

    const prices: Record<SubscriptionTier, number> = {
      free: 0,
      premium_monthly: 10,
      premium_yearly: 20,
      lifetime: 80,
    };

    // Calculate expiration
    let expiresAt: string | null = null;
    if (plan === 'premium_monthly') {
      const expiry = new Date();
      expiry.setMonth(expiry.getMonth() + 1);
      expiresAt = expiry.toISOString();
    } else if (plan === 'premium_yearly') {
      const expiry = new Date();
      expiry.setFullYear(expiry.getFullYear() + 1);
      expiresAt = expiry.toISOString();
    }

    // Record transaction
    await supabase
      .from('subscription_transactions')
      .insert({
        user_id: user.id,
        plan,
        amount: prices[plan],
        status: 'completed',
        transaction_id: `sim_${Date.now()}`,
      });

    // Update user subscription
    const { error } = await supabase
      .from('user_profiles')
      .update({
        subscription_tier: plan,
        subscription_expires_at: expiresAt,
      })
      .eq('id', user.id);

    if (!error) {
      setTier(plan);
    }

    return { error: error?.message || null };
  };

  const restorePurchases = async () => {
    if (!user) return { error: 'Not authenticated' };

    // Query for latest completed transaction
    const { data, error } = await supabase
      .from('subscription_transactions')
      .select('plan, created_at')
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1);

    if (error || !data || data.length === 0) {
      return { error: 'No purchases found' };
    }

    const lastPurchase = data[0];
    
    // Restore the subscription
    let expiresAt: string | null = null;
    if (lastPurchase.plan === 'premium_monthly') {
      const purchaseDate = new Date(lastPurchase.created_at);
      const expiry = new Date(purchaseDate);
      expiry.setMonth(expiry.getMonth() + 1);
      expiresAt = expiry.toISOString();
    } else if (lastPurchase.plan === 'premium_yearly') {
      const purchaseDate = new Date(lastPurchase.created_at);
      const expiry = new Date(purchaseDate);
      expiry.setFullYear(expiry.getFullYear() + 1);
      expiresAt = expiry.toISOString();
    }

    await supabase
      .from('user_profiles')
      .update({
        subscription_tier: lastPurchase.plan,
        subscription_expires_at: expiresAt,
      })
      .eq('id', user.id);

    await loadSubscriptionData();
    return { error: null };
  };

  return (
    <SubscriptionContext.Provider
      value={{
        tier,
        messageCountToday,
        limits,
        canSendMessage,
        incrementMessageCount,
        upgradeSubscription,
        restorePurchases,
        loading,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}
