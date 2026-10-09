/**
 * 알림음 — 파일 없이 Web Audio 로 짧은 두 음을 만든다(번들·CSP 영향 0).
 * 브라우저는 사용자 동작 전에는 소리를 막으므로, 켤 때(클릭)와 이후 첫 터치에서 AudioContext 를 깨운다.
 * 켜짐 여부는 이 기기에만 저장한다(운영 PC 마다 스피커 상황이 다르다).
 *
 * 스위치는 화면별로 따로다 — 운영 콘솔의 클럭음(`console`)과 플레이어뷰의 자리·레벨 알림(`player`).
 * 둘 다 같은 주소(ops.uniqn.app)라 저장 키를 같이 쓰면 한쪽을 켜고 끌 때 다른 쪽도 조용히 바뀐다
 * (운영자가 자기 휴대폰으로 플레이어 링크를 열어 본 뒤 콘솔 클럭음이 꺼져 있는 식).
 */
import { useSyncExternalStore } from 'react';
import { logger } from './logger';

export type ChimeChannel = 'console' | 'player';

/** `console` 키는 종전 값 그대로 — 이미 켜 둔 운영 PC 의 설정을 잃지 않는다. */
export const CHIME_STORAGE_KEYS: Record<ChimeChannel, string> = {
  console: 'ops-web:clock-chime',
  player: 'ops-web:player-alert',
};
const listeners = new Set<() => void>();
let ctx: AudioContext | null = null;

function readEnabled(channel: ChimeChannel): boolean {
  try {
    return localStorage.getItem(CHIME_STORAGE_KEYS[channel]) === '1';
  } catch {
    return false;
  }
}

let enabled: Record<ChimeChannel, boolean> =
  typeof window === 'undefined'
    ? { console: false, player: false }
    : { console: readEnabled('console'), player: readEnabled('player') };

function audio(): AudioContext | null {
  if (typeof window === 'undefined' || !('AudioContext' in window)) return null;
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
  return ctx;
}

// 저장값이 켜짐이면 새로고침 뒤 첫 사용자 동작에서 오디오를 깨운다(그 전엔 브라우저가 막는다).
if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', () => (enabled.console || enabled.player) && audio(), {
    passive: true,
  });
}

export function isChimeEnabled(channel: ChimeChannel = 'console'): boolean {
  return enabled[channel];
}

export function setChimeEnabled(next: boolean, channel: ChimeChannel = 'console'): void {
  enabled = { ...enabled, [channel]: next };
  try {
    localStorage.setItem(CHIME_STORAGE_KEYS[channel], next ? '1' : '0');
  } catch {
    // 저장 못 해도 이번 세션에는 적용된다
  }
  if (next) audio();
  listeners.forEach((l) => l());
}

export function useChimeEnabled(channel: ChimeChannel = 'console'): boolean {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => isChimeEnabled(channel),
    () => false
  );
}

/** 1분 전 = 높은 음 1번, 시간 종료 = 같은 음 3번, 레벨 전환 = 두 음 상승. 그 화면의 스위치가 꺼져 있으면 아무것도 안 한다. */
export function playChime(
  kind: 'oneMinute' | 'timeUp' | 'levelChange',
  channel: ChimeChannel = 'console'
): void {
  if (!enabled[channel]) return;
  const a = audio();
  if (!a) return;
  try {
    const notes = kind === 'oneMinute' ? [880] : kind === 'timeUp' ? [990, 990, 990] : [660, 990];
    notes.forEach((freq, i) => {
      const t = a.currentTime + i * 0.22;
      const osc = a.createOscillator();
      const gain = a.createGain();
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      osc.connect(gain).connect(a.destination);
      osc.start(t);
      osc.stop(t + 0.22);
    });
  } catch (error) {
    logger.warn('알림음 재생 실패', { error });
  }
}
