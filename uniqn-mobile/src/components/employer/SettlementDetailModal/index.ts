/**
 * UNIQN Mobile - 정산 상세 모달 배럴 export
 *
 * @description SettlementDetailModal 폴더의 모든 컴포넌트 및 타입 export
 */

// Main Component
export { SettlementDetailModal, default } from './SettlementDetailModal';

// Sub-components
export { InfoRow } from './InfoRow';
export { ModificationHistoryItem } from './ModificationHistoryItem';
export { DateNavigationHeader } from './DateNavigationHeader';
export { StaffProfileHeader } from './StaffProfileHeader';
export { WorkTimeSection } from './WorkTimeSection';
export { SettlementAmountSection } from './SettlementAmountSection';
export { TimeModificationHistory } from './TimeModificationHistory';
export { AmountModificationHistory } from './AmountModificationHistory';
export { SettlementActionButtons } from './SettlementActionButtons';
export { SettlementCompletedBanner } from './SettlementCompletedBanner';

// Types
export type { SettlementDetailModalProps, InfoRowProps, ModificationHistoryItemProps } from './types';
export type { DateNavigationHeaderProps } from './DateNavigationHeader';
export type { StaffProfileHeaderProps } from './StaffProfileHeader';
export type { WorkTimeSectionProps } from './WorkTimeSection';
export type { SettlementAmountSectionProps } from './SettlementAmountSection';
export type { TimeModificationHistoryProps } from './TimeModificationHistory';
export type { AmountModificationHistoryProps, SettlementModification } from './AmountModificationHistory';
export type { SettlementActionButtonsProps } from './SettlementActionButtons';
export type { SettlementCompletedBannerProps } from './SettlementCompletedBanner';

// Constants
export { PAYROLL_STATUS_CONFIG } from './constants';

// Re-export settlement types for convenience
export type { SalaryType, SalaryInfo } from '@/utils/settlement';
