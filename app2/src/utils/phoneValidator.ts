export interface PhoneValidationResult {
  isValid: boolean;
  formatted: string;
  errors: string[];
}

/**
 * 한국 전화번호 유효성 검증
 * @param phone 검증할 전화번호 (포맷팅된 형태 또는 숫자만)
 * @returns PhoneValidationResult
 */
export const validatePhone = (phone: string): PhoneValidationResult => {
  const errors: string[] = [];

  // 숫자만 추출
  const numbers = phone.replace(/\D/g, '');

  // 길이 검증 (11자리)
  if (numbers.length === 0) {
    errors.push('전화번호를 입력해주세요.');
    return { isValid: false, formatted: '', errors };
  }

  if (numbers.length !== 11) {
    errors.push('전화번호는 11자리여야 합니다.');
  }

  // 010으로 시작하는지 검증
  if (!numbers.startsWith('010')) {
    errors.push('010으로 시작하는 휴대폰 번호를 입력해주세요.');
  }

  // 포맷팅
  const formatted =
    numbers.length >= 11
      ? `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`
      : phone;

  return {
    isValid: errors.length === 0,
    formatted,
    errors,
  };
};

/**
 * 전화번호 포맷팅 함수
 * @param value 입력된 전화번호
 * @returns 포맷팅된 전화번호 (010-1234-5678)
 */
export const formatPhoneNumber = (value: string): string => {
  // 숫자만 추출
  const numbers = value.replace(/\D/g, '');

  // 길이에 따라 포맷 적용
  if (numbers.length <= 3) {
    return numbers;
  } else if (numbers.length <= 7) {
    return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
  } else {
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
  }
};

/**
 * 실시간 전화번호 입력 검증 (타이핑 중)
 * @param phone 입력 중인 전화번호
 * @returns 부분 검증 결과
 */
export const validatePhoneRealtime = (phone: string): Partial<PhoneValidationResult> => {
  const numbers = phone.replace(/\D/g, '');

  if (numbers.length === 0) {
    return {
      isValid: false,
      formatted: '',
      errors: [],
    };
  }

  // 010으로 시작하지 않으면 경고
  if (numbers.length >= 3 && !numbers.startsWith('010')) {
    return {
      isValid: false,
      formatted: formatPhoneNumber(phone),
      errors: ['010으로 시작해야 합니다.'],
    };
  }

  return {
    isValid: numbers.length === 11 && numbers.startsWith('010'),
    formatted: formatPhoneNumber(phone),
    errors: [],
  };
};
