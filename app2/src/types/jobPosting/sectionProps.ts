/**
 * Props Grouping 공통 타입 정의 (SSOT)
 *
 * 이 파일은 폼 섹션 컴포넌트 Props의 표준 구조를 정의합니다.
 * 모든 폼 섹션 컴포넌트는 SectionProps 패턴을 따라야 합니다.
 *
 * @version 2.0
 * @since 2025-01-01
 * @author T-HOLDEM Development Team
 *
 * Props 구조:
 * - data: 섹션의 데이터 (formData의 일부)
 * - handlers: 섹션의 이벤트 핸들러들
 * - validation: 검증 에러 및 touched 상태 (선택)
 *
 * @see app2/src/components/jobPosting/JobPostingForm/
 * @see types/jobPosting/basicInfoProps.ts - 사용 예시
 */

/**
 * Props Grouping 제네릭 인터페이스
 *
 * 모든 섹션 컴포넌트가 공통으로 사용하는 Props 구조
 *
 * @template TData - 섹션의 데이터 (formData의 일부)
 * @template THandlers - 섹션의 이벤트 핸들러들
 * @template TValidation - 섹션의 검증 에러 및 touched 상태 (선택)
 *
 * @example
 * ```ts
 * // BasicInfoSection Props 정의
 * interface BasicInfoSectionProps extends SectionProps<
 *   BasicInfoData,
 *   BasicInfoHandlers,
 *   BasicInfoValidation
 * > {}
 * ```
 */
export interface SectionProps<TData, THandlers, TValidation = undefined> {
  /**
   * 섹션 데이터
   * - formData의 해당 섹션 부분
   */
  data: TData;

  /**
   * 섹션 이벤트 핸들러
   * - onChange, onAdd, onRemove 등
   */
  handlers: THandlers;

  /**
   * 섹션 검증 상태 (선택)
   * - errors: 필드별 에러 메시지
   * - touched: 필드별 touched 상태
   */
  validation?: TValidation;
}

/**
 * 공통 검증 에러 타입
 *
 * 각 섹션의 validation.errors 타입 기반
 */
export interface ValidationErrors {
  [field: string]: string | undefined;
}

/**
 * 공통 Touched 상태 타입
 *
 * 각 섹션의 validation.touched 타입 기반
 */
export interface TouchedState {
  [field: string]: boolean;
}

/**
 * 공통 검증 상태 인터페이스
 *
 * validation prop의 기본 구조
 */
export interface ValidationState<TErrors = ValidationErrors> {
  /**
   * 필드별 에러 메시지
   */
  errors: TErrors;

  /**
   * 필드별 touched 상태
   */
  touched: TouchedState;
}
