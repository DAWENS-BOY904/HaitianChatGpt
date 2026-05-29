import { useState, useEffect, useCallback } from 'react';

export type NetworkQuality = 'none' | 'slow' | 'good';

export function useNetworkStatus() {
  const [isConnected, setIsConnected] = useState(true);
  const [quality, setQuality] = useState<NetworkQuality>('good');

  const checkConnection = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const start = Date.now();
      const res = await fetch('https://www.google.com/generate_204', {
        method: 'HEAD',
        cache: 'no-cache',
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const rtt = Date.now() - start;
      if (res.status < 500) {
        setIsConnected(true);
        setQuality(rtt > 2000 ? 'slow' : 'good');
      } else {
        setIsConnected(false);
        setQuality('none');
      }
    } catch {
      setIsConnected(false);
      setQuality('none');
    }
  }, []);

  useEffect(() => {
    checkConnection();
    const interval = setInterval(checkConnection, 8000);
    return () => clearInterval(interval);
  }, [checkConnection]);

  return { isConnected, quality, checkConnection };
}
