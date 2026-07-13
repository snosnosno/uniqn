/**
 * WeeklyStaffWidget
 * 이번 주 (월~일) 요일별 확정 스태프 현황 위젯
 *
 * 확정 인원 데이터 소스: 활성 공고 전체 id로 usePostingFilledCounts(전역맵) 배치 1회 조회 후
 * date 세그먼트별 합산 — 공고별 getConfirmedStaff N+1 호출 + top-3 캡(과소집계) 제거.
 * 집계 순수 함수는 ./weeklyStaffSummary 로 분리(테스트 대상).
 */
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { DashboardWidgetShell } from '@/components/home/DashboardWidgetShell';
import { NumericText } from '@/components/ui';
import { useMyJobPostings } from '@/hooks/useJobManagement';
import { usePostingFilledCounts } from '@/hooks/usePostingFilledCounts';
import {
  DAY_KEYS,
  aggregateConfirmedByDate,
  buildWeeklySummary,
  getWeekDates,
} from './weeklyStaffSummary';

export function WeeklyStaffWidget() {
  const { data, isLoading, error, refetch } = useMyJobPostings();

  const activePostings = React.useMemo(
    () =>
      (data ?? []).filter(
        (p) => p.status === 'active' || p.status === 'approved' || p.status === 'capacity_full'
      ),
    [data]
  );

  const activeIds = React.useMemo(() => activePostings.map((p) => p.id), [activePostings]);
  const { data: filledCounts } = usePostingFilledCounts(activeIds);

  const weeklySummary = React.useMemo(() => {
    const weekDates = getWeekDates();
    const confirmedByDate = aggregateConfirmedByDate(filledCounts);
    return buildWeeklySummary(activePostings, weekDates, confirmedByDate);
  }, [activePostings, filledCounts]);

  return (
    <DashboardWidgetShell
      variant="section"
      title="이번 주 스태프"
      isLoading={isLoading}
      error={error instanceof Error ? error : null}
      onRetry={refetch}
      emptyState={
        !isLoading && activePostings.length === 0
          ? { message: '이번 주 스케줄된 공고가 없습니다' }
          : undefined
      }
      action={
        <Pressable
          onPress={() => router.push('/(app)/(tabs)/employer')}
          accessibilityRole="button"
          accessibilityLabel="이번 주 스태프 현황 전체 보기"
          hitSlop={8}
        >
          <Text className="text-primary-500 text-micro font-sans-bold">전체 →</Text>
        </Pressable>
      }
    >
      {!isLoading && activePostings.length > 0 ? (
        <View className="gap-1 py-1">
          {DAY_KEYS.filter((day) => weeklySummary[day].capacity > 0).map((day) => {
            const { confirmed, capacity } = weeklySummary[day];
            const ratio = capacity > 0 ? confirmed / capacity : 0;

            return (
              <View key={day} className="flex-row items-center gap-2">
                <Text className="w-4 text-xs text-content-muted">{day}</Text>
                <View className="h-1 flex-1 overflow-hidden rounded-sm bg-surface-overlay">
                  <View
                    className="h-full rounded-sm bg-primary-500"
                    style={{
                      width: `${Math.round(ratio * 100)}%`,
                    }}
                  />
                </View>
                <NumericText className="w-10 text-right text-xs text-content-secondary">
                  {confirmed}/{capacity}
                </NumericText>
              </View>
            );
          })}
        </View>
      ) : undefined}
    </DashboardWidgetShell>
  );
}
