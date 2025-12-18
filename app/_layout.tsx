import { Stack } from 'expo-router';
import { AlertProvider, AuthProvider } from '@/template';
import { ThemeProvider } from '../contexts/ThemeContext';
import { ConversationProvider } from '../contexts/ConversationContext';
import { SettingsProvider } from '../contexts/SettingsContext';
import { SocialProvider } from '../contexts/SocialContext';
import { SubscriptionProvider } from '../contexts/SubscriptionContext';

export default function RootLayout() {
  return (
    <AlertProvider>
      <AuthProvider>
        <ThemeProvider>
          <SettingsProvider>
            <SubscriptionProvider>
              <SocialProvider>
                <ConversationProvider>
                  <Stack screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="index" />
                    <Stack.Screen name="login" />
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
                    <Stack.Screen name="admin-revenue" />
                    <Stack.Screen name="admin-payout" />
                    <Stack.Screen name="admin-content" />
                    <Stack.Screen name="content-viewer" />
                  </Stack>
                </ConversationProvider>
              </SocialProvider>
            </SubscriptionProvider>
          </SettingsProvider>
        </ThemeProvider>
      </AuthProvider>
    </AlertProvider>
  );
}
