/**
 * UNIQN Mobile - 공고 일정 Hook
 *
 * @description 공고 일정 정보를 정규화하여 제공
 * @version 1.0.0
 */

import { useMemo } from 'react';
import type { JobPosting } from '@/types';
import {
  type RoleInfo,
  type NormalizedScheduleList,
  type DatedScheduleInfo,
  type FixedScheduleInfo,
  extractAllDates,
  extractAllRoles,
  getTotalRequiredCount,
  getTotalFilledCount,
  isAllRolesFilled,
} from '@/types/unified';
import { normalizeJobSchedule } from '@/utils/normalizers';

// ============================================================================
// Types
// ============================================================================

export interface UseJobScheduleResult {
  /** 정규화된 일정 목록 */
  schedule: NormalizedScheduleList;

  /** 고정공고 여부 */
  isFixed: boolean;

  /** 날짜 기반 공고 여부 */
  isDated: boolean;

  /** 모든 날짜 배열 (dated만) */
  allDates: string[];

  /** 모든 역할 배열 (중복 합산) */
  allRoles: RoleInfo[];

  /** 전체 필요 인원 */
  totalRequired: number;

  /** 전체 충원 인원 */
  totalFilled: number;

  /** 전체 마감 여부 */
  isClosed: boolean;

  /** 고정 일정 (fixed인 경우) */
  fixedSchedule: FixedScheduleInfo | null;

  /** 날짜별 일정 (dated인 경우) */
  datedSchedules: DatedScheduleInfo[];
}

// ============================================================================
// Hook
// ============================================================================

/**
 * 공고의 일정 정보를 정규화하여 제공하는 Hook
 *
 * @description 공고 타입(fixed/dated)에 관계없이 일관된 인터페이스 제공
 * 컴포넌트에서 분기 로직 없이 사용 가능
 *
 * @param job - JobPosting 객체 (null 가능)
 * @returns UseJobScheduleResult
 *
 * @example
 * function JobCard({ job }) {
 *   const { isFixed, fixedSchedule, datedSchedules, allRoles } = useJobSchedule(job);
 *
 *   if (isFixed && fixedSchedule) {
 *     return <FixedScheduleCard schedule={fixedSchedule} />;
 *   }
 *
 *   return datedSchedules.map(schedule => (
 *     <DatedScheduleCard key={schedule.date} schedule={schedule} />
 *   ));
 * }
 */
export function useJobSchedule(job: JobPosting | null): UseJobScheduleResult {
  return useMemo(() => {
    // 공고 없으면 빈 결과 반환
    if (!job) {
      return {
        schedule: { type: 'dated', items: [] },
        isFixed: false,
        isDated: true,
        allDates: [],
        allRoles: [],
        totalRequired: 0,
        totalFilled: 0,
        isClosed: true,
        fixedSchedule: null,
        datedSchedules: [],
      };
    }

    // 일정 정규화
    const schedule = normalizeJobSchedule(job);
    const isFixed = schedule.type === 'fixed';

    // 날짜/역할 추출
    const allDates = extractAllDates(schedule);
    const allRoles = extractAllRoles(schedule);

    // 통계 계산
    const totalRequired = getTotalRequiredCount(allRoles);
    const totalFilled = getTotalFilledCount(allRoles);
    const isClosed = isAllRolesFilled(allRoles);

    // 타입별 일정 분리
    const fixedSchedule = isFixed
      ? (schedule.items[0] as FixedScheduleInfo)
      : null;
    const datedSchedules = isFixed
      ? []
      : (schedule.items as DatedScheduleInfo[]);

    return {
      schedule,
      isFixed,
      isDated: !isFixed,
      allDates,
      allRoles,
      totalRequired,
      totalFilled,
      isClosed,
      fixedSchedule,
      datedSchedules,
    };
  }, [job]);
}

export default useJobSchedule;
