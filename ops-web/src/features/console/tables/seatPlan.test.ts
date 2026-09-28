import { describe, expect, it } from 'vitest';
import type { OpsParticipant, OpsSeat, OpsTable } from '@/core/types/ops';
import {
  buildRows,
  parseSeatLabel,
  planFingerprint,
  planRedraw,
  unseatedParticipants,
} from './seatPlan';

const table = (id: string, tableNo: number, over: Partial<OpsTable> = {}): OpsTable => ({
  id,
  tournamentId: 't',
  tableNo,
  status: 'open',
  lockType: 'none',
  createdAt: '',
  updatedAt: '',
  ...over,
});
const seat = (
  id: string,
  tableId: string,
  tableNo: number,
  seatNo: number,
  pid: string | null = null
): OpsSeat => ({
  id,
  tournamentId: 't',
  tableId,
  tableNo,
  seatNo,
  participantId: pid,
  createdAt: '',
  updatedAt: '',
});
const player = (id: string, status: OpsParticipant['status'], chips = 10000) =>
  ({ id, status, chips, name: id, entryNumber: 1 }) as OpsParticipant;

describe('seatPlan', () => {
  it('buildRows: 테이블·좌석 번호순, 착석 수', () => {
    const rows = buildRows(
      [table('b', 2), table('a', 1)],
      [seat('a2', 'a', 1, 2, 'p1'), seat('a1', 'a', 1, 1), seat('b1', 'b', 2, 1)]
    );
    expect(rows.map((r) => r.table.tableNo)).toEqual([1, 2]);
    expect(rows[0].seats.map((s) => s.seatNo)).toEqual([1, 2]);
    expect(rows[0].filled).toBe(1);
  });

  it('착석 대기 = 좌석 없는 active/checked_in 만(탈락·노쇼 제외)', () => {
    const r = unseatedParticipants(
      [
        player('p1', 'active'),
        player('p2', 'checked_in'),
        player('p3', 'busted'),
        player('p4', 'active'),
      ],
      [seat('s1', 'a', 1, 1, 'p4')]
    );
    expect(r.map((p) => p.id)).toEqual(['p1', 'p2']);
  });

  it('빈자리 채움: 잠금·비-open 테이블에는 앉히지 않는다', () => {
    const plan = planRedraw(
      'waitlist_fill',
      [table('a', 1), table('b', 2, { lockType: 'locked' })],
      [seat('a1', 'a', 1, 1), seat('b1', 'b', 2, 1)],
      [player('p1', 'active'), player('p2', 'active')]
    );
    expect(plan.assignments.map((a) => a.seatId)).toEqual(['a1']);
  });

  it('전원 재배치: 보호 테이블 점유자는 제외, 좌석 부족이면 insufficient', () => {
    const tables = [table('a', 1), table('f', 2, { lockType: 'feature' })];
    const seats = [seat('a1', 'a', 1, 1, 'p1'), seat('f1', 'f', 2, 1, 'p2')];
    const ok = planRedraw(
      'random_draw',
      tables,
      seats,
      [player('p1', 'active'), player('p2', 'active')],
      () => 0.3
    );
    expect(ok.insufficient).toBe(false);
    expect(ok.assignments.map((a) => a.participantId)).toEqual(['p1']);

    const short = planRedraw('chip_draft', tables, seats, [
      player('p1', 'active'),
      player('p2', 'active'),
      player('p3', 'active'),
    ]);
    expect(short).toMatchObject({ insufficient: true, assignments: [] });
  });

  it('전원 재배치 대상이 0명이면 빈 계획', () => {
    expect(
      planRedraw('random_draw', [table('a', 1)], [seat('a1', 'a', 1, 1)], []).assignments
    ).toEqual([]);
  });
});

describe('parseSeatLabel', () => {
  it.each([
    ['T5-2', [5, 2]],
    ['t12-9', [12, 9]],
    ['5 2', [5, 2]],
    [' 3·4 ', [3, 4]],
  ])('%s → %j', (raw, want) => expect(parseSeatLabel(raw)).toEqual(want));
  it.each(['', 'T5', 'abc', '5-', 'T5-2-1'])('%s → null', (raw) =>
    expect(parseSeatLabel(raw)).toBeNull()
  );
});

describe('planFingerprint', () => {
  it('좌석 점유·참가자 상태·테이블 잠금이 바뀌면 달라지고, 순서만 바뀌면 같다', () => {
    const t = [table('a', 1)];
    const s1 = [seat('a1', 'a', 1, 1, 'p1'), seat('a2', 'a', 1, 2)];
    const p = [player('p1', 'active'), player('p2', 'active')];
    const base = planFingerprint(t, s1, p);
    expect(planFingerprint(t, [...s1].reverse(), [...p].reverse())).toBe(base);
    expect(planFingerprint(t, [seat('a1', 'a', 1, 1), seat('a2', 'a', 1, 2)], p)).not.toBe(base);
    expect(planFingerprint(t, s1, [player('p1', 'active'), player('p2', 'busted')])).not.toBe(base);
    expect(planFingerprint([table('a', 1, { lockType: 'locked' })], s1, p)).not.toBe(base);
  });
});
