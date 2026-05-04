// @ts-nocheck
import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useAuth } from './hook';

const DefaultLoadingScreen = () => (
  <View style={styles.defaultContainer}>
    <Text style={styles.defaultText}>Loading...</Text>
  </View>
);

interface AuthRouterProps {
  children: React.ReactNode;
  loginRoute?: string;
  loadingComponent?: React.ComponentType;
  excludeRoutes?: string[];
  guestRoutes?: string[];
}

export function AuthRouter({
  children,
  loginRoute = '/login',
  loadingComponent: LoadingComponent = DefaultLoadingScreen,
  excludeRoutes = [],
  guestRoutes = [],
}: AuthRouterProps) {
  const { user, loading, initialized } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const matchesRoute = (route: string, path: string) => {
    if (route === '/') {
      return path === '/' || path === '';
    }
    return path === route || path === `${route}/index` || path.startsWith(`${route}/`);
  };

  useEffect(() => {
    if (!initialized || loading) {
      return;
    }

    const isLoginRoute = matchesRoute(loginRoute, pathname);
    const isExcludedRoute = excludeRoutes.some(route => 
      matchesRoute(route, pathname)
    );
    const isGuestRoute = guestRoutes.some(route => 
      matchesRoute(route, pathname)
    );

    const action = !user && !isLoginRoute && !isExcludedRoute && !isGuestRoute ? 'redirect_to_login' :
                   user && isLoginRoute ? 'redirect_to_home' :
                   user && isGuestRoute && pathname === '/' ? 'redirect_to_home' :
                   'no_action';

    if (action === 'redirect_to_login') {
      router.push(loginRoute);
    } else if (action === 'redirect_to_home') {
      router.replace('/home');
    }
  }, [user?.id, loading, initialized, pathname, loginRoute, excludeRoutes, guestRoutes, router]);

  if (loading || !initialized) {
    return <LoadingComponent />;
  }

  const matchesRoute = (route: string, path: string) => {
    if (route === '/') {
      return path === '/' || path === '';
    }
    return path === route || path === `${route}/index` || path.startsWith(`${route}/`);
  };

  const isLoginRoute = matchesRoute(loginRoute, pathname);
  const isExcludedRoute = excludeRoutes.some(route => 
    matchesRoute(route, pathname)
  );
  const isGuestRoute = guestRoutes.some(route =>
    matchesRoute(route, pathname)
  );
  
  if (isLoginRoute || isExcludedRoute || isGuestRoute || user) {
    return <>{children}</>;
  }

  return <LoadingComponent />;
}

const styles = StyleSheet.create({
  defaultContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  defaultText: {
    fontSize: 18,
    color: '#6B7280',
  },
});