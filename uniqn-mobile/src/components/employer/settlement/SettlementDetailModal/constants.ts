/**
 * UNIQN Mobile - 정산 상세 모달 상수
 *
 * @description SettlementDetailModal에서 사용하는 상수 정의
 */

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
  pending: { label: '미정산', variant: 'warning' },
  processing: { label: '처리중', variant: 'primary' },
  completed: { label: '정산완료', variant: 'success' },
};
