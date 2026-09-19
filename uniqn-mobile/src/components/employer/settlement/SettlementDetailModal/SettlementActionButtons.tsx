/**
 * UNIQN Mobile - 계산 근거 액션 버튼 컴포넌트
 *
 * @description 근무 수정, 금액 수정 버튼
 *   구인자 IA S2 — `지급 완료로 표시` 는 없앴다. 앱은 돈을 보내지 않는다.
 *
 * ⚠️ '근무 수정'은 **스태프관리 카드와 같은 라벨**이다(D2 — 같은 시트를 여는 버튼).
 *    '시간 수정'으로 되돌리지 말 것 — 이 시트는 역할·색·메모도 고친다.
 */

import { SECONDARY_PALETTE } from '@/constants/colors';
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { ClockIcon, EditIcon } from '@/components/icons';

export interface SettlementActionButtonsProps {
  /** 근무 수정 핸들러 */
  onEditTime?: () => void;
  /** 금액 수정 핸들러 */
  onEditAmount?: () => void;
  /**
   * ⚠️ 두 핸들러가 모두 없으면 이 컴포넌트는 **빈 껍데기(px-4 py-4)** 를 그린다.
   * 그려질 버튼이 하나라도 있는지는 호출부가 판정하고, 이 testID 로 그 판정을 검증한다.
   */
  testID?: string;
}

export function SettlementActionButtons({
  onEditTime,
  onEditAmount,
  testID,
}: SettlementActionButtonsProps) {
  return (
    <View testID={testID} className="px-4 py-4">
      <View className="flex-row gap-3">
        {onEditTime && (
          <Pressable
            onPress={onEditTime}
            accessibilityRole="button"
            accessibilityLabel="근무 수정"
            accessibilityHint="근무 시간·역할·색·메모를 한 창에서 수정합니다"
            className="flex-1 flex-row items-center justify-center py-3 rounded-lg bg-surface-card dark:bg-surface active:opacity-70"
          >
            {/* 아이콘은 시계 그대로 — 이 모달에서 EditIcon 은 바로 옆 '금액 수정'이 쓴다.
                라벨만 카드와 맞추고 아이콘까지 겹치면 두 버튼을 구분할 단서가 사라진다. */}
            <ClockIcon size={18} color={SECONDARY_PALETTE[500]} />
            <Text className="ml-2 text-base font-sans-medium text-content-secondary">
              근무 수정
            </Text>
          </Pressable>
        )}

        {onEditAmount && (
          <Pressable
            onPress={onEditAmount}
            accessibilityRole="button"
            accessibilityLabel="근무 금액 수정"
            accessibilityHint="이 근무의 단가·수당·세금을 따로 정합니다"
            className="flex-1 flex-row items-center justify-center py-3 rounded-lg bg-surface-card dark:bg-surface active:opacity-70"
          >
            <EditIcon size={18} color={SECONDARY_PALETTE[500]} />
            <Text className="ml-2 text-base font-sans-medium text-content-secondary">
              금액 수정
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
