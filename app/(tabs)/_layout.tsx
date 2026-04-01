// Powered by OnSpace.AI
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  const tabBarStyle = {
    height: Platform.select({
      ios: insets.bottom + 60,
      android: insets.bottom + 60,
      default: 70,
    }),
    paddingTop: 8,
    paddingBottom: Platform.select({
      ios: insets.bottom + 8,
      android: insets.bottom + 8,
      default: 8,
    }),
    paddingHorizontal: 16,
    backgroundColor: '#0a0a0a',
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
  };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle,
        tabBarActiveTintColor: '#10A37F',
        tabBarInactiveTintColor: '#666',
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Gallery',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="images-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
%o TypeError: Cannot read properties of undefined (reading 'fontSize') The above error occurred in the <ContextNavigator> component. React will try to recreate this component tree from scratch using the error boundary you provided, LogBoxStateSubscription.
2026-04-01 12:27:34
Dismiss
Fix now
Type:
Uncaught Error
File:
app/(tabs)/_layout.tsx(6:2719)
%o

TypeError: Cannot read properties of undefined (reading 'fontSize')

The above error occurred in the <ContextNavigator> component.
 React will try to recreate this component tree from scratch using the error boundary you provided, LogBoxStateSubscription.
     at addLog (node_modules/.pnpm/@expo+metro-runtime@5.0.4_react-native@0.79.3_@babel+core@7.27.4_@types+react@19.0.14_react@19.0.0_/node_modules/@expo/metro-runtime/src/error-overlay/Data/LogBoxData.tsx:185:30)
     at registerError (node_modules/.pnpm/@expo+metro-runtime@5.0.4_react-native@0.79.3_@babel+core@7.27.4_@types+react@19.0.14_react@19.0.0_/node_modules/@expo/metro-runtime/src/error-overlay/LogBox.web.ts:163:20)
     at console.error (node_modules/.pnpm/@expo+metro-runtime@5.0.4_react-native@0.79.3_@babel+core@7.27.4_@types+react@19.0.14_react@19.0.0_/node_modules/@expo/metro-runtime/src/error-overlay/LogBox.web.ts:51:27)
     at <global> (app/(tabs)/_layout.tsx:6:2719)
     at defaultOnCaughtError (node_modules/.pnpm/react-dom@19.0.0_react@19.0.0/node_modules/react-dom/cjs/react-dom-client.development.js:7445:21)
     at logCaughtError (node_modules/.pnpm/react-dom@19.0.0_react@19.0.0/node_modules/react-dom/cjs/react-dom-client.development.js:7484:9)
     at runWithFiberInDEV (node_modules/.pnpm/react-dom@19.0.0_react@19.0.0/node_modules/react-dom/cjs/react-dom-client.development.js:543:16)
     at update.callback (node_modules/.pnpm/react-dom@19.0.0_react@19.0.0/node_modules/react-dom/cjs/react-dom-client.development.js:7531:11)
     at callCallback (node_modules/.pnpm/react-dom@19.0.0_react@19.0.0/node_modules/react-dom/cjs/react-dom-client.development.js:10680:16)
...
