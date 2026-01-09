/**
 * UNIQN Mobile - App Layout
 * 메인 앱 레이아웃 (인증 후)
 */

import { Stack } from 'expo-router';
import { useColorScheme, View, ActivityIndicator } from 'react-native';
import { useAuthStore } from '@/stores/authStore';

export default function AppLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { isLoading, isAuthenticated } = useAuthStore();

  // 인증 가드는 루트 레이아웃(app/_layout.tsx)에서 전역으로 적용됨
  // 여기서는 인증 상태만 확인하여 UI 렌더링 결정

  // 로딩 중이면 로딩 표시
  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-gray-900">
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  // 인증되지 않은 상태면 빈 뷰 (useAuthGuard가 리다이렉트 처리)
  if (!isAuthenticated) {
    return null;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: {
          backgroundColor: isDark ? '#111827' : '#f9fafb',
        },
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="notifications"
        options={{
          presentation: 'card',
          headerShown: true,
          title: '알림',
        }}
      />
      <Stack.Screen name="settings" />
    </Stack>
  );
}
