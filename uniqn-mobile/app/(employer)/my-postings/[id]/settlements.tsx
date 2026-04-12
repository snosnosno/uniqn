/**
 * UNIQN Mobile - 스태프/정산 관리 화면
 * 특정 공고의 스태프 관리 및 정산
 *
 * @description v2.0 - 탭 구조 (스태프 관리 / 정산)
 * @version 2.1.0
 */

import { SECONDARY_PALETTE } from '@/constants/colors';
import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getPostingSettlementContext } from '@/domains/job-posting';
import {
  updateWorkLogCustomSettlement,
  updateJobPostingSettlementSettings,
  reportService,
  markAsNoShow,
} from '@/services';
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
import { useSettlementModals } from '@/hooks/useSettlementModals';
import { useToastStore } from '@/stores/toastStore';
import { useThemeStore } from '@/stores/themeStore';
import { isDuplicateReportError, isCannotReportSelfError } from '@/errors';
import { UsersIcon, CurrencyYenIcon } from '@/components/icons';
import { STATUS } from '@/constants';
import { logger } from '@/utils/logger';
import { isCanonicalDatedPosting } from '@/utils/jobPostingVisibility';
import {
  getRoleSalaryFromRoles,
  calculateSettlementFromWorkLog,
  getEffectiveSalaryInfoFromRoles,
  getEffectiveAllowances,
  getEffectiveTaxSettings,
} from '@/domains/settlement';
import { serializeTaxSettings, type SalaryInfo } from '@/utils/settlement';
import type { WorkLog, Allowances, CreateReportInput } from '@/types';

// ============================================================================
// Constants
// ============================================================================

type TabType = 'staff' | 'settlement';

// ============================================================================
// Types
// ============================================================================

/** 역할 + 급여 정보 (SettlementList에 전달) */
interface RoleWithSalary {
  role?: string;
  name?: string;
  customRole?: string;
  count?: number;
  filled?: number;
  salary?: SalaryInfo;
}

interface SalaryConfig {
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
  const { isDarkMode } = useThemeStore();
  const inactiveColor = isDarkMode ? SECONDARY_PALETTE[400] : SECONDARY_PALETTE[500];
  const primaryColor = isDarkMode ? '#D4AF37' : '#8A7228';
  const activeBadgeBg = isDarkMode ? '#2A2410' : '#F5EFDC';
  const inactiveBadgeBg = isDarkMode ? SECONDARY_PALETTE[800] : SECONDARY_PALETTE[100];

