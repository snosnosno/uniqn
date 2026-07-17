/**
 * 시간 정규화 모듈
 *
 * @description Phase 3 - 시간 필드 정규화
 * 모든 시간 관련 타입, 유틸리티를 중앙에서 export
 */

// 타입
export type { NormalizedWorkTime, TimeFieldsInput, TimeInput } from './types';

// 시간 정규화 유틸리티
export { TimeNormalizer } from './TimeNormalizer';

// 시간 표시 유틸리티 (구인자/직원 화면 통합)
export {
  WorkTimeDisplay,
  type WorkTimeSource,
  type WorkTimeDisplayResult,
} from './WorkTimeDisplay';

// 익일 근무시간 공용 프리뷰 헬퍼 (근무표·정산 입력 화면)
export { deriveOvernightPreview, type OvernightPreview } from './overnightPreview';
