/**
 * UNIQN Mobile - 정산 관리 화면
 * 특정 공고의 스태프 근무 기록 및 정산
 *
 * @description v2.0 - 역할별 급여, 수당 반영
 * @version 2.0.0
 */

import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SettlementList, WorkTimeEditor } from '@/components/employer';
import { Loading, ErrorState } from '@/components';
import { useSettlement } from '@/hooks/useSettlement';
import { useJobDetail } from '@/hooks/useJobDetail';
import type { WorkLog, SalaryInfo, Allowances } from '@/types';

// ============================================================================
// Constants
// ============================================================================

const REGULAR_HOURS = 8;
const OVERTIME_RATE = 1.5;
/** "제공" 상태를 나타내는 특별 값 */
const PROVIDED_FLAG = -1;

// ============================================================================
// Types
// ============================================================================

interface SalaryConfig {
  useSameSalary?: boolean;
  salary?: SalaryInfo;
  roleSalaries?: Record<string, SalaryInfo>;
  allowances?: Allowances;
}

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

/**
 * 역할별 시급 가져오기 (v2.0)
 */
function getHourlyRateForRole(role: string, config: SalaryConfig): number {
  // useSameSalary가 true이거나 roleSalaries가 없으면 단일 급여 사용
  if (config.useSameSalary !== false || !config.roleSalaries) {
    return config.salary?.amount ?? 15000;
  }

  // 역할별 급여 사용
  const roleSalary = config.roleSalaries[role];
  if (roleSalary?.amount) {
    return roleSalary.amount;
  }

  // 역할 급여가 없으면 기본 급여 사용
  return config.salary?.amount ?? 15000;
}

/**
 * 수당 계산 (v2.0)
 * 보장시간만 금액 계산에 포함 (식비/교통비/숙박비는 별도 표시)
 */
function calculateAllowanceAmount(
  actualHours: number,
  hourlyRate: number,
  allowances?: Allowances
): number {
  if (!allowances) return 0;

  let amount = 0;

  // 보장시간: 실제 근무시간이 보장시간보다 적으면 보장시간으로 계산
  if (allowances.guaranteedHours && allowances.guaranteedHours > 0) {
    if (actualHours < allowances.guaranteedHours) {
      // 부족분을 추가 수당으로 계산
      const extraHours = allowances.guaranteedHours - actualHours;
      amount += Math.round(extraHours * hourlyRate);
    }
  }

  // 식비 (금액이 있는 경우만)
  if (allowances.meal && allowances.meal !== PROVIDED_FLAG && allowances.meal > 0) {
    amount += allowances.meal;
  }

  // 교통비 (금액이 있는 경우만)
  if (allowances.transportation && allowances.transportation !== PROVIDED_FLAG && allowances.transportation > 0) {
    amount += allowances.transportation;
  }

  // 숙박비 (금액이 있는 경우만)
  if (allowances.accommodation && allowances.accommodation !== PROVIDED_FLAG && allowances.accommodation > 0) {
    amount += allowances.accommodation;
  }

  return amount;
}

/**
 * 근무 기록 금액 계산 (v2.0 - 역할별 급여, 수당 반영)
 */
function calculateWorkLogAmount(workLog: WorkLog, config: SalaryConfig): number {
  const startTime = parseTimestamp(workLog.actualStartTime);
  const endTime = parseTimestamp(workLog.actualEndTime);

  // 역할에 따른 시급 결정
  const hourlyRate = getHourlyRateForRole(workLog.role || 'dealer', config);

  let totalHours = REGULAR_HOURS; // 기본값

  if (startTime && endTime) {
    const totalMinutes = Math.max(0, (endTime.getTime() - startTime.getTime()) / (1000 * 60));
    totalHours = totalMinutes / 60;
  }

  const regularHours = Math.min(totalHours, REGULAR_HOURS);
  const overtimeHours = Math.max(0, totalHours - REGULAR_HOURS);

  const regularPay = Math.round(regularHours * hourlyRate);
  const overtimePay = Math.round(overtimeHours * hourlyRate * OVERTIME_RATE);

  // 수당 계산
  const allowanceAmount = calculateAllowanceAmount(totalHours, hourlyRate, config.allowances);

  return regularPay + overtimePay + allowanceAmount;
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

  // 급여 설정 (v2.0 - 역할별 급여, 수당 포함)
  const salaryConfig = useMemo<SalaryConfig>(() => ({
    useSameSalary: posting?.useSameSalary,
    salary: posting?.salary,
    roleSalaries: posting?.roleSalaries,
    allowances: posting?.allowances,
  }), [posting?.useSameSalary, posting?.salary, posting?.roleSalaries, posting?.allowances]);

  // 기본 시급 (SettlementList에 전달용)
  const hourlyRate = posting?.salary?.amount ?? 15000;

  // 근무기록 클릭
  const handleWorkLogPress = useCallback((_workLog: WorkLog) => {
    // TODO: 상세 보기 모달 또는 화면
  }, []);

  // 시간 수정 클릭
  const handleEditTime = useCallback((workLog: WorkLog) => {
    setSelectedWorkLog(workLog);
    setIsEditModalVisible(true);
  }, []);

  // 개별 정산 클릭 (v2.0 - 역할별 급여, 수당 적용)
  const handleSettle = useCallback((workLog: WorkLog) => {
    const amount = calculateWorkLogAmount(workLog, salaryConfig);

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
  }, [settleWorkLog, salaryConfig]);

  // 일괄 정산 클릭 (v2.0 - 역할별 급여, 수당 적용)
  const handleBulkSettle = useCallback((selectedWorkLogs: WorkLog[]) => {
    if (selectedWorkLogs.length === 0) return;

    const totalAmount = selectedWorkLogs.reduce((sum, log) => {
      return sum + calculateWorkLogAmount(log, salaryConfig);
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
  }, [salaryConfig, bulkSettle]);

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

  // 프로세싱 상태 (UI에서 버튼 비활성화 등에 사용)
  const isProcessing = isUpdating || isSettling || isBulkSettling;
  void isProcessing; // TODO: UI에서 활용

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
