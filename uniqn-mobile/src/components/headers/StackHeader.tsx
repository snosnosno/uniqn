/**
 * UNIQN Mobile - StackHeader 컴포넌트
 *
 * @description 스택 페이지용 공통 헤더 (뒤로가기 지원)
 * - 새로고침/딥링크에서도 뒤로가기 작동 (fallback 경로)
 */

import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter, useNavigation } from 'expo-router';
import { ChevronLeftIcon } from '@/components/icons';

interface StackHeaderProps {
  /** 헤더 제목 */
  title: string;
  /** 제목 오른쪽에 표시할 추가 정보 (예: 읽지 않은 알림 수) */
  titleSuffix?: React.ReactNode;
  /** 뒤로가기 버튼 표시 여부 (기본: true) */
  showBack?: boolean;
  /** 히스토리가 없을 때 이동할 fallback 경로 (기본: '/(app)/(tabs)') */
  fallbackHref?: string;
  /** 오른쪽 액션 */
  rightAction?: React.ReactNode;
}

/**
 * 스택 페이지용 공통 헤더
 *
 * 사용 예시:
 * ```tsx
 * <StackHeader title="알림" rightAction={<MarkAllReadButton />} />
 * <StackHeader title="공고 상세" fallbackHref="/(app)/(tabs)" />
 * ```
 */
export function StackHeader({
  title,
  titleSuffix,
  showBack = true,
  fallbackHref = '/(app)/(tabs)',
  rightAction,
}: StackHeaderProps) {
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
    <View className="flex-row items-center justify-between bg-white px-2 py-3 dark:bg-surface">
      {/* 왼쪽: 뒤로가기 + 제목 */}
      <View className="flex-row items-center flex-1">
        {showBack && (
          <Pressable
            onPress={handleBack}
            className="p-2"
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="뒤로 가기"
          >
            <ChevronLeftIcon size={24} color="#6B7280" />
          </Pressable>
        )}
        <Text className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {title}
          {titleSuffix}
        </Text>
      </View>

      {/* 오른쪽: 액션 */}
      {rightAction && (
        <View className="mr-2">
          {rightAction}
        </View>
      )}
    </View>
  );
}

export default StackHeader;
