/**
 * UNIQN Mobile - 공고 정렬 유틸리티
 *
 * @description 공고 목록의 날짜/시간 기반 정렬 로직
 * @version 1.0.0
 *
 * @performance
 * - 기존: useMemo 내부 함수 정의 + 중첩 정렬 (O(n * m log m + n log n))
 * - 개선: 외부 유틸리티 + 단일 순회 최소값 탐색 (O(n * m + n log n))
 */

import type { JobPostingCard } from '@/types';

// ============================================================================
// Types
// ============================================================================

interface JobWithSortKey {
  job: JobPostingCard;
  sortKey: string;
  isFuture: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 공고의 가장 빠른 미래 날짜+시간 계산
 *
 * @description
 * - 정렬을 피하고 단일 순회로 최소값 탐색 (O(m) vs O(m log m))
 * - 미래 날짜 우선, 없으면 가장 최근 과거 날짜 반환
 *
 * @param job 공고 카드 데이터
 * @param today 오늘 날짜 (YYYY-MM-DD)
 * @returns 정렬 키 문자열 (YYYY-MM-DD HH:mm)
 */
export function getEarliestFutureDateTime(
  job: JobPostingCard,
  today: string
): string {
  // dateRequirements가 없는 레거시 공고
  if (!job.dateRequirements?.length) {
    const time = job.timeSlot?.split(' - ')[0] ?? '99:99';
    return `${job.workDate || '9999-99-99'} ${time}`;
  }

  let earliestFuture = '';
  let latestPast = '';

  for (const dr of job.dateRequirements) {
    const dateStr = dr.date;

    // 정렬 없이 최소 시작 시간 찾기 (O(m) vs O(m log m))
    let minTime = '99:99';
    if (dr.timeSlots) {
      for (const ts of dr.timeSlots) {
        if (!ts.isTimeToBeAnnounced && ts.startTime && ts.startTime < minTime) {
          minTime = ts.startTime;
        }
      }
    }

    const dateTime = `${dateStr} ${minTime}`;

    if (dateStr >= today) {
      // 미래 날짜 중 가장 빠른 것
      if (!earliestFuture || dateTime < earliestFuture) {
        earliestFuture = dateTime;
      }
    } else {
      // 과거 날짜 중 가장 최근 것
      if (!latestPast || dateTime > latestPast) {
        latestPast = dateTime;
      }
    }
  }

  return earliestFuture || latestPast || '9999-99-99 99:99';
}

// ============================================================================
// Main Sort Function
// ============================================================================

/**
 * 공고 목록 정렬 (미래 먼저, 가까운 순)
 *
 * @description
 * 1. 정렬 키 사전 계산 (O(n))
 * 2. 미래/과거 분리 정렬 (O(n log n))
 *    - 미래 날짜: 가까운 순 (오름차순)
 *    - 과거 날짜: 최근 순 (내림차순)
 *
 * @param jobs 정렬할 공고 목록
 * @returns 정렬된 공고 목록
 *
 * @example
 * const sorted = sortJobPostings(jobs);
 */
export function sortJobPostings(jobs: JobPostingCard[]): JobPostingCard[] {
  if (jobs.length === 0) return [];

  const today = new Date().toISOString().split('T')[0] ?? '';

  // 1. 정렬 키 사전 계산 (O(n))
  const jobsWithKeys: JobWithSortKey[] = jobs.map((job) => {
    const sortKey = getEarliestFutureDateTime(job, today);
    const date = sortKey.split(' ')[0] ?? '';
    return {
      job,
      sortKey,
      isFuture: date >= today,
    };
  });

  // 2. 정렬 (O(n log n))
  jobsWithKeys.sort((a, b) => {
    // 미래 날짜가 과거보다 먼저
    if (a.isFuture && !b.isFuture) return -1;
    if (!a.isFuture && b.isFuture) return 1;

    // 둘 다 미래: 가까운 날짜+시간 먼저 (오름차순)
    if (a.isFuture) {
      return a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0;
    }

    // 둘 다 과거: 최근 날짜+시간 먼저 (내림차순)
    return a.sortKey > b.sortKey ? -1 : a.sortKey < b.sortKey ? 1 : 0;
  });

  // 3. 정렬된 job만 반환
  return jobsWithKeys.map((item) => item.job);
}
