/**
 * UNIQN Mobile - Employer Layout
 * 구인자 전용 레이아웃 (employer 권한 필요)
 */

import { Stack, Redirect } from 'expo-router';
import { useColorScheme, View, ActivityIndicator, Text } from 'react-native';
import { useAuthStore, useHasRole } from '@/stores/authStore';

export default function EmployerLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { isLoading, isAuthenticated, profile } = useAuthStore();
  const hasEmployerRole = useHasRole('employer');

  // 로딩 중
  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-gray-900">
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  // 인증되지 않음 - 로그인 페이지로 리다이렉트
  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  // 구인자 권한 없음 - 홈으로 리다이렉트
  if (!hasEmployerRole) {
    return <Redirect href="/(app)/(tabs)" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: isDark ? '#111827' : '#ffffff',
        },
        headerTintColor: isDark ? '#ffffff' : '#111827',
        headerTitleStyle: {
          fontWeight: '600',
        },
        animation: 'slide_from_right',
        contentStyle: {
          backgroundColor: isDark ? '#111827' : '#f9fafb',
        },
      }}
    >
      <Stack.Screen
        name="my-postings/index"
        options={{
          title: '내 공고 관리',
        }}
      />
      <Stack.Screen
        name="my-postings/[id]/index"
        options={{
          title: '공고 상세',
        }}
      />
      <Stack.Screen
        name="my-postings/[id]/applicants"
        options={{
          title: '지원자 관리',
        }}
      />
      <Stack.Screen
        name="my-postings/[id]/settlements"
        options={{
          title: '정산 관리',
        }}
      />
    </Stack>
  );
}
