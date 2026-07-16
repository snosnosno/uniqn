/** TV 모니터 모듈 레지스트리(C6) — 매핑 전수·가용성(자동 숨김)·슬롯 해석. */
import { MONITOR_MODULES, resolveMonitorSlots } from '../registry';
import { MONITOR_MODULE_IDS } from '@/domains/ops';
import type { MonitorModuleContext } from '../registry';
import type { OpsMonitorSnapshot } from '@/types/ops';

function makeSnapshot(partial?: {
  stats?: Partial<OpsMonitorSnapshot['stats']>;
  registrationOpen?: boolean;
  nextLevel?: OpsMonitorSnapshot['nextLevel'];
}): OpsMonitorSnapshot {
  return {
    tournament: {
      name: '테스트컵',
      venue: null,
      eventDate: null,
      gameType: 'NLH',
      status: 'active',
      color: null,
      registrationOpen: partial?.registrationOpen ?? true,
    },
    clock: {
      currentLevelSort: 1,
      levelStartedAt: '2026-07-17T05:00:00.000Z',
      isRunning: true,
      pausedRemainingSec: null,
    },
    currentLevel: {
      level: 1,
      smallBlind: 100,
      bigBlind: 200,
      ante: 0,
      durationSec: 600,
      isBreak: false,
    },
    nextLevel:
      partial?.nextLevel !== undefined
        ? partial.nextLevel
        : { level: 2, smallBlind: 200, bigBlind: 400, ante: 0, durationSec: 900, isBreak: false },
    stats: {
      playing: 23,
      entries: 61,
      reentriesTotal: 8,
      tablesOpen: 3,
      seatsTotal: 27,
      seatsFree: 4,
      totalChips: 2440000,
      averageStack: 106000,
      avgStackBb: 53,
      prizePool: 3000000,
      knockoutPool: null,
      ...partial?.stats,
    },
    nextBreak: { level: 3, sort: 3, secondsFromLevelStart: 1500 },
    payouts: [],
    monitorConfig: null,
    serverNow: '2026-07-17T05:00:00.000Z',
  };
}

function makeCtx(partial?: Parameters<typeof makeSnapshot>[0]): MonitorModuleContext {
  return {
    snapshot: makeSnapshot(partial),
    nextBreak: { kind: 'until', remainingSec: 2530 },
  };
}

describe('MONITOR_MODULES — 카탈로그 전수', () => {
  it('카탈로그 10종 전부 레지스트리에 정의됨(라벨·셀렉터)', () => {
    for (const id of MONITOR_MODULE_IDS) {
      expect(MONITOR_MODULES[id]).toBeDefined();
      expect(MONITOR_MODULES[id].label.length).toBeGreaterThan(0);
    }
  });

  it('players: PLAYING/ENTRIES 조합', () => {
    expect(MONITOR_MODULES.players.getValue(makeCtx())).toBe('23/61');
  });

  it('regStatus: 등록 진행 중/마감', () => {
    expect(MONITOR_MODULES.regStatus.getValue(makeCtx())).toBe('등록 진행 중');
    expect(MONITOR_MODULES.regStatus.getValue(makeCtx({ registrationOpen: false }))).toBe(
      '등록 마감'
    );
  });

  it('nextBreak: until → HH:MM:SS · inBreak → 안내 · none → 숨김(null)', () => {
    expect(MONITOR_MODULES.nextBreak.getValue(makeCtx())).toBe('00:42:10');
    expect(
      MONITOR_MODULES.nextBreak.getValue({ ...makeCtx(), nextBreak: { kind: 'inBreak' } })
    ).toBe('휴식 진행 중');
    expect(
      MONITOR_MODULES.nextBreak.getValue({ ...makeCtx(), nextBreak: { kind: 'none' } })
    ).toBeNull();
  });

  it('koPool: 비-바운티(null) → 숨김, 값 있으면 표시(골드 톤)', () => {
    expect(MONITOR_MODULES.koPool.getValue(makeCtx())).toBeNull();
    expect(MONITOR_MODULES.koPool.getValue(makeCtx({ stats: { knockoutPool: 610000 } }))).toBe(
      '610,000'
    );
    expect(MONITOR_MODULES.koPool.tone).toBe('gold');
  });

  it('nextBlinds: 다음 레벨 없음 → 숨김, 휴식이면 "휴식"', () => {
    expect(MONITOR_MODULES.nextBlinds.getValue(makeCtx())).toBe('200 / 400');
    expect(MONITOR_MODULES.nextBlinds.getValue(makeCtx({ nextLevel: null }))).toBeNull();
    expect(
      MONITOR_MODULES.nextBlinds.getValue(
        makeCtx({
          nextLevel: {
            level: 3,
            smallBlind: 0,
            bigBlind: 0,
            ante: 0,
            durationSec: 300,
            isBreak: true,
          },
        })
      )
    ).toBe('휴식');
  });

  it('prizePool: 0 이면 숨김', () => {
    expect(MONITOR_MODULES.prizePool.getValue(makeCtx({ stats: { prizePool: 0 } }))).toBeNull();
  });

  it('tables: 테이블 미개설(0) → 숨김', () => {
    expect(MONITOR_MODULES.tables.getValue(makeCtx({ stats: { tablesOpen: 0 } }))).toBeNull();
  });
});

describe('resolveMonitorSlots — 빈 슬롯·데이터 없음 제외(아래 모듈 당김)', () => {
  it('null 슬롯과 데이터 없는 모듈은 결과에서 제외', () => {
    const resolved = resolveMonitorSlots(
      ['players', null, 'koPool', 'nextBreak', 'regStatus'],
      makeCtx() // koPool null(비-바운티) → 제외
    );
    expect(resolved.map((s) => s.id)).toEqual(['players', 'nextBreak', 'regStatus']);
  });

  it('전부 비면 빈 배열', () => {
    expect(resolveMonitorSlots([null, null, null, null, null], makeCtx())).toEqual([]);
  });
});
