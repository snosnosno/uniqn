/**
 * UNIQN Mobile - Schedule Screen
 * 내 스케줄 화면
 */

import { useState, useCallback, useEffect, useMemo, useRef, Suspense, lazy } from 'react';
import { View, Text, ScrollView, RefreshControl, LayoutAnimation } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  EmptyState,
  ErrorState,
  FilterTabs,
  FocusablePressable,
  ScreenSkeleton,
  Skeleton,
} from '@/components/ui';
import type { FilterTabOption } from '@/components/ui';
import {
  ScheduleCard,
  ScheduleDetailModal,
  GroupedScheduleCard,
  NextShiftCard,
} from '@/components/schedule';
import { ScheduleDashboard } from '@/components/schedule/ScheduleDashboard';
import { CancellationRequestForm } from '@/components/applications';
import { ReportModal } from '@/components/employer/ReportModal';
import { useOwnerReport } from '@/components/schedule/useOwnerReport';
import { TabHeader } from '@/components/headers';
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon, MenuIcon } from '@/components/icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCalendarView, useApplications } from '@/hooks';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { getStorageItem, setStorageItem, STORAGE_KEYS } from '@/lib/mmkvStorage';
import { useTodaySchedules } from '@/hooks/useSchedules';
import { pickNextShift } from '@/components/schedule/helpers/nextShift';
import { useOpsHubEnabled } from '@/hooks/useOpsHubEnabled';
import { useTabBarBottomPadding } from '@/hooks/useTabBarBottomPadding';
import { useAuthStore } from '@/stores/authStore';
import { usePendingReviews } from '@/hooks/useReviews';
import ReviewPromptBanner from '@/components/review/ReviewPromptBanner';
import { useToastStore } from '@/stores/toastStore';
import { SECONDARY_PALETTE } from '@/constants/colors';
import { PTR_REFRESH_PROPS } from '@/constants/ptr';
import { STATUS } from '@/constants';
import { SHEET_DISMISS_ANIMATION_MS } from '@/constants/animation';
import { SCHEDULE_TYPE_LABELS } from '@/shared/status';
import { getApplicationById } from '@/services/jobs/applicationService';
import { logger } from '@/utils/logger';
import {
  advanceDeepLinkGate,
  buildApplicationDeepLinkKey,
  resolveApplicationDeepLink,
  resolveMissingApplicationDeepLink,
  DEEP_LINK_APPLICATION_NOT_FOUND_MESSAGE,
  type DeepLinkGate,
} from '@/utils/scheduleDeepLink';
import { triggerHaptic } from '@/utils/haptics';
import { getTodayString } from '@/utils/date';
import { detectScheduleOverlaps, formatOverlapWarning } from '@/utils/scheduleOverlap';
import { syncShiftReminders } from '@/services/work/shiftReminderScheduler';
import {
  filterSchedulesByStatus,
  countSchedulesByType,
  countUnpaidSchedules,
  splitSchedulesByToday,
  pickGroupFocusDate,
  formatSingleDate,
  type ScheduleStatusFilter,
} from '@/utils/scheduleGrouping';
import type { Application, ScheduleEvent, GroupedScheduleEvent } from '@/types';
import {
  buildSubstitutePostBody,
  buildSubstitutePostTitle,
} from '@/services/board/boardSubstituteService';
import type { BoardAuthorRole, BoardJobSummary } from '@/types/board';
import { isGroupedScheduleEvent } from '@/types/schedule';

// react-native-calendars(112KB) + moment(60KB) + lodash(73KB) — schedule 탭 calendar 모드 진입 시점에만 로드.
const CalendarView = lazy(() => import('@/components/schedule/CalendarViewLazyEntry'));

// ============================================================================
// Constants
// ============================================================================

// statusConfig, attendanceConfig는 ScheduleCard 컴포넌트로 이동됨

// ============================================================================
// Helper Functions
// ============================================================================

function formatMonthTitle(year: number, month: number): string {
  return `${year}년 ${month}월`;
}

/** 필터 라벨 — 'unpaid' 는 상태가 아니라 정산 관점 축이라 따로 이름을 준다. */
const STATUS_FILTER_LABELS: Record<ScheduleStatusFilter, string> = {
  all: '전체',
  applied: SCHEDULE_TYPE_LABELS.applied,
  confirmed: SCHEDULE_TYPE_LABELS.confirmed,
  completed: SCHEDULE_TYPE_LABELS.completed,
  cancelled: SCHEDULE_TYPE_LABELS.cancelled,
  no_show: SCHEDULE_TYPE_LABELS.no_show,
  unpaid: '미지급',
};

// ============================================================================
// Sub Components
// ============================================================================

interface MonthNavigatorProps {
  year: number;
  month: number;
  viewMode: 'list' | 'calendar';
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onToggleView: () => void;
}

