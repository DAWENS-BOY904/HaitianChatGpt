import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { getSupabaseClient, useAuth } from '@/template';

interface CoinSystemContextType {
  coins: number;
  isUnlimited: boolean;
  canSendMessage: () => boolean;
  canCreateProject: () => boolean;
  deductCoins: (amount: number) => Promise<boolean>;
  addCoins: (amount: number) => Promise<void>;
  loadCoins: () => Promise<void>;
  remainingMessages: number;
  isAdmin: boolean;
}

export const GuestLimitsContext = createContext<CoinSystemContextType | undefined>(undefined);

const ADMIN_EMAIL = 'berryxoe@gmail.com';
const DAILY_COINS = 1000;
const MESSAGE_COST = 0; // Normal messages are free
const PROJECT_COST = 100; // Projects cost coins
const MESSAGE_LIMIT = 5; // Free messages before coin deduction

export function GuestLimitsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const supabase = getSupabaseClient();

  const [coins, setCoins] = useState(0);
  const [isUnlimited, setIsUnlimited] = useState(false);
  const [messageCount, setMessageCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const isAdmin = user?.email === ADMIN_EMAIL;

  useEffect(() => {
    if (user) {
      loadCoins();
      loadMessageCount();
    } else {
      setLoading(false);
    }
  }, [user]);

  // Reset daily coins for non-admin users
  useEffect(() => {
    if (user && !isAdmin) {
      checkDailyReset();
    }
  }, [user, isAdmin]);

  const checkDailyReset = async () => {
    try {
      const today = new Date().toDateString();
      const { data, error } = await supabase
        .from('user_coins')
        .select('last_reset_date')
        .eq('user_id', user!.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      const lastReset = data?.last_reset_date;
      if (lastReset !== today) {
        // Reset daily coins
        await supabase
          .from('user_coins')
          .upsert({
            user_id: user!.id,
            total_coins: DAILY_COINS,
            is_unlimited: false,
            last_reset_date: today,
          });

        setCoins(DAILY_COINS);
        setMessageCount(0);
      }
    } catch (error) {
      console.error('Error checking daily reset:', error);
    }
  };

  const loadCoins = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_coins')
        .select('total_coins, is_unlimited')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setCoins(data.total_coins || 0);
        setIsUnlimited(data.is_unlimited || isAdmin);
      } else {
        // Initialize new user
        const initialCoins = isAdmin ? 999999 : DAILY_COINS;
        await supabase
          .from('user_coins')
          .insert({
            user_id: user.id,
            total_coins: initialCoins,
            is_unlimited: isAdmin,
            last_reset_date: new Date().toDateString(),
          });

        setCoins(initialCoins);
        setIsUnlimited(isAdmin);
      }
    } catch (error) {
      console.error('Error loading coins:', error);
    }
  };

  const loadMessageCount = async () => {
    if (!user) return;

    try {
      const today = new Date().toDateString();
      const { data, error } = await supabase
        .from('user_message_counts')
        .select('count, date')
        .eq('user_id', user.id)
        .eq('date', today)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data && data.date === today) {
        setMessageCount(data.count || 0);
      } else {
        setMessageCount(0);
      }
    } catch (error) {
      console.error('Error loading message count:', error);
    }
  };

  const canSendMessage = (): boolean => {
    if (!user) return false; // Require login
    if (isUnlimited || isAdmin) return true;
    if (messageCount < MESSAGE_LIMIT) return true; // Free messages
    return coins >= MESSAGE_COST; // Check coins for additional messages
  };

  const canCreateProject = (): boolean => {
    if (!user) return false;
    if (isUnlimited || isAdmin) return true;
    return coins >= PROJECT_COST;
  };

  const deductCoins = async (amount: number): Promise<boolean> => {
    if (!user) return false;
    if (isUnlimited || isAdmin) return true; // No deduction for unlimited users

    if (coins < amount) return false;

    try {
      const newCoins = coins - amount;
      const { error } = await supabase
        .from('user_coins')
        .update({ total_coins: newCoins })
        .eq('user_id', user.id);

      if (error) throw error;

      setCoins(newCoins);
      return true;
    } catch (error) {
      console.error('Error deducting coins:', error);
      return false;
    }
  };

  const addCoins = async (amount: number) => {
    if (!user) return;

    try {
      const newCoins = coins + amount;
      const { error } = await supabase
        .from('user_coins')
        .update({ total_coins: newCoins })
        .eq('user_id', user.id);

      if (error) throw error;

      setCoins(newCoins);
    } catch (error) {
      console.error('Error adding coins:', error);
    }
  };

  const incrementMessageCount = async () => {
    if (!user || isUnlimited || isAdmin) return;

    const newCount = messageCount + 1;
    setMessageCount(newCount);

    try {
      const today = new Date().toDateString();
      await supabase
        .from('user_message_counts')
        .upsert({
          user_id: user.id,
          date: today,
          count: newCount,
        });
    } catch (error) {
      console.error('Error incrementing message count:', error);
    }
  };

  const remainingMessages = (() => {
    if (!user) return 0;
    if (isUnlimited || isAdmin) return Infinity;
    if (messageCount < MESSAGE_LIMIT) return MESSAGE_LIMIT - messageCount;
    return Math.floor(coins / MESSAGE_COST);
  })();

  return (
    <GuestLimitsContext.Provider
      value={{
        coins,
        isUnlimited: isUnlimited || isAdmin,
        canSendMessage,
        canCreateProject,
        deductCoins,
        addCoins,
        loadCoins,
        remainingMessages,
        isAdmin,
      }}
    >
      {children}
    </GuestLimitsContext.Provider>
  );
}
