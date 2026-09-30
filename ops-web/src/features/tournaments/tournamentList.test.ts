import { describe, expect, it } from 'vitest';
import type { OpsTournament } from '@/core/types/ops';
import { STATUS_LABEL, formatTournamentMeta, partitionTournaments } from './tournamentList';

const t = (over: Partial<OpsTournament>): OpsTournament =>
  ({
    id: 'id',
    name: '대회',
    status: 'upcoming',
    archivedAt: null,
    jobPostingId: null,
    gameType: 'NLH',
    venue: null,
    eventDate: null,
    ...over,
  }) as OpsTournament;

describe('partitionTournaments', () => {
  const list = [
    t({ id: 'a', jobPostingId: 'p1' }),
    t({ id: 'b', archivedAt: '2026-09-01T00:00:00Z' }),
    t({ id: 'c', jobPostingId: 'p1', archivedAt: '2026-09-01T00:00:00Z' }),
    t({ id: 'd' }),
  ];

  it('기본은 활성만, 보관 개수는 따로', () => {
    const r = partitionTournaments(list, { showArchived: false });
    expect(r.visible.map((x) => x.id)).toEqual(['a', 'd']);
    expect(r.archivedCount).toBe(2);
  });

  it('보관함 모드는 보관분만 — 섞지 않는다', () => {
    expect(partitionTournaments(list, { showArchived: true }).visible.map((x) => x.id)).toEqual([
      'b',
      'c',
    ]);
  });

  it('공고 필터는 보관 개수에도 적용', () => {
    const r = partitionTournaments(list, { showArchived: false, postingId: 'p1' });
    expect(r.visible.map((x) => x.id)).toEqual(['a']);
    expect(r.archivedCount).toBe(1);
  });
});

describe('formatTournamentMeta', () => {
  it('있는 값만 · 로 잇는다', () => {
    expect(formatTournamentMeta(t({ gameType: 'NLH', venue: null, eventDate: '2026-09-28' }))).toBe(
      'NLH · 2026-09-28'
    );
  });
});

describe('STATUS_LABEL', () => {
  it('모바일과 같은 라벨', () => {
    expect(STATUS_LABEL).toEqual({ upcoming: '예정', active: '진행 중', completed: '종료' });
  });
});
