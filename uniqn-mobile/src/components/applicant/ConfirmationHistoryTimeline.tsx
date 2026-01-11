/**
 * UNIQN Mobile - 확정/취소 이력 타임라인 컴포넌트
 *
 * @description Application의 confirmationHistory를 시각적 타임라인으로 표시
 * @version 1.0.0
 */

import React, { memo, useMemo } from 'react';
import { View, Text } from 'react-native';
import { Badge } from '@/components/ui/Badge';
import type { ConfirmationHistoryEntry, OriginalApplication, Assignment } from '@/types';
import { Timestamp } from 'firebase/firestore';

// ============================================================================
// Types
// ============================================================================

interface ConfirmationHistoryTimelineProps {
  /** 확정 이력 배열 */
  history: ConfirmationHistoryEntry[];
  /** 최초 지원 정보 */
  originalApplication?: OriginalApplication;
  /** 컴팩트 모드 */
  compact?: boolean;
  /** 최대 표시 개수 */
  maxDisplay?: number;
  /** 추가 클래스 */
  className?: string;
}

interface TimelineItemProps {
  entry: ConfirmationHistoryEntry;
  index: number;
  isLast: boolean;
  compact?: boolean;
}

interface OriginalApplicationItemProps {
  original: OriginalApplication;
  compact?: boolean;
}

// ============================================================================
// Helpers
// ============================================================================

