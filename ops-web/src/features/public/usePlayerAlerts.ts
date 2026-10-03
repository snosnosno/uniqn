/**
 * 플레이어뷰 변화 알림 상태 — 직전 폴링과 견줘(`detectPlayerAlerts`) 자리는 선수가 확인할 때까지,
 * 레벨·휴식은 10초 동안 들고 있는다. 소리·진동은 선수가 켠 기기에서만 울린다(`lib/chime`).
 * 진동은 지원하는 기기에서만(iOS Safari 는 미지원이라 배너와 소리만).
 */
import { useEffect, useState } from 'react';
import type { OpsPlayerView } from '@/core/types/ops';
import { isChimeEnabled, playChime } from '@/lib/chime';
import { detectPlayerAlerts, isSeatAlertCurrent, type PlayerAlert } from './playerAlerts';

export type SeatAlert = Extract<PlayerAlert, { kind: 'seat' }>;
export type LevelAlert = Exclude<PlayerAlert, { kind: 'seat' }>;

const LEVEL_ALERT_MS = 10_000;

export function notifyPlayer(): void {
  // 소리와 진동을 같은 스위치로 묶는다 — 꺼 둔 기기에서 진동만 울리지 않게.
  if (!isChimeEnabled()) return;
  playChime('levelChange');
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate([200, 100, 200]);
  }
}

interface AlertState {
  token: string | undefined;
  prev: OpsPlayerView | null;
  seat: SeatAlert | null;
  level: LevelAlert | null;
  /** 알림이 생길 때마다 1 씩 오른다 — 소리·진동을 알림당 한 번만 울리는 기준 */
  seq: number;
}

export function usePlayerAlerts(token: string | undefined, view: OpsPlayerView | null) {
  const [state, setState] = useState<AlertState>({
    token,
    prev: null,
    seat: null,
    level: null,
    seq: 0,
  });

  // 새 폴링 결과가 오면 렌더 중에 상태를 맞춘다(effect 에서 setState 하면 한 박자 늦은 화면이 한 번 그려진다).
  // 다른 링크(토큰)로 옮기면 직전 값과 떠 있던 알림을 버린다.
  if (token !== state.token) {
    setState({ token, prev: view, seat: null, level: null, seq: 0 });
  } else if (view && view !== state.prev) {
    const alerts = detectPlayerAlerts(state.prev, view);
    const seat = alerts.find((a): a is SeatAlert => a.kind === 'seat');
    const level = alerts.find((a): a is LevelAlert => a.kind !== 'seat');
    // 떠 있던 자리 배너가 지금 자리와 다르면(탈락·좌석 비움 포함) 내린다 — 옛 자리를 계속 가리키지 않게.
    const kept = state.seat && isSeatAlertCurrent(state.seat, view) ? state.seat : null;
    setState({
      token,
      prev: view,
      seat: seat ?? kept,
      level: level ?? state.level,
      seq: alerts.length > 0 ? state.seq + 1 : state.seq,
    });
  }

  const { seq, level } = state;
  useEffect(() => {
    if (seq > 0) notifyPlayer();
  }, [seq]);

  useEffect(() => {
    if (!level) return undefined;
    const handle = setTimeout(
      () => setState((s) => (s.level === level ? { ...s, level: null } : s)),
      LEVEL_ALERT_MS
    );
    return () => clearTimeout(handle);
  }, [level]);

  return {
    seat: state.seat,
    level: state.level,
    dismissSeat: () => setState((s) => ({ ...s, seat: null })),
  };
}
