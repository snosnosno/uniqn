/**
 * UNIQN Mobile - Root Layout
 * 앱 전체 레이아웃
 */

import '../global.css';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme, View, ActivityIndicator, Text } from 'react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { queryClient } from '@/lib/queryClient';
import { ToastManager, ModalManager, ErrorState } from '@/components/ui';
import { useAppInitialize } from '@/hooks/useAppInitialize';
import { useAuthGuard } from '@/hooks/useAuthGuard';

function AppContent() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  // isInitialized는 추후 앱 상태 확인에 사용 예정
  const { isInitialized: _isInitialized, isLoading, error, retry } = useAppInitialize();

  // 앱 전역 인증 가드
  useAuthGuard();

  // 초기화 중 로딩 표시
  if (isLoading) {
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
        <Stack.Screen name="+not-found" />
      </Stack>
      <ToastManager />
      <ModalManager />
    </>
  );
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
