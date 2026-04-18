/**
 * UNIQN Mobile - Review Card 설정
 *
 * @description 리뷰 컨텍스트별 CardStripe tone 매핑 (Phase 4 Tier B §B 카드 언어)
 *
 * - pending / to-write: 골드 (액션 필요 — 평가 대기)
 * - history / written: 뮤트 (지나간 작업 — 이미 작성/수신된 리뷰)
 */

import type { CardStripeTone } from '@/components/ui';

export type ReviewCardContext = 'pending' | 'history';

export const REVIEW_CONTEXT_STRIPE_TONE: Record<ReviewCardContext, CardStripeTone> = {
  pending: 'gold',
  history: 'muted',
};
