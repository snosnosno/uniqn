/**
 * UNIQN Mobile - ScheduleDetailModal 컴포넌트
 *
 * @description 스케줄 상세 정보를 3탭(정보/근무/정산)으로 표시하는 모달
 *   + 구직자 → 구인자 신고 기능
 * @version 1.1.0
 */

import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { Modal, Badge, Button } from '@/components/ui';
import {
  XMarkIcon,
  DocumentIcon,
  ClockIcon,
  BanknotesIcon,
  AlertTriangleIcon,
} from '@/components/icons';
import { InfoTab, WorkTab, SettlementTab } from './tabs';
import { ReportModal, type ReportTarget } from '@/components/employer/ReportModal';
import { getUserProfile } from '@/services/authService';
import { createReport } from '@/services/reportService';
import { useToastStore } from '@/stores/toastStore';
import { logger } from '@/utils/logger';
import type { ScheduleEvent, ScheduleType, CreateReportInput } from '@/types';

// ============================================================================
// Types
// ============================================================================

export interface ScheduleDetailModalProps {
  schedule: ScheduleEvent | null;
  visible: boolean;
  onClose: () => void;
  onQRScan?: () => void;
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

const statusConfig: Record<ScheduleType, { label: string; variant: 'warning' | 'success' | 'default' | 'error' }> = {
  applied: { label: '지원 중', variant: 'warning' },
  confirmed: { label: '확정', variant: 'success' },
  completed: { label: '완료', variant: 'default' },
  cancelled: { label: '취소', variant: 'error' },
};

// ============================================================================
// Component
// ============================================================================

export function ScheduleDetailModal({
  schedule,
  visible,
  onClose,
  onQRScan,
}: ScheduleDetailModalProps) {
  const [activeTab, setActiveTab] = useState<TabId>('info');

  // 신고 모달 상태
  const [isReportModalVisible, setIsReportModalVisible] = useState(false);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [isReportLoading, setIsReportLoading] = useState(false);

  const { addToast } = useToastStore();

  // 모달 열릴 때 첫 번째 탭으로 리셋
  useEffect(() => {
    if (visible) {
      setActiveTab('info');
    }
  }, [visible]);

  const handleTabPress = useCallback((tabId: TabId) => {
    setActiveTab(tabId);
  }, []);

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
  const handleReportSubmit = useCallback(async (input: CreateReportInput) => {
    setIsReportLoading(true);
    try {
      await createReport(input);
      addToast({ type: 'success', message: '신고가 접수되었습니다.' });
      handleCloseReportModal();
    } catch (error) {
      logger.error('Failed to submit report', error as Error);
      addToast({ type: 'error', message: '신고 접수에 실패했습니다. 다시 시도해주세요.' });
    } finally {
      setIsReportLoading(false);
    }
  }, [addToast, handleCloseReportModal]);

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
    <Modal
      visible={visible}
      onClose={onClose}
      position="bottom"
      showCloseButton={false}
    >
      {/* Handle Bar */}
      <View className="items-center mb-2">
        <View className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
      </View>

      {/* Header */}
      <View className="flex-row items-start justify-between px-1 mb-3">
        <View className="flex-1">
          <View className="flex-row items-center gap-2 mb-2">
            <Badge variant={status.variant} dot>
              {status.label}
            </Badge>
          </View>
          <Text
            className="text-lg font-bold text-gray-900 dark:text-gray-100"
            numberOfLines={2}
          >
            {schedule.eventName}
          </Text>
        </View>
        <Pressable
          onPress={onClose}
          className="w-8 h-8 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600"
          accessibilityLabel="닫기"
        >
          <XMarkIcon size={18} color="#9CA3AF" />
        </Pressable>
      </View>

      {/* Tab Navigation */}
      <View className="flex-row bg-gray-100 dark:bg-gray-700 p-1 rounded-xl mb-4">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <Pressable
              key={tab.id}
              onPress={() => handleTabPress(tab.id)}
              className={`flex-1 flex-row items-center justify-center py-2.5 rounded-lg ${
                isActive
                  ? 'bg-white dark:bg-gray-600 shadow-sm'
                  : ''
              }`}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
            >
              <View className={isActive ? 'opacity-100' : 'opacity-60'}>
                {React.cloneElement(tab.icon as React.ReactElement<{ color?: string }>, {
                  color: isActive ? '#4F46E5' : '#6B7280',
                })}
              </View>
              <Text
                className={`ml-1.5 text-sm font-medium ${
                  isActive
                    ? 'text-primary-600 dark:text-primary-400'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Tab Content */}
      <ScrollView
        className="max-h-96"
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {activeTab === 'info' && <InfoTab schedule={schedule} />}
        {activeTab === 'work' && <WorkTab schedule={schedule} onQRScan={onQRScan} />}
        {activeTab === 'settlement' && <SettlementTab schedule={schedule} />}
      </ScrollView>

      {/* 신고 버튼 - 모든 상태에서 표시 (ownerId가 있을 때만) */}
      {schedule.ownerId && (
        <View className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button
            variant="outline"
            size="md"
            onPress={handleOpenReportModal}
            className="border-red-300 dark:border-red-700"
            icon={<AlertTriangleIcon size={18} color="#EF4444" />}
          >
            <Text className="text-red-600 dark:text-red-400">구인자 신고</Text>
          </Button>
        </View>
      )}

      {/* 신고 모달 */}
      <ReportModal
        visible={isReportModalVisible}
        onClose={handleCloseReportModal}
        mode="employee"
        target={reportTarget}
        jobPostingId={schedule.eventId}
        jobPostingTitle={schedule.eventName}
        onSubmit={handleReportSubmit}
        isLoading={isReportLoading}
      />
    </Modal>
  );
}

export default ScheduleDetailModal;
