/**
 * UNIQN Mobile - 정산 상세 모달 상수
 *
 * @description SettlementDetailModal에서 사용하는 상수 정의
 */

import { PAYROLL_STATUS_LABELS } from '@/shared/status';
import type { PayrollStatus } from '@/types';

/**
 * 정산 상태별 설정
 */
export const PAYROLL_STATUS_CONFIG: Record<
  PayrollStatus,
  {
    label: string;
    variant: 'default' | 'primary' | 'success' | 'warning' | 'error';
  }
> = {
  pending: { label: PAYROLL_STATUS_LABELS.pending, variant: 'warning' },
  processing: { label: PAYROLL_STATUS_LABELS.processing, variant: 'primary' },
  completed: { label: PAYROLL_STATUS_LABELS.completed, variant: 'success' },
  failed: { label: PAYROLL_STATUS_LABELS.failed, variant: 'error' },
};
