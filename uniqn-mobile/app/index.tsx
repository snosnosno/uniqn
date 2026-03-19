/**
 * UNIQN Mobile - Splash Screen
 * Root entry splash that forwards to the authenticated or public flow.
 */

import { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { APP_VERSION } from '@/constants/version';
import { getAuthenticatedEntryRoute } from '@/shared/navigation/authRedirect';
import { useAuthStore, selectHasHydrated } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { logger } from '@/utils/logger';

const LOGO_SOURCE = require('../assets/1024.png');
const LOGO_SIZE = 160;
const SPLASH_REDIRECT_DELAY_MS = 500;
const HYDRATION_FALLBACK_DELAY_MS = 5000;

const SPINNER_COLOR = {
  light: '#A855F7',
  dark: '#C084FC',
} as const;

export default function SplashScreen() {
  const hasHydrated = useAuthStore(selectHasHydrated);
  const user = useAuthStore((state) => state.user);
  const profile = useAuthStore((state) => state.profile);
  const isDarkMode = useThemeStore((state) => state.isDarkMode);

  const authenticatedEntryRoute = getAuthenticatedEntryRoute({
    socialProvider: profile?.socialProvider ?? null,
    phoneVerified: profile?.phoneVerified ?? null,
    profileCompleted: profile?.profileCompleted ?? null,
  });

  useEffect(() => {
    if (!hasHydrated) {
      const fallback = setTimeout(() => {
        logger.warn('Hydration timed out, falling back to login', {
          component: 'SplashScreen',
        });
        router.replace('/(auth)/login');
      }, HYDRATION_FALLBACK_DELAY_MS);

      return () => clearTimeout(fallback);
    }

    if (user && !profile) return;

    const timer = setTimeout(() => {
      router.replace(user ? authenticatedEntryRoute : '/(auth)/login');
    }, SPLASH_REDIRECT_DELAY_MS);

    return () => clearTimeout(timer);
  }, [authenticatedEntryRoute, hasHydrated, profile, user]);

  return (
    <View className="flex-1 items-center justify-center bg-surface-dark">
      <View className="items-center">
        <Image
          source={LOGO_SOURCE}
          style={{ width: LOGO_SIZE, height: LOGO_SIZE }}
          contentFit="contain"
        />

        <Text className="mt-5 text-lg font-bold tracking-widest text-primary-400">UNIQN</Text>
        <Text className="mt-1 text-sm text-gray-500">홀덤 스태프 매칭 플랫폼</Text>

        <ActivityIndicator
          size="large"
          color={isDarkMode ? SPINNER_COLOR.dark : SPINNER_COLOR.light}
          className="mt-8"
        />
      </View>

      <Text className="absolute bottom-12 text-xs text-gray-600">v{APP_VERSION}</Text>
    </View>
  );
}
