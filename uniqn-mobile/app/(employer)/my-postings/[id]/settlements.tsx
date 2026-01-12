/**
 * UNIQN Mobile - 스태프/정산 관리 화면
 * 특정 공고의 스태프 관리 및 정산
 *
 * @description v2.0 - 탭 구조 (스태프 관리 / 정산)
 * @version 2.1.0
 */

import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  SettlementList,
  WorkTimeEditor,
  StaffManagementTab,
  EventQRModal,
  RoleChangeModal,
  ReportModal,
  SettlementDetailModal,
} from '@/components/employer';
import { ConfirmModal } from '@/components/ui/Modal';
import { Loading, ErrorState } from '@/components';
import { useSettlement } from '@/hooks/useSettlement';
import { useJobDetail } from '@/hooks/useJobDetail';
import { useConfirmedStaff } from '@/hooks/useConfirmedStaff';
import { useToastStore } from '@/stores/toastStore';
import { reportService, markAsNoShow } from '@/services';
import { UsersIcon, CurrencyYenIcon } from '@/components/icons';
import {
  type SalaryInfo,
  getRoleSalaryInfo,
  calculateSettlementFromWorkLog,
} from '@/utils/settlement';
import type { WorkLog, Allowances, ConfirmedStaff, CreateReportInput } from '@/types';

// ============================================================================
// Constants
// ============================================================================

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

/**
 * 근무 기록 금액 계산 (통합 유틸리티 사용)
 * - 시급: 근무시간 × 시급
 * - 일급/월급: 전액
 * - 수당 포함
 */
