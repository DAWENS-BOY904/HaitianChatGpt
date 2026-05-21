// Web stub — stripe-react-native is not available on web
import React from 'react';
import { View } from 'react-native';

export function useStripe() {
  return { confirmPayment: null };
}

export function useApplePay() {
  return { presentApplePay: null, confirmApplePayPayment: null };
}

export function useGooglePay() {
  return {
    presentGooglePay: null,
    isGooglePaySupported: async () => false,
  };
}

export function StripeProvider({ children }: { children: React.ReactNode }) {
  return children as React.ReactElement;
}

export const CardField: React.FC<any> | null = null;
