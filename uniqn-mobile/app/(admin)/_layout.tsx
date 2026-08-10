import { Redirect, Stack } from 'expo-router';
import { Loading, ScreenErrorBoundary } from '@/components/ui';
import { getLayoutColor } from '@/constants/colors';
import { useAuth } from '@/hooks/useAuth';
import { selectProfile, useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';

export default function AdminLayout() {
  const isDark = useThemeStore((state) => state.isDarkMode);
  const { isLoading, isAuthenticated, isAdmin } = useAuth();
  const profile = useAuthStore(selectProfile);

  // 로딩 중 또는 인증됐지만 프로필 아직 로드 안 됨 (hydration 타이밍 방어)
  if (isLoading || (isAuthenticated && !profile)) {
    return <Loading variant="layout" />;
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  if (!isAdmin) {
    return <Redirect href="/(app)/(tabs)/home-jobs" />;
  }

  // 섹션 단위 에러 경계(감사 err-03) — 이게 없으면 관리자 화면의 렌더 예외가
  // 루트 경계까지 올라가 앱 전체가 에러 화면으로 바뀐다. 여기서 잡으면 이 그룹만 끊긴다.
  return (
    <ScreenErrorBoundary name="AdminLayout">
      <Stack
        screenOptions={{
          headerShown: false,
          statusBarStyle: 'auto',
          statusBarBackgroundColor: 'transparent',
          contentStyle: {
            backgroundColor: getLayoutColor(isDark, 'content'),
          },
        }}
      />
    </ScreenErrorBoundary>
  );
}
