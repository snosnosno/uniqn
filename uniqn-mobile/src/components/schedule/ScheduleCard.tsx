/**
 * UNIQN Mobile - ScheduleCard 컴포넌트
 *
 * @description 상태별로 다른 UI를 표시하는 스케줄 카드
 * - applied: 공고 정보 중심 (JobCard 스타일)
 * - confirmed: 역할 + 출퇴근 상태
 * - completed: 역할 + 정산 금액
 * @version 1.0.0
 */

import React, { memo, useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Timestamp } from 'firebase/firestore';
import { Card, Badge } from '@/components/ui';
import {
  CalendarIcon,
  ClockIcon,
  MapIcon,
  BriefcaseIcon,
  BanknotesIcon,
  UserIcon,
} from '@/components/icons';
import { getRoleDisplayName } from '@/types/unified';
import { formatCurrency, calculateSettlementWithTax, DEFAULT_SALARY_INFO, DEFAULT_TAX_SETTINGS, type SalaryInfo, type Allowances, type TaxSettings } from '@/utils/settlement';
import type { ScheduleEvent, ScheduleType, AttendanceStatus } from '@/types';

// ============================================================================
// Types
// ============================================================================

export interface ScheduleCardProps {
  schedule: ScheduleEvent;
  onPress?: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const statusConfig: Record<ScheduleType, { label: string; variant: 'warning' | 'success' | 'default' | 'error' }> = {
  applied: { label: '지원 중', variant: 'warning' },
  confirmed: { label: '확정', variant: 'success' },
  completed: { label: '완료', variant: 'default' },
  cancelled: { label: '취소', variant: 'error' },
};

const attendanceConfig: Record<AttendanceStatus, { label: string; bgColor: string; textColor: string }> = {
  not_started: {
    label: '출근 전',
    bgColor: 'bg-gray-100 dark:bg-gray-700',
    textColor: 'text-gray-600 dark:text-gray-400',
  },
  checked_in: {
    label: '근무 중',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    textColor: 'text-green-700 dark:text-green-300',
  },
  checked_out: {
    label: '퇴근 완료',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    textColor: 'text-blue-700 dark:text-blue-300',
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

function formatTime(timestamp: Timestamp | null): string {
  if (!timestamp) return '--:--';
  const date = timestamp.toDate();
  return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatTimeRange(start: Timestamp | null, end: Timestamp | null): string {
  return `${formatTime(start)} - ${formatTime(end)}`;
}

function calculateDuration(start: Timestamp | null, end: Timestamp | null): string {
  if (!start || !end) return '-';
  const startDate = start.toDate();
  const endDate = end.toDate();
  let diffMs = endDate.getTime() - startDate.getTime();

  // 자정을 넘어가는 경우 (예: 18:00 ~ 02:00)
  if (diffMs < 0) {
    diffMs += 24 * 60 * 60 * 1000;
  }

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0 && minutes > 0) return `${hours}시간 ${minutes}분`;
  if (hours > 0) return `${hours}시간`;
  return `${minutes}분`;
}

function formatDate(dateString: string): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
  return `${month}/${day}(${dayOfWeek})`;
}

// ============================================================================
// Component
// ============================================================================

export const ScheduleCard = memo(function ScheduleCard({
  schedule,
  onPress,
}: ScheduleCardProps) {
  const status = statusConfig[schedule.type];
  const attendance = attendanceConfig[schedule.status];

  // 구인자명
  const ownerName = schedule.jobPostingCard?.ownerName;

  // 급여 정보 추출 (JobPostingCard에서)
  const salaryDisplay = useMemo(() => {
    if (schedule.jobPostingCard?.defaultSalary) {
      const { type, amount } = schedule.jobPostingCard.defaultSalary;
      if (type === 'other') return '협의';
      const typeLabel = type === 'hourly' ? '시급' : type === 'daily' ? '일급' : '월급';
      return `${typeLabel} ${amount.toLocaleString()}원`;
    }
    return null;
  }, [schedule.jobPostingCard?.defaultSalary]);

  // 완료 상태 금액 계산 (payrollAmount 우선, 없으면 계산)
  const completedAmount = useMemo(() => {
    if (schedule.type !== 'completed') return null;

    // payrollAmount(구인자 확정 금액) 우선
    if (schedule.payrollAmount && schedule.payrollAmount > 0) {
      return schedule.payrollAmount;
    }

    // 없으면 계산 (오버라이드 데이터 우선, 세금 포함)
    if (schedule.actualStartTime && schedule.actualEndTime) {
      const salaryInfo: SalaryInfo = schedule.customSalaryInfo ||
        schedule.jobPostingCard?.defaultSalary ||
        DEFAULT_SALARY_INFO;
      const allowances: Allowances | undefined = schedule.customAllowances ||
        schedule.jobPostingCard?.allowances;
      const taxSettings: TaxSettings = schedule.customTaxSettings ||
        schedule.jobPostingCard?.taxSettings ||
        DEFAULT_TAX_SETTINGS;

      const result = calculateSettlementWithTax(
        schedule.actualStartTime,
        schedule.actualEndTime,
        salaryInfo,
        allowances,
        taxSettings
      );

      // 세금 있으면 세후 금액, 없으면 세전 금액
      const amount = taxSettings.type !== 'none' ? result.afterTaxPay : result.totalPay;
      return amount > 0 ? amount : null;
    }

    return null;
  }, [schedule]);

  // 확정 상태 시간 표시 (startTime/endTime이 없으면 timeSlot 폴백)
  const confirmedTimeDisplay = useMemo(() => {
    if (schedule.type !== 'confirmed') return null;

    // 1. startTime, endTime이 있으면 formatTimeRange 사용
    if (schedule.startTime && schedule.endTime) {
      return formatTimeRange(schedule.startTime, schedule.endTime);
    }

    // 2. 없으면 schedule.timeSlot 사용 (workLog에서 직접 매핑됨)
    if (schedule.timeSlot) {
      // "18:00~02:00" 또는 "18:00 - 02:00" 형식을 그대로 표시
      return schedule.timeSlot.replace('~', ' - ');
    }

    // 3. 마지막 폴백: jobPostingCard.timeSlot
    const cardTimeSlot = schedule.jobPostingCard?.timeSlot;
    if (cardTimeSlot) {
      return cardTimeSlot.replace('~', ' - ');
    }

    return '--:-- - --:--';
  }, [schedule]);

  const isCancelled = schedule.type === 'cancelled';

  return (
    <Pressable onPress={onPress} disabled={!onPress}>
      <Card className={`mb-3 ${isCancelled ? 'opacity-60' : ''}`}>
        {/* 상단: 상태 뱃지 + 금액(completed) */}
        <View className="flex-row items-start justify-between mb-2">
          <View className="flex-row items-center flex-wrap flex-1">
            {/* 상태 뱃지 */}
            <Badge variant={status.variant} dot>
              {status.label}
            </Badge>

            {/* 확정 상태: 출퇴근 상태 표시 */}
            {schedule.type === 'confirmed' && (
              <View className={`ml-2 px-2 py-0.5 rounded-full ${attendance.bgColor}`}>
                <Text className={`text-xs font-medium ${attendance.textColor}`}>
                  {attendance.label}
                </Text>
              </View>
            )}
          </View>

          {/* 완료 상태: 정산 금액 우측 상단 */}
          {schedule.type === 'completed' && completedAmount && (
            <Text className="text-base font-bold text-primary-600 dark:text-primary-400">
              {formatCurrency(completedAmount)}
            </Text>
          )}
        </View>

        {/* 제목 */}
        <Text
          className={`text-base font-semibold mb-2 ${
            isCancelled
              ? 'text-gray-400 dark:text-gray-500 line-through'
              : 'text-gray-900 dark:text-white'
          }`}
          numberOfLines={1}
        >
          {schedule.eventName}
        </Text>

        {/* 장소 */}
        {schedule.location && (
          <View className="flex-row items-center mb-2">
            <MapIcon size={14} color="#6B7280" />
            <Text
              className="ml-1.5 text-sm text-gray-500 dark:text-gray-400 flex-1"
              numberOfLines={1}
            >
              {schedule.location}
            </Text>
          </View>
        )}

        {/* 상태별 추가 정보 */}
        {schedule.type === 'applied' ? (
          // 지원 중: 일정 + 역할 + 급여 + 구인자
          <View>
            <View className="flex-row items-center">
              <CalendarIcon size={14} color="#6B7280" />
              <Text className="ml-1.5 text-sm text-gray-600 dark:text-gray-400">
                {formatDate(schedule.date)}
              </Text>
              <View className="mx-2 h-3 w-px bg-gray-300 dark:bg-gray-600" />
              <ClockIcon size={14} color="#6B7280" />
              <Text className="ml-1.5 text-sm text-gray-600 dark:text-gray-400">
                {formatTime(schedule.startTime)}
              </Text>
            </View>
            <View className="flex-row items-center flex-wrap mt-2">
              {/* 역할 */}
              <View className="flex-row items-center mr-3">
                <BriefcaseIcon size={14} color="#6B7280" />
                <Text className="ml-1.5 text-sm text-gray-700 dark:text-gray-300">
                  {getRoleDisplayName(schedule.role, schedule.customRole)}
                </Text>
              </View>
              {/* 급여 */}
              {salaryDisplay && (
                <View className="flex-row items-center mr-3">
                  <BanknotesIcon size={14} color="#6B7280" />
                  <Text className="ml-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
                    {salaryDisplay}
                  </Text>
                </View>
              )}
              {/* 구인자 */}
              {ownerName && (
                <View className="flex-row items-center">
                  <UserIcon size={14} color="#9CA3AF" />
                  <Text className="ml-1 text-sm text-gray-500 dark:text-gray-400">
                    {ownerName}
                  </Text>
                </View>
              )}
            </View>
          </View>
        ) : (
          // 확정/완료: 일정 + 역할
          <View>
            <View className="flex-row items-center">
              <CalendarIcon size={14} color="#6B7280" />
              <Text className="ml-1.5 text-sm text-gray-600 dark:text-gray-400">
                {formatDate(schedule.date)}
              </Text>
              <View className="mx-2 h-3 w-px bg-gray-300 dark:bg-gray-600" />
              <ClockIcon size={14} color="#6B7280" />
              <Text className="ml-1.5 text-sm text-gray-600 dark:text-gray-400">
                {schedule.type === 'completed'
                  ? // 완료: 근무시간 표시
                    calculateDuration(
                      schedule.actualStartTime || schedule.startTime,
                      schedule.actualEndTime || schedule.endTime
                    )
                  : // 확정: 예정시간 범위 표시 (timeSlot 폴백)
                    confirmedTimeDisplay}
              </Text>
            </View>
            <View className="flex-row items-center mt-2">
              <BriefcaseIcon size={14} color="#6B7280" />
              <Text className="ml-1.5 text-sm text-gray-700 dark:text-gray-300">
                {getRoleDisplayName(schedule.role, schedule.customRole)}
              </Text>
            </View>
          </View>
        )}

        {/* 취소됨 안내 */}
        {isCancelled && (
          <View className="mt-3 py-2 px-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <Text className="text-xs text-red-600 dark:text-red-400 text-center">
              이 스케줄은 취소되었습니다
            </Text>
          </View>
        )}
      </Card>
    </Pressable>
  );
});

export default ScheduleCard;
