/**
 * UNIQN Mobile - 근무 금액 카드 컴포넌트 (간소화 버전)
 *
 * @description 스태프 프로필 + 금액 표시 (지점 근무 금액 화면)
 * @version 4.0.0 - 구인자 IA S2: 지급 상태 배지·지급 완료 버튼·정산 가능 게이트 제거
 */

import { SECONDARY_PALETTE } from '@/constants/colors';
import React, { useMemo, useCallback } from 'react';
import { View, Text, Pressable } from 'react-native';
import { CardStripe } from '@/components/ui/CardStripe';
import { Avatar } from '@/components/ui/Avatar';
import { NumericText } from '@/components/ui/NumericText';
import { ChevronRightIcon } from '@/components/icons';
import { useUserProfile } from '@/hooks/useUserProfile';
import {
  type SalaryType,
  type SalaryInfo,
  type Allowances,
  type TaxSettings,
  parseTimestamp,
  calculateSettlementFromWorkLog,
  formatCurrency,
} from '@/utils/settlement';
import { getRoleDisplayName } from '@/types/unified';
import type { WorkLog } from '@/types';
import { STATUS } from '@/constants';
import { shouldUseFrozenPayrollAmount } from '@/utils/settlementGrouping';

// Re-export types for backward compatibility
export type { SalaryType, SalaryInfo };

// ============================================================================
// Types
// ============================================================================

export interface SettlementCardProps {
  workLog: WorkLog;
  salaryInfo: SalaryInfo;
  allowances?: Allowances;
  /** 세금 설정 (공고 전체에 적용) */
  taxSettings?: TaxSettings;
  /**
   * 서비스가 이미 계산한 canonical 금액(afterTaxPay).
   * 지점 금액처럼 유효 급여·수당·세금 해소를 서비스가 끝낸 경로에서 넘긴다 —
   * 안 넘기면 카드가 불완전한 컨텍스트로 다시 계산해 서비스 값과 어긋난다(SETTLE-8).
   */
  calculatedAmount?: number;
  onPress?: (workLog: WorkLog) => void;
}

// ============================================================================
// Component
// ============================================================================

export const SettlementCard = React.memo(function SettlementCard({
  workLog,
  salaryInfo,
  allowances,
  taxSettings,
  calculatedAmount,
  onPress,
}: SettlementCardProps) {
  const { displayName, profilePhotoURL, profilePhotoURLBlurhash } = useUserProfile({
    userId: workLog.staffId,
    fallbackName: workLog.staffName,
    fallbackNickname: workLog.staffNickname,
    fallbackPhotoURL: workLog.staffPhotoURL,
    fallbackPhotoURLBlurhash: workLog.staffPhotoURLBlurhash,
  });

  const settlement = useMemo(
    () => calculateSettlementFromWorkLog(workLog, salaryInfo, allowances, taxSettings),
    [workLog, salaryInfo, allowances, taxSettings]
  );

  // 표시 금액 우선순위 (SETTLE-5·SETTLE-8):
  //   1) 과거에 확정된 금액이 있으면 그 동결값. 이후 공고 급여가 바뀌어도 불변이다.
  //   2) 서비스가 계산한 canonical → 그대로 존중.
  //   3) 그 외 → 카드 자체 재계산.
  const displayAmount = shouldUseFrozenPayrollAmount(
    workLog.payrollStatus === STATUS.PAYROLL.COMPLETED,
    workLog.payrollAmount
  )
    ? workLog.payrollAmount
    : (calculatedAmount ??
      (settlement.taxAmount > 0 ? settlement.afterTaxPay : settlement.totalPay));

  // 🔑 퇴근이 안 찍힌 줄로 추정 금액을 만들지 않는다 — 사장이 그 숫자를 보고 보낸다.
  const hasValidTimes = Boolean(
    parseTimestamp(workLog.checkInTime) && parseTimestamp(workLog.checkOutTime)
  );

  const handlePress = useCallback(() => {
    onPress?.(workLog);
  }, [workLog, onPress]);

  return (
    <CardStripe tone={hasValidTimes ? 'muted' : 'gold'}>
      <View className="bg-surface-card dark:bg-surface-elevated rounded-md pl-4 p-3">
        <Pressable
          onPress={handlePress}
          accessibilityRole="button"
          accessibilityLabel={`${displayName} 근무 금액 상세 보기`}
          accessibilityHint="계산 근거를 확인합니다"
          className="active:opacity-80"
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center flex-1">
              <Avatar
                source={profilePhotoURL}
                name={displayName}
                size="sm"
                className="mr-3"
                blurhash={profilePhotoURLBlurhash}
              />
              <View className="flex-1">
                <Text className="text-base font-sans-semibold text-content-primary dark:text-off-white">
                  {displayName}
                </Text>
                <Text className="text-sm text-secondary-500 dark:text-secondary-400 font-sans">
                  {workLog.role
                    ? getRoleDisplayName(workLog.role, workLog.customRole)
                    : '역할 없음'}
                </Text>
              </View>
            </View>
            {hasValidTimes ? (
              <NumericText
                className="text-base font-sans-bold text-primary-600 dark:text-primary-400"
                style={{
                  letterSpacing: -0.3,
                  textAlign: 'right',
                }}
              >
                {formatCurrency(displayAmount)}
              </NumericText>
            ) : null}
          </View>
        </Pressable>

        {!hasValidTimes && (
          <View className="mt-3 p-2 bg-surface-page dark:bg-surface rounded-lg">
            <Text className="text-xs text-content-muted dark:text-secondary-400 text-center font-sans">
              퇴근을 찍어야 금액이 정해져요
            </Text>
          </View>
        )}

        <View className="flex-row mt-3 pt-3 border-t border-secondary-100 dark:border-surface-overlay">
          <Pressable
            onPress={handlePress}
            accessibilityRole="button"
            accessibilityLabel="계산 근거 보기"
            className="flex-1 flex-row items-center justify-center py-2.5 rounded-lg bg-surface-card dark:bg-surface active:opacity-70"
          >
            <ChevronRightIcon size={16} color={SECONDARY_PALETTE[500]} />
            <Text className="ml-1 text-sm font-sans-medium text-content-muted dark:text-secondary-400">
              계산 근거
            </Text>
          </Pressable>
        </View>
      </View>
    </CardStripe>
  );
});
