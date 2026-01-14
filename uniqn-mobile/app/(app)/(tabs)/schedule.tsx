/**
 * UNIQN Mobile - Schedule Screen
 * 내 스케줄 화면
 */

import { useState, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Badge, EmptyState, ErrorState, Skeleton } from '@/components/ui';
import { CalendarView, ScheduleDetailSheet } from '@/components/schedule';
import { JobCard, type ApplicationStatusType } from '@/components/jobs';
import { QRCodeScanner } from '@/components/qr';
import {
  CalendarIcon,
  ClockIcon,
  MapIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MenuIcon,
  QrCodeIcon,
  BellIcon,
} from '@/components/icons';
import { router } from 'expo-router';
import { useCalendarView, useQRCodeScanner, useCurrentWorkStatus, useUnreadCountRealtime } from '@/hooks';
import { Timestamp } from 'firebase/firestore';
import type { ScheduleEvent, ScheduleType, AttendanceStatus, QRCodeScanResult, QRCodeAction } from '@/types';

// ============================================================================
// Constants
// ============================================================================

const statusConfig: Record<ScheduleType, { label: string; variant: 'warning' | 'success' | 'default' | 'error' }> = {
  applied: { label: '지원 중', variant: 'warning' },
  confirmed: { label: '확정', variant: 'success' },
  completed: { label: '완료', variant: 'default' },
  cancelled: { label: '취소', variant: 'error' },
};

const attendanceConfig: Record<AttendanceStatus, { label: string; color: string }> = {
  not_started: { label: '출근 전', color: 'text-gray-500' },
  checked_in: { label: '근무 중', color: 'text-green-600' },
  checked_out: { label: '퇴근 완료', color: 'text-blue-600' },
};

// ============================================================================
// Helper Functions
// ============================================================================

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ko-KR').format(amount) + '원';
}

