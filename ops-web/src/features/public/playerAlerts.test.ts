import { describe, expect, it } from 'vitest';
import type { OpsPlayerView } from '@/core/types/ops';
import { detectPlayerAlerts, isSeatAlertCurrent } from './playerAlerts';

const level = (o: Partial<NonNullable<OpsPlayerView['currentLevel']>> = {}) => ({
  level: 3,
  smallBlind: 300,
  bigBlind: 600,
  ante: 600,
  durationSec: 1200,
  isBreak: false,
  ...o,
});

const view = (o: {
  me?: Partial<OpsPlayerView['me']>;
  sort?: number;
  currentLevel?: OpsPlayerView['currentLevel'];
}): OpsPlayerView => ({
  me: {
    entryNumber: 7,
    name: '홍길동',
    status: 'active',
    chips: 30000,
    finishPosition: null,
    prizeAmount: null,
    bountyAccrued: null,
    rebuys: 0,
    addOns: 0,
    reentries: 0,
    knockouts: 0,
    tableNo: 2,
    seatNo: 5,
    ...o.me,
  },
  tournament: { name: '대회', venue: null, gameType: 'NLH', status: 'active' },
  clock: {
    currentLevelSort: o.sort ?? 3,
    levelStartedAt: null,
    isRunning: true,
    pausedRemainingSec: null,
  },
  currentLevel: o.currentLevel === undefined ? level() : o.currentLevel,
  stats: { playing: 10, entries: 20, averageStack: 60000, avgStackBb: 100 },
  nextBreak: null,
  serverNow: '2026-10-04T00:00:00Z',
});

describe('detectPlayerAlerts', () => {
  it('첫 조회에는 알리지 않는다(견줄 직전 값이 없다)', () => {
    expect(detectPlayerAlerts(null, view({}))).toEqual([]);
  });

  it('바뀐 것이 없으면 알리지 않는다', () => {
    expect(detectPlayerAlerts(view({}), view({}))).toEqual([]);
  });

  it('자리가 옮겨지면 새 자리를 알린다', () => {
    const alerts = detectPlayerAlerts(view({}), view({ me: { tableNo: 4, seatNo: 1 } }));
    expect(alerts).toEqual([{ kind: 'seat', tableNo: 4, seatNo: 1, moved: true }]);
  });

  it('배정 전이던 선수가 자리를 받으면 이동이 아니라 배정으로 알린다', () => {
    const alerts = detectPlayerAlerts(view({ me: { tableNo: null, seatNo: null } }), view({}));
    expect(alerts).toEqual([{ kind: 'seat', tableNo: 2, seatNo: 5, moved: false }]);
  });

  it('자리가 비워지면(탈락 등) 자리 알림은 없다', () => {
    const alerts = detectPlayerAlerts(view({}), view({ me: { tableNo: null, seatNo: null } }));
    expect(alerts).toEqual([]);
  });

  it('레벨이 바뀌면 새 블라인드를 알린다', () => {
    const alerts = detectPlayerAlerts(
      view({}),
      view({
        sort: 4,
        currentLevel: level({ level: 4, smallBlind: 400, bigBlind: 800, ante: 800 }),
      })
    );
    expect(alerts).toEqual([
      { kind: 'level', level: 4, smallBlind: 400, bigBlind: 800, ante: 800 },
    ]);
  });

  it('휴식으로 넘어가면 휴식을 알린다', () => {
    const alerts = detectPlayerAlerts(
      view({}),
      view({ sort: 4, currentLevel: level({ isBreak: true }) })
    );
    expect(alerts).toEqual([{ kind: 'break' }]);
  });

  it('탈락한 선수에게는 레벨 알림을 보내지 않는다', () => {
    const alerts = detectPlayerAlerts(
      view({ me: { status: 'busted', tableNo: null, seatNo: null } }),
      view({ me: { status: 'busted', tableNo: null, seatNo: null }, sort: 4 })
    );
    expect(alerts).toEqual([]);
  });

  it('자리 이동과 레벨 전환이 함께 오면 둘 다 알린다', () => {
    const alerts = detectPlayerAlerts(view({}), view({ me: { tableNo: 1, seatNo: 9 }, sort: 4 }));
    expect(alerts.map((a) => a.kind)).toEqual(['seat', 'level']);
  });
});

describe('isSeatAlertCurrent', () => {
  const alert = { kind: 'seat', tableNo: 2, seatNo: 5, moved: true } as const;

  it('지금 자리와 같으면 배너를 유지한다', () => {
    expect(isSeatAlertCurrent(alert, view({}))).toBe(true);
  });

  it('자리가 또 바뀌었거나 비워졌으면 배너를 내린다', () => {
    expect(isSeatAlertCurrent(alert, view({ me: { tableNo: 2, seatNo: 6 } }))).toBe(false);
    expect(isSeatAlertCurrent(alert, view({ me: { tableNo: null, seatNo: null } }))).toBe(false);
  });
});
