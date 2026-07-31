/**
 * UNIQN Mobile - SettlementCard 설정
 *
 * @description 정산 상태별 단일 설정 소스 (label + Badge variant + CardStripe tone)
 * @version 2.0.0
 */

import type { BadgeVariant } from '@/components/ui/Badge';
import type { CardStripeTone } from '@/components/ui';
import { PAYROLL_STATUS_LABELS } from '@/shared/status';
import type { SettlementDisplayStatus } from '@/shared/status';

/**
 * 정산 표시 상태 → UI 설정 단일 소스.
 *
 * - label: Badge 및 접근성에 노출되는 한글 라벨
 * - variant: Badge 색상 variant
 * - stripeTone: CardStripe tone (Phase 3 Tier A §B 카드 언어)
 *   - pending: 미정산 → 골드 (대기/액션 필요)
 *   - completed: 정산완료 → 뮤트 (지나간 작업)
 *
 * 🔑 키가 `PayrollStatus`(3값) 가 아니라 `SettlementDisplayStatus`(2값) 다.
 *    인덱싱 전에 `toSettlementDisplayStatus()` 로 접어라.
 */
export const PAYROLL_STATUS_CONFIG: Record<
  SettlementDisplayStatus,
  {
    label: string;
    variant: BadgeVariant;
    stripeTone: CardStripeTone;
  }
> = {
  pending: { label: PAYROLL_STATUS_LABELS.pending, variant: 'warning', stripeTone: 'gold' },
  completed: { label: PAYROLL_STATUS_LABELS.completed, variant: 'success', stripeTone: 'muted' },
};
