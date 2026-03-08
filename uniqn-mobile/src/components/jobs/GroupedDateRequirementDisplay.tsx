/**
 * UNIQN Mobile - 그룹화된 날짜별 요구사항 표시 컴포넌트
 *
 * @description 연속 날짜를 그룹화하여 표시
 *   - 같은 timeSlots을 가진 연속 날짜들을 하나의 범위로 표시
 *   - 예: 1/19, 1/20, 1/21 → "1/19(월) ~ 1/21(수) (3일)"
 * @version 1.0.0
 */

import React, { memo, useMemo, useState, useCallback } from 'react';
import { View, Text, Pressable, LayoutAnimation } from 'react-native';
import { Badge } from '@/components/ui/Badge';
import { ChevronDownIcon, ChevronUpIcon } from '@/components/icons';
import { getRoleDisplayName } from '@/types/unified';
import {
  groupRequirementsToDateRanges,
  formatDateRangeWithCount,
  toDateString,
  type DateRangeGroup,
} from '@/utils/date';
import type { DateSpecificRequirement } from '@/types/jobPosting/dateRequirement';

// ============================================================================
// Types
// ============================================================================

// 역할 요구사항 호환 타입
interface RoleRequirementCompat {
  id?: string;
  role?: string;
  name?: string;
  customRole?: string;
  headcount?: number;
  count?: number;
  filled?: number;
}

// 시간대 호환 타입
interface TimeSlotCompat {
  id?: string;
  startTime?: string;
  time?: string;
  isTimeToBeAnnounced?: boolean;
  tentativeDescription?: string;
  roles: RoleRequirementCompat[];
}

// DateSpecificRequirement 호환 타입
interface DateSpecificRequirementCompat {
  date: string | { toDate?: () => Date } | { seconds: number };
  timeSlots: TimeSlotCompat[];
  /** 그룹화 여부 (연속 날짜 그룹 표시용) */
  isGrouped?: boolean;
}

interface GroupedDateRequirementDisplayProps {
  /** 날짜별 요구사항 배열 */
  requirements: DateSpecificRequirementCompat[];
  /** 충원 현황 표시 여부 */
  showFilledCount?: boolean;
  /** 기본 펼침 상태 */
  defaultExpanded?: boolean;
}

