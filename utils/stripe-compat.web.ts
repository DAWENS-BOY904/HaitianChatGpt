import React from 'react';

export function useStripe() {
  return { initPaymentSheet: null as any, presentPaymentSheet: null as any, confirmPayment: null as any };
}

export function useApplePay() {
  return { presentApplePay: null as any, confirmApplePayPayment: null as any, isApplePaySupported: false };
}

export function useGooglePay() {
  return { presentGooglePay: null as any, isGooglePaySupported: async () => false };
}

export function StripeProvider({ children }: { children: React.ReactNode }) {
  return children as React.ReactElement;
}

export function CardField(_props: any) {
  return null;
}
