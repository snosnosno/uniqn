/**
 * UNIQN Mobile - Employer job posting card
 *
 * @description Employer-side posting card used in the "내 공고" list.
 */

import React, { memo, useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { TournamentStatusBadge } from '@/components/jobs/TournamentStatusBadge';
import { FixedScheduleDisplay } from '@/components/jobs/FixedScheduleDisplay';
import { PostingTypeBadge } from '@/components/jobs/PostingTypeBadge';
import { QrCodeIcon, UsersIcon } from '@/components/icons';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { STATUS } from '@/constants';
import { toJobPostingCard } from '@/domains/job-posting';
import type { DateSpecificRequirement } from '@/types/jobPosting/dateRequirement';
import { getDateString } from '@/types/jobPosting/dateRequirement';
import { getRoleDisplayName } from '@/types/unified/role';
import type { JobPosting, PostingType, TournamentApprovalStatus } from '@/types';
import {
  formatDateRangeWithCount,
  formatDateShortWithDay,
  groupRequirementsToDateRanges,
} from '@/utils/date';
import { formatSalary } from '@/utils/formatters';

export interface JobPostingCardProps {
  posting: JobPosting;
  onPress: (posting: JobPosting) => void;
  onClose: (postingId: string) => void;
  onReopen: (postingId: string) => void;
  onShowQR: (posting: JobPosting) => void;
  isClosing: boolean;
  isReopening: boolean;
}

interface RoleData {
  id?: string;
  role?: string;
  name?: string;
  customRole?: string;
  headcount?: number;
  count?: number;
  filled?: number;
}

function getDayCount(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 1;
  }

  const diffTime = end.getTime() - start.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
}

function getDateGroupKey(startDate: string, endDate: string, index: number): string {
  return `${startDate}-${endDate}-${index}`;
}

function getTimeSlotKey(parentKey: string, startTime: string | undefined, index: number): string {
  return `${parentKey}-${startTime || 'tba'}-${index}`;
}

function getRoleKey(parentKey: string, role: RoleData, index: number): string {
  const roleName = role.role || role.name || 'role';
  const count = role.headcount || role.count || 0;

  return `${parentKey}-${roleName}-${role.customRole || ''}-${count}-${index}`;
}

const RoleLine = memo(function RoleLine({
  role,
  showTime,
  time,
}: {
  role: RoleData;
  showTime: boolean;
  time: string;
}) {
  const roleName = role.role || role.name || '';
  const count = role.headcount || role.count || 0;
  const filled = role.filled ?? 0;

  return (
    <Text className="text-sm text-gray-900 dark:text-gray-100">
      {showTime ? `${time} ` : '       '}
      {getRoleDisplayName(roleName, role.customRole)} {count}명 ({filled}/{count})
    </Text>
  );
});

