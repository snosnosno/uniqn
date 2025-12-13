/**
 * UNIQN Mobile - Splash Screen
 * 앱 시작 스플래시 화면
 */

import { useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';

export default function SplashScreen() {
  useEffect(() => {
    // 초기 로딩 후 인증 상태에 따라 라우팅
    // TODO: Firebase Auth 상태 확인 후 적절한 화면으로 이동
    const timer = setTimeout(() => {
      // 임시로 로그인 화면으로 이동
      router.replace('/(auth)/login');
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View className="flex-1 items-center justify-center bg-gray-50 dark:bg-gray-900">
      <View className="mb-12 items-center">
        <Text className="text-5xl font-extrabold tracking-wider text-primary-600 dark:text-primary-400">
          UNIQN
        </Text>
        <Text className="mt-2 text-base text-gray-500 dark:text-gray-400">
          홀덤 스태프 매칭 플랫폼
        </Text>
      </View>

      <ActivityIndicator size="large" color="#3b82f6" className="my-6" />

      <Text className="absolute bottom-12 text-sm text-gray-400 dark:text-gray-500">v1.0.0</Text>
    </View>
  );
}
