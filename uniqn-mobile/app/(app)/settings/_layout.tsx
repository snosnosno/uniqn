/**
 * UNIQN Mobile - Settings Layout
 * 설정 화면 레이아웃
 */

import { Stack } from 'expo-router';
import { useColorScheme } from 'react-native';

export default function SettingsLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerBackTitle: '뒤로',
        headerStyle: {
          backgroundColor: isDark ? '#1f2937' : '#ffffff',
        },
        headerTintColor: isDark ? '#f9fafb' : '#111827',
      }}
    >
      <Stack.Screen name="index" options={{ title: '설정' }} />
    </Stack>
  );
}
