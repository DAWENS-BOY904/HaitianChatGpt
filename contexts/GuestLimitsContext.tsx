import React, { createContext, useContext, useState, ReactNode } from 'react';

interface GuestLimitsContextType {
  messageCount: number;
  incrementCount: () => void;
  resetCount: () => void;
  isLimitReached: boolean;
}

const GuestLimitsContext = createContext<GuestLimitsContextType>({
  messageCount: 0,
  incrementCount: () => {},
  resetCount: () => {},
  isLimitReached: false,
});

const GUEST_MESSAGE_LIMIT = 5;

export function GuestLimitsProvider({ children }: { children: ReactNode }) {
  const [messageCount, setMessageCount] = useState(0);

  const incrementCount = () => setMessageCount((c) => c + 1);
  const resetCount = () => setMessageCount(0);
  const isLimitReached = messageCount >= GUEST_MESSAGE_LIMIT;

  return (
    <GuestLimitsContext.Provider value={{ messageCount, incrementCount, resetCount, isLimitReached }}>
      {children}
    </GuestLimitsContext.Provider>
  );
}

export function useGuestLimits() {
  return useContext(GuestLimitsContext);
}
