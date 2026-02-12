/**
 * UNIQN Mobile - Auth Layout
 * 인증 관련 화면 레이아웃
 */

import { Stack } from 'expo-router';
import { useThemeStore } from '@/stores/themeStore';
import { getLayoutColor } from '@/constants/colors';

export default function AuthLayout() {
  const isDark = useThemeStore((s) => s.isDarkMode);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        contentStyle: {
          backgroundColor: getLayoutColor(isDark, 'header'),
        },
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="forgot-password" />
    </Stack>
  );
}
