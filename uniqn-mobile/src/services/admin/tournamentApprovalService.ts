/**
 * UNIQN Mobile - 대회공고 승인 서비스
 *
 * @description Supabase Edge Functions 기반 대회공고 승인/거부/재제출 워크플로우
 * @version 2.0.0
 *
 * Repository 패턴 적용:
 * - Query Functions의 직접 호출 제거
 * - jobPostingRepository를 통한 데이터 접근
 *
 * Supabase Edge Functions:
 * - approve-job-posting: 관리자 승인
 * - reject-job-posting: 관리자 거부
 * - resubmit-job-posting: 구인자 재제출
 */

import { supabase } from '@/lib/supabase';
import { invokeEdgeFunction } from '@/lib/supabaseFunctions';
import { logger } from '@/utils/logger';
import {
  normalizeError,
  BusinessError,
  AuthError,
  PermissionError,
  ValidationError,
  ERROR_CODES,
  toError,
} from '@/errors';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { jobPostingRepository } from '@/repositories';
import { STATUS } from '@/constants';
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
 * Edge Function 응답 타입
 */
interface ApprovalResponse {
  success: boolean;
  jobPostingId: string;
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
 * Supabase Edge Function 에러를 비즈니스 에러로 매핑
 */
async function mapEdgeFunctionError(error: unknown): Promise<Error> {
  // Supabase FunctionsHttpError: context는 fetch Response 객체
  if (error && typeof error === 'object' && 'context' in error) {
    const context = (error as { context?: Response }).context;
    const status = context?.status;

    // Response body에서 서버 에러 메시지 추출
    let serverMessage = '';
    try {
      const body = await context?.json();
      serverMessage = body?.message || body?.error || '';
    } catch {
      // body 파싱 실패 시 무시
    }

    switch (status) {
      case 401:
        return new AuthError(ERROR_CODES.AUTH_SESSION_EXPIRED, {
          userMessage: '로그인이 필요합니다',
        });
      case 403:
        return new PermissionError(ERROR_CODES.INFRA_PERMISSION_DENIED, {
          userMessage: '권한이 없습니다',
        });
      case 404:
        return new BusinessError(ERROR_CODES.INFRA_NOT_FOUND, {
          userMessage: '공고를 찾을 수 없습니다',
        });
      case 409:
        return new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: serverMessage || '이미 처리된 공고입니다',
        });
      case 422:
        return new ValidationError(ERROR_CODES.VALIDATION_SCHEMA, {
          userMessage: serverMessage || '잘못된 요청입니다',
        });
      default:
        break;
    }
  }

  return normalizeError(error);
}

// ============================================================================
// Auth Helper
// ============================================================================

/**
 * 현재 세션의 access token 획득 (만료 임박 시 preflight refresh).
 *
 * @description Supabase JS v2의 FunctionsClient는 onAuthStateChange 시
 * 자동으로 Authorization 헤더를 갱신하지 않아, 세션이 stale이면 anon key로
 * 폴백되어 Edge Function이 401을 반환함. 명시적으로 세션 토큰을 꺼내 헤더에
 * 주입해야 함. authCoreService.ts / portOneIdentityService.ts 참고.
 *
 * 페이지 새로고침 직후 localStorage 에서 복원된 세션이 이미 만료된 경우
 * supabase-js 내부 refresh 완료 전에 만료 토큰을 그대로 반환하는 레이스가
 * 존재 — 30초 skew 내면 명시적으로 refreshSession() 호출.
 */
const REFRESH_SKEW_MS = 30_000;
async function getAccessTokenOrThrow(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) {
    throw new AuthError(ERROR_CODES.AUTH_SESSION_EXPIRED, {
      userMessage: '로그인이 필요합니다',
    });
  }

  const session = data.session;
  const expiresAt = session.expires_at;
  if (expiresAt && expiresAt * 1000 - Date.now() <= REFRESH_SKEW_MS) {
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError || !refreshed.session?.access_token) {
      throw new AuthError(ERROR_CODES.AUTH_SESSION_EXPIRED, {
        userMessage: '로그인이 필요합니다',
        originalError: refreshError ? new Error(refreshError.message) : undefined,
      });
    }
    return refreshed.session.access_token;
  }

  return session.access_token;
}

// ============================================================================
// Approval Actions
// ============================================================================

