/**
 * PAYOUTS 순수 로직(컴포넌트 밖 추출 — jest 단언 대상).
 * reindexRows: rank 1..N 연속 재부여(기존 rank 갭 결함 해소 — 저장 payload 는 항상 연속).
 * buildLedgerRows: 구조(prizes) + 실지급(participants) 클라 조인(🔨H20 유령 방지).
 */
import type { OpsParticipant, OpsPrize } from '@/types/ops';
import { formatNumber } from '@/utils/formatters/currency';

/** 원화 표기(ko-KR 천단위) — canonical formatNumber 위임(중복 제거). */
export const fmtKrw = (n: number): string => formatNumber(n);

/** raw 입력 문자열 → 정수 원화(숫자 외 제거). 빈/비숫자 → 0. */
export function parseAmount(raw: string): number {
  return parseInt(raw.replace(/[^0-9]/g, ''), 10) || 0;
}

/** 행 삭제/추가 후 rank 1..N 연속 재부여. 원본 불변(스프레드로 새 객체). */
export function reindexRows<T>(rows: T[]): (T & { rank: number })[] {
  return rows.map((row, i) => ({ ...(row as object as T), rank: i + 1 }));
}

/** 페이아웃 대장 행(구조 rank + 실지급 조인 결과). */
export interface LedgerRow {
  rank: number;
  structureAmount: number | null;
  winnerName: string | null;
  participantId: string | null;
  paidAmount: number | null;
  /** 구조≠실지급(또는 구조 없는 수동 지급) — amber 하이라이트. */
  corrected: boolean;
}

/**
 * 구조(prizes) + 참가자 실지급(participants) 클라 조인 → rank 오름차순 병합.
 * 🔨H20: 구조 밖 행 = finishPosition NOT NULL 전원(prize NULL 미지급 포함).
 *   prizeAmount !== null 로 좁히면 §4.3 비ITM 최초부여(NULL→금액)가 UI 도달 불가(유령 기능)이 되므로 금지.
 */
export function buildLedgerRows(prizes: OpsPrize[], participants: OpsParticipant[]): LedgerRow[] {
  const structureRows: LedgerRow[] = prizes.map((prize) => {
    const winner = participants.find((p) => p.finishPosition === prize.rank) ?? null;
    const paid = winner?.prizeAmount ?? null;
    return {
      rank: prize.rank,
      structureAmount: prize.amount,
      winnerName: winner?.name ?? null,
      participantId: winner?.id ?? null,
      paidAmount: paid,
      corrected: winner !== null && paid !== prize.amount,
    };
  });

  const extraRows: LedgerRow[] = participants
    .filter(
      (p) =>
        typeof p.finishPosition === 'number' && !prizes.some((z) => z.rank === p.finishPosition)
    )
    .map((p) => ({
      rank: p.finishPosition as number,
      structureAmount: null,
      winnerName: p.name,
      participantId: p.id,
      paidAmount: p.prizeAmount ?? null,
      corrected: (p.prizeAmount ?? null) !== null,
    }));

  return [...structureRows, ...extraRows].sort((a, b) => a.rank - b.rank);
}
