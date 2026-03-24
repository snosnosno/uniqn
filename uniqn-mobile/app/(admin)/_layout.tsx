import { Redirect, Stack } from 'expo-router';
import { HeaderBackButton } from '@/components/navigation';
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
        headerShown: true,
        headerStyle: {
          backgroundColor: getLayoutColor(isDark, 'header'),
        },
        headerTintColor: getLayoutColor(isDark, 'headerTint'),
        headerTitleStyle: {
          fontWeight: '600',
        },
        headerLeft: () => (
          <HeaderBackButton
            tintColor={getLayoutColor(isDark, 'headerTint')}
            fallbackHref="/(app)/(tabs)"
          />
        ),
        animation: 'slide_from_right',
        contentStyle: {
          backgroundColor: getLayoutColor(isDark, 'content'),
        },
      }}
    >
      <Stack.Screen name="index" options={{ title: '관리자 대시보드' }} />
      <Stack.Screen name="stats/index" options={{ title: '서비스 통계' }} />
      <Stack.Screen name="users/index" options={{ title: '사용자 관리' }} />
      <Stack.Screen name="users/[id]" options={{ title: '사용자 상세' }} />
      <Stack.Screen name="reports/index" options={{ title: '신고 관리' }} />
      <Stack.Screen name="reports/[id]" options={{ title: '신고 상세' }} />
      <Stack.Screen name="inquiries/index" options={{ title: '문의 관리' }} />
      <Stack.Screen name="inquiries/[id]" options={{ title: '문의 상세' }} />
      <Stack.Screen name="announcements/index" options={{ title: '공지사항 관리' }} />
      <Stack.Screen name="announcements/create" options={{ title: '공지사항 작성' }} />
      <Stack.Screen name="announcements/[id]/index" options={{ title: '공지사항 상세' }} />
      <Stack.Screen name="announcements/[id]/edit" options={{ title: '공지사항 수정' }} />
      <Stack.Screen name="tournaments/index" options={{ title: '대회공고 승인' }} />
    </Stack>
  );
}
