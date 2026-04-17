/**
 * UNIQN Mobile - Board 카테고리 설정
 *
 * @description 게시판 타입별 CardStripe tone 매핑 (Phase 4 Tier B §B 카드 언어)
 *
 * - notice: 공지사항 → 골드 (하이라이트)
 * - schedule: 일정 → 블루 (확정/정보 톤)
 * - free: 자유 → 뮤트 (일반 톤)
 * - tda: TDA 토론 → 블루 (정보/토론)
 * - substitute: 대타 구인 → 워닝 (주의 유발)
 */

import type { CardStripeTone } from '@/components/ui';
import type { BoardType } from '@/types/board';

export const BOARD_TYPE_STRIPE_TONE: Record<BoardType, CardStripeTone> = {
  notice: 'gold',
  schedule: 'info',
  free: 'muted',
  tda: 'info',
  substitute: 'warning',
};
