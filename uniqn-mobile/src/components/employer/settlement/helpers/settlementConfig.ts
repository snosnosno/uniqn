/**
 * UNIQN Mobile - SettlementCard 설정
 *
 * @description 정산 상태별 단일 설정 소스 (label + Badge variant + CardStripe tone)
 * @version 2.0.0
 */

import type { BadgeVariant } from '@/components/ui/Badge';
import type { CardStripeTone } from '@/components/ui';
import { PAYROLL_STATUS_LABELS } from '@/shared/status';
import type { PayrollStatus } from '@/types';

/**
 * 정산 상태 → UI 표시 설정 단일 소스.
 *
 * - label: Badge 및 접근성에 노출되는 한글 라벨
 * - variant: Badge 색상 variant
 * - stripeTone: CardStripe tone (Phase 3 Tier A §B 카드 언어)
 *   - pending: 미정산 → 골드 (대기/액션 필요)
 *   - processing: 처리중 → 블루 (진행/정보 톤)
 *   - completed: 정산완료 → 뮤트 (지나간 작업)
 */
export const PAYROLL_STATUS_CONFIG: Record<
  PayrollStatus,
  {
    label: string;
    variant: BadgeVariant;
    stripeTone: CardStripeTone;
  }
> = {
  pending: { label: PAYROLL_STATUS_LABELS.pending, variant: 'warning', stripeTone: 'gold' },
  processing: { label: PAYROLL_STATUS_LABELS.processing, variant: 'primary', stripeTone: 'info' },
  completed: { label: PAYROLL_STATUS_LABELS.completed, variant: 'success', stripeTone: 'muted' },
  failed: { label: PAYROLL_STATUS_LABELS.failed, variant: 'error', stripeTone: 'error' },
};
