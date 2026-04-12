/**
 * UNIQN Mobile - Splash Screen
 * Root entry splash that forwards to the authenticated or login flow.
 */

import { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { APP_VERSION } from '@/constants/version';
import { isPhoneOnlySignupAuthUser } from '@/shared/auth/sessionState';
import {
  AUTH_ENTRY_ROUTES,
  AUTH_LOGIN_ROUTE,
  getAuthenticatedEntryRoute,
} from '@/shared/navigation/authRedirect';
import { selectIsLoading, useAuthStore } from '@/stores/authStore';
import { selectStartupPhase, useAppStartupStore } from '@/stores/appStartupStore';
import { useThemeStore } from '@/stores/themeStore';

const LOGO_SOURCE = require('../assets/1024.png');
const LOGO_SIZE = 160;
const SPLASH_REDIRECT_DELAY_MS = 500;
const PROFILE_RETRY_DELAY_MS = 500;

const SPINNER_COLOR = {
  light: '#D4AF37',
  dark: '#E8C84E',
} as const;

export default function SplashScreen() {
  const startupPhase = useAppStartupStore(selectStartupPhase);
  const user = useAuthStore((state) => state.user);
  const profile = useAuthStore((state) => state.profile);
  const isAuthLoading = useAuthStore(selectIsLoading);
  const checkAuthState = useAuthStore((state) => state.checkAuthState);
  const isDarkMode = useThemeStore((state) => state.isDarkMode);

  const authenticatedEntryRoute = getAuthenticatedEntryRoute({
    socialProvider: profile?.socialProvider ?? null,
    phoneVerified: profile?.phoneVerified ?? null,
    profileCompleted: profile?.profileCompleted ?? null,
  });
  const isPhoneOnlySignupPending = isPhoneOnlySignupAuthUser(user);

  useEffect(() => {
    if (startupPhase !== 'resolved') {
      return;
    }

    if (user && !profile) {
      if (isPhoneOnlySignupPending) {
        const timer = setTimeout(() => {
          router.replace(AUTH_ENTRY_ROUTES.signup);
        }, SPLASH_REDIRECT_DELAY_MS);

        return () => clearTimeout(timer);
      }

      if (!isAuthLoading) {
        const retryTimer = setTimeout(() => {
          void checkAuthState();
        }, PROFILE_RETRY_DELAY_MS);

        return () => clearTimeout(retryTimer);
      }

      return;
    }

    const timer = setTimeout(() => {
      router.replace(user ? authenticatedEntryRoute : AUTH_LOGIN_ROUTE);
    }, SPLASH_REDIRECT_DELAY_MS);

    return () => clearTimeout(timer);
  }, [
    authenticatedEntryRoute,
    checkAuthState,
    isAuthLoading,
    isPhoneOnlySignupPending,
    profile,
    startupPhase,
    user,
  ]);

  return (
    <View className="flex-1 items-center justify-center bg-surface-dark">
      <View className="items-center">
        <Image
          source={LOGO_SOURCE}
          style={{ width: LOGO_SIZE, height: LOGO_SIZE }}
          contentFit="contain"
        />

        <Text className="mt-5 text-lg font-display tracking-widest text-primary-400">UNIQN</Text>
        <Text className="mt-1 text-sm text-secondary-500">홀덤 스태프 매칭 플랫폼</Text>

        <ActivityIndicator
          size="large"
          color={isDarkMode ? SPINNER_COLOR.dark : SPINNER_COLOR.light}
          className="mt-8"
        />
      </View>

      <Text className="absolute bottom-12 text-xs text-secondary-600">v{APP_VERSION}</Text>
    </View>
  );
}
