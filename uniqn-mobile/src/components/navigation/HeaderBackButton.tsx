/**
 * UNIQN Mobile - HeaderBackButton 컴포넌트
 *
 * @description 새로고침/딥링크에서도 작동하는 커스텀 뒤로가기 버튼
 * - navigation.canGoBack()이 false일 때 fallback 경로로 이동
 */

import React from 'react';
import { Pressable } from 'react-native';
import { useRouter, useNavigation } from 'expo-router';
import { ChevronLeftIcon } from '@/components/icons';

interface HeaderBackButtonProps {
  /** 아이콘 색상 */
  tintColor: string;
  /** 히스토리가 없을 때 이동할 fallback 경로 */
  fallbackHref?: string;
}

/**
 * 커스텀 뒤로가기 버튼
 *
 * 새로고침이나 딥링크로 직접 진입 시에도 뒤로가기 버튼이 표시되고,
 * 클릭 시 fallback 경로로 이동합니다.
 */
export function HeaderBackButton({
  tintColor,
  fallbackHref = '/(app)/(tabs)',
}: HeaderBackButtonProps) {
  const router = useRouter();
  const navigation = useNavigation();

  const handleBack = () => {
    if (navigation.canGoBack()) {
      router.back();
    } else {
      // 히스토리가 없으면 fallback 경로로 이동
      router.replace(fallbackHref as never);
    }
  };

  return (
    <Pressable
      onPress={handleBack}
      hitSlop={8}
      className="p-2 -ml-2"
      accessibilityRole="button"
      accessibilityLabel="뒤로 가기"
    >
      <ChevronLeftIcon size={24} color={tintColor} />
    </Pressable>
  );
}

export default HeaderBackButton;
