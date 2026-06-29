/**
 * UNIQN Mobile — 주간 배치 그리드 화면 (운영처 월 캘린더 오버뷰, unit 7)
 *
 * 설계: docs/planning/2026-06-28-weekly-batch-grid-design.md §9.6
 *
 * 홈 = 월 캘린더 오버뷰 → 날짜 탭 → 그 날 배치 상세. 상단에 운영처(workspace+venue) 선택기.
 * 전부 weekly_grid_enabled 플래그 뒤 — OFF면 진입 차단(Redirect). 기존 캘린더 무회귀.
 *
 * U4 빈/경계: 운영처 0·그날 0명·로딩·에러 처리.
 * 월/대형은 CalendarGrid(고정 6주 그리드, 가상화 불필요), 일별 상세는 ConfirmedStaffList(소형).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect } from 'expo-router';
import {
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
} from 'date-fns';
import { ko } from 'date-fns/locale/ko';
import { StackHeader } from '@/components/headers';
import { Loading, EmptyState, ErrorState } from '@/components/ui';
import { ChevronLeftIcon, ChevronRightIcon, MapPinIcon } from '@/components/icons';
import { CalendarGrid } from '@/components/jobs/DateCalendar/CalendarGrid';
import { VenueSelector, VenueDayDetail } from '@/components/weeklyGrid';
import { useWeeklyGridEnabled } from '@/hooks';
import { useActiveWorkspace } from '@/hooks/workspace';
import { useGridSummary, useVenueContainers } from '@/hooks/weeklyGrid';
import { computeDayCell, type GridDayCell } from '@/domains/weeklyGrid';
import { toDateString } from '@/utils/date';
import { SECONDARY_PALETTE } from '@/constants/colors';

const EMPTY_COUNTS: Record<string, number> = {};

/**
 * 월내 모든 날짜에 gridCell 을 채워(densify) 운영 도구처럼 빈 날도 탭 가능하게 한다.
 * 요약에 있는 날은 실셀, 없는 날은 empty 셀(부족/공고/배치 없음). 불변성: 새 Record 생성.
 */
function densifyMonthCells(
  summary: Record<string, GridDayCell>,
  monthDate: Date
): Record<string, GridDayCell> {
  const days = eachDayOfInterval({
    start: startOfMonth(monthDate),
    end: endOfMonth(monthDate),
  });
  const cells: Record<string, GridDayCell> = {};
  for (const day of days) {
    const key = toDateString(day);
    cells[key] =
      summary[key] ?? computeDayCell({ dateKey: key, headcount: 0, jobCount: 0, softTarget: 0 });
  }
  return cells;
}

