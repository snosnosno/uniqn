/**
 * UNIQN Mobile - 스태프/정산 관리 화면
 * 특정 공고의 스태프 관리 및 정산
 *
 * @description v2.0 - 탭 구조 (스태프 관리 / 정산)
 * @version 2.0.0
 */

import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  SettlementList,
  WorkTimeEditor,
  StaffManagementTab,
  EventQRModal,
  RoleChangeModal,
  ReportModal,
} from '@/components/employer';
import { Loading, ErrorState } from '@/components';
import { useSettlement } from '@/hooks/useSettlement';
import { useJobDetail } from '@/hooks/useJobDetail';
import { useConfirmedStaff } from '@/hooks/useConfirmedStaff';
import { useToastStore } from '@/stores/toastStore';
import { reportService, markAsNoShow } from '@/services';
import { UsersIcon, CurrencyYenIcon } from '@/components/icons';
import type { WorkLog, SalaryInfo, Allowances, ConfirmedStaff, CreateReportInput } from '@/types';

// ============================================================================
// Constants
// ============================================================================

const REGULAR_HOURS = 8;
const OVERTIME_RATE = 1.5;
/** "제공" 상태를 나타내는 특별 값 */
const PROVIDED_FLAG = -1;

type TabType = 'staff' | 'settlement';

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
// Sub-components
// ============================================================================

interface TabHeaderProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  staffCount: number;
  settlementCount: number;
}

