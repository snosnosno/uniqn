/**
 * 이력 분류·필터 — 이벤트가 수백 건 쌓이면 "누가 언제 탈락했지"를 찾기 어렵다.
 * 분류는 이벤트 종류만 보고 정한다(payload 해석 없음). 새 종류는 기본 '설정' 으로 떨어진다.
 */
import type { OpsEventType } from '@/core/types/ops';

export type HistoryCategory = 'all' | 'player' | 'seat' | 'clock' | 'prize' | 'setup';

export const HISTORY_CATEGORIES: { value: HistoryCategory; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'player', label: '참가자' },
  { value: 'seat', label: '좌석·테이블' },
  { value: 'clock', label: '클럭' },
  { value: 'prize', label: '상금' },
  { value: 'setup', label: '설정·스태프' },
];

export function eventCategory(type: OpsEventType): Exclude<HistoryCategory, 'all'> {
  if (type.startsWith('player_') && type !== 'player_moved') return 'player';
  if (type === 'player_moved' || type.startsWith('seat_') || type.startsWith('table_')) {
    return type.startsWith('table_staff') ? 'setup' : 'seat';
  }
  if (type.startsWith('level_')) return 'clock';
  if (type.startsWith('prize_')) return 'prize';
  return 'setup';
}

export function filterEvents<T extends { type: OpsEventType }>(
  list: readonly T[],
  category: HistoryCategory
): T[] {
  return category === 'all' ? [...list] : list.filter((e) => eventCategory(e.type) === category);
}

/** 한 번에 더 불러오는 건수와 상한 — 상한 너머는 화면에서 찾을 일이 드물다. */
export const HISTORY_PAGE = 100;
export const HISTORY_MAX = 1000;
