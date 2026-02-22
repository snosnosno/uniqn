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
import { doc, updateDoc, serverTimestamp, arrayUnion, getFirebaseDb } from '@/lib/firebase';
import {
  SettlementList,
  WorkTimeEditor,
  StaffManagementTab,
  EventQRModal,
  RoleChangeModal,
  ReportModal,
  SettlementDetailModal,
  SettlementEditModal,
  SettlementSettingsModal,
  type SettlementEditData,
  type SettlementSettingsData,
} from '@/components/employer';
import { ConfirmModal } from '@/components/ui/Modal';
import { Loading, ErrorState } from '@/components';
import { useSettlement } from '@/hooks/useSettlement';
import { useJobDetail } from '@/hooks/useJobDetail';
import { useConfirmedStaff } from '@/hooks/useConfirmedStaff';
import { useToastStore } from '@/stores/toastStore';
import { reportService, markAsNoShow } from '@/services';
import { isDuplicateReportError, isCannotReportSelfError } from '@/errors';
import { UsersIcon, CurrencyYenIcon } from '@/components/icons';
import { STATUS } from '@/constants';
import { logger } from '@/utils/logger';
import {
  type SalaryInfo,
  getRoleSalaryFromRoles,
  calculateSettlementFromWorkLog,
  getEffectiveSalaryInfoFromRoles,
  getEffectiveAllowances,
  getEffectiveTaxSettings,
} from '@/utils/settlement';
import type {
  WorkLog,
  Allowances,
  ConfirmedStaff,
  CreateReportInput,
  GroupedSettlement,
} from '@/types';

// ============================================================================
// Constants
// ============================================================================

type TabType = 'staff' | 'settlement';

/** SheetModal 닫기 애니메이션(250ms) + 여유(50ms) 후 다음 모달 열기 */
const MODAL_TRANSITION_DELAY_MS = 300;

// ============================================================================
// Types
// ============================================================================

/** 역할 + 급여 정보 (SettlementList에 전달) */
interface RoleWithSalary {
  role?: string;
  name?: string;
  customRole?: string;
  salary?: SalaryInfo;
}

