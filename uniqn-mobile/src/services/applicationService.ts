/**
 * UNIQN Mobile - 지원 서비스
 *
 * @description Repository 패턴 기반 지원 서비스
 * @version 2.0.0 - Repository 패턴 적용 (Phase 2.1)
 *
 * 아키텍처:
 * Service Layer → Repository Layer → Firebase
 *
 * 책임 분리:
 * - Service: 비즈니스 로직 조합, Analytics, 에러 변환
 * - Repository: 데이터 접근, 트랜잭션 캡슐화
 */

import { logger } from '@/utils/logger';
import { handleServiceError, handleErrorWithDefault } from '@/errors/serviceErrorHandler';
import { applicationRepository, type ApplicationWithJob, type ApplyContext } from '@/repositories';
import { trackJobApply, trackEvent } from './analyticsService';
import { startApiTrace } from './performanceService';
import type {
  Application,
  ApplicationStatus,
  CreateApplicationInput,
  RequestCancellationInput,
  ReviewCancellationInput,
} from '@/types';

// ============================================================================
// Re-export Types
// ============================================================================

export type { ApplicationWithJob } from '@/repositories';

// ============================================================================
// Application Service
// ============================================================================

/**
 * 내 지원 내역 조회
 *
 * @description Repository를 통해 지원 내역 + 공고 정보 조회
 */
export async function getMyApplications(applicantId: string): Promise<ApplicationWithJob[]> {
  try {
    logger.info('내 지원 내역 조회', { applicantId });

    const applications = await applicationRepository.getByApplicantId(applicantId);

    logger.info('내 지원 내역 조회 완료', {
      applicantId,
      applicationCount: applications.length,
    });

    return applications;
  } catch (error) {
    throw handleServiceError(error, {
      operation: '내 지원 내역 조회',
      component: 'applicationService',
      context: { applicantId },
    });
  }
}

/**
 * 지원 상세 조회
 */
export async function getApplicationById(
  applicationId: string
): Promise<ApplicationWithJob | null> {
  try {
    logger.info('지원 상세 조회', { applicationId });

    const application = await applicationRepository.getById(applicationId);

    return application;
  } catch (error) {
    throw handleServiceError(error, {
      operation: '지원 상세 조회',
      component: 'applicationService',
      context: { applicationId },
    });
  }
}

/**
 * 지원 취소 (트랜잭션)
 */
export async function cancelApplication(
  applicationId: string,
  applicantId: string
): Promise<void> {
  try {
    logger.info('지원 취소 시작', { applicationId, applicantId });

    await applicationRepository.cancelWithTransaction(applicationId, applicantId);

    logger.info('지원 취소 성공', { applicationId });

    // Analytics 이벤트
    trackEvent('application_cancel', { application_id: applicationId });
  } catch (error) {
    throw handleServiceError(error, {
      operation: '지원 취소',
      component: 'applicationService',
      context: { applicationId, applicantId },
    });
  }
}

/**
 * 특정 공고의 지원 여부 확인
 */
export async function hasAppliedToJob(
  jobPostingId: string,
  applicantId: string
): Promise<boolean> {
  try {
    return await applicationRepository.hasApplied(jobPostingId, applicantId);
  } catch (error) {
    return handleErrorWithDefault(error, false, {
      operation: '지원 여부 확인',
      component: 'applicationService',
      context: { jobPostingId, applicantId },
    });
  }
}

/**
 * 지원 상태별 개수 조회
 */
export async function getApplicationStats(
  applicantId: string
): Promise<Record<ApplicationStatus, number>> {
  try {
    return await applicationRepository.getStatsByApplicantId(applicantId);
  } catch (error) {
    throw handleServiceError(error, {
      operation: '지원 통계 조회',
      component: 'applicationService',
      context: { applicantId },
    });
  }
}

// ============================================================================
// Application Service v2.0 (Assignment + PreQuestion 지원)
// ============================================================================

/**
 * 공고에 지원하기 v2.0 (트랜잭션)
 *
 * @description Repository를 통해 트랜잭션 처리
 *
 * 비즈니스 로직 (Repository에서 처리):
 * 1. Assignment 유효성 검증
 * 2. 사전질문 필수 답변 검증
 * 3. 중복 지원 검사
 * 4. 공고 상태/정원 확인
 * 5. 지원서 생성 (v2.0 형식)
 */