// 내부 그룹 타입 (filled 정보 추가)
interface DateRangeGroupWithStats extends DateRangeGroup {
  /** 각 날짜의 원본 요구사항 (filled 정보 포함) */
  originalRequirements: DateSpecificRequirementCompat[];
  /** 충원 통계 */
  stats: {
    total: number;
    filled: number;
    /** 일수 */
    dayCount: number;
  };
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * 역할 라벨 가져오기
 */
function getRoleLabel(role?: string, name?: string, customRole?: string): string {
  if (role) {
    return getRoleDisplayName(role, customRole);
  }
  if (name) {
    return getRoleDisplayName(name);
  }
  return '-';
}

/**
 * 날짜 문자열을 Date 객체로 변환
 * iOS 타임존 이슈 방지를 위해 직접 파싱
 */
function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * 날짜 포맷 (M/D(요일))
 */
function formatSingleDate(dateStr: string): string {
  if (!dateStr) return '-';
  const date = parseDate(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
  return `${month}/${day}(${dayOfWeek})`;
}

/**
 * TimeSlot 통계 계산
 */
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

// ============================================================================
// Sub Components
// ============================================================================

interface GroupItemProps {
  group: DateRangeGroupWithStats;
  showFilledCount?: boolean;
  defaultExpanded?: boolean;
}

/**
 * 그룹 아이템 컴포넌트
 */
const GroupItem = memo(function GroupItem({
  group,
  showFilledCount = false,
  defaultExpanded = false,
}: GroupItemProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const toggleExpand = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded((prev) => !prev);
  }, []);

  const isSingleDay = group.stats.dayCount === 1;
  const dateDisplay = formatDateRangeWithCount(group.startDate, group.endDate);

  // 시간대 표시 (첫 번째 timeSlot 기준)
  const firstTimeSlot = group.timeSlots[0];
  const timeDisplay = firstTimeSlot?.isTimeToBeAnnounced
    ? `미정${firstTimeSlot.tentativeDescription ? ` (${firstTimeSlot.tentativeDescription})` : ''}`
    : firstTimeSlot?.startTime || '-';

  // 역할 표시
  const rolesDisplay =
    firstTimeSlot?.roles
      .map((r) => {
        const label = getRoleLabel(r.role, undefined, r.customRole);
        const headcount = r.headcount ?? 0;
        if (showFilledCount) {
          const filled = r.filled ?? 0;
          return `${label} ${filled}/${headcount}명`;
        }
        return `${label} ${headcount}명`;
      })
      .join(', ') || '-';

  return (
    <View className="mb-3">
      {/* 그룹 헤더 */}
      <View className="flex-row items-center justify-between">
        <View className="flex-1">
          {/* 날짜 범위 */}
          <View className="flex-row items-center mb-1">
            <Text className="text-sm font-semibold text-gray-900 dark:text-white">
              {isSingleDay ? `📅 ${formatSingleDate(group.startDate)}` : `📅 ${dateDisplay}`}
            </Text>
          </View>

          {/* 시간 + 역할 */}
          <View className="ml-4">
            <Text className="text-sm text-gray-600 dark:text-gray-400">
              {timeDisplay} {rolesDisplay}
            </Text>
          </View>
        </View>

        {/* 충원 현황 뱃지 */}
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

        {/* 펼침/접힘 버튼 (다중 날짜인 경우만) */}
        {!isSingleDay && (
          <Pressable
            onPress={toggleExpand}
            className="ml-2 p-1.5 rounded-full active:bg-gray-100 dark:active:bg-gray-700"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel={isExpanded ? '날짜별 상세 접기' : '날짜별 상세 펼치기'}
          >
            {isExpanded ? (
              <ChevronUpIcon size={16} color="#6B7280" />
            ) : (
              <ChevronDownIcon size={16} color="#6B7280" />
            )}
          </Pressable>
        )}
      </View>

      {/* 펼침 상태: 개별 날짜 목록 */}
      {isExpanded && !isSingleDay && (
        <View className="mt-2 ml-4 pl-3 border-l-2 border-gray-200 dark:border-surface-overlay">
          {group.originalRequirements.map((req, idx) => {
            const dateStr = toDateString(req.date);
            const stats = calculateTimeSlotStats(req.timeSlots);

            return (
              <View key={idx} className="flex-row items-center justify-between py-1.5">
                <Text className="text-sm text-gray-700 dark:text-gray-300">
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

// ============================================================================
// Main Component
// ============================================================================

/**
 * 그룹화된 날짜별 요구사항 표시 컴포넌트
 */
export const GroupedDateRequirementDisplay = memo(function GroupedDateRequirementDisplay({
  requirements,
  showFilledCount = false,
  defaultExpanded = false,
}: GroupedDateRequirementDisplayProps) {
  // 그룹화 + 통계 정보 추가
  const groupsWithStats = useMemo<DateRangeGroupWithStats[]>(() => {
    if (!requirements || requirements.length === 0) return [];

    // DateSpecificRequirement로 변환 (타입 호환성)
    const converted = requirements.map((req) => ({
      date: toDateString(req.date),
      isGrouped: req.isGrouped,
      timeSlots: req.timeSlots.map((slot) => ({
        ...slot,
        startTime: slot.startTime || slot.time,
        roles: slot.roles.map((role) => ({
          ...role,
          role: role.role || role.name,
          headcount: role.headcount ?? role.count ?? 0,
        })),
      })),
    }));

    // 그룹화
    const groups = groupRequirementsToDateRanges(converted as DateSpecificRequirement[]);

    // 각 그룹에 원본 요구사항 및 통계 추가
    return groups.map((group) => {
      const groupDates = getDatesBetween(group.startDate, group.endDate);
      const originalRequirements = requirements.filter((req) => {
        const dateStr = toDateString(req.date);
        return groupDates.includes(dateStr);
      });

      // 전체 통계 (날짜별 합산)
      let totalPerDay = 0;
      if (originalRequirements.length > 0) {
        const firstReq = originalRequirements[0]!;
        firstReq.timeSlots.forEach((slot) => {
          slot.roles.forEach((role) => {
            totalPerDay += role.headcount ?? role.count ?? 0;
          });
        });
      }

      const dayCount = originalRequirements.length;

      return {
        ...group,
        originalRequirements,
        stats: {
          total: totalPerDay * dayCount,
          filled: originalRequirements.reduce((acc, req) => {
            return (
              acc +
              req.timeSlots.reduce((slotAcc, slot) => {
                return (
                  slotAcc +
                  slot.roles.reduce((roleAcc, role) => {
                    return roleAcc + (role.filled ?? 0);
                  }, 0)
                );
              }, 0)
            );
          }, 0),
          dayCount,
        },
      };
    });
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

// ============================================================================
// Helpers
// ============================================================================

/**
 * Date 객체를 YYYY-MM-DD 문자열로 변환 (타임존 안전)
 */
function formatDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 시작/종료 날짜 사이의 모든 날짜 반환
 * iOS 타임존 이슈 방지를 위해 직접 파싱
 */
function getDatesBetween(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const start = parseDate(startDate);
  const end = parseDate(endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return [startDate];
  }

  const current = new Date(start);
  while (current <= end) {
    dates.push(formatDateString(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

export default GroupedDateRequirementDisplay;
