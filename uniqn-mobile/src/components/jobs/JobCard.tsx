/**
 * UNIQN Mobile - JobCard
 */

import React, { memo, useCallback, useMemo } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import type { CardRole, JobPostingCard, SalaryInfo } from '@/types';
import { HIT_SLOP } from '@/constants';
import { SCHEDULE_STATUS } from '@/constants/statusConfig';
import { HeartFilledIcon, HeartOutlineIcon } from '@/components/icons';
import { Badge } from '@/components/ui/Badge';
import { useBookmarks } from '@/hooks/useBookmarks';
import { getRoleDisplayName } from '@/types/unified';
import { formatDateRangeWithCount, formatDateShortWithDay } from '@/utils/date';
import { FixedScheduleDisplay } from './FixedScheduleDisplay';
import { PostingTypeBadge } from './PostingTypeBadge';

export type ApplicationStatusType = 'applied' | 'confirmed' | 'completed' | 'cancelled';

interface JobCardProps {
  job: JobPostingCard;
  onPress: (jobId: string) => void;
  applicationStatus?: ApplicationStatusType;
}

const formatSalary = (type: string, amount: number): string => {
  if (type === 'other') {
    return '협의';
  }

  const formattedAmount = amount.toLocaleString('ko-KR');

  switch (type) {
    case 'hourly':
      return `시급 ${formattedAmount}원`;
    case 'daily':
      return `일급 ${formattedAmount}원`;
    case 'monthly':
      return `월급 ${formattedAmount}원`;
    default:
      return `${formattedAmount}원`;
  }
};

const getDateGroupKey = (startDate: string, endDate: string, index: number): string =>
  `${startDate}-${endDate}-${index}`;

const getDateRequirementKey = (date: string, index: number): string => `${date}-${index}`;

const getTimeSlotKey = (parentKey: string, startTime: string | undefined, index: number): string =>
  `${parentKey}-${startTime || 'tba'}-${index}`;

const getRoleKey = (
  parentKey: string,
  role: string | undefined,
  customRole: string | undefined,
  count: number,
  index: number
): string => `${parentKey}-${role || 'role'}-${customRole || ''}-${count}-${index}`;

const RoleLine = memo(function RoleLine({
  role,
  showTime,
  time,
}: {
  role: CardRole;
  showTime: boolean;
  time: string;
}) {
  const isFilled = role.count > 0 && role.filled >= role.count;

  return (
    <Text
      className={`text-sm ${
        isFilled
          ? 'text-gray-400 dark:text-gray-500 line-through'
          : 'text-gray-900 dark:text-gray-100'
      }`}
    >
      {showTime ? `${time} ` : '       '}
      {getRoleDisplayName(role.role, role.customRole)} {role.count}명 ({role.filled}/{role.count})
    </Text>
  );
});

