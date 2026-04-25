import React from 'react';

export function useStripe() {
  return { initPaymentSheet: null as any, presentPaymentSheet: null as any };
}

export function StripeProvider({ children }: { children: React.ReactNode }) {
  return children as React.ReactElement;
}
