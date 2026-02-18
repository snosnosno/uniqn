/**
 * UNIQN Mobile - 공고 템플릿 타입
 *
 * @description 공고 작성 시 재사용 가능한 템플릿 타입 정의
 * @version 1.0.0
 */

import type { Timestamp } from 'firebase/firestore';
import type { JobPostingFormData } from './jobPostingForm';
import { removeUndefined } from '@/utils/firestore/removeUndefined';

// ============================================================================
// 템플릿 저장 제외 필드
// ============================================================================

/**
 * 템플릿에서 제외되는 필드 목록
 *
 * @description 매번 달라지는 날짜/일정 관련 필드는 템플릿에서 제외
 */
export type TemplateExcludedFields =
  | 'workDate' // 근무 날짜
  | 'dateSpecificRequirements'; // 날짜별 요구사항

/**
 * 템플릿에 저장되는 폼 데이터 타입
 */
export type TemplateFormData = Omit<Partial<JobPostingFormData>, TemplateExcludedFields>;

// ============================================================================
// 템플릿 타입 정의
// ============================================================================

/**
 * 공고 템플릿 인터페이스
 *
 * @description Firestore `mobileJobPostingTemplates` 컬렉션에 저장되는 문서 구조
 */
export interface JobPostingTemplate {
  /** 템플릿 고유 ID (Firestore 문서 ID) */
  id: string;

  /** 템플릿 이름 (필수, 사용자 입력) */
  name: string;

  /** 템플릿 설명 (선택, 사용자 입력) */
  description?: string;

  /** 생성자 userId (권한 관리용) */
  createdBy: string;

  /** 생성 시간 */
  createdAt: Timestamp;

  /** 템플릿 데이터 (날짜/일정 관련 필드 제외) */
  templateData: TemplateFormData;

  /** 사용 횟수 (통계용) */
  usageCount?: number;

  /** 마지막 사용 시간 (통계용) */
  lastUsedAt?: Timestamp;
}

/**
 * 템플릿 생성 입력 타입
 */
export interface CreateTemplateInput {
  /** 템플릿 이름 */
  name: string;

  /** 템플릿 설명 (선택) */
  description?: string;

  /** 저장할 폼 데이터 */
  formData: JobPostingFormData;
}

/**
 * 템플릿 목록 조회 결과
 */
export interface TemplateListResult {
  /** 템플릿 목록 */
  templates: JobPostingTemplate[];

  /** 총 개수 */
  total: number;
}

// ============================================================================
// 유틸리티 함수
// ============================================================================

/**
 * 폼 데이터에서 템플릿 저장용 데이터 추출
 *
 * @description 날짜/일정 관련 필드를 제외한 데이터 반환
 */
export function extractTemplateData(formData: JobPostingFormData): TemplateFormData {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { workDate, dateSpecificRequirements, ...templateData } = formData;

  // Firebase는 undefined 값을 허용하지 않으므로 제거
  return removeUndefined(templateData as Record<string, unknown>) as TemplateFormData;
}

/**
 * 템플릿 데이터를 폼 데이터로 변환
 *
 * @description 템플릿 데이터 + 기본 날짜/일정 값으로 폼 데이터 생성
 */
export function templateToFormData(template: JobPostingTemplate): Partial<JobPostingFormData> {
  return {
    ...template.templateData,
    // 날짜/일정 관련 필드는 기본값으로 설정
    workDate: '',
    dateSpecificRequirements: [],
  };
}
