/**
 * UNIQN Mobile — 근무표 화면 (운영처 월 캘린더 오버뷰, unit 7)
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
import { View, Text, Pressable, RefreshControl, ScrollView } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useRouter } from 'expo-router';
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
import {
  VenueSelector,
  VenueDayPanel,
  VenueCreateSheet,
  VenueSettingsSheet,
  GridBadgeLegend,
} from '@/components/workSchedule';
import { useWorkScheduleEnabled } from '@/hooks';
import { useActiveWorkspace, useEnsureDefaultWorkspace } from '@/hooks/workspace';
import { useGridSummary, useVenueContainers, useEnsureDefaultVenue } from '@/hooks/workSchedule';
import { computeDayCell, type GridDayCell } from '@/domains/workSchedule';
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

export default function WorkScheduleScreen() {
  const { enabled, isLoading: flagLoading } = useWorkScheduleEnabled();

  const {
    workspaces,
    activeWorkspace,
    setActiveWorkspaceId,
    isLoading: wsLoading,
    isFetching: wsFetching,
    isError: wsError,
    refetch: refetchWorkspaces,
  } = useActiveWorkspace();

  // 신규 employer(워크스페이스 0개) 안전망 — 공고 경로(getDefaultWorkspaceIdForOwner)와 동일.
  // 조회가 성공적으로 끝났고(로딩/에러 아님) 0개일 때만 기본 워크스페이스 1회 자동 생성.
  // 이게 없으면 workspaceId undefined → "운영처 만들기" 버튼이 영구 비활성인 데드엔드가 된다.
  const { isCreating: isCreatingWorkspace, retry: retryCreateWorkspace } =
    useEnsureDefaultWorkspace({
      isReady: enabled && !wsLoading && !wsError,
      isEmpty: workspaces.length === 0,
    });

  // 플래그 OFF면 아래에서 Redirect 하지만 그 전에 훅이 1회 평가되므로,
  // 플래그 값을 enabled 로 넘겨 OFF 시 그리드 RPC 자체를 발사하지 않는다.
  const containersQuery = useVenueContainers(activeWorkspace?.id, { enabled });
  const containers = useMemo(() => containersQuery.data ?? [], [containersQuery.data]);

  const router = useRouter();
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);
  const [visibleMonth, setVisibleMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [createSheetVisible, setCreateSheetVisible] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const selectedContainer = useMemo(
    () => containers.find((c) => c.id === selectedVenueId) ?? null,
    [containers, selectedVenueId]
  );

  // P1-1: 운영처 0개면 워크스페이스 이름으로 기본 운영처 자동 생성(체감 2계층).
  // 실패 시 재발사 없음(훅 내부 가드) → 아래 수동 EmptyState 폴백.
  const { isCreating: isAutoCreatingVenue } = useEnsureDefaultVenue({
    workspaceId: activeWorkspace?.id,
    workspaceName: activeWorkspace?.name,
    isReady: enabled && !wsLoading && containersQuery.isSuccess,
    isEmpty: containers.length === 0,
  });

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

  // 당겨서 새로고침 — 단일 ScrollView 전환(P1-3)으로 리스트 RefreshControl 이 사라진 것을 화면
  // 레벨에서 복원. 타 운영자의 배치 변경(비-realtime)을 수동 갱신하는 유일한 경로.
  const queryClient = useQueryClient();
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
  const handleManualRefresh = useCallback(async () => {
    setIsManualRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: queryKeys.workSchedule.all });
    } finally {
      setIsManualRefreshing(false);
    }
  }, [queryClient]);

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
      <StackHeader
        title="근무표"
        fallbackHref="/(employer)/workspace"
        rightAction={
          hasVenue ? (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/(employer)/venue-settlements',
                  params: {
                    venueId: selectedVenueId as string,
                    month: format(visibleMonth, 'yyyy-MM'),
                  },
                })
              }
              accessibilityRole="button"
              accessibilityLabel="지점 정산 보기"
              hitSlop={10}
              className="min-h-[44px] justify-center px-2"
            >
              <Text className="text-base font-sans-medium text-primary-500">정산</Text>
            </Pressable>
          ) : undefined
        }
      />

      {/* 운영처 선택기(unit 5) */}
      <VenueSelector
        workspaces={workspaces}
        activeWorkspaceId={activeWorkspace?.id}
        onSelectWorkspace={setActiveWorkspaceId}
        containers={containers}
        selectedVenueId={selectedVenueId}
        onSelectVenue={setSelectedVenueId}
        isLoadingContainers={wsLoading || containersQuery.isLoading}
        onAddVenue={() => setCreateSheetVisible(true)}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      {/* U4: 운영처 0 상태 — 워크스페이스/운영처 준비 단계를 명확히 구분한다.
          운영처(venue)는 워크스페이스에 속하므로 activeWorkspace 부재 시 "운영처 만들기"는 데드엔드
          (workspaceId undefined → 생성 버튼 영구 비활성)다. 따라서 아래 순서로 분기:
          로딩(자동 워크스페이스/운영처 생성·재조회 포함) → 워크스페이스 로드실패(재조회) →
          워크스페이스 준비실패(재생성) → 운영처 없음(생성) → (자기-치유 대기)로딩. */}
      {!hasVenue ? (
        <View className="flex-1 items-center justify-center px-6">
          {wsLoading ||
          wsFetching ||
          containersQuery.isLoading ||
          isAutoCreatingVenue ||
          isCreatingWorkspace ? (
            <Loading />
          ) : wsError ? (
            <EmptyState
              icon={<MapPinIcon size={48} color={SECONDARY_PALETTE[400]} />}
              title="팀을 불러오지 못했어요"
              description="네트워크 상태를 확인하고 다시 시도해주세요."
              actionLabel="다시 시도"
              onAction={refetchWorkspaces}
            />
          ) : !activeWorkspace ? (
            <EmptyState
              icon={<MapPinIcon size={48} color={SECONDARY_PALETTE[400]} />}
              title="팀을 준비하지 못했어요"
              description="잠시 후 다시 시도해주세요."
              actionLabel="다시 시도"
              onAction={retryCreateWorkspace}
            />
          ) : containers.length === 0 ? (
            <EmptyState
              icon={<MapPinIcon size={48} color={SECONDARY_PALETTE[400]} />}
              title="지점이 없어요"
              description="이 팀에 지점(상시 근무 장소)을 먼저 만들어주세요."
              actionLabel="지점 만들기"
              onAction={() => setCreateSheetVisible(true)}
            />
          ) : (
            <Loading />
          )}
        </View>
      ) : (
        // P1-3: 단일 세로 스크롤러 — 내부에 가상화 리스트 없음(VenueDayDetail 직접 렌더 전제).
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          refreshControl={
            <RefreshControl
              refreshing={isManualRefreshing}
              onRefresh={handleManualRefresh}
              tintColor="#D4AF37"
              colors={['#D4AF37']}
            />
          }
        >
          {/* 월 네비게이션 */}
          <View className="flex-row items-center justify-between border-b border-divider px-4 py-1">
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

          {/* P0-3: 셀 뱃지 범례(!부족/+공고/✓배치) — GRID_BADGE_META SSOT 공유 */}
          <GridBadgeLegend />

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

          {/* 선택 날짜 패널(요약·소프트타깃·추가·편집 통합) — 자연 높이(스크롤은 이 ScrollView 담당) */}
          <View className="mt-1 border-t border-divider">
            <VenueDayPanel
              venueId={selectedVenueId}
              date={selectedDateString}
              dateLabel={selectedDateLabel}
              cell={gridCells[selectedDateString]}
            />
          </View>
        </ScrollView>
      )}
      <VenueCreateSheet
        visible={createSheetVisible}
        workspaceId={activeWorkspace?.id}
        onClose={() => setCreateSheetVisible(false)}
        onCreated={(container) => {
          setSelectedVenueId(container.id);
          setCreateSheetVisible(false);
        }}
      />
      <VenueSettingsSheet
        visible={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        container={selectedContainer}
      />
    </SafeAreaView>
  );
}
