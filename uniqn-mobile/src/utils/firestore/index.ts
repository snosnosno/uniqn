/**
 * UNIQN Mobile - Firestore 유틸리티 모듈
 *
 * @description Firestore 쿼리 빌더, 트랜잭션 헬퍼 등
 * @version 1.0.0
 *
 * @example
 * ```typescript
 * import { QueryBuilder, processPaginatedResults } from '@/utils/firestore';
 *
 * const q = new QueryBuilder(jobsRef)
 *   .whereEqual('status', 'active')
 *   .orderByDesc('createdAt')
 *   .paginate(20, lastDoc)
 *   .build();
 * ```
 */

// ============================================================================
// Query Builder
// ============================================================================

export {
  // Class
  QueryBuilder,
  // Helper Functions
  processPaginatedResults,
  processPaginatedResultsWithFilter,
  buildQuery,
  // Types
  type PaginatedResult,
  type DateRange,
  type QueryConstraint,
  type CollectionReference,
  type Query,
  type DocumentData,
  type QueryDocumentSnapshot,
  type WhereFilterOp,
  type OrderByDirection,
} from './queryBuilder';

// ============================================================================
// Transaction Helpers (Re-export from parent)
// ============================================================================

// Note: 트랜잭션 헬퍼는 기존 firestore.ts에서 사용
// 추후 이 폴더로 이동할 수 있음
