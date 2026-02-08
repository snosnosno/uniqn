/**
 * UNIQN Mobile - 구인자 컴포넌트 인덱스
 *
 * @description Phase 4 구인자 기능 UI 컴포넌트
 * @version 1.0.0
 */

// 지원자 관리
export { ApplicantCard as EmployerApplicantCard } from './applicants/ApplicantCard';
export type { ApplicantCardProps as EmployerApplicantCardProps } from './applicants/ApplicantCard';

export { ApplicantList } from './applicants/ApplicantList';
export type { ApplicantListProps } from './applicants/ApplicantList';

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
export type { SettlementEditModalProps, SettlementEditData } from './settlement/SettlementEditModal';

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

// 시간 수정
export { WorkTimeEditor } from './settlement/WorkTimeEditor';
export type { WorkTimeEditorProps } from './settlement/WorkTimeEditor';

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

// 현장 QR 코드
export { EventQRModal } from './qr/EventQRModal';
export type { EventQRModalProps } from './qr/EventQRModal';

// 역할 변경
export { RoleChangeModal } from './applicants/RoleChangeModal';
export type { RoleChangeModalProps } from './applicants/RoleChangeModal';

// 신고
export { ReportModal } from './ReportModal';
export type { ReportModalProps } from './ReportModal';

// 스태프 프로필
export { StaffProfileModal } from './applicants/StaffProfileModal';
