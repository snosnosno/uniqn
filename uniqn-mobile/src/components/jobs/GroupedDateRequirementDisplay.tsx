import React, { memo, useCallback, useMemo, useState } from 'react';
import { LayoutAnimation, Pressable, Text, View } from 'react-native';
import { ChevronDownIcon, ChevronUpIcon } from '@/components/icons';
import { Badge } from '@/components/ui/Badge';
import type { DateSpecificRequirement } from '@/types/jobPosting/dateRequirement';
import { getRoleDisplayName } from '@/types/unified';
import {
  formatDateRangeWithCount,
  formatDateShortWithDay,
  generateDateRange,
  groupRequirementsToDateRanges,
  toDateString,
  type DateInput,
  type DateRangeGroup,
} from '@/utils/date';

interface RoleRequirementCompat {
  id?: string;
  role?: string;
  name?: string;
  customRole?: string;
  headcount?: number;
  count?: number;
  filled?: number;
}

interface TimeSlotCompat {
  id?: string;
  startTime?: string;
  time?: string;
  isTimeToBeAnnounced?: boolean;
  tentativeDescription?: string;
  roles: RoleRequirementCompat[];
}

interface DateSpecificRequirementCompat {
  date: DateInput;
  timeSlots: TimeSlotCompat[];
  isGrouped?: boolean;
}

interface GroupedDateRequirementDisplayProps {
  requirements: DateSpecificRequirementCompat[];
  showFilledCount?: boolean;
  defaultExpanded?: boolean;
}

interface DateRangeGroupWithStats extends DateRangeGroup {
  originalRequirements: DateSpecificRequirementCompat[];
  stats: {
    total: number;
    filled: number;
    dayCount: number;
  };
}

function getRoleLabel(role?: string, name?: string, customRole?: string): string {
  if (role) {
    return getRoleDisplayName(role, customRole);
  }

  if (name) {
    return getRoleDisplayName(name);
  }

  return '-';
}

function formatSingleDate(dateStr: string): string {
  return formatDateShortWithDay(dateStr) || dateStr || '-';
}

function formatTimeSlotLabel(slot: TimeSlotCompat): string {
  if (slot.isTimeToBeAnnounced) {
    return `미정${slot.tentativeDescription ? ` (${slot.tentativeDescription})` : ''}`;
  }

  return slot.startTime || slot.time || '-';
}

function formatRoleSummary(role: RoleRequirementCompat, showFilledCount: boolean): string {
  const label = getRoleLabel(role.role, role.name, role.customRole);
  const headcount = role.headcount ?? role.count ?? 0;

  if (showFilledCount) {
    const filled = role.filled ?? 0;
    return `${label} ${filled}/${headcount}명`;
  }

  return `${label} ${headcount}명`;
}

function calculateTimeSlotStats(timeSlots: TimeSlotCompat[]): { total: number; filled: number } {
  let total = 0;
  let filled = 0;

  timeSlots.forEach((slot) => {
    slot.roles.forEach((role) => {
      total += role.headcount ?? role.count ?? 0;
      filled += role.filled ?? 0;
    });
  });

  return { total, filled };
}

function getDatesBetween(startDate: string, endDate: string): string[] {
  const dates = generateDateRange(startDate, endDate);
  return dates.length > 0 ? dates : [startDate];
}

function getGroupTimeSlotKey(parentKey: string, slot: TimeSlotCompat, index: number): string {
  return `${parentKey}-${slot.startTime || slot.time || 'tba'}-${index}`;
}

