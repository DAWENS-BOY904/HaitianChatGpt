import { useContext } from 'react';
import { GuestLimitsContext } from '../contexts/GuestLimitsContext';
import { useAuth } from '@/template';

const ADMIN_EMAILS = ['berryxoe@gmail.com', 'newdawens@gmail.com', 'kontgithub@gmail.com'];

export function useGuestLimits() {
  const context = useContext(GuestLimitsContext);
  if (!context) {
    throw new Error('useGuestLimits must be used within GuestLimitsProvider');
  }
  const { user } = useAuth();
  const isAdminEmail = user?.email ? ADMIN_EMAILS.includes(user.email.toLowerCase()) : false;

  // Admin emails always bypass all limits
  if (isAdminEmail) {
    return {
      ...context,
      isAdmin: true,
      isUnlimited: true,
      coins: 999999,
      remainingMessages: Infinity,
      canSendMessage: () => true,
      canCreateProject: () => true,
      canUploadImage: (_tier: string) => true,
      deductCoins: async (_amount: number) => true,
      incrementMessageCount: async () => {},
      incrementImageUploadCount: async () => {},
    };
  }

  return context;
}
