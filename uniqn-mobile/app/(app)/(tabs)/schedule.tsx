/**
 * UNIQN Mobile - Schedule Screen
 * 내 스케줄 화면
 */

import { useState, useCallback, useEffect, useMemo, useRef, Suspense, lazy } from 'react';
import { View, Text, ScrollView, RefreshControl } from 'react-native';
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
import { ScheduleCard, ScheduleDetailModal, GroupedScheduleCard } from '@/components/schedule';
import { CancellationRequestForm } from '@/components/applications';
import { ReportModal } from '@/components/employer/ReportModal';
import { useOwnerReport } from '@/components/schedule/useOwnerReport';
import { TabHeader } from '@/components/headers';
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon, MenuIcon } from '@/components/icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCalendarView, useApplications } from '@/hooks';
import { useOpsHubEnabled } from '@/hooks/useOpsHubEnabled';
import { useTabBarBottomPadding } from '@/hooks/useTabBarBottomPadding';
import { useAuthStore } from '@/stores/authStore';
import { usePendingReviews } from '@/hooks/useReviews';
import ReviewPromptBanner from '@/components/review/ReviewPromptBanner';
import { useToastStore } from '@/stores/toastStore';
import { SECONDARY_PALETTE } from '@/constants/colors';
import { PTR_REFRESH_PROPS } from '@/constants/ptr';
import { formatCurrency } from '@/utils/formatters';
import { SCHEDULE_STATS_LABELS } from '@/utils/applicationStatusLabel';
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
import {
  filterSchedulesByStatus,
  countSchedulesByType,
  type ScheduleStatusFilter,
} from '@/utils/scheduleGrouping';
import type { Application, ScheduleEvent, GroupedScheduleEvent } from '@/types';
import type { BoardAuthorRole } from '@/types/board';
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

interface StatsCardProps {
  stats:
    | {
        upcomingSchedules: number;
        confirmedSchedules: number;
        completedSchedules: number;
        thisMonthEarnings: number;
      }
    | undefined;
  isLoading: boolean;
}

