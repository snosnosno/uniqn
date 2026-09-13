/**
 * UNIQN Mobile - 상시 공고 [근무] 안내 (구인자 IA S1)
 *
 * @description 상시(fixed) 공고는 날짜가 없어 출퇴근·정산이 없다. 종전에는 이 자리에
 *   "지원하지 않는 화면입니다"라는 막다른 에러를 띄웠다 — 사장이 할 일은 따로 있는데 알려주지 않았다.
 *   공고는 사람을 모으는 도구이고, 실제 근무일 배치는 근무표에서 한다.
 */

import React from 'react';
import { Pressable, Text, View } from 'react-native';

export interface FixedPostingWorkNoticeProps {
  /** 근무표로 이동 */
  onOpenWorkSchedule: () => void;
}

export function FixedPostingWorkNotice({ onOpenWorkSchedule }: FixedPostingWorkNoticeProps) {
  return (
    <View className="flex-1 items-center justify-center px-6">
      <Text className="text-center text-base font-sans-semibold text-content-primary dark:text-off-white">
        이 공고는 사람을 모으는 용도예요
      </Text>
      <Text className="mt-1.5 text-center text-sm text-content-secondary dark:text-secondary-400 font-sans">
        실제 근무일은 근무표에서 배치하세요.
      </Text>
      <Pressable
        onPress={onOpenWorkSchedule}
        accessibilityRole="button"
        accessibilityLabel="근무표 열기"
        testID="fixed-posting-open-work-schedule"
        className="mt-5 min-h-[44px] justify-center rounded-md bg-primary-600 px-5 active:bg-primary-700 dark:bg-primary-700 dark:active:bg-primary-800"
      >
        <Text className="text-base font-sans-semibold text-content-onGold">근무표 열기</Text>
      </Pressable>
    </View>
  );
}