export const JobPostingCard = memo(function JobPostingCard({
  posting,
  onPress,
  onClose,
  onReopen,
  onShowQR,
  isClosing,
  isReopening,
}: JobPostingCardProps) {
  const card = useMemo(() => toJobPostingCard(posting), [posting]);
  const statusConfig = {
    active: { label: '모집중', variant: 'success' as const },
    closed: { label: '마감', variant: 'default' as const },
    cancelled: { label: '취소됨', variant: 'error' as const },
  };

  const status = statusConfig[posting.status] || statusConfig.active;
  const allowanceItems = card.allowanceLabels ?? [];

  const groupedDateRequirements = useMemo(() => {
    const requirements = card.dateRequirements ?? [];

    if (requirements.length === 0) {
      return [];
    }

    const converted = requirements.map((requirement) => ({
      date: getDateString(requirement.date),
      isGrouped: requirement.isGrouped,
      timeSlots: (requirement.timeSlots ?? []).map((timeSlot) => ({
        startTime:
          (timeSlot as { startTime?: string; time?: string }).startTime ||
          (timeSlot as { startTime?: string; time?: string }).time ||
          '',
        isTimeToBeAnnounced:
          (timeSlot as { isTimeToBeAnnounced?: boolean }).isTimeToBeAnnounced ?? false,
        roles: (timeSlot.roles ?? []).map((role) => ({
          id: role.id,
          role: role.role,
          customRole: role.customRole,
          headcount: role.count,
          filled: role.filled,
        })),
      })),
    }));

    return groupRequirementsToDateRanges(converted as unknown as DateSpecificRequirement[]).map(
      (group) => ({
        ...group,
        dayCount: getDayCount(group.startDate, group.endDate),
      })
    );
  }, [card.dateRequirements]);

  return (
    <Card variant="elevated" padding="md" className="mx-4 mb-3">
      <Pressable
        onPress={() => onPress(posting)}
        accessibilityLabel={`${posting.title} 공고 상세보기`}
        accessibilityRole="button"
      >
        <View className="mb-2 flex-row items-start justify-between">
          <View className="flex-1 flex-row flex-wrap items-center">
            {posting.postingType && posting.postingType !== 'regular' && (
              <PostingTypeBadge
                type={posting.postingType as PostingType}
                size="sm"
                className="mr-2"
              />
            )}
            {card.isUrgent && (
              <Badge variant="error" size="sm" className="mr-2">
                긴급
              </Badge>
            )}
            <Text
              className="flex-1 text-base font-semibold text-gray-900 dark:text-white"
              numberOfLines={1}
            >
              {posting.title}
            </Text>
          </View>
        </View>

        <Text className="mb-2 text-sm text-gray-500 dark:text-gray-400">📍 {card.location}</Text>

        <View className="flex-row">
          <View className="flex-1 pr-3">
            {posting.postingType === 'fixed' ? (
              <FixedScheduleDisplay
                daysPerWeek={card.daysPerWeek}
                startTime={card.startTime || card.timeSlot?.split(/[-~]/)[0]?.trim()}
                compact={true}
              />
            ) : groupedDateRequirements.length > 0 ? (
              groupedDateRequirements.map((group, groupIdx) => {
                const isSingleDay = group.dayCount === 1;
                const dateDisplay = isSingleDay
                  ? formatDateShortWithDay(group.startDate)
                  : formatDateRangeWithCount(group.startDate, group.endDate);

                return (
                  <View
                    key={getDateGroupKey(group.startDate, group.endDate, groupIdx)}
                    className="mb-2"
                  >
                    <Text className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      📅 {dateDisplay}
                    </Text>

                    {group.timeSlots.map((slot, slotIdx) => {
                      const displayTime = slot.isTimeToBeAnnounced ? '미정' : slot.startTime || '-';

                      return (
                        <View
                          key={getTimeSlotKey(
                            getDateGroupKey(group.startDate, group.endDate, groupIdx),
                            slot.startTime,
                            slotIdx
                          )}
                          className="ml-5 mt-1"
                        >
                          {slot.roles.map((role: RoleData, roleIdx: number) => (
                            <RoleLine
                              key={getRoleKey(
                                getTimeSlotKey(
                                  getDateGroupKey(group.startDate, group.endDate, groupIdx),
                                  slot.startTime,
                                  slotIdx
                                ),
                                role,
                                roleIdx
                              )}
                              role={role}
                              showTime={roleIdx === 0}
                              time={displayTime}
                            />
                          ))}
                        </View>
                      );
                    })}
                  </View>
                );
              })
            ) : (
              <View className="mb-2">
                <Text className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  📅 {formatDateShortWithDay(posting.workDate)}
                </Text>
                <Text className="ml-5 mt-1 text-sm text-gray-900 dark:text-gray-100">
                  ⏰ {card.timeSlot || '-'}
                </Text>
              </View>
            )}
          </View>

          <View className="flex-1 border-l border-gray-100 pl-3 dark:border-surface-overlay">
            {!card.useSameSalary && card.salaryRows.length > 0 ? (
              card.salaryRows.map((row, idx) => (
                <Text key={idx} className="text-sm text-gray-900 dark:text-white">
                  💰 {row.roleLabel}: {row.text}
                </Text>
              ))
            ) : (
              <Text className="text-sm font-medium text-gray-900 dark:text-white">
                💰{' '}
                {card.defaultSalary
                  ? card.defaultSalary.type === 'other'
                    ? '협의'
                    : formatSalary(card.defaultSalary.type, card.defaultSalary.amount)
                  : card.salaryRows[0]?.text || '-'}
              </Text>
            )}

            {allowanceItems.length > 0 && (
              <View className="mt-1">
                {allowanceItems.map((item, idx) => (
                  <Text key={idx} className="text-sm text-gray-500 dark:text-gray-400">
                    {item}
                  </Text>
                ))}
              </View>
            )}

            {card.taxLabel && (
              <Text className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                💸 {card.taxLabel}
              </Text>
            )}

            {card.salaryOverflowCount > 0 && (
              <Text className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                +{card.salaryOverflowCount}개 역할 급여 더 있음
              </Text>
            )}
          </View>
        </View>
      </Pressable>

      <View className="mt-2 flex-row items-center justify-between border-t border-gray-100 pt-2 dark:border-surface-overlay">
        <View className="flex-row items-center">
          <UsersIcon size={14} color="#9333EA" />
          <Text className="ml-1 text-xs text-gray-600 dark:text-gray-400">
            지원 {posting.applicationCount || 0}
          </Text>
        </View>

        <View className="flex-row items-center gap-2">
          <Pressable
            onPress={() => onShowQR(posting)}
            className="p-1.5 active:opacity-70"
            accessibilityLabel="현장 QR 표시"
            accessibilityRole="button"
          >
            <QrCodeIcon size={18} color="#9333EA" />
          </Pressable>

          {posting.postingType === 'tournament' && posting.tournamentConfig?.approvalStatus && (
            <TournamentStatusBadge
              status={posting.tournamentConfig.approvalStatus as TournamentApprovalStatus}
              rejectionReason={posting.tournamentConfig.rejectionReason}
              postingId={posting.id}
              size="sm"
            />
          )}

          <Badge variant={status.variant} size="sm">
            {status.label}
          </Badge>

          {posting.status === STATUS.JOB_POSTING.ACTIVE && (
            <Pressable
              onPress={() => onClose(posting.id)}
              disabled={isClosing}
              className="rounded-md bg-gray-100 px-3 py-1.5 active:opacity-70 dark:bg-surface"
              accessibilityLabel={`${posting.title} 공고 마감하기`}
              accessibilityRole="button"
              accessibilityState={{ disabled: isClosing }}
            >
              <Text className="text-xs font-medium text-gray-700 dark:text-gray-300">
                {isClosing ? '처리중...' : '마감하기'}
              </Text>
            </Pressable>
          )}

          {posting.status === STATUS.JOB_POSTING.CLOSED && (
            <Pressable
              onPress={() => onReopen(posting.id)}
              disabled={isReopening}
              className="rounded-md bg-primary-50 px-3 py-1.5 active:opacity-70 dark:bg-primary-900/30"
              accessibilityLabel={`${posting.title} 공고 재오픈하기`}
              accessibilityRole="button"
              accessibilityState={{ disabled: isReopening }}
            >
              <Text className="text-xs font-medium text-primary-600 dark:text-primary-400">
                {isReopening ? '처리중...' : '재오픈'}
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </Card>
  );
});
