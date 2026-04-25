import 'expo-standard-web-crypto';
import { Stack } from 'expo-router';
import { AlertProvider, AuthProvider } from '@/template';
import { ThemeProvider } from '../contexts/ThemeContext';
import { ConversationProvider } from '../contexts/ConversationContext';
import { SettingsProvider } from '../contexts/SettingsContext';
import { SocialProvider } from '../contexts/SocialContext';
import { SubscriptionProvider } from '../contexts/SubscriptionContext';
import { GuestLimitsProvider } from '../contexts/GuestLimitsContext';
import { ProfileProvider } from '../contexts/ProfileContext';
import { useEffect } from 'react';
import { Platform } from 'react-native';

// ── Configure RevenueCat once at startup ──
function RevenueCatInit() {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    try {
      // Dynamic require to avoid web/SSR build errors
      const Purchases = require('react-native-purchases').default;
      const iosKey = process.env.EXPO_PUBLIC_RC_IOS_KEY;
      const androidKey = process.env.EXPO_PUBLIC_RC_ANDROID_KEY;
      const apiKey = Platform.OS === 'ios' ? iosKey : androidKey;
      if (apiKey) {
        Purchases.configure({ apiKey });
        console.log('[RevenueCat] Configured successfully');
      }
    } catch (e) {
      // react-native-purchases not linked yet — safe to ignore in dev
      console.log('[RevenueCat] Module not available:', e);
    }
  }, []);
  return null;
}
export default function RootLayout() {
  return (
    <AlertProvider>
      <AuthProvider>
        <SettingsProvider>
          <ThemeProvider>
            <SubscriptionProvider>
              <GuestLimitsProvider>
                <ProfileProvider>
                <SocialProvider>
                  <ConversationProvider>
                    <RevenueCatInit />
                    <Stack screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="index" />
                    <Stack.Screen name="login" />
                    <Stack.Screen name="login-password" />
                    <Stack.Screen name="signup" />
                    <Stack.Screen name="verify-code" />
                    <Stack.Screen name="home" />
                    <Stack.Screen name="settings" options={{ presentation: 'modal', headerShown: false, animation: 'slide_from_bottom' }} />
                    <Stack.Screen name="social" />
                    <Stack.Screen name="chat" />
                    <Stack.Screen name="about" />
                    <Stack.Screen name="subscription" />
                    <Stack.Screen name="admin" />
                    <Stack.Screen name="bugreport" />
                    <Stack.Screen name="data-controls" />
                    <Stack.Screen name="personalization" />
                    <Stack.Screen name="profile" />
                    <Stack.Screen name="create-image" />
                    <Stack.Screen name="think-mode" />
                    <Stack.Screen name="deep-research" />
                    <Stack.Screen name="web-search" />
                    <Stack.Screen name="privacy-policy" />
                    <Stack.Screen name="terms-of-use" />
                    <Stack.Screen name="study-learn" />
                    <Stack.Screen name="languages" />
                    <Stack.Screen name="payment" />
                    <Stack.Screen name="groupinfo" />
                    <Stack.Screen name="notifications" />
                    <Stack.Screen name="notification-detail" />
                    <Stack.Screen name="parental-controls" />
                    <Stack.Screen name="checkout" />
                    <Stack.Screen name="family-member" />
                    <Stack.Screen name="orders" />  
                    <Stack.Screen name="archived-chats" />
                    <Stack.Screen name="new-project" />
                    <Stack.Screen name="model-selector" />
                    <Stack.Screen name="gpts" />
                    <Stack.Screen name="security" />
                    <Stack.Screen name="admin-email" />
                    <Stack.Screen name="message-detail" />
                    <Stack.Screen name="conversation-viewer" />
                    <Stack.Screen name="voice-control" />
                    <Stack.Screen name="upload-manager" />
                    <Stack.Screen name="camera" />
                    <Stack.Screen name="preview" />
                    <Stack.Screen name="admin-revenue" />
                    <Stack.Screen name="admin-payout" />
                    <Stack.Screen name="admin-content" />
                    <Stack.Screen name="content-viewer" />
                    <Stack.Screen name="images" />
                    <Stack.Screen name="image-prompt" />
                    <Stack.Screen name="image-viewer" />
                    <Stack.Screen name="share-chat" />
                    <Stack.Screen name="admin-verify" />
                    <Stack.Screen name="project-get" />
                    <Stack.Screen name="admin-team" />
                    <Stack.Screen name="admin-activity-logs" />
                    <Stack.Screen name="admin-api-keys" />
                    <Stack.Screen name="project-upload" />
                    <Stack.Screen name="billing" />
                    <Stack.Screen name="stripe-checkout" />
                    <Stack.Screen name="buy-coins" />
                    <Stack.Screen name="coding" />
                    <Stack.Screen name="voice-settings" />
                    <Stack.Screen name="check-subscription" />
                    <Stack.Screen name="revenuecat-setup" />
                    <Stack.Screen name="authenticator-app" />
                    <Stack.Screen name="mfa-totp-setup" />
                    <Stack.Screen name="text-messages-mfa" />
                    <Stack.Screen name="passkeys" />
                    <Stack.Screen name="ads-controls" />
                    <Stack.Screen name="ad-history" />
                    <Stack.Screen name="ad-interests" />
                    <Stack.Screen name="ads-off" />
                    <Stack.Screen name="AppleGenerateJWTkey" />
                    <Stack.Screen name="subscription-success" />
                    </Stack>
                  </ConversationProvider>
                </SocialProvider>
                </ProfileProvider>
              </GuestLimitsProvider>
            </SubscriptionProvider>
          </ThemeProvider>
        </SettingsProvider>
      </AuthProvider>
    </AlertProvider>
  );
}
