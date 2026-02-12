/**
 * UNIQN Mobile - Admin Layout
 * 관리자 전용 레이아웃 (admin 권한 필요)
 */

import { Stack, Redirect } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useThemeStore } from '@/stores/themeStore';
import { HeaderBackButton } from '@/components/navigation';
import { Loading } from '@/components/ui';
import { getLayoutColor } from '@/constants/colors';

export default function AdminLayout() {
  const isDark = useThemeStore((s) => s.isDarkMode);
  // useAuth()는 profile.role에서 직접 권한을 계산하므로 MMKV rehydration 문제 없음
  const { isLoading, isAuthenticated, isAdmin } = useAuth();

  // 로딩 중
  if (isLoading) {
    return <Loading variant="layout" />;
  }

  // 인증되지 않음 - 로그인 페이지로 리다이렉트
  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  // 관리자 권한 없음 - 홈으로 리다이렉트
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
      <Stack.Screen
        name="index"
        options={{
          title: '관리자 대시보드',
        }}
      />
      <Stack.Screen
        name="users/index"
        options={{
          title: '사용자 관리',
        }}
      />
      <Stack.Screen
        name="users/[id]"
        options={{
          title: '사용자 상세',
        }}
      />
      <Stack.Screen
        name="reports/index"
        options={{
          title: '신고 관리',
        }}
      />
      <Stack.Screen
        name="reports/[id]"
        options={{
          title: '신고 상세',
        }}
      />
      <Stack.Screen
        name="settings"
        options={{
          title: '시스템 설정',
        }}
      />
      <Stack.Screen
        name="inquiries/index"
        options={{
          title: '문의 관리',
        }}
      />
      <Stack.Screen
        name="inquiries/[id]"
        options={{
          title: '문의 상세',
        }}
      />
      <Stack.Screen
        name="tournaments/index"
        options={{
          title: '대회공고 승인',
        }}
      />
    </Stack>
  );
}
