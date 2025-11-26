/**
 * 이메일 검증 유틸리티
 *
 * @description
 * RFC 5322 표준 기반 이메일 주소 검증 유틸리티입니다.
 * 회원가입, 프로필 수정 등에서 이메일 입력 검증에 사용됩니다.
 *
 * @version 1.0.0
 * @since 2025-11-22
 * @feature Phase 3-4 검증 유틸리티 통합
 * @author T-HOLDEM Development Team
 *
 * 주요 특징:
 * - RFC 5322 표준 준수
 * - 실시간 검증 지원 (타이핑 중)
 * - 한국 이메일 제공자 지원
 * - TypeScript strict mode 100% 준수
 */

/**
 * 이메일 검증 결과
 */
export interface EmailValidationResult {
  /** 검증 성공 여부 */
  isValid: boolean;
  /** 정규화된 이메일 (소문자, trim) */
  formatted: string;
  /** 에러 메시지 배열 */
  errors: string[];
}

/**
 * RFC 5322 표준 기반 이메일 검증
 *
 * @description
 * 엄격한 이메일 형식 검증을 수행합니다.
 * 회원가입 최종 제출 시 사용하세요.
 *
 * @param email - 검증할 이메일 주소
 * @returns EmailValidationResult
 *
 * @example
 * ```typescript
 * const result = validateEmail('user@example.com');
 * if (result.isValid) {
 *   // 유효한 이메일
 *   console.log(result.formatted); // 'user@example.com'
 * } else {
 *   // 무효한 이메일
 *   console.log(result.errors); // ['올바른 이메일 형식이 아닙니다.']
 * }
 * ```
 */
export function validateEmail(email: string): EmailValidationResult {
  const errors: string[] = [];
  const trimmedEmail = email.trim().toLowerCase();

  // 1. 필수 입력 검증
  if (trimmedEmail.length === 0) {
    errors.push('이메일을 입력해주세요.');
    return { isValid: false, formatted: '', errors };
  }

  // 2. 길이 검증 (RFC 5321: 최대 254자)
  if (trimmedEmail.length > 254) {
    errors.push('이메일은 최대 254자까지 입력 가능합니다.');
  }

  // 3. @ 개수 검증 (정확히 1개여야 함)
  const atCount = (trimmedEmail.match(/@/g) || []).length;
  if (atCount !== 1) {
    errors.push('올바른 이메일 형식이 아닙니다.');
    return { isValid: false, formatted: trimmedEmail, errors };
  }

  // 4. 로컬 파트와 도메인 분리
  const parts = trimmedEmail.split('@');
  if (parts.length !== 2) {
    errors.push('올바른 이메일 형식이 아닙니다.');
    return { isValid: false, formatted: trimmedEmail, errors };
  }

  const localPart = parts[0];
  const domain = parts[1];

  // TypeScript strict mode: parts.length === 2를 확인했으므로 안전함
  if (!localPart || !domain) {
    errors.push('올바른 이메일 형식이 아닙니다.');
    return { isValid: false, formatted: trimmedEmail, errors };
  }

  // 5. 로컬 파트 검증
  if (localPart.length === 0) {
    errors.push('올바른 이메일 형식이 아닙니다.');
    return { isValid: false, formatted: trimmedEmail, errors };
  }

  if (localPart.length > 64) {
    errors.push('이메일 사용자명은 최대 64자까지 입력 가능합니다.');
  }

  // 연속된 점 검증
  if (localPart.includes('..')) {
    errors.push('유효하지 않은 이메일 형식입니다.');
  }

  // 6. 도메인 검증
  if (domain.length === 0) {
    errors.push('올바른 이메일 형식이 아닙니다.');
    return { isValid: false, formatted: trimmedEmail, errors };
  }

  if (!domain.includes('.')) {
    errors.push('유효한 도메인을 입력해주세요.');
    return { isValid: false, formatted: trimmedEmail, errors };
  }

  if (domain.length < 2) {
    errors.push('유효한 도메인을 입력해주세요.');
  }

  // 7. RFC 5322 표준 검증 (엄격 모드)
  const strictRegex =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  if (!strictRegex.test(trimmedEmail)) {
    errors.push('유효하지 않은 이메일 형식입니다.');
  }

  return {
    isValid: errors.length === 0,
    formatted: trimmedEmail,
    errors,
  };
}

