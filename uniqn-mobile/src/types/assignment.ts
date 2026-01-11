/**
 * UNIQN Mobile - Assignment v3.0 타입 정의
 *
 * @description 역할 필드 통합 버전 (role/roles → roleIds)
 * 다중 역할/시간/날짜 조합을 지원하는 지원 선택사항 타입
 *
 * @version 3.0.0 - role/roles를 roleIds 배열로 통합
 * @version 3.0.1 - 고정공고/시간미정 상수 추가
 * @see app2/src/types/application.ts
 */

// ============================================================================
// Constants - 고정공고 및 시간 미정 마커
// ============================================================================

/** 고정공고 날짜 마커 (dates 배열에 사용) */
export const FIXED_DATE_MARKER = 'FIXED_SCHEDULE';

/** 고정공고 시간 마커 (협의 가능) */
export const FIXED_TIME_MARKER = 'NEGOTIABLE';

/** 시간 미정 마커 (추후 공지) */
export const TBA_TIME_MARKER = '미정';

/**
 * 기간 타입
 */
export type DurationType = 'single' | 'consecutive' | 'multi';

/**
 * 체크 방식 타입
 */
export type CheckMethod = 'group' | 'individual';

/**
 * 기간 정보 구조체
 */
export interface AssignmentDuration {
  type: DurationType;
  /** 시작일 (YYYY-MM-DD 형식) */
  startDate: string;
  /** 종료일 (연속/다중일 경우) */
  endDate?: string;
}

/**
 * 지원 선택사항 - 다중 역할/시간/날짜 조합
 *
 * @description
 * Assignment는 구인공고 지원 시 선택한 시간대, 역할, 날짜 조합을 나타냅니다.
 *
 * ## v3.0 변경사항
 * - `role?: string`과 `roles?: string[]`를 `roleIds: string[]`로 통합
 * - 단일 역할도 배열로 표현: `roleIds: ['dealer']`
 * - 다중 역할: `roleIds: ['dealer', 'floor']`
 *
 * @example
 * // 단일 날짜, 단일 역할
 * const singleAssignment: Assignment = {
 *   roleIds: ['dealer'],
 *   timeSlot: '19:00',
 *   dates: ['2025-01-09'],
 *   isGrouped: false,
 *   checkMethod: 'individual'
 * };
 *
 * // 연속 날짜 그룹, 다중 역할
 * const groupAssignment: Assignment = {
 *   roleIds: ['dealer', 'floor'],
 *   timeSlot: '19:00',
 *   dates: ['2025-01-09', '2025-01-10', '2025-01-11'],
 *   isGrouped: true,
 *   groupId: '19:00_dealer_2025-01-09_2025-01-11',
 *   checkMethod: 'group',
 *   duration: { type: 'consecutive', startDate: '2025-01-09', endDate: '2025-01-11' }
 * };
 */
export interface Assignment {
  /**
   * 역할 ID 배열 (v3.0: role/roles 통합)
   * - 단일 역할: ['dealer']
   * - 다중 역할: ['dealer', 'floor']
   * @example ['dealer'], ['dealer', 'floor']
   */
  roleIds: string[];

  /**
   * 시간대 (예: '19:00', '14:00~22:00')
   */
  timeSlot: string;

  /**
   * 날짜 배열 (항상 배열 형태, 단일 날짜도 배열로)
   * @example ['2025-01-09'] 또는 ['2025-01-09', '2025-01-10']
   */
  dates: string[];

  /**
   * 연속된 날짜 그룹 여부
   */
  isGrouped: boolean;

  /**
   * 그룹 식별자 (같은 그룹의 assignments 식별)
   * @example '19:00_dealer_2025-01-09_2025-01-11'
   */
  groupId?: string;

  /**
   * 체크 방식
   * - 'group': 그룹 전체를 한 번에 선택/해제
   * - 'individual': 개별 날짜별로 선택/해제
   */
  checkMethod?: CheckMethod;

  /**
   * 모집 공고 구분자 (날짜 중복 모집 구분용)
   * 같은 날짜에 여러 모집 공고가 있을 때 구분
   */
  requirementId?: string;

  /**
   * 기간 정보
   * - single: 단일 날짜
   * - consecutive: 연속 날짜
   * - multi: 다중 날짜 (비연속 포함)
   */
  duration?: AssignmentDuration;

  /**
   * 시간 미정 여부
   * TimeSlot의 isTimeToBeAnnounced 값을 전달받아 저장
   */
  isTimeToBeAnnounced?: boolean;

  /**
   * 미정 사유 (예: "토너먼트 진행 상황에 따라 결정")
   * TimeSlot의 tentativeDescription 값을 전달받아 저장
   */
  tentativeDescription?: string;
}

/**
 * Assignment에서 첫 번째 역할 이름을 추출
 *
 * @description
 * roleIds 배열에서 첫 번째 역할을 반환합니다.
 * 단일 역할 사용 시 편의를 위한 헬퍼입니다.
 *
 * @param assignment - Assignment 객체
 * @returns 첫 번째 역할 이름 또는 빈 문자열
 */
export function getAssignmentRole(assignment: Assignment): string {
  return assignment.roleIds[0] ?? '';
}

