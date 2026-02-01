/**
 * UNIQN Mobile - Splash Screen
 * 앱 시작 스플래시 화면
 */

import { useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore, selectHasHydrated } from '@/stores/authStore';

export default function SplashScreen() {
  const hasHydrated = useAuthStore(selectHasHydrated);
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    // Hydration 완료 대기
    if (!hasHydrated) return;

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
    <View className="flex-1 items-center justify-center bg-gray-50 dark:bg-surface-dark">
      <View className="mb-12 items-center">
        <Text className="text-5xl font-extrabold tracking-wider text-primary-600 dark:text-primary-400">
          UNIQN
        </Text>
        <Text className="mt-2 text-base text-gray-500 dark:text-gray-400">
          홀덤 스태프 매칭 플랫폼
        </Text>
      </View>

      <ActivityIndicator size="large" color="#A855F7" className="my-6" />

      <Text className="absolute bottom-12 text-sm text-gray-400 dark:text-gray-500">v1.0.0</Text>
    </View>
  );
}
