/**
 * UNIQN Mobile - 구인자 컴포넌트 인덱스
 *
 * @description Phase 4 구인자 기능 UI 컴포넌트
 * @version 1.0.0
 */

// 지원자 관리
export { ApplicantCard as EmployerApplicantCard } from './applicants/ApplicantCard';
export type { ApplicantCardProps as EmployerApplicantCardProps } from './applicants/ApplicantCard';

export { ApplicantList, toApplicantFilter } from './applicants/ApplicantList';
export type { ApplicantListProps, FilterStatus } from './applicants/ApplicantList';

export { ApplicantConfirmModal } from './applicants/ConfirmModal';
export type { ApplicantConfirmModalProps, ConfirmModalAction } from './applicants/ConfirmModal';

export { ApplicantProfileModal } from './applicants/ApplicantProfileModal';
export type { ApplicantProfileModalProps } from './applicants/ApplicantProfileModal';

// 정산 관리
export { SettlementCard } from './settlement/SettlementCard';
export type { SettlementCardProps } from './settlement/SettlementCard';

export { GroupedSettlementCard } from './settlement/GroupedSettlementCard';
export type { GroupedSettlementCardProps } from './settlement/GroupedSettlementCard';

export { SettlementList } from './settlement/SettlementList';
export type { SettlementListProps } from './settlement/SettlementList';

export { SettlementDetailModal } from './settlement/SettlementDetailModal';
export type { SettlementDetailModalProps } from './settlement/SettlementDetailModal';

export { SettlementEditModal } from './settlement/SettlementEditModal';
export type {
  SettlementEditModalProps,
  SettlementEditData,
} from './settlement/SettlementEditModal';

export { SettlementRevertModal } from './settlement/SettlementRevertModal';
export type { SettlementRevertModalProps } from './settlement/SettlementRevertModal';

export { SettlementSettingsModal } from './settlement/SettlementSettingsModal';
export type {
  SettlementSettingsModalProps,
  SettlementSettingsData,
} from './settlement/SettlementSettingsModal';

// 정산 서브 컴포넌트
export { SalaryTypeSelector } from './settlement/SalaryTypeSelector';
export type { SalaryTypeSelectorProps } from './settlement/SalaryTypeSelector';

export { AllowanceEditor } from './settlement/AllowanceEditor';
export type { AllowanceEditorProps } from './settlement/AllowanceEditor';

export { TaxSettingsEditor } from './settlement/TaxSettingsEditor';
export type { TaxSettingsEditorProps, TaxSettings, TaxType } from './settlement/TaxSettingsEditor';

// 근무 수정(시간·역할·색·메모)은 `@/components/workLogEdit` 의 통합 시트가 담당한다.
// 정산 전용 `WorkTimeEditor` 는 폐지됐다 — 같은 근무를 화면마다 다른 축으로 저장하던 원인.

// 취소 요청 관리
export { CancellationRequestCard } from './applicants/CancellationRequestCard';
export type { CancellationRequestCardProps } from './applicants/CancellationRequestCard';

// 확정 스태프 관리 (v2.0)
export { ConfirmedStaffCard } from './applicants/ConfirmedStaffCard';
export type { ConfirmedStaffCardProps } from './applicants/ConfirmedStaffCard';

export { ConfirmedStaffList } from './applicants/ConfirmedStaffList';
export type { ConfirmedStaffListProps } from './applicants/ConfirmedStaffList';

export { StaffManagementTab } from './applicants/StaffManagementTab';
export type { StaffManagementTabProps } from './applicants/StaffManagementTab';

// 역할 변경 전용 모달은 폐지됐다 — 역할은 통합 편집 시트가 다른 축과 같은 RPC 로 저장한다.

// 신고
export { ReportModal } from './ReportModal';
export type { ReportModalProps } from './ReportModal';

// 스태프 프로필
export { StaffProfileModal } from './applicants/StaffProfileModal';

// 공고 카드/뷰
export { JobPostingCard, type JobPostingCardProps } from './posting/JobPostingCard';
export { NonEmployerView } from './posting/NonEmployerView';
