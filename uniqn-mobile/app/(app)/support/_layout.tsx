/**
 * UNIQN Mobile - Support Layout
 * 고객센터 화면 레이아웃
 */

import { Stack } from 'expo-router';
import { useColorScheme } from 'react-native';
import { HeaderBackButton } from '@/components/navigation';

export default function SupportLayout() {
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
      <Stack.Screen name="index" options={{ title: '고객센터' }} />
      <Stack.Screen name="faq" options={{ title: '자주 묻는 질문' }} />
      <Stack.Screen name="create-inquiry" options={{ title: '1:1 문의하기' }} />
      <Stack.Screen name="my-inquiries" options={{ title: '문의 내역' }} />
      <Stack.Screen name="inquiry/[id]" options={{ title: '문의 상세' }} />
    </Stack>
  );
}
