/**
 * UNIQN Mobile - 스태프/정산 화면 핸들러 다발
 * StaffSettlementsScreen에서 추출. 클로저 의존(modals/posting/salaryConfig 등)은
 * 훅 인자로 주입해 useCallback deps를 보존한다.
 *
 * @description 핸들러 본문/deps 배열은 원본과 동일. 동작·토스트 문구 불변.
 */

import { useCallback } from 'react';
import {
  updateWorkLogCustomSettlement,
  updateJobPostingSettlementSettings,
  reportService,
  markAsNoShow,
} from '@/services';
import { type SettlementEditData, type SettlementSettingsData } from '@/components/employer';
import { useSettlementModals } from '@/hooks/useSettlementModals';
import { isDuplicateReportError, isCannotReportSelfError } from '@/errors';
import { logger } from '@/utils/logger';
import { getEffectiveSalaryInfoFromRoles } from '@/domains/settlement';
import { serializeTaxSettings, type SalaryInfo } from '@/utils/settlement';
import type { WorkLog, Allowances, CreateReportInput, UpdateStaffRoleInput } from '@/types';
import type { Toast } from '@/stores/toastStore';
import { calculateWorkLogAmount, type RoleWithSalary, type SalaryConfig } from './settlementCalc';

type SettlementModals = ReturnType<typeof useSettlementModals>;

interface UseStaffSettlementsHandlersParams {
  jobPostingId: string | undefined;
  modals: SettlementModals;
  salaryConfig: SalaryConfig;
  rolesForList: RoleWithSalary[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  refresh: () => void;
  refreshJobDetail: () => Promise<void> | void;
  changeRole: (input: UpdateStaffRoleInput) => void;
  updateWorkTime: (input: {
    workLogId: string;
    checkInTime: Date | null;
    checkOutTime: Date | null;
    reason: string;
  }) => void;
  settleWorkLog: (input: { workLogId: string; amount: number }) => void;
  bulkSettle: (input: { workLogIds: string[] }) => void;
}

export function useStaffSettlementsHandlers({
  jobPostingId,
  modals,
  salaryConfig,
  rolesForList,
  addToast,
  refresh,
  refreshJobDetail,
  changeRole,
  updateWorkTime,
  settleWorkLog,
  bulkSettle,
}: UseStaffSettlementsHandlersParams) {
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

  // 근무 기록 정산 금액 계산 (현재 급여 설정 적용)
  const computeWorkLogAmount = useCallback(
    (workLog: WorkLog) =>
      calculateWorkLogAmount(
        workLog,
        rolesForList,
        salaryConfig.defaultSalary,
        salaryConfig.allowances,
        salaryConfig.taxSettings
      ),
    [rolesForList, salaryConfig]
  );

  // 지급 완료 표시 클릭 (상세 모달에서)
  const handleSettleFromDetail = useCallback(
    (workLog: WorkLog) => {
      modals.openSettleFromDetail(workLog, computeWorkLogAmount(workLog));
    },
    [computeWorkLogAmount, modals]
  );

  // 개별 정산 클릭 (v2.0 - 역할별 급여, 수당 적용)
  const handleSettle = useCallback(
    (workLog: WorkLog) => {
      modals.openSettleConfirm({
        visible: true,
        workLog,
        workLogs: [],
        amount: computeWorkLogAmount(workLog),
        isBulk: false,
      });
    },
    [computeWorkLogAmount, modals]
  );

  // 일괄 정산 클릭 (v2.0 - 역할별 급여, 수당 적용)
  const handleBulkSettle = useCallback(
    (selectedWorkLogs: WorkLog[]) => {
      if (selectedWorkLogs.length === 0) return;

      const totalAmount = selectedWorkLogs.reduce((sum, log) => sum + computeWorkLogAmount(log), 0);

      modals.openSettleConfirm({
        visible: true,
        workLog: null,
        workLogs: selectedWorkLogs,
        amount: totalAmount,
        isBulk: true,
      });
    },
    [computeWorkLogAmount, modals]
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
      if (!workLogForEdit) return;

      const { salaryInfo, allowances: customAllowances, taxSettings, reason } = data;

      try {
        // 이전 값 저장 (수정 이력용)
        const previousSalaryInfo =
          (workLogForEdit as WorkLog & { customSalaryInfo?: SalaryInfo }).customSalaryInfo ||
          getEffectiveSalaryInfoFromRoles(workLogForEdit, rolesForList, salaryConfig.defaultSalary);
        const previousAllowances =
          (workLogForEdit as WorkLog & { customAllowances?: Allowances }).customAllowances ||
          salaryConfig.allowances;

        // 수정 이력 생성 (Supabase jsonb 저장 시 undefined 필드는 조건부로 제외)
        // modifiedBy는 서비스 계층이 세션 사용자로 기록한다
        const modificationEntry: Record<string, unknown> = {
          modifiedAt: new Date().toISOString(),
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

        await updateWorkLogCustomSettlement(workLogForEdit.id, {
          customSalaryInfo: { type: salaryInfo.type, amount: salaryInfo.amount },
          customAllowances: customAllowances as Record<string, unknown> | undefined,
          customTaxSettings: serializeTaxSettings(taxSettings),
          modificationEntry,
        });

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
    [modals, rolesForList, salaryConfig, addToast, refresh]
  );

  // 정산 설정 저장 (v2.0 - roles[] 구조) - jobPosting에 저장
  const handleSaveSettings = useCallback(
    async (data: SettlementSettingsData) => {
      if (!jobPostingId) return;

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

        await updateJobPostingSettlementSettings(jobPostingId, {
          roles: mergedRoles as Record<string, unknown>[],
          allowances: updatedAllowances as Record<string, unknown>,
          taxSettings: serializeTaxSettings(taxSettings),
        });

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
    [jobPostingId, salaryConfig.roles, addToast, refresh, refreshJobDetail, modals]
  );

  return {
    handleRoleChangeSave,
    handleReportSubmit,
    computeWorkLogAmount,
    handleSettleFromDetail,
    handleSettle,
    handleBulkSettle,
    handleConfirmSettle,
    handleSaveTimeEdit,
    handleSaveAmountEdit,
    handleSaveSettings,
  };
}
