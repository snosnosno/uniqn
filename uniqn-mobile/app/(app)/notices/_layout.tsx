/**
 * UNIQN Mobile - 공지사항 레이아웃
 */

import { Stack } from 'expo-router';
import { HeaderBackButton } from '@/components/navigation';
import { useThemeStore } from '@/stores/themeStore';
import { getLayoutColor } from '@/constants/colors';

export default function NoticesLayout() {
  const isDark = useThemeStore((s) => s.isDarkMode);

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: getLayoutColor(isDark, 'header'),
        },
        headerTintColor: getLayoutColor(isDark, 'headerTint'),
        headerTitleStyle: {
          fontWeight: '600',
        },
        headerLeft: () => (
          <HeaderBackButton
            tintColor={getLayoutColor(isDark, 'headerTint')}
            fallbackHref="/(app)/(tabs)"
          />
        ),
        contentStyle: {
          backgroundColor: getLayoutColor(isDark, 'content'),
        },
      }}
    />
  );
}
