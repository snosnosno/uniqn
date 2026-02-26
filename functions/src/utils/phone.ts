/**
 * UNIQN Functions - 전화번호 유틸리티
 *
 * @description 서버사이드 전화번호 관련 공통 함수
 * @version 1.0.0
 */

const COUNTRY_CODE = '+82';

/**
 * 전화번호 포맷팅 (010-1234-5678 형식)
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

/** 한국 전화번호 형식 검증 (E.164 또는 로컬 형식) */
export function isValidKoreanPhone(phone: string): boolean {
  const e164Regex = /^\+82[0-9]{9,10}$/;
  const localRegex = /^01[0-9]{8,9}$/;
  return e164Regex.test(phone) || localRegex.test(phone);
}

/** 전화번호 마스킹 (로그용) */
export function maskPhone(phone: string): string {
  if (phone.length < 4) return '***';
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
}
