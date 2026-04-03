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
      const today = new Date().toDateString();
      const { data } = await supabase
        .from('user_coins')
        .select('daily_coins_used, last_daily_reset')
        .eq('user_id', user.id)
        .single();

      // Re-use daily_coins_used as image upload count tracking
      // We'll store image count separately in localStorage-like approach via user_settings
      // For simplicity use local state that resets daily
      setImageUploadCount(0);
    } catch {}
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
    } catch {
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
Enforce the image upload limits (4 images/day for free, 10 for pro) in handleMediaPicked in home.tsx: track uploads via GuestLimitsContext incrementImageUploadCount, and when the limit is reached show a banner matching the daily limit design with 'You have reached your image upload limit. Try again tomorrow at [time].' and a Get Plus button.In the daily limit banner shown in home.tsx, add a live countdown showing exactly how many hours and minutes remain until midnight reset. Format it as 'Resets in 3h 42m' displayed next to the 'Get Plus' button AND if limit messag done in bannet get plus  put another that says new chat and they can start a new chat with 100 message and ai must can help students with they work and if create table format if require so usage limits vary by plan, with Free users typically allowed 30–50 messages per 3 hours and Plus users up to 160 messages per 3 hours, subject to dynamic adjustments based on system load.
Free Plan Limits
Free-tier users generally have a rolling limit of 30–50 messages per 3-hour window, depending on traffic and model availability. During peak hours, this limit may temporarily drop, and once reached, users are blocked from sending additional messages until the window resets. This ensures fair access and prevents system overload.Plus Limits
Plus subscribers enjoy significantly higher limits:
Up to 160 GPT-5.2 messages per 3 hours for Plus/Go users. 
Plus/Business users can send up to 3,000 GPT-5.2 Thinking messages per week when manually selected. 
Plus users also benefit from priority access to newer models and faster response times during high-demand periods. Team and Enterprise Plans
These plans offer customized, higher usage caps designed for collaboration, automation, and large-scale workflows. Limits are rarely a bottleneck unless multiple departments or high-volume processes are running simultaneously. 
makesaasbetter.com
API Usage
For the OpenAI API, limits are measured in tokens and request rates, not messages. Each plan includes a monthly token budget and throughput caps, such as requests per minute. Exceeding these limits triggers temporary rate-limiting. 
Managing Limits
If you hit a limit, you can:
Wait for the rolling window to reset.
Switch to a lighter model or reduce prompt length.
Batch multiple requests into a single prompt to conserve message usage. 
Upgrade to Plus or Business for higher caps and priority access. 
Key Takeaways
ChatGPT limits are dynamic, adjusting based on demand, system load, and model usage. 
1
Free users are best suited for casual or light usage, while Plus and Business plans support consistent, high-volume workflows.
Understanding rolling windows and batching strategies can help avoid hitting limits during intensive sessions.
