/**
 * Firestore Hook 라이브러리 통합 Export
 *
 * @description
 * Firestore Hook 라이브러리의 모든 Hook과 타입을 export합니다.
 * 이 파일을 통해 깔끔한 import 경로를 제공합니다.
 *
 * @version 1.0.0
 * @since 2025-11-22
 * @feature Phase 3-3 Firestore Hook 라이브러리
 * @author T-HOLDEM Development Team
 *
 * @example
 * ```typescript
 * // 개별 import
 * import { useFirestoreCollection } from '@/hooks/firestore';
 *
 * // 여러 Hook import
 * import {
 *   useFirestoreCollection,
 *   useFirestoreDocument,
 *   useFirestoreMutation
 * } from '@/hooks/firestore';
 *
 * // 타입 import
 * import type {
 *   FirestoreDocument,
 *   FirestoreCollectionResult
 * } from '@/hooks/firestore';
 * ```
 */

// =============================================================================
// Hooks Export
// =============================================================================

/**
 * 컬렉션 실시간 구독 Hook
 * @see useFirestoreCollection.ts
 */
export { useFirestoreCollection } from './useFirestoreCollection';

/**
 * 단일 문서 실시간 구독 Hook
 * @see useFirestoreDocument.ts
 */
export { useFirestoreDocument } from './useFirestoreDocument';

/**
 * 복잡한 쿼리 실시간 구독 Hook
 * @see useFirestoreQuery.ts
 */
export { useFirestoreQuery } from './useFirestoreQuery';

/**
 * Firestore CRUD 작업 Hook
 * @see useFirestoreMutation.ts
 */
export { useFirestoreMutation } from './useFirestoreMutation';

// =============================================================================
// Types Export
// =============================================================================

/**
 * 공통 타입 및 인터페이스
 * @see types.ts
 */
export type {
  // 기본 상태 타입
  FirestoreHookState,

  // Hook 결과 타입
  FirestoreCollectionResult,
  FirestoreDocumentResult,
  FirestoreQueryResult,
  FirestoreMutationResult,

  // 문서 타입
  FirestoreDocument,

  // Hook 옵션 타입
  CollectionHookOptions,
  DocumentHookOptions,
  QueryHookOptions,
  MutationHookOptions,
} from './types';

// =============================================================================
// Utility Functions Export
// =============================================================================

/**
 * 유틸리티 함수
 * @see types.ts
 */
export { convertDocument } from './types';
