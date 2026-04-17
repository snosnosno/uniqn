/**
 * UNIQN Mobile - ApplicantCard 상수 정의
 *
 * @description 지원자 카드 컴포넌트 상수
 * @version 1.0.0
 */

import type { CardStripeTone } from '@/components/ui';
import type { ApplicationStatus } from '@/types';

// ============================================================================
// Constants
// ============================================================================

/**
 * 지원 상태 → CardStripe tone 매핑 (Phase 3 Tier A §B 카드 언어).
 *
 * - applied: 대기/검토 중 → 골드 (기본/지원 완료 어필)
 * - confirmed: 확정 → 블루 (정보/확정 톤)
 * - completed: 근무 완료 → 뮤트 (지나간 작업)
 * - cancelled: 취소 → 뮤트
 * - rejected: 거절 → 뮤트
 * - cancellation_pending: 취소 요청 중 → 워닝
 */
export const STATUS_STRIPE_TONE: Record<ApplicationStatus, CardStripeTone> = {
  applied: 'gold',
  confirmed: 'info',
  completed: 'muted',
  cancelled: 'muted',
  rejected: 'muted',
  cancellation_pending: 'warning',
};
