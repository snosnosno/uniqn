/**
 * UNIQN Mobile - QR 처리 대상 work_log 자동 선택
 *
 * @description 고정 QR 은 assignmentGroupId/timeSlot 을 인코딩하지 않는다.
 *   하루에 여러 배정이 있을 수 있으므로(UNIQUE 제약 없음) 어느 근무를 처리할지
 *   클라이언트가 결정한다. 스태프가 고를 것을 0개로 유지하는 것이 설계 원칙이다.
 *
 * 선택 규칙:
 *   1. checked_in 후보가 있으면 그것 (= 퇴근 처리 대상). 여러 건이면 가장 이른 출근.
 *   2. 없으면 scheduled 후보 중 시작시각이 현재와 가장 가까운 것 (= 출근 처리 대상).
 *   3. 둘 다 없으면 사유와 함께 null.
 *
 * @remarks 부수효과 없는 순수 함수다. 입력 배열을 변형하지 않는다.
 */

import { WORK_LOG_STATUS_VALUES } from '@/constants/statusValues';
import { toDate } from '@/utils/date';
import type { WorkLog } from '@/types';

/** 하루 = 1440분 (자정 순환 거리 계산용) */
const MINUTES_PER_DAY = 1440;

export type QRSelectionFailureReason = 'no_assignment' | 'all_checked_out' | 'not_active';

export type QRSelectionResult =
  | { workLog: WorkLog; reason: null }
  | { workLog: null; reason: QRSelectionFailureReason };

/**
 * timeSlot 문자열에서 시작 시각을 분 단위로 추출
 *
 * @example '18:00~02:00' → 1080, '09:30' → 570, '미정' → null
 */
export function parseTimeSlotStartMinutes(timeSlot: string | undefined): number | null {
  if (!timeSlot) return null;

  const match = /^(\d{1,2}):(\d{2})/.exec(timeSlot.trim());
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours > 23 || minutes > 59) return null;

  return hours * 60 + minutes;
}

/** 자정을 넘는 근무를 위해 24시간 순환 거리로 계산 */
function cyclicDistanceMinutes(a: number, b: number): number {
  const diff = Math.abs(a - b);
  return Math.min(diff, MINUTES_PER_DAY - diff);
}

/**
 * 정렬 키가 가장 작은 후보 1건 선택
 *
 * @remarks 후보 배열(`findQRCandidates` 반환값)은 `.order()` 를 걸지 않아 **순서가 무보장**이다.
 *   따라서 동률일 때 "배열의 첫 번째"에 기대면 같은 후보 집합이 순서에 따라 다른 결과를 낸다.
 *   id 오름차순으로 동률을 깨 결과를 결정적으로 만든다.
 * @param candidates 비어 있지 않은 배열이어야 한다 (호출부에서 보장)
 */
function pickLowestKey(candidates: WorkLog[], keyOf: (workLog: WorkLog) => number): WorkLog {
  return candidates.reduce((best, candidate) => {
    const bestKey = keyOf(best);
    const candidateKey = keyOf(candidate);

    if (bestKey !== candidateKey) return candidateKey < bestKey ? candidate : best;
    return candidate.id < best.id ? candidate : best;
  });
}

/** 퇴근 처리 대상 후보 중 가장 이른 출근 건 */
function pickEarliestCheckedIn(candidates: WorkLog[]): WorkLog {
  return pickLowestKey(
    candidates,
    (workLog) => toDate(workLog.checkInTime)?.getTime() ?? Number.POSITIVE_INFINITY
  );
}

/** 출근 처리 대상 후보 중 현재 시각과 가장 가까운 것 */
function pickNearestScheduled(candidates: WorkLog[], now: Date): WorkLog {
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  // 파싱 불가 후보(예: '미정')는 거리를 무한대로 둬 항상 후순위가 되게 한다.
  return pickLowestKey(candidates, (workLog) => {
    const start = parseTimeSlotStartMinutes(workLog.timeSlot);
    return start === null ? Number.POSITIVE_INFINITY : cyclicDistanceMinutes(start, nowMinutes);
  });
}

/**
 * QR 스캔 시 처리할 work_log 1건을 자동 선택
 *
 * @param candidates `findQRCandidates` 반환값 — 순서 무보장, cancelled/no_show 포함
 * @param now 현재 시각 (로컬 시각 기준으로 timeSlot 과 비교한다)
 */
export function selectWorkLogForQR(candidates: WorkLog[], now: Date): QRSelectionResult {
  if (candidates.length === 0) {
    return { workLog: null, reason: 'no_assignment' };
  }

  const checkedIn = candidates.filter(
    (workLog) => workLog.status === WORK_LOG_STATUS_VALUES.CHECKED_IN
  );
  if (checkedIn.length > 0) {
    return { workLog: pickEarliestCheckedIn(checkedIn), reason: null };
  }

  const scheduled = candidates.filter(
    (workLog) => workLog.status === WORK_LOG_STATUS_VALUES.SCHEDULED
  );
  if (scheduled.length > 0) {
    return { workLog: pickNearestScheduled(scheduled, now), reason: null };
  }

  const hasFinished = candidates.some(
    (workLog) =>
      workLog.status === WORK_LOG_STATUS_VALUES.CHECKED_OUT ||
      workLog.status === WORK_LOG_STATUS_VALUES.COMPLETED
  );

  return { workLog: null, reason: hasFinished ? 'all_checked_out' : 'not_active' };
}
