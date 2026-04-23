import React, { createContext, ReactNode, useState, useEffect, useCallback } from 'react';
import { useAuth } from '../template';
import { getSupabaseClient } from '../template';

export type SubscriptionTier = 'free' | 'go' | 'plus' | 'premium_monthly' | 'premium_yearly' | 'lifetime';

// Plan aliases: Stripe check-subscription returns 'go'/'plus', old DB may have 'premium_monthly' etc.
const PAID_TIERS: SubscriptionTier[] = ['go', 'plus', 'premium_monthly', 'premium_yearly', 'lifetime'];

export function isPaidTier(tier: SubscriptionTier): boolean {
  return PAID_TIERS.includes(tier);
}

interface SubscriptionLimits {
  messagesPerDay: number;
  canUploadMedia: boolean;
  canCreateGroups: boolean;
  maxGroupMembers: number;
  canUseAdvancedAI: boolean;
  imageUploadsPerSession: number;
  fileUploadsPerSession: number;
}

interface SubscriptionContextType {
  tier: SubscriptionTier;
  isPro: boolean; // true when user has any paid plan
  messageCountToday: number;
  limits: SubscriptionLimits;
  canSendMessage: () => boolean;
  incrementMessageCount: () => Promise<void>;
  upgradeSubscription: (plan: SubscriptionTier) => Promise<{ error: string | null }>;
  restorePurchases: () => Promise<{ error: string | null }>;
  refreshSubscription: () => Promise<void>;
  loading: boolean;
}

export const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

const SUBSCRIPTION_LIMITS: Record<SubscriptionTier, SubscriptionLimits> = {
  free: {
    messagesPerDay: 20,
    canUploadMedia: true,  // allowed but limited to 4
    canCreateGroups: false,
    maxGroupMembers: 0,
    canUseAdvancedAI: false,
    imageUploadsPerSession: 4,
    fileUploadsPerSession: 4,
  },
  go: {
    messagesPerDay: 1000,
    canUploadMedia: true,
    canCreateGroups: true,
    maxGroupMembers: 256,
    canUseAdvancedAI: true,
    imageUploadsPerSession: 10,
    fileUploadsPerSession: 10,
  },
  plus: {
    messagesPerDay: 5000,
    canUploadMedia: true,
    canCreateGroups: true,
    maxGroupMembers: 512,
    canUseAdvancedAI: true,
    imageUploadsPerSession: 20,
    fileUploadsPerSession: 20,
  },
  premium_monthly: {
    messagesPerDay: 1000,
    canUploadMedia: true,
    canCreateGroups: true,
    maxGroupMembers: 256,
    canUseAdvancedAI: true,
    imageUploadsPerSession: 10,
    fileUploadsPerSession: 10,
  },
  premium_yearly: {
    messagesPerDay: 5000,
    canUploadMedia: true,
    canCreateGroups: true,
    maxGroupMembers: 512,
    canUseAdvancedAI: true,
    imageUploadsPerSession: 20,
    fileUploadsPerSession: 20,
  },
  lifetime: {
    messagesPerDay: 99999,
    canUploadMedia: true,
    canCreateGroups: true,
    maxGroupMembers: 512,
    canUseAdvancedAI: true,
    imageUploadsPerSession: 999,
    fileUploadsPerSession: 999,
  },
};

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [tier, setTier] = useState<SubscriptionTier>('free');
  const [messageCountToday, setMessageCountToday] = useState(0);
  const [loading, setLoading] = useState(true);
  const supabase = getSupabaseClient();

  // Load from DB then auto-check Stripe for live status
  const loadSubscriptionData = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('user_profiles')
      .select('subscription_tier, message_count_today, subscription_expires_at')
      .eq('id', user.id)
      .single();

    if (!error && data) {
      const currentTier = (data.subscription_tier || 'free') as SubscriptionTier;

      if (data.subscription_expires_at && new Date(data.subscription_expires_at) < new Date()) {
        if (currentTier !== 'lifetime') {
          await supabase.from('user_profiles').update({ subscription_tier: 'free' }).eq('id', user.id);
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
  }, [user, supabase]);

  // Call check-subscription edge function and sync to global state
  const refreshSubscription = useCallback(async () => {
    if (!user) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const { data, error } = await supabase.functions.invoke('check-subscription', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!error && data) {
        if (data.subscribed && data.plan) {
          const syncedTier = data.plan as SubscriptionTier;
          setTier(syncedTier);
        } else {
          // No active Stripe sub — fall back to DB value
          await loadSubscriptionData();
        }
      }
    } catch (e) {
      console.log('[SubscriptionContext] refresh failed:', e);
    }
  }, [user, supabase, loadSubscriptionData]);

  // On login: load DB data then sync from Stripe
  useEffect(() => {
    if (user) {
      loadSubscriptionData().then(() => {
        // Non-blocking Stripe sync after local data is loaded
        refreshSubscription();
      });
    } else {
      setTier('free');
      setLoading(false);
    }
  }, [user?.id]);

  const isPro = isPaidTier(tier);
  const limits = SUBSCRIPTION_LIMITS[tier] || SUBSCRIPTION_LIMITS['free'];

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

    if (!error) setTier(plan);
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
        isPro,
        messageCountToday,
        limits,
        canSendMessage,
        incrementMessageCount,
        upgradeSubscription,
        restorePurchases,
        refreshSubscription,
        loading,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}
