/**
 * UNIQN Mobile - 전화번호 유틸리티
 *
 * @description 전화번호 포맷팅, 정규화, 검증 등 공통 함수 모음
 * @version 1.0.0
 */

const COUNTRY_CODE = '+82';

/**
 * 전화번호 포맷팅 (010-1234-5678 형식)
 *
 * 입력 중 실시간 포맷팅과 완성된 번호 표시 모두 지원.
 * 10자리(02 지역번호 등)와 11자리(010 등) 모두 처리.
 */
export function formatPhoneNumber(value: string): string {
  const cleaned = value.replace(/\D/g, '');
  if (cleaned.length <= 3) return cleaned;
  if (cleaned.length <= 7) return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
  if (cleaned.length <= 10)
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7, 11)}`;
}

/** 전화번호에서 숫자만 추출 */
export function cleanPhoneNumber(value: string): string {
  return value.replace(/\D/g, '');
}

/** 한국 전화번호를 E.164 형식으로 변환 (01012345678 → +821012345678) */
export function toE164(phone: string): string {
  const cleaned = phone.replace(/[-\s]/g, '');
  if (cleaned.startsWith('+82')) return cleaned;
  if (cleaned.startsWith('82') && cleaned.length >= 11) return `+${cleaned}`;
  if (cleaned.startsWith('0')) return `${COUNTRY_CODE}${cleaned.slice(1)}`;
  return `${COUNTRY_CODE}${cleaned}`;
}

/** E.164 형식인지 검증 */
export function isE164(phone: string): boolean {
  return /^\+82[0-9]{9,10}$/.test(phone);
}

/** 한국 전화번호 형식 검증 (E.164 또는 로컬 형식) */
export function isValidKoreanPhone(phone: string): boolean {
  const e164Regex = /^\+82[0-9]{9,10}$/;
  const localRegex = /^01[0-9]{8,9}$/;
  return e164Regex.test(phone) || localRegex.test(phone);
}

/**
 * 화면 표시 전용 포맷터.
 *
 * 저장 형태가 한 가지가 아니다 — 프로필은 E.164(`+8210…`), 공고 연락처는 사용자가 친
 * 로컬 문자열이 그대로 들어온다. 국가코드를 모른 채 3-4-4 로 자르면 `+821012345678` 이
 * `821-0980-0903` 처럼 보이고 마지막 자리는 잘려 나간다(실사고). 국가코드는 여기서
 * 한 번만 벗기고, 한국 번호가 아니면 손대지 않는다.
 */
export function formatPhoneForDisplay(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';

  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return trimmed;

  // '+' 유무와 무관하게 82 국가코드를 벗긴다. 뒤가 0 으로 시작하면(+82 0 10…) 중복 0 을 만들지 않는다.
  const isKoreanCountryCode = digits.startsWith('82') && digits.length >= 11;
  if (isKoreanCountryCode) {
    const rest = digits.slice(2);
    return formatPhoneNumber(rest.startsWith('0') ? rest : `0${rest}`);
  }

  // 해외 번호는 원문 유지 — 한국 규칙으로 하이픈을 넣으면 오히려 잘못된 번호로 읽힌다.
  if (trimmed.startsWith('+')) return trimmed;

  return formatPhoneNumber(trimmed);
}

/** E.164 → 로컬 표시 형식 변환 (+821012345678 → 010-1234-5678) */
export function formatE164ToDisplay(e164: string): string {
  return formatPhoneForDisplay(e164);
}
