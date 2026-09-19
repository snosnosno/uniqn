/**
 * UNIQN Mobile - Auth Layout
 * 인증 관련 화면 레이아웃
 */

import { Stack } from 'expo-router';
import { useThemeStore } from '@/stores/themeStore';
import { ScreenErrorBoundary } from '@/components/ui';
import { getLayoutColor } from '@/constants/colors';

export default function AuthLayout() {
  const isDark = useThemeStore((s) => s.isDarkMode);

  // 섹션 단위 에러 경계(감사 err-03). 로그인 화면의 렌더 예외가 루트까지 올라가면
  // 사용자는 앱 전체 에러 화면에 갇혀 재로그인 경로 자체를 잃는다.
  return (
    <ScreenErrorBoundary name="AuthLayout">
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'fade',
          statusBarStyle: 'auto',
          statusBarBackgroundColor: 'transparent',
          contentStyle: {
            backgroundColor: getLayoutColor(isDark, 'content'),
          },
        }}
      >
        <Stack.Screen name="login" />
        <Stack.Screen name="signup" />
        <Stack.Screen name="forgot-password" />
        <Stack.Screen name="reset-password" />
      </Stack>
    </ScreenErrorBoundary>
  );
}
