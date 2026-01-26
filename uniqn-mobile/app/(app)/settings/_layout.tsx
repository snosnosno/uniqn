/**
 * UNIQN Mobile - Settings Layout
 * 설정 화면 레이아웃
 */

import { Stack } from 'expo-router';
import { useColorScheme } from 'react-native';
import { HeaderBackButton } from '@/components/navigation';

export default function SettingsLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: isDark ? '#1f2937' : '#ffffff',
        },
        headerTintColor: isDark ? '#f9fafb' : '#111827',
        headerLeft: () => (
          <HeaderBackButton
            tintColor={isDark ? '#f9fafb' : '#111827'}
            fallbackHref="/(app)/(tabs)/profile"
          />
        ),
      }}
    >
      <Stack.Screen name="index" options={{ title: '설정' }} />
      <Stack.Screen name="profile" options={{ title: '프로필 수정' }} />
      <Stack.Screen name="change-password" options={{ title: '비밀번호 변경' }} />
      <Stack.Screen name="delete-account" options={{ title: '계정 삭제' }} />
      <Stack.Screen name="my-data" options={{ title: '내 데이터' }} />
      <Stack.Screen name="terms" options={{ title: '이용약관' }} />
      <Stack.Screen name="privacy" options={{ title: '개인정보처리방침' }} />
    </Stack>
  );
}
