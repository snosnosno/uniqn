import '../global.css';
import { Suspense, lazy, useCallback, useEffect, useRef } from 'react';
import { Stack } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { LogBox, Platform, View } from 'react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colorScheme as nativeWindColorScheme } from 'nativewind';
import { useFonts } from 'expo-font';
import { Outfit_600SemiBold, Outfit_700Bold, Outfit_800ExtraBold } from '@expo-google-fonts/outfit';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import * as SplashScreen from 'expo-splash-screen';
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
import { useAndroidOrientationPolicy } from '@/hooks/useAndroidOrientationPolicy';
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

// 폰트 로드 전까지 스플래시 화면 유지
SplashScreen.preventAutoHideAsync().catch(() => {
  // 이미 호출된 경우 무시
});

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

  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }

    setStatusBarStyle(isDark ? 'light' : 'dark', false);
  }, [isDark]);

  useAuthGuard();

  return (
    <View style={{ flex: 1 }} onTouchStart={handleTouchActivity}>
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
  useAndroidOrientationPolicy();

  const [fontsLoaded, fontError] = useFonts({
    Outfit_600SemiBold,
    Outfit_700Bold,
    Outfit_800ExtraBold,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });

  useEffect(() => {
    const unsubscribe = initializeNetworkState();
    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {
        // 이미 숨겨진 경우 무시
      });
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

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
