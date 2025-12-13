/**
 * UNIQN Mobile - App Layout
 * 메인 앱 레이아웃 (인증 후)
 */

import { Stack } from 'expo-router';
import { useColorScheme } from 'react-native';

export default function AppLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: {
          backgroundColor: isDark ? '#111827' : '#f9fafb',
        },
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="notifications"
        options={{
          presentation: 'card',
          headerShown: true,
          title: '알림',
        }}
      />
      <Stack.Screen name="settings" />
    </Stack>
  );
}
