/**
 * UNIQN Mobile - 정산 액션 버튼 컴포넌트
 *
 * @description 시간 수정, 금액 수정, 정산하기 버튼
 */

import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { ClockIcon, EditIcon, BanknotesIcon } from '../../icons';

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
  return (
    <View className="px-4 py-4">
      {/* 첫 번째 줄: 시간 수정, 금액 수정 */}
      <View className="flex-row gap-3 mb-3">
        {onEditTime && (
          <Pressable
            onPress={onEditTime}
            className="flex-1 flex-row items-center justify-center py-3 rounded-lg bg-gray-100 dark:bg-surface active:opacity-70"
          >
            <ClockIcon size={18} color="#6B7280" />
            <Text className="ml-2 text-base font-medium text-gray-700 dark:text-gray-300">
              시간 수정
            </Text>
          </Pressable>
        )}

        {onEditAmount && (
          <Pressable
            onPress={onEditAmount}
            className="flex-1 flex-row items-center justify-center py-3 rounded-lg bg-gray-100 dark:bg-surface active:opacity-70"
          >
            <EditIcon size={18} color="#6B7280" />
            <Text className="ml-2 text-base font-medium text-gray-700 dark:text-gray-300">
              금액 수정
            </Text>
          </Pressable>
        )}
      </View>

      {/* 두 번째 줄: 정산하기 버튼 */}
      {onSettle && (
        <Pressable
          onPress={onSettle}
          className="flex-row items-center justify-center py-3.5 rounded-lg bg-primary-500 active:opacity-70"
        >
          <BanknotesIcon size={18} color="#fff" />
          <Text className="ml-2 text-base font-semibold text-white">정산하기</Text>
        </Pressable>
      )}
    </View>
  );
}
