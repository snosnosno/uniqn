/**
 * UNIQN Mobile - 정산 화면 하단 모달 다발
 *
 * 시간 수정(`WorkTimeEditor`)과 역할 변경(`RoleChangeModal`)은 **통합 편집 시트로 수렴**했다.
 * 두 모달이 각각 다른 축을 저장하던 구조라, 같은 근무를 두 번 열어 두 번 저장해야 했고
 * 역할 이력이 경로에 따라 남거나 사라졌다(설계 결함 ③). 이제 한 시트가 RPC 한 번으로 쓴다.
 */

import React from 'react';
import {
  ReportModal,
  SettlementDetailModal,
  SettlementEditModal,
  SettlementSettingsModal,
  SettlementRevertModal,
  type SettlementEditData,
  type SettlementSettingsData,
} from '@/components/employer';
import { ConfirmModal } from '@/components/ui/Modal';
import { WorkLogEditSheet, type WorkLogEditInitial } from '@/components/workLogEdit';
import { useSettlementModals } from '@/hooks/useSettlementModals';
import {
  getEffectiveSalaryInfoFromRoles,
  getEffectiveAllowances,
  getEffectiveTaxSettings,
} from '@/domains/settlement';
import { readScheduledStart } from '@/domains/workSchedule';
import { TimeNormalizer } from '@/shared/time';
import type { PostingSettlementContext } from '@/domains/job-posting';
import type { WorkLog, CreateReportInput, JobPosting } from '@/types';
import { isStaffRole } from '@/types/role';
import type { RoleWithSalary, SalaryConfig } from '@/features/employer/settlements/settlementCalc';
import { formatNumber } from '@/utils/formatters';

type SettlementModalsState = ReturnType<typeof useSettlementModals>;

/**
 * 정산 근무 기록 → 통합 편집 시트 초기값.
 *
 * 🔴 `payrollStatus` 를 그대로 넘긴다 — 정산 완료 건은 시트가 **전체 읽기 전용**으로 연다(D4).
 * 🔑 `color` 는 `WorkLog` 에 없다(근무표 슬롯 색은 `work_logs.color` 지만 이 타입은 안 싣는다).
 *    없는 값을 지어내지 않고 null 을 준다 — 색을 건드리지 않으면 패치에 키도 생기지 않는다.
 */
function toEditInitial(
  workLog: WorkLog & { timeSlot?: string; color?: string }
): WorkLogEditInitial {
  return {
    ...readScheduledStart(workLog.timeSlot),
    checkIn: TimeNormalizer.parseTime(workLog.checkInTime),
    checkOut: TimeNormalizer.parseTime(workLog.checkOutTime),
    role: isStaffRole(workLog.role) ? workLog.role : 'staff',
    customRole: workLog.customRole ?? null,
    color: workLog.color ?? null,
    memo: workLog.notes ?? '',
    date: workLog.date,
    status: workLog.status,
    payrollStatus: workLog.payrollStatus ?? null,
    staffName: workLog.staffName ?? null,
  };
}

interface SettlementModalsProps {
  modals: SettlementModalsState;
  jobPostingId: string;
  posting: JobPosting | null;
  postingSettlement: PostingSettlementContext | undefined;
  rolesForList: RoleWithSalary[];
  salaryConfig: SalaryConfig;
  /**
   * 역할별 실확정 인원(aggregateRoleFilledFromSubmap 결과) — 시트의 역할 마감 **표기**용.
   * 표시만 하고 선택은 막지 않는다(D7 — 알고 넣는 것과 모르고 넣는 것은 다르다).
   */
  filledByRole?: Record<string, number>;
  /** 지급 완료 취소 진행 중 (SETTLE-3) */
  isReverting?: boolean;
  /** 지급 완료 취소 실행 — 사유는 서버가 필수로 강제한다. */
  onRevertSettlement: (reason: string) => void;
  onReportSubmit: (input: CreateReportInput) => void | Promise<void>;
  onSettleFromDetail: (workLog: WorkLog) => void;
  onConfirmSettle: () => void;
  onSaveAmountEdit: (data: SettlementEditData) => Promise<void>;
  onSaveSettings: (data: SettlementSettingsData) => Promise<void>;
}

export function SettlementModals({
  modals,
  jobPostingId,
  posting,
  postingSettlement,
  rolesForList,
  salaryConfig,
  filledByRole,
  isReverting,
  onRevertSettlement,
  onReportSubmit,
  onSettleFromDetail,
  onConfirmSettle,
  onSaveAmountEdit,
  onSaveSettings,
}: SettlementModalsProps) {
  return (
    <>
      {/* 신고 모달 */}
      <ReportModal
        visible={modals.showReportModal}
        onClose={modals.closeReportModal}
        staff={modals.selectedStaff}
        jobPostingId={jobPostingId}
        jobPostingTitle={posting?.title}
        onSubmit={onReportSubmit}
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
        onSettle={onSettleFromDetail}
        onRevertSettlement={modals.openRevertFromDetail}
        jobPostingTitle={posting?.title}
      />

      {/* 지급 완료 취소 모달 (SETTLE-3) */}
      <SettlementRevertModal
        visible={modals.isRevertModalVisible}
        onClose={modals.closeRevertModal}
        staffName={modals.selectedWorkLogForRevert?.staffName}
        payrollAmount={modals.selectedWorkLogForRevert?.payrollAmount}
        onConfirm={onRevertSettlement}
        isSubmitting={isReverting}
      />

      {/* 근무 수정 시트 (3개 진입점 공용) — 저장은 시트가 RPC 로 직접 한다.
          대상이 있을 때만 마운트한다(시트는 `[visible, workLogId]` 로만 초기화). */}
      {modals.isEditModalVisible && modals.selectedWorkLog ? (
        <WorkLogEditSheet
          visible
          onClose={modals.closeEditModal}
          workLogId={modals.selectedWorkLog.id}
          initial={toEditInitial(modals.selectedWorkLog)}
          jobPosting={posting}
          filledByRole={filledByRole}
        />
      ) : null}

      {/* 정산 확인 모달 */}
      <ConfirmModal
        visible={modals.settleConfirm.visible}
        onClose={modals.closeSettleConfirm}
        onConfirm={onConfirmSettle}
        title={modals.settleConfirm.isBulk ? '일괄 정산' : '정산 처리'}
        message={
          modals.settleConfirm.isBulk
            ? `${modals.settleConfirm.workLogs.length}건의 근무를 지급 완료로 표시할까요?\n예상 금액: ${formatNumber(modals.settleConfirm.amount)}원\n실제 이체는 앱 밖에서 진행해요.`
            : `이 스태프의 근무를 지급 완료로 표시할까요?\n정산 금액: ${formatNumber(modals.settleConfirm.amount)}원\n실제 이체는 앱 밖에서 진행해요.`
        }
        confirmText="지급 완료로 표시"
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
        onSave={onSaveAmountEdit}
      />

      {/* 정산 설정 모달 */}
      <SettlementSettingsModal
        visible={modals.isSettingsModalVisible}
        onClose={modals.closeSettingsModal}
        roles={rolesForList}
        allowances={salaryConfig.allowances || {}}
        taxSettings={postingSettlement?.taxSettings}
        onSave={onSaveSettings}
      />
    </>
  );
}
