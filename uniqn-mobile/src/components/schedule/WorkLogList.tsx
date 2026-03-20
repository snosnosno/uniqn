import React, { useCallback, useMemo } from 'react';
import { View, Text, RefreshControl, ActivityIndicator, Pressable } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Badge, Skeleton, EmptyState } from '@/components/ui';
import { WorkTimeDisplay } from '@/shared/time';
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
import { formatCurrency } from '@/utils/settlement';
import { STATUS } from '@/constants';
import { formatDateShortWithDay } from '@/utils/date';

export interface WorkLogListProps {
  workLogs: WorkLog[];
  isLoading: boolean;
  isRefreshing?: boolean;
  isFetchingMore?: boolean;
  hasMore?: boolean;
  onRefresh?: () => void;
  onLoadMore?: () => void;
  onItemPress?: (workLog: WorkLog) => void;
  emptyMessage?: string;
  ListHeaderComponent?: React.ReactElement;
}

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

const PAYROLL_STATUS_CONFIG: Record<
  PayrollStatus,
  { label: string; color: string; bgColor: string }
> = {
  pending: {
    label: '정산 대기',
    color: 'text-yellow-700 dark:text-yellow-300',
    bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
  },
  processing: {
    label: '정산 중',
    color: 'text-primary-700 dark:text-primary-300',
    bgColor: 'bg-primary-100 dark:bg-primary-900/30',
  },
  completed: {
    label: '정산 완료',
    color: 'text-green-700 dark:text-green-300',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
  },
};

function formatDate(dateString: string): string {
  return formatDateShortWithDay(dateString) || dateString || '-';
}

