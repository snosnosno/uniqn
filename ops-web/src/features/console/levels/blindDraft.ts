/**
 * 블라인드 구조 편집 draft(순수) — 모바일 BlindLevelsTab·BlindLevelForm 규칙.
 * 웹은 행마다 폼을 여는 대신 표에서 바로 고친다(속도). 칸 값은 문자열로 들고, 저장 직전에 숫자로 바꾼다.
 */
import type { OpsBlindLevelSaveInput } from '@/core/schemas/opsBlindLevel.schema';
import type { OpsBlindLevel } from '@/core/types/ops';

export interface DraftRow {
  level: string;
  smallBlind: string;
  bigBlind: string;
  ante: string;
  /** 분 */
  minutes: string;
  isBreak: boolean;
  /** 서버 원래 시간(초). 분 칸이 그대로면 이 값을 저장한다 — 90초 같은 값이 반올림으로 바뀌지 않게(모바일은 안 건드린 행을 그대로 둔다). */
  originalSec?: number;
  /**
   * 서버에서 불러온 행의 순번(sort). 새 행·프리셋 행에는 없다. 저장할 때 prevSort 로 실어 보내면 서버가
   * 레이트 등록 자동 마감 기준을 순번이 아니라 **이 레벨**의 새 순번으로 옮긴다(앞 행을 지워도 기준이 밀리지 않는다).
   */
  originalSort?: number;
}

const digits = (v: string) => v.replace(/[^0-9]/g, '');
const toIntOrZero = (v: string): number => {
  const n = parseInt(digits(v), 10);
  return Number.isInteger(n) ? n : 0;
};

export function toDraftRow(
  l: Pick<
    OpsBlindLevel,
    'level' | 'smallBlind' | 'bigBlind' | 'ante' | 'durationSec' | 'isBreak'
  > & { sort?: number }
): DraftRow {
  return {
    level: String(l.level),
    smallBlind: String(l.smallBlind),
    bigBlind: String(l.bigBlind),
    ante: String(l.ante),
    minutes: String(Math.round(l.durationSec / 60)),
    isBreak: l.isBreak,
    originalSec: l.durationSec,
    ...(l.sort !== undefined ? { originalSort: l.sort } : {}),
  };
}

/** 분 칸이 1 이상 정수인지(모바일 durationValid). */
export function minutesValid(row: DraftRow): boolean {
  const n = parseInt(digits(row.minutes), 10);
  return Number.isInteger(n) && n >= 1;
}

/** draft 행 → RPC 입력. 휴식은 블라인드 0 고정(모바일 폼과 같음). 분이 틀리면 null. */
export function toInput(row: DraftRow): OpsBlindLevelSaveInput | null {
  if (!minutesValid(row)) return null;
  const minutes = parseInt(digits(row.minutes), 10);
  const untouched = row.originalSec !== undefined && minutes === Math.round(row.originalSec / 60);
  return {
    level: toIntOrZero(row.level),
    smallBlind: row.isBreak ? 0 : toIntOrZero(row.smallBlind),
    bigBlind: row.isBreak ? 0 : toIntOrZero(row.bigBlind),
    ante: row.isBreak ? 0 : toIntOrZero(row.ante),
    durationSec: untouched ? row.originalSec! : minutes * 60,
    isBreak: row.isBreak,
    prevSort: row.originalSort ?? null,
  };
}

/**
 * 새 레벨 행 — 마지막 일반 레벨 다음 번호, 블라인드는 비워 둔다(운영자가 채운다). 시간은 직전 행과 같게.
 */
export function nextRow(rows: readonly DraftRow[]): DraftRow {
  const lastPlay = [...rows].reverse().find((r) => !r.isBreak);
  const last = rows[rows.length - 1];
  return {
    level: String(lastPlay ? toIntOrZero(lastPlay.level) + 1 : 1),
    smallBlind: '',
    bigBlind: '',
    ante: '0',
    minutes: last?.minutes ?? '20',
    isBreak: false,
  };
}

export function breakRow(rows: readonly DraftRow[]): DraftRow {
  return {
    level: '0',
    smallBlind: '0',
    bigBlind: '0',
    ante: '0',
    minutes: rows.at(-1)?.minutes ?? '10',
    isBreak: true,
  };
}

/** 전체 → 입력 배열. 틀린 행이 있으면 그 행 번호(1부터)를 돌려준다. */
export function toInputs(
  rows: readonly DraftRow[]
): { ok: true; levels: OpsBlindLevelSaveInput[] } | { ok: false; badRow: number } {
  const levels: OpsBlindLevelSaveInput[] = [];
  for (let i = 0; i < rows.length; i += 1) {
    const input = toInput(rows[i]);
    if (!input) return { ok: false, badRow: i + 1 };
    levels.push(input);
  }
  return { ok: true, levels };
}
