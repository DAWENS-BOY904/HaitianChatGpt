import React, { createContext, useState, ReactNode } from 'react';

export interface GuestLimitsContextType {
  messageCount: number;
  incrementCount: () => void;
  resetCount: () => void;
  isLimitReached: boolean;
  // Extended fields used by useGuestLimits / home.tsx
  coins: number;
  isUnlimited: boolean;
  isAdmin: boolean;
  remainingMessages: number;
  canSendMessage: () => boolean;
  canCreateProject: () => boolean;
  canUploadImage: (tier: string) => boolean;
  deductCoins: (amount: number) => Promise<boolean>;
  incrementMessageCount: () => Promise<void>;
  incrementImageUploadCount: () => Promise<void>;
}

const GUEST_MESSAGE_LIMIT = 5;

const defaultContext: GuestLimitsContextType = {
  messageCount: 0,
  incrementCount: () => {},
  resetCount: () => {},
  isLimitReached: false,
  coins: 0,
  isUnlimited: false,
  isAdmin: false,
  remainingMessages: GUEST_MESSAGE_LIMIT,
  canSendMessage: () => true,
  canCreateProject: () => true,
  canUploadImage: () => true,
  deductCoins: async () => true,
  incrementMessageCount: async () => {},
  incrementImageUploadCount: async () => {},
};

export const GuestLimitsContext = createContext<GuestLimitsContextType>(defaultContext);

export function GuestLimitsProvider({ children }: { children: ReactNode }) {
  const [messageCount, setMessageCount] = useState(0);

  const incrementCount = () => setMessageCount((c) => c + 1);
  const resetCount = () => setMessageCount(0);
  const isLimitReached = messageCount >= GUEST_MESSAGE_LIMIT;
  const remainingMessages = Math.max(0, GUEST_MESSAGE_LIMIT - messageCount);

  const value: GuestLimitsContextType = {
    messageCount,
    incrementCount,
    resetCount,
    isLimitReached,
    coins: remainingMessages * 10,
    isUnlimited: false,
    isAdmin: false,
    remainingMessages,
    canSendMessage: () => !isLimitReached,
    canCreateProject: () => true,
    canUploadImage: () => !isLimitReached,
    deductCoins: async (_amount: number) => {
      incrementCount();
      return true;
    },
    incrementMessageCount: async () => {
      incrementCount();
    },
    incrementImageUploadCount: async () => {},
  };

  return (
    <GuestLimitsContext.Provider value={value}>
      {children}
    </GuestLimitsContext.Provider>
  );
}