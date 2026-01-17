/**
 * UNIQN Mobile - Admin Layout
 * 관리자 전용 레이아웃 (admin 권한 필요)
 */

import { Stack, Redirect } from 'expo-router';
import { useColorScheme, View, ActivityIndicator } from 'react-native';
import { useAuth } from '@/hooks/useAuth';

export default function AdminLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  // useAuth()는 profile.role에서 직접 권한을 계산하므로 MMKV rehydration 문제 없음
  const { isLoading, isAuthenticated, isAdmin } = useAuth();

  // 로딩 중
  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-gray-900">
        <ActivityIndicator size="large" color="#DC2626" />
      </View>
    );
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
