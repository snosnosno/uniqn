/**
 * UNIQN Mobile - Splash Screen
 * 앱 시작 스플래시 화면 (네이티브 스플래시 → 이 화면 → 로그인/메인)
 */

import { useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useAuthStore, selectHasHydrated } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { APP_VERSION } from '@/constants/version';
import { logger } from '@/utils/logger';

const LOGO_SOURCE = require('../assets/1024.png');
const LOGO_SIZE = 160;

const SPINNER_COLOR = {
  light: '#A855F7',
  dark: '#C084FC',
} as const;

export default function SplashScreen() {
  const hasHydrated = useAuthStore(selectHasHydrated);
  const user = useAuthStore((state) => state.user);
  const isDarkMode = useThemeStore((state) => state.isDarkMode);

  useEffect(() => {
    if (!hasHydrated) {
      // Hydration이 5초 안에 완료되지 않으면 로그인 화면으로 폴백
      const fallback = setTimeout(() => {
        logger.warn('Hydration 타임아웃 - 로그인 화면으로 폴백', { component: 'SplashScreen' });
        router.replace('/(auth)/login');
      }, 5000);
      return () => clearTimeout(fallback);
    }

    // 인증 상태에 따라 라우팅
    const timer = setTimeout(() => {
      if (user) {
        // 로그인 상태: 메인 화면으로
        router.replace('/(app)/(tabs)');
      } else {
        // 비로그인 상태: 로그인 화면으로
        router.replace('/(auth)/login');
      }
    }, 500); // 스플래시 최소 표시 시간

    return () => clearTimeout(timer);
  }, [hasHydrated, user]);

  return (
    <View className="flex-1 items-center justify-center bg-surface-dark">
      <View className="items-center">
        <Image
          source={LOGO_SOURCE}
          style={{ width: LOGO_SIZE, height: LOGO_SIZE }}
          contentFit="contain"
        />

        <Text className="mt-5 text-lg font-bold tracking-widest text-primary-400">
          UNIQN
        </Text>
        <Text className="mt-1 text-sm text-gray-500">
          홀덤 스태프 매칭 플랫폼
        </Text>

        <ActivityIndicator
          size="large"
          color={isDarkMode ? SPINNER_COLOR.dark : SPINNER_COLOR.light}
          className="mt-8"
        />
      </View>

      <Text className="absolute bottom-12 text-xs text-gray-600">
        v{APP_VERSION}
      </Text>
    </View>
  );
}