const formatDateTime = (timestamp: Timestamp | { seconds: number }): string => {
  let date: Date;
  if (timestamp instanceof Timestamp) {
    date = timestamp.toDate();
  } else if ('seconds' in timestamp) {
    date = new Date(timestamp.seconds * 1000);
  } else {
    return '날짜 없음';
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${year}.${month}.${day} ${hours}:${minutes}`;
};

const formatAssignmentsSummary = (assignments: Assignment[]): string => {
  if (!assignments.length) return '정보 없음';

  const dateCount = assignments.reduce((sum, a) => sum + a.dates.length, 0);
  // v3.0: roleIds 사용
  const roles = [...new Set(assignments.map((a) => a.roleIds[0] ?? ''))];
  const roleLabels = roles
    .filter(Boolean)
    .map((r) => getRoleLabel(r))
    .join(', ');

  return `${roleLabels} / ${dateCount}일`;
};

const getRoleLabel = (role: string): string => {
  const roleMap: Record<string, string> = {
    dealer: '딜러',
    manager: '매니저',
    chiprunner: '칩러너',
    admin: '관리자',
  };
  return roleMap[role] ?? role;
};

// ============================================================================
// Sub Components
// ============================================================================

/**
 * 최초 지원 정보 항목
 */
const OriginalApplicationItem = memo(function OriginalApplicationItem({
  original,
  compact,
}: OriginalApplicationItemProps) {
  const formattedDate = formatDateTime(original.appliedAt);
  const summary = formatAssignmentsSummary(original.assignments);

  if (compact) {
    return (
      <View className="flex-row items-center">
        <View className="w-2 h-2 rounded-full bg-blue-500 mr-2" />
        <Text className="text-xs text-gray-500 dark:text-gray-400">
          지원 {formattedDate}
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-row mb-4">
      {/* 타임라인 라인 */}
      <View className="items-center mr-3">
        <View className="w-3 h-3 rounded-full bg-blue-500" />
        <View className="w-0.5 flex-1 bg-gray-200 dark:bg-gray-700 mt-1" />
      </View>

      {/* 내용 */}
      <View className="flex-1 pb-4">
        <View className="flex-row items-center mb-1">
          <Badge variant="primary" size="sm">
            최초 지원
          </Badge>
          <Text className="text-xs text-gray-400 dark:text-gray-500 ml-2">
            {formattedDate}
          </Text>
        </View>
        <Text className="text-sm text-gray-600 dark:text-gray-400">
          {summary}
        </Text>
      </View>
    </View>
  );
});

/**
 * 확정/취소 이력 항목
 */
const TimelineItem = memo(function TimelineItem({
  entry,
  index,
  isLast,
  compact,
}: TimelineItemProps) {
  const isCancelled = !!entry.cancelledAt;
  const confirmedDate = formatDateTime(entry.confirmedAt);
  const cancelledDate = entry.cancelledAt ? formatDateTime(entry.cancelledAt) : null;
  const summary = formatAssignmentsSummary(entry.assignments);

  if (compact) {
    return (
      <View className="flex-row items-center mb-1">
        <View
          className={`w-2 h-2 rounded-full mr-2 ${
            isCancelled ? 'bg-red-500' : 'bg-green-500'
          }`}
        />
        <Text className="text-xs text-gray-500 dark:text-gray-400">
          {isCancelled ? '취소' : '확정'} {isCancelled ? cancelledDate : confirmedDate}
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-row mb-4">
      {/* 타임라인 라인 */}
      <View className="items-center mr-3">
        <View
          className={`w-3 h-3 rounded-full ${
            isCancelled ? 'bg-red-500' : 'bg-green-500'
          }`}
        />
        {!isLast && (
          <View className="w-0.5 flex-1 bg-gray-200 dark:bg-gray-700 mt-1" />
        )}
      </View>

      {/* 내용 */}
      <View className="flex-1 pb-4">
        {/* 확정 정보 */}
        <View className="flex-row items-center mb-1">
          <Badge variant={isCancelled ? 'default' : 'success'} size="sm">
            {index + 1}차 확정
          </Badge>
          <Text className="text-xs text-gray-400 dark:text-gray-500 ml-2">
            {confirmedDate}
          </Text>
        </View>
        <Text className="text-sm text-gray-600 dark:text-gray-400 mb-1">
          {summary}
        </Text>

        {/* 취소 정보 */}
        {isCancelled && (
          <View className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded">
            <View className="flex-row items-center mb-1">
              <Badge variant="error" size="sm">
                취소됨
              </Badge>
              <Text className="text-xs text-gray-400 dark:text-gray-500 ml-2">
                {cancelledDate}
              </Text>
            </View>
            {entry.cancelReason && (
              <Text className="text-sm text-red-600 dark:text-red-400">
                사유: {entry.cancelReason}
              </Text>
            )}
          </View>
        )}
      </View>
    </View>
  );
});

// ============================================================================
// Main Component
// ============================================================================

/**
 * 확정/취소 이력 타임라인 컴포넌트
 *
 * @description Application의 confirmationHistory를 시각적 타임라인으로 표시
 *
 * @example
 * <ConfirmationHistoryTimeline
 *   history={application.confirmationHistory}
 *   originalApplication={application.originalApplication}
 * />
 */
export const ConfirmationHistoryTimeline = memo(function ConfirmationHistoryTimeline({
  history,
  originalApplication,
  compact = false,
  maxDisplay,
  className = '',
}: ConfirmationHistoryTimelineProps) {
  // 표시할 이력 계산
  const displayHistory = useMemo(() => {
    if (!history?.length) return [];
    const sorted = [...history].sort((a, b) => {
      const timeA = a.confirmedAt.toMillis();
      const timeB = b.confirmedAt.toMillis();
      return timeA - timeB;
    });
    return maxDisplay ? sorted.slice(0, maxDisplay) : sorted;
  }, [history, maxDisplay]);

  const remainingCount = maxDisplay
    ? Math.max(0, (history?.length ?? 0) - maxDisplay)
    : 0;

  // 활성 확정 여부
  const hasActiveConfirmation = useMemo(() => {
    return displayHistory.some((entry) => !entry.cancelledAt);
  }, [displayHistory]);

  // 이력이 없으면 null
  if (!history?.length && !originalApplication) {
    return null;
  }

  if (compact) {
    return (
      <View className={`${className}`}>
        {originalApplication && (
          <OriginalApplicationItem original={originalApplication} compact />
        )}
        {displayHistory.map((entry, index) => (
          <TimelineItem
            key={index}
            entry={entry}
            index={index}
            isLast={index === displayHistory.length - 1}
            compact
          />
        ))}
        {remainingCount > 0 && (
          <Text className="text-xs text-gray-400">+{remainingCount}개 이력</Text>
        )}
      </View>
    );
  }

  return (
    <View className={`bg-gray-50 dark:bg-gray-900 rounded-xl p-4 ${className}`}>
      {/* 헤더 */}
      <View className="flex-row items-center justify-between mb-4">
        <Text className="text-base font-semibold text-gray-900 dark:text-white">
          확정 이력
        </Text>
        <View className="flex-row items-center">
          {hasActiveConfirmation ? (
            <Badge variant="success" size="sm">
              확정됨
            </Badge>
          ) : history?.length ? (
            <Badge variant="default" size="sm">
              취소됨
            </Badge>
          ) : null}
        </View>
      </View>

      {/* 통계 */}
      {history && history.length > 0 && (
        <View className="flex-row mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
          <View className="flex-1 items-center">
            <Text className="text-lg font-bold text-gray-900 dark:text-white">
              {history.length}
            </Text>
            <Text className="text-xs text-gray-500 dark:text-gray-400">
              총 확정
            </Text>
          </View>
          <View className="flex-1 items-center">
            <Text className="text-lg font-bold text-red-600 dark:text-red-400">
              {history.filter((e) => e.cancelledAt).length}
            </Text>
            <Text className="text-xs text-gray-500 dark:text-gray-400">
              취소
            </Text>
          </View>
          <View className="flex-1 items-center">
            <Text className="text-lg font-bold text-green-600 dark:text-green-400">
              {history.filter((e) => !e.cancelledAt).length}
            </Text>
            <Text className="text-xs text-gray-500 dark:text-gray-400">
              활성
            </Text>
          </View>
        </View>
      )}

      {/* 타임라인 */}
      <View>
        {originalApplication && (
          <OriginalApplicationItem original={originalApplication} />
        )}
        {displayHistory.map((entry, index) => (
          <TimelineItem
            key={index}
            entry={entry}
            index={index}
            isLast={index === displayHistory.length - 1 && !remainingCount}
          />
        ))}
        {remainingCount > 0 && (
          <View className="flex-row items-center">
            <View className="w-3 h-3 rounded-full bg-gray-300 dark:bg-gray-600 mr-3" />
            <Text className="text-sm text-gray-400 dark:text-gray-500">
              +{remainingCount}개 더보기
            </Text>
          </View>
        )}
      </View>
    </View>
  );
});

export default ConfirmationHistoryTimeline;
