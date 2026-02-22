/**
 * UNIQN Mobile - Reviews Layout
 * 리뷰/평가 화면 레이아웃
 */

import { Stack } from 'expo-router';
import { HeaderBackButton } from '@/components/navigation';
import { useThemeStore } from '@/stores/themeStore';
import { getLayoutColor } from '@/constants/colors';

export default function ReviewsLayout() {
  const isDark = useThemeStore((s) => s.isDarkMode);

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: getLayoutColor(isDark, 'header'),
        },
        headerTintColor: getLayoutColor(isDark, 'headerTint'),
        headerLeft: () => (
          <HeaderBackButton tintColor={getLayoutColor(isDark, 'headerTint')} />
        ),
      }}
    >
      <Stack.Screen name="write" options={{ title: '평가 작성' }} />
      <Stack.Screen name="[workLogId]" options={{ title: '평가 상세' }} />
      <Stack.Screen name="pending" options={{ title: '미작성 평가' }} />
    </Stack>
  );
}
