/**
 * UNIQN Mobile - Employer Application Service (Admin)
 *
 * @description 구인자 등록 신청 관리자 서비스
 * @version 1.0.0
 *
 * 책임:
 * 1. 신청 목록 조회 (status 필터, 페이지네이션)
 * 2. 신청 상세 조회
 * 3. 승인 처리 (approve)
 * 4. 거부 처리 (reject)
 * 5. SLA 모니터링 (24h 경과 pending 건수)
 */

import { logger } from '@/utils/logger';
import { invalidateQueries } from '@/lib/queryClient';
import { employerApplicationRepository } from '@/repositories';
import type {
  EmployerApplication,
  EmployerApplicationStatus,
  EmployerApplicationRejectionCategory,
  FetchApplicationsResult,
  ApproveRejectResult,
} from '@/repositories';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { requireAdminUser } from '@/services/auth/authorizationService';

// ============================================================================
// Types
// ============================================================================

export interface ListApplicationsInput {
  status?: EmployerApplicationStatus;
  pageSize?: number;
  cursor?: string;
}

export interface RejectApplicationInput {
  applicationId: string;
  reason?: string;
  category?: EmployerApplicationRejectionCategory;
}

// ============================================================================
// 목록 조회
// ============================================================================

/**
 * 구인자 신청 목록 조회 (admin)
 */
export async function listEmployerApplications(
  input: ListApplicationsInput = {}
): Promise<FetchApplicationsResult> {
  await requireAdminUser();

  try {
    logger.info('구인자 신청 목록 조회', {
      component: 'employerApplicationService',
      status: input.status,
    });

    return await employerApplicationRepository.listForAdmin(input);
  } catch (error) {
    throw handleServiceError(error, {
      operation: '구인자 신청 목록 조회',
      component: 'employerApplicationService',
    });
  }
}

// ============================================================================
// 상세 조회
// ============================================================================

/**
 * 구인자 신청 상세 조회 (admin)
 */
export async function getEmployerApplication(
  applicationId: string
): Promise<EmployerApplication | null> {
  await requireAdminUser();

  try {
    return await employerApplicationRepository.getById(applicationId);
  } catch (error) {
    throw handleServiceError(error, {
      operation: '구인자 신청 상세 조회',
      component: 'employerApplicationService',
      context: { applicationId },
    });
  }
}

// ============================================================================
// 승인
// ============================================================================

/**
 * 구인자 신청 승인 (admin)
 *
 * @description
 * - RPC 내부에서 self-approve 방지 + 동시성 방지 처리
 * - 승인 시 users.role = 'employer'로 변경됨
 * - 동시성 충돌 시 EmployerAppAlreadyProcessedError 발생 → UI에서 Toast + refresh
 */
export async function approveEmployerApplication(
  applicationId: string
): Promise<ApproveRejectResult> {
  await requireAdminUser();

  try {
    logger.info('구인자 신청 승인 처리', {
      component: 'employerApplicationService',
      applicationId,
    });

    const result = await employerApplicationRepository.approve(applicationId);

    // 관련 쿼리 무효화 — employer applications 목록/상세 + 승인된 유저의 role 변경 반영
    void invalidateQueries.employerApplications();
    void invalidateQueries.user();

    logger.info('구인자 신청 승인 성공', {
      component: 'employerApplicationService',
      applicationId,
      userId: result.userId,
    });

    return result;
  } catch (error) {
    throw handleServiceError(error, {
      operation: '구인자 신청 승인',
      component: 'employerApplicationService',
      context: { applicationId },
    });
  }
}

// ============================================================================
// 거부
// ============================================================================

/**
 * 구인자 신청 거부 (admin)
 *
 * @description
 * - users.role 변경 없음
 * - 거부 후 유저는 즉시 재신청 가능 (MVP: cooldown 없음)
 * - 동시성 충돌 시 EmployerAppAlreadyProcessedError 발생
 */
export async function rejectEmployerApplication(
  input: RejectApplicationInput
): Promise<ApproveRejectResult> {
  await requireAdminUser();

  const { applicationId, reason, category } = input;

  try {
    logger.info('구인자 신청 거부 처리', {
      component: 'employerApplicationService',
      applicationId,
      category,
    });

    const result = await employerApplicationRepository.reject(applicationId, reason, category);

    // 관련 쿼리 무효화 — admin 목록/상세 refresh
    void invalidateQueries.employerApplications();

    logger.info('구인자 신청 거부 성공', {
      component: 'employerApplicationService',
      applicationId,
      userId: result.userId,
    });

    return result;
  } catch (error) {
    throw handleServiceError(error, {
      operation: '구인자 신청 거부',
      component: 'employerApplicationService',
      context: { applicationId },
    });
  }
}

// ============================================================================
// SLA 모니터링
// ============================================================================

/**
 * 24h 경과 pending 건수 조회 (admin 대시보드용)
 */
export async function getOverduePendingCount(hoursThreshold = 24): Promise<number> {
  await requireAdminUser();

  try {
    return await employerApplicationRepository.countOverduePending(hoursThreshold);
  } catch (error) {
    throw handleServiceError(error, {
      operation: 'SLA 모니터링',
      component: 'employerApplicationService',
    });
  }
}
