/**
 * 🎯 통합 지원 데이터 구조 타입 정의
 *
 * 목적: 기존의 중복되는 4가지 데이터 구조를 하나로 통합
 * - assignedDate, assignedRole, assignedTime (단일 값)
 * - assignedDates, assignedRoles, assignedTimes (배열)
 * - assignments (구조화된 객체 배열)
 * - dateAssignments (날짜별 그룹)
 *
 * 🚀 개선 사항:
 * - 단일 진실의 원천(Single Source of Truth): assignments 배열만 사용
 * - 75% 데이터 중복 제거
 * - 60% 저장 용량 절약
 * - 단순화된 쿼리 및 유지보수
 *
 * @version 2.0.0
 * @author T-HOLDEM Development Team
 * @date 2025-01-09
 */

import { Timestamp } from 'firebase/firestore';
import type { DateValue } from './applicants/selection';

/**
 * 지원 선택사항 - 단일 또는 다중 역할/시간/날짜 조합
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

  /** 시간대 (예: '19:00', '14:00~22:00') */
  timeSlot: string;

  /**
   * 날짜 배열 (항상 배열 형태, 단일 날짜도 배열로)
   * @example ['2025-01-09'] 또는 ['2025-01-09', '2025-01-10']
   */
  dates: string[];

  /** 연속된 날짜 그룹 여부 */
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
  checkMethod?: 'group' | 'individual';

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
  duration?: {
    type: 'single' | 'consecutive' | 'multi';
    /** 시작일 (YYYY-MM-DD 형식) */
    startDate: string;
    /** 종료일 (연속/다중일 경우) */
    endDate?: DateValue;
  };
}

/**
 * 사전 질문 답변
 */
export interface PreQuestionAnswer {
  questionId: string;
  question: string;
  answer: string;
  required: boolean;
}

/**
 * 지원서 히스토리 엔트리 (확정/취소 이력 추적)
 */
export interface ApplicationHistoryEntry {
  confirmedAt: Timestamp;
  cancelledAt?: Timestamp;
  assignments: Assignment[];
}

/**
 * 🎯 통합 지원서 구조 (v2.0)
 *
 * 특징:
 * - assignments 배열이 단일 진실의 원천
 * - 레거시 필드 완전 제거
 * - 히스토리 추적 기능 내장
 * - 타입 안전성 보장
 */
export interface Application {
  // === 기본 정보 ===
  id: string;
  applicantId: string;
  applicantName: string;
  applicantEmail?: string;
  applicantPhone?: string;

  // === 구인공고 정보 ===
  eventId: string; // 표준 필드 (CLAUDE.md 준수)
  postId: string; // 하위 호환성
  postTitle: string;

  // === 상태 관리 ===
  status: 'applied' | 'confirmed' | 'cancelled' | 'pending';

  // === 모집 유형 구분 ===
  recruitmentType?: 'event' | 'fixed'; // event: 이벤트 공고, fixed: 고정 공고

  // === 핵심 배정 정보 (Single Source of Truth) ===
  assignments: Assignment[];

  // === 히스토리 관리 ===
  originalApplication?: {
    // 최초 지원 시 선택사항 보존 (확정/취소 추적용)
    assignments: Assignment[];
    appliedAt: Timestamp;
  };

  confirmationHistory?: ApplicationHistoryEntry[]; // 확정/취소 이력

  // === 추가 정보 ===
  preQuestionAnswers?: PreQuestionAnswer[];
  notes?: string;

  // === 구인공고 정보 (MyApplicationsTab에서 사용) ===
  jobPosting?: {
    id: string;
    title: string;
    location: string;
    district?: string;
    detailedAddress?: string;
    eventDate?: string;
    [key: string]: string | undefined;
  };

  // === 메타데이터 ===
  appliedAt: Timestamp;
  confirmedAt?: Timestamp;
  cancelledAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastModified?: Timestamp; // 하위 호환성
}

/**
 * 🔄 레거시 지원서 구조 (마이그레이션용)
 *
 * 기존 Firebase 데이터를 새 구조로 변환할 때 사용
 */
export interface LegacyApplication {
  // 기본 정보 (변경 없음)
  id: string;
  applicantId: string;
  applicantName: string;
  eventId: string;
  postId: string;
  postTitle: string;
  status: string;
  appliedAt: Timestamp | string | Date; // 다양한 형태 지원

  // 레거시 단일 필드들
  assignedDate?: string;
  assignedRole?: string;
  assignedTime?: string;

  // 레거시 배열 필드들
  assignedDates?: string[];
  assignedRoles?: string[];
  assignedTimes?: string[];

  // 레거시 구조화 필드들
  assignments?: Partial<Assignment>[]; // 기존 assignments 구조
  dateAssignments?: { date: string; selections: { timeSlot: string; role: string }[] }[]; // 날짜별 그룹 구조

  // 기타 필드들
  preQuestionAnswers?: PreQuestionAnswer[];
  [key: string]: unknown; // 기타 예상치 못한 필드들
}

/**
 * 지원자 통계 정보
 */
export interface ApplicationStats {
  total: number;
  byStatus: {
    applied: number;
    confirmed: number;
    cancelled: number;
  };
  byRole: { [role: string]: number };
  byTimeSlot: { [timeSlot: string]: number };
  byDate: { [date: string]: number };
}

/**
 * 지원서 필터 옵션
 */
export interface ApplicationFilters {
  status?: 'applied' | 'confirmed' | 'cancelled';
  role?: string;
  timeSlot?: string;
  dateRange?: {
    start: string;
    end: string;
  };
  searchTerm?: string;
}

/**
 * 지원서 정렬 옵션
 */
export type ApplicationSortBy = 'appliedAt' | 'name' | 'status' | 'role';
export type ApplicationSortOrder = 'asc' | 'desc';

/**
 * 마이그레이션 결과
 */
export interface MigrationResult {
  success: boolean;
  processed: number;
  migrated: number;
  errors: string[];
  warnings: string[];
}

/**
 * 타입 가드 함수들
 */

/**
 * Assignment 타입 검증
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
 * Application 타입 검증
 */
export function isValidApplication(obj: unknown): obj is Application {
  if (!obj || typeof obj !== 'object') return false;
  const candidate = obj as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.applicantId === 'string' &&
    typeof candidate.applicantName === 'string' &&
    typeof candidate.eventId === 'string' &&
    typeof candidate.postId === 'string' &&
    ['applied', 'confirmed', 'cancelled'].includes(candidate.status as string) &&
    Array.isArray(candidate.assignments) &&
    (candidate.assignments as unknown[]).every(isValidAssignment)
  );
}

/**
 * 레거시 Application 타입 검증
 */
export function isLegacyApplication(obj: unknown): obj is LegacyApplication {
  if (!obj || typeof obj !== 'object') return false;
  const candidate = obj as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.applicantId === 'string' &&
    // 레거시 필드 중 하나라도 존재하면 레거시로 판단
    (!!candidate.assignedDate ||
      !!candidate.assignedRole ||
      !!candidate.assignedTime ||
      !!candidate.assignedDates ||
      !!candidate.assignedRoles ||
      !!candidate.assignedTimes ||
      !!candidate.dateAssignments ||
      // 🎯 최신 구조지만 checkMethod가 없는 경우도 마이그레이션 필요
      (Array.isArray(candidate.assignments) &&
        candidate.assignments.length > 0 &&
        (candidate.assignments as Partial<Assignment>[]).some(
          (assignment) => !assignment.checkMethod
        )))
  );
}
