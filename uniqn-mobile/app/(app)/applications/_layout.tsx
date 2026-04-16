/**
 * UNIQN Mobile - Applications Layout
 * 지원 관련 화면 레이아웃
 */

import { Stack } from 'expo-router';
import { useThemeStore } from '@/stores/themeStore';
import { getLayoutColor } from '@/constants/colors';

export default function ApplicationsLayout() {
  const isDark = useThemeStore((s) => s.isDarkMode);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: {
          backgroundColor: getLayoutColor(isDark, 'content'),
        },
      }}
    />
  );
}
