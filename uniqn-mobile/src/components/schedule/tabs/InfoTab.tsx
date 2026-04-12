/**
 * UNIQN Mobile - schedule detail info tab
 */

import React, { memo, useMemo } from 'react';
import { View, Text, Pressable, Linking } from 'react-native';
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
  type Allowances,
  type TaxSettings,
} from '@/utils/settlement';
import {
  PROVIDED_FLAG,
  DEFAULT_TAX_SETTINGS,
  getRoleSalaryFromSettlementSource,
} from '@/domains/settlement';
import { WorkTimeDisplay } from '@/shared/time';
import { formatPhoneNumber } from '@/utils/phone';
import { STATUS } from '@/constants';
import { PAYROLL_STATUS } from '@/constants/statusConfig';
import type { ScheduleEvent, PayrollStatus } from '@/types';
import { formatDateKoreanWithDay } from '@/utils/date';

export interface InfoTabProps {
  schedule: ScheduleEvent;
}

function getTimeDisplay(schedule: ScheduleEvent): string {
  const info = WorkTimeDisplay.getDisplayInfo(schedule);
  return `${info.effectiveStart} - ${info.effectiveEnd}`;
}

function getActualTimeDisplay(schedule: ScheduleEvent): string | null {
  return WorkTimeDisplay.getActualTimeRange(schedule);
}

function getWorkDuration(schedule: ScheduleEvent): string {
  return WorkTimeDisplay.getDisplayInfo(schedule).duration;
}

function formatFullDate(dateString: string): string {
  return formatDateKoreanWithDay(dateString) || dateString || '-';
}

interface SectionProps {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}

function Section({ icon, title, children }: SectionProps) {
  return (
    <View className="mb-5">
      <View className="mb-2 flex-row items-center">
        {icon}
        <Text className="ml-2 text-sm font-semibold text-secondary-700 dark:text-secondary-300">
          {title}
        </Text>
      </View>
      <View className="ml-6">{children}</View>
    </View>
  );
}

