/**
 * UNIQN Mobile - 날짜별 요구사항 표시 컴포넌트
 *
 * @description 날짜별 모집 정보를 통일된 형식으로 표시
 * @version 1.0.0
 */

import React, { memo, useMemo } from 'react';
import { View, Text } from 'react-native';
import { Badge } from '@/components/ui/Badge';
import { Timestamp } from 'firebase/firestore';

// 역할 요구사항 호환 타입 (postingConfig + dateRequirement 양쪽 지원)
interface RoleRequirementCompat {
  id?: string;
  role?: string;       // v2.0 필드
  name?: string;       // 레거시 필드 (역할 이름)
  customRole?: string;
  headcount?: number;  // v2.0 필드
  count?: number;      // 레거시 필드 (인원)
  filled?: number;
}

// 시간대 호환 타입 (postingConfig + dateRequirement 양쪽 지원)
interface TimeSlotCompat {
  id?: string;
  startTime?: string;
  time?: string; // 레거시 필드
  isTimeToBeAnnounced?: boolean;
  tentativeDescription?: string;
  roles: RoleRequirementCompat[];
}

// DateSpecificRequirement 호환 타입 (postingConfig + dateRequirement 양쪽 지원)
interface DateSpecificRequirementCompat {
  date: string | Timestamp | { seconds: number };
  timeSlots: TimeSlotCompat[];
}

// ============================================================================
// Types
// ============================================================================

interface DateRequirementDisplayProps {
  /** 날짜별 요구사항 (postingConfig 또는 dateRequirement 타입 모두 지원) */
  requirement: DateSpecificRequirementCompat;
  /** 충원 현황 표시 여부 */
  showFilledCount?: boolean;
  /** 컴팩트 모드 (한 줄 표시) */
  compact?: boolean;
  /** 인덱스 (Day N 표시용) */
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

// ============================================================================
// Constants
// ============================================================================

const ROLE_LABELS: Record<string, string> = {
  dealer: '딜러',
  floor: '플로어',
  manager: '매니저',
  chiprunner: '칩러너',
  admin: '관리자',
  other: '기타',
};

// ============================================================================
// Helpers
// ============================================================================

/**
 * 날짜 문자열 추출
 */
function getDateString(dateInput: string | Timestamp | { seconds: number }): string {
  if (typeof dateInput === 'string') {
    return dateInput;
  }
  if (dateInput instanceof Timestamp) {
    return dateInput.toDate().toISOString().split('T')[0] ?? '';
  }
  if ('seconds' in dateInput) {
    return new Date(dateInput.seconds * 1000).toISOString().split('T')[0] ?? '';
  }
  return '';
}

/**
 * 날짜 포맷 (M/D(요일))
 */
function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
  return `${month}/${day}(${dayOfWeek})`;
}

/**
 * 역할 라벨 가져오기 (v2.0 role 또는 레거시 name 지원)
 */
function getRoleLabel(role?: string, name?: string, customRole?: string): string {
  // v2.0: role 필드 사용
  if (role) {
    if (role === 'other' && customRole) {
      return customRole;
    }
    return ROLE_LABELS[role] || role;
  }
  // 레거시: name 필드 사용 (이미 역할 이름이 저장됨)
  if (name) {
    return ROLE_LABELS[name] || name;
  }
  return '-';
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
}: RoleDisplayProps) {
  const label = getRoleLabel(role.role, role.name, role.customRole);
  const filled = role.filled ?? 0;
  const headcount = role.headcount ?? role.count ?? 0;

  return (
    <View className="flex-row items-center mr-2 mb-1">
      <Badge variant="primary" size="sm">
        {showFilledCount
          ? `${label} ${filled}/${headcount}명`
          : `${label} ${headcount}명`}
      </Badge>
    </View>
  );
});

/**
 * 시간대 표시 컴포넌트
 */
const TimeSlotDisplay = memo(function TimeSlotDisplay({
  timeSlot,
  showFilledCount,
  compact,
}: TimeSlotDisplayProps) {
  // startTime 또는 time 필드 사용 (호환성)
  const timeValue = timeSlot.startTime || timeSlot.time || '-';
  // 시간 미정인 경우: "시간 미정" + 사유(있으면) 표시
  const timeDisplay = timeSlot.isTimeToBeAnnounced
    ? `시간 미정${timeSlot.tentativeDescription ? ` (${timeSlot.tentativeDescription})` : ''}`
    : timeValue;

  if (compact) {
    return (
      <Text className="text-sm text-gray-600 dark:text-gray-400">
        {timeDisplay} • {timeSlot.roles.map(r => getRoleLabel(r.role, r.name, r.customRole)).join(', ')}
      </Text>
    );
  }

  return (
    <View className="ml-4 mt-1">
      <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        🕐 {timeDisplay}
      </Text>
      <View className="flex-row flex-wrap ml-4">
        {timeSlot.roles.map((role, idx) => (
          <RoleDisplay
            key={role.id || idx}
            role={role}
            showFilledCount={showFilledCount}
          />
        ))}
      </View>
    </View>
  );
});

// ============================================================================
// Main Component
// ============================================================================

/**
 * 날짜별 요구사항 표시 컴포넌트
 */
export const DateRequirementDisplay = memo(function DateRequirementDisplay({
  requirement,
  showFilledCount = false,
  compact = false,
  // index는 더 이상 사용하지 않음 (Day N 표시 제거)
}: DateRequirementDisplayProps) {
  const dateStr = useMemo(
    () => getDateString(requirement.date),
    [requirement.date]
  );

  const formattedDate = useMemo(
    () => formatDate(dateStr),
    [dateStr]
  );

  // 전체 인원 합계 (호환성 처리)
  const totalStats = useMemo(() => {
    let total = 0;
    let filled = 0;
    requirement.timeSlots.forEach(slot => {
      slot.roles.forEach(role => {
        total += role.headcount ?? role.count ?? 0;
        filled += role.filled ?? 0;
      });
    });
    return { total, filled };
  }, [requirement.timeSlots]);

  if (compact) {
    return (
      <View className="py-1">
        {/* 날짜 헤더 */}
        <View className="flex-row items-center mb-1">
          <Text className="text-sm font-medium text-gray-900 dark:text-white mr-2">
            📅 {formattedDate}
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
        {/* 시간대별 역할 (compact 모드) */}
        {requirement.timeSlots.map((slot, idx) => (
          <TimeSlotDisplay
            key={slot.id || idx}
            timeSlot={slot}
            showFilledCount={showFilledCount}
            compact={true}
          />
        ))}
      </View>
    );
  }

  return (
    <View className="mb-3">
      {/* 날짜 헤더 */}
      <View className="flex-row items-center justify-between mb-1">
        <Text className="text-sm font-semibold text-gray-900 dark:text-white">
          📅 {formattedDate}
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

      {/* 시간대별 역할 */}
      {requirement.timeSlots.map((slot, idx) => (
        <TimeSlotDisplay
          key={slot.id || idx}
          timeSlot={slot}
          showFilledCount={showFilledCount}
          compact={false}
        />
      ))}
    </View>
  );
});

export default DateRequirementDisplay;
