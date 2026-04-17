/**
 * 전화번호 포맷 — impeccable v2 §19
 *
 * 표준 한국 번호 표기는 "010-1234-5678". 구현은 `src/utils/phone.ts` 의
 * 기존 로직을 그대로 재사용해 단일 소스 원칙을 지킨다(중복 구현 금지).
 */

export {
  cleanPhoneNumber,
  formatE164ToDisplay,
  formatPhoneNumber,
  isE164,
  isValidKoreanPhone,
  toE164,
} from '../phone';
