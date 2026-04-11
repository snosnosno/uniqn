/**
 * 데이터베이스 제한 상수
 *
 * @description 데이터베이스 쿼리/배치의 하드 제한값들을 중앙 관리
 */

export const DATABASE_LIMITS = {
  /**
   * IN 쿼리의 최대 배열 크기
   */
  WHERE_IN_MAX_ITEMS: 30,

  /**
   * 배치 쓰기 / 트랜잭션의 최대 작업 수
   */
  BATCH_MAX_OPERATIONS: 500,
} as const;

export type DatabaseLimits = typeof DATABASE_LIMITS;
