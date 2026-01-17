/**
 * Application 레거시 필드 헬퍼 함수
 *
 * @description assignments 배열과 레거시 단일 필드 간의 변환을 처리
 * @version 1.0.0
 *
 * ## 사용 목적
 * - appliedDate, appliedTimeSlot, appliedRole 레거시 필드를 assignments로 통합
 * - 기존 Firestore 데이터 하위 호환성 유지
 * - UI 컴포넌트에서 일관된 데이터 접근 제공
 */

import type { Application } from '@/types/application';
import type { StaffRole } from '@/types/common';

/**
 * 지원 날짜/시간 정보 추출
 *
 * @description assignments 배열이 있으면 사용, 없으면 레거시 필드 폴백
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
  // v2.0: assignments 배열 우선
  if (app.assignments?.length) {
    return {
      dates: app.assignments.flatMap((a) => a.dates ?? []),
      timeSlots: app.assignments
        .map((a) => a.timeSlot)
        .filter((t): t is string => Boolean(t)),
    };
  }

  // 레거시 폴백: 단일 필드
  return {
    dates: app.appliedDate ? [app.appliedDate] : [],
    timeSlots: app.appliedTimeSlot ? [app.appliedTimeSlot] : [],
  };
}

/**
 * 대표 역할 추출
 *
 * @description assignments 배열의 첫 역할 우선, 없으면 appliedRole 폴백
 * @param app Application 객체
 * @returns 대표 역할 (StaffRole)
 *
 * @example
 * ```ts
 * const role = getPrimaryRole(application);
 * // role: 'dealer' | 'floorman' | ...
 * ```
 */
export function getPrimaryRole(app: Application): StaffRole {
  // v2.0: assignments 배열의 첫 역할
  if (app.assignments?.length && app.assignments[0].roleIds?.length) {
    return app.assignments[0].roleIds[0] as StaffRole;
  }

  // 레거시 폴백: appliedRole 필드
  return app.appliedRole;
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
  // v2.0: assignments 배열의 모든 역할
  if (app.assignments?.length) {
    const roles = app.assignments.flatMap((a) => a.roleIds ?? []) as StaffRole[];
    return [...new Set(roles)]; // 중복 제거
  }

  // 레거시 폴백: appliedRole 단일 값
  return [app.appliedRole];
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
 * Assignment 배열이 있는지 확인
 *
 * @description v2.0 지원서인지 레거시 지원서인지 판별
 * @param app Application 객체
 * @returns v2.0 지원서 여부
 */
export function isV2Application(app: Application): boolean {
  return Boolean(app.assignments?.length);
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
