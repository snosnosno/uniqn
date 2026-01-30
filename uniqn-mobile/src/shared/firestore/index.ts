/**
 * UNIQN Mobile - Firestore Shared 모듈
 *
 * @description Firestore 문서 조회/파싱 유틸리티
 * @version 1.0.0
 */

export {
  // Types
  type DocumentParser,
  type GetDocumentOptions,
  type DocumentResult,
  type VerifyOwnershipOptions,
  type QueryDocumentsOptions,
  // Core Functions
  getDocumentRequired,
  getDocumentOptional,
  getDocumentInTransaction,
  // Collection Helpers
  queryDocuments,
  // Ownership
  verifyOwnership,
  // Batch Helpers
  batchGetDocuments,
  // Utilities
  getDocRef,
} from './documentUtils';
