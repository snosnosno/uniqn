/** 콘솔 숫자·시간 표기 — 모바일 ClockControl·PlayersTab 과 같은 규칙. */
import type { OpsParticipantStatus } from '@/core/types/ops';

export const fmt = (n: number): string => n.toLocaleString('ko-KR');

/** 남은 초 → mm:ss (음수는 00:00). */
export function formatMmSs(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** 평균 스택 BB — 모바일 formatBb(최대 소수 1자리). */
export const formatBb = (bb: number): string =>
  bb.toLocaleString('ko-KR', { maximumFractionDigits: 1 });

export const PARTICIPANT_STATUS_LABEL: Record<OpsParticipantStatus, string> = {
  registered: '등록',
  checked_in: '대기',
  active: '플레이',
  busted: '탈락',
  no_show: '노쇼',
};

/** 좌석 표기 `T3-7`. */
export const seatLabel = (tableNo: number, seatNo: number): string => `T${tableNo}-${seatNo}`;

/** 칩 입력 → 증감 안내(모바일 ChipCountSheet buildDeltaLabel). 0·동일이면 null. */
export function chipDeltaLabel(before: number, after: number): string | null {
  if (!after || after === before) return null;
  const diff = after - before;
  const sign = diff > 0 ? '+' : '−';
  const pct = before > 0 ? ` (${sign}${Math.round((Math.abs(diff) / before) * 100)}%)` : '';
  return `${fmt(before)} → ${fmt(after)} · ${sign}${fmt(Math.abs(diff))}${pct}`;
}
