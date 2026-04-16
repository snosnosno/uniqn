import React from 'react';
import { View, Text } from 'react-native';
import { router } from 'expo-router';
import { DashboardWidgetShell } from '@/components/home/DashboardWidgetShell';
import { useScheduleStats } from '@/hooks/useSchedules';
import { usePendingReviews } from '@/hooks/useReviews';

export function MonthSummaryWidget() {
  const scheduleStats = useScheduleStats();
  const pendingReviews = usePendingReviews();

  const isPendingPartial = pendingReviews.isLoading;
  const pendingLabel = isPendingPartial ? '—' : `${pendingReviews.pendingCount}건`;

  const confirmedSchedules = scheduleStats.stats?.confirmedSchedules ?? 0;
  const thisMonthEarnings = scheduleStats.stats?.thisMonthEarnings ?? 0;

  const hasStats = scheduleStats.stats !== null && scheduleStats.stats !== undefined;
  const accessibilityLabel = hasStats
    ? `이번 달 요약, 확정 근무 ${confirmedSchedules}일, 이번 달 수익 ${thisMonthEarnings}원, 미작성 리뷰 ${isPendingPartial ? '로딩 중' : pendingReviews.pendingCount}건`
    : '이번 달 요약';

  return (
    <DashboardWidgetShell
      title="이번 달 요약"
      isLoading={scheduleStats.isLoading}
      error={scheduleStats.error}
      onRetry={scheduleStats.refetch}
      partial={isPendingPartial}
      emptyState={!hasStats ? { message: '이번 달 근무 기록이 없습니다' } : undefined}
      onSeeMore={() => router.push('/(app)/(tabs)/schedule')}
      seeMoreLabel="일정 보기"
    >
      {hasStats ? (
        <View accessibilityLabel={accessibilityLabel}>
          <View className="flex-row justify-between items-center py-1">
            <Text className="text-sm text-foreground dark:text-foreground">확정 근무</Text>
            <Text className="text-sm font-medium text-foreground dark:text-foreground">
              {confirmedSchedules}일
            </Text>
          </View>
          <View className="flex-row justify-between items-center py-1">
            <Text className="text-sm text-foreground dark:text-foreground">이번 달 수익</Text>
            <Text className="text-sm font-semibold" style={{ color: '#D4AF37' }}>
              ₩{thisMonthEarnings.toLocaleString()}
            </Text>
          </View>
          <View className="flex-row justify-between items-center py-1">
            <Text className="text-sm text-foreground dark:text-foreground">미작성 리뷰</Text>
            <Text className="text-sm font-medium text-foreground dark:text-foreground">
              {pendingLabel}
            </Text>
          </View>
        </View>
      ) : undefined}
    </DashboardWidgetShell>
  );
}

export default MonthSummaryWidget;