export async function applyToJobV2(
  input: CreateApplicationInput,
  applicantId: string,
  applicantName: string,
  applicantPhone?: string,
  applicantEmail?: string,
  applicantNickname?: string,
  applicantPhotoURL?: string
): Promise<Application> {
  const trace = startApiTrace('applyToJobV2');
  trace.putAttribute('jobPostingId', input.jobPostingId);
  trace.putAttribute('assignmentCount', String(input.assignments.length));

  try {
    logger.info('지원하기 v2.0 시작', {
      jobPostingId: input.jobPostingId,
      applicantId,
      assignmentCount: input.assignments.length,
    });

    // ApplyContext 생성
    const context: ApplyContext = {
      applicantId,
      applicantName,
      applicantPhone,
      applicantEmail,
      applicantNickname,
      applicantPhotoURL,
    };

    // Repository를 통해 트랜잭션 실행
    const result = await applicationRepository.applyWithTransaction(input, context);

    logger.info('지원하기 v2.0 성공', {
      applicationId: result.id,
      jobPostingId: input.jobPostingId,
      assignmentCount: input.assignments.length,
    });

    // 성능 추적: 지원 성공
    trace.putAttribute('status', 'success');
    trace.stop();

    // Analytics 이벤트 (assignments에서 대표 역할 추출)
    const appliedPrimaryRole = result.assignments?.[0]?.roleIds?.[0] || 'other';
    trackJobApply(input.jobPostingId, result.jobPostingTitle, appliedPrimaryRole);

    return result;
  } catch (error) {
    // 성능 추적: 지원 실패
    trace.putAttribute('status', 'error');
    trace.stop();

    // handleServiceError가 AppError 서브클래스(AlreadyAppliedError 등)를 자동 보존
    throw handleServiceError(error, {
      operation: '지원하기 v2.0',
      component: 'applicationService',
      context: { jobPostingId: input.jobPostingId, applicantId },
    });
  }
}

// ============================================================================
// 취소 요청 시스템 (v2.1)
// ============================================================================

/**
 * 취소 요청 제출 (스태프용)
 *
 * @description Repository를 통해 트랜잭션 처리
 */
export async function requestCancellation(
  input: RequestCancellationInput,
  applicantId: string
): Promise<void> {
  const trace = startApiTrace('requestCancellation');
  trace.putAttribute('applicationId', input.applicationId);

  try {
    logger.info('취소 요청 제출 시작', {
      applicationId: input.applicationId,
      applicantId,
    });

    await applicationRepository.requestCancellationWithTransaction(input, applicantId);

    logger.info('취소 요청 제출 성공', { applicationId: input.applicationId });

    trace.putAttribute('status', 'success');
    trace.stop();

    // Analytics 이벤트
    trackEvent('cancellation_request', { application_id: input.applicationId });
  } catch (error) {
    trace.putAttribute('status', 'error');
    trace.stop();

    throw handleServiceError(error, {
      operation: '취소 요청 제출',
      component: 'applicationService',
      context: { applicationId: input.applicationId, applicantId },
    });
  }
}

/**
 * 취소 요청 검토 (구인자용)
 *
 * @description Repository를 통해 트랜잭션 처리
 */
export async function reviewCancellationRequest(
  input: ReviewCancellationInput,
  reviewerId: string
): Promise<void> {
  const trace = startApiTrace('reviewCancellationRequest');
  trace.putAttribute('applicationId', input.applicationId);
  trace.putAttribute('approved', String(input.approved));

  try {
    logger.info('취소 요청 검토 시작', {
      applicationId: input.applicationId,
      approved: input.approved,
      reviewerId,
    });

    await applicationRepository.reviewCancellationWithTransaction(input, reviewerId);

    logger.info('취소 요청 검토 성공', {
      applicationId: input.applicationId,
      approved: input.approved,
    });

    trace.putAttribute('status', 'success');
    trace.stop();

    // Analytics 이벤트
    trackEvent('cancellation_reviewed', {
      application_id: input.applicationId,
      approved: input.approved,
    });
  } catch (error) {
    trace.putAttribute('status', 'error');
    trace.stop();

    throw handleServiceError(error, {
      operation: '취소 요청 검토',
      component: 'applicationService',
      context: { applicationId: input.applicationId, reviewerId },
    });
  }
}

/**
 * 취소 요청 목록 조회 (구인자용)
 *
 * @description Repository를 통해 조회
 */
export async function getCancellationRequests(
  jobPostingId: string,
  ownerId: string
): Promise<ApplicationWithJob[]> {
  try {
    logger.info('취소 요청 목록 조회', { jobPostingId, ownerId });

    const applications = await applicationRepository.getCancellationRequests(jobPostingId, ownerId);

    logger.info('취소 요청 목록 조회 완료', {
      jobPostingId,
      count: applications.length,
    });

    return applications;
  } catch (error) {
    throw handleServiceError(error, {
      operation: '취소 요청 목록 조회',
      component: 'applicationService',
      context: { jobPostingId, ownerId },
    });
  }
}
