/**
 * UNIQN Mobile - Firebase WorkLog Repository
 *
 * @description Firebase Firestore 기반 WorkLog Repository 구현 (Facade)
 * @version 2.0.0
 *
 * 구조:
 * - workLogQueries.ts: 읽기 연산 (getById, getByStaffId 등)
 * - workLogSubscriptions.ts: 실시간 구독 (subscribeByDate 등)
 * - workLogMutations.ts: 쓰기/트랜잭션 (updatePayrollStatus 등)
 */

import type { IWorkLogRepository } from '../../interfaces';

import {
  getById,
  getByStaffId,
  getByStaffIdWithFilters,
  getByDate,
  getByJobPostingId,
  getTodayCheckedIn,
  getStats,
  getMonthlyPayroll,
  getByDateRange,
  findByJobPostingStaffDate,
} from './workLogQueries';

import {
  subscribeByDate,
  subscribeByStaffId,
  subscribeById,
  subscribeByStaffIdWithFilters,
  subscribeTodayActive,
} from './workLogSubscriptions';

import {
  updatePayrollStatus,
  updateWorkTimeTransaction,
  updatePayrollStatusTransaction,
  processQRCheckInOutTransaction,
} from './workLogMutations';

// ============================================================================
// Facade Class
// ============================================================================

/**
 * Firebase WorkLog Repository
 *
 * @description IWorkLogRepository 인터페이스 구현체
 * 각 메서드는 서브모듈의 독립 함수에 위임
 */
export class FirebaseWorkLogRepository implements IWorkLogRepository {
  // Read
  getById = getById;
  getByStaffId = getByStaffId;
  getByStaffIdWithFilters = getByStaffIdWithFilters;
  getByDate = getByDate;
  getByJobPostingId = getByJobPostingId;
  getTodayCheckedIn = getTodayCheckedIn;
  getStats = getStats;
  getMonthlyPayroll = getMonthlyPayroll;
  getByDateRange = getByDateRange;
  findByJobPostingStaffDate = findByJobPostingStaffDate;

  // Realtime
  subscribeByDate = subscribeByDate;
  subscribeByStaffId = subscribeByStaffId;
  subscribeById = subscribeById;
  subscribeByStaffIdWithFilters = subscribeByStaffIdWithFilters;
  subscribeTodayActive = subscribeTodayActive;

  // Write
  updatePayrollStatus = updatePayrollStatus;
  updateWorkTimeTransaction = updateWorkTimeTransaction;
  updatePayrollStatusTransaction = updatePayrollStatusTransaction;
  processQRCheckInOutTransaction = processQRCheckInOutTransaction;
}
