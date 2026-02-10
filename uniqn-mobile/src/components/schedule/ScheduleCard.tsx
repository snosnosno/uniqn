/**
 * UNIQN Mobile - ScheduleCard 컴포넌트
 *
 * @description 상태별로 다른 UI를 표시하는 스케줄 카드
 * - applied: 공고 정보 중심 (JobCard 스타일)
 * - confirmed: 역할 + 출퇴근 상태
 * - completed: 역할 + 정산 금액
 * @version 1.1.0 - 헬퍼 분리
 */

import React, { memo, useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
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
import {
  formatCurrency,
  calculateSettlementWithTax,
  DEFAULT_SALARY_INFO,
  DEFAULT_TAX_SETTINGS,
  type SalaryInfo,
  type Allowances,
  type TaxSettings,
} from '@/utils/settlement';
import {
  formatTime,
  formatDate,
  getRoleSalaryFromCard,
  statusConfig,
  attendanceConfig,
} from './helpers';
import { STATUS } from '@/constants';
import { WorkTimeDisplay } from '@/shared/time';
import type { ScheduleEvent } from '@/types';

// ============================================================================
// Types
// ============================================================================

export interface ScheduleCardProps {
  schedule: ScheduleEvent;
  onPress?: () => void;
}

// ============================================================================
// Component
// ============================================================================

export const ScheduleCard = memo(function ScheduleCard({ schedule, onPress }: ScheduleCardProps) {
  const status = statusConfig[schedule.type];
  const attendance = attendanceConfig[schedule.status];

  // 구인자명
  const ownerName = schedule.jobPostingCard?.ownerName;

  // 급여 정보 추출 (역할별 급여 우선, defaultSalary 폴백)
  const salaryDisplay = useMemo(() => {
    const card = schedule.jobPostingCard;
    if (!card) return null;

    // 1. 역할별 급여 조회
    const roleSalary = getRoleSalaryFromCard(
      card,
      schedule.date,
      schedule.role,
      schedule.customRole
    );
    const salary = roleSalary || card.defaultSalary;

    if (salary) {
      const { type, amount } = salary;
      if (type === 'other') return '협의';
      const typeLabel = type === 'hourly' ? '시급' : type === 'daily' ? '일급' : '월급';
      return `${typeLabel} ${amount.toLocaleString()}원`;
    }
    return null;
  }, [schedule.jobPostingCard, schedule.date, schedule.role, schedule.customRole]);

  // 완료 상태 금액 계산 (payrollAmount 우선, 없으면 계산)
  const completedAmount = useMemo(() => {
    if (schedule.type !== STATUS.SCHEDULE.COMPLETED) return null;

    // payrollAmount(구인자 확정 금액) 우선
    if (schedule.payrollAmount && schedule.payrollAmount > 0) {
      return schedule.payrollAmount;
    }

    // 없으면 계산 (오버라이드 데이터 우선, 세금 포함)
    if (schedule.checkInTime && schedule.checkOutTime) {
      // 역할별 급여 조회 (customSalaryInfo > 역할별 급여 > defaultSalary)
      const roleSalary = getRoleSalaryFromCard(
        schedule.jobPostingCard,
        schedule.date,
        schedule.role,
        schedule.customRole
      );
      const salaryInfo: SalaryInfo =
        schedule.customSalaryInfo ||
        roleSalary ||
        schedule.jobPostingCard?.defaultSalary ||
        DEFAULT_SALARY_INFO;
      const allowances: Allowances | undefined =
        schedule.customAllowances || schedule.jobPostingCard?.allowances;
      const taxSettings: TaxSettings =
        schedule.customTaxSettings || schedule.jobPostingCard?.taxSettings || DEFAULT_TAX_SETTINGS;

      const result = calculateSettlementWithTax(
        schedule.checkInTime,
        schedule.checkOutTime,
        salaryInfo,
        allowances,
        taxSettings
      );

      // 세금 있으면 세후 금액, 없으면 세전 금액
      const amount = taxSettings.type !== 'none' ? result.afterTaxPay : result.totalPay;
      return amount > 0 ? amount : null;
    }

    return null;
  }, [
    schedule.type,
    schedule.payrollAmount,
    schedule.checkInTime,
    schedule.checkOutTime,
    schedule.date,
    schedule.role,
    schedule.customRole,
    schedule.customSalaryInfo,
    schedule.customAllowances,
    schedule.customTaxSettings,
    schedule.jobPostingCard,
  ]);

  // 시간 표시 정보 (WorkTimeDisplay 사용 - 구인자 화면과 일관성 확보)
  const timeDisplayInfo = useMemo(() => {
    return WorkTimeDisplay.getDisplayInfo(schedule);
  }, [schedule]);

  // 확정 상태 시간 표시 (예정 시간)
  const confirmedTimeDisplay = useMemo(() => {
    if (schedule.type !== STATUS.SCHEDULE.CONFIRMED) return null;
    return `${timeDisplayInfo.scheduledStart} - ${timeDisplayInfo.scheduledEnd}`;
  }, [schedule.type, timeDisplayInfo]);

  const isCancelled = schedule.type === STATUS.SCHEDULE.CANCELLED;

  // 접근성 라벨 생성
  const accessibilityLabel = `${schedule.jobPostingName}, ${status.label}, ${formatDate(schedule.date)}${schedule.location ? `, ${schedule.location}` : ''}`;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Card className={`mb-3 ${isCancelled ? 'opacity-60' : ''}`}>
        {/* 상단: 상태 뱃지 + 금액(completed) */}
        <View className="flex-row items-start justify-between mb-2">
          <View className="flex-row items-center flex-wrap flex-1">
            {/* 상태 뱃지 */}
            <Badge variant={status.variant} dot>
              {status.label}
            </Badge>

            {/* 확정 상태: 출퇴근 상태 표시 */}
            {schedule.type === STATUS.SCHEDULE.CONFIRMED && (
              <View className={`ml-2 px-2 py-0.5 rounded-full ${attendance.bgColor}`}>
                <Text className={`text-xs font-medium ${attendance.textColor}`}>
                  {attendance.label}
                </Text>
              </View>
            )}
          </View>

          {/* 완료 상태: 정산 금액 우측 상단 */}
          {schedule.type === STATUS.SCHEDULE.COMPLETED && completedAmount && (
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
          {schedule.jobPostingName}
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
        {schedule.type === STATUS.SCHEDULE.APPLIED ? (
          // 지원 중: 일정 + 역할 + 급여 + 구인자
          <View>
            <View className="flex-row items-center">
              <CalendarIcon size={14} color="#6B7280" />
              <Text className="ml-1.5 text-sm text-gray-600 dark:text-gray-400">
                {formatDate(schedule.date)}
              </Text>
              <View className="mx-2 h-3 w-px bg-gray-300 dark:bg-surface-elevated" />
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
                  <Text className="ml-1 text-sm text-gray-500 dark:text-gray-400">{ownerName}</Text>
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
              <View className="mx-2 h-3 w-px bg-gray-300 dark:bg-surface-elevated" />
              <ClockIcon size={14} color="#6B7280" />
              <Text className="ml-1.5 text-sm text-gray-600 dark:text-gray-400">
                {schedule.type === STATUS.SCHEDULE.COMPLETED
                  ? // 완료: 근무시간 표시 (WorkTimeDisplay 사용)
                    timeDisplayInfo.duration
                  : // 확정: 예정시간 범위 표시 (WorkTimeDisplay 사용)
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
