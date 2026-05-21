import { useContext } from 'react';
import { GuestLimitsContext } from '../contexts/GuestLimitsContext';

export function useGuestLimits() {
  const context = useContext(GuestLimitsContext);
  if (!context) {
    throw new Error('useGuestLimits must be used within GuestLimitsProvider');
  }
  return context;
}
