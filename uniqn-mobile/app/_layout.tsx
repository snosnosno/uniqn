import '../global.css';
import { Suspense, lazy, useCallback, useEffect, useRef } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LogBox, View } from 'react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colorScheme as nativeWindColorScheme } from 'nativewind';
import {
  ErrorState,
  Loading,
  ModalManager,
  OfflineBanner,
  ScreenErrorBoundary,
  ToastManager,
} from '@/components/ui';
import { getLayoutColor } from '@/constants/colors';
import { SheetProvider } from '@/components/app/SheetProvider';
import { useAppInitialize } from '@/hooks/useAppInitialize';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { queryClient } from '@/lib/queryClient';
import { initializeRootSentry } from '@/services/observability/rootSentry';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { initializeNetworkState } from '@/services/offline/networkState';
import { logger } from '@/utils/logger';

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN || '';
const SENTRY_ENABLED = !__DEV__ && !!SENTRY_DSN;
const SUPPRESSED_WARNINGS = [
  'props.pointerEvents is deprecated',
  'Image: style.tintColor is deprecated',
  'SafeAreaView has been deprecated',
];
const TOUCH_THROTTLE_MS = 5_000;
const AuthenticatedRuntime = lazy(() => import('@/components/app/AuthenticatedRuntime'));

try {
  initializeRootSentry({
    dsn: SENTRY_DSN,
    enabled: SENTRY_ENABLED,
    environment: process.env.EXPO_PUBLIC_RELEASE_CHANNEL || 'development',
  });
} catch (error) {
  if (__DEV__) {
    logger.warn('[Sentry] initialization failed', { error });
  }
}

if (__DEV__) {
  LogBox.ignoreLogs(SUPPRESSED_WARNINGS);
}

function MainNavigator() {
  const { mode, isDarkMode } = useThemeStore();
  const user = useAuthStore((state) => state.user);
  const isDark = isDarkMode;
  const isAuthenticated = !!user;
  const lastTouchRef = useRef(0);

  const handleTouchActivity = useCallback(() => {
    if (!isAuthenticated) {
      return;
    }

    const now = Date.now();
    if (now - lastTouchRef.current <= TOUCH_THROTTLE_MS) {
      return;
    }

    lastTouchRef.current = now;

    void import('@/services/observability')
      .then(({ recordActivity }) => {
        recordActivity();
      })
      .catch((error) => {
        logger.debug('Failed to load authenticated activity runtime', {
          component: 'RootLayout',
          error: error instanceof Error ? error.message : String(error),
        });
      });
  }, [isAuthenticated]);

  useEffect(() => {
    const effectiveMode = mode === 'system' ? (isDark ? 'dark' : 'light') : mode;
    nativeWindColorScheme.set(effectiveMode);
  }, [isDark, mode]);

  useAuthGuard();

  return (
    <View style={{ flex: 1 }} onTouchStart={handleTouchActivity}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {isAuthenticated ? (
        <Suspense fallback={null}>
          <AuthenticatedRuntime />
        </Suspense>
      ) : null}
      <OfflineBanner variant="banner" />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          contentStyle: {
            backgroundColor: getLayoutColor(isDark, 'content'),
          },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(public)" />
        <Stack.Screen name="(app)" />
        <Stack.Screen name="(admin)" />
        <Stack.Screen name="(employer)" />
        <Stack.Screen name="+not-found" />
      </Stack>
      <ToastManager />
      <ModalManager />
    </View>
  );
}

function AppContent() {
  const { isInitialized, isLoading, error, retry } = useAppInitialize();

  if (isLoading || (!isInitialized && !error)) {
    return <Loading variant="layout" message="앱을 불러오는 중..." />;
  }

  if (error) {
    return (
      <View className="flex-1 bg-white dark:bg-surface-dark">
        <ErrorState error={error} title="앱을 불러올 수 없습니다" onRetry={retry} />
      </View>
    );
  }

  return (
    <ScreenErrorBoundary name="RootLayout">
      <MainNavigator />
    </ScreenErrorBoundary>
  );
}

export default function RootLayout() {
  useEffect(() => {
    const unsubscribe = initializeNetworkState();
    return () => {
      unsubscribe();
    };
  }, []);

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
