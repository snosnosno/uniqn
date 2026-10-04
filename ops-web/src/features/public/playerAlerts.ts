/**
 * 플레이어뷰 변화 판정(순수) — 직전 폴링과 견줘 선수가 놓치면 안 되는 변화만 고른다.
 * 자리(배정·이동)는 선수가 확인할 때까지 남기고, 레벨·휴식은 잠깐 알리고 사라진다(표시는 화면이 한다).
 */
import type { OpsPlayerView } from '@/core/types/ops';

export type PlayerAlert =
  | { kind: 'seat'; tableNo: number; seatNo: number; moved: boolean }
  | { kind: 'level'; level: number; smallBlind: number; bigBlind: number; ante: number }
  | { kind: 'break' };

/** 떠 있는 자리 배너가 아직 지금 자리를 가리키는지. */
export function isSeatAlertCurrent(
  alert: Extract<PlayerAlert, { kind: 'seat' }>,
  view: OpsPlayerView
): boolean {
  return alert.tableNo === view.me.tableNo && alert.seatNo === view.me.seatNo;
}

/** 대회에서 빠진 선수에게는 레벨 알림을 보내지 않는다. */
const OUT = new Set(['busted', 'no_show']);

export function detectPlayerAlerts(prev: OpsPlayerView | null, next: OpsPlayerView): PlayerAlert[] {
  if (!prev) return [];
  const alerts: PlayerAlert[] = [];

  const { tableNo, seatNo } = next.me;
  if (
    tableNo !== null &&
    seatNo !== null &&
    (tableNo !== prev.me.tableNo || seatNo !== prev.me.seatNo)
  ) {
    alerts.push({ kind: 'seat', tableNo, seatNo, moved: prev.me.tableNo !== null });
  }

  const level = next.currentLevel;
  if (
    level &&
    !OUT.has(next.me.status) &&
    next.clock.currentLevelSort !== prev.clock.currentLevelSort
  ) {
    alerts.push(
      level.isBreak
        ? { kind: 'break' }
        : {
            kind: 'level',
            level: level.level,
            smallBlind: level.smallBlind,
            bigBlind: level.bigBlind,
            ante: level.ante,
          }
    );
  }
  return alerts;
}
