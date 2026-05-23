import React from 'react';
import { Pressable } from 'react-native';
import { useNavigation, usePathname, useRouter } from 'expo-router';
import { ChevronLeftIcon } from '@/components/icons';
import { HEADER_CLASSES } from '@/constants';

interface HeaderBackButtonProps {
  tintColor: string;
  fallbackHref?: string;
  className?: string;
}

// fallbackHref는 expo-router 스타일의 라우트 그룹 표기를 포함할 수 있으므로,
// 현재 pathname과 비교하기 위해 `(group)` 세그먼트를 제거한다.
function stripRouteGroups(path: string): string {
  return path.replace(/\/\([^)]+\)/g, '') || '/';
}

export function HeaderBackButton({
  tintColor,
  fallbackHref = '/(app)/(tabs)/home-jobs',
  className,
}: HeaderBackButtonProps) {
  const router = useRouter();
  const navigation = useNavigation();
  const pathname = usePathname();

  const handleBack = () => {
    if (navigation.canGoBack()) {
      router.back();
      return;
    }

    // fallback이 현재 화면이면 replace 루프를 방지하기 위해 무시
    if (stripRouteGroups(fallbackHref) === stripRouteGroups(pathname)) {
      return;
    }

    router.replace(fallbackHref as never);
  };

  return (
    <Pressable
      onPress={handleBack}
      hitSlop={8}
      className={`-ml-2 rounded-sm p-2 ${HEADER_CLASSES.actionPressed} ${className ?? ''}`.trim()}
      accessibilityRole="button"
      accessibilityLabel="뒤로 가기"
    >
      <ChevronLeftIcon size={24} color={tintColor} />
    </Pressable>
  );
}

export default HeaderBackButton;
