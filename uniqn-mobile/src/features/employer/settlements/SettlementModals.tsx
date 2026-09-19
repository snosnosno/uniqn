/**
 * UNIQN Mobile - [근무] 화면 하단 모달 다발
 *
 * 시간 수정(`WorkTimeEditor`)과 역할 변경(`RoleChangeModal`)은 **통합 편집 시트로 수렴**했다.
 * 두 모달이 각각 다른 축을 저장하던 구조라, 같은 근무를 두 번 열어 두 번 저장해야 했고
 * 역할 이력이 경로에 따라 남거나 사라졌다(설계 결함 ③). 이제 한 시트가 RPC 한 번으로 쓴다.
 *
 * 구인자 IA S2 — 지급 완료 확인 모달과 지급 완료 취소 모달을 없앴다. 앱은 돈을 보내지 않는다.
 */

import React from 'react';
import {
  ReportModal,
  SettlementDetailModal,
  SettlementEditModal,
  SettlementSettingsModal,
  type SettlementEditData,
  type SettlementSettingsData,
} from '@/components/employer';
import { WorkLogEditSheet, type WorkLogEditInitial } from '@/components/workLogEdit';
import { useSettlementModals } from '@/hooks/useSettlementModals';
import { useUser } from '@/stores/authStore';
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

type SettlementModalsState = ReturnType<typeof useSettlementModals>;

/**
 * 근무 기록 → 통합 편집 시트 초기값.
 *
 * 🔴 `payrollStatus` 를 그대로 넘긴다 — 과거에 확정된 금액이 있는 행은 시트가 **전체 읽기 전용**으로 연다(D4).
 * 🔑 `timeSlot`·`color`·`notes` 는 전부 `WorkLog` 에 실려 있다(`types/schedule.ts:501-507`) —
 *    세 진입점이 같은 축을 채운다. 다만 선택 필드라 미기록이면 null/빈 문자열로 떨어진다.
 */
function toEditInitial(workLog: WorkLog): WorkLogEditInitial {
  return {
    ...readScheduledStart(workLog.timeSlot),
    checkIn: TimeNormalizer.parseTime(workLog.checkInTime),
    checkOut: TimeNormalizer.parseTime(workLog.checkOutTime),
    checkInScannedAt: TimeNormalizer.parseTime(workLog.checkInScannedAt),
    checkOutScannedAt: TimeNormalizer.parseTime(workLog.checkOutScannedAt),
    modificationHistory: workLog.modificationHistory ?? [],
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
  onReportSubmit: (input: CreateReportInput) => void | Promise<void>;
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
  onReportSubmit,
  onSaveAmountEdit,
  onSaveSettings,
}: SettlementModalsProps) {
  // 🔑 시트에 `editedBy` 를 넘기지 않으면 패치에 그 키가 아예 빠진다. 서버는 값을 `auth.uid()` 로
  //    덮어쓰지만 **키가 없으면 퇴근 시각을 쓸 때만 `edited_by` 를 세우는 비대칭**이 남아
  //    (`ConfirmedStaffRepository.ts:382`), 출근만 고친 저장은 행위자가 기록되지 않는다.
  //    근무표(`VenueDayPanel`)만 넘기고 있던 것을 세 진입점에 맞춘다.
  const user = useUser();
  const editedBy = user?.uid;

  return (
    <>
      <ReportModal
        visible={modals.showReportModal}
        onClose={modals.closeReportModal}
        staff={modals.selectedStaff}
        jobPostingId={jobPostingId}
        jobPostingTitle={posting?.title}
        onSubmit={onReportSubmit}
        isLoading={modals.isSubmittingReport}
      />

      {/* 계산 근거 모달 */}
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
        jobPostingTitle={posting?.title}
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
          editedBy={editedBy}
        />
      ) : null}

      {/* 근무 금액 수정 모달 */}
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

      {/* 급여 설정 모달 */}
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