function WorkLogSkeleton() {
  return (
    <View className="bg-white dark:bg-surface rounded-xl p-4 mb-3 border border-gray-100 dark:border-surface-overlay">
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

interface WorkLogItemProps {
  workLog: WorkLog;
  onPress?: () => void;
}

const WorkLogItem = React.memo(function WorkLogItem({ workLog, onPress }: WorkLogItemProps) {
  const statusConfig = WORK_STATUS_CONFIG[workLog.status];
  const payrollConfig = workLog.payrollStatus ? PAYROLL_STATUS_CONFIG[workLog.payrollStatus] : null;
  const roleLabel = getRoleDisplayName(workLog.role, workLog.customRole);
  const timeInfo = WorkTimeDisplay.getDisplayInfo({
    checkInTime: workLog.checkInTime,
    checkOutTime: workLog.checkOutTime,
    timeSlot: workLog.timeSlot,
    date: workLog.date,
  });
  const workHours = timeInfo.duration;

  const isCompleted =
    workLog.status === STATUS.WORK_LOG.COMPLETED || workLog.status === STATUS.WORK_LOG.CHECKED_OUT;

  return (
    <Pressable
      onPress={onPress}
      className="bg-white dark:bg-surface rounded-xl p-4 mb-3 border border-gray-100 dark:border-surface-overlay active:opacity-80"
      accessibilityRole="button"
      accessibilityLabel={`${formatDate(workLog.date)} ${roleLabel} 근무 기록`}
    >
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center">
          <CalendarIcon size={16} color="#6B7280" />
          <Text className="ml-2 text-sm font-medium text-gray-900 dark:text-white">
            {formatDate(workLog.date)}
          </Text>
        </View>
        <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
      </View>

      <View className="flex-row items-center gap-4 mb-3">
        <View className="flex-row items-center">
          <BriefcaseIcon size={14} color="#9CA3AF" />
          <Text className="ml-1 text-sm text-gray-600 dark:text-gray-400">{roleLabel}</Text>
        </View>
        <View className="flex-row items-center">
          <ClockIcon size={14} color="#9CA3AF" />
          <Text className="ml-1 text-sm text-gray-600 dark:text-gray-400">
            {timeInfo.effectiveStart} - {timeInfo.effectiveEnd}
          </Text>
        </View>
      </View>

      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center">
          {isCompleted ? (
            <CheckCircleIcon size={14} color="#22c55e" />
          ) : (
            <PendingIcon size={14} color="#9CA3AF" />
          )}
          <Text
            className={`ml-1 text-sm ${
              isCompleted
                ? 'text-green-600 dark:text-green-400'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            {isCompleted ? workHours : '진행 중'}
          </Text>
        </View>

        {workLog.payrollAmount && workLog.payrollAmount > 0 && (
          <View className="flex-row items-center">
            {payrollConfig && (
              <View className={`px-2 py-0.5 rounded-full mr-2 ${payrollConfig.bgColor}`}>
                <Text className={`text-xs ${payrollConfig.color}`}>{payrollConfig.label}</Text>
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

      {workLog.notes && (
        <View className="mt-3 pt-3 border-t border-gray-100 dark:border-surface-overlay">
          <Text className="text-xs text-gray-500 dark:text-gray-400" numberOfLines={2}>
            📝 {workLog.notes}
          </Text>
        </View>
      )}
    </Pressable>
  );
});

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
    const renderItem = useCallback(
      ({ item }: { item: WorkLog }) => (
        <WorkLogItem workLog={item} onPress={() => onItemPress?.(item)} />
      ),
      [onItemPress]
    );

    const keyExtractor = useCallback((item: WorkLog) => item.id, []);

    const handleEndReached = useCallback(() => {
      if (!isFetchingMore && hasMore && onLoadMore) {
        onLoadMore();
      }
    }, [hasMore, isFetchingMore, onLoadMore]);

    const renderFooter = useCallback(() => {
      if (!isFetchingMore) {
        return null;
      }

      return (
        <View className="py-4 items-center">
          <ActivityIndicator size="small" color="#6366f1" />
        </View>
      );
    }, [isFetchingMore]);

    const stats = useMemo(() => {
      const completed = workLogs.filter(
        (log) =>
          log.status === STATUS.WORK_LOG.COMPLETED || log.status === STATUS.WORK_LOG.CHECKED_OUT
      ).length;
      const totalEarnings = workLogs.reduce((sum, log) => sum + (log.payrollAmount || 0), 0);

      return { completed, totalEarnings };
    }, [workLogs]);

    if (isLoading && workLogs.length === 0) {
      return (
        <View className="flex-1 px-4 pt-4">
          {ListHeaderComponent}
          {[1, 2, 3, 4].map((item) => (
            <WorkLogSkeleton key={item} />
          ))}
        </View>
      );
    }

    if (!isLoading && workLogs.length === 0) {
      return (
        <View className="flex-1 px-4 pt-4">
          {ListHeaderComponent}
          <EmptyState title="근무 기록 없음" description={emptyMessage} icon="📋" />
        </View>
      );
    }

    return (
      <FlashList
        data={workLogs}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        // @ts-expect-error - estimatedItemSize is required in FlashList 2.x but types may be missing
        estimatedItemSize={180}
        contentContainerStyle={{ padding: 16 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#6366f1" />
          ) : undefined
        }
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={
          <>
            {ListHeaderComponent}
            {workLogs.length > 0 && (
              <View className="bg-primary-50 dark:bg-primary-900/20 rounded-xl p-4 mb-4">
                <View className="flex-row justify-around">
                  <View className="items-center">
                    <Text className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                      {stats.completed}
                    </Text>
                    <Text className="text-xs text-gray-500 dark:text-gray-400 mt-1">완료 건수</Text>
                  </View>
                  <View className="w-px bg-primary-200 dark:bg-primary-700" />
                  <View className="items-center">
                    <Text className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                      {formatCurrency(stats.totalEarnings)}
                    </Text>
                    <Text className="text-xs text-gray-500 dark:text-gray-400 mt-1">총 수입</Text>
                  </View>
                </View>
              </View>
            )}
          </>
        }
        ListFooterComponent={renderFooter}
        ListEmptyComponent={
          <EmptyState title="근무 기록 없음" description={emptyMessage} icon="📋" />
        }
      />
    );
  }
);

WorkLogList.displayName = 'WorkLogList';

export default WorkLogList;