  return (
    <View className="flex-row bg-white dark:bg-surface border-b border-divider">
      <Pressable
        onPress={() => onTabChange('staff')}
        className="flex-1 flex-row items-center justify-center py-4"
        style={{
          borderBottomWidth: activeTab === 'staff' ? 2 : 0,
          borderBottomColor: primaryColor,
        }}
        accessibilityRole="tab"
        accessibilityLabel="스태프 관리"
        accessibilityState={{ selected: activeTab === 'staff' }}
      >
        <UsersIcon size={20} color={activeTab === 'staff' ? primaryColor : inactiveColor} />
        <Text
          className="ml-2 text-base font-sans-medium"
          style={{
            color: activeTab === 'staff' ? primaryColor : inactiveColor,
          }}
        >
          스태프 관리
        </Text>
        {staffCount > 0 && (
          <View
            className="ml-2 px-2 py-0.5 rounded-sm"
            style={{
              backgroundColor: activeTab === 'staff' ? activeBadgeBg : inactiveBadgeBg,
            }}
          >
            <Text
              className="text-xs font-sans-medium"
              style={{
                color: activeTab === 'staff' ? primaryColor : inactiveColor,
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
          borderBottomColor: primaryColor,
        }}
        accessibilityRole="tab"
        accessibilityLabel="정산"
        accessibilityState={{ selected: activeTab === 'settlement' }}
      >
        <CurrencyYenIcon
          size={20}
          color={activeTab === 'settlement' ? primaryColor : inactiveColor}
        />
        <Text
          className="ml-2 text-base font-sans-medium"
          style={{
            color: activeTab === 'settlement' ? primaryColor : inactiveColor,
          }}
        >
          정산
        </Text>
        {settlementCount > 0 && (
          <View
            className="ml-2 px-2 py-0.5 rounded-sm"
            style={{
              backgroundColor: activeTab === 'settlement' ? activeBadgeBg : inactiveBadgeBg,
            }}
          >
            <Text
              className="text-xs font-sans-medium"
              style={{
                color: activeTab === 'settlement' ? primaryColor : inactiveColor,
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

  // 튜토리얼

  // 탭 상태
  const [activeTab, setActiveTab] = useState<TabType>('settlement');

  // 공고 정보 (시급 포함)
  const { job: posting, refresh: refreshJobDetail } = useJobDetail(jobPostingId || '');
  const postingSettlement = useMemo(
    () => (posting ? getPostingSettlementContext(posting) : undefined),
    [posting]
  );

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

  // 모달 상태 관리
  const modals = useSettlementModals();

  // 급여 설정 (v2.0 - 역할별 급여, 수당 포함)
  const salaryConfig = useMemo<SalaryConfig>(
    () => ({
      defaultSalary: postingSettlement?.defaultSalary,
      roles:
        postingSettlement?.roles?.map((r) => ({
          role: r.role,
          customRole: r.customRole,
          count: r.count,
          filled: r.filled,
          salary: r.salary,
        })) || [],
      allowances: postingSettlement?.allowances,
    }),
    [postingSettlement]
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
        modals.closeRoleChangeModal();
      } catch {
        addToast({
          type: 'error',
          message: '역할 변경에 실패했습니다.',
        });
      }
    },
    [changeRole, addToast, modals]
  );

  const handleReportSubmit = useCallback(
    async (input: CreateReportInput) => {
      modals.setIsSubmittingReport(true);
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
        modals.closeReportModal();
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
        modals.setIsSubmittingReport(false);
      }
    },
    [addToast, modals]
  );

  // ============================================================================
  // 정산 관리 핸들러
  // ============================================================================

  // 정산하기 클릭 (상세 모달에서)
  const handleSettleFromDetail = useCallback(
    (workLog: WorkLog) => {
      const amount = calculateWorkLogAmount(
        workLog,
        rolesForList,
        salaryConfig.defaultSalary,
        salaryConfig.allowances
      );
      modals.openSettleFromDetail(workLog, amount);
    },
    [salaryConfig, rolesForList, modals]
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
      modals.openSettleConfirm({
        visible: true,
        workLog,
        workLogs: [],
        amount,
        isBulk: false,
      });
    },
    [salaryConfig, rolesForList, modals]
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

      modals.openSettleConfirm({
        visible: true,
        workLog: null,
        workLogs: selectedWorkLogs,
        amount: totalAmount,
        isBulk: true,
      });
    },
    [salaryConfig, rolesForList, modals]
  );

  // 정산 확인 모달에서 확인 클릭
  const handleConfirmSettle = useCallback(() => {
    if (modals.settleConfirm.isBulk) {
      // 일괄 정산
      const workLogIds = modals.settleConfirm.workLogs.map((log) => log.id);
      bulkSettle({ workLogIds });
    } else if (modals.settleConfirm.workLog) {
      // 개별 정산
      settleWorkLog({
        workLogId: modals.settleConfirm.workLog.id,
        amount: modals.settleConfirm.amount,
      });
    }
    modals.closeSettleConfirm();
  }, [modals, bulkSettle, settleWorkLog]);

  // 시간 수정 저장
  const handleSaveTimeEdit = useCallback(
    (data: { startTime: Date | null; endTime: Date | null; reason: string }) => {
      if (!modals.selectedWorkLog) return;

      updateWorkTime({
        workLogId: modals.selectedWorkLog.id,
        checkInTime: data.startTime,
        checkOutTime: data.endTime,
        reason: data.reason,
      });

      modals.closeEditModal();
    },
    [modals, updateWorkTime]
  );

  // ============================================================================
  // 정산 설정/금액 수정 핸들러
  // ============================================================================

  // 금액 수정 저장 (개인설정 - workLog에 저장)
  const handleSaveAmountEdit = useCallback(
    async (data: SettlementEditData) => {
      const workLogForEdit = modals.selectedWorkLogForEdit;
      if (!workLogForEdit || !posting?.ownerId) return;

      const { salaryInfo, allowances: customAllowances, taxSettings, reason } = data;

      try {
        // 이전 값 저장 (수정 이력용)
        const previousSalaryInfo =
          (workLogForEdit as WorkLog & { customSalaryInfo?: SalaryInfo }).customSalaryInfo ||
          getEffectiveSalaryInfoFromRoles(workLogForEdit, rolesForList, salaryConfig.defaultSalary);
        const previousAllowances =
          (workLogForEdit as WorkLog & { customAllowances?: Allowances }).customAllowances ||
          salaryConfig.allowances;

        // 수정 이력 생성 (Firebase는 undefined를 허용하지 않으므로 필터링)
        const modificationEntry: Record<string, unknown> = {
          modifiedAt: new Date().toISOString(),
          modifiedBy: posting.ownerId,
          reason: reason || '정산 금액 수정',
          newSalaryInfo: { type: salaryInfo.type, amount: salaryInfo.amount },
          newTaxSettings: { type: taxSettings.type, value: taxSettings.value },
        };

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

        await updateWorkLogCustomSettlement(
          workLogForEdit.id,
          {
            customSalaryInfo: { type: salaryInfo.type, amount: salaryInfo.amount },
            customAllowances: customAllowances as Record<string, unknown> | undefined,
            customTaxSettings: serializeTaxSettings(taxSettings),
            modificationEntry,
          },
          posting.ownerId
        );

        addToast({
          type: 'success',
          message: '정산 금액이 수정되었습니다.',
        });
        modals.closeEditAmountModal();
        refresh();
      } catch (error) {
        logger.error('개인 정산 설정 저장 실패', error as Error, {
          workLogId: workLogForEdit.id,
        });
        addToast({
          type: 'error',
          message: '정산 금액 수정에 실패했습니다.',
        });
      }
    },
    [modals, rolesForList, salaryConfig, posting?.ownerId, addToast, refresh]
  );

  // 정산 설정 저장 (v2.0 - roles[] 구조) - jobPosting에 저장
  const handleSaveSettings = useCallback(
    async (data: SettlementSettingsData) => {
      if (!jobPostingId || !posting?.ownerId) return;

      const { roles: updatedRoles, allowances: updatedAllowances, taxSettings } = data;

      try {
        // 기존 roles 정보에 급여 정보만 업데이트
        // posting.roles의 count, filled 값은 유지하고 salary만 업데이트
        const mergedRoles =
          salaryConfig.roles?.map((existingRole) => {
            const roleStr = existingRole.role as string;
            const existingRoleKey =
              roleStr === 'other' && existingRole.customRole
                ? existingRole.customRole
                : existingRole.role;

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

        await updateJobPostingSettlementSettings(
          jobPostingId,
          {
            roles: mergedRoles as Record<string, unknown>[],
            allowances: updatedAllowances as Record<string, unknown>,
            taxSettings: serializeTaxSettings(taxSettings),
          },
          posting.ownerId
        );

        addToast({
          type: 'success',
          message: '정산 설정이 저장되었습니다.',
        });
        modals.closeSettingsModal();
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
    [
      jobPostingId,
      salaryConfig.roles,
      posting?.ownerId,
      addToast,
      refresh,
      refreshJobDetail,
      modals,
    ]
  );

  // ============================================================================
  // Render
  // ============================================================================

  if (posting && !isCanonicalDatedPosting(posting)) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page" edges={['bottom']}>
        <ErrorState
          title="지원하지 않는 화면입니다"
          message="고정공고는 1차 범위에서 정산과 근무 운영을 지원하지 않습니다."
        />
      </SafeAreaView>
    );
  }

  // 로딩 상태
  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page" edges={['bottom']}>
        <View className="flex-1 items-center justify-center">
          <Loading size="large" />
          <Text className="mt-4 text-secondary-500 dark:text-secondary-400 font-sans">
            데이터를 불러오는 중...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // 에러 상태
  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page" edges={['bottom']}>
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
    <SafeAreaView className="flex-1 bg-surface-page" edges={['bottom']}>
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
          onShowEventQR={modals.openEventQRModal}
          onShowRoleChange={modals.openRoleChangeModal}
          onShowReport={modals.openReportModal}
        />
      ) : (
        <SettlementList
          workLogs={workLogs}
          roles={rolesForList}
          defaultSalary={salaryConfig.defaultSalary}
          allowances={salaryConfig.allowances}
          taxSettings={postingSettlement?.taxSettings}
          isLoading={isLoading}
          error={error}
          onRefresh={() => refresh()}
          isRefreshing={isRefreshing}
          onWorkLogPress={modals.openDetailModal}
          onSettle={handleSettle}
          onBulkSettle={handleBulkSettle}
          showBulkActions={true}
          onOpenSettings={modals.openSettingsModal}
          enableGrouping={true}
        />
      )}

      {/* 모달들 */}

      {/* 현장 QR 모달 */}
      <EventQRModal
        visible={modals.showEventQRModal}
        onClose={modals.closeEventQRModal}
        jobPostingId={jobPostingId || ''}
        jobTitle={posting?.title}
      />

      {/* 역할 변경 모달 */}
      <RoleChangeModal
        visible={modals.showRoleChangeModal}
        onClose={modals.closeRoleChangeModal}
        staff={modals.selectedStaff}
        jobPosting={posting}
        availableRoles={availableRoles}
        onSave={handleRoleChangeSave}
      />

      {/* 신고 모달 */}
      <ReportModal
        visible={modals.showReportModal}
        onClose={modals.closeReportModal}
        staff={modals.selectedStaff}
        jobPostingId={jobPostingId || ''}
        jobPostingTitle={posting?.title}
        onSubmit={handleReportSubmit}
        isLoading={modals.isSubmittingReport}
      />

      {/* 정산 상세 모달 */}
      <SettlementDetailModal
        visible={modals.isDetailModalVisible}
        onClose={modals.closeDetailModal}
        workLog={modals.selectedWorkLogForDetail}
        groupedSettlement={modals.selectedGroupForDetail ?? undefined}
        onDateChange={modals.handleDateChange}
        salaryInfo={getEffectiveSalaryInfoFromRoles(
          modals.selectedWorkLogForDetail || {},
          rolesForList,
          salaryConfig.defaultSalary
        )}
        allowances={getEffectiveAllowances(
          modals.selectedWorkLogForDetail || {},
          salaryConfig.allowances
        )}
        taxSettings={getEffectiveTaxSettings(
          modals.selectedWorkLogForDetail || {},
          postingSettlement?.taxSettings
        )}
        onEditTime={modals.openEditTimeFromDetail}
        onEditAmount={modals.openEditAmountFromDetail}
        onSettle={handleSettleFromDetail}
        jobPostingTitle={posting?.title}
      />

      {/* 시간 수정 모달 (정산 탭용) */}
      <WorkTimeEditor
        workLog={modals.selectedWorkLog}
        visible={modals.isEditModalVisible}
        onClose={modals.closeEditModal}
        onSave={handleSaveTimeEdit}
        isLoading={isUpdating}
      />

      {/* 정산 확인 모달 */}
      <ConfirmModal
        visible={modals.settleConfirm.visible}
        onClose={modals.closeSettleConfirm}
        onConfirm={handleConfirmSettle}
        title={modals.settleConfirm.isBulk ? '일괄 정산' : '정산 처리'}
        message={
          modals.settleConfirm.isBulk
            ? `${modals.settleConfirm.workLogs.length}건의 근무를 정산하시겠습니까?\n예상 금액: ${modals.settleConfirm.amount.toLocaleString()}원`
            : `이 스태프의 근무를 정산하시겠습니까?\n정산 금액: ${modals.settleConfirm.amount.toLocaleString()}원`
        }
        confirmText="정산하기"
        cancelText="취소"
      />

      {/* 정산 금액 수정 모달 */}
      <SettlementEditModal
        visible={modals.isEditAmountModalVisible}
        onClose={modals.closeEditAmountModal}
        workLog={modals.selectedWorkLogForEdit}
        salaryInfo={getEffectiveSalaryInfoFromRoles(
          modals.selectedWorkLogForEdit || {},
          rolesForList,
          salaryConfig.defaultSalary
        )}
        allowances={getEffectiveAllowances(
          modals.selectedWorkLogForEdit || {},
          salaryConfig.allowances
        )}
        taxSettings={getEffectiveTaxSettings(
          modals.selectedWorkLogForEdit || {},
          postingSettlement?.taxSettings
        )}
        onSave={handleSaveAmountEdit}
      />

      {/* 정산 설정 모달 */}
      <SettlementSettingsModal
        visible={modals.isSettingsModalVisible}
        onClose={modals.closeSettingsModal}
        roles={rolesForList}
        allowances={salaryConfig.allowances || {}}
        taxSettings={postingSettlement?.taxSettings}
        onSave={handleSaveSettings}
      />

      {/* 튜토리얼 오버레이 */}
    </SafeAreaView>
  );
}
