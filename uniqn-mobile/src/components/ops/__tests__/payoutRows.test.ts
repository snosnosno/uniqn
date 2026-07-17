import { reindexRows, parseAmount, buildLedgerRows } from '../payoutRows';
import type { OpsParticipant, OpsPrize } from '@/types/ops';

/** 최소 픽스처 — 조인에 필요한 필드만 채우고 나머지는 캐스팅으로 대체. */
const prize = (rank: number, amount: number): OpsPrize =>
  ({ id: `prize-${rank}`, tournamentId: 't1', rank, amount }) as OpsPrize;

const part = (over: Partial<OpsParticipant>): OpsParticipant =>
  ({
    id: 'p',
    tournamentId: 't1',
    name: '무명',
    entryNumber: 1,
    viewToken: null,
    status: 'busted',
    chips: 0,
    rebuys: 0,
    addOns: 0,
    reentries: 0,
    knockouts: 0,
    finishPosition: null,
    prizeAmount: null,
    createdAt: '',
    updatedAt: '',
    ...over,
  }) as OpsParticipant;

describe('reindexRows', () => {
  it('3행에서 2번째 삭제 → rank [1,2] 연속 재부여', () => {
    const rows = [{ amount: '100' }, { amount: '50' }, { amount: '20' }];
    const afterDelete = rows.filter((_, i) => i !== 1); // 2번째 삭제
    const result = reindexRows(afterDelete);
    expect(result.map((r) => r.rank)).toEqual([1, 2]);
    expect(result).toEqual([
      { amount: '100', rank: 1 },
      { amount: '20', rank: 2 },
    ]);
  });

  it('행 추가 → 끝 rank N+1', () => {
    const rows = [{ amount: '100' }, { amount: '50' }];
    const afterAdd = [...rows, { amount: '' }];
    const result = reindexRows(afterAdd);
    expect(result.map((r) => r.rank)).toEqual([1, 2, 3]);
    expect(result[result.length - 1].rank).toBe(3);
  });

  it('빈 배열 → []', () => {
    expect(reindexRows([])).toEqual([]);
  });

  it('원본을 변형하지 않는다(불변성)', () => {
    const rows = [{ amount: '100' }];
    const result = reindexRows(rows);
    expect(rows[0]).not.toHaveProperty('rank');
    expect(result[0]).not.toBe(rows[0]);
  });
});

describe('parseAmount', () => {
  it('콤마·문자 제거 후 정수', () => {
    expect(parseAmount('1,000,000원')).toBe(1000000);
  });
  it('빈 문자열 → 0', () => {
    expect(parseAmount('')).toBe(0);
    expect(parseAmount('abc')).toBe(0);
  });
});

describe('buildLedgerRows', () => {
  it('구조 rank 에 finishPosition 일치 참가자를 조인', () => {
    const prizes = [prize(1, 1000000), prize(2, 500000)];
    const parts = [
      part({ id: 'a', name: '앨리스', finishPosition: 1, prizeAmount: 1000000 }),
      part({ id: 'b', name: '밥', finishPosition: 2, prizeAmount: 500000 }),
    ];
    const rows = buildLedgerRows(prizes, parts);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      rank: 1,
      structureAmount: 1000000,
      winnerName: '앨리스',
      participantId: 'a',
      paidAmount: 1000000,
      corrected: false,
    });
  });

  it('구조≠실지급이면 corrected=true(amber)', () => {
    const prizes = [prize(1, 1000000)];
    const parts = [part({ id: 'a', name: '앨리스', finishPosition: 1, prizeAmount: 800000 })];
    expect(buildLedgerRows(prizes, parts)[0].corrected).toBe(true);
  });

  it('H20: fp NOT NULL 전원 — 구조 밖·prize NULL 미지급도 행으로 포함(유령 방지)', () => {
    const prizes = [prize(1, 1000000)];
    const parts = [
      part({ id: 'a', name: '앨리스', finishPosition: 1, prizeAmount: 1000000 }),
      // 구조에 없는 3위 — prizeAmount NULL(미지급) 이지만 대장에 노출되어야 최초부여 진입 가능
      part({ id: 'c', name: '찰리', finishPosition: 3, prizeAmount: null }),
    ];
    const rows = buildLedgerRows(prizes, parts);
    const extra = rows.find((r) => r.rank === 3);
    expect(extra).toBeDefined();
    expect(extra).toMatchObject({
      rank: 3,
      structureAmount: null,
      winnerName: '찰리',
      participantId: 'c',
      paidAmount: null,
      corrected: false, // 구조도 없고 지급도 없음
    });
  });

  it('구조 없는데 수동 지급 있으면 corrected=true', () => {
    const prizes: OpsPrize[] = [];
    const parts = [part({ id: 'c', name: '찰리', finishPosition: 3, prizeAmount: 200000 })];
    expect(buildLedgerRows(prizes, parts)[0].corrected).toBe(true);
  });

  it('rank 오름차순 정렬(구조+추가 병합)', () => {
    const prizes = [prize(1, 1000000), prize(2, 500000)];
    const parts = [
      part({ id: 'a', finishPosition: 1, prizeAmount: 1000000 }),
      part({ id: 'z', finishPosition: 4, prizeAmount: null }),
      part({ id: 'b', finishPosition: 2, prizeAmount: 500000 }),
    ];
    expect(buildLedgerRows(prizes, parts).map((r) => r.rank)).toEqual([1, 2, 4]);
  });

  it('C4: participant.prizePaidAt 를 구조·추가 행 모두에 배선', () => {
    const prizes = [prize(1, 1000000)];
    const parts = [
      // 구조 행(1위) — 지급 완료 시각 보유
      part({
        id: 'a',
        name: '앨리스',
        finishPosition: 1,
        prizeAmount: 1000000,
        prizePaidAt: '2026-07-17T00:00:00.000Z',
      }),
      // 추가 행(3위, 구조 밖) — 지급 배정됐으나 미지급(null)
      part({ id: 'c', name: '찰리', finishPosition: 3, prizeAmount: 200000, prizePaidAt: null }),
    ];
    const rows = buildLedgerRows(prizes, parts);
    expect(rows.find((r) => r.rank === 1)?.prizePaidAt).toBe('2026-07-17T00:00:00.000Z');
    expect(rows.find((r) => r.rank === 3)?.prizePaidAt).toBeNull();
  });

  it('C4: prizePaidAt 필드 부재 참가자는 null 로 배선(옵셔널 흡수)', () => {
    const prizes = [prize(1, 1000000)];
    const parts = [part({ id: 'a', finishPosition: 1, prizeAmount: 1000000 })];
    expect(buildLedgerRows(prizes, parts)[0].prizePaidAt).toBeNull();
  });
});
