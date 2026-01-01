import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Slot, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import 'react-native-reanimated';

import { useAuthStore } from '../stores/auth';

export { ErrorBoundary } from 'expo-router';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 2,
    },
  },
});

function useProtectedRoute() {
  const segments = useSegments();
  const router = useRouter();
  const { isAuthenticated, isLoading, user } = useAuthStore();

  useEffect(() => {
    console.log('[Route] isLoading:', isLoading, 'isAuthenticated:', isAuthenticated, 'user:', user?.role, 'segments:', segments);

    if (isLoading) {
      console.log('[Route] Still loading, skipping redirect');
      return;
    }

    const inAuthGroup = segments[0] === '(auth)';
    const inAppGroup = segments[0] === '(app)';

    console.log('[Route] inAuthGroup:', inAuthGroup, 'inAppGroup:', inAppGroup);

    if (!isAuthenticated && !inAuthGroup) {
      // Redirect to login if not authenticated
      console.log('[Route] Redirecting to login');
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuthGroup) {
      // Redirect to appropriate dashboard based on role
      console.log('[Route] Authenticated, redirecting based on role:', user?.role);
      if (user) {
        switch (user.role) {
          case 'PICKUP_AGENT':
            console.log('[Route] Going to pickup');
            router.replace('/(app)/(pickup)');
            break;
          case 'DELIVERY_AGENT':
            console.log('[Route] Going to delivery');
            router.replace('/(app)/(delivery)');
            break;
          case 'HUB_OPERATOR':
          case 'ADMIN':
            console.log('[Route] Going to hub');
            router.replace('/(app)/(hub)');
            break;
          default:
            console.log('[Route] Going to pickup (default)');
            router.replace('/(app)/(pickup)');
        }
      }
    }
  }, [isAuthenticated, isLoading, segments, user]);
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const loadStoredAuth = useAuthStore((state) => state.loadStoredAuth);

  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  useProtectedRoute();

  if (!loaded) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Slot />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