interface SalaryConfig {
  useSameSalary?: boolean;
  defaultSalary?: SalaryInfo;
  roles?: RoleWithSalary[];
  allowances?: Allowances;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * 근무 기록 금액 계산 (통합 유틸리티 사용)
 * - 시급: 근무시간 × 시급
 * - 일급/월급: 전액
 * - 수당, 세금 포함
 */
function calculateWorkLogAmount(
  workLog: WorkLog & { customRole?: string },
  roles: RoleWithSalary[],
  defaultSalary?: SalaryInfo,
  allowances?: Allowances
): number {
  // 역할에 따른 급여 정보 결정 (커스텀 역할 지원)
  const salaryInfo = getRoleSalaryFromRoles(roles, workLog.role, workLog.customRole, defaultSalary);

  // 통합 유틸리티로 정산 금액 계산 (수당, 세금 포함)
  const { taxAmount, afterTaxPay, totalPay } = calculateSettlementFromWorkLog(
    workLog,
    salaryInfo,
    allowances
  );

  // 세금이 있으면 세후 금액, 없으면 세전 금액 반환
  return taxAmount > 0 ? afterTaxPay : totalPay;
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
    <View className="flex-row bg-white dark:bg-surface border-b border-gray-200 dark:border-surface-overlay">
      <Pressable
        onPress={() => onTabChange('staff')}
        className="flex-1 flex-row items-center justify-center py-4"
        style={{
          borderBottomWidth: activeTab === 'staff' ? 2 : 0,
          borderBottomColor: '#4F46E5',
        }}
      >
        <UsersIcon size={20} color={activeTab === 'staff' ? '#9333EA' : '#6B7280'} />
        <Text
          className="ml-2 text-base font-medium"
          style={{
            color: activeTab === 'staff' ? '#4F46E5' : '#6B7280',
          }}
        >
          스태프 관리
        </Text>
        {staffCount > 0 && (
          <View
            className="ml-2 px-2 py-0.5 rounded-full"
            style={{
              backgroundColor: activeTab === 'staff' ? '#EEF2FF' : '#F3F4F6',
            }}
          >
            <Text
              className="text-xs font-medium"
              style={{
                color: activeTab === 'staff' ? '#4F46E5' : '#6B7280',
              }}
            >
              {staffCount}
            </Text>
          </View>
        )}
      </Pressable>

      <Pressable
        onPress={() => onTabChange('settlement')}
        className="flex-1 flex-row items-center justify-center py-4"
        style={{
          borderBottomWidth: activeTab === 'settlement' ? 2 : 0,
          borderBottomColor: '#4F46E5',
        }}
      >
        <CurrencyYenIcon size={20} color={activeTab === 'settlement' ? '#9333EA' : '#6B7280'} />
        <Text
          className="ml-2 text-base font-medium"
          style={{
            color: activeTab === 'settlement' ? '#4F46E5' : '#6B7280',
          }}
        >
          정산
        </Text>
        {settlementCount > 0 && (
          <View
            className="ml-2 px-2 py-0.5 rounded-full"
            style={{
              backgroundColor: activeTab === 'settlement' ? '#EEF2FF' : '#F3F4F6',
            }}
          >
            <Text
              className="text-xs font-medium"
              style={{
                color: activeTab === 'settlement' ? '#4F46E5' : '#6B7280',
              }}
            >
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
  const { job: posting, refresh: refreshJobDetail } = useJobDetail(jobPostingId || '');

  // 스태프 관리 훅
  const { stats: staffStats, changeRole } = useConfirmedStaff(jobPostingId || '');

  // 정산 관리 훅
  const {
    workLogs,
    isLoading,
    isRefreshing,
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
  const [selectedGroupForDetail, setSelectedGroupForDetail] = useState<GroupedSettlement | null>(
    null
  );
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

  // 정산 금액 수정 모달 상태
  const [isEditAmountModalVisible, setIsEditAmountModalVisible] = useState(false);
  const [selectedWorkLogForEdit, setSelectedWorkLogForEdit] = useState<WorkLog | null>(null);

  // 정산 설정 모달 상태
  const [isSettingsModalVisible, setIsSettingsModalVisible] = useState(false);

  // 급여 설정 (v2.0 - 역할별 급여, 수당 포함)
  const salaryConfig = useMemo<SalaryConfig>(
    () => ({
      useSameSalary: posting?.useSameSalary,
      defaultSalary: posting?.defaultSalary,
      roles:
        posting?.roles?.map((r) => ({
          role: r.role,
          customRole: r.customRole,
          salary: r.salary,
        })) || [],
      allowances: posting?.allowances,
    }),
    [posting?.useSameSalary, posting?.defaultSalary, posting?.roles, posting?.allowances]
  );

  // SettlementList용 역할 목록 (급여 포함)
  const rolesForList = useMemo<RoleWithSalary[]>(() => {
    return salaryConfig.roles || [];
  }, [salaryConfig.roles]);

  // RoleChangeModal용 역할 키 목록
  const availableRoles = useMemo((): string[] => {
    return rolesForList
      .map((r) => {
        const roleStr = (r.role || r.name) as string;
        if (roleStr === 'other' && r.customRole) {
          return r.customRole;
        }
        return roleStr;
      })
      .filter(Boolean) as string[];
  }, [rolesForList]);

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

  const handleRoleChangeSave = useCallback(
    async (data: { staffId: string; workLogId: string; newRole: string; reason: string }) => {
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
      } catch {
        addToast({
          type: 'error',
          message: '역할 변경에 실패했습니다.',
        });
      }
    },
    [changeRole, addToast]
  );

  const handleReportSubmit = useCallback(
    async (input: CreateReportInput) => {
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
      } catch (error) {
        logger.error('신고 접수 실패', error as Error, {
          type: input.type,
          targetId: input.targetId,
          jobPostingId: input.jobPostingId,
        });

        if (isDuplicateReportError(error)) {
          addToast({
            type: 'warning',
            message: '이미 해당 건에 대해 신고하셨습니다.',
          });
        } else if (isCannotReportSelfError(error)) {
          addToast({
            type: 'warning',
            message: '본인을 신고할 수 없습니다.',
          });
        } else {
          addToast({
            type: 'error',
            message: '신고 접수에 실패했습니다.',
          });
        }
      } finally {
        setIsSubmittingReport(false);
      }
    },
    [addToast]
  );

  // ============================================================================
  // 정산 관리 핸들러
  // ============================================================================

  // 근무기록 클릭 → 상세 모달 열기 (그룹 정보 포함)
  const handleWorkLogPress = useCallback((workLog: WorkLog, group: GroupedSettlement) => {
    setSelectedWorkLogForDetail(workLog);
    setSelectedGroupForDetail(group);
    setIsDetailModalVisible(true);
  }, []);

  // 날짜 변경 핸들러 (상세 모달 내 날짜 네비게이션)
  const handleDateChange = useCallback((workLog: WorkLog) => {
    setSelectedWorkLogForDetail(workLog);
    // selectedGroupForDetail은 유지 (같은 그룹 내 이동)
  }, []);

  // 시간 수정 클릭 (상세 모달에서)
  const handleEditTimeFromDetail = useCallback((workLog: WorkLog) => {
    // 상세 모달 닫기
    setIsDetailModalVisible(false);
    setSelectedWorkLogForDetail(null);
    // 닫기 애니메이션(250ms) 완료 후 시간 수정 모달 열기
    setTimeout(() => {
      setSelectedWorkLog(workLog);
      setIsEditModalVisible(true);
    }, MODAL_TRANSITION_DELAY_MS);
  }, []);

  // 정산하기 클릭 (상세 모달에서)
  const handleSettleFromDetail = useCallback(
    (workLog: WorkLog) => {
      // 상세 모달 닫기
      setIsDetailModalVisible(false);
      setSelectedWorkLogForDetail(null);
      // 닫기 애니메이션(250ms) 완료 후 정산 확인 모달 열기
      setTimeout(() => {
        const amount = calculateWorkLogAmount(
          workLog,
          rolesForList,
          salaryConfig.defaultSalary,
          salaryConfig.allowances
        );
        setSettleConfirm({
          visible: true,
          workLog,
          workLogs: [],
          amount,
          isBulk: false,
        });
      }, MODAL_TRANSITION_DELAY_MS);
    },
    [salaryConfig, rolesForList]
  );

  // 개별 정산 클릭 (v2.0 - 역할별 급여, 수당 적용)
  const handleSettle = useCallback(
    (workLog: WorkLog) => {
      const amount = calculateWorkLogAmount(
        workLog,
        rolesForList,
        salaryConfig.defaultSalary,
        salaryConfig.allowances
      );
      setSettleConfirm({
        visible: true,
        workLog,
        workLogs: [],
        amount,
        isBulk: false,
      });
    },
    [salaryConfig, rolesForList]
  );

  // 일괄 정산 클릭 (v2.0 - 역할별 급여, 수당 적용)
  const handleBulkSettle = useCallback(
    (selectedWorkLogs: WorkLog[]) => {
      if (selectedWorkLogs.length === 0) return;

      const totalAmount = selectedWorkLogs.reduce((sum, log) => {
        return (
          sum +
          calculateWorkLogAmount(
            log,
            rolesForList,
            salaryConfig.defaultSalary,
            salaryConfig.allowances
          )
        );
      }, 0);

      setSettleConfirm({
        visible: true,
        workLog: null,
        workLogs: selectedWorkLogs,
        amount: totalAmount,
        isBulk: true,
      });
    },
    [salaryConfig, rolesForList]
  );

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
  const handleSaveTimeEdit = useCallback(
    (data: { startTime: Date | null; endTime: Date | null; reason: string }) => {
      if (!selectedWorkLog) return;

      updateWorkTime({
        workLogId: selectedWorkLog.id,
        checkInTime: data.startTime,
        checkOutTime: data.endTime,
        reason: data.reason,
      });

      setIsEditModalVisible(false);
      setSelectedWorkLog(null);
    },
    [selectedWorkLog, updateWorkTime]
  );

  // 시간 수정 모달 닫기
  const handleCloseEditModal = useCallback(() => {
    setIsEditModalVisible(false);
    setSelectedWorkLog(null);
  }, []);

  // ============================================================================
  // 정산 설정/금액 수정 핸들러
  // ============================================================================

  // 정산 설정 모달 열기
  const handleOpenSettings = useCallback(() => {
    setIsSettingsModalVisible(true);
  }, []);

  // 금액 수정 (상세 모달에서)
  const handleEditAmountFromDetail = useCallback((workLog: WorkLog) => {
    // 상세 모달 닫기
    setIsDetailModalVisible(false);
    setSelectedWorkLogForDetail(null);
    // 닫기 애니메이션(250ms) 완료 후 금액 수정 모달 열기
    setTimeout(() => {
      setSelectedWorkLogForEdit(workLog);
      setIsEditAmountModalVisible(true);
    }, MODAL_TRANSITION_DELAY_MS);
  }, []);

  // 금액 수정 저장 (개인설정 - workLog에 저장)
  const handleSaveAmountEdit = useCallback(
    async (data: SettlementEditData) => {
      if (!selectedWorkLogForEdit) return;

      const { salaryInfo, allowances: customAllowances, taxSettings, reason } = data;

      try {
        logger.info('개인 정산 설정 저장 시작', {
          workLogId: selectedWorkLogForEdit.id,
          salaryInfo,
        });

        const workLogRef = doc(getFirebaseDb(), 'workLogs', selectedWorkLogForEdit.id);

        // 이전 값 저장 (수정 이력용)
        const previousSalaryInfo =
          (selectedWorkLogForEdit as WorkLog & { customSalaryInfo?: SalaryInfo })
            .customSalaryInfo ||
          getEffectiveSalaryInfoFromRoles(
            selectedWorkLogForEdit,
            rolesForList,
            salaryConfig.defaultSalary
          );
        const previousAllowances =
          (selectedWorkLogForEdit as WorkLog & { customAllowances?: Allowances })
            .customAllowances || salaryConfig.allowances;

        // 수정 이력 생성 (Firebase는 undefined를 허용하지 않으므로 필터링)
        const modificationEntry: Record<string, unknown> = {
          modifiedAt: new Date().toISOString(),
          modifiedBy: posting?.ownerId || 'unknown',
          reason: reason || '정산 금액 수정',
          newSalaryInfo: {
            type: salaryInfo.type,
            amount: salaryInfo.amount,
          },
          newTaxSettings: {
            type: taxSettings.type,
            value: taxSettings.value,
          },
        };

        // 이전 값이 있는 경우에만 추가 (undefined 방지)
        if (previousSalaryInfo) {
          modificationEntry.previousSalaryInfo = {
            type: previousSalaryInfo.type,
            amount: previousSalaryInfo.amount,
          };
        }
        if (previousAllowances && Object.keys(previousAllowances).length > 0) {
          modificationEntry.previousAllowances = previousAllowances;
        }
        if (customAllowances && Object.keys(customAllowances).length > 0) {
          modificationEntry.newAllowances = customAllowances;
        }

        await updateDoc(workLogRef, {
          customSalaryInfo: {
            type: salaryInfo.type,
            amount: salaryInfo.amount,
          },
          customAllowances: customAllowances,
          customTaxSettings: {
            type: taxSettings.type,
            value: taxSettings.value,
            ...(taxSettings.taxableItems && { taxableItems: taxSettings.taxableItems }),
          },
          settlementModificationHistory: arrayUnion(modificationEntry),
          updatedAt: serverTimestamp(),
        });

        logger.info('개인 정산 설정 저장 완료', { workLogId: selectedWorkLogForEdit.id });

        addToast({
          type: 'success',
          message: '정산 금액이 수정되었습니다.',
        });
        setIsEditAmountModalVisible(false);
        setSelectedWorkLogForEdit(null);
        refresh();
      } catch (error) {
        logger.error('개인 정산 설정 저장 실패', error as Error, {
          workLogId: selectedWorkLogForEdit.id,
        });
        addToast({
          type: 'error',
          message: '정산 금액 수정에 실패했습니다.',
        });
      }
    },
    [selectedWorkLogForEdit, rolesForList, salaryConfig, posting?.ownerId, addToast, refresh]
  );

  // 정산 설정 저장 (v2.0 - roles[] 구조) - jobPosting에 저장
  const handleSaveSettings = useCallback(
    async (data: SettlementSettingsData) => {
      if (!jobPostingId) return;

      const { roles: updatedRoles, allowances: updatedAllowances, taxSettings } = data;

      try {
        logger.info('정산 설정 저장 시작', {
          jobPostingId,
          rolesCount: updatedRoles.length,
        });

        const jobPostingRef = doc(getFirebaseDb(), 'jobPostings', jobPostingId);

        // 기존 roles 정보에 급여 정보만 업데이트
        // posting.roles의 count, filled 값은 유지하고 salary만 업데이트
        const mergedRoles =
          posting?.roles?.map((existingRole) => {
            // 역할 키 추출 (커스텀 역할 지원)
            // StaffRole 타입에 'other'가 없으므로 string으로 캐스팅
            const roleStr = existingRole.role as string;
            const existingRoleKey =
              roleStr === 'other' && existingRole.customRole
                ? existingRole.customRole
                : existingRole.role;

            // updatedRoles에서 매칭되는 역할 찾기
            const updatedRole = updatedRoles.find((r) => {
              const updatedRoleKey =
                r.role === 'other' && r.customRole ? r.customRole : r.role || r.name;
              return updatedRoleKey === existingRoleKey;
            });

            return {
              ...existingRole,
              salary: updatedRole?.salary || existingRole.salary,
            };
          }) ||
          updatedRoles.map((r) => ({
            role: r.role || r.name || 'dealer',
            customRole: r.customRole,
            count: 1,
            filled: 0,
            salary: r.salary,
          }));

        // Firebase에 저장 (새 형식 TaxSettings 사용)
        await updateDoc(jobPostingRef, {
          roles: mergedRoles,
          allowances: updatedAllowances,
          // TaxSettings 저장 (type, value, taxableItems 포함)
          taxSettings: {
            type: taxSettings.type,
            value: taxSettings.value,
            ...(taxSettings.taxableItems && { taxableItems: taxSettings.taxableItems }),
          },
          updatedAt: serverTimestamp(),
        });

        logger.info('정산 설정 저장 완료', { jobPostingId });

        addToast({
          type: 'success',
          message: '정산 설정이 저장되었습니다.',
        });
        setIsSettingsModalVisible(false);
        // 공고 정보와 정산 목록 모두 갱신
        await refreshJobDetail();
        refresh();
      } catch (error) {
        logger.error('정산 설정 저장 실패', error as Error, { jobPostingId });
        addToast({
          type: 'error',
          message: '정산 설정 저장에 실패했습니다.',
        });
      }
    },
    [jobPostingId, posting?.roles, addToast, refresh, refreshJobDetail]
  );

  // ============================================================================
  // Render
  // ============================================================================

  // 로딩 상태
  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-surface-dark" edges={['bottom']}>
        <View className="flex-1 items-center justify-center">
          <Loading size="large" />
          <Text className="mt-4 text-gray-500 dark:text-gray-400">데이터를 불러오는 중...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // 에러 상태
  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-surface-dark" edges={['bottom']}>
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
    (log) => log.payrollStatus !== STATUS.PAYROLL.COMPLETED
  ).length;

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-surface-dark" edges={['bottom']}>
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
          roles={rolesForList}
          defaultSalary={salaryConfig.defaultSalary}
          allowances={salaryConfig.allowances}
          taxSettings={posting?.taxSettings}
          isLoading={isLoading}
          error={error}
          onRefresh={() => refresh()}
          isRefreshing={isRefreshing}
          onWorkLogPress={handleWorkLogPress}
          onSettle={handleSettle}
          onBulkSettle={handleBulkSettle}
          showBulkActions={true}
          onOpenSettings={handleOpenSettings}
          enableGrouping={true}
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
          setSelectedGroupForDetail(null);
        }}
        workLog={selectedWorkLogForDetail}
        groupedSettlement={selectedGroupForDetail ?? undefined}
        onDateChange={handleDateChange}
        salaryInfo={getEffectiveSalaryInfoFromRoles(
          selectedWorkLogForDetail || {},
          rolesForList,
          salaryConfig.defaultSalary
        )}
        allowances={getEffectiveAllowances(selectedWorkLogForDetail || {}, salaryConfig.allowances)}
        taxSettings={getEffectiveTaxSettings(selectedWorkLogForDetail || {}, posting?.taxSettings)}
        onEditTime={handleEditTimeFromDetail}
        onEditAmount={handleEditAmountFromDetail}
        onSettle={handleSettleFromDetail}
        jobPostingTitle={posting?.title}
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

      {/* 정산 금액 수정 모달 */}
      <SettlementEditModal
        visible={isEditAmountModalVisible}
        onClose={() => {
          setIsEditAmountModalVisible(false);
          setSelectedWorkLogForEdit(null);
        }}
        workLog={selectedWorkLogForEdit}
        salaryInfo={getEffectiveSalaryInfoFromRoles(
          selectedWorkLogForEdit || {},
          rolesForList,
          salaryConfig.defaultSalary
        )}
        allowances={getEffectiveAllowances(selectedWorkLogForEdit || {}, salaryConfig.allowances)}
        taxSettings={getEffectiveTaxSettings(selectedWorkLogForEdit || {}, posting?.taxSettings)}
        onSave={handleSaveAmountEdit}
      />

      {/* 정산 설정 모달 */}
      <SettlementSettingsModal
        visible={isSettingsModalVisible}
        onClose={() => setIsSettingsModalVisible(false)}
        roles={rolesForList}
        allowances={salaryConfig.allowances || {}}
        taxSettings={posting?.taxSettings}
        onSave={handleSaveSettings}
      />
    </SafeAreaView>
  );
}
