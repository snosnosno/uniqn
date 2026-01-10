/**
 * UNIQN Mobile - Root Layout
 * 앱 전체 레이아웃
 */

import '../global.css';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, Text, LogBox } from 'react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { queryClient } from '@/lib/queryClient';
import { ToastManager, ModalManager, ErrorState } from '@/components/ui';
import { useAppInitialize } from '@/hooks/useAppInitialize';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { useNavigationTracking } from '@/hooks/useNavigationTracking';
import { useNotificationHandler } from '@/hooks/useNotificationHandler';
import { useThemeStore } from '@/stores/themeStore';

// LogBox 경고 억제 (써드파티 라이브러리 이슈)
if (__DEV__) {
  LogBox.ignoreLogs([
    'props.pointerEvents is deprecated', // expo-router 내부 이슈
  ]);
}

/**
 * 메인 네비게이션 컴포넌트
 * 초기화 완료 후 렌더링되므로 useAuthGuard 안전하게 호출 가능
 */
function MainNavigator() {
  const { isDarkMode } = useThemeStore();
  const isDark = isDarkMode;

  // 앱 전역 인증 가드 - 초기화 완료 후에만 실행됨
  useAuthGuard();

  // 화면 전환 추적 (Analytics + Crashlytics)
  useNavigationTracking();

  // 푸시 알림 수신 및 딥링크 처리
  useNotificationHandler();

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          contentStyle: {
            backgroundColor: isDark ? '#111827' : '#f9fafb',
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
      <View className="flex-1 items-center justify-center bg-white dark:bg-gray-900">
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text className="mt-4 text-gray-600 dark:text-gray-400">앱 로딩 중...</Text>
      </View>
    );
  }

  // 초기화 실패 시 에러 표시
  if (error) {
    return (
      <View className="flex-1 bg-white dark:bg-gray-900">
        <ErrorState
          error={error}
          title="앱을 불러올 수 없습니다"
          onRetry={retry}
        />
      </View>
    );
  }

  // 초기화 완료 후 메인 네비게이터 렌더링
  return <MainNavigator />;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AppContent />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
