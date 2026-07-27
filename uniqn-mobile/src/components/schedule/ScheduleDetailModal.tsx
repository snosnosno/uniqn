/**
 * UNIQN Mobile - ScheduleDetailModal 컴포넌트
 *
 * @description 스케줄 상세 정보를 3탭(정보/근무/정산)으로 표시하는 모달
 *   + 구직자 → 구인자 신고 기능
 *   + 그룹화된 스케줄 지원 (다중 날짜 전환)
 * @version 1.2.0
 */

import { getLayoutColor, SECONDARY_PALETTE } from '@/constants/colors';
import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Modal, Badge, Button } from '@/components/ui';
import {
  XMarkIcon,
  DocumentIcon,
  ClockIcon,
  BanknotesIcon,
  AlertTriangleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CalendarIcon,
} from '@/components/icons';
import { InfoTab, WorkTab, SettlementTab } from './tabs';
import type { OwnerReportRequest } from './useOwnerReport';
import { useModal } from '@/stores/modalStore';
import { useThemeStore } from '@/stores/themeStore';
import { formatSingleDate, formatDateDisplay } from '@/utils/scheduleGrouping';
import { STATUS } from '@/constants';
import { SHEET_DISMISS_ANIMATION_MS } from '@/constants/animation';
import { SCHEDULE_STATUS } from '@/constants/statusConfig';
import { APPLICATION_STATUS_LABELS } from '@/shared/status';
import type { ScheduleEvent, GroupedScheduleEvent, ScheduleType } from '@/types';

// ============================================================================
// Types
// ============================================================================

export interface ScheduleDetailModalProps {
  schedule: ScheduleEvent | null;
  visible: boolean;
  onClose: () => void;
  onQRScan?: () => void;
  /** 지원 취소 콜백 (지원중 상태에서만 사용) */
  onCancelApplication?: (applicationId: string) => void;
  /** 취소 요청 콜백 (확정 상태에서 사용) */
  onRequestCancellation?: (applicationId: string) => void;
  /**
   * 구인자 신고 요청 콜백. 시트를 닫은 뒤 상위(schedule.tsx)에서 ReportModal 을 연다.
   * ReportModal 이 시트 children 이면 시트가 닫힐 때 언마운트되어 iOS 중첩 Modal 터치 먹통을 못 피한다.
   */
  onReport?: (request: OwnerReportRequest) => void;
  /** 그룹화된 스케줄 (다중 날짜 전환 지원) */
  groupedSchedule?: GroupedScheduleEvent | null;
  /** 그룹 내 날짜 변경 콜백 */
  onDateChange?: (date: string, schedule: ScheduleEvent) => void;
  /** 스케줄 데이터 리페치 콜백 (탭 간 동기화용) */
  onRefreshSchedule?: () => void;
  /** 이 근무의 평가가 아직 미작성이면 해당 workLogId. 없으면 CTA 를 띄우지 않는다. */
  pendingReviewWorkLogId?: string;
  /** 평가 작성 화면으로 이동 */
  onWriteReview?: (workLogId: string) => void;
}

type TabId = 'info' | 'work' | 'settlement';

