/**
 * UNIQN Mobile - Firebase JobPosting Repository
 *
 * @description Firebase Firestore 기반 JobPosting Repository 구현 (Facade)
 * @version 2.0.0
 *
 * 구조:
 * - jobPostingQueries.ts: 읽기 연산 (getById, getList 등)
 * - jobPostingTransactions.ts: 쓰기/트랜잭션 연산 (create, update, delete 등)
 * - jobPostingUtilities.ts: 유틸리티 + 대회공고 쿼리
 */

import type { IJobPostingRepository } from '../../interfaces';

import { getById, getByIdBatch, getList, getByOwnerId, getTypeCounts } from './jobPostingQueries';

import {
  incrementViewCount,
  updateStatus,
  createWithTransaction,
  updateWithTransaction,
  deleteWithTransaction,
  closeWithTransaction,
  reopenWithTransaction,
  getStatsByOwnerId,
  bulkUpdateStatus,
} from './jobPostingTransactions';

import {
  verifyOwnership,
  getByPostingTypeAndApprovalStatus,
  getByOwnerAndPostingType,
} from './jobPostingUtilities';

// ============================================================================
// Facade Class
// ============================================================================

/**
 * Firebase JobPosting Repository
 *
 * @description IJobPostingRepository 인터페이스 구현체
 * 각 메서드는 서브모듈의 독립 함수에 위임
 */
export class FirebaseJobPostingRepository implements IJobPostingRepository {
  // Read
  getById = getById;
  getByIdBatch = getByIdBatch;
  getList = getList;
  getByOwnerId = getByOwnerId;
  getTypeCounts = getTypeCounts;

  // Write (simple)
  incrementViewCount = incrementViewCount;
  updateStatus = updateStatus;

  // Write (transaction)
  createWithTransaction = createWithTransaction;
  updateWithTransaction = updateWithTransaction;
  deleteWithTransaction = deleteWithTransaction;
  closeWithTransaction = closeWithTransaction;
  reopenWithTransaction = reopenWithTransaction;
  getStatsByOwnerId = getStatsByOwnerId;
  bulkUpdateStatus = bulkUpdateStatus;

  // Utility
  verifyOwnership = verifyOwnership;

  // Tournament
  getByPostingTypeAndApprovalStatus = getByPostingTypeAndApprovalStatus;
  getByOwnerAndPostingType = getByOwnerAndPostingType;
}
