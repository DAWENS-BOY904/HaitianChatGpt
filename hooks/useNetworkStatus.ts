import { useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';

interface NetworkStatus {
  isConnected: boolean;
  isChecking: boolean;
}

export function useNetworkStatus(): NetworkStatus {
  const [isConnected, setIsConnected] = useState(true);
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

    check();
    const interval = setInterval(check, 10000);

    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, []);

  return { isConnected, isChecking };
}
