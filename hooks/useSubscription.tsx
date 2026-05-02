import { useContext } from 'react';
import { SubscriptionContext } from '../contexts/SubscriptionContext';
import { useAuth } from '@/template';

const ADMIN_EMAILS = ['berryxoe@gmail.com', 'kontgithub@gmail.com'];
const GEN_PLUS_EMAILS = ['newdawens@gmail.com'];

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within SubscriptionProvider');
  }
  const { user } = useAuth();
  const email = user?.email?.toLowerCase() ?? null;

  const isAdminEmail = email ? ADMIN_EMAILS.includes(email) : false;
  const isGenPlusEmail = email ? GEN_PLUS_EMAILS.includes(email) : false;

  // Gen Plus email gets plus tier with Gen Plus limits
  if (isGenPlusEmail) {
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

  // Admin emails always get pro + unlimited access
  if (isAdminEmail) {
    return {
      ...context,
      tier: 'pro' as const,
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
