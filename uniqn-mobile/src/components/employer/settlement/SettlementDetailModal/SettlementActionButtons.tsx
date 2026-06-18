/**
 * UNIQN Mobile - 정산 액션 버튼 컴포넌트
 *
 * @description 시간 수정, 금액 수정, 정산하기 버튼
 */

import { SECONDARY_PALETTE } from '@/constants/colors';
import React, { useCallback } from 'react';
import { View, Text, Pressable } from 'react-native';
import { ClockIcon, EditIcon, BanknotesIcon } from '@/components/icons';
import { triggerHaptic } from '@/utils/haptics';

export interface SettlementActionButtonsProps {
  /** 시간 수정 핸들러 */
  onEditTime?: () => void;
  /** 금액 수정 핸들러 */
  onEditAmount?: () => void;
  /** 정산 핸들러 */
  onSettle?: () => void;
}

/**
 * 정산 액션 버튼들
 *
 * @example
 * <SettlementActionButtons
 *   onEditTime={handleEditTime}
 *   onEditAmount={handleEditAmount}
 *   onSettle={handleSettle}
 * />
 */
export function SettlementActionButtons({
  onEditTime,
  onEditAmount,
  onSettle,
}: SettlementActionButtonsProps) {
  // impeccable v2 §17 — 정산(결제 승인)은 결정적 순간이므로 Medium 햅틱 1회.
  // 200ms throttle 로 중복 탭 보호됨.
  const handleSettle = useCallback(async () => {
    if (!onSettle) return;
    await triggerHaptic('medium');
    onSettle();
  }, [onSettle]);

  return (
    <View className="px-4 py-4">
      {/* 첫 번째 줄: 시간 수정, 금액 수정 */}
      <View className="flex-row gap-3 mb-3">
        {onEditTime && (
          <Pressable
            onPress={onEditTime}
            accessibilityRole="button"
            accessibilityLabel="근무 시간 수정"
            accessibilityHint="근무 시간을 수정합니다"
            className="flex-1 flex-row items-center justify-center py-3 rounded-lg bg-surface-card dark:bg-surface active:opacity-70"
          >
            <ClockIcon size={18} color={SECONDARY_PALETTE[500]} />
            <Text className="ml-2 text-base font-sans-medium text-content-secondary">
              시간 수정
            </Text>
          </Pressable>
        )}

        {onEditAmount && (
          <Pressable
            onPress={onEditAmount}
            accessibilityRole="button"
            accessibilityLabel="정산 금액 수정"
            accessibilityHint="정산 금액을 수정합니다"
            className="flex-1 flex-row items-center justify-center py-3 rounded-lg bg-surface-card dark:bg-surface active:opacity-70"
          >
            <EditIcon size={18} color={SECONDARY_PALETTE[500]} />
            <Text className="ml-2 text-base font-sans-medium text-content-secondary">
              금액 수정
            </Text>
          </Pressable>
        )}
      </View>

      {/* 두 번째 줄: 정산하기 버튼 */}
      {onSettle && (
        <Pressable
          onPress={handleSettle}
          accessibilityRole="button"
          accessibilityLabel="정산하기"
          accessibilityHint="스태프에게 급여를 정산합니다"
          className="flex-row items-center justify-center py-3.5 rounded-lg bg-primary-500 active:opacity-70"
        >
          <BanknotesIcon size={18} color="#fff" />
          <Text className="ml-2 text-base font-sans-semibold text-content-onGold">정산하기</Text>
        </Pressable>
      )}
    </View>
  );
}
