/**
 * UNIQN Mobile - [근무] 화면 취소 요청 한 줄 (구인자 IA S1)
 *
 * @description 공고 상세의 `취소 요청 관리` 타일을 없애고 [근무] 맨 위로 옮겼다.
 *   취소 요청은 "누가 빠지는가"라서 근무 명단 바로 위에서 보는 편이 맞다.
 *
 * 🔑 0건이면 그리지 않는다 — "조건부 숨김은 0개일 때만" 규칙. 요청이 남아 있는 동안에는
 *    늘 같은 자리에 있다. 사람 줄마다 승인·거절을 붙이는 건 S1b 다.
 */

import React from 'react';
import { Pressable, Text } from 'react-native';

export interface CancellationRequestsBannerProps {
  /** 검토 대기 중인 취소 요청 수 */
  count: number;
  /** 검토 화면으로 이동 */
  onPress: () => void;
}

export function CancellationRequestsBanner({ count, onPress }: CancellationRequestsBannerProps) {
  if (count <= 0) {
    return null;
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`취소 요청 ${count}건, 검토 화면으로 이동`}
      testID="work-cancellation-banner"
      className="min-h-[44px] flex-row items-center justify-between border-b border-divider bg-error-50 px-4 py-2.5 active:opacity-70 dark:bg-error-900/20"
    >
      <Text className="text-sm font-sans-semibold text-error-700 dark:text-error-400">
        취소 요청 {count}건
      </Text>
      <Text className="text-sm font-sans-medium text-error-700 dark:text-error-400">
        검토하기 ›
      </Text>
    </Pressable>
  );
}
