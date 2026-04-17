/**
 * UNIQN Mobile - 정산 포맷팅 유틸리티
 *
 * 모든 포맷터는 canonical 배럴(`@/utils/formatters/*`)로 위임 — impeccable v2 §19.
 * 기존 호출부 시그니처는 유지하되 출력 포맷은 canonical 스펙에 맞춤:
 *   - formatCurrency: "1,234,567원" → "₩1,234,567"
 *   - formatTime: "HH:MM" 유지 (canonical formatTimeShort)
 *   - formatDate: "2026년 4월 17일" 유지 (canonical formatDateLong)
 *   - formatDuration: "4시간 30분" 유지 (canonical)
 *
 * 명시적 subpath 참조 — `@/utils/formatters` 는 동명 파일로 resolve 되므로
 * 폴더 배럴을 명시적으로 지정.
 */

import type { SalaryType } from '@/types/jobPosting';
import { SALARY_TYPE_LABELS } from './constants';

export { formatCurrency } from '@/utils/formatters/currency';
export { formatDuration } from '@/utils/formatters/duration';
export {
  formatTimeShort as formatTime,
  formatDateLong as formatDate,
} from '@/utils/formatters/date';

/**
 * 급여 타입 라벨 가져오기
 */
export function getSalaryTypeLabel(type: SalaryType): string {
  return SALARY_TYPE_LABELS[type] || '협의';
}
