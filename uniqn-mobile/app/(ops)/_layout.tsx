/**
 * 라이브 운영(ops) 라우트 그룹 레이아웃.
 * 게이트: authenticated 만 (역할 체크 없음 — 데이터 접근은 RLS 가 owner/workspace 로 통제).
 */
import { Stack, Redirect } from 'expo-router';
import { useAuthStore, selectProfile } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { Loading } from '@/components/ui';
import { getLayoutColor } from '@/constants/colors';

function OpsStack() {
  const isDark = useThemeStore((s) => s.isDarkMode);
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        statusBarStyle: 'auto',
        statusBarBackgroundColor: 'transparent',
        contentStyle: {
          backgroundColor: getLayoutColor(isDark, 'content'),
        },
      }}
    />
  );
}

export default function OpsLayout() {
  const { isLoading, isAuthenticated } = useAuthStore();
  const profile = useAuthStore(selectProfile);

  // 로딩 또는 hydration 타이밍 방어
  if (isLoading || (isAuthenticated && !profile)) {
    return <Loading variant="layout" />;
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return <OpsStack />;
}