function MonthNavigator({
  year,
  month,
  viewMode,
  onPrev,
  onNext,
  onToday,
  onToggleView,
}: MonthNavigatorProps) {
  return (
    <View className="flex-row items-center justify-between bg-surface-card px-4 py-3 border-b border-divider">
      <FocusablePressable
        onPress={onPrev}
        hitSlop={10}
        focusRingRadius={4}
        className="p-2 rounded-sm active:bg-secondary-100 dark:active:bg-secondary-700"
        accessibilityLabel="이전 달"
        accessibilityRole="button"
        testID="schedule-prev-month-button"
      >
        <ChevronLeftIcon size={24} color={SECONDARY_PALETTE[500]} />
      </FocusablePressable>

      <View className="flex-1 px-3">
        <Text
          testID="schedule-month-title"
          className="text-lg font-display-semibold text-content-primary dark:text-secondary-100"
        >
          {formatMonthTitle(year, month)}
        </Text>
      </View>

      <View className="flex-row items-center">
        <FocusablePressable
          onPress={onToday}
          hitSlop={8}
          focusRingRadius={4}
          className="rounded-sm px-3 py-1.5 active:bg-secondary-100 dark:active:bg-secondary-700 mr-1"
          accessibilityLabel="오늘로 이동"
          accessibilityRole="button"
          testID="schedule-today-button"
        >
          <Text className="text-sm font-sans-medium text-content-secondary dark:text-secondary-200">
            오늘
          </Text>
        </FocusablePressable>
        <FocusablePressable
          onPress={onToggleView}
          hitSlop={10}
          focusRingRadius={4}
          className="p-2 rounded-sm active:bg-secondary-100 dark:active:bg-secondary-700 mr-1"
          accessibilityLabel={viewMode === 'list' ? '캘린더 보기' : '목록 보기'}
          accessibilityRole="button"
          testID="schedule-view-toggle-button"
        >
          {viewMode === 'list' ? (
            <CalendarIcon size={20} color={SECONDARY_PALETTE[500]} />
          ) : (
            <MenuIcon size={20} color={SECONDARY_PALETTE[500]} />
          )}
        </FocusablePressable>
        <FocusablePressable
          onPress={onNext}
          hitSlop={10}
          focusRingRadius={4}
          className="p-2 rounded-sm active:bg-secondary-100 dark:active:bg-secondary-700"
          accessibilityLabel="다음 달"
          accessibilityRole="button"
          testID="schedule-next-month-button"
        >
          <ChevronRightIcon size={24} color={SECONDARY_PALETTE[500]} />
        </FocusablePressable>
      </View>
    </View>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function ScheduleScreen() {
  const addToast = useToastStore((state) => state.addToast);
  const { user, profile } = useAuthStore();

  // URL 파라미터 (알림 딥링크 — applicationId, cancelApplicationId)
  const searchParams = useLocalSearchParams<{
    applicationId?: string;
    cancelApplicationId?: string;
  }>();

  // 스태프 정산 튜토리얼

  // 뷰 모드 상태 (list | calendar) - 캘린더가 기본
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('calendar');

  // 스케줄 상세 시트 상태
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleEvent | null>(null);
  // 그룹 모달 지원을 위해 유지
  const [selectedGroupedSchedule, setSelectedGroupedSchedule] =
    useState<GroupedScheduleEvent | null>(null);
  const [isDetailSheetVisible, setIsDetailSheetVisible] = useState(false);

  // 취소 요청 바텀시트 상태 (confirmed 지원 취소)
  const [cancellationApp, setCancellationApp] = useState<Application | null>(null);

  // 미작성 평가 수
  const { pendingCount, pendingReviews } = usePendingReviews();

  // 지원 취소 훅
  const { cancelApplication, requestCancellation, isRequestingCancellation, isCancelling } =
    useApplications();

  // A1 진입 표면 ③: ops 허브 게이트(빈 상태 보조 크로스링크). OFF 면 보조 링크 미노출.
  const { enabled: opsHubEnabled } = useOpsHubEnabled();
  const bottomPadding = useTabBarBottomPadding();

  const {
    schedules,
    // groupedSchedules는 날짜별 그룹화, groupedByApplication은 지원별 그룹화
    groupedByApplication,
    selectedDateSchedules,
    stats,
    warning,
    currentMonth,
    selectedDate,
    isLoading,
    isRefreshing,
    error,
    refreshError,
    isOffline,
    setSelectedDate,
    goToPrevMonth,
    goToNextMonth,
    goToMonth,
    goToToday,
    refresh,
  } = useCalendarView({ enableGrouping: true, realtime: true });

  // 상태 필터 (리스트 뷰 전용, M1) — 'all'은 취소 포함 전체 노출
  const [statusFilter, setStatusFilter] = useState<ScheduleStatusFilter>('all');

  // 요약 대시보드 접힘 — 매번 초기화되면 접는 의미가 없어 기기에 남긴다.
  const [dashboardCollapsed, setDashboardCollapsed] = useState<boolean>(
    () => getStorageItem<boolean>(STORAGE_KEYS.SCHEDULE_DASHBOARD_COLLAPSED) ?? false
  );
  const reduceMotion = useReduceMotion();
  const handleToggleDashboard = useCallback(() => {
    // 접기/펼치기 높이 변화는 Accordion 과 같은 방식(LayoutAnimation)으로 통일한다.
    if (!reduceMotion) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    setDashboardCollapsed((prev) => {
      const next = !prev;
      setStorageItem(STORAGE_KEYS.SCHEDULE_DASHBOARD_COLLAPSED, next);
      return next;
    });
  }, [reduceMotion]);

  const statusCounts = useMemo(
    () => countSchedulesByType(groupedByApplication),
    [groupedByApplication]
  );

  const filteredSchedules = useMemo(
    () => filterSchedulesByStatus(groupedByApplication, statusFilter),
    [groupedByApplication, statusFilter]
  );

  const unpaidCount = useMemo(
    () => countUnpaidSchedules(groupedByApplication),
    [groupedByApplication]
  );

  const statusFilterOptions = useMemo<FilterTabOption<ScheduleStatusFilter>[]>(() => {
    const options: FilterTabOption<ScheduleStatusFilter>[] = [
      { value: 'all', label: STATUS_FILTER_LABELS.all },
      { value: 'applied', label: STATUS_FILTER_LABELS.applied, count: statusCounts.applied },
      { value: 'confirmed', label: STATUS_FILTER_LABELS.confirmed, count: statusCounts.confirmed },
      { value: 'completed', label: STATUS_FILTER_LABELS.completed, count: statusCounts.completed },
    ];

    // '아직 못 받은 근무'는 있을 때만 노출한다 — 늘 0 인 탭은 소음이다.
    if (unpaidCount > 0) {
      options.push({ value: 'unpaid', label: STATUS_FILTER_LABELS.unpaid, count: unpaidCount });
    }
    return options;
  }, [statusCounts, unpaidCount]);

  // 리스트 뷰를 시간 축으로 가른다 — '다가오는 근무'가 먼저, 그 안에서도 가까운 날이 먼저.
  // 기본 그룹 정렬은 최신순 내림차순이라 27일인 사용자에게 31일 카드가 맨 위에 왔다.
  const todayStr = getTodayString();

  // 더블부킹 경고 — 확정 권한은 각 구인자에게 있어 서로 모르게 같은 시간대에 둘 다
  // 확정될 수 있다. 감지기는 구인자 화면에만 있었고 정작 곤란해지는 쪽엔 경고가 없었다.
  const overlapMap = useMemo(() => detectScheduleOverlaps(schedules), [schedules]);

  // 근무 리마인더 예약 동기화 — 확정 근무를 잊는 것이 단발 알바의 1순위 사고인데
  // CHECKIN_REMINDER 는 타입·템플릿·딥링크가 다 있고 발송 주체만 0 이었다.
  // fire-and-forget: 알림 예약 실패가 스케줄 화면을 막지 않는다.
  useEffect(() => {
    if (schedules.length === 0) return;
    void syncShiftReminders(schedules);
  }, [schedules]);

  // '내 다음 근무' 히어로 — 이미 구현돼 있으나 소비자가 없던 useTodaySchedules(60초 폴링·
  // 오프라인 캐시 완비)를 오늘 근무 원천으로 쓰고, 오늘 것이 없으면 이번 달 확정 건에서 찾는다.
  const { schedules: todaySchedules } = useTodaySchedules();
  const nextShift = useMemo(
    () => pickNextShift([...todaySchedules, ...schedules], todayStr),
    [todaySchedules, schedules, todayStr]
  );
  const listSections = useMemo(() => {
    const { upcoming, past } = splitSchedulesByToday(filteredSchedules, todayStr);
    const countDays = (items: (ScheduleEvent | GroupedScheduleEvent)[]) =>
      items.reduce(
        (sum, item) => sum + (isGroupedScheduleEvent(item) ? item.dateRange.totalDays : 1),
        0
      );

    return [
      { key: 'upcoming' as const, label: '다가오는 근무', items: upcoming },
      { key: 'past' as const, label: '지난 근무', items: past },
    ]
      .filter((section) => section.items.length > 0)
      .map((section) => ({
        ...section,
        title: `${section.label} ${section.items.length}건 · ${countDays(section.items)}일`,
      }));
  }, [filteredSchedules, todayStr]);

  // sticky 헤더 위치 — 섹션마다 [헤더, 카드묶음] 2개 자식을 밀어넣으므로 짝수 인덱스가 헤더다.
  const listStickyIndices = useMemo(
    () => listSections.map((_, index) => index * 2),
    [listSections]
  );

  // 선택일에 일정이 없을 때 안내할 '가장 가까운 일정 날짜'
  // 캘린더 dot·선택일 카드도 리스트와 같은 상태 필터를 따른다.
  // 예전엔 리스트 전용이라 뷰를 토글하면 필터가 조용히 무효화되고 UI 단서도 사라졌다.
  const filteredCalendarSchedules = useMemo(
    () => filterSchedulesByStatus(schedules, statusFilter),
    [schedules, statusFilter]
  );
  const filteredSelectedDateSchedules = useMemo(
    () => filterSchedulesByStatus(selectedDateSchedules, statusFilter),
    [selectedDateSchedules, statusFilter]
  );

  const nearestScheduleDate = useMemo(() => {
    const dates = Array.from(new Set(schedules.map((schedule) => schedule.date)))
      .filter(Boolean)
      .sort();
    if (dates.length === 0) return null;
    return dates.find((date) => date >= selectedDate) ?? dates[dates.length - 1];
  }, [schedules, selectedDate]);

  // 뷰 토글 핸들러
  const handleToggleView = useCallback(() => {
    setViewMode((prev) => (prev === 'list' ? 'calendar' : 'list'));
  }, []);

  // 리스트 뷰 스크롤 제어 — '오늘' 버튼이 목록에서 아무 반응이 없던 문제를 없앤다.
  // 목록은 '다가오는 근무'가 맨 위이므로 최상단으로 올리면 오늘/최근접 근무가 보인다.
  const listScrollRef = useRef<ScrollView>(null);

  const handleGoToToday = useCallback(() => {
    goToToday();
    if (viewMode === 'list') {
      listScrollRef.current?.scrollTo({ y: 0, animated: true });
    }
  }, [goToToday, viewMode]);

  // 지원 취소 핸들러 (applied 상태)
  // 확인 다이얼로그는 호출자(ScheduleCard / ScheduleDetailModal)가 각자 띄운다.
  // 여기서 Alert.alert를 띄우면 ScheduleDetailModal 경유 시 이중 Modal/Alert 레이스로
  // iOS에서 Alert가 삼켜져 mutate가 영영 호출되지 않는다.
  const handleCancelApplication = useCallback(
    (applicationId: string) => {
      void triggerHaptic('warning');
      // refresh() 를 여기서 부르지 않는다 — mutation onSuccess 가 schedules.all 을 무효화하고,
      // onMutate 가 캐시에서 낙관 제거까지 한다. 여기서 또 부르면 무거운 월 조회가
      // 뮤테이션이 끝나기도 전에 헛돌 뿐이다.
      cancelApplication(applicationId);
    },
    [cancelApplication]
  );

  // 취소 요청 핸들러 (confirmed 상태) — 인라인 바텀시트로 표시
  // 지원서 재조회 중 재진입 가드 — 사전 검증에 왕복이 한 번 더 있어 응답이 느리면
  // 사용자가 다시 눌러 시트가 두 번 열리거나 경고 토스트가 중복으로 뜬다.
  const cancellationLookupRef = useRef<string | null>(null);
  const [isLoadingCancellationTarget, setIsLoadingCancellationTarget] = useState(false);

  const handleRequestCancellation = useCallback(
    async (applicationId: string) => {
      if (cancellationLookupRef.current === applicationId) return;
      cancellationLookupRef.current = applicationId;
      setIsLoadingCancellationTarget(true);
      try {
        const application = await getApplicationById(applicationId);

        if (!application) {
          addToast({
            type: 'error',
            message: '지원서를 찾지 못했어요. 새로고침 후 다시 시도해주세요.',
          });
          return;
        }

        if (application.recruitmentType === 'fixed') {
          addToast({
            type: 'warning',
            message: '고정공고는 1차 범위에서 취소 요청을 지원하지 않습니다.',
          });
          return;
        }

        if (
          application.status !== STATUS.APPLICATION.CONFIRMED &&
          application.status !== STATUS.APPLICATION.CANCELLATION_PENDING
        ) {
          addToast({ type: 'warning', message: '확정된 지원만 취소 요청이 가능합니다' });
          return;
        }

        if (
          application.status === STATUS.APPLICATION.CANCELLATION_PENDING ||
          application.cancellationRequest?.status === 'pending'
        ) {
          addToast({ type: 'warning', message: '이미 취소 요청이 진행 중입니다' });
          return;
        }

        if (application.cancellationRequest?.status === 'rejected') {
          addToast({
            type: 'warning',
            message: '이전 취소 요청이 거절되었습니다. 구인자에게 직접 문의해주세요.',
          });
          return;
        }

        setCancellationApp(application);
      } catch (error) {
        logger.error('지원서 조회 실패', error as Error, { applicationId });
        addToast({ type: 'error', message: '지원서를 불러오는 중 오류가 발생했습니다' });
      } finally {
        cancellationLookupRef.current = null;
        setIsLoadingCancellationTarget(false);
      }
    },
    [addToast]
  );

  // 대타 구인 글의 원본 데이터 — 미리보기와 실제 게시물이 같은 값을 쓰도록 한 곳에서 만든다.
  const cancellationJobSummary = useMemo<BoardJobSummary | null>(() => {
    if (!cancellationApp) return null;
    return {
      jobPostingId: cancellationApp.jobPostingId,
      title: cancellationApp.jobPostingTitle ?? cancellationApp.jobPosting?.title ?? '',
      workDate: cancellationApp.jobPostingDate ?? cancellationApp.jobPosting?.workDate ?? '',
      workDates: cancellationApp.jobPosting?.workDates,
      locationName: cancellationApp.jobPosting?.location?.name,
    };
  }, [cancellationApp]);

  const substitutePreview = useMemo(
    () =>
      cancellationJobSummary
        ? {
            title: buildSubstitutePostTitle(cancellationJobSummary),
            body: buildSubstitutePostBody(cancellationJobSummary),
          }
        : undefined,
    [cancellationJobSummary]
  );

  // 취소 요청 제출 핸들러
  const handleSubmitCancellation = useCallback(
    (applicationId: string, reason: string, wantsSubstitutePost: boolean) => {
      const applicantContext =
        user && cancellationJobSummary
          ? {
              name: profile?.name || profile?.nickname || user.displayName || '익명',
              role: (profile?.role ?? 'staff') as BoardAuthorRole,
              jobSummary: cancellationJobSummary,
            }
          : undefined;

      requestCancellation(
        { applicationId, reason, wantsSubstitutePost, applicantContext },
        {
          onSuccess: (result) => {
            setCancellationApp(null);
            refresh();
            if (result?.substitutePost === 'failed') {
              addToast({
                type: 'warning',
                message: '대타 구인 글 생성에 실패했습니다. 게시판에서 수동으로 작성해 주세요.',
              });
            }
          },
        }
      );
    },
    [user, profile, cancellationJobSummary, requestCancellation, refresh, addToast]
  );

  const handleCloseCancellationSheet = useCallback(() => {
    setCancellationApp(null);
  }, []);

  // 알림 딥링크 → 자동 액션
  // - applicationId: 해당 스케줄 상세 모달 자동 오픈
  // - cancelApplicationId: 취소 요청 바텀시트 자동 오픈 (cancel.tsx 호환성)
  //
  // 처리 단위는 boolean 이 아니라 **파라미터 값(key)** 이다. 스케줄은 (tabs) 스크린이라
  // 한 번 마운트되면 앱 수명 동안 언마운트되지 않는데, 1회성 boolean 플래그를 쓰면
  // 두 번째 알림부터 앱을 강제 종료할 때까지 영구히 무반응이 된다.
  const deepLinkGateRef = useRef<DeepLinkGate | null>(null);
  // missing 판정 후 지원서 직접 조회가 중복 발사되지 않게 하는 in-flight 키
  const missingLookupKeyRef = useRef<string | null>(null);
  // useLocalSearchParams 는 매 렌더 새 객체를 반환하므로 deps 에는 원시값만 싣는다.
  const { applicationId: deepLinkApplicationId, cancelApplicationId: deepLinkCancelApplicationId } =
    searchParams;
  useEffect(() => {
    const deepLinkKey = buildApplicationDeepLinkKey({
      applicationId: deepLinkApplicationId,
      cancelApplicationId: deepLinkCancelApplicationId,
    });
    if (!deepLinkKey) return;

    const { next, shouldProcess } = advanceDeepLinkGate(deepLinkGateRef.current, deepLinkKey);
    deepLinkGateRef.current = next;
    if (!shouldProcess) return;

    // 처리 완료 표시 + 파라미터 소비. 파라미터를 비워야 같은 알림을 다시 탭했을 때도
    // 착지가 살아난다(값이 그대로면 key 가 같아 게이트에서 걸린다).
    const markHandled = () => {
      deepLinkGateRef.current = { key: deepLinkKey, retried: true, done: true };
      router.setParams({ applicationId: undefined, cancelApplicationId: undefined });
    };
    const notifyMissing = (message: string) => {
      markHandled();
      addToast({ type: 'info', message });
    };

    if (deepLinkCancelApplicationId) {
      markHandled();
      void handleRequestCancellation(deepLinkCancelApplicationId);
      return;
    }

    if (deepLinkApplicationId) {
      const landing = resolveApplicationDeepLink(
        schedules,
        deepLinkApplicationId,
        isLoading || isRefreshing,
        error
      );
      if (landing.kind === 'open') {
        markHandled();
        // 상세 시트만 열고 끝내면 시트를 닫는 순간 캘린더는 여전히 오늘에 머문다 —
        // "확정된 그 날짜"를 보러 온 사용자가 다시 손으로 날짜를 찾아야 했다.
        // 선택 날짜를 근무일로 옮겨 시트 뒤·시트를 닫은 뒤 모두 해당 날짜를 가리키게 한다.
        setSelectedDate(landing.schedule.date);
        setSelectedSchedule(landing.schedule);
        setIsDetailSheetVisible(true);
      } else if (landing.kind === 'missing') {
        if (!next.retried) {
          // 캐시가 stale일 수 있으니 fresh 데이터로 1회 재판정 (확정 알림 착지 오탐 방지)
          deepLinkGateRef.current = { ...next, retried: true };
          void refresh();
          return;
        }

        // 근무월로 이미 점프했는데도 없으면 더 볼 곳이 없다.
        if (next.jumpedMonth) {
          notifyMissing(DEEP_LINK_APPLICATION_NOT_FOUND_MESSAGE);
          return;
        }

        // 조회는 '이번 달' 스코프라, 다른 달 확정 건은 여기까지 온다. 원인을 구분하지 않고
        // '거절되었거나 취소되어'를 띄우면 확정 알림에 사실과 정반대 안내가 나간다.
        // 지원서를 직접 조회해 근무월로 이동하거나, 진짜 사유를 알린다.
        if (missingLookupKeyRef.current === deepLinkKey) return; // 조회 진행 중
        missingLookupKeyRef.current = deepLinkKey;
        void (async () => {
          let application: Application | null = null;
          try {
            application = await getApplicationById(deepLinkApplicationId);
          } catch (lookupError) {
            logger.error('딥링크 지원서 조회 실패', lookupError as Error, {
              applicationId: deepLinkApplicationId,
            });
          }

          const outcome = resolveMissingApplicationDeepLink(application, currentMonth, false);
          if (outcome.kind === 'jump-month') {
            deepLinkGateRef.current = {
              key: deepLinkKey,
              retried: true,
              done: false,
              jumpedMonth: true,
            };
            goToMonth(outcome.year, outcome.month);
            return;
          }
          notifyMissing(outcome.message);
        })();
      }
    }
  }, [
    handleRequestCancellation,
    schedules,
    isLoading,
    isRefreshing,
    error,
    addToast,
    refresh,
    currentMonth,
    goToMonth,
    setSelectedDate,
    deepLinkApplicationId,
    deepLinkCancelApplicationId,
  ]);

  // 단일 스케줄 상세 시트 열기
  const handleOpenDetailSheet = useCallback((schedule: ScheduleEvent) => {
    setSelectedSchedule(schedule);
    setSelectedGroupedSchedule(null);
    setIsDetailSheetVisible(true);
  }, []);

  // 그룹화된 스케줄 클릭 시 선택된 날짜의 원본 이벤트로 상세 시트 열기
  const handleOpenGroupedDetailSheet = useCallback(
    (group: GroupedScheduleEvent) => {
      if (group.originalEvents.length === 0) return;

      // 캘린더에서 선택한 날짜(selectedDate)가 그룹에 있으면 그 날짜를 먼저 존중하고,
      // 없으면(리스트 뷰 경로) '오늘 이후 가장 가까운 근무일'을 연다. 예전 폴백인
      // originalEvents[0] 은 내림차순 정렬의 가장 나중 날짜라 3일 대회가 '3 / 3일'부터 열렸다.
      const focusDate = pickGroupFocusDate(group.dateRange.dates, getTodayString());
      const targetEvent =
        group.originalEvents.find((e) => e.date === selectedDate) ??
        group.originalEvents.find((e) => e.date === focusDate) ??
        group.originalEvents[0];

      setSelectedSchedule(targetEvent);
      setSelectedGroupedSchedule(group);
      setIsDetailSheetVisible(true);
    },
    [selectedDate]
  );

  // 그룹 내 특정 날짜 클릭 핸들러
  const handleGroupDatePress = useCallback(
    (date: string, scheduleEventId: string, group: GroupedScheduleEvent) => {
      const targetEvent = group.originalEvents.find(
        (e) => e.id === scheduleEventId || e.date === date
      );
      if (targetEvent) {
        setSelectedSchedule(targetEvent);
        setSelectedGroupedSchedule(group);
        setIsDetailSheetVisible(true);
      }
    },
    []
  );

  // 카드 렌더 — 캘린더 뷰와 리스트 뷰가 같은 규칙을 쓰도록 한 곳에서 만든다.
  const renderScheduleItem = useCallback(
    (item: ScheduleEvent | GroupedScheduleEvent) => {
      if (isGroupedScheduleEvent(item)) {
        return (
          <GroupedScheduleCard
            key={item.id}
            group={item}
            onPress={() => handleOpenGroupedDetailSheet(item)}
            onDatePress={(date, eventId) => handleGroupDatePress(date, eventId, item)}
          />
        );
      }
      return (
        <ScheduleCard
          key={item.id}
          schedule={item}
          onPress={() => handleOpenDetailSheet(item)}
          overlapWarning={formatOverlapWarning(overlapMap.get(item.id) ?? [])}
        />
      );
    },
    [handleOpenGroupedDetailSheet, handleGroupDatePress, handleOpenDetailSheet, overlapMap]
  );

  // 스케줄 상세 시트 닫기
  const handleCloseDetailSheet = useCallback(() => {
    setIsDetailSheetVisible(false);
    // 닫힌 후 선택된 스케줄 초기화 (애니메이션 완료 후)
    setTimeout(() => {
      setSelectedSchedule(null);
      setSelectedGroupedSchedule(null);
    }, SHEET_DISMISS_ANIMATION_MS);
  }, []);

  // 완료 근무 → 평가 직행. 예전에는 배너 → 평가 허브 → 목록에서 재검색으로 우회해야 했다.
  const pendingReviewByWorkLogId = useMemo(
    () => new Map(pendingReviews.map((item) => [item.workLogId, item])),
    [pendingReviews]
  );

  const handleWriteReview = useCallback(
    (workLogId: string) => {
      const item = pendingReviewByWorkLogId.get(workLogId);
      if (!item) return;

      handleCloseDetailSheet();
      router.push({
        pathname: '/(app)/reviews/write',
        params: {
          workLogId: item.workLogId,
          revieweeId: item.revieweeId,
          revieweeName: item.revieweeName,
          reviewerType: item.reviewerType,
          jobPostingId: item.jobPostingId,
          jobPostingTitle: item.jobPostingTitle,
          workDate: item.workDate,
        },
      });
    },
    [pendingReviewByWorkLogId, handleCloseDetailSheet]
  );

  // 구인자 신고 모달 — 상위 소유. 시트를 닫은 뒤 형제로 열어 iOS 중첩 Modal 터치 먹통을 피한다.
  const ownerReport = useOwnerReport();

  // 그룹 모드에서 날짜 변경 핸들러 (모달 내 이전/다음 버튼)
  const handleModalDateChange = useCallback((_date: string, schedule: ScheduleEvent) => {
    setSelectedSchedule(schedule);
  }, []);

  // 시트 닫힘 후 스캔 화면 이동 예약 타이머
  const qrOpenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // QR 스캔 핸들러 — 스캐너를 인라인으로 띄우지 않고 /scan 단일 라우트로 넘긴다
  // (헤더 QR 아이콘과 동일 경로). 출근/퇴근 판정은 서버가 하므로 넘길 파라미터가 없다.
  const handleQRScan = useCallback(() => {
    // iOS 중첩 Modal 터치 먹통 방지 — 상세 시트를 먼저 닫고 dismiss 애니메이션 후 이동한다.
    // (시트가 present 된 채 스캐너 Modal 이 뜨면 iOS 에서 터치 라우팅이 깨진다)
    handleCloseDetailSheet();
    if (qrOpenTimerRef.current) clearTimeout(qrOpenTimerRef.current);
    qrOpenTimerRef.current = setTimeout(() => {
      qrOpenTimerRef.current = null;
      router.push('/(app)/scan');
    }, SHEET_DISMISS_ANIMATION_MS);
  }, [handleCloseDetailSheet]);

  // 블러(탭 전환) 시 예약된 스캔 화면 이동 취소 — 예약이 살아있으면
  // 다른 탭 위로 스캐너가 떠버린다. 화면이 포커스를 잃으면 예약을 버린다.
  useFocusEffect(
    useCallback(
      () => () => {
        if (qrOpenTimerRef.current) {
          clearTimeout(qrOpenTimerRef.current);
          qrOpenTimerRef.current = null;
        }
      },
      []
    )
  );

  // 날짜 선택 핸들러
  const handleDateSelect = useCallback(
    (date: string) => {
      setSelectedDate(date);
    },
    [setSelectedDate]
  );

  // 월 변경 핸들러 (캘린더에서 호출)
  const handleMonthChange = useCallback(
    (year: number, month: number) => {
      goToMonth(year, month);
    },
    [goToMonth]
  );

  // 조회 실패는 콘텐츠 영역만 대체한다. 전면 차단하면 월 네비게이션도 PTR 도 함께 사라져
  // 사용자가 할 수 있는 일이 앱 재시작밖에 남지 않는다.
  const hasBlockingError = Boolean(error) && !isLoading;

  // 오프라인인데 아무것도 없다 = "일정이 없다"가 아니라 "지금은 알 수 없다"이다.
  // 지하 홀덤펍·지하철 콜드스타트에서 확정 근무가 있는데도 온보딩 문구 + 동작 안 하는
  // '공고 둘러보기' 버튼이 떠서, 사용자가 근무를 잊거나 앱을 불신하게 된다.
  const isOfflineEmpty = isOffline && groupedByApplication.length === 0 && !isLoading;

  const renderEmptyState = () =>
    isOfflineEmpty ? (
      <EmptyState
        title="지금은 일정을 불러올 수 없어요"
        description={
          '오프라인 상태예요. 저장해둔 일정도 없어서 이 달에 근무가 있는지 확인할 수 없어요.\n' +
          '네트워크가 연결되면 자동으로 다시 불러옵니다.'
        }
        // 오프라인에서 '공고 둘러보기'는 눌러도 아무 일이 없다 — 막다른 길을 만들지 않는다.
        actionLabel="다시 시도"
        onAction={refresh}
        variant="content"
      />
    ) : (
      <EmptyState
        title="아직 예정된 스케줄이 없어요"
        description={`${currentMonth.year}년 ${currentMonth.month}월 일정이 비어있어요.\n공고에 지원하면 여기에 바로 표시돼요.`}
        actionLabel="공고 둘러보기"
        onAction={() => router.push('/(app)/(tabs)/home-jobs')}
        // A1 진입 표면 ③: ops 허브 게이트 ON 시에만 보조 크로스링크(기본 액션은 유지).
        secondaryActionLabel={opsHubEnabled ? '라이브 대회 운영' : undefined}
        onSecondaryAction={opsHubEnabled ? () => router.push('/(ops)/tournaments') : undefined}
        variant="content"
      />
    );

  return (
    <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top']}>
      {/* 헤더 */}
      <TabHeader title="내 스케줄" />

      {/* 내 다음 근무 — 이 탭을 여는 1순위 질문에 먼저 답한다. 월 집계는 그 아래로. */}
      <NextShiftCard
        schedule={nextShift}
        onPress={() => nextShift && handleOpenDetailSheet(nextShift)}
        onQRScan={handleQRScan}
        overlapWarning={nextShift ? formatOverlapWarning(overlapMap.get(nextShift.id) ?? []) : null}
      />

      {/* 월 네비게이터 — 통계보다 먼저 와야 '어느 달의 숫자인지'가 먼저 읽힌다. */}
      <MonthNavigator
        year={currentMonth.year}
        month={currentMonth.month}
        viewMode={viewMode}
        onPrev={goToPrevMonth}
        onNext={goToNextMonth}
        onToday={handleGoToToday}
        onToggleView={handleToggleView}
      />

      {/* 월 요약 + 상태 필터 — 접을 수 있는 한 덩어리(히어로·월 네비게이터 아래).
          필터를 여기로 옮겨, 리스트가 시작하기까지의 세로를 한 번에 줄일 수 있게 했다. */}
      <ScheduleDashboard
        stats={stats}
        isLoading={isLoading}
        collapsed={dashboardCollapsed}
        onToggle={handleToggleDashboard}
        activeFilterLabel={statusFilter === 'all' ? null : STATUS_FILTER_LABELS[statusFilter]}
        unpaidCount={unpaidCount}
      >
        {/* 상태 필터 — 두 뷰 공통. 뷰를 토글해도 필터가 유지된다. */}
        {!hasBlockingError && groupedByApplication.length > 0 ? (
          <View className="bg-surface-card px-4 pt-3">
            <FilterTabs
              options={statusFilterOptions}
              selectedValue={statusFilter}
              onSelect={setStatusFilter}
            />
          </View>
        ) : null}
      </ScheduleDashboard>

      {/* 부분조회 실패 경고 — 일부 소스(근무/지원) fetch 실패 시 비차단 안내(P1#11).
          경고를 버리면 근무 일부가 빠진 캘린더를 정상으로 오인하므로 명시 노출한다. */}
      {warning && (
        <View
          className="mx-4 mt-2 rounded-md border border-warning-200 bg-warning-50 px-4 py-3 dark:border-warning-700 dark:bg-warning-900/20"
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          <Text className="text-sm font-sans-semibold text-warning-700 dark:text-warning-300">
            {warning}
          </Text>
          <Text className="mt-0.5 text-xs font-sans text-warning-600 dark:text-warning-400">
            당겨서 새로고침해 주세요.
          </Text>
        </View>
      )}

      {/* 오프라인 + 저장된 일정이 있음. 오프라인 캐시 보존기간을 24시간으로 늘린 대가로,
          "지금 보이는 게 실시간이 아니다"를 반드시 같이 말해야 한다. 그러지 않으면
          확정이 취소된 근무를 살아있는 것으로 믿고 현장에 나가게 된다. */}
      {isOffline && groupedByApplication.length > 0 && (
        <View
          className="mx-4 mt-2 rounded-md border border-secondary-200 bg-secondary-50 px-4 py-3 dark:border-surface-overlay dark:bg-surface-overlay"
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          <Text className="text-sm font-sans-semibold text-content-secondary">
            오프라인 상태예요
          </Text>
          <Text className="mt-0.5 text-xs font-sans text-content-muted dark:text-secondary-400">
            지금 보이는 일정은 이전에 받아둔 정보예요. 연결되면 자동으로 최신화됩니다.
          </Text>
        </View>
      )}

      {/* 갱신 실패 — 카드가 떠 있으면 error 는 null 로 접히므로 예전에는 완전 무음이었다.
          근무 당일 확정 여부를 확인하러 당긴 사용자가 옛 데이터를 최신으로 믿게 된다. */}
      {refreshError && !isRefreshing && (
        <View
          className="mx-4 mt-2 flex-row items-center rounded-md border border-warning-200 bg-warning-50 px-4 py-3 dark:border-warning-700 dark:bg-warning-900/20"
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          <View className="flex-1">
            <Text className="text-sm font-sans-semibold text-warning-700 dark:text-warning-300">
              최신 정보를 불러오지 못했어요
            </Text>
            <Text className="mt-0.5 text-xs font-sans text-warning-600 dark:text-warning-400">
              지금 보이는 내용은 이전에 받아둔 정보예요.
            </Text>
          </View>
          <FocusablePressable
            onPress={refresh}
            hitSlop={8}
            focusRingRadius={6}
            className="ml-3 rounded-md px-3 py-2 active:bg-warning-100 dark:active:bg-warning-900/40"
            accessibilityRole="button"
            accessibilityLabel="스케줄 다시 불러오기"
          >
            <Text className="text-sm font-sans-semibold text-warning-700 dark:text-warning-300">
              다시 시도
            </Text>
          </FocusablePressable>
        </View>
      )}

      {isLoadingCancellationTarget && (
        <View
          className="mx-4 mt-2 rounded-md bg-secondary-100 px-4 py-2 dark:bg-surface-overlay"
          accessibilityRole="progressbar"
          accessibilityLabel="취소 요청 정보를 불러오고 있어요"
          accessibilityLiveRegion="polite"
        >
          <Text className="text-sm font-sans-medium text-content-secondary">
            취소 요청 정보를 불러오고 있어요…
          </Text>
        </View>
      )}

      {/* 취소 처리 중 — 낙관 갱신으로 카드는 이미 사라지지만, 아무 표시도 없으면
          "정말 취소된 건가" 싶어 다시 누르게 된다. 서버 확정 전까지 진행 상황을 밝힌다. */}
      {isCancelling && (
        <View
          className="mx-4 mt-2 rounded-md bg-secondary-100 px-4 py-2 dark:bg-surface-overlay"
          accessibilityRole="progressbar"
          accessibilityLabel="지원 취소를 처리하고 있어요"
          accessibilityLiveRegion="polite"
        >
          <Text className="text-sm font-sans-medium text-content-secondary">
            지원 취소를 처리하고 있어요…
          </Text>
        </View>
      )}

      {/* 미작성 평가 배너 */}
      {pendingCount > 0 && (
        <View className="mt-2">
          <ReviewPromptBanner
            pendingCount={pendingCount}
            onPress={() => router.push('/(app)/reviews/history')}
          />
        </View>
      )}

      {/* 조회 실패 — 콘텐츠 영역만 대체. 헤더·월 네비게이터·PTR 은 살아있다. */}
      {hasBlockingError && (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            paddingBottom: bottomPadding,
            flexGrow: 1,
            justifyContent: 'center',
          }}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={refresh} {...PTR_REFRESH_PROPS} />
          }
        >
          <View className="items-center p-4">
            <ErrorState
              title="스케줄을 불러오지 못했어요"
              error={error}
              onRetry={refresh}
              // 조회 재실행은 부작용이 없다 — isRetryable=false 인 RLS·파싱 실패에서도
              // '다시 시도'를 남겨야 사용자가 갇히지 않는다.
              alwaysAllowRetry
            />
          </View>
        </ScrollView>
      )}

      {/* 캘린더 뷰 */}
      {!hasBlockingError && viewMode === 'calendar' && (
        <ScrollView
          className="flex-1"
          // 정적 pb-20(80px)은 탭바 실높이(56 + insets.bottom ≈ 90px)를 못 덮어
          // 마지막 카드가 가려지고 더 스크롤할 여지도 없었다 (2026-07-19 실기기).
          contentContainerStyle={{ paddingBottom: bottomPadding }}
          // impeccable §24 — 선택 날짜 헤더를 sticky로: 스크롤해도 현재 컨텍스트 유지.
          // 선택 날짜 스케줄이 있을 때만 sticky 활성 (index 1 = 헤더).
          stickyHeaderIndices={filteredSelectedDateSchedules.length > 0 ? [1] : undefined}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={refresh} {...PTR_REFRESH_PROPS} />
          }
        >
          {/* 0: 캘린더 — MonthNavigator border-b 바로 아래 붙임 */}
          <View>
            {/* lazy chunk 최초 로드용 fallback 도 실제 캘린더와 같은 마진을 쓴다 —
                edge-to-edge 로 두면 로드 직후 폭이 한 번 튄다. */}
            <Suspense
              fallback={
                <View className="mx-4">
                  <Skeleton width="100%" height={320} />
                </View>
              }
            >
              <CalendarView
                schedules={filteredCalendarSchedules}
                selectedDate={selectedDate}
                currentMonth={currentMonth}
                onDateSelect={handleDateSelect}
                onMonthChange={handleMonthChange}
                // 리스트 모드(ScreenSkeleton)와 같은 이중 가드 — 이미 받아둔 달을 다시
                // 열 때까지 스켈레톤이 뜨면 오히려 더 느리게 느껴진다.
                isLoading={isLoading && filteredCalendarSchedules.length === 0}
              />
            </Suspense>
          </View>

          {filteredSelectedDateSchedules.length > 0 ? (
            <>
              {/* 1: sticky 헤더 — 배경 solid로 아래 콘텐츠 가림 */}
              <View className="bg-surface-page dark:bg-surface px-4 pt-3 pb-2 border-b border-divider">
                <Text className="text-sm font-sans-medium text-content-secondary">
                  {formatSingleDate(selectedDate)} 스케줄 ({filteredSelectedDateSchedules.length}건)
                </Text>
              </View>
              {/* 2: 카드 리스트 */}
              <View className="px-4 pt-3">
                {filteredSelectedDateSchedules.map(renderScheduleItem)}
              </View>
            </>
          ) : !isLoading && groupedByApplication.length === 0 ? (
            // 캘린더 뷰 빈 상태 — 리스트 뷰와 같은 규칙(온보딩 / 오프라인 분기)을 공유한다.
            <View className="p-4">{renderEmptyState()}</View>
          ) : !isLoading ? (
            // 선택일에 일정이 없고 그 달엔 있는 경우 — 예전에는 아무것도 렌더하지 않아
            // 날짜를 눌렀는데 화면이 그대로인 '먹통'처럼 보였다.
            <View className="items-center px-4 pt-8">
              <Text className="text-sm text-content-muted dark:text-secondary-400 font-sans">
                이 날은 일정이 없어요.
              </Text>
              {nearestScheduleDate && (
                <FocusablePressable
                  onPress={() => setSelectedDate(nearestScheduleDate)}
                  hitSlop={8}
                  focusRingRadius={6}
                  className="mt-3 rounded-md px-4 py-2.5 active:bg-secondary-100 dark:active:bg-secondary-700"
                  accessibilityRole="button"
                  accessibilityLabel={`가장 가까운 일정 ${formatSingleDate(nearestScheduleDate)} 보기`}
                >
                  <Text className="text-sm font-sans-semibold text-primary-600 dark:text-primary-400">
                    가장 가까운 일정 보기 ({formatSingleDate(nearestScheduleDate)})
                  </Text>
                </FocusablePressable>
              )}
            </View>
          ) : null}
        </ScrollView>
      )}

      {/* 리스트 뷰 (그룹화 적용) */}
      {!hasBlockingError && viewMode === 'list' && (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: bottomPadding }}
          ref={listScrollRef}
          // impeccable §24 — 섹션 헤더를 sticky로: 카드 실제 렌더 시에만 활성.
          stickyHeaderIndices={
            !isLoading && listSections.length > 0 ? listStickyIndices : undefined
          }
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={refresh} {...PTR_REFRESH_PROPS} />
          }
        >
          {isLoading && schedules.length === 0 ? (
            <View className="p-4">
              <ScreenSkeleton type="scheduleList" count={4} />
            </View>
          ) : groupedByApplication.length === 0 ? (
            <View className="p-4">{renderEmptyState()}</View>
          ) : filteredSchedules.length === 0 ? (
            // 필터 결과 빈 상태 — 월 자체는 일정이 있으므로 온보딩 대신 필터 안내
            <View className="p-4">
              <EmptyState
                title={`${STATUS_FILTER_LABELS[statusFilter]} 일정이 없어요`}
                description="다른 상태를 선택하거나 전체 탭에서 확인해보세요."
                variant="content"
              />
            </View>
          ) : (
            // 섹션마다 [sticky 헤더, 카드묶음] 2개를 평평하게 밀어넣는다 — Fragment 로 감싸면
            // stickyHeaderIndices 가 세는 자식 인덱스와 어긋난다.
            listSections.flatMap((section) => [
              <View
                key={`${section.key}-header`}
                className="bg-surface-page dark:bg-surface px-4 pt-3 pb-2 border-b border-divider"
              >
                <Text className="text-sm font-sans-medium text-content-secondary">
                  {section.title}
                </Text>
              </View>,
              <View key={`${section.key}-cards`} className="px-4 pt-3">
                {section.items.map(renderScheduleItem)}
              </View>,
            ])
          )}
        </ScrollView>
      )}

      {/* 취소 요청 바텀시트 (confirmed → 인라인) */}
      {cancellationApp && (
        <CancellationRequestForm
          application={cancellationApp}
          visible={!!cancellationApp}
          isSubmitting={isRequestingCancellation}
          onSubmit={handleSubmitCancellation}
          onClose={handleCloseCancellationSheet}
          substitutePreview={substitutePreview}
        />
      )}

      {/* 스케줄 상세 모달 (3탭 + 그룹 모드 지원) */}
      <ScheduleDetailModal
        schedule={selectedSchedule}
        visible={isDetailSheetVisible}
        onClose={handleCloseDetailSheet}
        onQRScan={handleQRScan}
        onCancelApplication={handleCancelApplication}
        onRequestCancellation={handleRequestCancellation}
        onReport={ownerReport.open}
        pendingReviewWorkLogId={
          selectedSchedule?.workLogId && pendingReviewByWorkLogId.has(selectedSchedule.workLogId)
            ? selectedSchedule.workLogId
            : undefined
        }
        onWriteReview={handleWriteReview}
        groupedSchedule={selectedGroupedSchedule}
        onDateChange={handleModalDateChange}
        onRefreshSchedule={refresh}
      />

      {/* 스태프 정산 튜토리얼 */}

      {/* 구인자 신고 모달 — 시트 밖 형제로 렌더 (시트가 닫힌 뒤 열려 iOS 중첩 Modal 터치 먹통 회피) */}
      <ReportModal
        visible={ownerReport.visible}
        onClose={ownerReport.close}
        mode="employee"
        target={ownerReport.target}
        jobPostingId={ownerReport.jobPostingId}
        jobPostingTitle={ownerReport.jobPostingTitle}
        onSubmit={ownerReport.submit}
        isLoading={ownerReport.isLoading}
      />
    </SafeAreaView>
  );
}
