/**
 * UNIQN Mobile - 정산 상세 모달 타입
 *
 * @description SettlementDetailModal에서 사용하는 타입 정의
 */

import type { WorkLog, Allowances, GroupedSettlement } from '@/types';
import type { SalaryInfo, TaxSettings } from '@/utils/settlement';

/**
 * 정산 상세 모달 Props
 */
export interface SettlementDetailModalProps {
  visible: boolean;
  onClose: () => void;
  workLog: WorkLog | null;
  salaryInfo: SalaryInfo;
  allowances?: Allowances;
  /** 세금 설정 */
  taxSettings?: TaxSettings;
  onEditTime?: (workLog: WorkLog) => void;
  onEditAmount?: (workLog: WorkLog) => void;
  onSettle?: (workLog: WorkLog) => void;
  /** 통합 그룹 정보 (날짜 선택용) */
  groupedSettlement?: GroupedSettlement;
  /** 날짜 변경 콜백 */
  onDateChange?: (workLog: WorkLog) => void;
  /** 공고 제목 (평가 연동용) */
  jobPostingTitle?: string;
}

/**
 * 정보 행 Props
 */
export interface InfoRowProps {
  label: string;
  value: string;
  highlight?: boolean;
  valueColor?: string;
}

/**
 * 시간 수정 이력 아이템 Props
 */
export interface ModificationHistoryItemProps {
  modification: {
    modifiedAt?: unknown;
    reason?: string;
    modifiedBy?: string;
    previousStartTime?: unknown;
    previousEndTime?: unknown;
    newStartTime?: unknown;
    newEndTime?: unknown;
  };
  index: number;
}