/**
 * 대회공고 승인 (관리자 전용)
 *
 * @description Edge Function 'approve-job-posting' 호출
 * @throws BusinessError - 권한 없음, 공고 없음, 이미 처리됨
 */
export async function approveTournamentPosting(
  data: ApproveTournamentData
): Promise<ApprovalResponse> {
  try {
    logger.info('대회공고 승인 요청', { jobPostingId: data.jobPostingId });

    const accessToken = await getAccessTokenOrThrow();
    const { data: result, error } = await invokeEdgeFunction<ApprovalResponse>(
      'approve-job-posting',
      {
        body: data,
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    if (error) throw error;

    logger.info('대회공고 승인 완료', {
      jobPostingId: data.jobPostingId,
      approvedBy: result?.approvedBy,
    });

    return result!;
  } catch (error) {
    logger.error('대회공고 승인 실패', toError(error), {
      jobPostingId: data.jobPostingId,
    });
    throw await mapEdgeFunctionError(error);
  }
}

/**
 * 대회공고 거부 (관리자 전용)
 *
 * @description Edge Function 'reject-job-posting' 호출
 * @param data.jobPostingId - 공고 ID
 * @param data.reason - 거부 사유 (최소 10자)
 * @throws BusinessError - 권한 없음, 공고 없음, 이미 처리됨, 사유 부족
 */
export async function rejectTournamentPosting(
  data: RejectTournamentData
): Promise<ApprovalResponse> {
  try {
    logger.info('대회공고 거부 요청', {
      jobPostingId: data.jobPostingId,
      reasonLength: data.reason.length,
    });

    const accessToken = await getAccessTokenOrThrow();
    const { data: result, error } = await invokeEdgeFunction<ApprovalResponse>(
      'reject-job-posting',
      {
        body: data,
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    if (error) throw error;

    logger.info('대회공고 거부 완료', {
      jobPostingId: data.jobPostingId,
      rejectedBy: result?.rejectedBy,
    });

    return result!;
  } catch (error) {
    logger.error('대회공고 거부 실패', toError(error), {
      jobPostingId: data.jobPostingId,
    });
    throw await mapEdgeFunctionError(error);
  }
}

/**
 * 대회공고 재제출 (구인자 전용)
 *
 * @description Edge Function 'resubmit-job-posting' 호출
 * @param data.jobPostingId - 거부된 공고 ID
 * @throws BusinessError - 권한 없음, 공고 없음, rejected 상태 아님
 */
export async function resubmitTournamentPosting(
  data: ResubmitTournamentData
): Promise<ApprovalResponse> {
  try {
    logger.info('대회공고 재제출 요청', { jobPostingId: data.jobPostingId });

    const accessToken = await getAccessTokenOrThrow();
    const { data: result, error } = await invokeEdgeFunction<ApprovalResponse>(
      'resubmit-job-posting',
      {
        body: data,
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    if (error) throw error;

    logger.info('대회공고 재제출 완료', {
      jobPostingId: data.jobPostingId,
      resubmittedBy: result?.resubmittedBy,
    });

    return result!;
  } catch (error) {
    logger.error('대회공고 재제출 실패', toError(error), {
      jobPostingId: data.jobPostingId,
    });
    throw await mapEdgeFunctionError(error);
  }
}

// ============================================================================
// Query Functions (Repository 패턴 적용)
// ============================================================================

/**
 * 승인 대기 중인 대회공고 목록 조회 (관리자용)
 */
export async function getPendingTournamentPostings(): Promise<JobPosting[]> {
  try {
    logger.info('승인 대기 대회공고 목록 조회');

    const postings = await jobPostingRepository.getByPostingTypeAndApprovalStatus(
      'tournament',
      STATUS.TOURNAMENT.PENDING
    );

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

    const postings = await jobPostingRepository.getByPostingTypeAndApprovalStatus(
      'tournament',
      status
    );

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

    const postings = await jobPostingRepository.getByOwnerAndPostingType(ownerId, 'tournament', [
      STATUS.TOURNAMENT.PENDING,
      STATUS.TOURNAMENT.REJECTED,
    ]);

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

    const posting = await jobPostingRepository.getById(postingId);

    if (!posting) {
      logger.warn('대회공고를 찾을 수 없음', { postingId });
      return null;
    }

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
