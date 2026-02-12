/**
 * UNIQN Mobile - Employer Layout
 * 구인자 전용 레이아웃 (employer 권한 필요)
 */

import { Stack, Redirect } from 'expo-router';
import { useAuthStore, useHasRole, selectProfile } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { HeaderBackButton } from '@/components/navigation';
import { Loading } from '@/components/ui';
import { getLayoutColor } from '@/constants/colors';

export default function EmployerLayout() {
  const isDark = useThemeStore((s) => s.isDarkMode);
  const { isLoading, isAuthenticated } = useAuthStore();
  const profile = useAuthStore(selectProfile);
  const hasEmployerRole = useHasRole('employer');

  // 로딩 중 또는 인증됐지만 프로필 아직 로드 안 됨 (hydration 타이밍 방어)
  if (isLoading || (isAuthenticated && !profile)) {
    return <Loading variant="layout" />;
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
          backgroundColor: getLayoutColor(isDark, 'header'),
        },
        headerTintColor: getLayoutColor(isDark, 'headerTint'),
        headerTitleStyle: {
          fontWeight: '600',
        },
        animation: 'slide_from_right',
        contentStyle: {
          backgroundColor: getLayoutColor(isDark, 'content'),
        },
        headerLeft: () => (
          <HeaderBackButton
            tintColor={getLayoutColor(isDark, 'headerTint')}
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
