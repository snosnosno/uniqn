import { Redirect, Stack } from 'expo-router';
import { Loading } from '@/components/ui';
import { getLayoutColor } from '@/constants/colors';
import { useAuth } from '@/hooks/useAuth';
import { useThemeStore } from '@/stores/themeStore';

export default function AdminLayout() {
  const isDark = useThemeStore((state) => state.isDarkMode);
  const { isLoading, isAuthenticated, isAdmin } = useAuth();

  if (isLoading) {
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
        contentStyle: {
          backgroundColor: getLayoutColor(isDark, 'content'),
        },
      }}
    />
  );
}
