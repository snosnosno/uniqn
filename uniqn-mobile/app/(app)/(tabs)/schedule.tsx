/**
 * UNIQN Mobile - Schedule Screen
 * 내 스케줄 화면
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Card,
  EmptyState,
  ErrorState,
  FocusablePressable,
  ScreenSkeleton,
  Skeleton,
} from '@/components/ui';
import { CalendarView } from '@/components/schedule/CalendarView';
import { ScheduleCard, ScheduleDetailModal, GroupedScheduleCard } from '@/components/schedule';
import { CancellationRequestForm } from '@/components/applications';
import { QRCodeScanner } from '@/components/qr';
import { TabHeader } from '@/components/headers';
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon, MenuIcon } from '@/components/icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCalendarView, useQRCodeScanner, useCurrentWorkStatus, useApplications } from '@/hooks';
import { useAuthStore } from '@/stores/authStore';
import { usePendingReviews } from '@/hooks/useReviews';
import ReviewPromptBanner from '@/components/review/ReviewPromptBanner';
import { useToastStore } from '@/stores/toastStore';
import { SECONDARY_PALETTE } from '@/constants/colors';
import { PTR_REFRESH_PROPS } from '@/constants/ptr';
import { formatCurrency } from '@/utils/formatters';
import { STATUS } from '@/constants';
import { getApplicationById } from '@/services/jobs/applicationService';
import { logger } from '@/utils/logger';
import { triggerHaptic } from '@/utils/haptics';
import type {
  Application,
  ScheduleEvent,
  GroupedScheduleEvent,
  QRCodeScanResult,
  QRCodeAction,
} from '@/types';
import type { BoardAuthorRole } from '@/types/board';
import { isGroupedScheduleEvent } from '@/types/schedule';

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
    <View className="flex-row items-center justify-between bg-white dark:bg-surface px-4 py-3 border-b border-divider">
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

function StatsCard({ stats, isLoading }: StatsCardProps) {
  if (isLoading) {
    return (
      <Card className="mx-4 mt-4">
        {/* 1행: 지원/확정/완료 스켈레톤 */}
        <View className="flex-row justify-around">
          {[1, 2, 3].map((i) => (
            <View key={i} className="items-center">
              <Skeleton width={50} height={14} />
              <Skeleton width={36} height={20} className="mt-1" />
            </View>
          ))}
        </View>
        {/* 구분선 */}
        <View className="h-px bg-secondary-200 dark:bg-surface my-2.5" />
        {/* 2행: 수익 스켈레톤 */}
        <View className="flex-row justify-between items-center px-2">
          <Skeleton width={40} height={14} />
          <Skeleton width={120} height={22} />
        </View>
      </Card>
    );
  }

  if (!stats) return null;

  return (
    <Card className="mx-4 mt-4">
      {/* 1행: 지원/확정/완료 — 숫자 크기 축소(text-2xl→text-lg) + 수익 위계 유지 */}
      <View className="flex-row justify-around">
        {/* 지원 (applied) */}
        <View className="items-center" accessible accessibilityLabel="지원 통계">
          <Text className="text-xs text-secondary-500 dark:text-secondary-400 font-sans">지원</Text>
          <Text className="text-lg font-display text-warning-600 dark:text-warning-400">
            {stats.upcomingSchedules}
          </Text>
        </View>
        <View className="h-6 w-px bg-secondary-200 dark:bg-surface" />
        {/* 확정 (confirmed) */}
        <View className="items-center" accessible accessibilityLabel="확정 통계">
          <Text className="text-xs text-secondary-500 dark:text-secondary-400 font-sans">확정</Text>
          <Text className="text-lg font-display text-success-600 dark:text-success-400">
            {stats.confirmedSchedules}
          </Text>
        </View>
        <View className="h-6 w-px bg-secondary-200 dark:bg-surface" />
        {/* 완료 (completed) */}
        <View className="items-center" accessible accessibilityLabel="완료 통계">
          <Text className="text-xs text-secondary-500 dark:text-secondary-400 font-sans">완료</Text>
          <Text className="text-lg font-display text-content-primary dark:text-secondary-100">
            {stats.completedSchedules}
          </Text>
        </View>
      </View>
      {/* 구분선 */}
      <View className="h-px bg-secondary-200 dark:bg-surface my-2.5" />
      {/* 2행: 수익 — 3숫자보다 한 단계 위계(text-lg < text-xl) 유지 */}
      <View
        className="flex-row justify-between items-center px-2"
        accessible
        accessibilityLabel="수익 통계"
      >
        <Text className="text-sm text-secondary-500 dark:text-secondary-400 font-sans">수익</Text>
        <Text className="text-xl font-display text-primary-600 dark:text-primary-400">
          {formatCurrency(stats.thisMonthEarnings)}
        </Text>
      </View>
    </Card>
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

  // QR 스캐너 상태
  const [isQRScannerVisible, setIsQRScannerVisible] = useState(false);
  const [qrScanAction, setQRScanAction] = useState<QRCodeAction | undefined>();

  // 현재 근무 상태
  const { isWorking } = useCurrentWorkStatus();

  // 미작성 평가 수
  const { pendingCount } = usePendingReviews();

  // 지원 취소 훅
  const { cancelApplication, requestCancellation, isRequestingCancellation } = useApplications();

  const {
    schedules,
    // groupedSchedules는 날짜별 그룹화, groupedByApplication은 지원별 그룹화
    groupedByApplication,
    selectedDateSchedules,
    stats,
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

  // 총 일수 계산 (그룹화된 스케줄의 실제 일수 합계)
  const totalDays = useMemo(() => {
    return groupedByApplication.reduce((sum, item) => {
      if (isGroupedScheduleEvent(item)) {
        return sum + item.dateRange.totalDays;
      }
      return sum + 1;
    }, 0);
  }, [groupedByApplication]);

  // 뷰 토글 핸들러
  const handleToggleView = useCallback(() => {
    setViewMode((prev) => (prev === 'list' ? 'calendar' : 'list'));
  }, []);

  // 지원 취소 핸들러 (applied 상태)
  const handleCancelApplication = useCallback(
    (applicationId: string) => {
      // 파괴적 액션 — 경고 햅틱으로 주의 환기 (impeccable §17 삭제 경계).
      void triggerHaptic('warning');
      Alert.alert('지원 취소', '지원을 취소하면 이 스케줄이 목록에서 사라져요.', [
        { text: '계속 유지', style: 'cancel' },
        {
          text: '지원 취소',
          style: 'destructive',
          onPress: () => {
            cancelApplication(applicationId);
            // 목록 새로고침 (캐시 무효화로 자동 처리됨)
            refresh();
          },
        },
      ]);
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

  // 알림 딥링크 → 자동 액션 (한 번만 실행)
  // - applicationId: 해당 스케줄 상세 모달 자동 오픈
  // - cancelApplicationId: 취소 요청 바텀시트 자동 오픈 (cancel.tsx 호환성)
  const [didHandleSearchParam, setDidHandleSearchParam] = useState(false);
  useEffect(() => {
    if (didHandleSearchParam) return;

    const targetApplicationId = searchParams.applicationId;
    const targetCancelApplicationId = searchParams.cancelApplicationId;

    if (!targetApplicationId && !targetCancelApplicationId) return;

    if (targetCancelApplicationId) {
      setDidHandleSearchParam(true);
      void handleRequestCancellation(targetCancelApplicationId);
      return;
    }

    if (targetApplicationId && schedules.length > 0) {
      const targetSchedule = schedules.find((s) => s.applicationId === targetApplicationId);
      if (targetSchedule) {
        setDidHandleSearchParam(true);
        setSelectedSchedule(targetSchedule);
        setIsDetailSheetVisible(true);
      }
    }
  }, [
    didHandleSearchParam,
    handleRequestCancellation,
    schedules,
    searchParams.applicationId,
    searchParams.cancelApplicationId,
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
    }, 300);
  }, []);

  // 그룹 모드에서 날짜 변경 핸들러 (모달 내 이전/다음 버튼)
  const handleModalDateChange = useCallback((_date: string, schedule: ScheduleEvent) => {
    setSelectedSchedule(schedule);
  }, []);

  // QR 스캔 핸들러
  const handleQRScan = useCallback(() => {
    // 현재 근무 상태에 따라 액션 결정
    const action: QRCodeAction = isWorking ? 'checkOut' : 'checkIn';
    setQRScanAction(action);
    setIsQRScannerVisible(true);
  }, [isWorking]);

  // QR 스캔 결과 처리 훅
  const { handleScanResult, lastError, clearError } = useQRCodeScanner({
    onSuccess: () => {
      // 출퇴근 체크 완료 — 결정적 순간이므로 Success 햅틱 (impeccable §17).
      void triggerHaptic('success');
      setIsQRScannerVisible(false);
      handleCloseDetailSheet();
    },
  });

  // QR 스캐너 닫기
  const handleCloseQRScanner = useCallback(() => {
    setIsQRScannerVisible(false);
    clearError();
  }, [clearError]);

  // QR 스캔 완료
  const handleQRScanComplete = useCallback(
    (result: QRCodeScanResult) => {
      handleScanResult(result);
    },
    [handleScanResult]
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
      <SafeAreaView className="flex-1 bg-surface-page" edges={['top']}>
        <TabHeader title="내 스케줄" />
        <View className="flex-1 justify-center items-center p-4">
          <ErrorState
            title="스케줄을 불러오지 못했어요"
            message={`${error.message}\n인터넷 연결을 확인하고 다시 시도해주세요.`}
            onRetry={refresh}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface-page" edges={['top']}>
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

      {/* 미작성 평가 배너 */}
      {pendingCount > 0 && (
        <View className="mt-2">
          <ReviewPromptBanner
            pendingCount={pendingCount}
            onPress={() => router.push('/(app)/reviews/pending')}
          />
        </View>
      )}

      {/* 캘린더 뷰 */}
      {viewMode === 'calendar' && (
        <ScrollView
          className="flex-1"
          contentContainerClassName="pb-20"
          // impeccable §24 — 선택 날짜 헤더를 sticky로: 스크롤해도 현재 컨텍스트 유지.
          // 선택 날짜 스케줄이 있을 때만 sticky 활성 (index 1 = 헤더).
          stickyHeaderIndices={selectedDateSchedules.length > 0 ? [1] : undefined}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={refresh} {...PTR_REFRESH_PROPS} />
          }
        >
          {/* 0: 캘린더 — MonthNavigator border-b 바로 아래 붙임 */}
          <View>
            <CalendarView
              schedules={schedules}
              selectedDate={selectedDate}
              currentMonth={currentMonth}
              onDateSelect={handleDateSelect}
              onMonthChange={handleMonthChange}
            />
          </View>

          {selectedDateSchedules.length > 0 && (
            <>
              {/* 1: sticky 헤더 — 배경 solid로 아래 콘텐츠 가림 */}
              <View className="bg-surface-page px-4 pt-3 pb-2 border-b border-divider">
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
                      onCancelApplication={handleCancelApplication}
                      onRequestCancellation={handleRequestCancellation}
                    />
                  );
                })}
              </View>
            </>
          )}
        </ScrollView>
      )}

      {/* 리스트 뷰 (그룹화 적용) */}
      {viewMode === 'list' && (
        <ScrollView
          className="flex-1"
          contentContainerClassName="pb-20"
          // impeccable §24 — 월 스케줄 요약 헤더를 sticky로: 카드 실제 렌더 시에만 활성.
          stickyHeaderIndices={!isLoading && groupedByApplication.length > 0 ? [0] : undefined}
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
                onAction={() => router.push('/(app)/(tabs)')}
                variant="content"
              />
            </View>
          ) : (
            <>
              {/* 0: sticky 헤더 — MonthNavigator 아래 바로 붙음 (pt-3로 최소 호흡) */}
              <View className="bg-surface-page px-4 pt-3 pb-2 border-b border-divider">
                <Text className="text-sm text-secondary-500 dark:text-secondary-400 font-sans">
                  {currentMonth.month}월 스케줄 ({groupedByApplication.length}건, {totalDays}일)
                </Text>
              </View>
              {/* 1: 카드 리스트 */}
              <View className="px-4 pt-3">
                {groupedByApplication.map((item) => {
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
                      onCancelApplication={handleCancelApplication}
                      onRequestCancellation={handleRequestCancellation}
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
        groupedSchedule={selectedGroupedSchedule}
        onDateChange={handleModalDateChange}
        onRefreshSchedule={refresh}
      />

      {/* 스태프 정산 튜토리얼 */}

      {/* QR 스캐너 */}
      <QRCodeScanner
        visible={isQRScannerVisible}
        onClose={handleCloseQRScanner}
        onScan={handleQRScanComplete}
        expectedAction={qrScanAction}
        title={`${qrScanAction === 'checkIn' ? '출근' : '퇴근'} QR 스캔`}
        scanError={lastError}
        onClearError={clearError}
      />
    </SafeAreaView>
  );
}
