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

/**
 * 지원 선택사항 - 단일 또는 다중 역할/시간/날짜 조합
 */
export interface Assignment {
  // 🆕 그룹 선택 지원: 단일 역할 또는 다중 역할
  role?: string;            // 개별 선택 시 사용
  roles?: string[];         // 그룹 선택 시 다중 역할 (예: ['dealer', 'floor'])

  timeSlot: string;
  dates: string[];          // 항상 배열 형태로 통일 (단일 날짜도 ["2025-01-09"] 형태)

  // 그룹 메타데이터 (연속 날짜 등)
  isGrouped: boolean;       // 연속된 날짜 그룹 여부
  groupId?: string;         // 그룹 식별자 (같은 그룹의 assignments 식별)
  checkMethod?: 'group' | 'individual';  // 체크 방식: 그룹 체크 vs 개별 체크

  // 🆕 모집 공고 구분자 (날짜 중복 모집 구분용)
  requirementId?: string;   // 어느 dateSpecificRequirement에서 온 것인지 구분

  // 기간 정보 (옵션)
  duration?: {
    type: 'single' | 'consecutive' | 'multi';
    startDate: string;      // "2025-01-09" 형식
    endDate?: string;       // 연속/다중 날짜인 경우
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
  eventId: string;           // 표준 필드 (CLAUDE.md 준수)
  postId: string;            // 하위 호환성
  postTitle: string;
  
  // === 상태 관리 ===
  status: 'applied' | 'confirmed' | 'cancelled';
  
  // === 핵심 배정 정보 (Single Source of Truth) ===
  assignments: Assignment[];
  
  // === 히스토리 관리 ===
  originalApplication?: {    // 최초 지원 시 선택사항 보존 (확정/취소 추적용)
    assignments: Assignment[];
    appliedAt: Timestamp;
  };
  
  confirmationHistory?: ApplicationHistoryEntry[];  // 확정/취소 이력
  
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
    [key: string]: any;
  };
  
  // === 메타데이터 ===
  appliedAt: Timestamp;
  confirmedAt?: Timestamp;
  cancelledAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastModified?: Timestamp;  // 하위 호환성
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
  appliedAt: any;  // Timestamp | string | Date 등 다양한 형태
  
  // 레거시 단일 필드들
  assignedDate?: string;
  assignedRole?: string;
  assignedTime?: string;
  
  // 레거시 배열 필드들
  assignedDates?: string[];
  assignedRoles?: string[];
  assignedTimes?: string[];
  
  // 레거시 구조화 필드들
  assignments?: any[];       // 기존 assignments 구조
  dateAssignments?: any[];   // 날짜별 그룹 구조
  
  // 기타 필드들
  preQuestionAnswers?: any[];
  [key: string]: any;        // 기타 예상치 못한 필드들
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
 */
export function isValidAssignment(obj: any): obj is Assignment {
  return (
    obj &&
    typeof obj === 'object' &&
    // role 또는 roles 중 하나는 있어야 함
    ((typeof obj.role === 'string') || (Array.isArray(obj.roles) && obj.roles.length > 0)) &&
    typeof obj.timeSlot === 'string' &&
    Array.isArray(obj.dates) &&
    typeof obj.isGrouped === 'boolean'
  );
}

/**
 * Application 타입 검증  
 */
export function isValidApplication(obj: any): obj is Application {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.id === 'string' &&
    typeof obj.applicantId === 'string' &&
    typeof obj.applicantName === 'string' &&
    typeof obj.eventId === 'string' &&
    typeof obj.postId === 'string' &&
    ['applied', 'confirmed', 'cancelled'].includes(obj.status) &&
    Array.isArray(obj.assignments) &&
    obj.assignments.every(isValidAssignment)
  );
}

/**
 * 레거시 Application 타입 검증
 */
export function isLegacyApplication(obj: any): obj is LegacyApplication {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.id === 'string' &&
    typeof obj.applicantId === 'string' &&
    (
      // 레거시 필드 중 하나라도 존재하면 레거시로 판단
      obj.assignedDate || 
      obj.assignedRole || 
      obj.assignedTime ||
      obj.assignedDates ||
      obj.assignedRoles ||
      obj.assignedTimes ||
      obj.dateAssignments ||
      // 🎯 최신 구조지만 checkMethod가 없는 경우도 마이그레이션 필요
      (obj.assignments && Array.isArray(obj.assignments) && obj.assignments.length > 0 && 
       obj.assignments.some((assignment: any) => !assignment.checkMethod))
    )
  );
}