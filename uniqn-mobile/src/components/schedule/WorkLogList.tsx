/**
 * UNIQN Mobile - 근무 기록 목록 컴포넌트
 *
 * @description FlashList 기반 근무 기록 히스토리 목록
 * @version 1.1.0
 */

import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  RefreshControl,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Timestamp } from 'firebase/firestore';
import { Badge, Skeleton, EmptyState } from '@/components/ui';
import {
  CalendarIcon,
  ClockIcon,
  
  BriefcaseIcon,
  CurrencyDollarIcon,
  CheckCircleIcon,
  ClockIcon as PendingIcon,
} from '@/components/icons';
import type { WorkLog, PayrollStatus } from '@/types';
import { getRoleDisplayName } from '@/types/unified';

// ============================================================================
// Types
// ============================================================================

export interface WorkLogListProps {
  /** 근무 기록 목록 */
  workLogs: WorkLog[];
  /** 로딩 상태 */
  isLoading: boolean;
  /** 새로고침 중 상태 */
  isRefreshing?: boolean;
  /** 더 불러오는 중 상태 */
  isFetchingMore?: boolean;
  /** 더 불러올 데이터 있음 */
  hasMore?: boolean;
  /** 새로고침 핸들러 */
  onRefresh?: () => void;
  /** 더 불러오기 핸들러 */
  onLoadMore?: () => void;
  /** 아이템 클릭 핸들러 */
  onItemPress?: (workLog: WorkLog) => void;
  /** 빈 상태 메시지 */
  emptyMessage?: string;
  /** 헤더 컴포넌트 */
  ListHeaderComponent?: React.ReactElement;
}

// ============================================================================
// Constants
// ============================================================================

/** 근무 상태 설정 */
const WORK_STATUS_CONFIG: Record<
  WorkLog['status'],
  { label: string; variant: 'default' | 'success' | 'warning' | 'error' }
> = {
  scheduled: { label: '예정', variant: 'default' },
  checked_in: { label: '근무 중', variant: 'success' },
  checked_out: { label: '퇴근', variant: 'default' },
  completed: { label: '완료', variant: 'success' },
  cancelled: { label: '취소', variant: 'error' },
};

/** 정산 상태 설정 */
const PAYROLL_STATUS_CONFIG: Record<
  PayrollStatus,
  { label: string; color: string; bgColor: string }
> = {
  pending: { label: '정산 대기', color: 'text-yellow-700 dark:text-yellow-300', bgColor: 'bg-yellow-100 dark:bg-yellow-900/30' },
  processing: { label: '정산 중', color: 'text-blue-700 dark:text-blue-300', bgColor: 'bg-blue-100 dark:bg-blue-900/30' },
  completed: { label: '정산 완료', color: 'text-green-700 dark:text-green-300', bgColor: 'bg-green-100 dark:bg-green-900/30' },
};


// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Timestamp를 시간 문자열로 변환
 */
