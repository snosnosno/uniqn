/**
 * 포맷터 canonical 배럴 — impeccable v2 §19
 *
 * 신규 코드는 이 위치에서만 import:
 *   import { formatCurrency, formatRelative } from '@/utils/formatters';
 *
 * 기존 도메인 유틸(`src/utils/settlement/formatters`, `src/utils/date/formatting`
 * 등)은 점진적 마이그레이션 대상이며, 본 모듈이 최종 단일 진입점.
 */

export { formatCurrency, formatCurrencyCompact, formatNumber } from './currency';

export {
  formatDateLong,
  formatISODate,
  formatRelative,
  formatShortDate,
  formatTimeOfDay,
  formatTimeShort,
} from './date';

export { formatDuration, formatDurationFromMinutes } from './duration';

export {
  cleanPhoneNumber,
  formatE164ToDisplay,
  formatPhoneNumber,
  isE164,
  isValidKoreanPhone,
  toE164,
} from '../phone';
