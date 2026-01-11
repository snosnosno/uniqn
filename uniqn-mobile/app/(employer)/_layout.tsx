/**
 * UNIQN Mobile - Employer Layout
 * 구인자 전용 레이아웃 (employer 권한 필요)
 */

import { Stack, Redirect, useRouter, useNavigation } from 'expo-router';
import { useColorScheme, View, ActivityIndicator, Pressable } from 'react-native';
import { useAuthStore, useHasRole } from '@/stores/authStore';
import { ChevronLeftIcon } from '@/components/icons';

/**
 * 커스텀 뒤로가기 버튼 (새로고침해도 작동)
 */
function HeaderBackButton({ tintColor }: { tintColor: string }) {
  const router = useRouter();
  const navigation = useNavigation();

  const handleBack = () => {
    if (navigation.canGoBack()) {
      router.back();
    } else {
      // 히스토리가 없으면 employer 탭으로 이동
      router.replace('/(app)/(tabs)/employer');
    }
  };

  return (
    <Pressable onPress={handleBack} hitSlop={8} className="p-2 -ml-2">
      <ChevronLeftIcon size={24} color={tintColor} />
    </Pressable>
  );
}

export default function EmployerLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { isLoading, isAuthenticated } = useAuthStore();
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
        name="my-postings/[id]/index"
        options={{
          title: '공고 상세',
          headerLeft: () => <HeaderBackButton tintColor={isDark ? '#ffffff' : '#111827'} />,
        }}
      />
      <Stack.Screen
        name="my-postings/[id]/applicants"
        options={{
          title: '지원자 관리',
          headerLeft: () => <HeaderBackButton tintColor={isDark ? '#ffffff' : '#111827'} />,
        }}
      />
      <Stack.Screen
        name="my-postings/[id]/settlements"
        options={{
          title: '스태프 / 정산 관리',
          headerLeft: () => <HeaderBackButton tintColor={isDark ? '#ffffff' : '#111827'} />,
        }}
      />
      <Stack.Screen
        name="my-postings/create"
        options={{
          title: '공고 작성',
          headerLeft: () => <HeaderBackButton tintColor={isDark ? '#ffffff' : '#111827'} />,
        }}
      />
      <Stack.Screen
        name="my-postings/[id]/edit"
        options={{
          title: '공고 수정',
          headerLeft: () => <HeaderBackButton tintColor={isDark ? '#ffffff' : '#111827'} />,
        }}
      />
      <Stack.Screen
        name="my-postings/[id]/cancellation-requests"
        options={{
          title: '취소 요청 관리',
          headerLeft: () => <HeaderBackButton tintColor={isDark ? '#ffffff' : '#111827'} />,
        }}
      />
    </Stack>
  );
}
