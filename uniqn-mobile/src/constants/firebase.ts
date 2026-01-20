/**
 * Firebase 제한 상수
 *
 * @description Firestore SDK의 하드 제한값들을 중앙 관리
 * @see https://firebase.google.com/docs/firestore/quotas
 */

export const FIREBASE_LIMITS = {
  /**
   * Firestore `where('field', 'in', array)` 쿼리의 최대 배열 크기
   * @see https://firebase.google.com/docs/firestore/query-data/queries#in_not-in_and_array-contains-any
   */
  WHERE_IN_MAX_ITEMS: 30,

  /**
   * Firestore 배치 쓰기 / 트랜잭션의 최대 작업 수
   * @see https://firebase.google.com/docs/firestore/manage-data/transactions#batched-writes
   */
  BATCH_MAX_OPERATIONS: 500,
} as const;

export type FirebaseLimits = typeof FIREBASE_LIMITS;