/**
 * 실시간 이메일 입력 검증 (타이핑 중)
 *
 * @description
 * 사용자가 이메일을 입력하는 동안 실시간으로 간단한 검증을 수행합니다.
 * 최종 제출 시에는 `validateEmail`을 사용하세요.
 *
 * @param email - 입력 중인 이메일
 * @returns 부분 검증 결과
 *
 * @example
 * ```typescript
 * const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
 *   const value = e.target.value;
 *   const validation = validateEmailRealtime(value);
 *   if (!validation.isValid && value.length > 0) {
 *     setError(validation.errors[0]);
 *   }
 * };
 * ```
 */
export function validateEmailRealtime(email: string): Partial<EmailValidationResult> {
  const trimmedEmail = email.trim().toLowerCase();

  if (trimmedEmail.length === 0) {
    return {
      isValid: false,
      formatted: '',
      errors: [],
    };
  }

  // @ 기호 존재 여부
  if (!trimmedEmail.includes('@')) {
    return {
      isValid: false,
      formatted: trimmedEmail,
      errors: ['@를 포함해야 합니다.'],
    };
  }

  // 기본 형식만 검증 (타이핑 중에는 관대하게)
  const basicRegex = /^[^\s@]+@[^\s@]+$/;
  const hasBasicFormat = basicRegex.test(trimmedEmail);

  if (!hasBasicFormat) {
    return {
      isValid: false,
      formatted: trimmedEmail,
      errors: ['이메일 형식을 확인해주세요.'],
    };
  }

  // 도메인에 점이 있는지 확인 (완성된 이메일의 필수 조건)
  const parts = trimmedEmail.split('@');
  const domain = parts.length === 2 && parts[1] ? parts[1] : '';

  // 도메인에 점이 있고, 점으로 시작하거나 끝나지 않아야 함
  const hasDot =
    domain.length > 0 && domain.includes('.') && !domain.startsWith('.') && !domain.endsWith('.');

  return {
    isValid: hasDot,
    formatted: trimmedEmail,
    errors: hasDot ? [] : ['이메일 형식을 확인해주세요.'],
  };
}

/**
 * 이메일 도메인 추출
 *
 * @description
 * 이메일 주소에서 도메인 부분만 추출합니다.
 *
 * @param email - 이메일 주소
 * @returns 도메인 문자열 (예: 'gmail.com')
 *
 * @example
 * ```typescript
 * extractEmailDomain('user@gmail.com'); // 'gmail.com'
 * extractEmailDomain('invalid-email'); // ''
 * ```
 */
export function extractEmailDomain(email: string): string {
  const trimmed = email.trim();

  // @ 개수 확인 (정확히 1개여야 함)
  const atCount = (trimmed.match(/@/g) || []).length;
  if (atCount !== 1) {
    return '';
  }

  const parts = trimmed.split('@');
  if (
    parts.length !== 2 ||
    !parts[0] ||
    !parts[1] ||
    parts[0].length === 0 ||
    parts[1].length === 0
  ) {
    return '';
  }

  return parts[1];
}

/**
 * 일반적인 이메일 제공자 도메인 목록
 *
 * @description
 * 한국에서 자주 사용되는 이메일 제공자 목록입니다.
 */
export const COMMON_EMAIL_DOMAINS = [
  'gmail.com',
  'naver.com',
  'daum.net',
  'kakao.com',
  'outlook.com',
  'hotmail.com',
  'yahoo.com',
  'icloud.com',
  'hanmail.net',
  'nate.com',
] as const;

/**
 * 일반적인 이메일 제공자인지 확인
 *
 * @description
 * 주어진 이메일이 일반적인 이메일 제공자를 사용하는지 확인합니다.
 * 기업 이메일 등을 구분하는 데 유용합니다.
 *
 * @param email - 이메일 주소
 * @returns 일반 제공자 여부
 *
 * @example
 * ```typescript
 * isCommonEmailDomain('user@gmail.com'); // true
 * isCommonEmailDomain('user@company.co.kr'); // false
 * ```
 */
export function isCommonEmailDomain(email: string): boolean {
  const domain = extractEmailDomain(email);
  return COMMON_EMAIL_DOMAINS.includes(
    domain.toLowerCase() as (typeof COMMON_EMAIL_DOMAINS)[number]
  );
}
