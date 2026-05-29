import { useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';

export type NetworkQuality = 'none' | 'slow' | 'good';

interface NetworkStatus {
  isConnected: boolean;
  quality: NetworkQuality;
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
      
      const startTime = Date.now();
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const res = await fetch('https://www.google.com/generate_204', {
          method: 'HEAD',
          cache: 'no-cache',
          signal: controller.signal,
        });
        clearTimeout(timeout);
        
        const latency = Date.now() - startTime;
        
        if (mountedRef.current) {
          setIsConnected(res.status < 500);
          // Determine quality based on latency
          setQuality(latency > 2000 ? 'slow' : 'good');
        }
      } catch {
        if (mountedRef.current) {
          setIsConnected(false);
          setQuality('none');
        }
      } finally {
        if (mountedRef.current) setIsChecking(false);
      }
    };

    // Only add web event listeners on web platform
    if (Platform.OS === 'web') {
      const handleOnline = () => {
        setIsConnected(true);
        // Don't assume quality, let next check determine it
      };
      const handleOffline = () => {
        setIsConnected(false);
        setQuality('none');
      };

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      check();
      const interval = setInterval(check, 10000);

      return () => {
        mountedRef.current = false;
        clearInterval(interval);
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }

    // For native platforms, just use polling
    check();
    const interval = setInterval(check, 10000);

    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, []);

  return { isConnected, quality, isChecking };
}
