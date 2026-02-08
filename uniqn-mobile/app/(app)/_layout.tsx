/**
 * UNIQN Mobile - App Layout
 * 메인 앱 레이아웃 (인증 후)
 */

import { useCallback, useEffect } from 'react';
import { Stack } from 'expo-router';
import { useColorScheme, View, ActivityIndicator } from 'react-native';
import { useAuthStore } from '@/stores/authStore';
import { NetworkErrorBoundary } from '@/components/ui';
import { NotificationPermissionScreen } from '@/components/onboarding';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useNotificationHandler } from '@/hooks/useNotificationHandler';
import { logger } from '@/utils/logger';

export default function AppLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { isLoading } = useAuthStore();

  // 온보딩 상태 관리
  const {
    needsNotificationOnboarding,
    completeNotificationOnboarding,
    isLoading: isOnboardingLoading,
  } = useOnboarding();

  // 알림 핸들러 (권한 요청 기능 사용)
  const { requestPermission, isRequestingPermission } = useNotificationHandler({
    autoInitialize: true,
    autoRegisterToken: true,
  });

  // 권한 요청 핸들러
  const handleRequestPermission = useCallback(async () => {
    try {
      const granted = await requestPermission();
      // 권한 허용 여부와 관계없이 온보딩 완료 처리
      completeNotificationOnboarding();
      return granted;
    } catch (error) {
      // 에러 로깅
      logger.error('알림 권한 요청 실패', error as Error, {
        component: 'AppLayout',
        operation: 'handleRequestPermission',
      });
      // 에러 발생 시에도 온보딩 완료 처리 (사용자가 온보딩에 갇히지 않도록)
      completeNotificationOnboarding();
      return false;
    }
  }, [requestPermission, completeNotificationOnboarding]);

  // 나중에 하기 핸들러
  const handleSkip = useCallback(() => {
    completeNotificationOnboarding();
  }, [completeNotificationOnboarding]);

  // 인증 가드는 루트 레이아웃(app/_layout.tsx)에서 전역으로 적용됨
  // 여기서는 인증 상태만 확인하여 UI 렌더링 결정

  // 온보딩 30초 타임아웃 안전장치 (사용자가 온보딩 화면에 갇히지 않도록)
  useEffect(() => {
    if (!needsNotificationOnboarding) return;
    const timeout = setTimeout(() => {
      logger.warn('온보딩 타임아웃 - 강제 완료', { component: 'AppLayout' });
      completeNotificationOnboarding();
    }, 30000);
    return () => clearTimeout(timeout);
  }, [needsNotificationOnboarding, completeNotificationOnboarding]);

  // 로딩 중이면 로딩 표시
  if (isLoading || isOnboardingLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-surface-dark">
        <ActivityIndicator size="large" color="#A855F7" />
      </View>
    );
  }

  // 알림 권한 온보딩 필요 시 온보딩 화면 표시
  if (needsNotificationOnboarding) {
    return (
      <NotificationPermissionScreen
        onRequestPermission={handleRequestPermission}
        onSkip={handleSkip}
        isLoading={isRequestingPermission}
      />
    );
  }

  return (
    <NetworkErrorBoundary name="AppLayout">
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          contentStyle: {
            backgroundColor: isDark ? '#1A1625' : '#f9fafb',
          },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="notifications"
          options={{
            presentation: 'card',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="notices"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="support"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen name="settings" />
      </Stack>
    </NetworkErrorBoundary>
  );
}
