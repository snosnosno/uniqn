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
import { summarizeMissingCheckouts } from '@/domains/staff';
import { useActiveWorkspace, useEnsureDefaultWorkspace } from '@/hooks/workspace';
import {
  useGridSummary,
  useVenueContainers,
  useEnsureDefaultVenue,
  useVenueSettlement,
} from '@/hooks/workSchedule';
import {
  computeDayCell,
  resolveSelectedDateForMonth,
  type GridDayCell,
} from '@/domains/workSchedule';
import { toDateString } from '@/utils/date';
import { SECONDARY_PALETTE } from '@/constants/colors';
import { useAuthStore } from '@/stores/authStore';

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
  const { user } = useAuthStore();
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);
  const [visibleMonth, setVisibleMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [createSheetVisible, setCreateSheetVisible] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const selectedContainer = useMemo(
    () => containers.find((c) => c.id === selectedVenueId) ?? null,
    [containers, selectedVenueId]
  );

  // P1-1: 운영처 0개면 기본 운영처 자동 생성(체감 2계층).
  // 실패 시 재발사 없음(훅 내부 가드) → 아래 수동 EmptyState 폴백.
  // 이름은 워크스페이스명 복사가 아니라 `{닉네임}의 지점` — 팀과 지점이 같은 이름이 되던 문제(S1).
  const { isCreating: isAutoCreatingVenue } = useEnsureDefaultVenue({
    workspaceId: activeWorkspace?.id,
    displayName: user?.displayName,
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

  // 퇴근 미기록 안전망 — 자동 퇴근을 만들지 않기로 했으므로 이 배너가 구인자에게 알리는
  // 유일한 경로다(정산 게이트에 영영 도달하지 못하는 근무를 여기서만 발견할 수 있다).
  //
  // 🔑 **지점 스팬** 리더를 쓴다. 컨테이너 직속 배치만 보는 리더(useConfirmedStaff)를 쓰면
  // 지점에서 공고로 뽑은 스태프의 미기록이 통째로 빠져 안전망이 조용히 절반만 본다.
  // 정산 화면과 같은 쿼리 키라 그 화면을 오간 뒤에는 캐시를 공유한다.
  const missingCheckoutQuery = useVenueSettlement(selectedVenueId, format(visibleMonth, 'yyyy-MM'));
  // `now` 를 넘기는 이유: 리더가 붙이는 파생 플래그는 조회 시점 스냅샷이라 야간 교차 근무를
  // 구분하지 못하고, 화면을 열어둔 채 자정을 넘기면 낡는다. 집계가 직접 판정한다.
  // (유예 시각 경계는 다음 refetch·재렌더에서 반영된다 — 분 단위 타이머를 둘 만한 값이 아니다)
  const missingCheckouts = useMemo(
    () => summarizeMissingCheckouts(missingCheckoutQuery.data ?? [], new Date()),
    [missingCheckoutQuery.data]
  );

  // 배지를 누르면 가장 오래된 미기록 날짜로 이동한다. 지난 달일 수 있으므로 달도 함께 옮긴다
  // — 날짜만 바꾸면 월 동기화 useEffect 가 그 날짜를 현재 달 안으로 도로 끌어와 무반응이 된다.
  const handleGoToMissingCheckout = useCallback(() => {
    if (!missingCheckouts.earliestDate) return;
    const [year, month, day] = missingCheckouts.earliestDate.split('-').map(Number);
    if (!year || !month || !day) return;
    setVisibleMonth(startOfMonth(new Date(year, month - 1, day)));
    setSelectedDate(new Date(year, month - 1, day));
  }, [missingCheckouts.earliestDate]);

  const handlePrevMonth = useCallback(() => setVisibleMonth((m) => subMonths(m, 1)), []);
  const handleNextMonth = useCallback(() => setVisibleMonth((m) => addMonths(m, 1)), []);
  const handleDateSelect = useCallback((date: Date) => setSelectedDate(date), []);

  // 월이 바뀌면 선택 날짜도 그 달 안으로 끌어온다.
  // 이게 없으면 캘린더는 새 달을 그리는데 하단 패널은 이전 달 날짜를 계속 붙들어, 같은 화면이
  // 한 날짜에 대해 두 값을 동시에 말하고(요약 칩 vs 카드), 그 상태로 목표 인원을 저장하면
  // 화면에 보이지도 않는 이전 달 날짜에 저장된다.
  useEffect(() => {
    setSelectedDate((cur) => resolveSelectedDateForMonth(cur, visibleMonth, new Date()));
  }, [visibleMonth]);

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

      {/* 퇴근 미기록 안전망 — 지난 날짜에 퇴근이 안 찍힌 근무는 정산 게이트에 영영 도달하지
          못한다. 자동 퇴근을 만들지 않기로 했으므로 이 배너가 그 사실을 알리는 유일한 경로다.
          누르면 가장 오래된 미기록 날짜로 이동해 바로 고칠 수 있게 한다. */}
      {hasVenue && missingCheckouts.count > 0 ? (
        <Pressable
          onPress={handleGoToMissingCheckout}
          accessibilityRole="button"
          accessibilityLabel={`퇴근 미기록 ${missingCheckouts.count}건. 눌러서 가장 오래된 날짜로 이동`}
          testID="missing-checkout-banner"
          className="mx-4 mt-2 min-h-[44px] flex-row items-center justify-between rounded-lg bg-warning-50 px-3 py-2 dark:bg-warning-900/20"
        >
          <Text className="flex-1 font-sans-medium text-sm text-warning-700 dark:text-warning-300">
            퇴근 미기록 {missingCheckouts.count}건
          </Text>
          <Text className="ml-2 font-sans text-xs text-warning-700 dark:text-warning-300">
            확인
          </Text>
          <ChevronRightIcon size={16} color={SECONDARY_PALETTE[400]} />
        </Pressable>
      ) : null}

      {/* U4: 운영처 0 상태 — 워크스페이스/운영처 준비 단계를 명확히 구분한다.
          운영처(venue)는 워크스페이스에 속하므로 activeWorkspace 부재 시 "운영처 만들기"는 데드엔드
          (workspaceId undefined → 생성 버튼 영구 비활성)다. 따라서 아래 순서로 분기:
          로딩(자동 워크스페이스/운영처 생성·재조회 포함) → 워크스페이스 로드실패(재조회) →
          워크스페이스 준비실패(재생성) → **지점 조회실패(재조회)** → 운영처 없음(생성) →
          (자기-치유 대기)로딩.
          지점 조회실패를 "지점이 없어요"로 흘리면 사용자가 시키는 대로 지점을 새로 만들고,
          이름이 한 글자만 달라도 진짜 중복 지점이 생긴다(현재 지점 삭제 수단이 없어 영구 잔존).
          "없다"와 "못 읽었다"는 다른 사실이므로 반드시 분리한다. */}
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
          ) : containersQuery.isError ? (
            <EmptyState
              icon={<MapPinIcon size={48} color={SECONDARY_PALETTE[400]} />}
              title="지점을 불러오지 못했어요"
              description="네트워크 상태를 확인하고 다시 시도해주세요. 지점이 없는 게 아니라 목록을 읽지 못한 상태예요."
              actionLabel="다시 시도"
              onAction={containersQuery.refetch}
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
