/**
 * UNIQN Mobile - 정산 카드 컴포넌트
 *
 * @description 스태프 근무 기록 및 정산 정보 표시
 * @version 1.0.0
 */

import React, { useMemo, useCallback } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Avatar } from '../ui/Avatar';
import {
  
  
  CheckCircleIcon,
  EditIcon,
  BanknotesIcon,
} from '../icons';
import { formatTime, formatDate } from '@/utils/dateUtils';
import type { WorkLog, PayrollStatus } from '@/types';

// ============================================================================
// Types
// ============================================================================

export interface SettlementCardProps {
  workLog: WorkLog;
  hourlyRate: number;
  onPress?: (workLog: WorkLog) => void;
  onEditTime?: (workLog: WorkLog) => void;
  onSettle?: (workLog: WorkLog) => void;
  showActions?: boolean;
}

interface SettlementCalculation {
  regularHours: number;
  overtimeHours: number;
  regularPay: number;
  overtimePay: number;
  totalPay: number;
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

const REGULAR_HOURS = 8; // 기본 근무시간
const OVERTIME_RATE = 1.5; // 초과근무 수당 배율

// ============================================================================
// Helpers
// ============================================================================

function parseTimestamp(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string') return new Date(value);
  if (typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }
  return null;
}

function calculateSettlement(workLog: WorkLog, hourlyRate: number): SettlementCalculation {
  const startTime = parseTimestamp(workLog.actualStartTime);
  const endTime = parseTimestamp(workLog.actualEndTime);

  if (!startTime || !endTime) {
    return {
      regularHours: 0,
      overtimeHours: 0,
      regularPay: 0,
      overtimePay: 0,
      totalPay: 0,
    };
  }

  const totalMinutes = Math.max(0, (endTime.getTime() - startTime.getTime()) / (1000 * 60));
  const totalHours = totalMinutes / 60;

  const regularHours = Math.min(totalHours, REGULAR_HOURS);
  const overtimeHours = Math.max(0, totalHours - REGULAR_HOURS);

  const regularPay = Math.round(regularHours * hourlyRate);
  const overtimePay = Math.round(overtimeHours * hourlyRate * OVERTIME_RATE);

  return {
    regularHours: Math.round(regularHours * 100) / 100,
    overtimeHours: Math.round(overtimeHours * 100) / 100,
    regularPay,
    overtimePay,
    totalPay: regularPay + overtimePay,
  };
}

function formatDuration(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);

  if (h === 0) return `${m}분`;
  if (m === 0) return `${h}시간`;
  return `${h}시간 ${m}분`;
}

function formatCurrency(amount: number): string {
  return amount.toLocaleString('ko-KR') + '원';
}

// ============================================================================
// Component
// ============================================================================

