/**
 * UNIQN Mobile - Assignment v2.0 타입 정의
 *
 * @description 웹앱(app2/)과 100% 호환되는 Assignment 구조
 * 다중 역할/시간/날짜 조합을 지원하는 지원 선택사항 타입
 *
 * @version 2.0.0
 * @see app2/src/types/application.ts
 */

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
 * ## 역할(role) 사용 패턴
 *
 * **패턴 1: 단일 역할 (role 사용)**
 * - 일반적인 지원 시 사용
 * - 예: `{ role: 'dealer', timeSlot: '19:00', dates: ['2025-01-09'] }`
 *
 * **패턴 2: 다중 역할 (roles 사용)**
 * - 고정공고 등에서 여러 역할을 동시에 지원할 때 사용
 * - 예: `{ roles: ['dealer', 'floor'], timeSlot: '19:00', dates: ['2025-01-09'] }`
 *
 * @note role과 roles 중 하나만 사용해야 합니다. 둘 다 있으면 role이 우선합니다.
 *
 * @example
 * // 단일 날짜, 단일 역할
 * const singleAssignment: Assignment = {
 *   role: 'dealer',
 *   timeSlot: '19:00',
 *   dates: ['2025-01-09'],
 *   isGrouped: false,
 *   checkMethod: 'individual'
 * };
 *
 * // 연속 날짜 그룹
 * const groupAssignment: Assignment = {
 *   role: 'dealer',
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
   * 단일 역할 (개별 선택 시 사용)
   * @example 'dealer', 'floor', 'chip_runner'
   */
  role?: string;

  /**
   * 다중 역할 (고정공고 등에서 여러 역할 동시 지원 시 사용)
   * @example ['dealer', 'floor']
   */
  roles?: string[];

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
 * Assignment에서 역할 이름을 안전하게 추출
 *
 * @description
 * role 또는 roles에서 역할 이름을 추출합니다.
 * role이 있으면 role 반환, 없으면 roles의 첫 번째 값 반환
 *
 * @param assignment - Assignment 객체
 * @returns 역할 이름 또는 빈 문자열
 */
export function getAssignmentRole(assignment: Assignment): string {
  if (assignment.role) return assignment.role;
  if (assignment.roles && assignment.roles.length > 0) return assignment.roles[0] ?? '';
  return '';
}

/**
 * Assignment에서 모든 역할 이름을 배열로 추출
 *
 * @param assignment - Assignment 객체
 * @returns 역할 이름 배열
 */
export function getAssignmentRoles(assignment: Assignment): string[] {
  if (assignment.roles && assignment.roles.length > 0) return assignment.roles;
  if (assignment.role) return [assignment.role];
  return [];
}

/**
 * Assignment 타입 검증 (타입 가드)
 *
 * @description
 * Assignment 객체가 유효한지 검증합니다.
 * - role 또는 roles 중 하나는 반드시 있어야 함
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
  const hasValidRole =
    typeof candidate.role === 'string' ||
    (Array.isArray(candidate.roles) && candidate.roles.length > 0);

  const hasValidTimeSlot = typeof candidate.timeSlot === 'string' && candidate.timeSlot.length > 0;

  const hasValidDates =
    Array.isArray(candidate.dates) &&
    candidate.dates.length > 0 &&
    candidate.dates.every((d) => typeof d === 'string');

  const hasValidIsGrouped = typeof candidate.isGrouped === 'boolean';

  return hasValidRole && hasValidTimeSlot && hasValidDates && hasValidIsGrouped;
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
 * @param role - 역할
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
    role,
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
 * @param role - 역할
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
    role,
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
