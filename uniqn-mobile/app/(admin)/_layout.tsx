import { Redirect, Stack } from 'expo-router';
import { Loading } from '@/components/ui';
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
    return <Redirect href="/(app)/(tabs)" />;
  }

  return (
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
  );
}
