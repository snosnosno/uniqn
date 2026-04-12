import React, { useCallback, useMemo } from 'react';
import { View, Text, RefreshControl, ActivityIndicator, Pressable } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Badge, Skeleton, EmptyState } from '@/components/ui';
import { useThemeStore } from '@/stores/themeStore';
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
  no_show: { label: '노쇼', variant: 'warning' },
};

const PAYROLL_STATUS_CONFIG: Record<
  PayrollStatus,
  { label: string; color: string; bgColor: string }
> = {
  pending: {
    label: '정산 대기',
    color: 'text-warning-700 dark:text-warning-300',
    bgColor: 'bg-warning-100 dark:bg-warning-900/30',
  },
  processing: {
    label: '정산 중',
    color: 'text-primary-700 dark:text-primary-300',
    bgColor: 'bg-primary-100 dark:bg-primary-900/30',
  },
  completed: {
    label: '정산 완료',
    color: 'text-success-700 dark:text-success-300',
    bgColor: 'bg-success-50 dark:bg-success-900/30',
  },
};

function formatDate(dateString: string): string {
  if (!dateString) {
    return '날짜 미정';
  }

  return formatDateShortWithDay(dateString) || dateString || '-';
}

function WorkLogSkeleton() {
  return (
    <View className="bg-white dark:bg-surface rounded-md p-4 mb-3 border border-secondary-100 dark:border-surface-overlay">
      <View className="flex-row items-center justify-between mb-3">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-5 w-16 rounded-sm" />
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
  const isDarkMode = useThemeStore((state) => state.isDarkMode);
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
      className="bg-white dark:bg-surface rounded-md p-4 mb-3 border border-secondary-100 dark:border-surface-overlay active:opacity-80"
      accessibilityRole="button"
      accessibilityLabel={`${formatDate(workLog.date)} ${roleLabel} 근무 기록`}
    >
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center">
          <CalendarIcon size={16} color="#9A9078" />
          <Text className="ml-2 text-sm font-sans-medium text-secondary-900 dark:text-off-white">
            {formatDate(workLog.date)}
          </Text>
        </View>
        <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
      </View>

      <View className="flex-row items-center gap-4 mb-3">
        <View className="flex-row items-center">
          <BriefcaseIcon size={14} color="#A89C84" />
          <Text className="ml-1 text-sm text-secondary-600 dark:text-secondary-400 font-sans">
            {roleLabel}
          </Text>
        </View>
        <View className="flex-row items-center">
          <ClockIcon size={14} color="#A89C84" />
          <Text className="ml-1 text-sm text-secondary-600 dark:text-secondary-400 font-sans">
            {timeInfo.effectiveStart} - {timeInfo.effectiveEnd}
          </Text>
        </View>
      </View>

      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center">
          {isCompleted ? (
            <CheckCircleIcon size={14} color="#22c55e" />
          ) : (
            <PendingIcon size={14} color="#A89C84" />
          )}
          <Text
            className={`ml-1 text-sm ${
              isCompleted
                ? 'text-success-600 dark:text-success-400'
                : 'text-secondary-500 dark:text-secondary-400'
            } font-sans`}
          >
            {isCompleted ? workHours : '진행 중'}
          </Text>
        </View>

        {workLog.payrollAmount && workLog.payrollAmount > 0 && (
          <View className="flex-row items-center">
            {payrollConfig && (
              <View className={`px-2 py-0.5 rounded-sm mr-2 ${payrollConfig.bgColor}`}>
                <Text className={`text-xs ${payrollConfig.color} font-sans`}>
                  {payrollConfig.label}
                </Text>
              </View>
            )}
            <View className="flex-row items-center">
              <CurrencyDollarIcon size={14} color={isDarkMode ? '#D4AF37' : '#8A7228'} />
              <Text className="ml-1 text-sm font-sans-semibold text-primary-600 dark:text-primary-400">
                {formatCurrency(workLog.payrollAmount)}
              </Text>
            </View>
          </View>
        )}
      </View>

      {workLog.notes && (
        <View className="mt-3 pt-3 border-t border-secondary-100 dark:border-surface-overlay">
          <Text
            className="text-xs text-secondary-500 dark:text-secondary-400 font-sans"
            numberOfLines={2}
          >
            {workLog.notes}
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
    const isDarkMode = useThemeStore((state) => state.isDarkMode);
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
          <ActivityIndicator size="small" color={isDarkMode ? '#D4AF37' : '#8A7228'} />
        </View>
      );
    }, [isDarkMode, isFetchingMore]);

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
          <EmptyState title="근무 기록 없음" description={emptyMessage} />
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
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor={isDarkMode ? '#D4AF37' : '#8A7228'}
            />
          ) : undefined
        }
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={
          <>
            {ListHeaderComponent}
            {workLogs.length > 0 && (
              <View className="bg-primary-50 dark:bg-primary-900/20 rounded-md p-4 mb-4">
                <View className="flex-row justify-around">
                  <View className="items-center">
                    <Text className="text-2xl font-display text-primary-600 dark:text-primary-400">
                      {stats.completed}
                    </Text>
                    <Text className="text-xs text-secondary-500 dark:text-secondary-400 mt-1 font-sans">
                      완료 건수
                    </Text>
                  </View>
                  <View className="w-px bg-primary-200 dark:bg-primary-700" />
                  <View className="items-center">
                    <Text className="text-2xl font-display text-primary-600 dark:text-primary-400">
                      {formatCurrency(stats.totalEarnings)}
                    </Text>
                    <Text className="text-xs text-secondary-500 dark:text-secondary-400 mt-1 font-sans">
                      총 수입
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </>
        }
        ListFooterComponent={renderFooter}
        ListEmptyComponent={<EmptyState title="근무 기록 없음" description={emptyMessage} />}
      />
    );
  }
);

WorkLogList.displayName = 'WorkLogList';

export default WorkLogList;
