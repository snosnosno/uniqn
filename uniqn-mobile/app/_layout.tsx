/**
 * UNIQN Mobile - Root Layout
 * 앱 전체 레이아웃
 */

import '../global.css';
import { useEffect, useRef, type ReactNode } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, Text, LogBox } from 'react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { colorScheme as nativeWindColorScheme } from 'nativewind';
import { queryClient } from '@/lib/queryClient';
import { isWeb } from '@/utils/platform';
import {
  ToastManager,
  ModalManager,
  ErrorState,
  ScreenErrorBoundary,
  InAppMessageManager,
  OfflineBanner,
} from '@/components/ui';
import { useAppInitialize } from '@/hooks/useAppInitialize';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { useNavigationTracking } from '@/hooks/useNavigationTracking';
import { useNotificationHandler } from '@/hooks/useNotificationHandler';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useThemeStore } from '@/stores/themeStore';
import { RealtimeManager } from '@/shared/realtime/RealtimeManager';
import * as tokenRefreshService from '@/services/tokenRefreshService';
import { logger } from '@/utils/logger';

// LogBox 경고 억제 (써드파티 라이브러리 이슈)
if (__DEV__) {
  LogBox.ignoreLogs([
    'props.pointerEvents is deprecated', // expo-router 내부 이슈
    'Image: style.tintColor is deprecated', // react-navigation 내부 이슈
    'SafeAreaView has been deprecated', // react-native-calendars 등 써드파티 이슈 (RN 0.81.5+)
  ]);
}

/**
 * 메인 네비게이션 컴포넌트
 * 초기화 완료 후 렌더링되므로 useAuthGuard 안전하게 호출 가능
 */
function MainNavigator() {
  const { mode, isDarkMode } = useThemeStore();
  const isDark = isDarkMode;

  // 마운트 시 NativeWind colorScheme 확실히 적용
  // (themeStore hydration 타이밍 이슈 해결)
  useEffect(() => {
    const effectiveMode = mode === 'system' ? (isDark ? 'dark' : 'light') : mode;
    nativeWindColorScheme.set(effectiveMode);
  }, [mode, isDark]);

  // 앱 전역 인증 가드 - 초기화 완료 후에만 실행됨
  useAuthGuard();

  // 화면 전환 추적 (Analytics + Crashlytics)
  useNavigationTracking();

  // 푸시 알림 수신 및 딥링크 처리
  useNotificationHandler();

  // 전역 네트워크 상태 연동
  const { isOnline } = useNetworkStatus();
  const prevOnlineRef = useRef(isOnline);

  useEffect(() => {
    const wasOnline = prevOnlineRef.current;
    prevOnlineRef.current = isOnline;

    if (!wasOnline && isOnline) {
      // 오프라인 → 온라인: 재연결 처리
      logger.info('네트워크 복귀 - 전역 재연결 처리');
      RealtimeManager.onNetworkReconnect();
      tokenRefreshService.onNetworkReconnect();
    } else if (wasOnline && !isOnline) {
      // 온라인 → 오프라인: 연결 끊김 처리
      logger.info('네트워크 끊김 - 전역 연결 해제 처리');
      RealtimeManager.onNetworkDisconnect();
    }
  }, [isOnline]);

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <OfflineBanner variant="banner" />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          contentStyle: {
            backgroundColor: isDark ? '#1A1625' : '#f9fafb',
          },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
        <Stack.Screen name="(admin)" />
        <Stack.Screen name="(employer)" />
        <Stack.Screen name="+not-found" />
      </Stack>
      <InAppMessageManager />
      <ToastManager />
      <ModalManager />
    </>
  );
}

/**
 * 앱 콘텐츠 컴포넌트
 * 초기화 상태에 따라 로딩/에러/메인 화면 표시
 */
function AppContent() {
  const { isInitialized, isLoading, error, retry } = useAppInitialize();

  // 초기화 중 로딩 표시
  if (isLoading || !isInitialized) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-surface-dark">
        <ActivityIndicator size="large" color="#A855F7" />
        <Text className="mt-4 text-gray-600 dark:text-gray-400">앱 로딩 중...</Text>
      </View>
    );
  }

  // 초기화 실패 시 에러 표시
  if (error) {
    return (
      <View className="flex-1 bg-white dark:bg-surface-dark">
        <ErrorState error={error} title="앱을 불러올 수 없습니다" onRetry={retry} />
      </View>
    );
  }

  // 초기화 완료 후 메인 네비게이터 렌더링 (전역 에러 바운더리 적용)
  return (
    <ScreenErrorBoundary name="RootLayout">
      <MainNavigator />
    </ScreenErrorBoundary>
  );
}

/**
 * 웹용 빈 Provider (BottomSheetModalProvider 대체)
 */
function WebSheetProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

// 플랫폼별 Provider 선택
const SheetProvider = isWeb ? WebSheetProvider : BottomSheetModalProvider;

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <SheetProvider>
            <AppContent />
          </SheetProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