const GroupItem = memo(function GroupItem({
  group,
  showFilledCount = false,
  defaultExpanded = false,
}: {
  group: DateRangeGroupWithStats;
  showFilledCount?: boolean;
  defaultExpanded?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const isSingleDay = group.stats.dayCount === 1;
  const dateDisplay = formatDateRangeWithCount(group.startDate, group.endDate);

  const toggleExpand = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded((prev) => !prev);
  }, []);

  return (
    <View className="mb-3">
      <View className="flex-row items-center justify-between">
        <View className="flex-1">
          <View className="mb-1 flex-row items-center">
            <Text className="text-sm font-sans-semibold text-secondary-900 dark:text-off-white">
              {isSingleDay ? formatSingleDate(group.startDate) : dateDisplay}
            </Text>
          </View>

          <View className="ml-4">
            {group.timeSlots.map((slot, slotIdx) => {
              const rolesDisplay = slot.roles
                .map((role) => formatRoleSummary(role, showFilledCount))
                .join(', ');

              return (
                <Text
                  key={getGroupTimeSlotKey(`${group.startDate}-${group.endDate}`, slot, slotIdx)}
                  className="text-sm text-secondary-600 dark:text-secondary-400 font-sans"
                >
                  {formatTimeSlotLabel(slot)} {rolesDisplay || '-'}
                </Text>
              );
            })}
          </View>
        </View>

        {showFilledCount && (
          <View className="flex-row items-center">
            <Badge
              variant={group.stats.filled >= group.stats.total ? 'success' : 'warning'}
              size="sm"
            >
              {group.stats.filled}/{group.stats.total}
            </Badge>
          </View>
        )}

        {!isSingleDay && (
          <Pressable
            onPress={toggleExpand}
            className="ml-2 rounded-sm p-1.5 active:bg-secondary-100 dark:active:bg-secondary-700"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel={isExpanded ? '날짜 상세 접기' : '날짜 상세 펼치기'}
          >
            {isExpanded ? (
              <ChevronUpIcon size={16} color="#9A9078" />
            ) : (
              <ChevronDownIcon size={16} color="#9A9078" />
            )}
          </Pressable>
        )}
      </View>

      {isExpanded && !isSingleDay && (
        <View className="mt-2 ml-4 border-l-2 border-secondary-200 pl-3 dark:border-surface-overlay">
          {group.originalRequirements.map((requirement, idx) => {
            const dateStr = toDateString(requirement.date);
            const stats = calculateTimeSlotStats(requirement.timeSlots);

            return (
              <View key={idx} className="flex-row items-center justify-between py-1.5">
                <Text className="text-sm text-secondary-700 dark:text-secondary-300 font-sans">
                  {formatSingleDate(dateStr)}
                </Text>
                {showFilledCount && (
                  <Badge variant={stats.filled >= stats.total ? 'success' : 'default'} size="sm">
                    {stats.filled}/{stats.total}
                  </Badge>
                )}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
});

export const GroupedDateRequirementDisplay = memo(function GroupedDateRequirementDisplay({
  requirements,
  showFilledCount = false,
  defaultExpanded = false,
}: GroupedDateRequirementDisplayProps) {
  const groupsWithStats = useMemo<DateRangeGroupWithStats[]>(() => {
    if (!requirements || requirements.length === 0) {
      return [];
    }

    const normalizedRequirements = requirements.map((requirement) => ({
      date: toDateString(requirement.date),
      isGrouped: requirement.isGrouped,
      timeSlots: requirement.timeSlots.map((timeSlot) => ({
        ...timeSlot,
        startTime: timeSlot.startTime || timeSlot.time,
        roles: timeSlot.roles.map((role) => ({
          ...role,
          role: role.role || role.name,
          headcount: role.headcount ?? role.count ?? 0,
        })),
      })),
    }));

    return groupRequirementsToDateRanges(normalizedRequirements as DateSpecificRequirement[]).map(
      (group) => {
        const groupDates = getDatesBetween(group.startDate, group.endDate);
        const originalRequirements = requirements.filter((requirement) =>
          groupDates.includes(toDateString(requirement.date))
        );

        const totalPerDay = originalRequirements[0]
          ? calculateTimeSlotStats(originalRequirements[0].timeSlots).total
          : 0;

        return {
          ...group,
          originalRequirements,
          stats: {
            total: totalPerDay * originalRequirements.length,
            filled: originalRequirements.reduce(
              (sum, requirement) => sum + calculateTimeSlotStats(requirement.timeSlots).filled,
              0
            ),
            dayCount: originalRequirements.length,
          },
        };
      }
    );
  }, [requirements]);

  if (groupsWithStats.length === 0) {
    return null;
  }

  return (
    <View>
      {groupsWithStats.map((group, idx) => (
        <GroupItem
          key={group.id || idx}
          group={group}
          showFilledCount={showFilledCount}
          defaultExpanded={defaultExpanded}
        />
      ))}
    </View>
  );
});

export default GroupedDateRequirementDisplay;
