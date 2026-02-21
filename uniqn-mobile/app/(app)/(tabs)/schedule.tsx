/**
 * UNIQN Mobile - Schedule Screen
 * 내 스케줄 화면
 */

import { useState, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, RefreshControl, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, EmptyState, ErrorState, Skeleton, SkeletonScheduleCard } from '@/components/ui';
import CalendarView from '@/components/schedule/CalendarView';
import { ScheduleCard, ScheduleDetailModal, GroupedScheduleCard } from '@/components/schedule';
import { QRCodeScanner } from '@/components/qr';
import { TabHeader } from '@/components/headers';
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon, MenuIcon } from '@/components/icons';
import { router } from 'expo-router';
import { useCalendarView, useQRCodeScanner, useCurrentWorkStatus, useApplications } from '@/hooks';
import { useThemeStore } from '@/stores/themeStore';
import { getLayoutColor } from '@/constants/colors';
import { formatCurrency } from '@/utils/formatters';
import type { ScheduleEvent, GroupedScheduleEvent, QRCodeScanResult, QRCodeAction } from '@/types';
import { isGroupedScheduleEvent } from '@/types';

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

/**
 * 스케줄 아이템 컴포넌트
 * - 상태별로 다른 정보를 표시하는 ScheduleCard 사용
 * - 클릭 시 3탭 모달 오픈
 */
interface ScheduleItemProps {
  schedule: ScheduleEvent;
  onPress: () => void;
}

