import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { DashboardWidgetShell } from '@/components/home/DashboardWidgetShell';
import { NumericText } from '@/components/ui';
import { useScheduleStats } from '@/hooks/useSchedules';
import { usePendingReviews } from '@/hooks/useReviews';
// `@/utils/formatters` 는 flat 파일(src/utils/formatters.ts)로 resolve 되어
// 레거시 settlement 포맷("N원")을 돌려주므로, canonical 배럴의 currency 서브패스를
// 직접 참조해 "₩N" 포맷(impeccable v2 §19)을 보장한다.
import { formatCurrency } from '@/utils/formatters/currency';

export function MonthSummaryWidget() {
  const scheduleStats = useScheduleStats();
  const pendingReviews = usePendingReviews();

  const isPendingPartial = pendingReviews.isLoading;
  const pendingLabel = isPendingPartial ? '—' : `${pendingReviews.pendingCount}건`;

  const confirmedSchedules = scheduleStats.stats?.confirmedSchedules ?? 0;
  const thisMonthEarnings = scheduleStats.stats?.thisMonthEarnings ?? 0;
  const hoursWorked = scheduleStats.stats?.hoursWorked ?? 0;

  const hasStats = scheduleStats.stats !== null && scheduleStats.stats !== undefined;
  const accessibilityLabel = hasStats
    ? `이번 달 요약, 예상 수령액 ${thisMonthEarnings}원, 확정 근무 ${confirmedSchedules}일, 근무 시간 ${hoursWorked}시간, 미작성 리뷰 ${isPendingPartial ? '로딩 중' : pendingReviews.pendingCount}건`
    : '이번 달 요약';

  return (
    <DashboardWidgetShell
      variant="section"
      title="이번 달 요약"
      isLoading={scheduleStats.isLoading}
      error={scheduleStats.error}
      onRetry={scheduleStats.refetch}
      partial={isPendingPartial}
      emptyState={!hasStats ? { message: '이번 달 근무 기록이 없습니다' } : undefined}
      action={
        <Pressable
          onPress={() => router.push('/(app)/(tabs)/schedule')}
          accessibilityRole="button"
          accessibilityLabel="이번 달 요약 상세 보기"
          hitSlop={8}
        >
          <Text className="text-primary-500 text-micro font-sans-bold">상세 →</Text>
        </Pressable>
      }
    >
      {hasStats ? (
        <View accessibilityLabel={accessibilityLabel}>
          <View className="flex-row justify-between items-end">
            <View>
              <NumericText
                className="text-3xl font-sans-bold text-primary-500"
                style={{ letterSpacing: -0.6 }}
              >
                {formatCurrency(thisMonthEarnings)}
              </NumericText>
              <Text className="text-micro uppercase tracking-wider text-content-muted mt-1">
                예상 수령액
              </Text>
            </View>
            <View className="items-end">
              <NumericText className="text-base font-sans-bold text-content-primary">
                {confirmedSchedules}일
              </NumericText>
              <NumericText className="text-xs text-content-secondary">
                {hoursWorked}시간 · 리뷰 {pendingLabel}
              </NumericText>
            </View>
          </View>
        </View>
      ) : undefined}
    </DashboardWidgetShell>
  );
}
