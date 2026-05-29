// Powered by OnSpace.AI
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Platform, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  // Breakpoints
  const isDesktop = width >= 1024;
  const isTablet = width >= 768 && width < 1024;

  // Fixed width for desktop (centered), full width for tablet/mobile
  const containerWidth = isDesktop ? 1024 : width;

  const tabBarStyle = {
    position: isDesktop ? ('absolute' as const) : undefined,
    width: containerWidth,
    alignSelf: isDesktop ? 'center' as const : undefined,
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
    paddingHorizontal: isDesktop ? 32 : isTablet ? 24 : 16,
    backgroundColor: '#0a0a0a',
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
    // iPad-specific: slightly larger touch targets
    ...(isTablet && {
      height: insets.bottom + 70,
      paddingBottom: insets.bottom + 12,
    }),
  };

  // Adjust icon size for different form factors
  const iconSize = isDesktop ? 26 : isTablet ? 24 : 22;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle,
        tabBarActiveTintColor: '#10A37F',
        tabBarInactiveTintColor: '#666',
        tabBarLabelStyle: {
          fontSize: isDesktop ? 13 : isTablet ? 12.5 : 12,
          fontWeight: '500',
        },
        // iPad/desktop: show labels beside icons instead of below
        tabBarLabelPosition: isTablet || isDesktop ? ('beside-icon' as const) : undefined,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Gallery',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons 
              name={focused ? 'images' : 'images-outline'} 
              size={iconSize} 
              color={color} 
            />
          ),
        }}
      />
    </Tabs>
  );
}