// StatsCard — full-bleed 밴드로 전환 (옵션 A). MonthNavigator와 동일한 시각 언어
// (bg-surface-card + px-4 py-3 + border-b border-divider)를 사용해
// TabHeader 아래 정보 패널이 하나의 띠 구조로 연결되도록 함.
function StatsCard({ stats, isLoading }: StatsCardProps) {
  const BAND_CLASS = 'bg-surface-card px-4 py-3 border-b border-divider';

  if (isLoading) {
    return (
      <View className={BAND_CLASS}>
        {/* 1행: 지원/확정/완료 스켈레톤 */}
        <View className="flex-row justify-around">
          {[1, 2, 3].map((i) => (
            <View key={i} className="items-center">
              <Skeleton width={50} height={14} />
              <Skeleton width={36} height={20} className="mt-1" />
            </View>
          ))}
        </View>
        {/* 내부 구분선 */}
        <View className="h-px bg-secondary-200 dark:bg-surface-overlay my-2.5" />
        {/* 2행: 수익 스켈레톤 */}
        <View className="flex-row justify-between items-center px-2">
          <Skeleton width={40} height={14} />
          <Skeleton width={120} height={22} />
        </View>
      </View>
    );
  }

  if (!stats) return null;

  return (
    <View className={BAND_CLASS}>
      {/* 1행: 대기중/확정/완료 — 지원 상태 어휘와 통일 */}
      <View className="flex-row justify-around">
        <View
          className="items-center"
          accessible
          accessibilityLabel={`${SCHEDULE_STATS_LABELS.upcoming} 통계`}
        >
          <Text className="text-xs text-secondary-600 dark:text-secondary-400 font-sans">
            {SCHEDULE_STATS_LABELS.upcoming}
          </Text>
          <Text className="text-lg font-display text-warning-600 dark:text-warning-400">
            {stats.upcomingSchedules}
          </Text>
        </View>
        <View className="h-6 w-px bg-secondary-200 dark:bg-surface-overlay" />
        <View
          className="items-center"
          accessible
          accessibilityLabel={`${SCHEDULE_STATS_LABELS.confirmed} 통계`}
        >
          <Text className="text-xs text-secondary-600 dark:text-secondary-400 font-sans">
            {SCHEDULE_STATS_LABELS.confirmed}
          </Text>
          <Text className="text-lg font-display text-success-600 dark:text-success-400">
            {stats.confirmedSchedules}
          </Text>
        </View>
        <View className="h-6 w-px bg-secondary-200 dark:bg-surface-overlay" />
        <View
          className="items-center"
          accessible
          accessibilityLabel={`${SCHEDULE_STATS_LABELS.completed} 통계`}
        >
          <Text className="text-xs text-secondary-600 dark:text-secondary-400 font-sans">
            {SCHEDULE_STATS_LABELS.completed}
          </Text>
          <Text className="text-lg font-display text-content-primary dark:text-secondary-100">
            {stats.completedSchedules}
          </Text>
        </View>
      </View>
      {/* 내부 구분선 */}
      <View className="h-px bg-secondary-200 dark:bg-surface-overlay my-2.5" />
      {/* 2행: 수익 */}
      <View
        className="flex-row justify-between items-center px-2"
        accessible
        accessibilityLabel="수익 통계"
      >
        <Text className="text-sm text-secondary-600 dark:text-secondary-400 font-sans">수익</Text>
        <Text className="text-xl font-display text-primary-600 dark:text-primary-400">
          {formatCurrency(stats.thisMonthEarnings)}
        </Text>
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
  const { pendingCount } = usePendingReviews();

  // 지원 취소 훅
  const { cancelApplication, requestCancellation, isRequestingCancellation } = useApplications();

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
    setSelectedDate,
    goToPrevMonth,
    goToNextMonth,
    goToMonth,
    goToToday,
    refresh,
  } = useCalendarView({ enableGrouping: true, realtime: true });

  // 상태 필터 (리스트 뷰 전용, M1) — 'all'은 취소 포함 전체 노출
  const [statusFilter, setStatusFilter] = useState<ScheduleStatusFilter>('all');

  const statusCounts = useMemo(
    () => countSchedulesByType(groupedByApplication),
    [groupedByApplication]
  );

  const filteredSchedules = useMemo(
    () => filterSchedulesByStatus(groupedByApplication, statusFilter),
    [groupedByApplication, statusFilter]
  );

  const statusFilterOptions = useMemo<FilterTabOption<ScheduleStatusFilter>[]>(
    () => [
      { value: 'all', label: '전체' },
      { value: 'applied', label: SCHEDULE_TYPE_LABELS.applied, count: statusCounts.applied },
      { value: 'confirmed', label: SCHEDULE_TYPE_LABELS.confirmed, count: statusCounts.confirmed },
      { value: 'completed', label: SCHEDULE_TYPE_LABELS.completed, count: statusCounts.completed },
    ],
    [statusCounts]
  );

  // 총 일수 계산 (그룹화된 스케줄의 실제 일수 합계) — 리스트 헤더용이라 필터 반영
  const totalDays = useMemo(() => {
    return filteredSchedules.reduce((sum, item) => {
      if (isGroupedScheduleEvent(item)) {
        return sum + item.dateRange.totalDays;
      }
      return sum + 1;
    }, 0);
  }, [filteredSchedules]);

  // 뷰 토글 핸들러
  const handleToggleView = useCallback(() => {
    setViewMode((prev) => (prev === 'list' ? 'calendar' : 'list'));
  }, []);

  // 지원 취소 핸들러 (applied 상태)
  // 확인 다이얼로그는 호출자(ScheduleCard / ScheduleDetailModal)가 각자 띄운다.
  // 여기서 Alert.alert를 띄우면 ScheduleDetailModal 경유 시 이중 Modal/Alert 레이스로
  // iOS에서 Alert가 삼켜져 mutate가 영영 호출되지 않는다.
  const handleCancelApplication = useCallback(
    (applicationId: string) => {
      void triggerHaptic('warning');
      cancelApplication(applicationId);
      refresh();
    },
    [cancelApplication, refresh]
  );

  // 취소 요청 핸들러 (confirmed 상태) — 인라인 바텀시트로 표시
  const handleRequestCancellation = useCallback(
    async (applicationId: string) => {
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
      }
    },
    [addToast]
  );

  // 취소 요청 제출 핸들러
  const handleSubmitCancellation = useCallback(
    (applicationId: string, reason: string, wantsSubstitutePost: boolean) => {
      const applicantContext =
        user && cancellationApp
          ? {
              name: profile?.name || profile?.nickname || user.displayName || '익명',
              role: (profile?.role ?? 'staff') as BoardAuthorRole,
              jobSummary: {
                jobPostingId: cancellationApp.jobPostingId,
                title: cancellationApp.jobPostingTitle ?? cancellationApp.jobPosting?.title ?? '',
                workDate:
                  cancellationApp.jobPostingDate ?? cancellationApp.jobPosting?.workDate ?? '',
                workDates: cancellationApp.jobPosting?.workDates,
                locationName: cancellationApp.jobPosting?.location?.name,
              },
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
    [user, profile, cancellationApp, requestCancellation, refresh, addToast]
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

      // 캘린더에서 선택한 날짜(selectedDate)와 일치하는 이벤트 찾기
      const targetEvent =
        group.originalEvents.find((e) => e.date === selectedDate) || group.originalEvents[0]; // 없으면 첫 번째로 대체

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

  // 스케줄 상세 시트 닫기
  const handleCloseDetailSheet = useCallback(() => {
    setIsDetailSheetVisible(false);
    // 닫힌 후 선택된 스케줄 초기화 (애니메이션 완료 후)
    setTimeout(() => {
      setSelectedSchedule(null);
      setSelectedGroupedSchedule(null);
    }, SHEET_DISMISS_ANIMATION_MS);
  }, []);

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

  // 에러 상태
  if (error && !isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top']}>
        <TabHeader title="내 스케줄" />
        <View className="flex-1 justify-center items-center p-4">
          <ErrorState title="스케줄을 불러오지 못했어요" error={error} onRetry={refresh} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top']}>
      {/* 헤더 */}
      <TabHeader title="내 스케줄" />

      {/* 통계 카드 — 월 요약을 먼저 노출 (대시보드 상태 우선) */}
      <StatsCard stats={stats} isLoading={isLoading} />

      {/* 월 네비게이터 — StatsCard 바로 아래, 캘린더/리스트 바로 위에 배치해
          섹션 사이 공백 제거. 구분은 Navigator 자체 border-b로 처리. */}
      <MonthNavigator
        year={currentMonth.year}
        month={currentMonth.month}
        viewMode={viewMode}
        onPrev={goToPrevMonth}
        onNext={goToNextMonth}
        onToday={goToToday}
        onToggleView={handleToggleView}
      />

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

      {/* 미작성 평가 배너 */}
      {pendingCount > 0 && (
        <View className="mt-2">
          <ReviewPromptBanner
            pendingCount={pendingCount}
            onPress={() => router.push('/(app)/reviews/history')}
          />
        </View>
      )}

      {/* 캘린더 뷰 */}
      {viewMode === 'calendar' && (
        <ScrollView
          className="flex-1"
          // 정적 pb-20(80px)은 탭바 실높이(56 + insets.bottom ≈ 90px)를 못 덮어
          // 마지막 카드가 가려지고 더 스크롤할 여지도 없었다 (2026-07-19 실기기).
          contentContainerStyle={{ paddingBottom: bottomPadding }}
          // impeccable §24 — 선택 날짜 헤더를 sticky로: 스크롤해도 현재 컨텍스트 유지.
          // 선택 날짜 스케줄이 있을 때만 sticky 활성 (index 1 = 헤더).
          stickyHeaderIndices={selectedDateSchedules.length > 0 ? [1] : undefined}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={refresh} {...PTR_REFRESH_PROPS} />
          }
        >
          {/* 0: 캘린더 — MonthNavigator border-b 바로 아래 붙임 */}
          <View>
            <Suspense fallback={<Skeleton width="100%" height={320} />}>
              <CalendarView
                schedules={schedules}
                selectedDate={selectedDate}
                currentMonth={currentMonth}
                onDateSelect={handleDateSelect}
                onMonthChange={handleMonthChange}
              />
            </Suspense>
          </View>

          {selectedDateSchedules.length > 0 ? (
            <>
              {/* 1: sticky 헤더 — 배경 solid로 아래 콘텐츠 가림 */}
              <View className="bg-surface-page dark:bg-surface px-4 pt-3 pb-2 border-b border-divider">
                <Text className="text-sm font-sans-medium text-content-secondary">
                  {selectedDate} 스케줄 ({selectedDateSchedules.length}건)
                </Text>
              </View>
              {/* 2: 카드 리스트 */}
              <View className="px-4 pt-3">
                {selectedDateSchedules.map((item) => {
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
                    />
                  );
                })}
              </View>
            </>
          ) : !isLoading && groupedByApplication.length === 0 ? (
            // 캘린더 뷰 빈 상태 — 리스트 뷰와 동일한 온보딩 EmptyState (월 전체 0건일 때만)
            <View className="p-4">
              <EmptyState
                title="아직 예정된 스케줄이 없어요"
                description={`${currentMonth.year}년 ${currentMonth.month}월 일정이 비어있어요.\n공고에 지원하면 여기에 바로 표시돼요.`}
                actionLabel="공고 둘러보기"
                onAction={() => router.push('/(app)/(tabs)/home-jobs')}
                // A1 진입 표면 ③: ops 허브 게이트 ON 시에만 보조 크로스링크(기본 액션은 유지).
                secondaryActionLabel={opsHubEnabled ? '라이브 대회 운영' : undefined}
                onSecondaryAction={
                  opsHubEnabled ? () => router.push('/(ops)/tournaments') : undefined
                }
                variant="content"
              />
            </View>
          ) : null}
        </ScrollView>
      )}

      {/* 상태 필터 (리스트 뷰 전용, M1) — 지원/확정/완료를 탭 전환 없이 구분 */}
      {viewMode === 'list' && groupedByApplication.length > 0 && (
        <View className="px-4 pt-3">
          <FilterTabs
            options={statusFilterOptions}
            selectedValue={statusFilter}
            onSelect={setStatusFilter}
          />
        </View>
      )}

      {/* 리스트 뷰 (그룹화 적용) */}
      {viewMode === 'list' && (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: bottomPadding }}
          // impeccable §24 — 월 스케줄 요약 헤더를 sticky로: 카드 실제 렌더 시에만 활성.
          stickyHeaderIndices={!isLoading && filteredSchedules.length > 0 ? [0] : undefined}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={refresh} {...PTR_REFRESH_PROPS} />
          }
        >
          {isLoading && schedules.length === 0 ? (
            <View className="p-4">
              <ScreenSkeleton type="scheduleList" count={4} />
            </View>
          ) : groupedByApplication.length === 0 ? (
            <View className="p-4">
              <EmptyState
                title="아직 예정된 스케줄이 없어요"
                description={`${currentMonth.year}년 ${currentMonth.month}월 일정이 비어있어요.\n공고에 지원하면 여기에 바로 표시돼요.`}
                actionLabel="공고 둘러보기"
                onAction={() => router.push('/(app)/(tabs)/home-jobs')}
                // A1 진입 표면 ③: ops 허브 게이트 ON 시에만 보조 크로스링크(기본 액션은 유지).
                secondaryActionLabel={opsHubEnabled ? '라이브 대회 운영' : undefined}
                onSecondaryAction={
                  opsHubEnabled ? () => router.push('/(ops)/tournaments') : undefined
                }
                variant="content"
              />
            </View>
          ) : filteredSchedules.length === 0 ? (
            // 필터 결과 빈 상태 — 월 자체는 일정이 있으므로 온보딩 대신 필터 안내
            <View className="p-4">
              <EmptyState
                title={`${statusFilter === 'all' ? '전체' : SCHEDULE_TYPE_LABELS[statusFilter]} 일정이 없어요`}
                description="다른 상태를 선택하거나 전체 탭에서 확인해보세요."
                variant="content"
              />
            </View>
          ) : (
            <>
              {/* 0: sticky 헤더 — MonthNavigator 아래 바로 붙음 (pt-3로 최소 호흡) */}
              <View className="bg-surface-page dark:bg-surface px-4 pt-3 pb-2 border-b border-divider">
                <Text className="text-sm font-sans-medium text-content-secondary">
                  {currentMonth.month}월 스케줄 ({filteredSchedules.length}건, {totalDays}일)
                </Text>
              </View>
              {/* 1: 카드 리스트 */}
              <View className="px-4 pt-3">
                {filteredSchedules.map((item) => {
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
                    />
                  );
                })}
              </View>
            </>
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
