/**
 * 포맷터 canonical 배럴 — 단일 진입점.
 *
 *   import { formatCurrency, formatSalary, formatRelative } from '@/utils/formatters';
 *
 * 과거 동명 flat 파일(`src/utils/formatters.ts`)이 이 디렉토리를 가려
 * bare `@/utils/formatters` import가 파일 판으로 resolve 되던 그림자를
 * 통합·해소했다(파일 판 함수 전부 `./display` 로 흡수 후 flat 파일 삭제).
 * 소비처가 받는 심볼·출력 문자열은 모두 보존(런타임 검증).
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

export {
  maskEmail,
  formatRole,
  formatRoles,
  formatSalaryType,
  formatSalary,
  formatJobStatus,
  formatPositions,
  formatPercent,
  formatFileSize,
  truncate,
  capitalize,
  padNumber,
  formatBirthDate,
  formatGenderLabel,
} from './display';
