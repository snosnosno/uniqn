/**
 * UNIQN Mobile - 공지사항 레이아웃
 */

import { Stack } from 'expo-router';
import { useColorScheme } from 'react-native';
import { HeaderBackButton } from '@/components/navigation';

export default function NoticesLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: isDark ? '#1A1625' : '#ffffff',
        },
        headerTintColor: isDark ? '#ffffff' : '#1A1625',
        headerTitleStyle: {
          fontWeight: '600',
        },
        headerLeft: () => (
          <HeaderBackButton
            tintColor={isDark ? '#ffffff' : '#1A1625'}
            fallbackHref="/(app)/(tabs)"
          />
        ),
        contentStyle: {
          backgroundColor: isDark ? '#1A1625' : '#f9fafb',
        },
      }}
    />
  );
}
