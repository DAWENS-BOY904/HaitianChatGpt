import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';

export type NetworkQuality = 'none' | 'slow' | 'good';

interface NetworkStatus {
  isConnected: boolean;
  isChecking: boolean;
}

export function useNetworkStatus(): NetworkStatus {
  const [isConnected, setIsConnected] = useState(true);
  const [quality, setQuality] = useState<NetworkQuality>('good');
  const [isChecking, setIsChecking] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    const check = async () => {
      if (!mountedRef.current) return;
      setIsChecking(true);
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const res = await fetch('https://www.google.com/generate_204', {
          method: 'HEAD',
          cache: 'no-cache',
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (mountedRef.current) setIsConnected(res.status < 500);
      } catch {
        if (mountedRef.current) setIsConnected(false);
      } finally {
        if (mountedRef.current) setIsChecking(false);
      }
    };

    // Add inside useEffect, before the interval:
const handleOnline = () => setIsConnected(true);
const handleOffline = () => {
  setIsConnected(false);
  setQuality('none');
};

window.addEventListener('online', handleOnline);
window.addEventListener('offline', handleOffline);

// In cleanup:
window.removeEventListener('online', handleOnline);
window.removeEventListener('offline', handleOffline);

    check();
    const interval = setInterval(check, 10000);

    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, []);

  return { isConnected, quality, isChecking };
}
