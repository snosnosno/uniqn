/**
 * UNIQN Mobile - 정산 상세 모달 상수
 *
 * @description SettlementDetailModal에서 사용하는 상수 정의
 */

import { PAYROLL_STATUS_LABELS } from '@/shared/status';
import type { SettlementDisplayStatus } from '@/shared/status';

/**
 * 정산 표시 상태별 설정 (2단 어휘).
 * 인덱싱 전에 `toSettlementDisplayStatus()` 로 접어라.
 */
export const PAYROLL_STATUS_CONFIG: Record<
  SettlementDisplayStatus,
  {
    label: string;
    variant: 'default' | 'primary' | 'success' | 'warning' | 'error';
  }
> = {
  pending: { label: PAYROLL_STATUS_LABELS.pending, variant: 'warning' },
  completed: { label: PAYROLL_STATUS_LABELS.completed, variant: 'success' },
};
