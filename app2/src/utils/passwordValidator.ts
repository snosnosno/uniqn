export interface PasswordValidationResult {
  isValid: boolean;
  strength: 'weak' | 'medium' | 'strong';
  score: number; // 0-100
  checks: {
    length: boolean;
    hasEnglish: boolean;
    hasNumbers: boolean;
    validChars: boolean;
    hasSpecialChars?: boolean; // 특수문자 사용 여부
  };
  errors: string[];
}

export interface PasswordRequirements {
  minLength: number;
  requireEnglish: boolean;
  requireNumbers: boolean;
  allowedCharsOnly: boolean; // 영어+숫자만 허용 (권장사항으로 변경)
}

// 기본 비밀번호 요구사항 (계획에 따라 영어+숫자만)
export const DEFAULT_PASSWORD_REQUIREMENTS: PasswordRequirements = {
  minLength: 8,
  requireEnglish: true,
  requireNumbers: true,
  allowedCharsOnly: true
};

/**
 * 비밀번호 강도를 검증하는 메인 함수
 * @param password 검증할 비밀번호
 * @param requirements 비밀번호 요구사항
 * @returns PasswordValidationResult
 */
export const validatePassword = (
  password: string,
  requirements: PasswordRequirements = DEFAULT_PASSWORD_REQUIREMENTS
): PasswordValidationResult => {
  const checks = {
    length: password.length >= requirements.minLength,
    hasEnglish: requirements.requireEnglish ? /[a-zA-Z]/.test(password) : true,
    hasNumbers: requirements.requireNumbers ? /[0-9]/.test(password) : true,
    validChars: /^[a-zA-Z0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]+$/.test(password), // 특수문자 허용
    hasSpecialChars: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)
  };

  const errors: string[] = [];

  // 기본 요구사항 검사 (필수)
  if (!checks.length) {
    errors.push(`비밀번호는 최소 ${requirements.minLength}자 이상이어야 합니다.`);
  }
  if (!checks.hasEnglish) {
    errors.push('영문자를 포함해야 합니다.');
  }
  if (!checks.hasNumbers) {
    errors.push('숫자를 포함해야 합니다.');
  }
  if (!checks.validChars) {
    errors.push('허용되지 않는 문자가 포함되어 있습니다.');
  }

  // 전체 유효성 검사 (기본 요구사항만)
  const isValid = checks.length && checks.hasEnglish && checks.hasNumbers && checks.validChars;

  // 강도 계산
  const score = calculatePasswordScore(password, checks);
  const strength = getPasswordStrength(score);

  return {
    isValid,
    strength,
    score,
    checks,
    errors
  };
};

/**
 * 비밀번호 점수 계산 (0-100)
 */
const calculatePasswordScore = (password: string, checks: PasswordValidationResult['checks']): number => {
  let score = 0;

  // 기본 요구사항 충족 시 기본 점수 (총 75점)
  if (checks.length) score += 25;         // 길이 요구사항
  if (checks.hasEnglish) score += 25;     // 영문자 포함
  if (checks.hasNumbers) score += 25;     // 숫자 포함

  // 추가 보너스 점수 (총 25점)
  if (password.length >= 12) score += 10; // 긴 비밀번호 보너스
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 5; // 대소문자 조합
  if (checks.hasSpecialChars) score += 10; // 특수문자 보너스

  return Math.min(score, 100);
};

/**
 * 점수를 바탕으로 강도 결정
 */
const getPasswordStrength = (score: number): 'weak' | 'medium' | 'strong' => {
  if (score < 60) return 'weak';
  if (score < 85) return 'medium';
  return 'strong';
};

/**
 * 비밀번호 강도에 따른 색상 반환
 */
export const getPasswordStrengthColor = (strength: 'weak' | 'medium' | 'strong', isDark = false): string => {
  if (isDark) {
    const colorsDark = {
      weak: '#fca5a5',    // 빨간색 (다크)
      medium: '#fcd34d',  // 노란색 (다크)
      strong: '#6ee7b7'   // 초록색 (다크)
    };
    return colorsDark[strength];
  }

  const colors = {
    weak: '#dc3545',    // 빨간색
    medium: '#ffc107',  // 노란색
    strong: '#28a745'   // 초록색
  };
  return colors[strength];
};

/**
 * 비밀번호 강도 텍스트 반환
 */
export const getPasswordStrengthText = (strength: 'weak' | 'medium' | 'strong'): string => {
  const texts = {
    weak: '약함',
    medium: '보통',
    strong: '강함'
  };
  return texts[strength];
};

/**
 * 실시간 비밀번호 입력 검증 (타이핑 중)
 * 덜 엄격한 검증으로 사용자 경험 개선
 */
export const validatePasswordRealtime = (password: string): Partial<PasswordValidationResult> => {
  if (password.length === 0) {
    return {
      strength: 'weak',
      score: 0,
      checks: {
        length: false,
        hasEnglish: false,
        hasNumbers: false,
        validChars: true,
        hasSpecialChars: false
      }
    };
  }

  return validatePassword(password);
};