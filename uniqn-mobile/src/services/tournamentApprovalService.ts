/**
 * UNIQN Mobile - 대회공고 승인 서비스
 *
 * @description Firebase Functions 기반 대회공고 승인/거부/재제출 워크플로우
 * @version 1.0.0
 *
 * 기존 Firebase Functions 재사용:
 * - approveJobPosting: 관리자 승인
 * - rejectJobPosting: 관리자 거부
 * - resubmitJobPosting: 구인자 재제출
 */

import { httpsCallable } from 'firebase/functions';
import { collection, query, where, orderBy, getDocs, getDoc, doc } from 'firebase/firestore';
import { getFirebaseFunctions, getFirebaseDb } from '@/lib/firebase';
import { logger } from '@/utils/logger';
import {
  mapFirebaseError,
  BusinessError,
  AuthError,
  PermissionError,
  ValidationError,
  ERROR_CODES,
  toError,
} from '@/errors';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import type { JobPosting, TournamentApprovalStatus } from '@/types';
import type {
  ApproveTournamentData,
  RejectTournamentData,
  ResubmitTournamentData,
} from '@/schemas';

// ============================================================================
// Types
// ============================================================================

/**
 * Firebase Functions 응답 타입
 */
interface ApprovalResponse {
  success: boolean;
  postingId: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  reason?: string;
  resubmittedBy?: string;
  resubmittedAt?: string;
}

// Re-export for convenience (타입은 @/types에서 정의됨)
export type { TournamentApprovalStatus } from '@/types';

// ============================================================================
// Error Mapping
// ============================================================================

/**
 * Firebase Functions 에러를 비즈니스 에러로 매핑
 */
function mapFirebaseFunctionError(error: unknown): Error {
  const errorCode = (error as { code?: string }).code;
  const errorMessage = (error as { message?: string }).message;

  switch (errorCode) {
    case 'unauthenticated':
      return new AuthError(ERROR_CODES.AUTH_SESSION_EXPIRED, {
        userMessage: '로그인이 필요합니다',
      });
    case 'permission-denied':
      return new PermissionError(ERROR_CODES.FIREBASE_PERMISSION_DENIED, {
        userMessage: '권한이 없습니다',
      });
    case 'not-found':
      return new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
        userMessage: '공고를 찾을 수 없습니다',
      });
    case 'failed-precondition':
      return new BusinessError(ERROR_CODES.BUSINESS_INVALID_WORKLOG, {
        userMessage: errorMessage || '이미 처리된 공고입니다',
      });
    case 'invalid-argument':
      return new ValidationError(ERROR_CODES.VALIDATION_SCHEMA, {
        userMessage: errorMessage || '잘못된 요청입니다',
      });
    default:
      return mapFirebaseError(error);
  }
}

// ============================================================================
// Approval Actions
// ============================================================================

/**
 * 대회공고 승인 (관리자 전용)
 *
 * @description Firebase Function 'approveJobPosting' 호출
 * @throws BusinessError - 권한 없음, 공고 없음, 이미 처리됨
 */
export async function approveTournamentPosting(
  data: ApproveTournamentData
): Promise<ApprovalResponse> {
  try {
    logger.info('대회공고 승인 요청', { postingId: data.postingId });

    const functions = getFirebaseFunctions();
    const approveFunction = httpsCallable<ApproveTournamentData, ApprovalResponse>(
      functions,
      'approveJobPosting'
    );

    const result = await approveFunction(data);
    logger.info('대회공고 승인 완료', {
      postingId: data.postingId,
      approvedBy: result.data.approvedBy,
    });

    return result.data;
  } catch (error) {
    logger.error('대회공고 승인 실패', toError(error), {
      postingId: data.postingId,
    });
    throw mapFirebaseFunctionError(error);
  }
}

/**
 * 대회공고 거부 (관리자 전용)
 *
 * @description Firebase Function 'rejectJobPosting' 호출
 * @param data.postingId - 공고 ID
 * @param data.reason - 거부 사유 (최소 10자)
 * @throws BusinessError - 권한 없음, 공고 없음, 이미 처리됨, 사유 부족
 */
export async function rejectTournamentPosting(
  data: RejectTournamentData
): Promise<ApprovalResponse> {
  try {
    logger.info('대회공고 거부 요청', {
      postingId: data.postingId,
      reasonLength: data.reason.length,
    });

    const functions = getFirebaseFunctions();
    const rejectFunction = httpsCallable<RejectTournamentData, ApprovalResponse>(
      functions,
      'rejectJobPosting'
    );

    const result = await rejectFunction(data);
    logger.info('대회공고 거부 완료', {
      postingId: data.postingId,
      rejectedBy: result.data.rejectedBy,
    });

    return result.data;
  } catch (error) {
    logger.error('대회공고 거부 실패', toError(error), {
      postingId: data.postingId,
    });
    throw mapFirebaseFunctionError(error);
  }
}

