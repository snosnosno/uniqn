/**
 * UNIQN Mobile - 날짜별 모집 정보 컴포넌트
 *
 * @description DateSpecificRequirement 배열을 표시하는 컴포넌트
 * @version 1.0.0
 */

import React, { memo, useMemo } from 'react';
import { View, Text } from 'react-native';
import { Badge } from '@/components/ui/Badge';
import type { DateSpecificRequirement, TimeSlot } from '@/types';
import { formatDateShortWithDay } from '@/utils/date';
import { getDateFromRequirement, sortDateRequirements } from '@/types/jobPosting/dateRequirement';
import { getRoleDisplayName } from '@/types/unified';

// ============================================================================
// Types
// ============================================================================

interface DateRequirementListProps {
  /** 날짜별 요구사항 배열 */
  requirements: DateSpecificRequirement[];
  /** 최대 표시 개수 */
  maxDisplay?: number;
  /** 컴팩트 모드 */
  compact?: boolean;
  /** 추가 클래스 */
  className?: string;
}

interface DateItemProps {
  requirement: DateSpecificRequirement;
  compact?: boolean;
}

interface TimeSlotItemProps {
  slot: TimeSlot;
  compact?: boolean;
}

// ============================================================================
// Helpers
// ============================================================================

const formatDate = (dateStr: string): string => {
  const formatted = formatDateShortWithDay(dateStr);
  return formatted || dateStr;
};

const formatTimeRange = (slot: TimeSlot): string => {
  if (slot.isTimeToBeAnnounced) {
    return slot.tentativeDescription ?? '미정';
  }
  const startTime = slot.startTime ?? '-';
  return startTime;
};

const getTotalPositions = (slots: TimeSlot[]): number => {
  return slots.reduce((total, slot) => {
    return total + slot.roles.reduce((sum, r) => sum + (r.headcount ?? 0), 0);
  }, 0);
};

// ============================================================================
// Sub Components
// ============================================================================

/**
 * 시간대 항목
 */
const TimeSlotItem = memo(function TimeSlotItem({ slot, compact }: TimeSlotItemProps) {
  if (compact) {
    return (
      <Text className="text-xs text-secondary-500 dark:text-secondary-400">
        {formatTimeRange(slot)}
      </Text>
    );
  }

  return (
    <View className="ml-4 mb-2">
      <Text className="text-sm text-secondary-700 dark:text-secondary-300 mb-1">
        {formatTimeRange(slot)}
      </Text>
      <View className="flex-row flex-wrap gap-1">
        {slot.roles.map((role, index) => (
          <Badge key={index} variant="default" size="sm">
            {getRoleDisplayName(role.role ?? 'dealer', role.customRole)} {role.headcount ?? 0}명
          </Badge>
        ))}
      </View>
    </View>
  );
});

/**
 * 날짜 항목
 */
const DateItem = memo(function DateItem({ requirement, compact }: DateItemProps) {
  const dateStr = getDateFromRequirement(requirement);
  const formattedDate = formatDate(dateStr);
  const totalPositions = getTotalPositions(requirement.timeSlots);

  if (compact) {
    return (
      <View className="flex-row items-center mr-3 mb-1">
        <Text className="text-sm font-medium text-secondary-700 dark:text-secondary-300 mr-1">
          {formattedDate}
        </Text>
      </View>
    );
  }

  return (
    <View className="mb-3 pb-3 border-b border-secondary-100 dark:border-surface-overlay last:border-b-0">
      <View className="flex-row items-center justify-between mb-2">
        <View className="flex-row items-center">
          <Text className="text-base font-semibold text-secondary-900 dark:text-white mr-2">
            {formattedDate}
          </Text>
        </View>
        <Text className="text-sm text-secondary-500 dark:text-secondary-400">
          {totalPositions}명 모집
        </Text>
      </View>

      {requirement.timeSlots.map((slot, index) => (
        <TimeSlotItem key={index} slot={slot} compact={compact} />
      ))}
    </View>
  );
});

// ============================================================================
// Main Component
// ============================================================================

/**
 * 날짜별 모집 정보 목록 컴포넌트
 *
 * @example
 * <DateRequirementList requirements={job.dateSpecificRequirements} />
 * <DateRequirementList requirements={requirements} compact maxDisplay={3} />
 */
export const DateRequirementList = memo(function DateRequirementList({
  requirements,
  maxDisplay,
  compact = false,
  className = '',
}: DateRequirementListProps) {
  const sortedRequirements = useMemo(() => sortDateRequirements(requirements), [requirements]);

  const displayRequirements = maxDisplay
    ? sortedRequirements.slice(0, maxDisplay)
    : sortedRequirements;

  const remainingCount = maxDisplay ? Math.max(0, sortedRequirements.length - maxDisplay) : 0;

  if (requirements.length === 0) {
    return null;
  }

  if (compact) {
    return (
      <View className={`flex-row flex-wrap ${className}`}>
        {displayRequirements.map((req, index) => (
          <DateItem key={index} requirement={req} compact />
        ))}
        {remainingCount > 0 && (
          <Text className="text-xs text-secondary-400 dark:text-secondary-500">
            +{remainingCount}일
          </Text>
        )}
      </View>
    );
  }

  return (
    <View className={`bg-secondary-50 dark:bg-surface-dark rounded-lg p-3 ${className}`}>
      <Text className="text-sm font-semibold text-secondary-900 dark:text-white mb-3">
        날짜별 모집 정보
      </Text>

      {displayRequirements.map((req, index) => (
        <DateItem key={index} requirement={req} />
      ))}

      {remainingCount > 0 && (
        <Text className="text-sm text-center text-secondary-400 dark:text-secondary-500 mt-2">
          +{remainingCount}일 더 보기
        </Text>
      )}
    </View>
  );
});

export default DateRequirementList;
