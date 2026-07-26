/**
 * UNIQN Mobile - schedule detail info tab
 */

import { SECONDARY_PALETTE } from '@/constants/colors';
import React, { memo, useCallback, useMemo } from 'react';
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
import { openMapSearch } from '@/utils/mapLink';
import { useToast } from '@/stores/toastStore';
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
        <Text className="ml-2 text-sm font-sans-semibold text-content-secondary">{title}</Text>
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
  const toast = useToast();

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

  // 상세 주소가 있으면 그걸 우선한다 — 지도 검색 정확도가 높다.
  const mapQuery = schedule.detailedAddress?.trim() || schedule.location?.trim() || '';

  const handleOpenMap = useCallback(async () => {
    const opened = await openMapSearch(mapQuery);
    if (!opened) {
      toast.error('지도 앱을 열지 못했어요. 주소를 직접 검색해 주세요.');
    }
  }, [mapQuery, toast]);

  if (schedule.type === STATUS.SCHEDULE.CANCELLED) {
    return (
      <View className="py-2 opacity-70">
        <View className="mb-4 rounded-md bg-error-50 p-4 dark:bg-error-900/20">
          <Text className="text-center text-sm font-sans-medium text-error-600 dark:text-error-400">
            취소된 일정입니다
          </Text>
        </View>

        <Section icon={<DocumentIcon size={18} color={SECONDARY_PALETTE[400]} />} title="공고 정보">
          <Text className="text-base text-secondary-500 dark:text-secondary-400 font-sans">
            {schedule.jobPostingName}
          </Text>
        </Section>

        <Section icon={<CalendarIcon size={18} color={SECONDARY_PALETTE[400]} />} title="일정">
          <Text className="text-base text-secondary-500 dark:text-secondary-400 font-sans">
            {formatFullDate(schedule.date)}
          </Text>
          <View className="mt-1 flex-row items-center">
            <ClockIcon size={14} color={SECONDARY_PALETTE[400]} />
            <Text className="ml-1.5 text-sm text-content-placeholder font-sans">
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
        <Section icon={<DocumentIcon size={18} color={SECONDARY_PALETTE[500]} />} title="공고 설명">
          <Text className="text-sm leading-5 text-content-secondary font-sans">{description}</Text>
        </Section>
      )}

      <View className="mb-4 flex-row items-center">
        <BriefcaseIcon size={18} color={SECONDARY_PALETTE[500]} />
        <Text className="ml-2 text-sm text-content-muted dark:text-secondary-400 font-sans">
          역할 :
        </Text>
        <Text className="ml-2 text-base font-sans-medium text-content-primary dark:text-off-white">
          {getRoleDisplayName(schedule.role, schedule.customRole)}
        </Text>
      </View>

      <View className="mb-4">
        <View className="flex-row items-start">
          <MapIcon size={18} color={SECONDARY_PALETTE[500]} />
          <Text className="ml-2 text-sm text-content-muted dark:text-secondary-400 font-sans">
            장소 :
          </Text>
          <View className="ml-2 flex-1">
            <Text className="text-base font-sans-medium text-content-primary dark:text-off-white">
              {schedule.location || '-'}
            </Text>
            {schedule.detailedAddress && (
              <Text className="mt-0.5 text-sm text-secondary-500 dark:text-secondary-400 font-sans">
                {schedule.detailedAddress}
              </Text>
            )}
          </View>
        </View>

        {/* 길찾기 — 전화 행과 같은 시각 언어. 주소만 죽은 텍스트로 두면
            처음 가는 근무지를 지도 앱에 손으로 다시 쳐야 한다. */}
        {mapQuery && (
          <Pressable
            onPress={handleOpenMap}
            accessibilityRole="button"
            accessibilityLabel={`${mapQuery} 길찾기`}
            className="ml-8 mt-2 flex-row items-center rounded-lg bg-primary-50 px-3 py-2 active:bg-primary-100 dark:bg-primary-900/20 dark:active:bg-primary-900/30"
          >
            <MapIcon size={16} color="#B8962E" />
            <Text className="ml-1.5 text-sm font-sans-medium text-primary-600 dark:text-primary-400">
              길찾기
            </Text>
          </Pressable>
        )}
      </View>

      <Section icon={<CalendarIcon size={18} color={SECONDARY_PALETTE[500]} />} title="일정">
        <Text className="text-base text-content-primary dark:text-off-white font-sans">
          {formatFullDate(schedule.date)}
        </Text>

        {schedule.type === STATUS.SCHEDULE.COMPLETED ? (
          <View className="mt-2">
            {getActualTimeDisplay(schedule) && (
              <View className="flex-row items-center">
                <ClockIcon size={14} color="#B8962E" />
                <Text className="ml-1.5 text-sm font-sans-medium text-primary-600 dark:text-primary-400">
                  실제: {getActualTimeDisplay(schedule)}
                </Text>
                <Text className="ml-2 text-sm text-primary-500 dark:text-primary-500 font-sans">
                  ({getWorkDuration(schedule)})
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View className="mt-2 flex-row items-center">
            <ClockIcon size={14} color={SECONDARY_PALETTE[400]} />
            <Text className="ml-1.5 text-sm text-content-muted dark:text-secondary-400 font-sans">
              {getTimeDisplay(schedule)}
            </Text>
          </View>
        )}
      </Section>

      {(ownerName || schedule.ownerPhone) && (
        <Section
          icon={<PhoneIcon size={18} color={SECONDARY_PALETTE[500]} />}
          title="구인자 연락처"
        >
          {ownerName && (
            <View className="mb-2 flex-row items-center">
              <UserIcon size={14} color={SECONDARY_PALETTE[400]} />
              <Text className="ml-1.5 text-sm text-content-muted dark:text-secondary-400 font-sans">
                구인자: {ownerName}
              </Text>
            </View>
          )}

          {schedule.ownerPhone && (
            <Pressable
              onPress={() => Linking.openURL(`tel:${schedule.ownerPhone}`)}
              className="flex-row items-center rounded-lg bg-primary-50 px-3 py-2 active:bg-primary-100 dark:bg-primary-900/20 dark:active:bg-primary-900/30"
            >
              <Text className="text-base font-sans-medium text-primary-600 dark:text-primary-400">
                {formatPhoneNumber(schedule.ownerPhone)}
              </Text>
              <View className="ml-auto flex-row items-center">
                <PhoneIcon size={16} color="#B8962E" />
                <Text className="ml-1 text-sm text-primary-600 dark:text-primary-400 font-sans">
                  전화하기
                </Text>
              </View>
            </Pressable>
          )}
        </Section>
      )}

      {salaryInfo && (
        <Section
          icon={<BanknotesIcon size={18} color={SECONDARY_PALETTE[500]} />}
          title="급여 정보"
        >
          <View className="rounded-lg bg-surface-page dark:bg-surface p-3 dark:bg-surface/30">
            <Text className="text-base font-sans-medium text-content-primary dark:text-off-white">
              {SALARY_TYPE_LABELS[salaryInfo.type]} {salaryInfo.amount.toLocaleString()}원
            </Text>

            {hasAllowances && (
              <View className="mt-2 border-t border-secondary-200 pt-2 dark:border-surface-overlay">
                {allowances?.meal !== undefined && allowances.meal !== 0 && (
                  <View className="flex-row items-center justify-between py-1">
                    <Text className="text-sm text-content-muted dark:text-secondary-400 font-sans">
                      식비
                    </Text>
                    <Text
                      className={`text-sm font-sans-medium ${
                        allowances.meal === PROVIDED_FLAG
                          ? 'text-success-600 dark:text-success-400'
                          : 'text-content-primary'
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
                    <Text className="text-sm text-content-muted dark:text-secondary-400 font-sans">
                      교통비
                    </Text>
                    <Text
                      className={`text-sm font-sans-medium ${
                        allowances.transportation === PROVIDED_FLAG
                          ? 'text-success-600 dark:text-success-400'
                          : 'text-content-primary'
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
                    <Text className="text-sm text-content-muted dark:text-secondary-400 font-sans">
                      숙박비
                    </Text>
                    <Text
                      className={`text-sm font-sans-medium ${
                        allowances.accommodation === PROVIDED_FLAG
                          ? 'text-success-600 dark:text-success-400'
                          : 'text-content-primary'
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
                  <Text className="text-sm text-content-muted dark:text-secondary-400 font-sans">
                    세금
                  </Text>
                  <Text className="text-sm font-sans-medium text-error-600 dark:text-error-400">
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
        <Section
          icon={<BanknotesIcon size={18} color={SECONDARY_PALETTE[500]} />}
          title="정산 현황"
        >
          <View className="flex-row items-center justify-between rounded-lg bg-surface-page dark:bg-surface p-3 dark:bg-surface/30">
            <View>
              {schedule.settlementBreakdown && (
                <Text className="text-base font-sans-medium text-content-primary dark:text-off-white">
                  {formatCurrency(schedule.settlementBreakdown.afterTaxPay)}
                </Text>
              )}
              {/* 0 원 확정도 표시 — truthy 가드는 0 을 숨기고 숫자 0 을 View 로 흘린다. */}
              {typeof schedule.payrollAmount === 'number' && (
                <Text className="mt-0.5 text-sm text-success-600 dark:text-success-400 font-sans">
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
        <Section icon={<DocumentIcon size={18} color={SECONDARY_PALETTE[500]} />} title="메모">
          <Text className="text-sm text-content-muted dark:text-secondary-400 font-sans">
            {schedule.notes}
          </Text>
        </Section>
      )}
    </View>
  );
});
