/**
 * UNIQN Mobile - 스케줄 상세 모달 정보 탭
 *
 * @description 공고 정보, 장소, 일정, 역할, 급여 정보 표시
 * @version 1.1.0
 */

import React, { memo, useMemo } from 'react';
import { View, Text, Pressable, Linking } from 'react-native';
import { Timestamp } from 'firebase/firestore';
import { Badge } from '@/components/ui';
import {
  DocumentIcon,
  MapIcon,
  CalendarIcon,
  ClockIcon,
  UserIcon,
  BriefcaseIcon,
  PhoneIcon,
  BanknotesIcon,
} from '@/components/icons';
import { getRoleDisplayName } from '@/types/unified';
import { formatCurrency, SALARY_TYPE_LABELS } from '@/utils/settlement';
import type { ScheduleEvent, PayrollStatus } from '@/types';

// ============================================================================
// Types
// ============================================================================

export interface InfoTabProps {
  schedule: ScheduleEvent;
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

// ============================================================================
// Helpers
// ============================================================================

function formatTime(timestamp: Timestamp | string | null | undefined): string {
  if (!timestamp) return '--:--';
  const date = typeof timestamp === 'string'
    ? new Date(timestamp)
    : timestamp.toDate();
  return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
}

/**
 * 전화번호 포맷팅 (010-1234-5678 형식)
 */
function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7)}`;
  }
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
}

/**
 * 시간 표시 (timeSlot 폴백 포함 - 스태프관리화면 동기화)
 */
function getTimeDisplay(schedule: ScheduleEvent): string {
  // 우선순위 1: Timestamp 시간 (actualStartTime/actualEndTime 또는 startTime/endTime)
  if (schedule.startTime && schedule.endTime) {
    return `${formatTime(schedule.startTime)} - ${formatTime(schedule.endTime)}`;
  }
  // 우선순위 2: timeSlot 문자열 폴백 (스태프관리화면과 동일)
  if (schedule.timeSlot) {
    return schedule.timeSlot.replace('~', ' - ');
  }
  return '--:-- - --:--';
}

function formatFullDate(dateString: string): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });
}

function calculateDuration(
  start: Timestamp | string | null | undefined,
  end: Timestamp | string | null | undefined
): string {
  if (!start || !end) return '-';
  const startDate = typeof start === 'string' ? new Date(start) : start.toDate();
  const endDate = typeof end === 'string' ? new Date(end) : end.toDate();
  const diffMs = endDate.getTime() - startDate.getTime();
  if (diffMs <= 0) return '-';
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0 && minutes > 0) return `${hours}시간 ${minutes}분`;
  if (hours > 0) return `${hours}시간`;
  return `${minutes}분`;
}

// ============================================================================
// Sub Components
// ============================================================================

interface SectionProps {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}

function Section({ icon, title, children }: SectionProps) {
  return (
    <View className="mb-5">
      <View className="flex-row items-center mb-2">
        {icon}
        <Text className="ml-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
          {title}
        </Text>
      </View>
      <View className="ml-6">{children}</View>
    </View>
  );
}

// ============================================================================
// Component
// ============================================================================

export const InfoTab = memo(function InfoTab({ schedule }: InfoTabProps) {
  const ownerName = schedule.jobPostingCard?.ownerName;
  const payrollStatus = (schedule.payrollStatus || 'pending') as PayrollStatus;
  const statusConfig = PAYROLL_STATUS_CONFIG[payrollStatus];

  // 급여 정보 (settlementBreakdown > customSalaryInfo > jobPostingCard)
  const salaryInfo = useMemo(() => {
    if (schedule.settlementBreakdown?.salaryInfo) {
      return schedule.settlementBreakdown.salaryInfo;
    }
    if (schedule.customSalaryInfo) {
      return schedule.customSalaryInfo;
    }
    if (schedule.jobPostingCard?.defaultSalary) {
      return schedule.jobPostingCard.defaultSalary;
    }
    return null;
  }, [schedule.settlementBreakdown?.salaryInfo, schedule.customSalaryInfo, schedule.jobPostingCard?.defaultSalary]);

  // 취소 상태면 별도 UI
  if (schedule.type === 'cancelled') {
    return (
      <View className="py-2 opacity-70">
        {/* 취소 안내 배너 */}
        <View className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-xl">
          <Text className="text-sm text-red-600 dark:text-red-400 text-center font-medium">
            취소된 스케줄입니다
          </Text>
        </View>

        {/* 기본 정보만 표시 */}
        <Section icon={<DocumentIcon size={18} color="#9CA3AF" />} title="공고 정보">
          <Text className="text-base text-gray-500 dark:text-gray-400">
            {schedule.eventName}
          </Text>
        </Section>

        <Section icon={<CalendarIcon size={18} color="#9CA3AF" />} title="일정">
          <Text className="text-base text-gray-500 dark:text-gray-400">
            {formatFullDate(schedule.date)}
          </Text>
          <View className="flex-row items-center mt-1">
            <ClockIcon size={14} color="#9CA3AF" />
            <Text className="ml-1.5 text-sm text-gray-400 dark:text-gray-500">
              {getTimeDisplay(schedule)}
            </Text>
          </View>
        </Section>
      </View>
    );
  }

  return (
    <View className="py-2">
      {/* 공고 정보 */}
      <Section icon={<DocumentIcon size={18} color="#6B7280" />} title="공고 정보">
        <Text className="text-base text-gray-900 dark:text-white font-medium">
          {schedule.eventName}
        </Text>
        {ownerName && (
          <View className="flex-row items-center mt-1">
            <UserIcon size={14} color="#9CA3AF" />
            <Text className="ml-1.5 text-sm text-gray-500 dark:text-gray-400">
              구인자: {ownerName}
            </Text>
          </View>
        )}
      </Section>

      {/* 역할 정보 */}
      <Section icon={<BriefcaseIcon size={18} color="#6B7280" />} title="역할">
        <Text className="text-base text-gray-900 dark:text-white font-medium">
          {getRoleDisplayName(schedule.role, schedule.customRole)}
        </Text>
      </Section>

      {/* 장소 */}
      <Section icon={<MapIcon size={18} color="#6B7280" />} title="장소">
        <Text className="text-base text-gray-900 dark:text-white">
          {schedule.location || '-'}
        </Text>
        {schedule.detailedAddress && (
          <Text className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {schedule.detailedAddress}
          </Text>
        )}
      </Section>

      {/* 일정 - 상태별 다르게 표시 */}
      <Section icon={<CalendarIcon size={18} color="#6B7280" />} title="일정">
        <Text className="text-base text-gray-900 dark:text-white">
          {formatFullDate(schedule.date)}
        </Text>

        {schedule.type === 'completed' ? (
          // 완료 상태: 실제 근무시간 + 예정 시간 비교
          <View className="mt-2">
            {(schedule.actualStartTime || schedule.actualEndTime) && (
              <View className="flex-row items-center">
                <ClockIcon size={14} color="#2563EB" />
                <Text className="ml-1.5 text-sm text-primary-600 dark:text-primary-400 font-medium">
                  실제: {formatTime(schedule.actualStartTime)} - {formatTime(schedule.actualEndTime)}
                </Text>
                <Text className="ml-2 text-sm text-primary-500 dark:text-primary-500">
                  ({calculateDuration(schedule.actualStartTime, schedule.actualEndTime)})
                </Text>
              </View>
            )}
            <View className="flex-row items-center mt-1">
              <ClockIcon size={14} color="#9CA3AF" />
              <Text className="ml-1.5 text-sm text-gray-500 dark:text-gray-400">
                예정: {getTimeDisplay(schedule)}
              </Text>
              <Text className="ml-2 text-sm text-gray-400 dark:text-gray-500">
                ({calculateDuration(schedule.startTime, schedule.endTime)})
              </Text>
            </View>
          </View>
        ) : (
          // 지원중/확정 상태: 예정 시간 (timeSlot 폴백 적용)
          <View className="flex-row items-center mt-2">
            <ClockIcon size={14} color="#9CA3AF" />
            <Text className="ml-1.5 text-sm text-gray-600 dark:text-gray-400">
              {getTimeDisplay(schedule)}
            </Text>
            {(schedule.startTime && schedule.endTime) && (
              <Text className="ml-2 text-sm text-gray-500 dark:text-gray-500">
                (예정 {calculateDuration(schedule.startTime, schedule.endTime)})
              </Text>
            )}
          </View>
        )}
      </Section>

      {/* 구인자 연락처 */}
      {schedule.ownerPhone && (
        <Section icon={<PhoneIcon size={18} color="#6B7280" />} title="구인자 연락처">
          <Pressable
            onPress={() => Linking.openURL(`tel:${schedule.ownerPhone}`)}
            className="flex-row items-center py-2 px-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg active:bg-primary-100 dark:active:bg-primary-900/30"
          >
            <Text className="text-base text-primary-600 dark:text-primary-400 font-medium">
              {formatPhoneNumber(schedule.ownerPhone!)}
            </Text>
            <View className="ml-auto flex-row items-center">
              <PhoneIcon size={16} color="#2563EB" />
              <Text className="ml-1 text-sm text-primary-600 dark:text-primary-400">
                전화하기
              </Text>
            </View>
          </Pressable>
        </Section>
      )}

      {/* 급여 정보 (지원중/확정 상태) */}
      {(schedule.type === 'applied' || schedule.type === 'confirmed') && salaryInfo && (
        <Section icon={<BanknotesIcon size={18} color="#6B7280" />} title="예상 급여">
          <View className="p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
            <Text className="text-base text-gray-900 dark:text-white font-medium">
              {SALARY_TYPE_LABELS[salaryInfo.type]} {salaryInfo.amount.toLocaleString()}원
            </Text>
            {schedule.settlementBreakdown && (
              <Text className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                예상 정산: {formatCurrency(schedule.settlementBreakdown.afterTaxPay)}
              </Text>
            )}
          </View>
        </Section>
      )}

      {/* 정산 현황 (완료 상태) */}
      {schedule.type === 'completed' && (
        <Section icon={<BanknotesIcon size={18} color="#6B7280" />} title="정산 현황">
          <View className="flex-row items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
            <View>
              {schedule.settlementBreakdown && (
                <Text className="text-base text-gray-900 dark:text-white font-medium">
                  {formatCurrency(schedule.settlementBreakdown.afterTaxPay)}
                </Text>
              )}
              {schedule.payrollAmount && schedule.payrollAmount > 0 && (
                <Text className="text-sm text-green-600 dark:text-green-400 mt-0.5">
                  확정: {formatCurrency(schedule.payrollAmount)}
                </Text>
              )}
            </View>
            <Badge variant={statusConfig.variant} size="sm">
              {statusConfig.label}
            </Badge>
          </View>
        </Section>
      )}

      {/* 메모 */}
      {schedule.notes && (
        <Section icon={<DocumentIcon size={18} color="#6B7280" />} title="메모">
          <Text className="text-sm text-gray-600 dark:text-gray-400">
            {schedule.notes}
          </Text>
        </Section>
      )}
    </View>
  );
});

export default InfoTab;
