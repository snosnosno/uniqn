/**
 * UNIQN Mobile - 지원서 이력 관리 타입 정의
 *
 * @description 지원 확정/취소 이력 추적을 위한 타입
 * originalApplication + confirmationHistory 패턴
 *
 * @version 1.0.0
 * @see app2/src/types/application.ts
 */

import { Timestamp } from 'firebase/firestore';
import type { Assignment } from './assignment';

/**
 * 최초 지원 데이터 보존
 *
 * @description 지원자가 처음 지원할 때의 선택사항을 보존합니다.
 * 확정 후 취소 시 원본 데이터 복원에 사용됩니다.
 */
export interface OriginalApplication {
  /** 최초 지원 시 선택한 assignments */
  assignments: Assignment[];

  /** 최초 지원 시간 */
  appliedAt: Timestamp;
}

/**
 * 확정/취소 이력 엔트리
 *
 * @description 각 확정/취소 이벤트를 기록합니다.
 * 감사 추적(audit trail)을 위해 사용됩니다.
 */
export interface ConfirmationHistoryEntry {
  /** 확정 시간 */
  confirmedAt: Timestamp;

  /** 취소 시간 (취소된 경우에만) */
  cancelledAt?: Timestamp;

  /** 취소 사유 (취소된 경우에만) */
  cancelReason?: string;

  /** 확정된 assignments */
  assignments: Assignment[];

  /** 확정한 관리자/구인자 ID */
  confirmedBy?: string;

  /** 취소한 관리자/구인자 ID */
  cancelledBy?: string;
}

/**
 * 이력 엔트리 생성 헬퍼
 *
 * @param assignments - 확정할 assignments
 * @param confirmedBy - 확정자 ID (선택)
 * @returns 새 이력 엔트리
 */
export function createHistoryEntry(
  assignments: Assignment[],
  confirmedBy?: string
): ConfirmationHistoryEntry {
  return {
    confirmedAt: Timestamp.now(),
    assignments,
    confirmedBy,
  };
}

/**
 * 이력 엔트리에 취소 정보 추가
 *
 * @param entry - 기존 이력 엔트리
 * @param cancelReason - 취소 사유
 * @param cancelledBy - 취소자 ID (선택)
 * @returns 취소 정보가 추가된 엔트리
 */
export function addCancellationToEntry(
  entry: ConfirmationHistoryEntry,
  cancelReason?: string,
  cancelledBy?: string
): ConfirmationHistoryEntry {
  return {
    ...entry,
    cancelledAt: Timestamp.now(),
    cancelReason,
    cancelledBy,
  };
}

/**
 * 현재 활성 확정 정보 찾기
 *
 * @description 취소되지 않은 가장 최근 확정을 찾습니다.
 * @param history - 확정 이력 배열
 * @returns 활성 확정 엔트리 또는 null
 */
export function findActiveConfirmation(
  history: ConfirmationHistoryEntry[]
): ConfirmationHistoryEntry | null {
  // 역순으로 탐색하여 취소되지 않은 최신 확정 찾기
  for (let i = history.length - 1; i >= 0; i--) {
    const entry = history[i];
    if (entry && !entry.cancelledAt) {
      return entry;
    }
  }
  return null;
}

/**
 * 이력에서 총 확정 횟수 계산
 *
 * @param history - 확정 이력 배열
 * @returns 총 확정 횟수
 */
export function countConfirmations(history: ConfirmationHistoryEntry[]): number {
  return history.length;
}

/**
 * 이력에서 취소 횟수 계산
 *
 * @param history - 확정 이력 배열
 * @returns 취소 횟수
 */
export function countCancellations(history: ConfirmationHistoryEntry[]): number {
  return history.filter((entry) => entry.cancelledAt).length;
}

/**
 * 이력 상태 요약
 */
export interface HistorySummary {
  /** 총 확정 횟수 */
  totalConfirmations: number;

  /** 취소 횟수 */
  cancellations: number;

  /** 현재 활성 확정 여부 */
  isCurrentlyConfirmed: boolean;

  /** 마지막 확정 시간 */
  lastConfirmedAt?: Timestamp;

  /** 마지막 취소 시간 */
  lastCancelledAt?: Timestamp;
}

/**
 * 이력 요약 생성
 *
 * @param history - 확정 이력 배열
 * @returns 이력 요약 객체
 */
export function createHistorySummary(history: ConfirmationHistoryEntry[]): HistorySummary {
  const activeConfirmation = findActiveConfirmation(history);
  const lastEntry = history[history.length - 1];

  return {
    totalConfirmations: countConfirmations(history),
    cancellations: countCancellations(history),
    isCurrentlyConfirmed: activeConfirmation !== null,
    lastConfirmedAt: lastEntry?.confirmedAt,
    lastCancelledAt: history.filter((e) => e.cancelledAt).pop()?.cancelledAt,
  };
}