export default function WeeklyGridScreen() {
  const { enabled, isLoading: flagLoading } = useWeeklyGridEnabled();

  const {
    workspaces,
    activeWorkspace,
    setActiveWorkspaceId,
    isLoading: wsLoading,
  } = useActiveWorkspace();

  // 플래그 OFF면 아래에서 Redirect 하지만 그 전에 훅이 1회 평가되므로,
  // 플래그 값을 enabled 로 넘겨 OFF 시 그리드 RPC 자체를 발사하지 않는다.
  const containersQuery = useVenueContainers(activeWorkspace?.id, { enabled });
  const containers = useMemo(() => containersQuery.data ?? [], [containersQuery.data]);

  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);
  const [visibleMonth, setVisibleMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());

  // 컨테이너 로드/변경 시 선택 venue 자기-치유: 없거나 목록에 없으면 첫 번째로.
  useEffect(() => {
    if (containers.length === 0) {
      if (selectedVenueId !== null) setSelectedVenueId(null);
      return;
    }
    const stillValid = selectedVenueId && containers.some((c) => c.id === selectedVenueId);
    if (!stillValid) setSelectedVenueId(containers[0]!.id);
  }, [containers, selectedVenueId]);

  const summaryQuery = useGridSummary(selectedVenueId, visibleMonth, { enabled });
  const gridCells = useMemo(
    () => densifyMonthCells(summaryQuery.data ?? {}, visibleMonth),
    [summaryQuery.data, visibleMonth]
  );

  const handlePrevMonth = useCallback(() => setVisibleMonth((m) => subMonths(m, 1)), []);
  const handleNextMonth = useCallback(() => setVisibleMonth((m) => addMonths(m, 1)), []);
  const handleDateSelect = useCallback((date: Date) => setSelectedDate(date), []);

  // 플래그 로딩 중 — 전체 화면 로딩.
  if (flagLoading) {
    return <Loading variant="layout" />;
  }

  // 플래그 OFF — 진입 차단(불변식: OFF면 미노출).
  if (!enabled) {
    return <Redirect href="/(employer)/workspace" />;
  }

  const monthLabel = format(visibleMonth, 'yyyy년 M월', { locale: ko });
  const selectedDateString = toDateString(selectedDate);
  const selectedDateLabel = format(selectedDate, 'M월 d일 (E)', { locale: ko });
  const hasVenue = !!selectedVenueId;

  return (
    <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top']}>
      <StackHeader title="주간 배치 그리드" fallbackHref="/(employer)/workspace" />

      {/* 운영처 선택기(unit 5) */}
      <VenueSelector
        workspaces={workspaces}
        activeWorkspaceId={activeWorkspace?.id}
        onSelectWorkspace={setActiveWorkspaceId}
        containers={containers}
        selectedVenueId={selectedVenueId}
        onSelectVenue={setSelectedVenueId}
        isLoadingContainers={wsLoading || containersQuery.isLoading}
      />

      {/* U4: 운영처 0 — 컨테이너 쿼리가 로딩을 마쳤고(not loading) 컨테이너가 0개일 때만 빈상태.
          컨테이너는 로드됐으나 selectedVenueId 자기-치유 effect 가 아직 실행 전(1프레임)인 상태는
          빈상태 오표시를 막기 위해 로딩으로 처리. */}
      {!hasVenue ? (
        <View className="flex-1 items-center justify-center px-6">
          {!(wsLoading || containersQuery.isLoading) && containers.length === 0 ? (
            <EmptyState
              icon={<MapPinIcon size={48} color={SECONDARY_PALETTE[400]} />}
              title="운영처가 없어요"
              description="이 워크스페이스에 운영처(상시 배치 장소)를 먼저 만들어주세요."
            />
          ) : (
            <Loading />
          )}
        </View>
      ) : (
        <View className="flex-1">
          {/* 월 네비게이션 */}
          <View className="flex-row items-center justify-between border-b border-divider px-4 py-2">
            <Pressable
              onPress={handlePrevMonth}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="이전 달"
              className="min-h-[40px] min-w-[40px] items-center justify-center rounded-md"
            >
              <ChevronLeftIcon size={22} color={SECONDARY_PALETTE[500]} />
            </Pressable>
            <Text className="text-base font-sans-semibold text-content-primary">{monthLabel}</Text>
            <Pressable
              onPress={handleNextMonth}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="다음 달"
              className="min-h-[40px] min-w-[40px] items-center justify-center rounded-md"
            >
              <ChevronRightIcon size={22} color={SECONDARY_PALETTE[500]} />
            </Pressable>
          </View>

          {/* 월 그리드 — U1/U2/U3 는 CalendarCell 그리드 모드가 처리(gridCells) */}
          <View className="px-2 pt-1">
            <CalendarGrid
              visibleMonth={visibleMonth}
              selectedDate={selectedDate}
              counts={EMPTY_COUNTS}
              onDateSelect={handleDateSelect}
              isLoading={summaryQuery.isLoading}
              gridCells={gridCells}
            />
          </View>

          {/* U4: 요약 에러 — 그리드 하단 인라인 + 재시도 */}
          {summaryQuery.isError ? (
            <View className="px-4 py-2">
              <ErrorState
                compact
                title="그리드를 불러오지 못했어요"
                error={summaryQuery.error as Error}
                onRetry={summaryQuery.refetch}
              />
            </View>
          ) : null}

          {/* 선택 날짜 상세(unit 6) */}
          <View className="mt-1 flex-1 border-t border-divider">
            <View className="px-4 py-2">
              <Text className="text-sm font-sans-semibold text-content-primary">
                {selectedDateLabel} 배치
              </Text>
            </View>
            <View className="flex-1">
              <VenueDayDetail venueId={selectedVenueId} date={selectedDateString} />
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}
