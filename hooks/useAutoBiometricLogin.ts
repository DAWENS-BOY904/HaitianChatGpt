// hooks/useAutoBiometricLogin.ts
import { useEffect, useState } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import { getSupabaseClient } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export const useAutoBiometricLogin = () => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [hasPrompted, setHasPrompted] = useState(false);

  useEffect(() => {
    if (!user) return;

    const checkAndPromptBiometric = async () => {
      try {
        // 1. Check if device supports biometrics
        const compatible = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        
        if (!compatible || !enrolled) return;

        // 2. Check if user has a saved passkey
        const supabase = getSupabaseClient();
        const { data: passkey, error } = await supabase
          .from('user_api_keys')
          .select('*')
          .eq('user_id', user.id)
          .eq('key_name', 'passkey')
          .single();

        if (error || !passkey) return;

        // 3. Prompt for biometric authentication
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Log in with Face ID',
          fallbackLabel: 'Use passcode',
          cancelLabel: 'Cancel',
          disableDeviceFallback: false,
        });

        if (!result.success) return;

        // 4. Parse passkey and and validate (optional enhancement)
        const passkeyData = JSON.parse(passkey.key_value);
        
        // 5. Log the user in (update auth context)
        // This would trigger your existing login flow without password
        // You can access the passkeyData.device, passkeyData.platform, etc.
        
      } catch (e) {
        console.log('Auto biometric login error:', e);
      } finally {
        setIsLoading(false);
        setHasPrompted(true);
      }
    };

    checkAndPromptBiometric();
  }, [user]);

  return { isLoading };
};