function TabHeader({ activeTab, onTabChange, staffCount, settlementCount }: TabHeaderProps) {
  return (
    <View className="flex-row bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <Pressable
        onPress={() => onTabChange('staff')}
        className={`flex-1 flex-row items-center justify-center py-4 ${
          activeTab === 'staff'
            ? 'border-b-2 border-primary-600'
            : ''
        }`}
      >
        <UsersIcon
          size={20}
          color={activeTab === 'staff' ? '#2563EB' : '#6B7280'}
        />
        <Text
          className={`ml-2 text-base font-medium ${
            activeTab === 'staff'
              ? 'text-primary-600 dark:text-primary-400'
              : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          스태프 관리
        </Text>
        {staffCount > 0 && (
          <View className={`ml-2 px-2 py-0.5 rounded-full ${
            activeTab === 'staff'
              ? 'bg-primary-100 dark:bg-primary-900/30'
              : 'bg-gray-100 dark:bg-gray-700'
          }`}>
            <Text className={`text-xs font-medium ${
              activeTab === 'staff'
                ? 'text-primary-600 dark:text-primary-400'
                : 'text-gray-500 dark:text-gray-400'
            }`}>
              {staffCount}
            </Text>
          </View>
        )}
      </Pressable>

      <Pressable
        onPress={() => onTabChange('settlement')}
        className={`flex-1 flex-row items-center justify-center py-4 ${
          activeTab === 'settlement'
            ? 'border-b-2 border-primary-600'
            : ''
        }`}
      >
        <CurrencyYenIcon
          size={20}
          color={activeTab === 'settlement' ? '#2563EB' : '#6B7280'}
        />
        <Text
          className={`ml-2 text-base font-medium ${
            activeTab === 'settlement'
              ? 'text-primary-600 dark:text-primary-400'
              : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          정산
        </Text>
        {settlementCount > 0 && (
          <View className={`ml-2 px-2 py-0.5 rounded-full ${
            activeTab === 'settlement'
              ? 'bg-primary-100 dark:bg-primary-900/30'
              : 'bg-gray-100 dark:bg-gray-700'
          }`}>
            <Text className={`text-xs font-medium ${
              activeTab === 'settlement'
                ? 'text-primary-600 dark:text-primary-400'
                : 'text-gray-500 dark:text-gray-400'
            }`}>
              {settlementCount}
            </Text>
          </View>
        )}
      </Pressable>
    </View>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function StaffSettlementsScreen() {
  const { id: jobPostingId } = useLocalSearchParams<{ id: string }>();
  const { addToast } = useToastStore();

  // 탭 상태
  const [activeTab, setActiveTab] = useState<TabType>('staff');

  // 공고 정보 (시급 포함)
  const { job: posting } = useJobDetail(jobPostingId || '');

  // 스태프 관리 훅
  const { stats: staffStats, changeRole } = useConfirmedStaff(jobPostingId || '');

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
    isSettling: _isSettling,
    isBulkSettling: _isBulkSettling,
  } = useSettlement(jobPostingId || '');

  // 시간 수정 모달 상태
  const [selectedWorkLog, setSelectedWorkLog] = useState<WorkLog | null>(null);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);

  // 모달 상태 (스태프 관리)
  const [showEventQRModal, setShowEventQRModal] = useState(false);
  const [showRoleChangeModal, setShowRoleChangeModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<ConfirmedStaff | null>(null);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  // 급여 설정 (v2.0 - 역할별 급여, 수당 포함)
  const salaryConfig = useMemo<SalaryConfig>(() => ({
    useSameSalary: posting?.useSameSalary,
    salary: posting?.salary,
    roleSalaries: posting?.roleSalaries,
    allowances: posting?.allowances,
  }), [posting?.useSameSalary, posting?.salary, posting?.roleSalaries, posting?.allowances]);

  // 기본 시급 (SettlementList에 전달용)
  const hourlyRate = posting?.salary?.amount ?? 15000;

  // 역할 목록 (공고에서 추출)
  const availableRoles = useMemo(() => {
    if (posting?.roles) {
      return posting.roles.map((r) => r.role);
    }
    return [];
  }, [posting?.roles]);

  // ============================================================================
  // 스태프 관리 핸들러
  // ============================================================================

  const handleShowEventQR = useCallback(() => {
    setShowEventQRModal(true);
  }, []);

  const handleShowRoleChange = useCallback((staff: ConfirmedStaff) => {
    setSelectedStaff(staff);
    setShowRoleChangeModal(true);
  }, []);

  const handleShowReport = useCallback((staff: ConfirmedStaff) => {
    setSelectedStaff(staff);
    setShowReportModal(true);
  }, []);

  const handleRoleChangeSave = useCallback(async (data: {
    staffId: string;
    workLogId: string;
    newRole: string;
    reason: string;
  }) => {
    try {
      changeRole({
        workLogId: data.workLogId,
        newRole: data.newRole,
        reason: data.reason,
      });
      addToast({
        type: 'success',
        message: '역할이 변경되었습니다.',
      });
      setShowRoleChangeModal(false);
      setSelectedStaff(null);
    } catch (err) {
      addToast({
        type: 'error',
        message: '역할 변경에 실패했습니다.',
      });
    }
  }, [changeRole, addToast]);

  const handleReportSubmit = useCallback(async (input: CreateReportInput) => {
    setIsSubmittingReport(true);
    try {
      // 신고 생성
      await reportService.createReport(input);

      // 노쇼 신고인 경우 WorkLog 상태도 변경
      if (input.type === 'no_show' && input.workLogId) {
        await markAsNoShow(input.workLogId, input.description);
      }

      addToast({
        type: 'success',
        message: '신고가 접수되었습니다.',
      });
      setShowReportModal(false);
      setSelectedStaff(null);
    } catch (err) {
      addToast({
        type: 'error',
        message: '신고 접수에 실패했습니다.',
      });
    } finally {
      setIsSubmittingReport(false);
    }
  }, [addToast]);

  // ============================================================================
  // 정산 관리 핸들러
  // ============================================================================

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
    startTime: Date | null;
    endTime: Date | null;
    reason: string;
  }) => {
    if (!selectedWorkLog) return;

    updateWorkTime({
      workLogId: selectedWorkLog.id,
      checkInTime: data.startTime,
      checkOutTime: data.endTime,
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

  // ============================================================================
  // Render
  // ============================================================================

  // 로딩 상태
  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900">
        <View className="flex-1 items-center justify-center">
          <Loading size="large" />
          <Text className="mt-4 text-gray-500 dark:text-gray-400">
            데이터를 불러오는 중...
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
          title="데이터를 불러올 수 없습니다"
          message={error.message}
          onRetry={() => refresh()}
        />
      </SafeAreaView>
    );
  }

  // 카운트 계산
  const staffCount = staffStats?.total ?? 0;
  const pendingSettlementCount = workLogs.filter(
    (log) => log.payrollStatus !== 'completed'
  ).length;

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900" edges={['bottom']}>
      {/* 탭 헤더 */}
      <TabHeader
        activeTab={activeTab}
        onTabChange={setActiveTab}
        staffCount={staffCount}
        settlementCount={pendingSettlementCount}
      />

      {/* 탭 컨텐츠 */}
      {activeTab === 'staff' ? (
        <StaffManagementTab
          jobPostingId={jobPostingId || ''}
          jobPosting={posting ?? undefined}
          onShowEventQR={handleShowEventQR}
          onShowRoleChange={handleShowRoleChange}
          onShowReport={handleShowReport}
        />
      ) : (
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
      )}

      {/* 모달들 */}

      {/* 현장 QR 모달 */}
      <EventQRModal
        visible={showEventQRModal}
        onClose={() => setShowEventQRModal(false)}
        jobPostingId={jobPostingId || ''}
        jobTitle={posting?.title}
      />

      {/* 역할 변경 모달 */}
      <RoleChangeModal
        visible={showRoleChangeModal}
        onClose={() => {
          setShowRoleChangeModal(false);
          setSelectedStaff(null);
        }}
        staff={selectedStaff}
        jobPosting={posting}
        availableRoles={availableRoles}
        onSave={handleRoleChangeSave}
      />

      {/* 신고 모달 */}
      <ReportModal
        visible={showReportModal}
        onClose={() => {
          setShowReportModal(false);
          setSelectedStaff(null);
        }}
        staff={selectedStaff}
        jobPostingId={jobPostingId || ''}
        jobPostingTitle={posting?.title}
        onSubmit={handleReportSubmit}
        isLoading={isSubmittingReport}
      />

      {/* 시간 수정 모달 (정산 탭용) */}
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
