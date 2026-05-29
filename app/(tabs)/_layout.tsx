import { Tabs } from 'expo-router';
import { Platform, Dimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useSettings } from '@/hooks/useSettings';
import { useState, useEffect } from 'react';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const { settings } = useSettings();

  const [width, setWidth] = useState(Dimensions.get('window').width);
  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => setWidth(window.width));
    return () => sub.remove();
  }, []);

  const isDesktop = width >= 1024;
  const accentColor = settings?.accentColor || '#10A37F';

  const tabBarBg = isDark ? '#0a0a0a' : '#FFFFFF';
  const borderColor = isDark ? '#1a1a1a' : '#E5E5EA';
  const inactiveColor = isDark ? '#666666' : '#999999';

  const tabBarHeight = Platform.select({
    ios: insets.bottom + 56,
    android: insets.bottom + 56,
    default: 64,
  });

  const tabBarPaddingBottom = Platform.select({
    ios: insets.bottom + 4,
    android: insets.bottom + 4,
    default: 8,
  });

  if (isDesktop) {
    return (
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: { display: 'none' },
        }}
      >
        <Tabs.Screen name="index" options={{ title: 'Chat' }} />
      </Tabs>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: accentColor,
        tabBarInactiveTintColor: inactiveColor,
        tabBarStyle: {
          backgroundColor: tabBarBg,
          borderTopWidth: 1,
          borderTopColor: borderColor,
          height: tabBarHeight,
          paddingTop: 6,
          paddingBottom: tabBarPaddingBottom,
          paddingHorizontal: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: isDark ? 0.3 : 0.06,
          shadowRadius: 8,
          elevation: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
          marginTop: 2,
          ...(Platform.OS === 'android' && { includeFontPadding: false }),
        },
        tabBarIconStyle: {
          marginBottom: -2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Chat',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="images-tab"
        options={{
          title: 'Images',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'images' : 'images-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="projects-tab"
        options={{
          title: 'Projects',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'folder' : 'folder-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile-tab"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'person-circle' : 'person-circle-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