function formatTime(timestamp: Timestamp | null): string {
  if (!timestamp) return '--:--';
  const date = timestamp.toDate();
  return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatTimeRange(start: Timestamp | null, end: Timestamp | null): string {
  return `${formatTime(start)} - ${formatTime(end)}`;
}

function formatMonthTitle(year: number, month: number): string {
  return `${year}년 ${month}월`;
}

// ============================================================================
// Sub Components
// ============================================================================

interface ScheduleCardProps {
  schedule: ScheduleEvent;
  onPress?: () => void;
}

function ScheduleCard({ schedule, onPress }: ScheduleCardProps) {
  const status = statusConfig[schedule.type];
  const attendance = attendanceConfig[schedule.status];

  return (
    <Pressable onPress={onPress}>
      <Card className="mb-3">
        <View className="flex-row items-start justify-between">
          <View className="flex-1">
            {/* 상태 배지 + 제목 */}
            <View className="flex-row items-center flex-wrap">
              <Badge variant={status.variant} dot>
                {status.label}
              </Badge>
              {schedule.type === 'confirmed' && (
                <Text className={`ml-2 text-xs ${attendance.color}`}>
                  ({attendance.label})
                </Text>
              )}
            </View>

            <Text className="mt-2 font-medium text-gray-900 dark:text-gray-100" numberOfLines={1}>
              {schedule.eventName}
            </Text>

            {/* 날짜/시간 */}
            <View className="mt-2 flex-row items-center">
              <CalendarIcon size={14} color="#6B7280" />
              <Text className="ml-1.5 text-sm text-gray-600 dark:text-gray-400">
                {schedule.date}
              </Text>
              <View className="mx-2 h-3 w-px bg-gray-300 dark:bg-gray-600" />
              <ClockIcon size={14} color="#6B7280" />
              <Text className="ml-1.5 text-sm text-gray-600 dark:text-gray-400">
                {formatTimeRange(schedule.startTime, schedule.endTime)}
              </Text>
            </View>

            {/* 위치 */}
            {schedule.location && (
              <View className="mt-1.5 flex-row items-center">
                <MapIcon size={14} color="#6B7280" />
                <Text className="ml-1.5 text-sm text-gray-500 dark:text-gray-400" numberOfLines={1}>
                  {schedule.location}
                </Text>
              </View>
            )}

            {/* 역할 */}
            <View className="mt-2">
              <Text className="text-xs text-gray-500 dark:text-gray-400">
                역할: {schedule.role}
              </Text>
            </View>
          </View>

          {/* 급여 */}
          {schedule.payrollAmount && schedule.payrollAmount > 0 && (
            <Text className="font-semibold text-primary-600 dark:text-primary-400">
              {formatCurrency(schedule.payrollAmount)}
            </Text>
          )}
        </View>
      </Card>
    </Pressable>
  );
}

/**
 * 스케줄 아이템 컴포넌트
 * - jobPostingCard가 있으면 JobCard 사용 (Applications 데이터)
 * - 없으면 기존 ScheduleCard 사용 (WorkLogs 폴백)
 */
interface ScheduleItemProps {
  schedule: ScheduleEvent;
  onFallbackPress: () => void;
}

function ScheduleItem({ schedule, onFallbackPress }: ScheduleItemProps) {
  // jobPostingCard가 있으면 JobCard 사용
  if (schedule.jobPostingCard) {
    return (
      <JobCard
        job={schedule.jobPostingCard}
        onPress={() => {
          // 공고 상세 페이지로 이동
          router.push(`/(app)/jobs/${schedule.eventId}`);
        }}
        applicationStatus={schedule.type as ApplicationStatusType}
      />
    );
  }

  // 폴백: 기존 ScheduleCard (workLogs 등)
  return <ScheduleCard schedule={schedule} onPress={onFallbackPress} />;
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
    <View className="flex-row items-center justify-between bg-white dark:bg-gray-800 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
      <Pressable
        onPress={onPrev}
        className="p-2 rounded-full active:bg-gray-100 dark:active:bg-gray-700"
        accessibilityLabel="이전 달"
      >
        <ChevronLeftIcon size={24} color="#6B7280" />
      </Pressable>

      <Pressable onPress={onToday} className="px-4">
        <Text className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {formatMonthTitle(year, month)}
        </Text>
      </Pressable>

      <View className="flex-row items-center">
        <Pressable
          onPress={onToggleView}
          className="p-2 rounded-full active:bg-gray-100 dark:active:bg-gray-700 mr-1"
          accessibilityLabel={viewMode === 'list' ? '캘린더 보기' : '목록 보기'}
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
        >
          <ChevronRightIcon size={24} color="#6B7280" />
        </Pressable>
      </View>
    </View>
  );
}

interface StatsCardProps {
  stats: {
    upcomingSchedules: number;
    completedSchedules: number;
    thisMonthEarnings: number;
  } | undefined;
  isLoading: boolean;
}