function ScheduleItem({ schedule, onPress }: ScheduleItemProps) {
  return <ScheduleCard schedule={schedule} onPress={onPress} />;
}

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
    <View className="flex-row items-center justify-between bg-white dark:bg-surface px-4 py-3 border-b border-gray-200 dark:border-surface-overlay">
      <Pressable
        onPress={onPrev}
        className="p-2 rounded-full active:bg-gray-100 dark:active:bg-gray-700"
        accessibilityLabel="이전 달"
        accessibilityRole="button"
      >
        <ChevronLeftIcon size={24} color="#6B7280" />
      </Pressable>

      <Pressable
        onPress={onToday}
        className="px-4"
        accessibilityLabel="오늘로 이동"
        accessibilityRole="button"
      >
        <Text className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {formatMonthTitle(year, month)}
        </Text>
      </Pressable>

      <View className="flex-row items-center">
        <Pressable
          onPress={onToggleView}
          className="p-2 rounded-full active:bg-gray-100 dark:active:bg-gray-700 mr-1"
          accessibilityLabel={viewMode === 'list' ? '캘린더 보기' : '목록 보기'}
          accessibilityRole="button"
        >
          {viewMode === 'list' ? (
            <CalendarIcon size={22} color="#6B7280" />
          ) : (
            <MenuIcon size={22} color="#6B7280" />
          )}
        </Pressable>
        <Pressable
          onPress={onNext}
          className="p-2 rounded-full active:bg-gray-100 dark:active:bg-gray-700"
          accessibilityLabel="다음 달"
          accessibilityRole="button"
        >
          <ChevronRightIcon size={24} color="#6B7280" />
        </Pressable>
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
              <Skeleton width={50} height={16} />
              <Skeleton width={40} height={24} className="mt-1" />
            </View>
          ))}
        </View>
        {/* 구분선 */}
        <View className="h-px bg-gray-200 dark:bg-surface my-3" />
        {/* 2행: 수익 스켈레톤 */}
        <View className="flex-row justify-between items-center px-2">
          <Skeleton width={40} height={16} />
          <Skeleton width={120} height={24} />
        </View>
      </Card>
    );
  }

  if (!stats) return null;

  return (
    <Card className="mx-4 mt-4">
      {/* 1행: 지원/확정/완료 */}
      <View className="flex-row justify-around">
        {/* 지원 (applied) */}
        <View className="items-center">
          <Text className="text-xs text-gray-500 dark:text-gray-400">지원</Text>
          <Text className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
            {stats.upcomingSchedules}
          </Text>
        </View>
        <View className="h-8 w-px bg-gray-200 dark:bg-surface" />
        {/* 확정 (confirmed) */}
        <View className="items-center">
          <Text className="text-xs text-gray-500 dark:text-gray-400">확정</Text>
          <Text className="text-2xl font-bold text-green-600 dark:text-green-400">
            {stats.confirmedSchedules}
          </Text>
        </View>
        <View className="h-8 w-px bg-gray-200 dark:bg-surface" />
        {/* 완료 (completed) */}
        <View className="items-center">
          <Text className="text-xs text-gray-500 dark:text-gray-400">완료</Text>
          <Text className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {stats.completedSchedules}
          </Text>
        </View>
      </View>
      {/* 구분선 */}
      <View className="h-px bg-gray-200 dark:bg-surface my-3" />
      {/* 2행: 수익 */}
      <View className="flex-row justify-between items-center px-2">
        <Text className="text-sm text-gray-500 dark:text-gray-400">수익</Text>
        <Text className="text-xl font-bold text-primary-600 dark:text-primary-400">
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
  const isDark = useThemeStore((s) => s.isDarkMode);

  // 뷰 모드 상태 (list | calendar) - 캘린더가 기본
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('calendar');

  // 스케줄 상세 시트 상태
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleEvent | null>(null);
  // 그룹 모달 지원을 위해 유지
  const [selectedGroupedSchedule, setSelectedGroupedSchedule] =
    useState<GroupedScheduleEvent | null>(null);
  const [isDetailSheetVisible, setIsDetailSheetVisible] = useState(false);

  // QR 스캐너 상태
  const [isQRScannerVisible, setIsQRScannerVisible] = useState(false);
  const [qrScanAction, setQRScanAction] = useState<QRCodeAction | undefined>();

  // 현재 근무 상태
  const { isWorking } = useCurrentWorkStatus();

  // 지원 취소 훅
  const { cancelApplication } = useApplications();

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
  } = useCalendarView({ enableGrouping: true });

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
      Alert.alert('지원 취소', '정말 취소하시겠습니까?', [
        { text: '아니오', style: 'cancel' },
        {
          text: '예, 취소합니다',
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

  // 취소 요청 핸들러 (confirmed 상태)
  const handleRequestCancellation = useCallback((applicationId: string) => {
    router.push(`/(app)/applications/${applicationId}/cancel`);
  }, []);

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
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-surface-dark" edges={['top']}>
        <TabHeader title="내 스케줄" />
        <View className="flex-1 justify-center items-center p-4">
          <ErrorState
            title="스케줄을 불러올 수 없습니다"
            message={error.message}
            onRetry={refresh}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-surface-dark" edges={['top']}>
      {/* 헤더 */}
      <TabHeader title="내 스케줄" />

      {/* 월 네비게이터 */}
      <MonthNavigator
        year={currentMonth.year}
        month={currentMonth.month}
        viewMode={viewMode}
        onPrev={goToPrevMonth}
        onNext={goToNextMonth}
        onToday={goToToday}
        onToggleView={handleToggleView}
      />

      {/* 통계 카드 */}
      <StatsCard stats={stats} isLoading={isLoading} />

      {/* 캘린더 뷰 */}
      {viewMode === 'calendar' && (
        <ScrollView
          className="flex-1"
          contentContainerClassName="pb-20"
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={refresh}
              tintColor={getLayoutColor(isDark, 'refreshTint')}
            />
          }
        >
          <View className="mt-4">
            <CalendarView
              schedules={schedules}
              selectedDate={selectedDate}
              currentMonth={currentMonth}
              onDateSelect={handleDateSelect}
              onMonthChange={handleMonthChange}
            />

            {/* 선택된 날짜의 스케줄 (그룹화 적용) */}
            {selectedDateSchedules.length > 0 && (
              <View className="mt-4 px-4">
                <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {selectedDate} 스케줄 ({selectedDateSchedules.length}건)
                </Text>
                {selectedDateSchedules.map((item) => {
                  if (isGroupedScheduleEvent(item)) {
                    // 그룹화된 스케줄: GroupedScheduleCard 사용
                    return (
                      <GroupedScheduleCard
                        key={item.id}
                        group={item}
                        onPress={() => handleOpenGroupedDetailSheet(item)}
                        onDatePress={(date, eventId) => handleGroupDatePress(date, eventId, item)}
                      />
                    );
                  }
                  // 단일 스케줄: ScheduleCard 사용
                  return (
                    <ScheduleItem
                      key={item.id}
                      schedule={item}
                      onPress={() => handleOpenDetailSheet(item)}
                    />
                  );
                })}
              </View>
            )}
          </View>
        </ScrollView>
      )}

      {/* 리스트 뷰 (그룹화 적용) */}
      {viewMode === 'list' && (
        <ScrollView
          className="flex-1"
          contentContainerClassName="p-4 pb-20"
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={refresh}
              tintColor={getLayoutColor(isDark, 'refreshTint')}
            />
          }
        >
          {isLoading && schedules.length === 0 ? (
            // 스켈레톤 로딩 (SkeletonScheduleCard 사용)
            <View>
              {[1, 2, 3].map((i) => (
                <SkeletonScheduleCard key={i} />
              ))}
            </View>
          ) : groupedByApplication.length === 0 ? (
            <EmptyState
              title="스케줄이 없습니다"
              description={`${currentMonth.year}년 ${currentMonth.month}월에 예정된 스케줄이 없습니다.\n공고에 지원하면 스케줄이 여기에 표시됩니다.`}
              variant="content"
            />
          ) : (
            // 지원(applicationId)별 그룹화된 스케줄
            <View>
              <Text className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                {currentMonth.month}월 스케줄 ({groupedByApplication.length}건, {totalDays}일)
              </Text>
              {groupedByApplication.map((item) => {
                if (isGroupedScheduleEvent(item)) {
                  // 그룹화된 스케줄: GroupedScheduleCard 사용
                  return (
                    <GroupedScheduleCard
                      key={item.id}
                      group={item}
                      onPress={() => handleOpenGroupedDetailSheet(item)}
                      onDatePress={(date, eventId) => handleGroupDatePress(date, eventId, item)}
                    />
                  );
                }
                // 단일 스케줄: ScheduleCard 사용
                return (
                  <ScheduleItem
                    key={item.id}
                    schedule={item}
                    onPress={() => handleOpenDetailSheet(item)}
                  />
                );
              })}
            </View>
          )}
        </ScrollView>
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
