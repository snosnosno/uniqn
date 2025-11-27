/**
 * JobPosting Props 통합 모듈 (SSOT)
 *
 * 이 파일은 모든 JobPosting 섹션의 Props 타입을 통합 관리합니다.
 * 개별 파일들과 하위 호환성을 유지하면서 중앙 집중식 import를 제공합니다.
 *
 * @version 1.0
 * @since 2025-02-04
 * @author T-HOLDEM Development Team
 *
 * @example
 * ```typescript
 * // 권장 방식: 통합 파일에서 import
 * import {
 *   BasicInfoSectionProps,
 *   SalarySectionProps,
 *   DateRequirementsSectionProps,
 *   PreQuestionsSectionProps,
 * } from '@/types/jobPosting/props';
 *
 * // 또는 개별 파일에서 import (하위 호환)
 * import { BasicInfoSectionProps } from '@/types/jobPosting/basicInfoProps';
 * ```
 */

// =============================================================================
// Section Props 기본 타입
// =============================================================================

export type { SectionProps, ValidationState, ValidationErrors, TouchedState } from './sectionProps';

// =============================================================================
// BasicInfo Section
// =============================================================================

export type {
  BasicInfoData,
  BasicInfoHandlers,
  BasicInfoErrors,
  BasicInfoValidation,
  BasicInfoSectionProps,
} from './basicInfoProps';

// =============================================================================
// Salary Section
// =============================================================================

export type {
  SalaryType,
  RoleSalary,
  TaxSettings,
  SalaryData,
  SalaryHandlers,
  SalaryErrors,
  SalaryValidation,
  SalarySectionProps,
} from './salaryProps';

// =============================================================================
// DateRequirements Section
// =============================================================================

export type {
  DateRequirementsData,
  DateRequirementsHandlers,
  DateRequirementErrors,
  DateRequirementsValidation,
  DateRequirementsSectionProps,
} from './dateRequirementsProps';

// =============================================================================
// PreQuestions Section
// =============================================================================

export type {
  PreQuestionsData,
  PreQuestionsHandlers,
  PreQuestionErrors,
  PreQuestionsValidation,
  PreQuestionsSectionProps,
} from './preQuestionsProps';

// =============================================================================
// 통합 타입 (편의용)
// =============================================================================

/**
 * 모든 섹션 Props 타입 유니온
 */
export type JobPostingSectionProps =
  | import('./basicInfoProps').BasicInfoSectionProps
  | import('./salaryProps').SalarySectionProps
  | import('./dateRequirementsProps').DateRequirementsSectionProps
  | import('./preQuestionsProps').PreQuestionsSectionProps;

/**
 * 섹션 이름 타입
 */
export type SectionName = 'basicInfo' | 'salary' | 'dateRequirements' | 'preQuestions';

/**
 * 섹션별 데이터 타입 맵
 */
export interface SectionDataMap {
  basicInfo: import('./basicInfoProps').BasicInfoData;
  salary: import('./salaryProps').SalaryData;
  dateRequirements: import('./dateRequirementsProps').DateRequirementsData;
  preQuestions: import('./preQuestionsProps').PreQuestionsData;
}

/**
 * 섹션별 핸들러 타입 맵
 */
export interface SectionHandlersMap {
  basicInfo: import('./basicInfoProps').BasicInfoHandlers;
  salary: import('./salaryProps').SalaryHandlers;
  dateRequirements: import('./dateRequirementsProps').DateRequirementsHandlers;
  preQuestions: import('./preQuestionsProps').PreQuestionsHandlers;
}