interface TabConfig {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

// ============================================================================
// Constants
// ============================================================================

// SCHEDULE_STATUS: '@/constants/statusConfig'에서 import

/** 중복 리페치 방지를 위한 쿨다운 (3초) */
const REFETCH_COOLDOWN_MS = 3000;

const ALL_TABS: TabConfig[] = [
  { id: 'info', label: '정보', icon: <DocumentIcon size={16} /> },
  { id: 'work', label: '근무', icon: <ClockIcon size={16} /> },
  { id: 'settlement', label: '정산', icon: <BanknotesIcon size={16} /> },
];

/**
 * 상태별로 실제 내용이 있는 탭.
 *
 * 예전엔 3탭 고정이라 지원 중인 건에서도 근무·정산 탭이 열리고 안내문만 있었다 —
 * 헛탭 두 번. 전수 테이블로 두면 상태를 하나 늘릴 때 tsc 가 누락을 잡는다.
 */
const TAB_VISIBILITY: Record<ScheduleType, TabId[]> = {
  applied: ['info'],
  confirmed: ['info', 'work'],
  completed: ['info', 'work', 'settlement'],
  cancelled: ['info'],
  // 노쇼는 세 탭이 각자 다른 것을 말한다 — 정보=기록 고지, 근무=구인자가 남긴 사유와
  // 이의 제기 경로, 정산=확정 0원 여부. 어느 하나도 다른 탭이 대신하지 못한다.
  no_show: ['info', 'work', 'settlement'],
};

// ============================================================================
// Component
// ============================================================================

export function ScheduleDetailModal({
  schedule,
  visible,
  onClose,
  onQRScan,
  onCancelApplication,
  onRequestCancellation,
  onReport,
  groupedSchedule,
  onDateChange,
  onRefreshSchedule,
  pendingReviewWorkLogId,
  onWriteReview,
}: ScheduleDetailModalProps) {
  const [activeTab, setActiveTab] = useState<TabId>('info');
  const isDarkMode = useThemeStore((state) => state.isDarkMode);

  const modal = useModal();

  // 중복 리페치 방지를 위한 마지막 리페치 시간
  const lastRefetchTimeRef = useRef<number>(0);

  // 그룹 모드 관련 상태
  const isGroupMode = !!groupedSchedule && groupedSchedule.dateRange.totalDays > 1;

  // 현재 날짜 인덱스 (그룹 모드)
  const currentDateIndex = useMemo(() => {
    if (!isGroupMode || !schedule) return 0;
    const index = groupedSchedule.dateRange.dates.indexOf(schedule.date);
    return index >= 0 ? index : 0;
  }, [isGroupMode, groupedSchedule, schedule]);

  // 날짜 이동 (이전/다음 통합)
  const handleDateChange = useCallback(
    (direction: 'prev' | 'next') => {
      if (!isGroupMode || !groupedSchedule) return;
      const totalDates = groupedSchedule.dateRange.dates.length;
      const targetIndex = direction === 'prev' ? currentDateIndex - 1 : currentDateIndex + 1;
      if (targetIndex < 0 || targetIndex >= totalDates) return;

      const targetDate = groupedSchedule.dateRange.dates[targetIndex];
      const targetSchedule = groupedSchedule.originalEvents.find((e) => e.date === targetDate);
      if (targetSchedule && onDateChange) {
        onDateChange(targetDate, targetSchedule);
      }
    },
    [isGroupMode, currentDateIndex, groupedSchedule, onDateChange]
  );

  // 쿨다운을 적용한 리페치 함수
  const triggerRefresh = useCallback(() => {
    if (!onRefreshSchedule) return;

    const now = Date.now();
    if (now - lastRefetchTimeRef.current >= REFETCH_COOLDOWN_MS) {
      lastRefetchTimeRef.current = now;
      onRefreshSchedule();
    }
  }, [onRefreshSchedule]);

  // 모달 열릴 때 첫 번째 탭으로 리셋 + 데이터 리프레시
  useEffect(() => {
    if (visible) {
      // 탭을 'info' 로 되돌리지 않는다 — QR 출퇴근처럼 시트를 닫았다 다시 여는 왕복에서
      // 매번 '정보'로 리셋되면 방금 보던 근무 기록을 다시 찾아 들어가야 한다.
      // 모달 열릴 때 데이터 리프레시 요청 (쿨다운 적용)
      triggerRefresh();
    }
  }, [visible, triggerRefresh]);

  const handleTabPress = useCallback(
    (tabId: TabId) => {
      setActiveTab(tabId);
      // 정산탭으로 전환 시 데이터 리프레시 요청 (쿨다운 적용)
      if (tabId === 'settlement') {
        triggerRefresh();
      }
    },
    [triggerRefresh]
  );

  // 시트 닫힘 후 지연 실행이 예약된 액션 (지원취소 확인·취소요청 확인·신고)
  const pendingActionRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPendingAction = useCallback(() => {
    if (pendingActionRef.current) {
      clearTimeout(pendingActionRef.current);
      pendingActionRef.current = null;
    }
  }, []);

  // 시트를 먼저 닫고 dismiss 애니메이션 후 액션 실행 — iOS 중첩 Modal 터치 먹통 회피 공용 경로.
  // 예약이 살아있는 동안 재호출은 무시(더블탭 시 전역 ConfirmModal 이 append 방식이라 다이얼로그가
  // 중첩되고 취소가 중복 실행될 수 있다), 화면 포커스를 잃으면(탭 전환) 예약을 취소해
  // 엉뚱한 화면 위에서 다이얼로그가 뜨지 않게 한다.
  const closeSheetThen = useCallback(
    (action: () => void) => {
      if (pendingActionRef.current) return;
      onClose();
      pendingActionRef.current = setTimeout(() => {
        pendingActionRef.current = null;
        action();
      }, SHEET_DISMISS_ANIMATION_MS);
    },
    [onClose]
  );

  // 블러(탭 전환) 시 예약 취소
  useFocusEffect(useCallback(() => clearPendingAction, [clearPendingAction]));

  // 언마운트 시 예약 취소
  useEffect(() => clearPendingAction, [clearPendingAction]);

  // 지원 취소 핸들러 (확인 모달) — applicationId 는 클로저로 캡처해 시트가 닫혀도 안전.
  const handleCancelApplication = useCallback(() => {
    if (!schedule?.applicationId || !onCancelApplication) return;

    const applicationId = schedule.applicationId;
    // 다중일 지원은 한 번의 취소로 여러 날이 함께 사라진다. 며칠치가 없어지는지 밝히지
    // 않으면 '오늘 하루만 빼는 것'으로 오해한 채 3일 대회를 통째로 날린다.
    const totalDays = groupedSchedule?.dateRange.totalDays ?? 1;
    const isMultiDay = totalDays > 1;
    const rangeLabel = groupedSchedule
      ? formatDateDisplay(groupedSchedule.dateRange.dates)
      : formatSingleDate(schedule.date);

    closeSheetThen(() => {
      modal.showConfirm(
        isMultiDay ? `${totalDays}일 지원 취소` : '지원 취소',
        isMultiDay
          ? `${rangeLabel} 전체가 취소됩니다.\n취소 후에는 다시 지원해야 합니다.`
          : '정말 지원을 취소하시겠습니까?\n취소 후에는 다시 지원해야 합니다.',
        () => {
          onCancelApplication(applicationId);
        }
      );
    });
  }, [
    schedule?.applicationId,
    schedule?.date,
    groupedSchedule,
    onCancelApplication,
    closeSheetThen,
    modal,
  ]);

  // 취소 요청 핸들러 (확인 모달)
  const handleRequestCancellation = useCallback(() => {
    if (!schedule?.applicationId || !onRequestCancellation) return;

    const applicationId = schedule.applicationId;
    closeSheetThen(() => {
      modal.showConfirm(
        '취소 요청',
        '확정된 일정의 취소를 요청하시겠습니까?\n구인자가 승인해야 취소가 완료됩니다.',
        () => {
          onRequestCancellation(applicationId);
        }
      );
    });
  }, [schedule?.applicationId, onRequestCancellation, closeSheetThen, modal]);

  // 신고 버튼 — 시트를 먼저 닫고 상위(schedule.tsx)에서 신고 모달을 연다.
  // 대상 정보는 클로저로 캡처해 시트가 닫혀도 안전.
  const handleReport = useCallback(() => {
    if (!schedule?.ownerId || !onReport) return;
    const request: OwnerReportRequest = {
      ownerId: schedule.ownerId,
      ownerName: schedule.postingProjection?.ownerName || '구인자',
      jobPostingId: schedule.jobPostingId,
      jobPostingTitle: schedule.jobPostingName,
    };
    closeSheetThen(() => onReport(request));
  }, [schedule, onReport, closeSheetThen]);

  if (!schedule) return null;

  const tabs = ALL_TABS.filter((tab) => TAB_VISIBILITY[schedule.type].includes(tab.id));

  // 선택 탭은 파생값으로 푼다 — 그룹 모드에서 날짜를 옮기면 상태가 바뀌어 보고 있던 탭이
  // 사라질 수 있다. useEffect 로 되돌리면 한 프레임 동안 없는 탭이 그려진다.
  // 파생값이면 그 깜빡임이 없고, 유효한 상태로 되돌아왔을 때 원래 탭도 그대로 복구된다.
  const currentTab = tabs.some((tab) => tab.id === activeTab) ? activeTab : (tabs[0]?.id ?? 'info');

  const status = SCHEDULE_STATUS[schedule.type];
  const hasPendingCancellation = Boolean(schedule.isCancellationPending);

  return (
    <Modal visible={visible} onClose={onClose} position="bottom" showCloseButton={false}>
      {/* Handle Bar */}
      <View className="items-center mb-2">
        <View className="w-10 h-1 rounded-sm bg-secondary-300 dark:bg-surface-elevated" />
      </View>

      {/* 그룹 모드: 날짜 네비게이션 */}
      {isGroupMode && groupedSchedule && (
        <View className="flex-row items-center justify-between bg-primary-50 dark:bg-primary-900/20 rounded-md px-3 py-2 mb-3">
          {/* 이전 버튼 */}
          <TouchableOpacity
            onPress={() => handleDateChange('prev')}
            disabled={currentDateIndex === 0}
            style={{
              width: 32,
              height: 32,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 16,
              opacity: currentDateIndex === 0 ? 0.3 : 1,
            }}
            activeOpacity={0.7}
            accessibilityLabel="이전 날짜"
          >
            <ChevronLeftIcon size={20} color={getLayoutColor(isDarkMode, 'tabBarActive')} />
          </TouchableOpacity>

          {/* 현재 날짜 표시 */}
          <View className="items-center">
            <View className="flex-row items-center">
              <CalendarIcon size={14} color={getLayoutColor(isDarkMode, 'tabBarActive')} />
              <Text className="ml-1.5 text-sm font-sans-semibold text-primary-700 dark:text-primary-300">
                {schedule?.date ? formatSingleDate(schedule.date) : ''}
              </Text>
            </View>
            <Text className="text-xs text-primary-500 dark:text-primary-400 mt-0.5 font-sans">
              {currentDateIndex + 1} / {groupedSchedule.dateRange.totalDays}일
            </Text>
          </View>

          {/* 다음 버튼 */}
          <TouchableOpacity
            onPress={() => handleDateChange('next')}
            disabled={currentDateIndex >= groupedSchedule.dateRange.totalDays - 1}
            style={{
              width: 32,
              height: 32,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 16,
              opacity: currentDateIndex >= groupedSchedule.dateRange.totalDays - 1 ? 0.3 : 1,
            }}
            activeOpacity={0.7}
            accessibilityLabel="다음 날짜"
          >
            <ChevronRightIcon size={20} color={getLayoutColor(isDarkMode, 'tabBarActive')} />
          </TouchableOpacity>
        </View>
      )}

      {/* Header */}
      <View className="flex-row items-start justify-between px-1 mb-3">
        <View className="flex-1">
          <View className="flex-row items-center gap-2 mb-2">
            <Badge variant={status.variant} dot>
              {status.label}
            </Badge>
            {hasPendingCancellation && (
              <Badge variant="warning">{APPLICATION_STATUS_LABELS.cancellation_pending}</Badge>
            )}
            {/* 그룹 모드 표시 (연속/비연속 구분) */}
            {isGroupMode && (
              <View className="px-2 py-0.5 bg-primary-100 dark:bg-primary-900/30 rounded-sm">
                <Text className="text-xs font-sans-medium text-primary-600 dark:text-primary-400">
                  {groupedSchedule?.dateRange.totalDays}일
                  {groupedSchedule?.dateRange.isConsecutive ? ' 연속' : ''}
                </Text>
              </View>
            )}
          </View>
          <Text
            className="text-lg font-display text-content-primary dark:text-secondary-100"
            numberOfLines={2}
          >
            {schedule.jobPostingName}
          </Text>
        </View>
        <TouchableOpacity
          onPress={onClose}
          style={{
            width: 40,
            height: 40,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 8,
            backgroundColor: isDarkMode ? '#141418' : SECONDARY_PALETTE[50],
          }}
          activeOpacity={0.7}
          accessibilityLabel="닫기"
        >
          <XMarkIcon size={18} color={SECONDARY_PALETTE[400]} />
        </TouchableOpacity>
      </View>

      {/* Tab Navigation — 탭이 하나뿐이면 탭바 자체가 소음이다(누를 곳이 없는 탭). */}
      {tabs.length > 1 && (
        <View className="flex-row bg-surface-card dark:bg-surface p-1 rounded-md mb-4">
          {tabs.map((tab) => {
            const isActive = currentTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                onPress={() => handleTabPress(tab.id)}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: 10,
                  borderRadius: 8,
                  backgroundColor: isActive ? (isDarkMode ? '#141418' : '#FFFFFF') : 'transparent',
                }}
                activeOpacity={0.7}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
              >
                <View style={{ opacity: isActive ? 1 : 0.6 }}>
                  {React.cloneElement(tab.icon as React.ReactElement<{ color?: string }>, {
                    color: isActive
                      ? getLayoutColor(isDarkMode, 'tabBarActive')
                      : SECONDARY_PALETTE[500],
                  })}
                </View>
                <Text
                  style={{
                    marginLeft: 6,
                    fontSize: 14,
                    fontWeight: '500',
                    fontFamily: 'PlusJakartaSans_500Medium',
                    color: isActive
                      ? getLayoutColor(isDarkMode, 'tabBarActive')
                      : SECONDARY_PALETTE[500],
                  }}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* 콘텐츠 + 버튼 영역 */}
      <View>
        {/* Tab Content */}
        <View>
          {currentTab === 'info' && <InfoTab schedule={schedule} />}
          {currentTab === 'work' && <WorkTab schedule={schedule} onQRScan={onQRScan} />}
          {currentTab === 'settlement' && <SettlementTab schedule={schedule} />}
        </View>

        {/* 하단 버튼 영역: 취소 + 신고 (2열) - 고정 푸터 */}
        <View className="pt-4 border-t border-divider flex-row gap-3">
          {/* 지원 취소 버튼 (지원중 상태) */}
          {schedule.type === STATUS.SCHEDULE.APPLIED &&
            onCancelApplication &&
            schedule.applicationId &&
            !hasPendingCancellation && (
              <View className="flex-1">
                <Button
                  variant="outline"
                  size="md"
                  onPress={handleCancelApplication}
                  className="border-error-300 dark:border-error-700"
                >
                  <Text className="text-error-600 dark:text-error-400 font-sans-semibold">
                    지원 취소
                  </Text>
                </Button>
              </View>
            )}

          {/* 취소 요청 버튼 (확정 상태) */}
          {schedule.type === STATUS.SCHEDULE.CONFIRMED &&
            onRequestCancellation &&
            schedule.applicationId &&
            !hasPendingCancellation && (
              <View className="flex-1">
                <Button
                  variant="outline"
                  size="md"
                  onPress={handleRequestCancellation}
                  className="border-orange-300 dark:border-orange-700"
                >
                  <Text className="text-orange-600 dark:text-orange-400 font-sans-semibold">
                    취소 요청
                  </Text>
                </Button>
              </View>
            )}

          {/* 이 근무 평가하기 — 완료 직후 가장 자연스러운 다음 행동인데, 예전에는
              배너 → 평가 허브 → 목록에서 재검색으로 우회해야 했다. */}
          {pendingReviewWorkLogId && onWriteReview && (
            <View className="flex-1">
              <Button
                variant="primary"
                size="md"
                onPress={() => onWriteReview(pendingReviewWorkLogId)}
              >
                <Text className="font-sans-semibold text-content-onGold">이 근무 평가하기</Text>
              </Button>
            </View>
          )}

          {/* 신고 버튼 */}
          {schedule.ownerId && (
            <View className="flex-1">
              <Button
                variant="outline"
                size="md"
                onPress={handleReport}
                className="border-secondary-300 dark:border-surface-overlay"
                icon={<AlertTriangleIcon size={16} color={SECONDARY_PALETTE[500]} />}
              >
                <Text className="text-content-muted dark:text-secondary-400 font-sans">신고</Text>
              </Button>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}
