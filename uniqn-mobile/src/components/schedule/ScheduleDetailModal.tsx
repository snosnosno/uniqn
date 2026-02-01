/**
 * UNIQN Mobile - ScheduleDetailModal 컴포넌트
 *
 * @description 스케줄 상세 정보를 3탭(정보/근무/정산)으로 표시하는 모달
 *   + 구직자 → 구인자 신고 기능
 *   + 그룹화된 스케줄 지원 (다중 날짜 전환)
 * @version 1.2.0
 */

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
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
import { ReportModal, type ReportTarget } from '@/components/employer/ReportModal';
import { getUserProfile } from '@/services/authService';
import { createReport } from '@/services/reportService';
import { useToastStore } from '@/stores/toastStore';
import { useModal } from '@/stores/modalStore';
import { logger } from '@/utils/logger';
import { formatSingleDate } from '@/utils/scheduleGrouping';
import type { ScheduleEvent, ScheduleType, GroupedScheduleEvent, CreateReportInput } from '@/types';

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
  /** 그룹화된 스케줄 (다중 날짜 전환 지원) */
  groupedSchedule?: GroupedScheduleEvent | null;
  /** 그룹 내 날짜 변경 콜백 */
  onDateChange?: (date: string, schedule: ScheduleEvent) => void;
  /** 스케줄 데이터 리페치 콜백 (탭 간 동기화용) */
  onRefreshSchedule?: () => void;
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

const statusConfig: Record<
  ScheduleType,
  { label: string; variant: 'warning' | 'success' | 'default' | 'error' }
> = {
  applied: { label: '지원 중', variant: 'warning' },
  confirmed: { label: '확정', variant: 'success' },
  completed: { label: '완료', variant: 'default' },
  cancelled: { label: '취소', variant: 'error' },
};

