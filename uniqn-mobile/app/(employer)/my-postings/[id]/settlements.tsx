/**
 * UNIQN Mobile - 정산 관리 화면
 * 특정 공고의 스태프 근무 기록 및 정산
 */

import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SettlementList, WorkTimeEditor } from '@/components/employer';
import { Loading, ErrorState } from '@/components';
import { useSettlement } from '@/hooks/useSettlement';
import { useJobDetail } from '@/hooks/useJobDetail';
import type { WorkLog } from '@/types';

// ============================================================================
// Constants
// ============================================================================

const REGULAR_HOURS = 8;
const OVERTIME_RATE = 1.5;

// ============================================================================
// Helpers
// ============================================================================

function parseTimestamp(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string') return new Date(value);
  if (typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }
  return null;
}

function calculateWorkLogAmount(workLog: WorkLog, hourlyRate: number): number {
  const startTime = parseTimestamp(workLog.actualStartTime);
  const endTime = parseTimestamp(workLog.actualEndTime);

  if (!startTime || !endTime) {
    // 실제 시간이 없으면 기본 8시간으로 계산
    return REGULAR_HOURS * hourlyRate;
  }

  const totalMinutes = Math.max(0, (endTime.getTime() - startTime.getTime()) / (1000 * 60));
  const totalHours = totalMinutes / 60;
  const regularHours = Math.min(totalHours, REGULAR_HOURS);
  const overtimeHours = Math.max(0, totalHours - REGULAR_HOURS);

  const regularPay = Math.round(regularHours * hourlyRate);
  const overtimePay = Math.round(overtimeHours * hourlyRate * OVERTIME_RATE);

  return regularPay + overtimePay;
}

// ============================================================================
// Main Component
// ============================================================================

export default function SettlementsScreen() {
  const { id: jobPostingId } = useLocalSearchParams<{ id: string }>();

  // 공고 정보 (시급 포함)
  const { job: posting } = useJobDetail(jobPostingId || '');

  // 정산 관리 훅
  const {
    workLogs,
    isLoading,
    error,
    refresh,
    updateWorkTime,
    settleWorkLog,
    bulkSettle,
    isUpdatingTime: isUpdating,
    isSettling,
    isBulkSettling,
  } = useSettlement(jobPostingId || '');

  // 시간 수정 모달 상태
  const [selectedWorkLog, setSelectedWorkLog] = useState<WorkLog | null>(null);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);

  // 시급 (공고의 salary.amount에서 가져오거나 기본값)
  const hourlyRate = posting?.salary?.amount ?? 15000;

  // 근무기록 클릭
  const handleWorkLogPress = useCallback((workLog: WorkLog) => {
    // TODO: 상세 보기 모달 또는 화면
  }, []);

  // 시간 수정 클릭
  const handleEditTime = useCallback((workLog: WorkLog) => {
    setSelectedWorkLog(workLog);
    setIsEditModalVisible(true);
  }, []);

  // 개별 정산 클릭
  const handleSettle = useCallback((workLog: WorkLog) => {
    const amount = calculateWorkLogAmount(workLog, hourlyRate);

    Alert.alert(
      '정산 처리',
      `이 스태프의 근무를 정산하시겠습니까?\n정산 금액: ${amount.toLocaleString()}원`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '정산하기',
          onPress: () => {
            settleWorkLog({
              workLogId: workLog.id,
              amount,
            });
          },
        },
      ]
    );
  }, [settleWorkLog, hourlyRate]);

  // 일괄 정산 클릭
  const handleBulkSettle = useCallback((selectedWorkLogs: WorkLog[]) => {
    if (selectedWorkLogs.length === 0) return;

    const totalAmount = selectedWorkLogs.reduce((sum, log) => {
      return sum + calculateWorkLogAmount(log, hourlyRate);
    }, 0);

    Alert.alert(
      '일괄 정산',
      `${selectedWorkLogs.length}건의 근무를 정산하시겠습니까?\n예상 금액: ${totalAmount.toLocaleString()}원`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '정산하기',
          onPress: () => {
            const workLogIds = selectedWorkLogs.map((log) => log.id);
            bulkSettle({ workLogIds });
          },
        },
      ]
    );
  }, [hourlyRate, bulkSettle]);

  // 시간 수정 저장
  const handleSaveTimeEdit = useCallback((data: {
    startTime: Date;
    endTime: Date;
    reason: string;
  }) => {
    if (!selectedWorkLog) return;

    updateWorkTime({
      workLogId: selectedWorkLog.id,
      actualStartTime: data.startTime,
      actualEndTime: data.endTime,
      reason: data.reason,
    });

    setIsEditModalVisible(false);
    setSelectedWorkLog(null);
  }, [selectedWorkLog, updateWorkTime]);

  // 시간 수정 모달 닫기
  const handleCloseEditModal = useCallback(() => {
    setIsEditModalVisible(false);
    setSelectedWorkLog(null);
  }, []);

  // 로딩 상태
  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900">
        <View className="flex-1 items-center justify-center">
          <Loading size="large" />
          <Text className="mt-4 text-gray-500 dark:text-gray-400">
            정산 목록을 불러오는 중...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // 에러 상태
  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900">
        <ErrorState
          title="정산 목록을 불러올 수 없습니다"
          message={error.message}
          onRetry={() => refresh()}
        />
      </SafeAreaView>
    );
  }

  const isProcessing = isUpdating || isSettling || isBulkSettling;

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900" edges={['bottom']}>
      {/* 정산 목록 */}
      <SettlementList
        workLogs={workLogs}
        hourlyRate={hourlyRate}
        isLoading={isLoading}
        error={error}
        onRefresh={() => refresh()}
        isRefreshing={false}
        onWorkLogPress={handleWorkLogPress}
        onEditTime={handleEditTime}
        onSettle={handleSettle}
        onBulkSettle={handleBulkSettle}
        showBulkActions={true}
      />

      {/* 시간 수정 모달 */}
      <WorkTimeEditor
        workLog={selectedWorkLog}
        visible={isEditModalVisible}
        onClose={handleCloseEditModal}
        onSave={handleSaveTimeEdit}
        isLoading={isUpdating}
      />
    </SafeAreaView>
  );
}
