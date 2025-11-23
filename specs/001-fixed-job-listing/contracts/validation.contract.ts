/**
 * Contract: validateFixedJobPosting Function
 *
 * FixedJobPosting 데이터의 무결성을 검증하는 유틸리티 함수입니다.
 * requiredRoles와 requiredRolesWithCount의 동기화 상태를 확인하고,
 * 필수 필드 존재 여부를 검증합니다.
 *
 * @module contracts/validation
 * @see ../data-model.md - 검증 규칙 참조
 */

import { FixedJobPosting } from '../../../app2/src/types/jobPosting/jobPosting';

/**
 * FixedJobPosting 검증 함수
 *
 * @param {FixedJobPosting} posting - 검증할 고정공고 데이터
 * @returns {boolean} 검증 통과 시 true, 실패 시 false
 *
 * @example
 * ```typescript
 * const posting: FixedJobPosting = { /* ... *\/ };
 *
 * if (!validateFixedJobPosting(posting)) {
 *   logger.error('Invalid FixedJobPosting', { postingId: posting.id });
 *   return; // 처리 중단
 * }
 *
 * // 검증 통과 후 처리
 * renderCard(posting);
 * ```
 */
export function validateFixedJobPosting(posting: FixedJobPosting): boolean;

/**
 * 검증 항목
 *
 * 1. fixedConfig 필드 존재 여부
 *    - posting.fixedConfig !== undefined
 *
 * 2. fixedData 필드 존재 여부
 *    - posting.fixedData !== undefined
 *
 * 3. requiredRoles와 requiredRolesWithCount 동기화 상태
 *    - posting.requiredRoles.length === posting.fixedData.requiredRolesWithCount.length
 *    - 모든 requiredRolesWithCount[i].name이 requiredRoles에 포함되어 있음
 *
 * 4. workSchedule.daysPerWeek 범위
 *    - 1 <= daysPerWeek <= 7
 *
 * 5. requiredRolesWithCount 배열 비어있지 않음
 *    - posting.fixedData.requiredRolesWithCount.length > 0
 *
 * 6. viewCount >= 0
 *    - posting.fixedData.viewCount >= 0
 */
export const VALIDATION_RULES = {
  fixedConfigExists: true,
  fixedDataExists: true,
  rolesSync: true,
  daysPerWeekRange: [1, 7],
  requiredRolesNotEmpty: true,
  viewCountNonNegative: true,
} as const;

/**
 * 검증 실패 시 동작
 *
 * 1. logger.warn으로 경고 로깅
 *    - 메시지: "FixedJobPosting validation failed"
 *    - 컨텍스트: { postingId, reason }
 *
 * 2. false 반환
 *
 * @example
 * ```typescript
 * // 불일치 발견 시
 * logger.warn('FixedJobPosting validation failed', {
 *   postingId: posting.id,
 *   reason: 'requiredRoles 불일치',
 *   requiredRoles: posting.requiredRoles,
 *   requiredRolesWithCount: posting.fixedData.requiredRolesWithCount
 * });
 * return false;
 * ```
 */
export interface ValidationFailureLog {
  message: 'FixedJobPosting validation failed';
  context: {
    postingId: string;
    reason: string;
    [key: string]: unknown;
  };
}

/**
 * 구현 요구사항
 *
 * 1. logger 사용:
 *    - import logger from '@/utils/logger';
 *    - 검증 실패 시 logger.warn 호출
 *
 * 2. 동기화 검증 로직:
 *    ```typescript
 *    const rolesFromCount = posting.fixedData.requiredRolesWithCount.map(r => r.name);
 *    const rolesMatch = posting.requiredRoles?.every(role => rolesFromCount.includes(role)) &&
 *                       rolesFromCount.length === posting.requiredRoles?.length;
 *    ```
 *
 * 3. 타입 안전성:
 *    - TypeScript strict mode 준수
 *    - Optional chaining 사용 (posting.requiredRoles?.length)
 *
 * 4. 성능:
 *    - 빠른 실패 (첫 번째 검증 실패 시 즉시 false 반환)
 *    - 배열 순회 최소화
 *
 * @see ../data-model.md#검증-규칙
 */