/**
 * 대회공고 재제출 (구인자 전용)
 *
 * @description Firebase Function 'resubmitJobPosting' 호출
 * @param data.postingId - 거부된 공고 ID
 * @throws BusinessError - 권한 없음, 공고 없음, rejected 상태 아님
 */
export async function resubmitTournamentPosting(
  data: ResubmitTournamentData
): Promise<ApprovalResponse> {
  try {
    logger.info('대회공고 재제출 요청', { postingId: data.postingId });

    const functions = getFirebaseFunctions();
    const resubmitFunction = httpsCallable<ResubmitTournamentData, ApprovalResponse>(
      functions,
      'resubmitJobPosting'
    );

    const result = await resubmitFunction(data);
    logger.info('대회공고 재제출 완료', {
      postingId: data.postingId,
      resubmittedBy: result.data.resubmittedBy,
    });

    return result.data;
  } catch (error) {
    logger.error('대회공고 재제출 실패', toError(error), {
      postingId: data.postingId,
    });
    throw mapFirebaseFunctionError(error);
  }
}

// ============================================================================
// Query Functions
// ============================================================================

/**
 * 승인 대기 중인 대회공고 목록 조회 (관리자용)
 */
export async function getPendingTournamentPostings(): Promise<JobPosting[]> {
  try {
    logger.info('승인 대기 대회공고 목록 조회');

    const db = getFirebaseDb();
    const q = query(
      collection(db, 'jobPostings'),
      where('postingType', '==', 'tournament'),
      where('tournamentConfig.approvalStatus', '==', 'pending'),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    const postings = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    })) as JobPosting[];

    logger.info('승인 대기 대회공고 목록 조회 완료', { count: postings.length });
    return postings;
  } catch (error) {
    throw handleServiceError(error, {
      operation: '승인 대기 대회공고 목록 조회',
      component: 'tournamentApprovalService',
    });
  }
}

/**
 * 특정 상태의 대회공고 목록 조회
 */
export async function getTournamentPostingsByStatus(
  status: TournamentApprovalStatus
): Promise<JobPosting[]> {
  try {
    logger.info('대회공고 목록 조회', { status });

    const db = getFirebaseDb();
    const q = query(
      collection(db, 'jobPostings'),
      where('postingType', '==', 'tournament'),
      where('tournamentConfig.approvalStatus', '==', status),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    const postings = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    })) as JobPosting[];

    logger.info('대회공고 목록 조회 완료', { status, count: postings.length });
    return postings;
  } catch (error) {
    throw handleServiceError(error, {
      operation: '대회공고 목록 조회',
      component: 'tournamentApprovalService',
      context: { status },
    });
  }
}

/**
 * 내 대회공고 중 승인 대기/거부된 목록 조회 (구인자용)
 */
export async function getMyPendingTournamentPostings(ownerId: string): Promise<JobPosting[]> {
  try {
    logger.info('내 대회공고 목록 조회', { ownerId });

    const db = getFirebaseDb();
    // pending 또는 rejected 상태의 내 대회공고
    const pendingQuery = query(
      collection(db, 'jobPostings'),
      where('postingType', '==', 'tournament'),
      where('ownerId', '==', ownerId),
      where('tournamentConfig.approvalStatus', 'in', ['pending', 'rejected']),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(pendingQuery);
    const postings = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    })) as JobPosting[];

    logger.info('내 대회공고 목록 조회 완료', {
      ownerId,
      count: postings.length,
    });
    return postings;
  } catch (error) {
    throw handleServiceError(error, {
      operation: '내 대회공고 목록 조회',
      component: 'tournamentApprovalService',
      context: { ownerId },
    });
  }
}

/**
 * 대회공고 상세 조회
 */
export async function getTournamentPostingById(postingId: string): Promise<JobPosting | null> {
  try {
    logger.info('대회공고 상세 조회', { postingId });

    const db = getFirebaseDb();
    const docRef = doc(db, 'jobPostings', postingId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      logger.warn('대회공고를 찾을 수 없음', { postingId });
      return null;
    }

    const posting = {
      id: docSnap.id,
      ...docSnap.data(),
    } as JobPosting;

    // 대회공고가 아닌 경우 null 반환
    if (posting.postingType !== 'tournament') {
      logger.warn('대회공고가 아님', { postingId, postingType: posting.postingType });
      return null;
    }

    logger.info('대회공고 상세 조회 완료', { postingId });
    return posting;
  } catch (error) {
    throw handleServiceError(error, {
      operation: '대회공고 상세 조회',
      component: 'tournamentApprovalService',
      context: { postingId },
    });
  }
}

// ============================================================================
// Export
// ============================================================================

export const tournamentApprovalService = {
  // Actions
  approve: approveTournamentPosting,
  reject: rejectTournamentPosting,
  resubmit: resubmitTournamentPosting,
  // Queries
  getPending: getPendingTournamentPostings,
  getByStatus: getTournamentPostingsByStatus,
  getMyPending: getMyPendingTournamentPostings,
  getById: getTournamentPostingById,
};