/**
 * Assignment에서 모든 역할 이름을 배열로 추출
 *
 * @description
 * v3.0에서는 roleIds를 그대로 반환합니다.
 * 기존 코드와의 호환성을 위해 유지됩니다.
 *
 * @param assignment - Assignment 객체
 * @returns 역할 이름 배열
 */
export function getAssignmentRoles(assignment: Assignment): string[] {
  return assignment.roleIds;
}

/**
 * Assignment 타입 검증 (타입 가드)
 *
 * @description
 * Assignment 객체가 유효한지 검증합니다.
 * - roleIds는 필수 배열 (최소 1개 이상)
 * - timeSlot은 필수 문자열
 * - dates는 필수 배열 (최소 1개 이상)
 * - isGrouped는 필수 boolean
 *
 * @param obj - 검증할 객체
 * @returns Assignment 타입 여부
 *
 * @example
 * if (isValidAssignment(data)) {
 *   // data는 Assignment 타입으로 안전하게 사용 가능
 *   console.log(data.timeSlot);
 * }
 */
export function isValidAssignment(obj: unknown): obj is Assignment {
  if (!obj || typeof obj !== 'object') return false;
  const candidate = obj as Record<string, unknown>;

  // 필수 필드 검증
  const hasValidRoleIds =
    Array.isArray(candidate.roleIds) &&
    candidate.roleIds.length > 0 &&
    candidate.roleIds.every((r) => typeof r === 'string');

  // 고정공고는 timeSlot이 빈 문자열 또는 FIXED_TIME_MARKER, TBA_TIME_MARKER 허용
  const hasValidTimeSlot = typeof candidate.timeSlot === 'string';

  const hasValidDates =
    Array.isArray(candidate.dates) &&
    candidate.dates.length > 0 &&
    candidate.dates.every((d) => typeof d === 'string');

  const hasValidIsGrouped = typeof candidate.isGrouped === 'boolean';

  return hasValidRoleIds && hasValidTimeSlot && hasValidDates && hasValidIsGrouped;
}

/**
 * 간단한 Assignment 생성 옵션
 */
export interface CreateSimpleAssignmentOptions {
  /** 시간 미정 여부 */
  isTimeToBeAnnounced?: boolean;
  /** 미정 사유 */
  tentativeDescription?: string;
}

/**
 * 간단한 Assignment 생성 헬퍼
 *
 * @param role - 역할 (단일 문자열, 내부에서 배열로 변환)
 * @param timeSlot - 시간대
 * @param date - 단일 날짜
 * @param options - 추가 옵션 (미정 시간 정보 등)
 * @returns Assignment 객체
 */
export function createSimpleAssignment(
  role: string,
  timeSlot: string,
  date: string,
  options?: CreateSimpleAssignmentOptions
): Assignment {
  return {
    roleIds: [role],
    timeSlot,
    dates: [date],
    isGrouped: false,
    checkMethod: 'individual',
    ...(options?.isTimeToBeAnnounced && { isTimeToBeAnnounced: true }),
    ...(options?.tentativeDescription && { tentativeDescription: options.tentativeDescription }),
  };
}

/**
 * 연속 날짜 Assignment 생성 헬퍼
 *
 * @param role - 역할 (단일 문자열, 내부에서 배열로 변환)
 * @param timeSlot - 시간대
 * @param dates - 날짜 배열
 * @returns Assignment 객체
 */
export function createGroupedAssignment(
  role: string,
  timeSlot: string,
  dates: string[]
): Assignment {
  if (dates.length === 0) {
    throw new Error('dates 배열은 최소 1개 이상이어야 합니다');
  }

  const sortedDates = [...dates].sort();
  const startDate = sortedDates[0]!;
  const endDate = sortedDates[sortedDates.length - 1]!;

  return {
    roleIds: [role],
    timeSlot,
    dates: sortedDates,
    isGrouped: dates.length > 1,
    groupId: dates.length > 1 ? `${timeSlot}_${role}_${startDate}_${endDate}` : undefined,
    checkMethod: dates.length > 1 ? 'group' : 'individual',
    duration: {
      type: dates.length === 1 ? 'single' : 'consecutive',
      startDate,
      endDate: dates.length > 1 ? endDate : undefined,
    },
  };
}

/**
 * 다중 역할 Assignment 생성 헬퍼
 *
 * @param roleIds - 역할 ID 배열
 * @param timeSlot - 시간대
 * @param date - 단일 날짜
 * @param options - 추가 옵션
 * @returns Assignment 객체
 */
export function createMultiRoleAssignment(
  roleIds: string[],
  timeSlot: string,
  date: string,
  options?: CreateSimpleAssignmentOptions
): Assignment {
  if (roleIds.length === 0) {
    throw new Error('roleIds 배열은 최소 1개 이상이어야 합니다');
  }

  return {
    roleIds,
    timeSlot,
    dates: [date],
    isGrouped: false,
    checkMethod: 'individual',
    ...(options?.isTimeToBeAnnounced && { isTimeToBeAnnounced: true }),
    ...(options?.tentativeDescription && { tentativeDescription: options.tentativeDescription }),
  };
}
