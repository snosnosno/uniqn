/**
 * Application 헬퍼 함수
 *
 * @description assignments 배열 기반 데이터 접근 유틸리티
 * @version 2.0.0
 *
 * ## 사용 목적
 * - assignments 배열에서 일관된 데이터 접근 제공
 * - UI 컴포넌트에서 사용하는 공통 로직 추출
 */

import type { Application } from '@/types/application';
import type { StaffRole } from '@/types/common';

/**
 * 지원 날짜/시간 정보 추출
 *
 * @description assignments 배열에서 날짜와 시간대 추출
 * @param app Application 객체
 * @returns 날짜와 시간대 배열
 *
 * @example
 * ```ts
 * const { dates, timeSlots } = getAppliedDateInfo(application);
 * // dates: ['2024-03-15', '2024-03-16']
 * // timeSlots: ['18:00~02:00', '19:00~03:00']
 * ```
 */
export function getAppliedDateInfo(app: Application): {
  dates: string[];
  timeSlots: string[];
} {
  if (!app.assignments.length) {
    return { dates: [], timeSlots: [] };
  }

  return {
    dates: app.assignments.flatMap((a) => a.dates ?? []),
    timeSlots: app.assignments
      .map((a) => a.timeSlot)
      .filter((t): t is string => Boolean(t)),
  };
}

/**
 * 대표 역할 추출
 *
 * @description assignments 배열의 첫 번째 역할 반환
 * @param app Application 객체
 * @returns 대표 역할 (StaffRole) 또는 'other'
 *
 * @example
 * ```ts
 * const role = getPrimaryRole(application);
 * // role: 'dealer' | 'floorman' | ...
 * ```
 */
export function getPrimaryRole(app: Application): StaffRole {
  if (app.assignments.length && app.assignments[0].roleIds?.length) {
    return app.assignments[0].roleIds[0] as StaffRole;
  }

  // assignments가 비어있거나 roleIds가 없는 경우
  return 'other' as StaffRole;
}

/**
 * 모든 역할 추출
 *
 * @description assignments 배열의 모든 역할 수집, 중복 제거
 * @param app Application 객체
 * @returns 역할 배열 (중복 없음)
 *
 * @example
 * ```ts
 * const roles = getAllRoles(application);
 * // roles: ['dealer', 'floorman']
 * ```
 */
export function getAllRoles(app: Application): StaffRole[] {
  if (!app.assignments.length) {
    return [];
  }

  const roles = app.assignments.flatMap((a) => a.roleIds ?? []) as StaffRole[];
  return [...new Set(roles)]; // 중복 제거
}

/**
 * 첫 번째 지원 날짜 추출
 *
 * @description UI에서 단일 날짜 표시용
 * @param app Application 객체
 * @returns 첫 번째 날짜 또는 undefined
 */
export function getFirstAppliedDate(app: Application): string | undefined {
  const { dates } = getAppliedDateInfo(app);
  return dates[0];
}

/**
 * 첫 번째 시간대 추출
 *
 * @description UI에서 단일 시간대 표시용
 * @param app Application 객체
 * @returns 첫 번째 시간대 또는 undefined
 */
export function getFirstTimeSlot(app: Application): string | undefined {
  const { timeSlots } = getAppliedDateInfo(app);
  return timeSlots[0];
}

/**
 * Assignment 배열이 유효한지 확인
 *
 * @description assignments가 존재하고 비어있지 않은지 판별
 * @param app Application 객체
 * @returns assignments가 유효한지 여부
 */
export function hasValidAssignments(app: Application): boolean {
  return app.assignments.length > 0;
}

/**
 * 날짜/시간 포맷팅된 문자열 반환
 *
 * @description UI 표시용 포맷팅
 * @param app Application 객체
 * @returns 포맷팅된 문자열 (예: "3/15 18:00~02:00")
 */
export function getFormattedSchedule(app: Application): string {
  const { dates, timeSlots } = getAppliedDateInfo(app);

  if (dates.length === 0) return '';

  const firstDate = dates[0];
  const firstTimeSlot = timeSlots[0] ?? '';

  // 날짜 포맷팅 (YYYY-MM-DD -> M/D)
  const formattedDate = firstDate
    ? `${parseInt(firstDate.split('-')[1] ?? '0')}/${parseInt(firstDate.split('-')[2] ?? '0')}`
    : '';

  return firstTimeSlot ? `${formattedDate} ${firstTimeSlot}` : formattedDate;
}
