/**
 * SalarySection Props 타입
 *
 * @see app2/src/components/jobPosting/JobPostingForm/sections/SalarySection/
 */

import { SectionProps, ValidationState } from './sectionProps';
import { Benefits } from './base';

/**
 * 급여 타입
 */
export type SalaryType = 'hourly' | 'daily' | 'monthly' | 'negotiable' | 'other';

/**
 * 역할별 급여 정보
 */
export interface RoleSalary {
  salaryType: SalaryType;
  salaryAmount: string;
  customRoleName?: string;
}

/**
 * 세금 설정
 */
export interface TaxSettings {
  /** 세금 적용 여부 */
  enabled: boolean;

  /** 세율 (%) - 비율 기반 계산 */
  taxRate?: number;

  /** 고정 세금 - 고정 금액 계산 */
  taxAmount?: number;
}

/**
 * Salary 섹션 데이터
 */
export interface SalaryData {
  /** 급여 타입 */
  salaryType?: SalaryType;

  /** 급여 금액 */
  salaryAmount?: string;

  /** 복리후생 정보 */
  benefits?: Benefits;

  /** 역할별 급여 사용 여부 */
  useRoleSalary?: boolean;

  /** 역할별 급여 정보 */
  roleSalaries?: {
    [role: string]: RoleSalary;
  };

  /** 세금 설정 */
  taxSettings?: TaxSettings;
}

/**
 * Salary 섹션 이벤트 핸들러
 */
export interface SalaryHandlers {
  /**
   * 급여 타입 변경 핸들러
   * @param type - 급여 타입
   */
  onSalaryTypeChange: (type: SalaryType) => void;

  /**
   * 급여 금액 변경 핸들러
   * @param amount - 급여 금액
   */
  onSalaryAmountChange: (amount: number) => void;

  /**
   * 복리후생 토글 핸들러
   * @param benefitType - 복리후생 타입 (meal, transportation, accommodation)
   * @param enabled - 활성화 여부
   */
  onBenefitToggle: (benefitType: keyof Benefits, enabled: boolean) => void;

  /**
   * 복리후생 금액 변경 핸들러
   * @param benefitType - 복리후생 타입
   * @param amount - 금액
   */
  onBenefitChange: (benefitType: keyof Benefits, amount: number) => void;

  /**
   * 역할별 급여 사용 토글 핸들러
   * @param enabled - 활성화 여부
   */
  onRoleSalaryToggle: (enabled: boolean) => void;

  /**
   * 역할 추가 핸들러
   * @param role - 역할명
   */
  onAddRole: (role: string) => void;

  /**
   * 역할 삭제 핸들러
   * @param roleIndex - 역할 인덱스 (또는 역할명)
   */
  onRemoveRole: (roleIndex: number | string) => void;

  /**
   * 역할별 급여 변경 핸들러
   * @param roleIndex - 역할 인덱스 (또는 역할명)
   * @param type - 급여 타입 (string)
   * @param amount - 급여 금액
   */
  onRoleSalaryChange: (roleIndex: number | string, type: string, amount: number) => void;
}

/**
 * Salary 섹션 검증 에러
 */
export interface SalaryErrors {
  salaryType?: string;
  salaryAmount?: string;
  benefits?: string;
  roleSalaries?: string;
  taxSettings?: string;
  [key: string]: string | undefined;
}

/**
 * Salary 섹션 검증 상태
 */
export type SalaryValidation = ValidationState<SalaryErrors>;

/**
 * SalarySection Props
 */
export interface SalarySectionProps extends SectionProps<
  SalaryData,
  SalaryHandlers,
  SalaryValidation
> {}
