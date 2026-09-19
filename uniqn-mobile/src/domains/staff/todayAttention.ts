/**
 * todayAttention — 내 공고 탭 "오늘 한 줄" 집계 (순수 함수, 구인자 IA S3)
 *
 * 세는 것은 둘뿐이다.
 * - **미출근**: 오늘 근무인데 아직 `scheduled`. 공고 상세의 `todayAbsentCount`
 *   (`todayGroup.stats.scheduled`) 와 **같은 정의**다 — 탭에서 누르고 들어간 상세의 숫자가
 *   다르면 사장은 둘 중 하나가 틀렸다고 읽는다. 시작 시각으로 거르지 않는 이유도 같다.
 *   고정 공고는 뺀다: QR 진입점이 없어 출근이 영원히 비므로 상세도 이 신호를 0으로 누른다.
 * - **퇴근 미기록**: 판정을 새로 만들지 않고 `summarizeMissingCheckouts` 를 그대로 쓴다
 *   (야간 교차 근무 유예가 거기에 있다).
 *
 * 이동할 곳: 신호가 **공고 하나**에만 있으면 그 공고의 [근무], 여러 공고면 근무표.
 * 근무표 날짜는 미출근이 있으면 오늘, 퇴근 미기록만 있으면 가장 오래된 날짜.
 */
import { STATUS } from '@/constants';
import { toDateString } from '@/utils/date';
import type { WorkLog } from '@/types/schedule';
import { summarizeMissingCheckouts } from './missingCheckout';

export type TodayAttentionTarget =
  | { kind: 'posting'; jobPostingId: string }
  | { kind: 'schedule'; date: string };

export interface TodayAttentionSummary {
  /** 오늘 근무 중 아직 출근하지 않은 건수 */
  absentCount: number;
  /** 지난 날짜 중 퇴근이 기록되지 않은 건수 */
  missingCheckoutCount: number;
  /** 눌렀을 때 갈 곳. 신호가 없으면 null */
  target: TodayAttentionTarget | null;
}

export function summarizeTodayAttention(
  workLogs: readonly WorkLog[],
  now: Date
): TodayAttentionSummary {
  const today = toDateString(now);

  const absentLogs = workLogs.filter(
    (log) => log.date === today && log.status === STATUS.WORK_LOG.SCHEDULED && !log.isFixedPosting
  );

  // 퇴근 미기록 판정은 기존 집계에 맡기고, 어느 공고가 신호를 냈는지만 따로 추린다.
  const missing = summarizeMissingCheckouts(workLogs, now);
  const missingLogs = workLogs.filter(
    (log) =>
      log.status === STATUS.WORK_LOG.CHECKED_IN && summarizeMissingCheckouts([log], now).count > 0
  );

  const absentCount = absentLogs.length;
  const missingCheckoutCount = missing.count;

  if (absentCount === 0 && missingCheckoutCount === 0) {
    return { absentCount, missingCheckoutCount, target: null };
  }

  const postingIds = new Set(
    [...absentLogs, ...missingLogs].map((log) => log.jobPostingId).filter(Boolean)
  );

  const target: TodayAttentionTarget =
    postingIds.size === 1
      ? { kind: 'posting', jobPostingId: [...postingIds][0]! }
      : { kind: 'schedule', date: absentCount > 0 ? today : (missing.earliestDate ?? today) };

  return { absentCount, missingCheckoutCount, target };
}
