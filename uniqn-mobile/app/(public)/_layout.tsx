/**
 * UNIQN Mobile - Public Routes Layout
 * 인증 불필요 화면 레이아웃
 */

import { Stack } from 'expo-router';
import { useThemeStore } from '@/stores/themeStore';
import { ScreenErrorBoundary } from '@/components/ui';
import { getLayoutColor } from '@/constants/colors';

export default function PublicLayout() {
  const isDark = useThemeStore((s) => s.isDarkMode);

  // 섹션 단위 에러 경계(감사 err-03). 전광판·플레이어뷰는 로그인 없이 장시간 켜두는
  // 화면이라, 렌더 예외로 앱 전체가 에러 화면이 되면 현장에서 복구할 사람이 없다.
  return (
    <ScreenErrorBoundary name="PublicLayout">
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          statusBarStyle: 'auto',
          statusBarBackgroundColor: 'transparent',
          contentStyle: {
            backgroundColor: getLayoutColor(isDark, 'content'),
          },
        }}
      />
    </ScreenErrorBoundary>
  );
}