function formatTime(timestamp: string | Timestamp | undefined): string {
  if (!timestamp) return '--:--';

  const date = typeof timestamp === 'string'
    ? new Date(timestamp)
    : timestamp.toDate();

  return date.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

/**
 * 날짜 문자열 포맷
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const options: Intl.DateTimeFormatOptions = {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  };
  return date.toLocaleDateString('ko-KR', options);
}

/**
 * 금액 포맷
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ko-KR').format(amount) + '원';
}

/**
 * 근무 시간 계산
 */
function calculateWorkHours(
  startTime: string | Timestamp | undefined,
  endTime: string | Timestamp | undefined
): string {
  if (!startTime || !endTime) return '-';

  const start = typeof startTime === 'string'
    ? new Date(startTime)
    : startTime.toDate();
  const end = typeof endTime === 'string'
    ? new Date(endTime)
    : endTime.toDate();

  const diffMs = end.getTime() - start.getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (hours === 0) return `${minutes}분`;
  if (minutes === 0) return `${hours}시간`;
  return `${hours}시간 ${minutes}분`;
}

// ============================================================================
// Sub Components
// ============================================================================

/** 스켈레톤 아이템 */
function WorkLogSkeleton() {
  return (
    <View className="bg-white dark:bg-gray-800 rounded-xl p-4 mb-3 border border-gray-100 dark:border-gray-700">
      <View className="flex-row items-center justify-between mb-3">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </View>
      <Skeleton className="h-4 w-3/4 mb-2" />
      <View className="flex-row gap-4 mb-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-24" />
      </View>
      <View className="flex-row justify-between">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-5 w-24" />
      </View>
    </View>
  );
}

/** 근무 기록 아이템 */
interface WorkLogItemProps {
  workLog: WorkLog;
  onPress?: () => void;
}

const WorkLogItem = React.memo(function WorkLogItem({ workLog, onPress }: WorkLogItemProps) {
  const statusConfig = WORK_STATUS_CONFIG[workLog.status];
  const payrollConfig = workLog.payrollStatus
    ? PAYROLL_STATUS_CONFIG[workLog.payrollStatus]
    : null;
  const roleLabel = getRoleDisplayName(workLog.role, workLog.customRole);

  // 실제 근무 시간 (있으면 사용, 없으면 예정 시간)
  const startTime = workLog.actualStartTime || workLog.scheduledStartTime;
  const endTime = workLog.actualEndTime || workLog.scheduledEndTime;
  const workHours = calculateWorkHours(startTime, endTime);

  const isCompleted = workLog.status === 'completed' || workLog.status === 'checked_out';

  return (
    <Pressable
      onPress={onPress}
      className="bg-white dark:bg-gray-800 rounded-xl p-4 mb-3 border border-gray-100 dark:border-gray-700 active:opacity-80"
      accessibilityRole="button"
      accessibilityLabel={`${formatDate(workLog.date)} ${roleLabel} 근무 기록`}
    >
      {/* 헤더 */}
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center">
          <CalendarIcon size={16} color="#6B7280" />
          <Text className="ml-2 text-sm font-medium text-gray-900 dark:text-white">
            {formatDate(workLog.date)}
          </Text>
        </View>
        <Badge variant={statusConfig.variant}>
          {statusConfig.label}
        </Badge>
      </View>

      {/* 역할 & 시간 */}
      <View className="flex-row items-center gap-4 mb-3">
        <View className="flex-row items-center">
          <BriefcaseIcon size={14} color="#9CA3AF" />
          <Text className="ml-1 text-sm text-gray-600 dark:text-gray-400">
            {roleLabel}
          </Text>
        </View>
        <View className="flex-row items-center">
          <ClockIcon size={14} color="#9CA3AF" />
          <Text className="ml-1 text-sm text-gray-600 dark:text-gray-400">
            {formatTime(startTime)} - {formatTime(endTime)}
          </Text>
        </View>
      </View>

      {/* 근무 시간 & 정산 */}
      <View className="flex-row items-center justify-between">
        {/* 근무 시간 */}
        <View className="flex-row items-center">
          {isCompleted ? (
            <CheckCircleIcon size={14} color="#22c55e" />
          ) : (
            <PendingIcon size={14} color="#9CA3AF" />
          )}
          <Text className={`ml-1 text-sm ${isCompleted ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
            {isCompleted ? workHours : '진행 중'}
          </Text>
        </View>

        {/* 정산 정보 */}
        {workLog.payrollAmount && workLog.payrollAmount > 0 && (
          <View className="flex-row items-center">
            {payrollConfig && (
              <View className={`px-2 py-0.5 rounded-full mr-2 ${payrollConfig.bgColor}`}>
                <Text className={`text-xs ${payrollConfig.color}`}>
                  {payrollConfig.label}
                </Text>
              </View>
            )}
            <View className="flex-row items-center">
              <CurrencyDollarIcon size={14} color="#6366f1" />
              <Text className="ml-1 text-sm font-semibold text-primary-600 dark:text-primary-400">
                {formatCurrency(workLog.payrollAmount)}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* 메모 (있는 경우) */}
      {workLog.notes && (
        <View className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
          <Text className="text-xs text-gray-500 dark:text-gray-400" numberOfLines={2}>
            📝 {workLog.notes}
          </Text>
        </View>
      )}
    </Pressable>
  );
});

// ============================================================================
// Main Component
// ============================================================================

export const WorkLogList: React.FC<WorkLogListProps> = React.memo(
  ({
    workLogs,
    isLoading,
    isRefreshing = false,
    isFetchingMore = false,
    hasMore = false,
    onRefresh,
    onLoadMore,
    onItemPress,
    emptyMessage = '근무 기록이 없습니다',
    ListHeaderComponent,
  }) => {
    // 아이템 렌더러
    const renderItem = useCallback(
      ({ item }: { item: WorkLog }) => (
        <WorkLogItem
          workLog={item}
          onPress={() => onItemPress?.(item)}
        />
      ),
      [onItemPress]
    );

    // 키 추출
    const keyExtractor = useCallback((item: WorkLog) => item.id, []);

    // 더 불러오기 핸들러
    const handleEndReached = useCallback(() => {
      if (!isFetchingMore && hasMore && onLoadMore) {
        onLoadMore();
      }
    }, [isFetchingMore, hasMore, onLoadMore]);

    // 푸터 렌더러
    const renderFooter = useCallback(() => {
      if (!isFetchingMore) return null;
      return (
        <View className="py-4 items-center">
          <ActivityIndicator size="small" color="#6366f1" />
        </View>
      );
    }, [isFetchingMore]);

    // 통계 계산
    const stats = useMemo(() => {
      const completed = workLogs.filter(
        (log) => log.status === 'completed' || log.status === 'checked_out'
      ).length;
      const totalEarnings = workLogs.reduce(
        (sum, log) => sum + (log.payrollAmount || 0),
        0
      );
      return { completed, totalEarnings };
    }, [workLogs]);

    // 초기 로딩
    if (isLoading && workLogs.length === 0) {
      return (
        <View className="flex-1 px-4 pt-4">
          {ListHeaderComponent}
          {[1, 2, 3, 4].map((i) => (
            <WorkLogSkeleton key={i} />
          ))}
        </View>
      );
    }

    // 빈 상태
    if (!isLoading && workLogs.length === 0) {
      return (
        <View className="flex-1 px-4 pt-4">
          {ListHeaderComponent}
          <EmptyState
            title="근무 기록 없음"
            description={emptyMessage}
            icon="📋"
          />
        </View>
      );
    }

    return (
      <FlashList
        data={workLogs}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={{ padding: 16 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor="#6366f1"
            />
          ) : undefined
        }
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={
          <>
            {ListHeaderComponent}
            {/* 요약 통계 */}
            {workLogs.length > 0 && (
              <View className="bg-primary-50 dark:bg-primary-900/20 rounded-xl p-4 mb-4">
                <View className="flex-row justify-around">
                  <View className="items-center">
                    <Text className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                      {stats.completed}
                    </Text>
                    <Text className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      완료 건수
                    </Text>
                  </View>
                  <View className="w-px bg-primary-200 dark:bg-primary-700" />
                  <View className="items-center">
                    <Text className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                      {formatCurrency(stats.totalEarnings)}
                    </Text>
                    <Text className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      총 수입
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </>
        }
        ListFooterComponent={renderFooter}
        ListEmptyComponent={
          <EmptyState
            title="근무 기록 없음"
            description={emptyMessage}
            icon="📋"
          />
        }
      />
    );
  }
);

WorkLogList.displayName = 'WorkLogList';

export default WorkLogList;
