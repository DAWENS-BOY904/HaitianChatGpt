import { useContext } from 'react';
import { SubscriptionContext } from '../contexts/SubscriptionContext';
import { useAuth } from '@/template';

const ADMIN_EMAILS = ['berryxoe@gmail.com', 'newdawens@gmail.com', 'kontgithub@gmail.com'];

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within SubscriptionProvider');
  }
  const { user } = useAuth();
  const isAdminEmail = user?.email ? ADMIN_EMAILS.includes(user.email.toLowerCase()) : false;

  // Admin emails always get pro + unlimited access
  if (isAdminEmail) {
    return {
      ...context,
      tier: 'plus' as const,
      isPro: true,
      canSendMessage: () => true,
      limits: {
        messagesPerDay: 99999,
        canUploadMedia: true,
        canCreateGroups: true,
        maxGroupMembers: 512,
        canUseAdvancedAI: true,
        imageUploadsPerSession: 999,
        fileUploadsPerSession: 999,
      },
      incrementMessageCount: async () => {},
    };
  }

  return context;
}