function calculateWorkLogAmount(
  workLog: WorkLog,
  roleSalaries: Record<string, SalaryInfo>,
  allowances?: Allowances
): number {
  // 역할에 따른 급여 정보 결정 (통합 유틸리티 사용)
  const salaryInfo = getRoleSalaryInfo(workLog.role, roleSalaries);

  // 통합 유틸리티로 정산 금액 계산 (수당 포함)
  const { totalPay } = calculateSettlementFromWorkLog(workLog, salaryInfo, allowances);

  return totalPay;
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

  // 정산 상세 모달 상태
  const [selectedWorkLogForDetail, setSelectedWorkLogForDetail] = useState<WorkLog | null>(null);
  const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);

  // 정산 확인 모달 상태
  const [settleConfirm, setSettleConfirm] = useState<{
    visible: boolean;
    workLog: WorkLog | null;
    workLogs: WorkLog[];
    amount: number;
    isBulk: boolean;
  }>({
    visible: false,
    workLog: null,
    workLogs: [],
    amount: 0,
    isBulk: false,
  });

  // 모달 상태 (스태프 관리)
  const [showEventQRModal, setShowEventQRModal] = useState(false);
  const [showRoleChangeModal, setShowRoleChangeModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<ConfirmedStaff | null>(null);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  // 급여 설정 (v2.0 - 역할별 급여, 수당 포함)
  const salaryConfig = useMemo<SalaryConfig>(() => ({
    useSameSalary: posting?.useSameSalary,
    salary: posting?.salary ? { type: posting.salary.type, amount: posting.salary.amount } : undefined,
    roleSalaries: posting?.roleSalaries,
    allowances: posting?.allowances,
  }), [posting?.useSameSalary, posting?.salary, posting?.roleSalaries, posting?.allowances]);

  // SettlementList용 역할별 급여 정보
  const roleSalariesForList = useMemo(() => {
    // 기본 급여 (공고에서 설정한 급여, 없으면 15,000원 시급)
    const defaultSalary: SalaryInfo = posting?.salary
      ? { type: posting.salary.type, amount: posting.salary.amount }
      : { type: 'hourly', amount: 15000 };

    const roles = ['dealer', 'floor', 'manager', 'chiprunner', 'admin'];
    const roleSalaries = salaryConfig.roleSalaries;

    // 역할별 급여가 있고, useSameSalary가 명시적으로 true가 아니면 역할별 급여 사용
    if (roleSalaries && Object.keys(roleSalaries).length > 0 && salaryConfig.useSameSalary !== true) {
      // 누락된 역할은 기본 급여로 채움
      return roles.reduce((acc, role) => {
        acc[role] = roleSalaries[role] ?? defaultSalary;
        return acc;
      }, {} as Record<string, SalaryInfo>);
    }

    // 그 외에는 기본 급여를 모든 역할에 적용
    return roles.reduce((acc, role) => {
      acc[role] = defaultSalary;
      return acc;
    }, {} as Record<string, SalaryInfo>);
  }, [salaryConfig.useSameSalary, salaryConfig.roleSalaries, posting?.salary]);

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

  // 근무기록 클릭 → 상세 모달 열기
  const handleWorkLogPress = useCallback((workLog: WorkLog) => {
    setSelectedWorkLogForDetail(workLog);
    setIsDetailModalVisible(true);
  }, []);

  // 시간 수정 클릭 (상세 모달에서)
  const handleEditTimeFromDetail = useCallback((workLog: WorkLog) => {
    // 상세 모달 닫기
    setIsDetailModalVisible(false);
    setSelectedWorkLogForDetail(null);
    // 시간 수정 모달 열기
    setSelectedWorkLog(workLog);
    setIsEditModalVisible(true);
  }, []);

  // 정산하기 클릭 (상세 모달에서)
  const handleSettleFromDetail = useCallback((workLog: WorkLog) => {
    // 상세 모달 닫기
    setIsDetailModalVisible(false);
    setSelectedWorkLogForDetail(null);
    // 정산 확인 모달 열기
    const amount = calculateWorkLogAmount(workLog, roleSalariesForList, salaryConfig.allowances);
    setSettleConfirm({
      visible: true,
      workLog,
      workLogs: [],
      amount,
      isBulk: false,
    });
  }, [salaryConfig]);

  // 개별 정산 클릭 (v2.0 - 역할별 급여, 수당 적용)
  const handleSettle = useCallback((workLog: WorkLog) => {
    const amount = calculateWorkLogAmount(workLog, roleSalariesForList, salaryConfig.allowances);
    setSettleConfirm({
      visible: true,
      workLog,
      workLogs: [],
      amount,
      isBulk: false,
    });
  }, [salaryConfig]);

  // 일괄 정산 클릭 (v2.0 - 역할별 급여, 수당 적용)
  const handleBulkSettle = useCallback((selectedWorkLogs: WorkLog[]) => {
    if (selectedWorkLogs.length === 0) return;

    const totalAmount = selectedWorkLogs.reduce((sum, log) => {
      return sum + calculateWorkLogAmount(log, roleSalariesForList, salaryConfig.allowances);
    }, 0);

    setSettleConfirm({
      visible: true,
      workLog: null,
      workLogs: selectedWorkLogs,
      amount: totalAmount,
      isBulk: true,
    });
  }, [salaryConfig]);

  // 정산 확인 모달 닫기
  const handleCloseSettleConfirm = useCallback(() => {
    setSettleConfirm({
      visible: false,
      workLog: null,
      workLogs: [],
      amount: 0,
      isBulk: false,
    });
  }, []);

  // 정산 확인 모달에서 확인 클릭
  const handleConfirmSettle = useCallback(() => {
    if (settleConfirm.isBulk) {
      // 일괄 정산
      const workLogIds = settleConfirm.workLogs.map((log) => log.id);
      bulkSettle({ workLogIds });
    } else if (settleConfirm.workLog) {
      // 개별 정산
      settleWorkLog({
        workLogId: settleConfirm.workLog.id,
        amount: settleConfirm.amount,
      });
    }
    handleCloseSettleConfirm();
  }, [settleConfirm, bulkSettle, settleWorkLog, handleCloseSettleConfirm]);

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
          roleSalaries={roleSalariesForList}
          allowances={salaryConfig.allowances}
          isLoading={isLoading}
          error={error}
          onRefresh={() => refresh()}
          isRefreshing={false}
          onWorkLogPress={handleWorkLogPress}
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

      {/* 정산 상세 모달 */}
      <SettlementDetailModal
        visible={isDetailModalVisible}
        onClose={() => {
          setIsDetailModalVisible(false);
          setSelectedWorkLogForDetail(null);
        }}
        workLog={selectedWorkLogForDetail}
        salaryInfo={getRoleSalaryInfo(selectedWorkLogForDetail?.role, roleSalariesForList)}
        allowances={salaryConfig.allowances}
        onEditTime={handleEditTimeFromDetail}
        onSettle={handleSettleFromDetail}
      />

      {/* 시간 수정 모달 (정산 탭용) */}
      <WorkTimeEditor
        workLog={selectedWorkLog}
        visible={isEditModalVisible}
        onClose={handleCloseEditModal}
        onSave={handleSaveTimeEdit}
        isLoading={isUpdating}
      />

      {/* 정산 확인 모달 */}
      <ConfirmModal
        visible={settleConfirm.visible}
        onClose={handleCloseSettleConfirm}
        onConfirm={handleConfirmSettle}
        title={settleConfirm.isBulk ? '일괄 정산' : '정산 처리'}
        message={
          settleConfirm.isBulk
            ? `${settleConfirm.workLogs.length}건의 근무를 정산하시겠습니까?\n예상 금액: ${settleConfirm.amount.toLocaleString()}원`
            : `이 스태프의 근무를 정산하시겠습니까?\n정산 금액: ${settleConfirm.amount.toLocaleString()}원`
        }
        confirmText="정산하기"
        cancelText="취소"
      />
    </SafeAreaView>
  );
}
