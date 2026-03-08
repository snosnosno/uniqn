/**
 * UNIQN Mobile - App Layout
 * 메인 앱 레이아웃 (인증 후)
 *
 * Stack 네비게이터를 항상 렌더링하여 useAuthGuard의 라우트 전환이
 * 로딩/온보딩 상태와 관계없이 동작하도록 보장.
 * 로딩/온보딩 화면은 Stack 위 오버레이로 표시.
 */

import { useCallback, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { NetworkErrorBoundary, Loading } from '@/components/ui';
import { getLayoutColor } from '@/constants/colors';
import { NotificationPermissionScreen } from '@/components/onboarding';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useNotificationHandler } from '@/hooks/useNotificationHandler';
import { logger } from '@/utils/logger';

export default function AppLayout() {
  const isDark = useThemeStore((s) => s.isDarkMode);
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

  const showLoading = isLoading || isOnboardingLoading;
  const showOnboarding = !showLoading && needsNotificationOnboarding;

  return (
    <NetworkErrorBoundary name="AppLayout">
      <View style={styles.container}>
        {/* Stack을 항상 렌더링하여 네비게이터 가용성 보장 */}
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
            contentStyle: {
              backgroundColor: getLayoutColor(isDark, 'content'),
            },
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="profile-setup"
            options={{
              headerShown: false,
              gestureEnabled: false, // 뒤로가기 제스처 차단
            }}
          />
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
          <Stack.Screen
            name="reviews"
            options={{
              headerShown: false,
            }}
          />
        </Stack>

        {/* 로딩 오버레이: Stack 위에 표시하여 네비게이터 가용성 유지 */}
        {showLoading && (
          <View style={styles.overlay}>
            <Loading variant="layout" />
          </View>
        )}

        {/* 알림 권한 온보딩 오버레이 */}
        {showOnboarding && (
          <View style={styles.overlay}>
            <NotificationPermissionScreen
              onRequestPermission={handleRequestPermission}
              onSkip={handleSkip}
              isLoading={isRequestingPermission}
            />
          </View>
        )}
      </View>
    </NetworkErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
});
