/**
 * UNIQN Mobile - Inquiry Card 설정
 *
 * @description 문의 상태별 CardStripe tone 매핑 (Phase 5 Tier C §B 카드 언어)
 *
 * - open: 골드 (접수됨 — 답변 대기, 액션 필요 컨텍스트)
 * - in_progress: 인포 (처리중 — 진행 중 상태)
 * - closed: 뮤트 (답변 완료 — 마감된 문의)
 */

import type { CardStripeTone } from '@/components/ui';
import type { InquiryStatus } from '@/types';

export const INQUIRY_STATUS_STRIPE_TONE: Record<InquiryStatus, CardStripeTone> = {
  open: 'gold',
  in_progress: 'info',
  closed: 'muted',
};
