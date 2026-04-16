/**
 * WeeklyStaffWidget
 * 이번 주 (월~일) 요일별 확정 스태프 현황 위젯
 */
import React from 'react';
import { View, Text } from 'react-native';
import { router } from 'expo-router';
import { DashboardWidgetShell } from '@/components/home/DashboardWidgetShell';
import { useMyJobPostings } from '@/hooks/useJobManagement';
import { useConfirmedStaff } from '@/hooks/useConfirmedStaff';
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
      return { ...acc, [day]: d.toISOString().split('T')[0] };
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

interface PostingStaffLoaderProps {
  posting: JobPosting;
  onStaff: (postingId: string, staff: ConfirmedStaff[]) => void;
}

function PostingStaffLoader({ posting, onStaff }: PostingStaffLoaderProps) {
  const { staff } = useConfirmedStaff(posting.id);

  React.useEffect(() => {
    onStaff(posting.id, staff);
  }, [staff, posting.id, onStaff]);

  return null;
}

export function WeeklyStaffWidget() {
  const { data, isLoading, error } = useMyJobPostings();
  const [staffByPosting, setStaffByPosting] = React.useState<Record<string, ConfirmedStaff[]>>({});

  const activePostings = React.useMemo(
    () => (data ?? []).filter((p) => p.status === 'active' || p.status === 'approved').slice(0, 3),
    [data]
  );

  const handleStaff = React.useCallback((postingId: string, staff: ConfirmedStaff[]) => {
    setStaffByPosting((prev) => ({ ...prev, [postingId]: staff }));
  }, []);

  const weeklySummary = React.useMemo(
    () => buildWeeklySummary(activePostings, staffByPosting),
    [activePostings, staffByPosting]
  );

  const hasAnyCapacity = DAY_KEYS.some((day) => weeklySummary[day].capacity > 0);

  return (
    <>
      {activePostings.map((posting) => (
        <PostingStaffLoader key={posting.id} posting={posting} onStaff={handleStaff} />
      ))}
      <DashboardWidgetShell
        title="이번 주 스태프"
        isLoading={isLoading}
        error={error instanceof Error ? error : null}
        onRetry={() => {}}
        onSeeMore={() => router.push('/(employer)/my-postings')}
        seeMoreLabel="전체 보기"
        emptyState={
          !isLoading && activePostings.length === 0
            ? { message: '이번 주 스케줄된 공고가 없습니다' }
            : undefined
        }
      >
        {!isLoading && activePostings.length > 0 ? (
          <View className="gap-1 py-1">
            {DAY_KEYS.filter((day) => weeklySummary[day].capacity > 0 || hasAnyCapacity).map(
              (day) => {
                const { confirmed, capacity } = weeklySummary[day];
                const ratio = capacity > 0 ? confirmed / capacity : 0;

                return (
                  <View key={day} className="flex-row items-center gap-2">
                    <Text className="w-4 text-xs text-neutral-400 dark:text-neutral-400">
                      {day}
                    </Text>
                    <View className="h-1 flex-1 overflow-hidden rounded-sm bg-neutral-700 dark:bg-neutral-700">
                      <View
                        className="h-full rounded-sm"
                        style={{
                          width: `${Math.round(ratio * 100)}%`,
                          backgroundColor: '#D4AF37',
                        }}
                      />
                    </View>
                    <Text className="w-8 text-right text-xs text-neutral-400 dark:text-neutral-400">
                      {confirmed}/{capacity}
                    </Text>
                  </View>
                );
              }
            )}
          </View>
        ) : undefined}
      </DashboardWidgetShell>
    </>
  );
}

export default WeeklyStaffWidget;
