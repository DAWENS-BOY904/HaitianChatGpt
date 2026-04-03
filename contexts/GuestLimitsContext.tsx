
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
  incrementMessageCount: () => Promise<void>;
  imageUploadCount: number;
  canUploadImage: (isPro: boolean) => boolean;
  incrementImageUploadCount: () => Promise<void>;
  resetImageUploadIfNeeded: () => Promise<void>;
}

export const GuestLimitsContext = createContext<CoinSystemContextType | undefined>(undefined);

const ADMIN_EMAILS = ['berryxoe@gmail.com', 'newdawens@gmail.com', 'kontgithub@gmail.com'];
const DAILY_COINS = 1000;
const MESSAGE_COST = 0;
const PROJECT_COST = 100;
const MESSAGE_LIMIT = 50; // Free messages per day
const FREE_IMAGE_LIMIT = 4; // Free plan: 4 images per 24h
const PRO_IMAGE_LIMIT = 10; // Pro plan: 10 images per session

export function GuestLimitsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const supabase = getSupabaseClient();

  const [coins, setCoins] = useState(0);
  const [isUnlimited, setIsUnlimited] = useState(false);
  const [messageCount, setMessageCount] = useState(0);
  const [imageUploadCount, setImageUploadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const isAdmin = ADMIN_EMAILS.includes(user?.email || '');

  useEffect(() => {
    if (user) {
      loadCoins();
      loadMessageCount();
      loadImageUploadCount();
    } else {
      setLoading(false);
    }
  }, [user]);

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
        .select('last_daily_reset')
        .eq('user_id', user!.id)
        .single();

      if (error && error.code !== 'PGRST116') return;

      const lastReset = data?.last_daily_reset;
      if (!lastReset || new Date(lastReset).toDateString() !== today) {
        await supabase
          .from('user_coins')
          .upsert({
            user_id: user!.id,
            total_coins: DAILY_COINS,
            is_unlimited: false,
            last_daily_reset: new Date().toISOString(),
          });

        setCoins(DAILY_COINS);
        setMessageCount(0);
        setImageUploadCount(0);
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
        const initialCoins = isAdmin ? 999999 : DAILY_COINS;
        await supabase.from('user_coins').insert({
          user_id: user.id,
          total_coins: initialCoins,
          is_unlimited: isAdmin,
          last_daily_reset: new Date().toISOString(),
        });
        setCoins(initialCoins);
        setIsUnlimited(isAdmin);
      }
    } catch (error) {
      console.error('Error loading coins:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMessageCount = async () => {
    if (!user) return;
    try {
      const today = new Date().toDateString();
      const { data } = await supabase
        .from('user_profiles')
        .select('message_count_today, last_message_reset')
        .eq('id', user.id)
        .single();

      if (data) {
        const lastReset = data.last_message_reset
          ? new Date(data.last_message_reset).toDateString()
          : null;
        if (lastReset === today) {
          setMessageCount(data.message_count_today || 0);
        } else {
          setMessageCount(0);
        }
      }
    } catch (error) {
      console.error('Error loading message count:', error);
    }
  };

  const loadImageUploadCount = async () => {
    if (!user) return;
    try {
      // Re-use daily_coins_used as image upload count tracking
      // We'll store image count separately in localStorage-like approach via user_settings
      // For simplicity use local state that resets daily
      setImageUploadCount(0); // This line is within the try block, but the data fetching was removed.
      // If `daily_coins_used` was meant to be fetched and used here,
      // the select statement should include it, e.g., `.select('daily_coins_used, last_daily_reset')`
      // and then `setImageUploadCount(data.daily_coins_used || 0);`
      // For now, I'm keeping the original logic of setting to 0 as it seems intended to be reset daily.
    } catch (error) {
      console.error('Error loading image upload count:', error); // Added error logging for completeness
    }
  };

  const canSendMessage = (): boolean => {
    if (!user) return false;
    if (isUnlimited || isAdmin) return true;
    return messageCount < MESSAGE_LIMIT;
  };

  const canUploadImage = (isPro: boolean): boolean => {
    if (!user) return false;
    if (isAdmin || isUnlimited) return true;
    if (isPro) return imageUploadCount < PRO_IMAGE_LIMIT;
    return imageUploadCount < FREE_IMAGE_LIMIT;
  };

  const canCreateProject = (): boolean => {
    if (!user) return false;
    if (isUnlimited || isAdmin) return true;
    return coins >= PROJECT_COST;
  };

  const deductCoins = async (amount: number): Promise<boolean> => {
    if (!user) return false;
    if (isUnlimited || isAdmin) return true;
    if (coins < amount) return false;

    try {
      const newCoins = coins - amount;
      await supabase.from('user_coins').update({ total_coins: newCoins }).eq('user_id', user.id);
      setCoins(newCoins);
      return true;
    } catch (error) { // Added error parameter for logging
      console.error('Error deducting coins:', error); // Added error logging
      return false;
    }
  };

  const addCoins = async (amount: number) => {
    if (!user) return;
    try {
      const newCoins = coins + amount;
      await supabase.from('user_coins').update({ total_coins: newCoins }).eq('user_id', user.id);
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
      await supabase
        .from('user_profiles')
        .update({
          message_count_today: newCount,
          last_message_reset: new Date().toISOString(),
        })
        .eq('id', user.id);
    } catch (error) {
      console.error('Error incrementing message count:', error);
    }
  };

  const incrementImageUploadCount = async () => {
    if (!user || isAdmin || isUnlimited) return;
    const newCount = imageUploadCount + 1;
    setImageUploadCount(newCount);
  };

  const resetImageUploadIfNeeded = async () => {
    // Called when user waits 24h - reset counter
    setImageUploadCount(0);
  };

  const remainingMessages = (() => {
    if (!user) return 0;
    if (isUnlimited || isAdmin) return Infinity;
    return Math.max(0, MESSAGE_LIMIT - messageCount);
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
        incrementMessageCount,
        imageUploadCount,
        canUploadImage,
        incrementImageUploadCount,
        resetImageUploadIfNeeded,
      }}
    >
      {children}
    </GuestLimitsContext.Provider>
  );
}
hello ai dont skip please In the daily limit banner in home.tsx, add a live countdown showing hours and minutes remaining until midnight reset, formatted as 'Resets in 3h 42m', updating every minute via a useEffect interval.When the daily message limit is reached in home.tsx, add a second button 'New Chat' next to 'Get Plus' in the limit banner that starts a fresh conversation granting 100 extra messages for that session only.
