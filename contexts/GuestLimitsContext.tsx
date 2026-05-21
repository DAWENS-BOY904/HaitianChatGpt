import React, { createContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/template';

const GUEST_MESSAGE_LIMIT = 2;
const GUEST_MESSAGE_KEY = '@guest_message_count';
const GUEST_MESSAGE_DATE_KEY = '@guest_message_date';

interface GuestLimitsContextType {
  messageCount: number;
  canSendMessage: () => boolean;
  incrementMessageCount: () => Promise<void>;
  resetMessageCount: () => Promise<void>;
  remainingMessages: number;
}

export const GuestLimitsContext = createContext<GuestLimitsContextType | undefined>(undefined);

export function GuestLimitsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [messageCount, setMessageCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMessageCount();
  }, []);

  // Reset count when date changes
  useEffect(() => {
    const checkDate = async () => {
      const savedDate = await AsyncStorage.getItem(GUEST_MESSAGE_DATE_KEY);
      const today = new Date().toDateString();
      
      if (savedDate !== today) {
        await resetMessageCount();
        await AsyncStorage.setItem(GUEST_MESSAGE_DATE_KEY, today);
      }
    };

    checkDate();
  }, []);

  const loadMessageCount = async () => {
    try {
      const count = await AsyncStorage.getItem(GUEST_MESSAGE_KEY);
      setMessageCount(count ? parseInt(count) : 0);
    } catch (error) {
      console.error('Failed to load message count:', error);
    } finally {
      setLoading(false);
    }
  };

  const canSendMessage = (): boolean => {
    // Logged-in users have unlimited messages
    if (user) return true;
    
    // Guest users are limited
    return messageCount < GUEST_MESSAGE_LIMIT;
  };

  const incrementMessageCount = async () => {
    if (user) return; // Don't track for logged-in users

    const newCount = messageCount + 1;
    setMessageCount(newCount);
    await AsyncStorage.setItem(GUEST_MESSAGE_KEY, newCount.toString());
  };

  const resetMessageCount = async () => {
    setMessageCount(0);
    await AsyncStorage.setItem(GUEST_MESSAGE_KEY, '0');
  };

  const remainingMessages = user ? Infinity : Math.max(0, GUEST_MESSAGE_LIMIT - messageCount);

  return (
    <GuestLimitsContext.Provider
      value={{
        messageCount,
        canSendMessage,
        incrementMessageCount,
        resetMessageCount,
        remainingMessages,
      }}
    >
      {children}
    </GuestLimitsContext.Provider>
  );
}
