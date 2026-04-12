/**
 * UNIQN Mobile - 금액 수정 이력 섹션 컴포넌트
 *
 * @description 금액 수정 이력 접기/펼치기 UI
 */

import { SECONDARY_PALETTE } from '@/constants/colors';
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { BanknotesIcon, ChevronDownIcon, ChevronUpIcon } from '../../../icons';
import { formatTime, formatDate } from '@/utils/date';
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
    <View className="px-4 py-4 border-b border-secondary-100 dark:border-surface-overlay">
      <Pressable
        onPress={onToggle}
        className="flex-row items-center justify-between active:opacity-70"
      >
        <View className="flex-row items-center">
          <BanknotesIcon size={18} color={SECONDARY_PALETTE[500]} />
          <Text className="ml-2 text-base font-sans-semibold text-content-primary dark:text-off-white">
            금액 수정 이력
          </Text>
          <View className="ml-2 px-2 py-0.5 bg-primary-100 dark:bg-primary-900/30 rounded-sm">
            <Text className="text-xs text-primary-800 dark:text-primary-200 font-sans">
              {settlementModificationHistory.length}회
            </Text>
          </View>
        </View>
        {isExpanded ? (
          <ChevronUpIcon size={20} color={SECONDARY_PALETTE[500]} />
        ) : (
          <ChevronDownIcon size={20} color={SECONDARY_PALETTE[500]} />
        )}
      </Pressable>

      {isExpanded && (
        <View className="mt-3 bg-surface-page rounded-lg p-3">
          {settlementModificationHistory.map((mod, idx) => {
            const modifiedAt = parseTimestamp(mod.modifiedAt);
            return (
              <View
                key={idx}
                className="flex-row items-start py-2 border-b border-secondary-100 dark:border-surface-overlay last:border-b-0"
              >
                <View className="w-6 h-6 rounded-sm bg-primary-100 dark:bg-primary-900/30 items-center justify-center mr-2">
                  <Text className="text-xs text-primary-700 dark:text-primary-300 font-sans">
                    {idx + 1}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text className="text-sm text-content-primary dark:text-off-white font-sans">
                    {mod.reason || '금액 수정'}
                  </Text>
                  {modifiedAt && (
                    <Text className="text-xs text-secondary-500 dark:text-secondary-400 mt-0.5 font-sans">
                      {formatDate(modifiedAt)} {formatTime(modifiedAt)}
                    </Text>
                  )}
                  {/* 변경 내용 표시 */}
                  <View className="mt-1.5 bg-surface-card dark:bg-surface rounded px-2 py-1.5">
                    {mod.newSalaryInfo && (
                      <Text className="text-xs text-content-muted dark:text-secondary-300 font-sans">
                        • 급여: {mod.previousSalaryInfo?.amount?.toLocaleString() || '-'}원 →{' '}
                        {mod.newSalaryInfo.amount.toLocaleString()}원
                      </Text>
                    )}
                    {mod.newAllowances !== null && mod.newAllowances !== undefined && (
                      <Text className="text-xs text-content-muted dark:text-secondary-300 font-sans">
                        • 수당 변경
                      </Text>
                    )}
                    {mod.newTaxSettings && (
                      <Text className="text-xs text-content-muted dark:text-secondary-300 font-sans">
                        • 세금: {mod.previousTaxSettings?.type || 'none'} →{' '}
                        {mod.newTaxSettings.type}
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
