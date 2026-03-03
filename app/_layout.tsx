import { Stack } from 'expo-router';
import { AlertProvider, AuthProvider } from '@/template';
import { ThemeProvider } from '../contexts/ThemeContext';
import { ConversationProvider } from '../contexts/ConversationContext';
import { SettingsProvider } from '../contexts/SettingsContext';
import { SocialProvider } from '../contexts/SocialContext';
import { SubscriptionProvider } from '../contexts/SubscriptionContext';
import { GuestLimitsProvider } from '../contexts/GuestLimitsContext';

// Create a helper component
const Compose = ({ providers, children }: { providers: React.ElementType[], children: React.ReactNode }) => {
  return (
    <>
      {providers.reduceRight((acc, Provider) => <Provider>{acc}</Provider>, children)}
    </>
  );
};
export default function RootLayout() {
  const providers = [
    AlertProvider,
    AuthProvider,
    SettingsProvider,
    ThemeProvider,
    SubscriptionProvider,
    GuestLimitsProvider,
    SocialProvider,
    ConversationProvider,
  ];
  
  return (
    <AlertProvider>
      <AuthProvider>
        <SettingsProvider>
          <ThemeProvider>
            <SubscriptionProvider>
              <GuestLimitsProvider>
                <SocialProvider>
                  <ConversationProvider>
                  <Stack screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="index" />
                    <Stack.Screen name="login" />
                    <Stack.Screen name="login-password" />
                    <Stack.Screen name="signup" />
                    <Stack.Screen name="verify-code" />
                    <Stack.Screen name="home" />
                    <Stack.Screen name="settings" />
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
                    <Stack.Screen name="get-project" />
                    <Stack.Screen name="admin-team" />
                    <Stack.Screen name="admin-activity-logs" />
                    <Stack.Screen name="admin-api-keys" />
                    <Stack.Screen name="project-upload" />
                    <Stack.Screen name="billing" />
                    <Stack.Screen name="stripe-checkout" />
                    <Stack.Screen name="coding" />
                    <Stack.Screen name="voice-settings" />
                  </Stack>
                  </ConversationProvider>
                </SocialProvider>
              </GuestLimitsProvider>
            </SubscriptionProvider>
          </ThemeProvider>
        </SettingsProvider>
      </AuthProvider>
    </AlertProvider>
  );
}
