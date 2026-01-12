/**
 * UNIQN Mobile - 정산 카드 컴포넌트 (간소화 버전)
 *
 * @description 스태프 프로필 + 정산 상태 + 총 금액 표시
 * @version 3.1.0
 */

import React, { useMemo, useCallback } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Avatar } from '../ui/Avatar';
import {
  BanknotesIcon,
  ChevronRightIcon,
} from '../icons';
import { getUserProfile } from '@/services';
import {
  type SalaryType,
  type SalaryInfo,
  type Allowances,
  parseTimestamp,
  calculateSettlementFromWorkLog,
  formatCurrency,
} from '@/utils/settlement';
import type { UserProfile } from '@/services';
import type { WorkLog, PayrollStatus } from '@/types';

// Re-export types for backward compatibility
export type { SalaryType, SalaryInfo };

// ============================================================================
// Types
// ============================================================================

export interface SettlementCardProps {
  workLog: WorkLog;
  salaryInfo: SalaryInfo;
  allowances?: Allowances;
  onPress?: (workLog: WorkLog) => void;
  onSettle?: (workLog: WorkLog) => void;
}

// ============================================================================
// Constants
// ============================================================================

const PAYROLL_STATUS_CONFIG: Record<PayrollStatus, {
  label: string;
  variant: 'default' | 'primary' | 'success' | 'warning' | 'error';
}> = {
  pending: { label: '미정산', variant: 'warning' },
  processing: { label: '처리중', variant: 'primary' },
  completed: { label: '정산완료', variant: 'success' },
};

const ROLE_LABELS: Record<string, string> = {
  dealer: '딜러',
  floor: '플로어',
  manager: '매니저',
  chiprunner: '칩러너',
  admin: '관리자',
};

// ============================================================================
// Helpers
// ============================================================================

function getRoleLabel(role: string | undefined): string {
  if (!role) return '역할 없음';
  return ROLE_LABELS[role] || role;
}

// ============================================================================
// Component
// ============================================================================

export const SettlementCard = React.memo(function SettlementCard({
  workLog,
  salaryInfo,
  allowances,
  onPress,
  onSettle,
}: SettlementCardProps) {
  // 사용자 프로필 조회 (프로필 사진, 닉네임)
  const { data: userProfile } = useQuery<UserProfile | null>({
    queryKey: ['userProfile', workLog.staffId],
    queryFn: () => getUserProfile(workLog.staffId),
    enabled: !!workLog.staffId,
    staleTime: 5 * 60 * 1000,
  });

  // 프로필 정보
  const profilePhotoURL = userProfile?.photoURL;
  const baseName = userProfile?.name || (workLog as WorkLog & { staffName?: string }).staffName;
  const displayName = useMemo(() => {
    if (!baseName) return `스태프 ${workLog.staffId?.slice(-4) || '알 수 없음'}`;
    const nickname = userProfile?.nickname || (workLog as WorkLog & { staffNickname?: string }).staffNickname;
    return nickname && nickname !== baseName
      ? `${baseName}(${nickname})`
      : baseName;
  }, [baseName, userProfile?.nickname, workLog.staffId, (workLog as WorkLog & { staffNickname?: string }).staffNickname]);

  // 정산 계산 (수당 포함)
  const settlement = useMemo(() =>
    calculateSettlementFromWorkLog(workLog, salaryInfo, allowances),
    [workLog, salaryInfo, allowances]
  );

  const payrollStatus = (workLog.payrollStatus || 'pending') as PayrollStatus;
  const statusConfig = PAYROLL_STATUS_CONFIG[payrollStatus];

  // 출퇴근 시간 유효 여부
  const startTime = parseTimestamp(workLog.actualStartTime);
  const endTime = parseTimestamp(workLog.actualEndTime);
  const hasValidTimes = startTime && endTime;

  // 핸들러
  const handlePress = useCallback(() => {
    onPress?.(workLog);
  }, [workLog, onPress]);

  const handleSettle = useCallback(() => {
    onSettle?.(workLog);
  }, [workLog, onSettle]);

  return (
    <Card variant="elevated" padding="md">
      {/* 상단: 프로필 + 금액/상태 */}
      <Pressable onPress={handlePress} className="active:opacity-80">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1">
            <Avatar
              source={profilePhotoURL}
              name={displayName}
              size="sm"
              className="mr-3"
            />
            <View className="flex-1">
              <Text className="text-base font-semibold text-gray-900 dark:text-white">
                {displayName}
              </Text>
              <Text className="text-sm text-gray-500 dark:text-gray-400">
                {getRoleLabel(workLog.role)}
              </Text>
            </View>
          </View>
          <View className="items-end">
            <Badge variant={statusConfig.variant} size="sm" dot>
              {statusConfig.label}
            </Badge>
            {hasValidTimes && (
              <Text className="text-base font-bold text-primary-600 dark:text-primary-400 mt-1">
                {formatCurrency(settlement.totalPay)}
              </Text>
            )}
          </View>
        </View>
      </Pressable>

      {/* 출퇴근 미완료 표시 */}
      {!hasValidTimes && (
        <View className="mt-3 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
          <Text className="text-xs text-yellow-700 dark:text-yellow-300 text-center">
            출퇴근 기록 미완료
          </Text>
        </View>
      )}

      {/* 하단: 상세보기 + 정산하기 버튼 */}
      <View className="flex-row mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 gap-2">
        {/* 상세보기 */}
        <Pressable
          onPress={handlePress}
          className="flex-1 flex-row items-center justify-center py-2.5 rounded-lg bg-gray-100 dark:bg-gray-700 active:opacity-70"
        >
          <ChevronRightIcon size={16} color="#6B7280" />
          <Text className="ml-1 text-sm font-medium text-gray-600 dark:text-gray-400">
            상세보기
          </Text>
        </Pressable>

        {/* 정산하기 (미정산 + 출퇴근 완료일 때만) */}
        {payrollStatus === 'pending' && hasValidTimes && onSettle && (
          <Pressable
            onPress={handleSettle}
            className="flex-1 flex-row items-center justify-center py-2.5 rounded-lg bg-primary-500 active:opacity-70"
          >
            <BanknotesIcon size={16} color="#fff" />
            <Text className="ml-1 text-sm font-medium text-white">
              정산하기
            </Text>
          </Pressable>
        )}
      </View>
    </Card>
  );
});

export default SettlementCard;
