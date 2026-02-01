/**
 * UNIQN Mobile - 일정 정규화 함수
 *
 * @description JobPosting을 NormalizedScheduleList로 변환
 * @version 1.0.0
 */

import type { JobPosting, DateSpecificRequirement, TimeSlot } from '@/types';
import { getDateFromRequirement } from '@/types';
import {
  type RoleInfo,
  type TimeSlotInfo,
  type DatedScheduleInfo,
  type FixedScheduleInfo,
  type NormalizedScheduleList,
  createTimeSlotInfo,
  createDatedSchedule,
  createFixedSchedule,
} from '@/types/unified';
import { normalizeFormRoleRequirement, normalizeJobRoleStats } from './roleNormalizer';

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * TimeSlot -> TimeSlotInfo 변환
 */
function normalizeTimeSlot(slot: TimeSlot, index: number): TimeSlotInfo {
  const roles: RoleInfo[] = (slot.roles ?? []).map(normalizeFormRoleRequirement);

  // startTime 필드에서 시간 추출
  const startTime = slot.startTime ?? null;

  return createTimeSlotInfo(slot.id ?? `slot-${index}`, startTime, roles, {
    isTimeToBeAnnounced: slot.isTimeToBeAnnounced,
    tentativeDescription: slot.tentativeDescription,
  });
}

/**
 * DateSpecificRequirement -> DatedScheduleInfo 변환
 */
function normalizeDateRequirement(req: DateSpecificRequirement, _index: number): DatedScheduleInfo {
  const dateStr = getDateFromRequirement(req);
  const timeSlots = (req.timeSlots ?? []).map(normalizeTimeSlot);

  return createDatedSchedule(dateStr, timeSlots, {
    isMainDate: req.isMainDate,
    description: req.description,
  });
}

/**
 * 고정공고 -> FixedScheduleInfo 변환
 */
function normalizeFixedScheduleFromJob(job: JobPosting): FixedScheduleInfo {
  // 역할 목록 추출
  const roles: RoleInfo[] = (job.requiredRolesWithCount ?? []).map((r) => ({
    roleId: r.role ?? r.name ?? 'other',
    displayName: r.name ?? r.role ?? '역할',
    requiredCount: r.count,
    filledCount: r.filled ?? 0,
  }));

  // 출근 시간 추출
  const startTime = job.timeSlot?.split(/[-~]/)[0]?.trim() ?? null;

  return createFixedSchedule(job.daysPerWeek ?? 0, roles, {
    startTime,
    isStartTimeNegotiable: job.isStartTimeNegotiable,
  });
}

/**
 * 레거시 단일 날짜 -> DatedScheduleInfo 변환
 */
function normalizeLegacySchedule(job: JobPosting): DatedScheduleInfo {
  const roles: RoleInfo[] = (job.roles ?? []).map(normalizeJobRoleStats);

  // 시간 추출
  const startTime = job.timeSlot?.split(/[-~]/)[0]?.trim() ?? null;
  const endTime = job.timeSlot?.split(/[-~]/)[1]?.trim() ?? null;

  const timeSlot: TimeSlotInfo = createTimeSlotInfo('legacy-slot', startTime, roles, { endTime });

  return createDatedSchedule(job.workDate, [timeSlot]);
}

// ============================================================================
// Main Normalizer
// ============================================================================

/**
 * 공고의 일정 정보를 정규화된 형태로 변환
 *
 * @description 공고 타입에 관계없이 NormalizedScheduleList로 변환
 * - fixed: FixedScheduleInfo 1개
 * - regular/urgent/tournament: DatedScheduleInfo 배열
 * - 레거시: workDate/timeSlot에서 DatedScheduleInfo 1개 생성
 *
 * @param job - JobPosting 객체
 * @returns NormalizedScheduleList
 *
 * @example
 * const schedules = normalizeJobSchedule(job);
 * if (schedules.type === 'fixed') {
 *   const fixed = schedules.items[0] as FixedScheduleInfo;
 *   console.log(fixed.daysPerWeek); // 5
 * } else {
 *   const dated = schedules.items as DatedScheduleInfo[];
 *   console.log(dated[0].date); // "2025-01-15"
 * }
 */
export function normalizeJobSchedule(job: JobPosting): NormalizedScheduleList {
  // 1. 고정공고
  if (job.postingType === 'fixed') {
    return {
      type: 'fixed',
      items: [normalizeFixedScheduleFromJob(job)],
    };
  }

  // 2. 날짜별 요구사항이 있는 경우
  if (job.dateSpecificRequirements?.length) {
    const dated = job.dateSpecificRequirements.map(normalizeDateRequirement);
    return {
      type: 'dated',
      items: sortDatedSchedules(dated),
    };
  }

  // 3. 레거시: 단일 날짜
  if (job.workDate) {
    return {
      type: 'dated',
      items: [normalizeLegacySchedule(job)],
    };
  }

  // 4. 데이터 없음
  return { type: 'dated', items: [] };
}

/**
 * 날짜 정렬 (오늘 기준 가까운 미래 -> 과거)
 */
function sortDatedSchedules(schedules: DatedScheduleInfo[]): DatedScheduleInfo[] {
  const today = new Date().toISOString().split('T')[0] ?? '';

  return [...schedules].sort((a, b) => {
    const aIsFuture = a.date >= today;
    const bIsFuture = b.date >= today;

    // 미래 날짜 우선
    if (aIsFuture && !bIsFuture) return -1;
    if (!aIsFuture && bIsFuture) return 1;

    // 같은 그룹 내에서는 날짜순
    if (aIsFuture && bIsFuture) return a.date.localeCompare(b.date);
    return b.date.localeCompare(a.date); // 과거는 최신순
  });
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * 공고가 고정공고인지 확인
 *
 * @param job - JobPosting 객체
 * @returns 고정공고 여부
 */
export function isFixedJobPosting(job: JobPosting): boolean {
  return job.postingType === 'fixed';
}

/**
 * 공고가 날짜별 요구사항을 가지고 있는지 확인
 *
 * @param job - JobPosting 객체
 * @returns dateSpecificRequirements 존재 여부
 */
export function hasDatedRequirements(job: JobPosting): boolean {
  return Boolean(job.postingType !== 'fixed' && job.dateSpecificRequirements?.length);
}

/**
 * 공고가 레거시 형식인지 확인
 *
 * @param job - JobPosting 객체
 * @returns 레거시 형식 여부
 */
export function isLegacyJobPosting(job: JobPosting): boolean {
  return Boolean(
    job.postingType !== 'fixed' && !job.dateSpecificRequirements?.length && job.workDate
  );
}
