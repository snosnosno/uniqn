import '../global.css';
import { Suspense, lazy, useEffect } from 'react';
import { Stack } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { LogBox, Platform, View } from 'react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colorScheme as nativeWindColorScheme, vars } from 'nativewind';
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
import { getLayoutColor, getCssVarTokens } from '@/constants/colors';
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

// 웹 전용: NativeWind Metro 컴파일이 CSS 변수 기반 컬러 룰을 생성하지 않으므로 직접 주입.
// 또한 secondary 팔레트가 서버 캐시로 인해 구 warm gray 값을 가질 수 있어 중립 그레이로 재정의.
// DESIGN.md 색상 토큰과 동기화 유지.
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const styleId = 'uniqn-css-vars';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      /* CSS 변수 — 라이트 모드 */
      :root {
        --color-content-primary:     #09090B;
        --color-content-secondary:   #606068;
        --color-content-muted:       #888890;
        --color-content-placeholder: #A8A8B0;
        --color-surface-page:        #F5F5F2;
        --color-surface-card:        #FFFFFF;
        --color-divider:             #D6D2CA;
      }
      /* CSS 변수 — 다크 모드 */
      .dark {
        --color-content-primary:     #F0F0F2;
        --color-content-secondary:   #C0C0C8;
        --color-content-muted:       #9898A0;
        --color-content-placeholder: #A8A8B0;
        --color-surface-page:        #0B0B0E;
        --color-surface-card:        #141418;
        --color-divider:             #222228;
      }

      /* text-content-* 유틸리티 클래스 (NativeWind가 var() 룰 미생성) */
      .text-content-primary     { color: var(--color-content-primary) !important; }
      .text-content-secondary { color: var(--color-content-secondary) !important; }
      .text-content-muted     { color: var(--color-content-muted) !important; }
      .text-content-placeholder { color: var(--color-content-placeholder) !important; }

      /* secondary 팔레트 재정의 — 뉴트럴 쿨 그레이 (서버 캐시 우선순위 제압) */
      .text-secondary-50  { color: #F5F5F7 !important; }
      .text-secondary-100 { color: #EBEBED !important; }
      .text-secondary-200 { color: #DCDCE0 !important; }
      .text-secondary-300 { color: #C0C0C8 !important; }
      .text-secondary-400 { color: #A8A8B0 !important; }
      .text-secondary-500 { color: #9898A0 !important; }
      .text-secondary-600 { color: #707078 !important; }
      .text-secondary-700 { color: #4A4A52 !important; }
      .text-secondary-800 { color: #2A2A30 !important; }
      .text-secondary-900 { color: #18181E !important; }
      .dark\\:text-secondary-50:is(.dark *)  { color: #F5F5F7 !important; }
      .dark\\:text-secondary-100:is(.dark *) { color: #EBEBED !important; }
      .dark\\:text-secondary-200:is(.dark *) { color: #DCDCE0 !important; }
      .dark\\:text-secondary-300:is(.dark *) { color: #C0C0C8 !important; }
      .dark\\:text-secondary-400:is(.dark *) { color: #A8A8B0 !important; }
      .dark\\:text-secondary-500:is(.dark *) { color: #9898A0 !important; }
      .dark\\:text-secondary-600:is(.dark *) { color: #707078 !important; }
      .dark\\:text-secondary-700:is(.dark *) { color: #4A4A52 !important; }
      .dark\\:text-secondary-800:is(.dark *) { color: #2A2A30 !important; }
      .dark\\:text-secondary-900:is(.dark *) { color: #18181E !important; }

      /* bg-surface-*/border-divider 유틸리티 (NativeWind가 var() 룰 미생성) */
      .bg-surface-page     { background-color: var(--color-surface-page) !important; }
      .bg-surface-card     { background-color: var(--color-surface-card) !important; }
      .border-divider      { border-color: var(--color-divider) !important; }
      .text-divider        { color: var(--color-divider) !important; }

      /* 다크모드 명시 오버라이드 (CSS var 해소 실패 대비) */
      .dark .bg-surface-page, .dark.bg-surface-page { background-color: #0B0B0E !important; }
      .dark .bg-surface-card, .dark.bg-surface-card { background-color: #141418 !important; }
      .dark .border-divider, .dark.border-divider   { border-color: #222228 !important; }

      /* placeholder 색상 (NativeWind가 var() 룰 미생성) */
      .placeholder\\:text-content-placeholder::placeholder { color: var(--color-content-placeholder) !important; }
      input::placeholder, textarea::placeholder           { color: var(--color-content-placeholder); }
    `;
    document.head.appendChild(style);
  }
}

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN || '';
const SENTRY_ENABLED = !__DEV__ && !!SENTRY_DSN;
const SUPPRESSED_WARNINGS = [
  'props.pointerEvents is deprecated',
  'Image: style.tintColor is deprecated',
  'SafeAreaView has been deprecated',
];
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

  const cssVarStyle = Platform.OS !== 'web' ? vars(getCssVarTokens(isDark)) : undefined;

  return (
    <View style={[{ flex: 1 }, cssVarStyle]}>
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