function StatsCard({ stats, isLoading }: StatsCardProps) {
  if (isLoading) {
    return (
      <Card className="mx-4 mt-4">
        <View className="flex-row justify-around">
          {[1, 2, 3].map((i) => (
            <View key={i} className="items-center">
              <Skeleton width={40} height={24} />
              <Skeleton width={60} height={16} className="mt-1" />
            </View>
          ))}
        </View>
      </Card>
    );
  }

  if (!stats) return null;

  return (
    <Card className="mx-4 mt-4">
      <View className="flex-row justify-around">
        <View className="items-center">
          <Text className="text-2xl font-bold text-primary-600 dark:text-primary-400">
            {stats.upcomingSchedules}
          </Text>
          <Text className="text-xs text-gray-500 dark:text-gray-400">예정</Text>
        </View>
        <View className="h-8 w-px bg-gray-200 dark:bg-gray-700" />
        <View className="items-center">
          <Text className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {stats.completedSchedules}
          </Text>
          <Text className="text-xs text-gray-500 dark:text-gray-400">완료</Text>
        </View>
        <View className="h-8 w-px bg-gray-200 dark:bg-gray-700" />
        <View className="items-center">
          <Text className="text-2xl font-bold text-green-600 dark:text-green-400">
            {formatCurrency(stats.thisMonthEarnings).replace('원', '')}
          </Text>
          <Text className="text-xs text-gray-500 dark:text-gray-400">이번달 수익</Text>
        </View>
      </View>
    </Card>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function ScheduleScreen() {
  // 뷰 모드 상태 (list | calendar)
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');

  // 읽지 않은 알림 수 (실시간)
  const unreadCount = useUnreadCountRealtime();

  // 스케줄 상세 시트 상태
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleEvent | null>(null);
  const [isDetailSheetVisible, setIsDetailSheetVisible] = useState(false);

  // QR 스캐너 상태
  const [isQRScannerVisible, setIsQRScannerVisible] = useState(false);
  const [qrScanAction, setQRScanAction] = useState<QRCodeAction | undefined>();

  // 현재 근무 상태
  const { isWorking } = useCurrentWorkStatus();

  const {
    schedules,
    groupedSchedules,
    selectedDateSchedules,
    stats,
    currentMonth,
    selectedDate,
    isLoading,
    error,
    setSelectedDate,
    goToPrevMonth,
    goToNextMonth,
    goToMonth,
    goToToday,
    refresh,
  } = useCalendarView();

  // 뷰 토글 핸들러
  const handleToggleView = useCallback(() => {
    setViewMode((prev) => (prev === 'list' ? 'calendar' : 'list'));
  }, []);

  // 스케줄 상세 시트 열기
  const handleOpenDetailSheet = useCallback((schedule: ScheduleEvent) => {
    setSelectedSchedule(schedule);
    setIsDetailSheetVisible(true);
  }, []);

  // 스케줄 상세 시트 닫기
  const handleCloseDetailSheet = useCallback(() => {
    setIsDetailSheetVisible(false);
    // 닫힌 후 선택된 스케줄 초기화 (애니메이션 완료 후)
    setTimeout(() => setSelectedSchedule(null), 300);
  }, []);

  // QR 스캔 핸들러
  const handleQRScan = useCallback(() => {
    // 현재 근무 상태에 따라 액션 결정
    const action: QRCodeAction = isWorking ? 'checkOut' : 'checkIn';
    setQRScanAction(action);
    setIsQRScannerVisible(true);
  }, [isWorking]);

  // QR 스캐너 닫기
  const handleCloseQRScanner = useCallback(() => {
    setIsQRScannerVisible(false);
  }, []);

  // QR 스캔 결과 처리 훅
  const { handleScanResult } = useQRCodeScanner({
    onSuccess: () => {
      setIsQRScannerVisible(false);
      handleCloseDetailSheet();
    },
  });

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
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900" edges={['top']}>
        <View className="flex-row items-center justify-between bg-white px-4 py-3 dark:bg-gray-800">
          <Text className="text-xl font-bold text-gray-900 dark:text-gray-100">내 스케줄</Text>
          <View className="flex-row items-center gap-2">
            <Pressable
              onPress={() => router.push('/(app)/(tabs)/qr')}
              className="p-2"
              hitSlop={8}
            >
              <QrCodeIcon size={24} color="#6B7280" />
            </Pressable>
            <Pressable
              onPress={() => router.push('/(app)/notifications')}
              className="p-2"
              hitSlop={8}
            >
              <BellIcon size={24} color="#6B7280" />
              {unreadCount > 0 && (
                <View className="absolute -right-1 -top-1 min-w-[18px] items-center justify-center rounded-full bg-error-500 px-1">
                  <Text className="text-[10px] font-bold text-white">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Text>
                </View>
              )}
            </Pressable>
          </View>
        </View>
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
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900" edges={['top']}>
      {/* 헤더 */}
      <View className="flex-row items-center justify-between bg-white px-4 py-3 dark:bg-gray-800">
        <Text className="text-xl font-bold text-gray-900 dark:text-gray-100">내 스케줄</Text>
        <View className="flex-row items-center gap-2">
          <Pressable
            onPress={() => router.push('/(app)/(tabs)/qr')}
            className="p-2"
            hitSlop={8}
          >
            <QrCodeIcon size={24} color="#6B7280" />
          </Pressable>
          <Pressable
            onPress={() => router.push('/(app)/notifications')}
            className="p-2"
            hitSlop={8}
          >
            <BellIcon size={24} color="#6B7280" />
            {unreadCount > 0 && (
              <View className="absolute -right-1 -top-1 min-w-[18px] items-center justify-center rounded-full bg-error-500 px-1">
                <Text className="text-[10px] font-bold text-white">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>

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
        <View className="mt-4">
          <CalendarView
            schedules={schedules}
            selectedDate={selectedDate}
            currentMonth={currentMonth}
            onDateSelect={handleDateSelect}
            onMonthChange={handleMonthChange}
          />

          {/* 선택된 날짜의 스케줄 */}
          {selectedDateSchedules.length > 0 && (
            <View className="mt-4 px-4">
              <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {selectedDate} 스케줄 ({selectedDateSchedules.length}건)
              </Text>
              {selectedDateSchedules.map((schedule) => (
                <ScheduleItem
                  key={schedule.id}
                  schedule={schedule}
                  onFallbackPress={() => handleOpenDetailSheet(schedule)}
                />
              ))}
            </View>
          )}
        </View>
      )}

      {/* 리스트 뷰 */}
      {viewMode === 'list' && (
        <ScrollView
          className="flex-1"
          contentContainerClassName="p-4 pb-20"
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={refresh} />
          }
        >
          {isLoading && schedules.length === 0 ? (
            // 스켈레톤 로딩
            <View>
              {[1, 2, 3].map((i) => (
                <Card key={i} className="mb-3">
                  <View className="flex-row items-start justify-between">
                    <View className="flex-1">
                      <Skeleton width={60} height={20} borderRadius={10} />
                      <Skeleton width="70%" height={18} className="mt-2" />
                      <Skeleton width="50%" height={14} className="mt-2" />
                      <Skeleton width="40%" height={14} className="mt-1" />
                    </View>
                    <Skeleton width={80} height={18} />
                  </View>
                </Card>
              ))}
            </View>
          ) : schedules.length === 0 ? (
            <EmptyState
              title="스케줄이 없습니다"
              description={`${currentMonth.year}년 ${currentMonth.month}월에 예정된 스케줄이 없습니다.\n공고에 지원하면 스케줄이 여기에 표시됩니다.`}
              variant="content"
            />
          ) : (
            // 날짜별 그룹화된 스케줄
            groupedSchedules.map((group) => (
              <View key={group.date} className="mb-4">
                {/* 날짜 헤더 */}
                <View className="flex-row items-center mb-2">
                  <Text
                    className={`text-sm font-medium ${
                      group.isToday
                        ? 'text-primary-600 dark:text-primary-400'
                        : group.isPast
                          ? 'text-gray-400 dark:text-gray-500'
                          : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {group.isToday ? '오늘 • ' : ''}
                    {group.formattedDate}
                  </Text>
                  {group.isToday && (
                    <View className="ml-2 px-2 py-0.5 bg-primary-100 dark:bg-primary-900/30 rounded-full">
                      <Text className="text-xs text-primary-600 dark:text-primary-400">TODAY</Text>
                    </View>
                  )}
                </View>

                {/* 해당 날짜의 스케줄들 */}
                {group.events.map((schedule) => (
                  <ScheduleItem
                    key={schedule.id}
                    schedule={schedule}
                    onFallbackPress={() => handleOpenDetailSheet(schedule)}
                  />
                ))}
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* 스케줄 상세 시트 */}
      <ScheduleDetailSheet
        schedule={selectedSchedule}
        visible={isDetailSheetVisible}
        onClose={handleCloseDetailSheet}
        onQRScan={handleQRScan}
      />

      {/* QR 스캐너 */}
      <QRCodeScanner
        visible={isQRScannerVisible}
        onClose={handleCloseQRScanner}
        onScan={handleQRScanComplete}
        expectedAction={qrScanAction}
        title={`${qrScanAction === 'checkIn' ? '출근' : '퇴근'} QR 스캔`}
      />
    </SafeAreaView>
  );
}