export const InfoTab = memo(function InfoTab({ schedule }: InfoTabProps) {
  const ownerName = schedule.postingProjection?.ownerName;
  const description = schedule.postingProjection?.description;
  const payrollStatus = (schedule.payrollStatus || STATUS.PAYROLL.PENDING) as PayrollStatus;
  const payrollStatusConfig = PAYROLL_STATUS[payrollStatus];

  const salaryInfo = useMemo(() => {
    if (schedule.settlementBreakdown?.salaryInfo) {
      return schedule.settlementBreakdown.salaryInfo;
    }
    if (schedule.customSalaryInfo) {
      return schedule.customSalaryInfo;
    }
    return getRoleSalaryFromSettlementSource(
      schedule.postingProjection?.settlement,
      schedule.role,
      schedule.customRole
    );
  }, [
    schedule.settlementBreakdown?.salaryInfo,
    schedule.customSalaryInfo,
    schedule.postingProjection,
    schedule.role,
    schedule.customRole,
  ]);

  const allowances: Allowances | undefined = useMemo(() => {
    if (schedule.settlementBreakdown?.allowances) {
      return schedule.settlementBreakdown.allowances;
    }
    return schedule.customAllowances || schedule.postingProjection?.settlement.allowances;
  }, [
    schedule.settlementBreakdown?.allowances,
    schedule.customAllowances,
    schedule.postingProjection,
  ]);

  const taxSettings: TaxSettings = useMemo(() => {
    if (schedule.settlementBreakdown?.taxSettings) {
      return schedule.settlementBreakdown.taxSettings;
    }
    return (
      schedule.customTaxSettings ||
      schedule.postingProjection?.settlement.taxSettings ||
      DEFAULT_TAX_SETTINGS
    );
  }, [
    schedule.settlementBreakdown?.taxSettings,
    schedule.customTaxSettings,
    schedule.postingProjection,
  ]);

  const hasAllowances = useMemo(() => {
    if (!allowances) return false;
    return (
      (allowances.meal !== undefined && allowances.meal !== 0) ||
      (allowances.transportation !== undefined && allowances.transportation !== 0) ||
      (allowances.accommodation !== undefined && allowances.accommodation !== 0)
    );
  }, [allowances]);

  const hasTax = taxSettings.type !== 'none';

  if (schedule.type === STATUS.SCHEDULE.CANCELLED) {
    return (
      <View className="py-2 opacity-70">
        <View className="mb-4 rounded-md bg-error-50 p-4 dark:bg-error-900/20">
          <Text className="text-center text-sm font-medium text-error-600 dark:text-error-400">
            취소된 일정입니다
          </Text>
        </View>

        <Section icon={<DocumentIcon size={18} color="#A89C84" />} title="공고 정보">
          <Text className="text-base text-secondary-500 dark:text-secondary-400">
            {schedule.jobPostingName}
          </Text>
        </Section>

        <Section icon={<CalendarIcon size={18} color="#A89C84" />} title="일정">
          <Text className="text-base text-secondary-500 dark:text-secondary-400">
            {formatFullDate(schedule.date)}
          </Text>
          <View className="mt-1 flex-row items-center">
            <ClockIcon size={14} color="#A89C84" />
            <Text className="ml-1.5 text-sm text-secondary-400 dark:text-secondary-500">
              {getTimeDisplay(schedule)}
            </Text>
          </View>
        </Section>
      </View>
    );
  }

  return (
    <View className="py-2">
      {description && (
        <Section icon={<DocumentIcon size={18} color="#9A9078" />} title="공고 설명">
          <Text className="text-sm leading-5 text-secondary-700 dark:text-secondary-300">
            {description}
          </Text>
        </Section>
      )}

      <View className="mb-4 flex-row items-center">
        <BriefcaseIcon size={18} color="#9A9078" />
        <Text className="ml-2 text-sm text-secondary-600 dark:text-secondary-400">역할 :</Text>
        <Text className="ml-2 text-base font-medium text-secondary-900 dark:text-off-white">
          {getRoleDisplayName(schedule.role, schedule.customRole)}
        </Text>
      </View>

      <View className="mb-4">
        <View className="flex-row items-start">
          <MapIcon size={18} color="#9A9078" />
          <Text className="ml-2 text-sm text-secondary-600 dark:text-secondary-400">장소 :</Text>
          <View className="ml-2 flex-1">
            <Text className="text-base font-medium text-secondary-900 dark:text-off-white">
              {schedule.location || '-'}
            </Text>
            {schedule.detailedAddress && (
              <Text className="mt-0.5 text-sm text-secondary-500 dark:text-secondary-400">
                {schedule.detailedAddress}
              </Text>
            )}
          </View>
        </View>
      </View>

      <Section icon={<CalendarIcon size={18} color="#9A9078" />} title="일정">
        <Text className="text-base text-secondary-900 dark:text-off-white">
          {formatFullDate(schedule.date)}
        </Text>

        {schedule.type === STATUS.SCHEDULE.COMPLETED ? (
          <View className="mt-2">
            {getActualTimeDisplay(schedule) && (
              <View className="flex-row items-center">
                <ClockIcon size={14} color="#B8962E" />
                <Text className="ml-1.5 text-sm font-medium text-primary-600 dark:text-primary-400">
                  실제: {getActualTimeDisplay(schedule)}
                </Text>
                <Text className="ml-2 text-sm text-primary-500 dark:text-primary-500">
                  ({getWorkDuration(schedule)})
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View className="mt-2 flex-row items-center">
            <ClockIcon size={14} color="#A89C84" />
            <Text className="ml-1.5 text-sm text-secondary-600 dark:text-secondary-400">
              {getTimeDisplay(schedule)}
            </Text>
          </View>
        )}
      </Section>

      {(ownerName || schedule.ownerPhone) && (
        <Section icon={<PhoneIcon size={18} color="#9A9078" />} title="구인자 연락처">
          {ownerName && (
            <View className="mb-2 flex-row items-center">
              <UserIcon size={14} color="#A89C84" />
              <Text className="ml-1.5 text-sm text-secondary-600 dark:text-secondary-400">
                구인자: {ownerName}
              </Text>
            </View>
          )}

          {schedule.ownerPhone && (
            <Pressable
              onPress={() => Linking.openURL(`tel:${schedule.ownerPhone}`)}
              className="flex-row items-center rounded-lg bg-primary-50 px-3 py-2 active:bg-primary-100 dark:bg-primary-900/20 dark:active:bg-primary-900/30"
            >
              <Text className="text-base font-medium text-primary-600 dark:text-primary-400">
                {formatPhoneNumber(schedule.ownerPhone)}
              </Text>
              <View className="ml-auto flex-row items-center">
                <PhoneIcon size={16} color="#B8962E" />
                <Text className="ml-1 text-sm text-primary-600 dark:text-primary-400">
                  전화하기
                </Text>
              </View>
            </Pressable>
          )}
        </Section>
      )}

      {salaryInfo && (
        <Section icon={<BanknotesIcon size={18} color="#9A9078" />} title="급여 정보">
          <View className="rounded-lg bg-secondary-50 p-3 dark:bg-surface/30">
            <Text className="text-base font-medium text-secondary-900 dark:text-off-white">
              {SALARY_TYPE_LABELS[salaryInfo.type]} {salaryInfo.amount.toLocaleString()}원
            </Text>

            {hasAllowances && (
              <View className="mt-2 border-t border-secondary-200 pt-2 dark:border-surface-overlay">
                {allowances?.meal !== undefined && allowances.meal !== 0 && (
                  <View className="flex-row items-center justify-between py-1">
                    <Text className="text-sm text-secondary-600 dark:text-secondary-400">식비</Text>
                    <Text
                      className={`text-sm font-medium ${
                        allowances.meal === PROVIDED_FLAG
                          ? 'text-success-600 dark:text-success-400'
                          : 'text-secondary-900 dark:text-off-white'
                      }`}
                    >
                      {allowances.meal === PROVIDED_FLAG
                        ? '제공'
                        : `${allowances.meal.toLocaleString()}원`}
                    </Text>
                  </View>
                )}

                {allowances?.transportation !== undefined && allowances.transportation !== 0 && (
                  <View className="flex-row items-center justify-between py-1">
                    <Text className="text-sm text-secondary-600 dark:text-secondary-400">
                      교통비
                    </Text>
                    <Text
                      className={`text-sm font-medium ${
                        allowances.transportation === PROVIDED_FLAG
                          ? 'text-success-600 dark:text-success-400'
                          : 'text-secondary-900 dark:text-off-white'
                      }`}
                    >
                      {allowances.transportation === PROVIDED_FLAG
                        ? '제공'
                        : `${allowances.transportation.toLocaleString()}원`}
                    </Text>
                  </View>
                )}

                {allowances?.accommodation !== undefined && allowances.accommodation !== 0 && (
                  <View className="flex-row items-center justify-between py-1">
                    <Text className="text-sm text-secondary-600 dark:text-secondary-400">
                      숙박비
                    </Text>
                    <Text
                      className={`text-sm font-medium ${
                        allowances.accommodation === PROVIDED_FLAG
                          ? 'text-success-600 dark:text-success-400'
                          : 'text-secondary-900 dark:text-off-white'
                      }`}
                    >
                      {allowances.accommodation === PROVIDED_FLAG
                        ? '제공'
                        : `${allowances.accommodation.toLocaleString()}원`}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {hasTax && (
              <View className="mt-2 border-t border-secondary-200 pt-2 dark:border-surface-overlay">
                <View className="flex-row items-center justify-between py-1">
                  <Text className="text-sm text-secondary-600 dark:text-secondary-400">세금</Text>
                  <Text className="text-sm font-medium text-error-600 dark:text-error-400">
                    {taxSettings.type === 'rate'
                      ? `${taxSettings.value}%`
                      : `${taxSettings.value.toLocaleString()}원`}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </Section>
      )}

      {schedule.type === STATUS.SCHEDULE.COMPLETED && (
        <Section icon={<BanknotesIcon size={18} color="#9A9078" />} title="정산 현황">
          <View className="flex-row items-center justify-between rounded-lg bg-secondary-50 p-3 dark:bg-surface/30">
            <View>
              {schedule.settlementBreakdown && (
                <Text className="text-base font-medium text-secondary-900 dark:text-off-white">
                  {formatCurrency(schedule.settlementBreakdown.afterTaxPay)}
                </Text>
              )}
              {schedule.payrollAmount && schedule.payrollAmount > 0 && (
                <Text className="mt-0.5 text-sm text-success-600 dark:text-success-400">
                  확정: {formatCurrency(schedule.payrollAmount)}
                </Text>
              )}
            </View>
            <Badge variant={payrollStatusConfig.variant} size="sm">
              {payrollStatusConfig.label}
            </Badge>
          </View>
        </Section>
      )}

      {schedule.notes && (
        <Section icon={<DocumentIcon size={18} color="#9A9078" />} title="메모">
          <Text className="text-sm text-secondary-600 dark:text-secondary-400">
            {schedule.notes}
          </Text>
        </Section>
      )}
    </View>
  );
});

export default InfoTab;
