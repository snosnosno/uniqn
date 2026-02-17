/**
 * UNIQN Mobile - Firebase Application Repository
 *
 * @description Firebase Firestore 기반 Application Repository 구현 (Facade)
 * @version 2.0.0
 *
 * 구조:
 * - applicationQueries.ts: 읽기 연산 (getById, getByApplicantId 등)
 * - applicationTransactions.ts: 쓰기 트랜잭션 (applyWithTransaction 등)
 * - applicationEmployer.ts: 구인자 전용 (findByJobPostingWithStats 등)
 * - applicationHistoryTransactions.ts: v2.0 이력 트랜잭션
 */

import type { IApplicationRepository } from '../../interfaces';

import {
  getById,
  getByApplicantId,
  getByApplicantIdWithStatuses,
  getByJobPostingId,
  hasApplied,
  getStatsByApplicantId,
  getCancellationRequests,
} from './applicationQueries';

import {
  applyWithTransaction,
  cancelWithTransaction,
  requestCancellationWithTransaction,
  reviewCancellationWithTransaction,
  confirmWithTransaction,
  rejectWithTransaction,
  markAsRead,
} from './applicationTransactions';

import { findByJobPostingWithStats, subscribeByJobPosting } from './applicationEmployer';

import {
  confirmWithHistoryTransaction,
  cancelConfirmationTransaction,
} from './applicationHistoryTransactions';

// ============================================================================
// Facade Class
// ============================================================================

/**
 * Firebase Application Repository
 *
 * @description IApplicationRepository 인터페이스 구현체
 * 각 메서드는 서브모듈의 독립 함수에 위임
 */
export class FirebaseApplicationRepository implements IApplicationRepository {
  // Read
  getById = getById;
  getByApplicantId = getByApplicantId;
  getByApplicantIdWithStatuses = getByApplicantIdWithStatuses;
  getByJobPostingId = getByJobPostingId;
  hasApplied = hasApplied;
  getStatsByApplicantId = getStatsByApplicantId;
  getCancellationRequests = getCancellationRequests;

  // Write (v1 transactions)
  applyWithTransaction = applyWithTransaction;
  cancelWithTransaction = cancelWithTransaction;
  requestCancellationWithTransaction = requestCancellationWithTransaction;
  reviewCancellationWithTransaction = reviewCancellationWithTransaction;
  confirmWithTransaction = confirmWithTransaction;
  rejectWithTransaction = rejectWithTransaction;
  markAsRead = markAsRead;

  // Employer
  findByJobPostingWithStats = findByJobPostingWithStats;
  subscribeByJobPosting = subscribeByJobPosting;

  // v2.0 History Transactions
  confirmWithHistoryTransaction = confirmWithHistoryTransaction;
  cancelConfirmationTransaction = cancelConfirmationTransaction;
}
