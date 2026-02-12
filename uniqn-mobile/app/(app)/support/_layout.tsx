/**
 * UNIQN Mobile - Support Layout
 * 고객센터 화면 레이아웃
 */

import { Stack } from 'expo-router';
import { HeaderBackButton } from '@/components/navigation';
import { useThemeStore } from '@/stores/themeStore';
import { getLayoutColor } from '@/constants/colors';

export default function SupportLayout() {
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
          <HeaderBackButton
            tintColor={getLayoutColor(isDark, 'headerTint')}
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
