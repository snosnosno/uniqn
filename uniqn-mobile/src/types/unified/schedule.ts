/**
 * UNIQN Mobile - 통합 일정 타입
 *
 * @description Discriminated Union을 사용한 공고 타입별 일정 표현
 * @version 1.0.0
 */

import type { TimeSlotInfo } from './timeSlot';
import type { RoleInfo } from './role';

// ============================================================================
// Types - Discriminated Union
// ============================================================================

/**
 * 공고 일정 타입 구분
 *
 * @description 'dated' = 날짜 기반 (regular, urgent, tournament)
 *              'fixed' = 고정 (fixed 공고)
 */
export type JobScheduleType = 'dated' | 'fixed';

/**
 * 날짜 기반 일정 정보 (regular, urgent, tournament 공고용)
 *
 * @description 특정 날짜에 대한 시간대별 역할 모집 정보
 */
export interface DatedScheduleInfo {
  /** 일정 타입 (discriminator) */
  type: 'dated';

  /** 날짜 (YYYY-MM-DD) */
  date: string;

  /** 시간대별 정보 */
  timeSlots: TimeSlotInfo[];
}

/**
 * 고정 일정 정보 (fixed 공고용)
 *
 * @description 반복 근무 패턴 정보
 */
export interface FixedScheduleInfo {
  /** 일정 타입 (discriminator) */
  type: 'fixed';

  /** 주 출근일수 (0 = 협의, 1-7 = 일수) */
  daysPerWeek: number;

  /** 출근 시간 (HH:mm), 협의인 경우 null */
  startTime: string | null;

  /** 출근 시간 협의 여부 */
  isStartTimeNegotiable: boolean;

  /** 역할별 모집 정보 */
  roles: RoleInfo[];
}

/**
 * 정규화된 일정 정보 (Discriminated Union)
 *
 * @description DatedScheduleInfo 또는 FixedScheduleInfo
 * type 필드로 구분하여 타입 가드 사용 가능
 */
export type NormalizedSchedule = DatedScheduleInfo | FixedScheduleInfo;

/**
 * 정규화된 일정 목록
 */
export interface NormalizedScheduleList {
  /** 일정 타입 ('dated' | 'fixed') */
  type: JobScheduleType;

  /** 일정 목록 */
  items: NormalizedSchedule[];
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * 날짜 기반 일정인지 확인
 *
 * @param schedule - NormalizedSchedule 객체
 * @returns DatedScheduleInfo 여부
 */
export function isDatedSchedule(schedule: NormalizedSchedule): schedule is DatedScheduleInfo {
  return schedule.type === 'dated';
}

/**
 * 고정 일정인지 확인
 *
 * @param schedule - NormalizedSchedule 객체
 * @returns FixedScheduleInfo 여부
 */
export function isFixedSchedule(schedule: NormalizedSchedule): schedule is FixedScheduleInfo {
  return schedule.type === 'fixed';
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * DatedScheduleInfo 생성 헬퍼
 *
 * @param date - 날짜 (YYYY-MM-DD)
 * @param timeSlots - 시간대 배열
 * @param options - 추가 옵션
 * @returns DatedScheduleInfo 객체
 */
export function createDatedSchedule(
  date: string,
  timeSlots: TimeSlotInfo[]
): DatedScheduleInfo {
  return {
    type: 'dated',
    date,
    timeSlots,
  };
}

/**
 * FixedScheduleInfo 생성 헬퍼
 *
 * @param daysPerWeek - 주 출근일수
 * @param roles - 역할 배열
 * @param options - 추가 옵션
 * @returns FixedScheduleInfo 객체
 */
export function createFixedSchedule(
  daysPerWeek: number,
  roles: RoleInfo[],
  options?: {
    startTime?: string | null;
    isStartTimeNegotiable?: boolean;
  }
): FixedScheduleInfo {
  return {
    type: 'fixed',
    daysPerWeek,
    startTime: options?.isStartTimeNegotiable ? null : (options?.startTime ?? null),
    isStartTimeNegotiable: options?.isStartTimeNegotiable ?? false,
    roles,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * 일정 목록에서 모든 날짜 추출 (dated만)
 *
 * @param scheduleList - NormalizedScheduleList
 * @returns 날짜 배열 (정렬됨)
 */
export function extractAllDates(scheduleList: NormalizedScheduleList): string[] {
  if (scheduleList.type === 'fixed') {
    return [];
  }

  const dates = scheduleList.items.filter(isDatedSchedule).map((s) => s.date);

  return [...new Set(dates)].sort();
}

/**
 * 일정 목록에서 모든 역할 추출 (중복 합산)
 *
 * @param scheduleList - NormalizedScheduleList
 * @returns RoleInfo 배열 (역할별 합산)
 */
export function extractAllRoles(scheduleList: NormalizedScheduleList): RoleInfo[] {
  const roleMap = new Map<string, RoleInfo>();

  for (const schedule of scheduleList.items) {
    let roles: RoleInfo[];

    if (isFixedSchedule(schedule)) {
      roles = schedule.roles;
    } else {
      roles = schedule.timeSlots.flatMap((ts) => ts.roles);
    }

    for (const role of roles) {
      const existing = roleMap.get(role.roleId);
      if (existing) {
        roleMap.set(role.roleId, {
          ...existing,
          requiredCount: existing.requiredCount + role.requiredCount,
          filledCount: existing.filledCount + role.filledCount,
        });
      } else {
        roleMap.set(role.roleId, { ...role });
      }
    }
  }

  return Array.from(roleMap.values());
}

/**
 * 고정 일정 표시 문자열 생성
 *
 * @param schedule - FixedScheduleInfo 객체
 * @returns 표시용 문자열 (예: "주 5일, 19:00 출근")
 */
export function formatFixedScheduleDisplay(schedule: FixedScheduleInfo): string {
  const daysText = schedule.daysPerWeek === 0 ? '협의' : `주 ${schedule.daysPerWeek}일`;

  const timeText = schedule.isStartTimeNegotiable ? '협의' : (schedule.startTime ?? '미정');

  return `${daysText}, ${timeText} 출근`;
}

/**
 * 날짜 포맷팅 (M/D(요일))
 *
 * @param dateStr - YYYY-MM-DD 형식 날짜
 * @returns 포맷된 날짜 문자열
 */
export function formatDateDisplay(dateStr: string): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;

  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];

  return `${month}/${day}(${dayOfWeek})`;
}
