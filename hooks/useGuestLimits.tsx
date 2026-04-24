import { useContext } from 'react';
import { GuestLimitsContext } from '../contexts/GuestLimitsContext';

export function useGuestLimits() {
  const context = useContext(GuestLimitsContext);
  if (!context) {
    throw new Error('useGuestLimits must be used within GuestLimitsProvider');
  }
  return context;
}
Update hooks/useGuestLimits.tsx and hooks/useSubscription.tsx so that admin emails (berryxoe@gmail.com, newdawens@gmail.com, kontgithub@gmail.com) always return isPro=true, isUnlimited=true, and bypass all message limits across the entire app — not just in home.tsx.
