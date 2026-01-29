/**
 * UNIQN Mobile - SalarySection 타입 정의
 *
 * @description SalarySection 컴포넌트에서 사용하는 타입
 */

import type { JobPostingFormData, SalaryType, FormRoleWithCount } from '@/types';

/**
 * SalarySection Props
 */
export interface SalarySectionProps {
  data: JobPostingFormData;
  onUpdate: (data: Partial<JobPostingFormData>) => void;
  errors?: Record<string, string>;
}

/**
 * 역할 급여 입력 Props
 */
export interface RoleSalaryInputProps {
  /** 역할 정보 */
  role: FormRoleWithCount;
  /** 역할 인덱스 */
  index: number;
  /** 읽기 전용 여부 (전체 동일 모드에서 첫 번째 이후) */
  isReadOnly: boolean;
  /** 급여 타입 변경 핸들러 */
  onSalaryTypeChange: (index: number, type: SalaryType) => void;
  /** 급여 금액 변경 핸들러 */
  onSalaryAmountChange: (index: number, value: string) => void;
}

/**
 * 수당 입력 Props
 */
export interface AllowanceInputProps {
  /** 현재 수당 데이터 */
  allowances?: JobPostingFormData['allowances'];
  /** 보장시간 변경 핸들러 */
  onGuaranteedHoursChange: (value: string) => void;
  /** 수당 금액 변경 핸들러 */
  onAllowanceChange: (key: string, value: string) => void;
  /** 수당 제공 토글 핸들러 */
  onAllowanceProvidedToggle: (key: string, isProvided: boolean) => void;
}

/**
 * 예상 비용 카드 Props
 */
export interface EstimatedCostCardProps {
  /** 예상 총 비용 */
  estimatedCost: number;
  /** 총 인원수 */
  totalCount: number;
}
