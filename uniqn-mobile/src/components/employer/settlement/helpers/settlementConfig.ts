/**
 * UNIQN Mobile - SettlementCard 설정
 *
 * @description 정산 상태별 stripe tone 매핑 (Phase 3 Tier A §B 카드 언어)
 * @version 1.0.0
 */

import type { CardStripeTone } from '@/components/ui';
import type { PayrollStatus } from '@/types';

/**
 * 정산 상태 → CardStripe tone 매핑.
 *
 * - pending: 미정산 → 골드 (대기/액션 필요)
 * - processing: 처리중 → 블루 (진행/정보 톤)
 * - completed: 정산완료 → 뮤트 (지나간 작업)
 */
export const PAYROLL_STATUS_STRIPE_TONE: Record<PayrollStatus, CardStripeTone> = {
  pending: 'gold',
  processing: 'info',
  completed: 'muted',
};
