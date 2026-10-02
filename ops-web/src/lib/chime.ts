/**
 * 콘솔 알림음 — 파일 없이 Web Audio 로 짧은 두 음을 만든다(번들·CSP 영향 0).
 * 브라우저는 사용자 동작 전에는 소리를 막으므로, 켤 때(클릭)와 이후 첫 터치에서 AudioContext 를 깨운다.
 * 켜짐 여부는 이 기기에만 저장한다(운영 PC 마다 스피커 상황이 다르다).
 */
import { useSyncExternalStore } from 'react';
import { logger } from './logger';

const STORAGE_KEY = 'ops-web:clock-chime';
const listeners = new Set<() => void>();
let ctx: AudioContext | null = null;

function readEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

let enabled = typeof window === 'undefined' ? false : readEnabled();

function audio(): AudioContext | null {
  if (typeof window === 'undefined' || !('AudioContext' in window)) return null;
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
  return ctx;
}

// 저장값이 켜짐이면 새로고침 뒤 첫 사용자 동작에서 오디오를 깨운다(그 전엔 브라우저가 막는다).
if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', () => enabled && audio(), { passive: true });
}

export function isChimeEnabled(): boolean {
  return enabled;
}

export function setChimeEnabled(next: boolean): void {
  enabled = next;
  try {
    localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
  } catch {
    // 저장 못 해도 이번 세션에는 적용된다
  }
  if (next) audio();
  listeners.forEach((l) => l());
}

export function useChimeEnabled(): boolean {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    isChimeEnabled,
    () => false
  );
}

/** 1분 전 = 높은 음 1번, 시간 종료 = 같은 음 3번, 레벨 전환 = 두 음 상승. 꺼져 있으면 아무것도 안 한다. */
export function playChime(kind: 'oneMinute' | 'timeUp' | 'levelChange'): void {
  if (!enabled) return;
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
