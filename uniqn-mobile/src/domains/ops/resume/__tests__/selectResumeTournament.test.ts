/**
 * 재개 카드 선택(A2/D8) — KST 00~09시 고정 시계 케이스 필수(알려진 플레이크 구간).
 * KST 00~09시 = UTC 전날 15~24시: UTC 렌즈로 날짜를 자르면 하루 밀리는 함정을 고정한다.
 */
import { kstDateString, selectResumeTournament } from '../selectResumeTournament';
import type { OpsTournament } from '@/types/ops';

function t(partial: Partial<OpsTournament> & Pick<OpsTournament, 'id' | 'status'>): OpsTournament {
  return {
    ownerId: 'owner',
    name: `대회 ${partial.id}`,
    gameType: 'NLH',
    seatsPerTable: 9,
    startingChips: 30000,
    buyInChips: 0,
    rebuyChips: 0,
    addonChips: 0,
    buyInCost: 0,
    feeCost: 0,
    rebuyCost: 0,
    addonCost: 0,
    registrationOpen: true,
    autoSeatOnRegister: true,
    reentryAllowed: true,
    nextEntrySeq: 0,
    createdAt: '2026-07-10T00:00:00.000Z',
    updatedAt: '2026-07-10T00:00:00.000Z',
    eventDate: null,
    ...partial,
  } as OpsTournament;
}

describe('kstDateString — KST 00~09시 고정 시계', () => {
  it('UTC 07-16 16:30 = KST 07-17 01:30 → "2026-07-17"', () => {
    expect(kstDateString(Date.parse('2026-07-16T16:30:00.000Z'))).toBe('2026-07-17');
  });

  it('UTC 07-16 23:59 = KST 07-17 08:59 → "2026-07-17"', () => {
    expect(kstDateString(Date.parse('2026-07-16T23:59:00.000Z'))).toBe('2026-07-17');
  });

  it('UTC 07-17 00:01 = KST 07-17 09:01 → "2026-07-17"', () => {
    expect(kstDateString(Date.parse('2026-07-17T00:01:00.000Z'))).toBe('2026-07-17');
  });

  it('UTC 07-16 14:59 = KST 07-16 23:59 → "2026-07-16" (경계 직전)', () => {
    expect(kstDateString(Date.parse('2026-07-16T14:59:00.000Z'))).toBe('2026-07-16');
  });
});

describe('selectResumeTournament — active 최신 > 당일 upcoming > 미노출', () => {
  // KST 2026-07-17 01:30 (새벽 운영 — 실사용 피크)
  const NOW = Date.parse('2026-07-16T16:30:00.000Z');

  it('active 가 있으면 updatedAt 최신 1건', () => {
    const list = [
      t({ id: 'a1', status: 'active', updatedAt: '2026-07-16T15:00:00.000Z' }),
      t({ id: 'a2', status: 'active', updatedAt: '2026-07-16T16:00:00.000Z' }),
      t({ id: 'u1', status: 'upcoming', eventDate: '2026-07-17' }),
    ];
    expect(selectResumeTournament(list, NOW)?.id).toBe('a2');
  });

  it('active 없고 당일(KST 07-17) upcoming 있으면 그 1건 — UTC 날짜(07-16)로 오판하지 않음', () => {
    const list = [
      t({ id: 'u-today', status: 'upcoming', eventDate: '2026-07-17' }),
      t({ id: 'u-utc', status: 'upcoming', eventDate: '2026-07-16' }), // UTC 기준 오늘(함정)
      t({ id: 'c1', status: 'completed', eventDate: '2026-07-17' }),
    ];
    expect(selectResumeTournament(list, NOW)?.id).toBe('u-today');
  });

  it('당일 upcoming 복수면 createdAt 최신', () => {
    const list = [
      t({
        id: 'u-old',
        status: 'upcoming',
        eventDate: '2026-07-17',
        createdAt: '2026-07-15T00:00:00.000Z',
      }),
      t({
        id: 'u-new',
        status: 'upcoming',
        eventDate: '2026-07-17',
        createdAt: '2026-07-16T12:00:00.000Z',
      }),
    ];
    expect(selectResumeTournament(list, NOW)?.id).toBe('u-new');
  });

  it('active 없음 + 당일 upcoming 없음(내일/과거만) → null(카드 미노출)', () => {
    const list = [
      t({ id: 'u-tomorrow', status: 'upcoming', eventDate: '2026-07-18' }),
      t({ id: 'u-past', status: 'upcoming', eventDate: '2026-07-16' }),
      t({ id: 'c1', status: 'completed', eventDate: '2026-07-17' }),
    ];
    expect(selectResumeTournament(list, NOW)).toBeNull();
  });

  it('eventDate 없는 upcoming 은 당일 판정 제외', () => {
    const list = [t({ id: 'u-nodate', status: 'upcoming', eventDate: null })];
    expect(selectResumeTournament(list, NOW)).toBeNull();
  });

  it('빈 목록 → null', () => {
    expect(selectResumeTournament([], NOW)).toBeNull();
  });
});