/** 중복 리페치 방지를 위한 쿨다운 (3초) */
const REFETCH_COOLDOWN_MS = 3000;

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
  groupedSchedule,
  onDateChange,
  onRefreshSchedule,
}: ScheduleDetailModalProps) {
  const [activeTab, setActiveTab] = useState<TabId>('info');

  // 신고 모달 상태
  const [isReportModalVisible, setIsReportModalVisible] = useState(false);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [isReportLoading, setIsReportLoading] = useState(false);

  const { addToast } = useToastStore();
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

  // 이전/다음 날짜로 이동
  const handlePrevDate = useCallback(() => {
    if (!isGroupMode || currentDateIndex === 0 || !groupedSchedule) return;
    const prevDate = groupedSchedule.dateRange.dates[currentDateIndex - 1];
    const prevSchedule = groupedSchedule.originalEvents.find((e) => e.date === prevDate);
    if (prevSchedule && onDateChange) {
      onDateChange(prevDate, prevSchedule);
    }
  }, [isGroupMode, currentDateIndex, groupedSchedule, onDateChange]);

  const handleNextDate = useCallback(() => {
    if (!isGroupMode || !groupedSchedule) return;
    const totalDates = groupedSchedule.dateRange.dates.length;
    if (currentDateIndex >= totalDates - 1) return;
    const nextDate = groupedSchedule.dateRange.dates[currentDateIndex + 1];
    const nextSchedule = groupedSchedule.originalEvents.find((e) => e.date === nextDate);
    if (nextSchedule && onDateChange) {
      onDateChange(nextDate, nextSchedule);
    }
  }, [isGroupMode, currentDateIndex, groupedSchedule, onDateChange]);

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
      setActiveTab('info');
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

  // 지원 취소 핸들러 (확인 모달)
  const handleCancelApplication = useCallback(() => {
    if (!schedule?.applicationId || !onCancelApplication) return;

    modal.showConfirm(
      '지원 취소',
      '정말 지원을 취소하시겠습니까?\n취소 후에는 다시 지원해야 합니다.',
      () => {
        onCancelApplication(schedule.applicationId!);
        onClose();
      }
    );
  }, [schedule?.applicationId, onCancelApplication, onClose, modal]);

  // 취소 요청 핸들러 (확인 모달)
  const handleRequestCancellation = useCallback(() => {
    if (!schedule?.applicationId || !onRequestCancellation) return;

    modal.showConfirm(
      '취소 요청',
      '확정된 일정의 취소를 요청하시겠습니까?\n구인자가 승인해야 취소가 완료됩니다.',
      () => {
        onRequestCancellation(schedule.applicationId!);
        onClose();
      }
    );
  }, [schedule?.applicationId, onRequestCancellation, onClose, modal]);

  // 신고 모달 열기
  const handleOpenReportModal = useCallback(async () => {
    if (!schedule?.ownerId) {
      addToast({ type: 'error', message: '구인자 정보를 찾을 수 없습니다.' });
      return;
    }

    try {
      // 구인자 이름 조회
      const profile = await getUserProfile(schedule.ownerId);
      setReportTarget({
        id: schedule.ownerId,
        name: profile?.name || profile?.nickname || '구인자',
      });
      setIsReportModalVisible(true);
    } catch (error) {
      logger.error('Failed to get employer profile', error as Error);
      // 이름 조회 실패해도 "구인자"로 진행
      setReportTarget({
        id: schedule.ownerId,
        name: '구인자',
      });
      setIsReportModalVisible(true);
    }
  }, [schedule, addToast]);

  // 신고 모달 닫기
  const handleCloseReportModal = useCallback(() => {
    setIsReportModalVisible(false);
    setReportTarget(null);
  }, []);

  // 신고 제출
  const handleReportSubmit = useCallback(
    async (input: CreateReportInput) => {
      setIsReportLoading(true);
      try {
        await createReport(input);
        addToast({ type: 'success', message: '신고가 접수되었습니다.' });
        handleCloseReportModal();
      } catch (error) {
        const err = error as Error & { code?: string; message?: string };
        logger.error('Failed to submit report', err, {
          input,
          errorCode: err.code,
          errorMessage: err.message,
        });
        addToast({ type: 'error', message: '신고 접수에 실패했습니다. 다시 시도해주세요.' });
      } finally {
        setIsReportLoading(false);
      }
    },
    [addToast, handleCloseReportModal]
  );

  // 탭 설정 (상태에 따라 동적으로 구성)
  const tabs: TabConfig[] = [
    {
      id: 'info',
      label: '정보',
      icon: <DocumentIcon size={16} />,
    },
    {
      id: 'work',
      label: '근무',
      icon: <ClockIcon size={16} />,
    },
    {
      id: 'settlement',
      label: '정산',
      icon: <BanknotesIcon size={16} />,
    },
  ];

  if (!schedule) return null;

  const status = statusConfig[schedule.type];

  return (
    <Modal visible={visible} onClose={onClose} position="bottom" showCloseButton={false}>
      {/* Handle Bar */}
      <View className="items-center mb-2">
        <View className="w-10 h-1 rounded-full bg-gray-300 dark:bg-surface-elevated" />
      </View>

      {/* 그룹 모드: 날짜 네비게이션 */}
      {isGroupMode && groupedSchedule && (
        <View className="flex-row items-center justify-between bg-primary-50 dark:bg-primary-900/20 rounded-xl px-3 py-2 mb-3">
          {/* 이전 버튼 */}
          <TouchableOpacity
            onPress={handlePrevDate}
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
            <ChevronLeftIcon size={20} color="#4F46E5" />
          </TouchableOpacity>

          {/* 현재 날짜 표시 */}
          <View className="items-center">
            <View className="flex-row items-center">
              <CalendarIcon size={14} color="#4F46E5" />
              <Text className="ml-1.5 text-sm font-semibold text-primary-700 dark:text-primary-300">
                {schedule?.date ? formatSingleDate(schedule.date) : ''}
              </Text>
            </View>
            <Text className="text-xs text-primary-500 dark:text-primary-400 mt-0.5">
              {currentDateIndex + 1} / {groupedSchedule.dateRange.totalDays}일
            </Text>
          </View>

          {/* 다음 버튼 */}
          <TouchableOpacity
            onPress={handleNextDate}
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
            <ChevronRightIcon size={20} color="#4F46E5" />
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
            {/* 그룹 모드 표시 (연속/비연속 구분) */}
            {isGroupMode && (
              <View className="px-2 py-0.5 bg-primary-100 dark:bg-primary-900/30 rounded-full">
                <Text className="text-xs font-medium text-primary-600 dark:text-primary-400">
                  {groupedSchedule?.dateRange.totalDays}일
                  {groupedSchedule?.dateRange.isConsecutive ? ' 연속' : ''}
                </Text>
              </View>
            )}
          </View>
          <Text className="text-lg font-bold text-gray-900 dark:text-gray-100" numberOfLines={2}>
            {schedule.jobPostingName}
          </Text>
        </View>
        <TouchableOpacity
          onPress={onClose}
          style={{
            width: 32,
            height: 32,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 16,
            backgroundColor: '#F3F4F6',
          }}
          activeOpacity={0.7}
          accessibilityLabel="닫기"
        >
          <XMarkIcon size={18} color="#9CA3AF" />
        </TouchableOpacity>
      </View>

      {/* Tab Navigation */}
      <View className="flex-row bg-gray-100 dark:bg-surface p-1 rounded-xl mb-4">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
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
                backgroundColor: isActive ? '#FFFFFF' : 'transparent',
              }}
              activeOpacity={0.7}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
            >
              <View style={{ opacity: isActive ? 1 : 0.6 }}>
                {React.cloneElement(tab.icon as React.ReactElement<{ color?: string }>, {
                  color: isActive ? '#4F46E5' : '#6B7280',
                })}
              </View>
              <Text
                style={{
                  marginLeft: 6,
                  fontSize: 14,
                  fontWeight: '500',
                  color: isActive ? '#4F46E5' : '#6B7280',
                }}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* 콘텐츠 + 버튼 영역 */}
      <View>
        {/* Tab Content */}
        <View>
          {activeTab === 'info' && <InfoTab schedule={schedule} />}
          {activeTab === 'work' && <WorkTab schedule={schedule} onQRScan={onQRScan} />}
          {activeTab === 'settlement' && <SettlementTab schedule={schedule} />}
        </View>

        {/* 하단 버튼 영역: 취소 + 신고 (2열) - 고정 푸터 */}
        <View className="pt-4 border-t border-gray-200 dark:border-surface-overlay flex-row gap-3">
          {/* 지원 취소 버튼 (지원중 상태) */}
          {schedule.type === 'applied' && onCancelApplication && schedule.applicationId && (
            <View className="flex-1">
              <Button
                variant="outline"
                size="md"
                onPress={handleCancelApplication}
                className="border-red-300 dark:border-red-700"
              >
                <Text className="text-red-600 dark:text-red-400 font-semibold">지원 취소</Text>
              </Button>
            </View>
          )}

          {/* 취소 요청 버튼 (확정 상태) */}
          {schedule.type === 'confirmed' && onRequestCancellation && schedule.applicationId && (
            <View className="flex-1">
              <Button
                variant="outline"
                size="md"
                onPress={handleRequestCancellation}
                className="border-orange-300 dark:border-orange-700"
              >
                <Text className="text-orange-600 dark:text-orange-400 font-semibold">
                  취소 요청
                </Text>
              </Button>
            </View>
          )}

          {/* 신고 버튼 */}
          {schedule.ownerId && (
            <View className="flex-1">
              <Button
                variant="outline"
                size="md"
                onPress={handleOpenReportModal}
                className="border-gray-300 dark:border-surface-overlay"
                icon={<AlertTriangleIcon size={16} color="#6B7280" />}
              >
                <Text className="text-gray-600 dark:text-gray-400">신고</Text>
              </Button>
            </View>
          )}
        </View>
      </View>

      {/* 신고 모달 */}
      <ReportModal
        visible={isReportModalVisible}
        onClose={handleCloseReportModal}
        mode="employee"
        target={reportTarget}
        jobPostingId={schedule.jobPostingId}
        jobPostingTitle={schedule.jobPostingName}
        onSubmit={handleReportSubmit}
        isLoading={isReportLoading}
      />
    </Modal>
  );
}

export default ScheduleDetailModal;
