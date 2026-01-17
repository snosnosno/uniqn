/**
 * UNIQN Mobile - ApplicantCard 상수 정의
 *
 * @description 지원자 카드 컴포넌트 상수
 * @version 1.0.0
 */

import type { ApplicationStatus } from '@/types';
import type { StatusBadgeVariant } from './types';

// ============================================================================
// Constants
// ============================================================================

/**
 * 지원 상태별 배지 variant 매핑
 */
export const STATUS_BADGE_VARIANT: Record<ApplicationStatus, StatusBadgeVariant> = {
  applied: 'primary',
  pending: 'warning',
  confirmed: 'success',
  rejected: 'error',
  cancelled: 'default',
  waitlisted: 'primary',
  completed: 'success',
  cancellation_pending: 'warning',
};
