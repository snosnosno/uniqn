/**
 * UNIQN Mobile - 정산 카드 컴포넌트 (간소화 버전)
 *
 * @description 스태프 프로필 + 정산 상태 + 총 금액 표시
 * @version 3.1.0
 */

import { SECONDARY_PALETTE } from '@/constants/colors';
import React, { useMemo, useCallback } from 'react';
import { View, Text, Pressable } from 'react-native';
import { CardStripe } from '../../ui/CardStripe';
import { Badge } from '../../ui/Badge';
import { Avatar } from '../../ui/Avatar';
import { NumericText } from '../../ui/NumericText';
import { BanknotesIcon, ChevronRightIcon } from '../../icons';
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
import type { WorkLog, PayrollStatus } from '@/types';
import { STATUS } from '@/constants';
import { PAYROLL_STATUS_CONFIG } from './helpers/settlementConfig';

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
  onPress?: (workLog: WorkLog) => void;
  onSettle?: (workLog: WorkLog) => void;
}

// ============================================================================
// Component
// ============================================================================

export const SettlementCard = React.memo(function SettlementCard({
  workLog,
  salaryInfo,
  allowances,
  taxSettings,
  onPress,
  onSettle,
}: SettlementCardProps) {
  // 사용자 프로필 조회 (프로필 사진, 닉네임)
  const { displayName, profilePhotoURL } = useUserProfile({
    userId: workLog.staffId,
    fallbackName: (workLog as WorkLog & { staffName?: string }).staffName,
    fallbackNickname: (workLog as WorkLog & { staffNickname?: string }).staffNickname,
    fallbackPhotoURL: (workLog as WorkLog & { staffPhotoURL?: string }).staffPhotoURL,
  });

  // 정산 계산 (수당 + 세금 포함)
  const settlement = useMemo(
    () => calculateSettlementFromWorkLog(workLog, salaryInfo, allowances, taxSettings),
    [workLog, salaryInfo, allowances, taxSettings]
  );

  const payrollStatus = (workLog.payrollStatus || STATUS.PAYROLL.PENDING) as PayrollStatus;
  const statusConfig = PAYROLL_STATUS_CONFIG[payrollStatus];

  // 출퇴근 시간 유효 여부
  const startTime = parseTimestamp(workLog.checkInTime);
  const endTime = parseTimestamp(workLog.checkOutTime);
  const hasValidTimes = startTime && endTime;

  // 핸들러
  const handlePress = useCallback(() => {
    onPress?.(workLog);
  }, [workLog, onPress]);

  const handleSettle = useCallback(() => {
    onSettle?.(workLog);
  }, [workLog, onSettle]);

  const stripeTone = statusConfig.stripeTone;

  return (
    <CardStripe tone={stripeTone}>
      <View className="bg-surface-card dark:bg-surface-elevated rounded-md pl-4 p-3">
        {/* 상단: 프로필 + 금액/상태 */}
        <Pressable
          onPress={handlePress}
          accessibilityRole="button"
          accessibilityLabel={`${displayName} 정산 상세 보기`}
          accessibilityHint="정산 상세 정보를 확인합니다"
          className="active:opacity-80"
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center flex-1">
              <Avatar source={profilePhotoURL} name={displayName} size="sm" className="mr-3" />
              <View className="flex-1">
                <Text className="text-base font-sans-semibold text-content-primary dark:text-off-white">
                  {displayName}
                </Text>
                <Text className="text-sm text-secondary-500 dark:text-secondary-400 font-sans">
                  {workLog.role
                    ? getRoleDisplayName(
                        workLog.role,
                        (workLog as WorkLog & { customRole?: string }).customRole
                      )
                    : '역할 없음'}
                </Text>
              </View>
            </View>
            <View className="items-end">
              <Badge variant={statusConfig.variant} size="sm" dot>
                {statusConfig.label}
              </Badge>
              {hasValidTimes && (
                <NumericText
                  className="text-base font-sans-bold text-primary-600 dark:text-primary-400 mt-1"
                  style={{
                    letterSpacing: -0.3,
                    textAlign: 'right',
                  }}
                >
                  {formatCurrency(
                    settlement.taxAmount > 0 ? settlement.afterTaxPay : settlement.totalPay
                  )}
                </NumericText>
              )}
            </View>
          </View>
        </Pressable>

        {/* 출퇴근 미완료 표시 */}
        {!hasValidTimes && (
          <View className="mt-3 p-2 bg-warning-50 dark:bg-warning-900/20 rounded-lg">
            <Text className="text-xs text-warning-700 dark:text-warning-300 text-center font-sans">
              출퇴근 기록 미완료
            </Text>
          </View>
        )}

        {/* 하단: 상세보기 + 정산하기 버튼 */}
        <View className="flex-row mt-3 pt-3 border-t border-secondary-100 dark:border-surface-overlay gap-2">
          {/* 상세보기 */}
          <Pressable
            onPress={handlePress}
            accessibilityRole="button"
            accessibilityLabel="정산 상세보기"
            accessibilityHint="정산 내역을 자세히 확인합니다"
            className="flex-1 flex-row items-center justify-center py-2.5 rounded-lg bg-surface-card dark:bg-surface active:opacity-70"
          >
            <ChevronRightIcon size={16} color={SECONDARY_PALETTE[500]} />
            <Text className="ml-1 text-sm font-sans-medium text-content-muted dark:text-secondary-400">
              상세보기
            </Text>
          </Pressable>

          {/* 정산하기 (미정산 + 출퇴근 완료일 때만) */}
          {payrollStatus === STATUS.PAYROLL.PENDING && hasValidTimes && onSettle && (
            <Pressable
              onPress={handleSettle}
              accessibilityRole="button"
              accessibilityLabel={`${displayName} 정산하기`}
              accessibilityHint="스태프에게 급여를 정산합니다"
              className="flex-1 flex-row items-center justify-center py-2.5 rounded-lg bg-primary-500 active:opacity-70"
            >
              <BanknotesIcon size={16} color="#fff" />
              <Text className="ml-1 text-sm font-sans-medium text-surface-dark">정산하기</Text>
            </Pressable>
          )}
        </View>
      </View>
    </CardStripe>
  );
});

export default SettlementCard;
