/**
 * UNIQN Mobile - 금액 수정 이력 섹션 컴포넌트
 *
 * @description 금액 수정 이력 접기/펼치기 UI
 */

import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { BanknotesIcon, ChevronDownIcon, ChevronUpIcon } from '../../icons';
import { formatTime, formatDate } from '@/utils/dateUtils';
import { parseTimestamp } from '@/utils/settlement';
import type { SalaryInfo, TaxSettings } from '@/utils/settlement';

export interface SettlementModification {
  modifiedAt?: unknown;
  reason?: string;
  modifiedBy?: string;
  previousSalaryInfo?: SalaryInfo;
  newSalaryInfo?: SalaryInfo;
  previousAllowances?: unknown;
  newAllowances?: unknown;
  previousTaxSettings?: TaxSettings;
  newTaxSettings?: TaxSettings;
}

export interface AmountModificationHistoryProps {
  /** 금액 수정 이력 배열 */
  settlementModificationHistory: SettlementModification[];
  /** 확장 상태 */
  isExpanded: boolean;
  /** 확장 토글 핸들러 */
  onToggle: () => void;
}

/**
 * 금액 수정 이력 섹션
 *
 * @example
 * <AmountModificationHistory
 *   settlementModificationHistory={workLog.settlementModificationHistory}
 *   isExpanded={isAmountHistoryExpanded}
 *   onToggle={() => setIsAmountHistoryExpanded(!isAmountHistoryExpanded)}
 * />
 */
export function AmountModificationHistory({
  settlementModificationHistory,
  isExpanded,
  onToggle,
}: AmountModificationHistoryProps) {
  if (!settlementModificationHistory || settlementModificationHistory.length === 0) {
    return null;
  }

  return (
    <View className="px-4 py-4 border-b border-gray-100 dark:border-gray-700">
      <Pressable
        onPress={onToggle}
        className="flex-row items-center justify-between active:opacity-70"
      >
        <View className="flex-row items-center">
          <BanknotesIcon size={18} color="#6B7280" />
          <Text className="ml-2 text-base font-semibold text-gray-900 dark:text-white">
            금액 수정 이력
          </Text>
          <View className="ml-2 px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 rounded-full">
            <Text className="text-xs text-indigo-700 dark:text-indigo-300">
              {settlementModificationHistory.length}회
            </Text>
          </View>
        </View>
        {isExpanded ? (
          <ChevronUpIcon size={20} color="#6B7280" />
        ) : (
          <ChevronDownIcon size={20} color="#6B7280" />
        )}
      </Pressable>

      {isExpanded && (
        <View className="mt-3 bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
          {settlementModificationHistory.map((mod, idx) => {
            const modifiedAt = parseTimestamp(mod.modifiedAt);
            return (
              <View
                key={idx}
                className="flex-row items-start py-2 border-b border-gray-100 dark:border-gray-700 last:border-b-0"
              >
                <View className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/30 items-center justify-center mr-2">
                  <Text className="text-xs text-indigo-600 dark:text-indigo-400">{idx + 1}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-sm text-gray-900 dark:text-white">
                    {mod.reason || '금액 수정'}
                  </Text>
                  {modifiedAt && (
                    <Text className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {formatDate(modifiedAt)} {formatTime(modifiedAt)}
                    </Text>
                  )}
                  {/* 변경 내용 표시 */}
                  <View className="mt-1.5 bg-gray-100 dark:bg-gray-700 rounded px-2 py-1.5">
                    {mod.newSalaryInfo && (
                      <Text className="text-xs text-gray-600 dark:text-gray-300">
                        • 급여: {mod.previousSalaryInfo?.amount?.toLocaleString() || '-'}원 → {mod.newSalaryInfo.amount.toLocaleString()}원
                      </Text>
                    )}
                    {mod.newAllowances !== null && mod.newAllowances !== undefined && (
                      <Text className="text-xs text-gray-600 dark:text-gray-300">
                        • 수당 변경
                      </Text>
                    )}
                    {mod.newTaxSettings && (
                      <Text className="text-xs text-gray-600 dark:text-gray-300">
                        • 세금: {mod.previousTaxSettings?.type || 'none'} → {mod.newTaxSettings.type}
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}
