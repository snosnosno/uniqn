/**
 * UNIQN Mobile - 스케줄 상세 모달 정보 탭
 *
 * @description 공고 정보, 장소, 일정, 역할, 급여 정보 표시
 * @version 1.1.0
 */

import React, { memo, useMemo } from 'react';
import { View, Text, Pressable, Linking } from 'react-native';
import { Timestamp } from '@/lib/firebase';
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
import {
  formatCurrency,
  SALARY_TYPE_LABELS,
  PROVIDED_FLAG,
  DEFAULT_TAX_SETTINGS,
  type Allowances,
  type TaxSettings,
} from '@/utils/settlement';
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
  // 우선순위 1: Timestamp 시간 (checkInTime/checkOutTime 또는 startTime/endTime)
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

  // 수당 정보 (settlementBreakdown > customAllowances > jobPostingCard)
  const allowances: Allowances | undefined = useMemo(() => {
    if (schedule.settlementBreakdown?.allowances) {
      return schedule.settlementBreakdown.allowances;
    }
    return schedule.customAllowances || schedule.jobPostingCard?.allowances;
  }, [schedule.settlementBreakdown?.allowances, schedule.customAllowances, schedule.jobPostingCard?.allowances]);

  // 세금 설정 (settlementBreakdown > customTaxSettings > jobPostingCard)
  const taxSettings: TaxSettings = useMemo(() => {
    if (schedule.settlementBreakdown?.taxSettings) {
      return schedule.settlementBreakdown.taxSettings;
    }
    return schedule.customTaxSettings ||
      schedule.jobPostingCard?.taxSettings ||
      DEFAULT_TAX_SETTINGS;
  }, [schedule.settlementBreakdown?.taxSettings, schedule.customTaxSettings, schedule.jobPostingCard?.taxSettings]);

  // 수당이 있는지 확인 (보장시간 제외)
  const hasAllowances = useMemo(() => {
    if (!allowances) return false;
    return (
      (allowances.meal !== undefined && allowances.meal !== 0) ||
      (allowances.transportation !== undefined && allowances.transportation !== 0) ||
      (allowances.accommodation !== undefined && allowances.accommodation !== 0)
    );
  }, [allowances]);

  // 세금이 있는지 확인
  const hasTax = taxSettings.type !== 'none';

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
            {schedule.jobPostingName}
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

  // 공고 설명
  const description = schedule.jobPostingCard?.description;

  return (
    <View className="py-2">
      {/* 공고 설명 (있으면) */}
      {description && (
        <Section icon={<DocumentIcon size={18} color="#6B7280" />} title="공고 설명">
          <Text className="text-sm text-gray-700 dark:text-gray-300 leading-5">
            {description}
          </Text>
        </Section>
      )}

      {/* 역할 정보 - 같은 행 */}
      <View className="flex-row items-center mb-4">
        <BriefcaseIcon size={18} color="#6B7280" />
        <Text className="ml-2 text-sm text-gray-600 dark:text-gray-400">역할 :</Text>
        <Text className="ml-2 text-base font-medium text-gray-900 dark:text-white">
          {getRoleDisplayName(schedule.role, schedule.customRole)}
        </Text>
      </View>

      {/* 장소 - 같은 행 (긴 텍스트는 들여쓰기 줄바꿈) */}
      <View className="mb-4">
        <View className="flex-row items-start">
          <MapIcon size={18} color="#6B7280" />
          <Text className="ml-2 text-sm text-gray-600 dark:text-gray-400">장소 :</Text>
          <View className="ml-2 flex-1">
            <Text className="text-base font-medium text-gray-900 dark:text-white">
              {schedule.location || '-'}
            </Text>
            {schedule.detailedAddress && (
              <Text className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                {schedule.detailedAddress}
              </Text>
            )}
          </View>
        </View>
      </View>

      {/* 일정 - 상태별 다르게 표시 */}
      <Section icon={<CalendarIcon size={18} color="#6B7280" />} title="일정">
        <Text className="text-base text-gray-900 dark:text-white">
          {formatFullDate(schedule.date)}
        </Text>

        {schedule.type === 'completed' ? (
          // 완료 상태: 실제 근무시간 + 예정 시간 비교
          <View className="mt-2">
            {(schedule.checkInTime || schedule.checkOutTime) && (
              <View className="flex-row items-center">
                <ClockIcon size={14} color="#2563EB" />
                <Text className="ml-1.5 text-sm text-primary-600 dark:text-primary-400 font-medium">
                  실제: {formatTime(schedule.checkInTime)} - {formatTime(schedule.checkOutTime)}
                </Text>
                <Text className="ml-2 text-sm text-primary-500 dark:text-primary-500">
                  ({calculateDuration(schedule.checkInTime, schedule.checkOutTime)})
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

      {/* 구인자 연락처 (구인자 정보 포함) */}
      {(ownerName || schedule.ownerPhone) && (
        <Section icon={<PhoneIcon size={18} color="#6B7280" />} title="구인자 연락처">
          {/* 구인자 이름 */}
          {ownerName && (
            <View className="flex-row items-center mb-2">
              <UserIcon size={14} color="#9CA3AF" />
              <Text className="ml-1.5 text-sm text-gray-600 dark:text-gray-400">
                구인자: {ownerName}
              </Text>
            </View>
          )}
          {/* 전화번호 */}
          {schedule.ownerPhone && (
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
          )}
        </Section>
      )}

      {/* 급여 정보 (모든 상태) */}
      {salaryInfo && (
        <Section icon={<BanknotesIcon size={18} color="#6B7280" />} title="급여 정보">
          <View className="p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
            {/* 급여 타입 + 금액 */}
            <Text className="text-base text-gray-900 dark:text-white font-medium">
              {SALARY_TYPE_LABELS[salaryInfo.type]} {salaryInfo.amount.toLocaleString()}원
            </Text>

            {/* 수당 정보 (있는 것만 표시, 보장시간 제외) */}
            {hasAllowances && (
              <View className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                {/* 식비 */}
                {allowances?.meal !== undefined && allowances.meal !== 0 && (
                  <View className="flex-row justify-between items-center py-1">
                    <Text className="text-sm text-gray-600 dark:text-gray-400">식비</Text>
                    <Text className={`text-sm font-medium ${
                      allowances.meal === PROVIDED_FLAG
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-gray-900 dark:text-white'
                    }`}>
                      {allowances.meal === PROVIDED_FLAG ? '제공' : `${allowances.meal.toLocaleString()}원`}
                    </Text>
                  </View>
                )}
                {/* 교통비 */}
                {allowances?.transportation !== undefined && allowances.transportation !== 0 && (
                  <View className="flex-row justify-between items-center py-1">
                    <Text className="text-sm text-gray-600 dark:text-gray-400">교통비</Text>
                    <Text className={`text-sm font-medium ${
                      allowances.transportation === PROVIDED_FLAG
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-gray-900 dark:text-white'
                    }`}>
                      {allowances.transportation === PROVIDED_FLAG ? '제공' : `${allowances.transportation.toLocaleString()}원`}
                    </Text>
                  </View>
                )}
                {/* 숙박비 */}
                {allowances?.accommodation !== undefined && allowances.accommodation !== 0 && (
                  <View className="flex-row justify-between items-center py-1">
                    <Text className="text-sm text-gray-600 dark:text-gray-400">숙박비</Text>
                    <Text className={`text-sm font-medium ${
                      allowances.accommodation === PROVIDED_FLAG
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-gray-900 dark:text-white'
                    }`}>
                      {allowances.accommodation === PROVIDED_FLAG ? '제공' : `${allowances.accommodation.toLocaleString()}원`}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* 세금 정보 (설정 있으면 표시) */}
            {hasTax && (
              <View className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                <View className="flex-row justify-between items-center py-1">
                  <Text className="text-sm text-gray-600 dark:text-gray-400">세금</Text>
                  <Text className="text-sm font-medium text-red-600 dark:text-red-400">
                    {taxSettings.type === 'rate' ? `${taxSettings.value}%` : `${taxSettings.value.toLocaleString()}원`}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </Section>
      )}

      {/* 정산 현황 (완료 상태만) */}
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
