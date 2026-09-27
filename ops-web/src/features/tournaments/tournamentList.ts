/**
 * 대회 목록 화면 로직 — 모바일 `app/(ops)/tournaments/index.tsx` 와 같은 규칙.
 * - 기본은 활성(보관 안 된) 대회만, 보관함 모드는 보관분만(섞으면 "치웠는데 그대로 보인다").
 * - `?postingId=` 이면 그 공고에 연결된 대회만.
 */
import type { OpsTournament, OpsTournamentStatus } from '@/core/types/ops';

export const STATUS_LABEL: Record<OpsTournamentStatus, string> = {
  upcoming: '예정',
  active: '진행 중',
  completed: '종료',
};

export function partitionTournaments(
  tournaments: readonly OpsTournament[],
  opts: { showArchived: boolean; postingId?: string | null }
): { visible: OpsTournament[]; archivedCount: number } {
  const scoped = opts.postingId
    ? tournaments.filter((t) => t.jobPostingId === opts.postingId)
    : [...tournaments];
  return {
    visible: scoped.filter((t) => (opts.showArchived ? !!t.archivedAt : !t.archivedAt)),
    archivedCount: scoped.filter((t) => !!t.archivedAt).length,
  };
}

/** 보조 메타 — 게임 · 장소 · 날짜(있는 값만). */
export function formatTournamentMeta(t: Pick<OpsTournament, 'gameType' | 'venue' | 'eventDate'>) {
  return [t.gameType, t.venue, t.eventDate].filter(Boolean).join(' · ');
}
