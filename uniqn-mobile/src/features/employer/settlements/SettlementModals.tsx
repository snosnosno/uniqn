/**
 * UNIQN Mobile - 정산 화면 하단 모달 다발
 * StaffSettlementsScreen에서 추출. 모달 props·렌더 트리·문구 불변.
 */

import React from 'react';
import {
  WorkTimeEditor,
  RoleChangeModal,
  ReportModal,
  SettlementDetailModal,
  SettlementEditModal,
  SettlementSettingsModal,
  SettlementRevertModal,
  type SettlementEditData,
  type SettlementSettingsData,
} from '@/components/employer';
import { ConfirmModal } from '@/components/ui/Modal';
import { useSettlementModals } from '@/hooks/useSettlementModals';
import {
  getEffectiveSalaryInfoFromRoles,
  getEffectiveAllowances,
  getEffectiveTaxSettings,
} from '@/domains/settlement';
import type { PostingSettlementContext } from '@/domains/job-posting';
import type { WorkLog, CreateReportInput, JobPosting } from '@/types';
import type { RoleWithSalary, SalaryConfig } from '@/features/employer/settlements/settlementCalc';
import { formatNumber } from '@/utils/formatters';

type SettlementModalsState = ReturnType<typeof useSettlementModals>;

interface SettlementModalsProps {
  modals: SettlementModalsState;
  jobPostingId: string;
  posting: JobPosting | null;
  postingSettlement: PostingSettlementContext | undefined;
  rolesForList: RoleWithSalary[];
  salaryConfig: SalaryConfig;
  availableRoles: string[];
  /** 역할별 실확정 인원(aggregateRoleFilledFromSubmap 결과) — RoleChangeModal 마감 표시용. */
  filledByRole?: Record<string, number>;
  isUpdating: boolean;
  /** 지급 완료 취소 진행 중 (SETTLE-3) */
  isReverting?: boolean;
  /** 역할 변경 진행 중 — 성공에서만 닫히므로 모달이 열린 채 기다린다. 없으면 무피드백으로 멈춘 듯 보인다. */
  isChangingRole?: boolean;
  /** 지급 완료 취소 실행 — 사유는 서버가 필수로 강제한다. */
  onRevertSettlement: (reason: string) => void;
  onRoleChangeSave: (data: {
    staffId: string;
    workLogId: string;
    newRole: string;
    reason: string;
  }) => void | Promise<void>;
  onReportSubmit: (input: CreateReportInput) => void | Promise<void>;
  onSettleFromDetail: (workLog: WorkLog) => void;
  onConfirmSettle: () => void;
  onSaveTimeEdit: (data: { startTime: Date | null; endTime: Date | null; reason: string }) => void;
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
  availableRoles,
  filledByRole,
  isUpdating,
  isReverting,
  isChangingRole,
  onRevertSettlement,
  onRoleChangeSave,
  onReportSubmit,
  onSettleFromDetail,
  onConfirmSettle,
  onSaveTimeEdit,
  onSaveAmountEdit,
  onSaveSettings,
}: SettlementModalsProps) {
  return (
    <>
      {/* 역할 변경 모달 */}
      <RoleChangeModal
        visible={modals.showRoleChangeModal}
        onClose={modals.closeRoleChangeModal}
        staff={modals.selectedStaff}
        jobPosting={posting}
        availableRoles={availableRoles}
        filledByRole={filledByRole}
        onSave={onRoleChangeSave}
        isLoading={isChangingRole}
      />

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

      {/* 시간 수정 모달 (정산 탭용) */}
      <WorkTimeEditor
        workLog={modals.selectedWorkLog}
        visible={modals.isEditModalVisible}
        onClose={modals.closeEditModal}
        onSave={onSaveTimeEdit}
        isLoading={isUpdating}
      />

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
