/**
 * WeeklyStaffWidget
 * 이번 주 (월~일) 요일별 확정 스태프 현황 위젯
 */
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useQueries } from '@tanstack/react-query';
import { DashboardWidgetShell } from '@/components/home/DashboardWidgetShell';
import { NumericText } from '@/components/ui';
import { useMyJobPostings } from '@/hooks/useJobManagement';
import { getConfirmedStaff } from '@/services';
import { cachingPolicies, queryKeys } from '@/lib/queryClient';
import { toDateString } from '@/utils/date';
import type { JobPosting } from '@/types/jobPosting';
import type { ConfirmedStaff } from '@/types/confirmedStaff';

type DayKey = '월' | '화' | '수' | '목' | '금' | '토' | '일';

interface DaySlot {
  confirmed: number;
  capacity: number;
}

type WeeklySummary = Record<DayKey, DaySlot>;

const DAY_KEYS: DayKey[] = ['월', '화', '수', '목', '금', '토', '일'];

const EMPTY_WEEK_SUMMARY: WeeklySummary = DAY_KEYS.reduce(
  (acc, day) => ({ ...acc, [day]: { confirmed: 0, capacity: 0 } }),
  {} as WeeklySummary
);

function getWeekDates(): Record<DayKey, string> {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

  return DAY_KEYS.reduce(
    (acc, day, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return { ...acc, [day]: toDateString(d) };
    },
    {} as Record<DayKey, string>
  );
}

function buildWeeklySummary(
  postings: JobPosting[],
  staffByPosting: Record<string, ConfirmedStaff[]>
): WeeklySummary {
  const weekDates = getWeekDates();
  const summary: WeeklySummary = { ...EMPTY_WEEK_SUMMARY };

  DAY_KEYS.forEach((day) => {
    const date = weekDates[day];
    let totalConfirmed = 0;
    let totalCapacity = 0;

    postings.forEach((posting) => {
      const isOnDate = posting.workDate === date || (posting.workDates ?? []).includes(date);

      if (!isOnDate) return;

      totalCapacity += posting.totalPositions ?? 0;

      const staff = staffByPosting[posting.id] ?? [];
      const confirmedOnDate = staff.filter((s) => s.date === date).length;
      totalConfirmed += confirmedOnDate;
    });

    summary[day] = { confirmed: totalConfirmed, capacity: totalCapacity };
  });

  return summary;
}

export function WeeklyStaffWidget() {
  const { data, isLoading, error, refetch } = useMyJobPostings();

  const activePostings = React.useMemo(
    () =>
      (data ?? [])
        .filter(
          (p) => p.status === 'active' || p.status === 'approved' || p.status === 'capacity_full'
        )
        .slice(0, 3),
    [data]
  );

  const staffQueries = useQueries({
    queries: activePostings.map((posting) => ({
      queryKey: queryKeys.confirmedStaff.byJobPosting(posting.id),
      queryFn: () => getConfirmedStaff(posting.id),
      staleTime: cachingPolicies.frequent,
      enabled: !!posting.id,
    })),
  });

  const staffByPosting: Record<string, ConfirmedStaff[]> = {};
  activePostings.forEach((posting, idx) => {
    staffByPosting[posting.id] = staffQueries[idx]?.data?.staff ?? [];
  });
  const weeklySummary = buildWeeklySummary(activePostings, staffByPosting);

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

export default WeeklyStaffWidget;
