/**
 * UNIQN Mobile - 고정공고 일정 표시 컴포넌트
 *
 * @description 고정공고(fixed)의 근무 일정 정보를 통일된 형식으로 표시
 * @version 1.0.0
 */

import React, { memo, useMemo } from 'react';
import { View, Text } from 'react-native';
import { Badge } from '@/components/ui/Badge';
import { getRoleDisplayName } from '@/types/unified';

// ============================================================================
// Types
// ============================================================================

interface RoleWithCount {
  role?: string;
  name?: string;
  /** 커스텀 역할명 (role이 'other'일 때) */
  customRole?: string;
  count: number;
  filled?: number;
}

interface FixedScheduleDisplayProps {
  /** 주 출근일수 (0 = 협의, 1-7 = 일수) */
  daysPerWeek?: number;
  /** 출근 시간 (HH:mm) */
  startTime?: string;
  /** 출근 시간 협의 여부 */
  isStartTimeNegotiable?: boolean;
  /** 역할별 모집 인원 */
  roles?: RoleWithCount[];
  /** 역할 표시 여부 */
  showRoles?: boolean;
  /** 충원 현황 표시 여부 */
  showFilledCount?: boolean;
  /** 컴팩트 모드 (한 줄 표시) */
  compact?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

// ============================================================================
// Helpers
// ============================================================================

/**
 * 역할 라벨 가져오기 (레거시 호환: role/name 필드 분기)
 * - v2.0: role 필드 사용 (customRole과 함께)
 * - 레거시: name 필드 사용 (customRole 무시 - name이 이미 표시명)
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
 * 주 출근일수 포맷
 */
function formatDaysPerWeek(daysPerWeek?: number): string {
  if (!daysPerWeek || daysPerWeek <= 0) {
    return '협의';
  }
  return `주 ${daysPerWeek}일`;
}

/**
 * 출근 시간 포맷
 */
function formatStartTime(startTime?: string, isNegotiable?: boolean): string {
  if (isNegotiable || !startTime) {
    return '협의';
  }
  return startTime;
}

// ============================================================================
// Sub Components
// ============================================================================

/**
 * 역할 표시 컴포넌트
 */
const RoleDisplay = memo(function RoleDisplay({
  role,
  showFilledCount,
}: {
  role: RoleWithCount;
  showFilledCount?: boolean;
}) {
  const label = getRoleLabel(role.role, role.name, role.customRole);
  const filled = role.filled ?? 0;
  const count = role.count ?? 0;

  return (
    <View className="flex-row items-center mr-2 mb-1">
      <Badge variant="primary" size="sm">
        {showFilledCount ? `${label} ${filled}/${count}명` : `${label} ${count}명`}
      </Badge>
    </View>
  );
});

// ============================================================================
// Main Component
// ============================================================================

/**
 * 고정공고 일정 표시 컴포넌트
 */
export const FixedScheduleDisplay = memo(function FixedScheduleDisplay({
  daysPerWeek,
  startTime,
  isStartTimeNegotiable,
  roles,
  showRoles = false,
  showFilledCount = false,
  compact = false,
}: FixedScheduleDisplayProps) {
  // 표시 문자열 계산
  const daysText = useMemo(() => formatDaysPerWeek(daysPerWeek), [daysPerWeek]);
  const timeText = useMemo(
    () => formatStartTime(startTime, isStartTimeNegotiable),
    [startTime, isStartTimeNegotiable]
  );

  // 역할 요약 텍스트
  const rolesText = useMemo(() => {
    if (!roles || roles.length === 0) return '';
    return roles
      .map((r) => {
        const label = getRoleLabel(r.role, r.name, r.customRole);
        return showFilledCount ? `${label} ${r.filled ?? 0}/${r.count}명` : `${label} ${r.count}명`;
      })
      .join(', ');
  }, [roles, showFilledCount]);

  // 전체 인원 합계
  const totalStats = useMemo(() => {
    if (!roles || roles.length === 0) return { total: 0, filled: 0 };
    let total = 0;
    let filled = 0;
    roles.forEach((r) => {
      total += r.count ?? 0;
      filled += r.filled ?? 0;
    });
    return { total, filled };
  }, [roles]);

  // 접근성 라벨
  const accessibilityLabel = useMemo(() => {
    const parts = [daysText];
    parts.push(`출근시간 ${timeText}`);
    if (showRoles && rolesText) {
      parts.push(rolesText);
    }
    return parts.join(', ');
  }, [daysText, timeText, showRoles, rolesText]);

  // Compact 모드
  if (compact) {
    return (
      <View className="py-1" accessibilityLabel={accessibilityLabel} accessibilityRole="text">
        <Text className="text-sm text-secondary-700 dark:text-secondary-300 mb-0.5">
          {daysText} 출근
        </Text>
        <Text className="text-sm text-secondary-700 dark:text-secondary-300">
          출근시간 {timeText}
        </Text>
        {showRoles && rolesText && (
          <Text className="text-sm text-secondary-700 dark:text-secondary-300 mt-0.5">
            {rolesText}
          </Text>
        )}
      </View>
    );
  }

  // 기본 모드
  return (
    <View className="py-1" accessibilityLabel={accessibilityLabel} accessibilityRole="text">
      {/* 주 출근일수 */}
      <View className="flex-row items-center mb-2">
        <Text className="text-sm font-medium text-secondary-900 dark:text-white">{daysText}</Text>
      </View>

      {/* 출근 시간 */}
      <View className="flex-row items-center mb-2">
        <Text className="text-sm font-medium text-secondary-700 dark:text-secondary-300">
          {timeText}
        </Text>
      </View>

      {/* 역할별 인원 */}
      {showRoles && roles && roles.length > 0 && (
        <View className="mt-1">
          <View className="flex-row items-center mb-1">
            <Text className="text-sm font-medium text-secondary-700 dark:text-secondary-300 mr-2">
              모집 인원
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
          <View className="flex-row flex-wrap ml-5">
            {roles.map((role, idx) => (
              <RoleDisplay
                key={role.role || role.name || idx}
                role={role}
                showFilledCount={showFilledCount}
              />
            ))}
          </View>
        </View>
      )}
    </View>
  );
});

export default FixedScheduleDisplay;
