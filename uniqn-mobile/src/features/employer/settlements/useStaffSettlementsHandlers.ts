/**
 * UNIQN Mobile - [근무] 화면 핸들러 다발
 * StaffSettlementsScreen에서 추출. 클로저 의존(modals/posting/salaryConfig 등)은
 * 훅 인자로 주입해 useCallback deps를 보존한다.
 *
 * 구인자 IA S2 — 지급 완료 표시·일괄 정산·지급 완료 취소 핸들러를 없앴다. 앱은 돈을 보내지 않는다.
 * 남은 것은 신고·근무 금액 수정·급여 설정이다.
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
import type { WorkLog, Allowances, CreateReportInput } from '@/types';
import type { Toast } from '@/stores/toastStore';
import { type RoleWithSalary, type SalaryConfig } from './settlementCalc';
import { saveFailed } from '@/constants/messages';

type SettlementModals = ReturnType<typeof useSettlementModals>;

interface UseStaffSettlementsHandlersParams {
  jobPostingId: string | undefined;
  modals: SettlementModals;
  salaryConfig: SalaryConfig;
  rolesForList: RoleWithSalary[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  refresh: () => void;
  refreshJobDetail: () => Promise<void> | void;
}

export function useStaffSettlementsHandlers({
  jobPostingId,
  modals,
  salaryConfig,
  rolesForList,
  addToast,
  refresh,
  refreshJobDetail,
}: UseStaffSettlementsHandlersParams) {
  // ============================================================================
  // 스태프 관리 핸들러
  // ============================================================================

  // 역할 변경(STAFF-4) 핸들러는 여기 없다 — 역할은 통합 편집 시트가 다른 축과 **같은 RPC** 로
  // 저장한다. 별도 경로를 남기면 같은 축을 두 곳이 쓰고, 그중 한쪽만 이력을 남긴다(결함 ③).

  const handleReportSubmit = useCallback(
    async (input: CreateReportInput) => {
      modals.setIsSubmittingReport(true);
      try {
        await reportService.createReport(input);

        // 🔑 여기부터 신고 행은 **이미 존재한다**. 아래 실패를 바깥 catch 로 흘려보내면
        //    '신고 접수에 실패했습니다' 라는 거짓 안내가 나가고, 사용자가 재시도하면
        //    중복 신고로 막혀 빠져나갈 길이 없다(신고는 남고 노쇼만 안 된 고아 상태).
        //    신고는 되돌리지 않는다 — 감사 기록이고 클라에 삭제 권한도 없다.
        //    대신 접수 사실을 알리고 노쇼만 다시 하도록 후속 경로를 가리킨다.
        if (input.type === 'no_show' && input.workLogId) {
          try {
            await markAsNoShow(input.workLogId, input.description);
          } catch (noShowError) {
            logger.error('노쇼 신고 접수 후 상태 변경 실패', noShowError as Error, {
              targetId: input.targetId,
              jobPostingId: input.jobPostingId,
              workLogId: input.workLogId,
            });
            addToast({
              type: 'warning',
              message:
                '신고는 접수되었지만 노쇼 처리에 실패했습니다. 스태프 관리에서 상태를 변경해주세요.',
            });
            modals.closeReportModal();
            return;
          }
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

  // 시간 수정 저장 핸들러는 없다 — 통합 편집 시트가 `useUpdateSlot` 으로 직접 저장하고
  // 성공에서 스스로 닫는다. 여기서 한 번 더 쏘면 같은 저장이 두 경로로 갈라진다.

  // ============================================================================
  // 근무 금액 수정 / 급여 설정 핸들러
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
          reason: reason || '근무 금액 수정',
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
          message: '근무 금액이 수정되었습니다.',
        });
        modals.closeEditAmountModal();
        refresh();
      } catch (error) {
        logger.error('개인 정산 설정 저장 실패', error as Error, {
          workLogId: workLogForEdit.id,
        });
        addToast({
          type: 'error',
          message: '근무 금액 수정에 실패했습니다.',
        });
      }
    },
    [modals, rolesForList, salaryConfig, addToast, refresh]
  );

  // 급여 설정 저장 (v2.0 - roles[] 구조) - jobPosting에 저장
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
          message: '급여 설정이 저장되었습니다.',
        });
        modals.closeSettingsModal();
        await refreshJobDetail();
        refresh();
      } catch (error) {
        logger.error('정산 설정 저장 실패', error as Error, { jobPostingId });
        addToast({
          type: 'error',
          message: saveFailed('급여 설정'),
        });
      }
    },
    [jobPostingId, salaryConfig.roles, addToast, refresh, refreshJobDetail, modals]
  );

  return {
    handleReportSubmit,
    handleSaveAmountEdit,
    handleSaveSettings,
  };
}