export const SettlementCard = React.memo(function SettlementCard({
  workLog,
  hourlyRate,
  onPress,
  onEditTime,
  onSettle,
  showActions = true,
}: SettlementCardProps) {
  const startTime = useMemo(() => parseTimestamp(workLog.actualStartTime), [workLog.actualStartTime]);
  const endTime = useMemo(() => parseTimestamp(workLog.actualEndTime), [workLog.actualEndTime]);
  const workDate = useMemo(() => parseTimestamp(workLog.date), [workLog.date]);

  const settlement = useMemo(() =>
    calculateSettlement(workLog, hourlyRate),
    [workLog, hourlyRate]
  );

  const payrollStatus = (workLog.payrollStatus || 'pending') as PayrollStatus;
  const statusConfig = PAYROLL_STATUS_CONFIG[payrollStatus];

  const handlePress = useCallback(() => {
    onPress?.(workLog);
  }, [workLog, onPress]);

  const handleEditTime = useCallback(() => {
    onEditTime?.(workLog);
  }, [workLog, onEditTime]);

  const handleSettle = useCallback(() => {
    onSettle?.(workLog);
  }, [workLog, onSettle]);

  // 출퇴근 시간이 없는 경우
  const hasValidTimes = startTime && endTime;

  return (
    <Card variant="elevated" padding="md" onPress={handlePress}>
      {/* 헤더: 스태프 정보 + 날짜 + 상태 */}
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center flex-1">
          <Avatar
            name={workLog.staffId?.charAt(0)?.toUpperCase() || 'U'}
            size="sm"
            className="mr-3"
          />
          <View className="flex-1">
            <Text className="text-base font-semibold text-gray-900 dark:text-white">
              스태프 {workLog.staffId?.slice(-4) || '알 수 없음'}
            </Text>
            <Text className="text-sm text-gray-500 dark:text-gray-400">
              {workLog.role || '역할 없음'} • {workDate ? formatDate(workDate) : '날짜 없음'}
            </Text>
          </View>
        </View>
        <Badge variant={statusConfig.variant} size="sm" dot>
          {statusConfig.label}
        </Badge>
      </View>

      {/* 시간 정보 */}
      {hasValidTimes ? (
        <View className="flex-row items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg mb-3">
          <View className="items-center">
            <Text className="text-xs text-gray-500 dark:text-gray-400 mb-1">출근</Text>
            <Text className="text-lg font-semibold text-green-600 dark:text-green-400">
              {formatTime(startTime)}
            </Text>
          </View>
          <View className="h-0.5 flex-1 mx-4 bg-gray-200 dark:bg-gray-700" />
          <View className="items-center">
            <Text className="text-xs text-gray-500 dark:text-gray-400 mb-1">퇴근</Text>
            <Text className="text-lg font-semibold text-red-600 dark:text-red-400">
              {formatTime(endTime)}
            </Text>
          </View>
          <View className="h-0.5 flex-1 mx-4 bg-gray-200 dark:bg-gray-700" />
          <View className="items-center">
            <Text className="text-xs text-gray-500 dark:text-gray-400 mb-1">근무</Text>
            <Text className="text-lg font-semibold text-primary-600 dark:text-primary-400">
              {formatDuration(settlement.regularHours + settlement.overtimeHours)}
            </Text>
          </View>
        </View>
      ) : (
        <View className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg mb-3">
          <Text className="text-sm text-yellow-700 dark:text-yellow-300 text-center">
            출퇴근 기록이 완료되지 않았습니다
          </Text>
        </View>
      )}

      {/* 정산 정보 */}
      {hasValidTimes && (
        <View className="space-y-2 mb-3">
          {/* 기본 근무 */}
          <View className="flex-row items-center justify-between">
            <Text className="text-sm text-gray-600 dark:text-gray-400">
              기본 근무 ({formatDuration(settlement.regularHours)})
            </Text>
            <Text className="text-sm font-medium text-gray-900 dark:text-white">
              {formatCurrency(settlement.regularPay)}
            </Text>
          </View>

          {/* 초과 근무 */}
          {settlement.overtimeHours > 0 && (
            <View className="flex-row items-center justify-between">
              <Text className="text-sm text-gray-600 dark:text-gray-400">
                초과 근무 ({formatDuration(settlement.overtimeHours)}) × 1.5
              </Text>
              <Text className="text-sm font-medium text-orange-600 dark:text-orange-400">
                +{formatCurrency(settlement.overtimePay)}
              </Text>
            </View>
          )}

          {/* 구분선 */}
          <View className="h-px bg-gray-200 dark:bg-gray-700 my-1" />

          {/* 총 금액 */}
          <View className="flex-row items-center justify-between">
            <Text className="text-base font-semibold text-gray-900 dark:text-white">
              정산 금액
            </Text>
            <Text className="text-lg font-bold text-primary-600 dark:text-primary-400">
              {formatCurrency(settlement.totalPay)}
            </Text>
          </View>
        </View>
      )}

      {/* 수정 이력 표시 */}
      {workLog.modificationHistory && workLog.modificationHistory.length > 0 && (
        <View className="flex-row items-center p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg mb-3">
          <EditIcon size={14} color="#D97706" />
          <Text className="ml-2 text-xs text-yellow-700 dark:text-yellow-300">
            시간 수정됨 ({workLog.modificationHistory.length}회)
          </Text>
        </View>
      )}

      {/* 액션 버튼 */}
      {showActions && payrollStatus === 'pending' && hasValidTimes && (
        <View className="flex-row mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
          {/* 시간 수정 */}
          <Pressable
            onPress={handleEditTime}
            className="flex-1 flex-row items-center justify-center py-2 mr-2 rounded-lg bg-gray-100 dark:bg-gray-700 active:opacity-70"
          >
            <EditIcon size={16} color="#6B7280" />
            <Text className="ml-1 text-sm font-medium text-gray-600 dark:text-gray-400">
              시간 수정
            </Text>
          </Pressable>

          {/* 정산하기 */}
          <Pressable
            onPress={handleSettle}
            className="flex-1 flex-row items-center justify-center py-2 rounded-lg bg-primary-500 active:opacity-70"
          >
            <BanknotesIcon size={16} color="#fff" />
            <Text className="ml-1 text-sm font-medium text-white">
              정산하기
            </Text>
          </Pressable>
        </View>
      )}

      {/* 정산 완료 표시 */}
      {payrollStatus === 'completed' && (
        <View className="flex-row items-center justify-center mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
          <CheckCircleIcon size={16} color="#10B981" />
          <Text className="ml-2 text-sm font-medium text-green-600 dark:text-green-400">
            {workLog.payrollDate
              ? `${formatDate(parseTimestamp(workLog.payrollDate)!)} 정산 완료`
              : '정산 완료'}
          </Text>
        </View>
      )}
    </Card>
  );
});

export default SettlementCard;
