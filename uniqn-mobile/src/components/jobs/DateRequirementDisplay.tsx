import React, { memo, useMemo } from 'react';
import { Text, View } from 'react-native';
import { Badge } from '@/components/ui/Badge';
import { formatDateShortWithDay, toDateString, type DateInput } from '@/utils/date';
import { getRoleDisplayName } from '@/types/unified';

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
}

interface DateRequirementDisplayProps {
  requirement: DateSpecificRequirementCompat;
  showFilledCount?: boolean;
  compact?: boolean;
  index?: number;
}

interface TimeSlotDisplayProps {
  timeSlot: TimeSlotCompat;
  showFilledCount?: boolean;
  compact?: boolean;
}

interface RoleDisplayProps {
  role: RoleRequirementCompat;
  showFilledCount?: boolean;
}

function formatRequirementDate(dateStr: string): string {
  return formatDateShortWithDay(dateStr) || '-';
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

const RoleDisplay = memo(function RoleDisplay({ role, showFilledCount }: RoleDisplayProps) {
  const label = getRoleLabel(role.role, role.name, role.customRole);
  const filled = role.filled ?? 0;
  const headcount = role.headcount ?? role.count ?? 0;
  const text = showFilledCount ? `${label} ${filled}/${headcount}명` : `${label} ${headcount}명`;

  return (
    <View className="mb-1 mr-2">
      <Badge variant="primary" size="sm">
        {text}
      </Badge>
    </View>
  );
});

const TimeSlotDisplay = memo(function TimeSlotDisplay({
  timeSlot,
  showFilledCount,
  compact,
}: TimeSlotDisplayProps) {
  const timeValue = timeSlot.startTime || timeSlot.time || '-';
  const timeDisplay = timeSlot.isTimeToBeAnnounced
    ? `미정${timeSlot.tentativeDescription ? ` (${timeSlot.tentativeDescription})` : ''}`
    : timeValue;

  if (compact) {
    const roleLabels = timeSlot.roles
      .map((role) => getRoleLabel(role.role, role.name, role.customRole))
      .join(', ');

    return (
      <Text className="text-sm text-secondary-600 dark:text-secondary-400">
        {timeDisplay} · {roleLabels || '-'}
      </Text>
    );
  }

  return (
    <View className="ml-4 mt-1">
      <Text className="mb-1 text-sm font-medium text-secondary-700 dark:text-secondary-300">
        {timeDisplay}
      </Text>
      <View className="ml-4 flex-row flex-wrap">
        {timeSlot.roles.map((role, idx) => (
          <RoleDisplay key={role.id || idx} role={role} showFilledCount={showFilledCount} />
        ))}
      </View>
    </View>
  );
});

export const DateRequirementDisplay = memo(function DateRequirementDisplay({
  requirement,
  showFilledCount = false,
  compact = false,
}: DateRequirementDisplayProps) {
  const dateStr = useMemo(() => toDateString(requirement.date), [requirement.date]);
  const formattedDate = useMemo(() => formatRequirementDate(dateStr), [dateStr]);

  const totalStats = useMemo(() => {
    let total = 0;
    let filled = 0;

    requirement.timeSlots.forEach((slot) => {
      slot.roles.forEach((role) => {
        total += role.headcount ?? role.count ?? 0;
        filled += role.filled ?? 0;
      });
    });

    return { total, filled };
  }, [requirement.timeSlots]);

  if (compact) {
    return (
      <View className="py-1">
        <View className="mb-1 flex-row items-center">
          <Text className="mr-2 text-sm font-medium text-secondary-900 dark:text-off-white">
            {formattedDate}
          </Text>
          {showFilledCount && (
            <Badge
              variant={totalStats.filled >= totalStats.total ? 'success' : 'warning'}
              size="sm"
            >
              {totalStats.filled}/{totalStats.total}명
            </Badge>
          )}
        </View>
        {requirement.timeSlots.map((slot, idx) => (
          <TimeSlotDisplay
            key={slot.id || idx}
            timeSlot={slot}
            showFilledCount={showFilledCount}
            compact
          />
        ))}
      </View>
    );
  }

  return (
    <View className="mb-3">
      <View className="mb-1 flex-row items-center justify-between">
        <Text className="text-sm font-semibold text-secondary-900 dark:text-off-white">
          {formattedDate}
        </Text>
        {showFilledCount && (
          <Badge variant={totalStats.filled >= totalStats.total ? 'success' : 'warning'} size="sm">
            {totalStats.filled}/{totalStats.total}명
          </Badge>
        )}
      </View>

      {requirement.timeSlots.map((slot, idx) => (
        <TimeSlotDisplay key={slot.id || idx} timeSlot={slot} showFilledCount={showFilledCount} />
      ))}
    </View>
  );
});

export default DateRequirementDisplay;
