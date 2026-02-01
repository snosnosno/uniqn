/**
 * UNIQN Mobile - Employer Layout
 * 구인자 전용 레이아웃 (employer 권한 필요)
 */

import { Stack, Redirect } from 'expo-router';
import { useColorScheme, View, ActivityIndicator } from 'react-native';
import { useAuthStore, useHasRole } from '@/stores/authStore';
import { HeaderBackButton } from '@/components/navigation';

export default function EmployerLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { isLoading, isAuthenticated } = useAuthStore();
  const hasEmployerRole = useHasRole('employer');

  // 로딩 중
  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-surface-dark">
        <ActivityIndicator size="large" color="#A855F7" />
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
          backgroundColor: isDark ? '#1A1625' : '#ffffff',
        },
        headerTintColor: isDark ? '#ffffff' : '#1A1625',
        headerTitleStyle: {
          fontWeight: '600',
        },
        animation: 'slide_from_right',
        contentStyle: {
          backgroundColor: isDark ? '#1A1625' : '#f9fafb',
        },
        headerLeft: () => (
          <HeaderBackButton
            tintColor={isDark ? '#ffffff' : '#1A1625'}
            fallbackHref="/(app)/(tabs)/employer"
          />
        ),
      }}
    >
      <Stack.Screen
        name="my-postings/index"
        options={{
          title: '내 공고 관리',
        }}
      />
      <Stack.Screen
        name="my-postings/create"
        options={{
          title: '공고 작성',
        }}
      />
      <Stack.Screen
        name="my-postings/[id]"
        options={{
          headerShown: false,
        }}
      />
    </Stack>
  );
}