const DateRequirementsDisplay = memo(function DateRequirementsDisplay({
  dateRequirements,
  dateGroups,
  useGroupedRanges,
}: {
  dateRequirements: JobPostingCard['dateRequirements'];
  dateGroups: JobPostingCard['scheduleDisplay']['dateGroups'];
  useGroupedRanges: boolean;
}) {
  if (useGroupedRanges && dateGroups.length > 0) {
    return (
      <>
        {dateGroups.map((group, groupIdx) => {
          const groupKey = getDateGroupKey(group.startDate, group.endDate, groupIdx);

          return (
            <View key={groupKey} className="mb-2">
              <Text className="text-sm font-medium text-gray-700 dark:text-gray-300">
                📅 {formatDateRangeWithCount(group.startDate, group.endDate)}
              </Text>

              {group.timeSlots.map((slot, slotIdx) => {
                const displayTime = slot.isTimeToBeAnnounced ? '미정' : slot.startTime || '-';

                return (
                  <View
                    key={getTimeSlotKey(groupKey, slot.startTime, slotIdx)}
                    className="ml-5 mt-1"
                  >
                    {slot.roles.map((role, roleIdx) => (
                      <RoleLine
                        key={getRoleKey(
                          getTimeSlotKey(groupKey, slot.startTime, slotIdx),
                          role.role,
                          role.customRole,
                          role.count,
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
        })}
      </>
    );
  }

  return (
    <>
      {dateRequirements.map((dateRequirement, dateIdx) => (
        <View key={getDateRequirementKey(dateRequirement.date, dateIdx)} className="mb-2">
          <Text className="text-sm font-medium text-gray-700 dark:text-gray-300">
            📅 {formatDateShortWithDay(dateRequirement.date)}
          </Text>

          {dateRequirement.timeSlots.map((slot, slotIdx) => {
            const displayTime = slot.isTimeToBeAnnounced ? '미정' : slot.startTime || '-';
            const parentKey = getTimeSlotKey(
              getDateRequirementKey(dateRequirement.date, dateIdx),
              slot.startTime,
              slotIdx
            );

            return (
              <View key={parentKey} className="ml-5 mt-1">
                {slot.roles.map((role, roleIdx) => (
                  <RoleLine
                    key={getRoleKey(parentKey, role.role, role.customRole, role.count, roleIdx)}
                    role={role}
                    showTime={roleIdx === 0}
                    time={displayTime}
                  />
                ))}
              </View>
            );
          })}
        </View>
      ))}
    </>
  );
});

export const JobCard = memo(function JobCard({ job, onPress, applicationStatus }: JobCardProps) {
  const { isBookmarked, toggleBookmark } = useBookmarks();
  const bookmarked = isBookmarked(job.id);

  const handlePress = useCallback(() => {
    onPress(job.id);
  }, [job.id, onPress]);

  const handleBookmarkPress = useCallback(() => {
    toggleBookmark({
      id: job.id,
      title: job.title,
      location: job.fullLocation || job.location,
      workDate: job.workDate,
    });
  }, [job.fullLocation, job.id, job.location, job.title, job.workDate, toggleBookmark]);

  const rolesWithSalary = useMemo(() => job.salaryRows ?? [], [job.salaryRows]);
  const displaySalary: SalaryInfo = job.defaultSalary ??
    rolesWithSalary[0]?.salary ?? { type: 'hourly', amount: 0 };
  const allowanceItems = job.allowanceLabels ?? [];

  const accessibilityLabel = `${job.title}, ${job.location}, ${formatDateShortWithDay(job.workDate)}, ${formatSalary(displaySalary.type, displaySalary.amount)}`;

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint="탭하면 공고 상세 페이지로 이동합니다"
      className="mb-3 rounded-xl border border-gray-100 bg-white p-4 active:opacity-80 dark:border-surface-overlay dark:bg-surface"
    >
      {applicationStatus && (
        <View className="mb-2">
          <Badge variant={SCHEDULE_STATUS[applicationStatus].variant} dot>
            {SCHEDULE_STATUS[applicationStatus].label}
          </Badge>
        </View>
      )}

      <View className="mb-2 flex-row items-start justify-between">
        <View className="flex-1 flex-row flex-wrap items-center">
          {job.postingType && job.postingType !== 'regular' && (
            <PostingTypeBadge type={job.postingType} size="sm" className="mr-2" />
          )}
          {job.isUrgent && (
            <Badge variant="error" size="sm" className="mr-2">
              긴급
            </Badge>
          )}
          <Text
            className="flex-1 text-base font-semibold text-gray-900 dark:text-white"
            numberOfLines={1}
          >
            {job.title}
          </Text>
        </View>

        {Platform.OS === 'web' ? (
          <View
            // @ts-expect-error React Native Web supports onClick on View
            onClick={(event: React.MouseEvent) => {
              event.stopPropagation();
              handleBookmarkPress();
            }}
            className="ml-2 p-1"
            style={{ cursor: 'pointer' }}
            accessibilityLabel={bookmarked ? '북마크 해제' : '북마크 추가'}
          >
            {bookmarked ? (
              <HeartFilledIcon size={22} color="#EF4444" />
            ) : (
              <HeartOutlineIcon size={22} />
            )}
          </View>
        ) : (
          <Pressable
            onPress={handleBookmarkPress}
            hitSlop={HIT_SLOP.medium}
            className="ml-2 p-1"
            accessibilityLabel={bookmarked ? '북마크 해제' : '북마크 추가'}
            accessibilityRole="button"
          >
            {bookmarked ? (
              <HeartFilledIcon size={22} color="#EF4444" />
            ) : (
              <HeartOutlineIcon size={22} />
            )}
          </Pressable>
        )}
      </View>

      <Text className="mb-2 text-sm text-gray-500 dark:text-gray-400">📍 {job.location}</Text>

      <View className="flex-row">
        <View className="flex-1 pr-3">
          {job.workflow.isFixed ? (
            <FixedScheduleDisplay
              daysPerWeek={job.scheduleDisplay.fixed?.daysPerWeek ?? job.daysPerWeek}
              startTime={
                job.scheduleDisplay.fixed?.startTime ??
                job.startTime ??
                job.timeSlot?.split(/[-~]/)[0]?.trim()
              }
              compact={true}
            />
          ) : job.scheduleDisplay.dateRequirements.length > 0 ? (
            <DateRequirementsDisplay
              dateRequirements={job.scheduleDisplay.dateRequirements}
              dateGroups={job.scheduleDisplay.dateGroups}
              useGroupedRanges={job.workflow.usesGroupedDateRanges}
            />
          ) : (
            <View className="mb-2">
              <Text className="text-sm font-medium text-gray-700 dark:text-gray-300">
                📅 {formatDateShortWithDay(job.workDate)}
              </Text>
              <Text className="ml-5 mt-1 text-sm text-gray-900 dark:text-gray-100">
                ⏰ {job.timeSlot || '-'}
              </Text>
            </View>
          )}
        </View>

        <View className="flex-1 border-l border-gray-100 pl-3 dark:border-surface-overlay">
          {!job.salaryDisplay.useSameSalary && rolesWithSalary.length > 0 ? (
            rolesWithSalary.map((roleData) => {
              const roleLabel = roleData.roleLabel || getRoleDisplayName(roleData.role);

              return (
                <Text key={roleData.key} className="text-sm text-gray-900 dark:text-white">
                  💰 {roleLabel}: {roleData.text}
                </Text>
              );
            })
          ) : (
            <Text className="text-sm font-medium text-gray-900 dark:text-white">
              💰{' '}
              {displaySalary.type === 'other'
                ? '협의'
                : formatSalary(displaySalary.type, displaySalary.amount)}
            </Text>
          )}

          {allowanceItems.length > 0 && (
            <View className="mt-1">
              {allowanceItems.map((item, idx) => (
                <Text key={`${item}-${idx}`} className="text-sm text-gray-500 dark:text-gray-400">
                  {item}
                </Text>
              ))}
            </View>
          )}

          {job.taxLabel && (
            <Text className="mt-1 text-xs text-gray-400 dark:text-gray-500">💸 {job.taxLabel}</Text>
          )}

          {job.salaryDisplay.overflowCount > 0 && (
            <Text className="mt-1 text-xs text-gray-400 dark:text-gray-500">
              +{job.salaryDisplay.overflowCount}개 역할 급여 더 있음
            </Text>
          )}
        </View>
      </View>

      {job.ownerName && (
        <View className="mt-2 border-t border-gray-100 pt-2 dark:border-surface-overlay">
          <Text className="text-xs text-gray-500 dark:text-gray-400">구인처 {job.ownerName}</Text>
        </View>
      )}
    </Pressable>
  );
});

export default JobCard;
