/**
 * UNIQN Mobile - Application service
 *
 * Service layer responsibilities:
 * - orchestrate repository calls
 * - validate user input before writes
 * - keep observability hooks close to user actions
 */

import { logger } from '@/utils/logger';
import { ERROR_CODES, ValidationError } from '@/errors';
import { handleErrorWithDefault, handleServiceError } from '@/errors/serviceErrorHandler';
import { applicationRepository, type ApplicationWithJob, type ApplyContext } from '@/repositories';
import { trackEvent, trackJobApply, startApiTrace } from '@/services/observability';
import { cancellationRequestSchema, reviewCancellationSchema } from '@/schemas/application.schema';
import type {
  Application,
  ApplicationStatus,
  CreateApplicationInput,
  RequestCancellationInput,
  ReviewCancellationInput,
} from '@/types';
import type { BoardAuthorRole, BoardJobSummary } from '@/types/board';
import {
  archiveSubstitutePostByLinkedPosting,
  createSubstitutePost,
} from '@/services/boardService';

export type { ApplicationWithJob } from '@/repositories';

function toValidationError(message: string, fieldErrors?: Record<string, string[] | undefined>) {
  const normalizedFieldErrors = fieldErrors
    ? Object.fromEntries(
        Object.entries(fieldErrors).filter((entry): entry is [string, string[]] =>
          Array.isArray(entry[1])
        )
      )
    : undefined;

  return new ValidationError(ERROR_CODES.VALIDATION_SCHEMA, {
    userMessage: message,
    errors: normalizedFieldErrors,
  });
}

export async function getMyApplications(applicantId: string): Promise<ApplicationWithJob[]> {
  try {
    logger.info('My applications requested', { applicantId });

    const applications = await applicationRepository.getByApplicantId(applicantId);

    logger.info('My applications loaded', {
      applicantId,
      totalApplications: applications.length,
    });

    return applications;
  } catch (error) {
    throw handleServiceError(error, {
      operation: 'Get my applications',
      component: 'applicationService',
      context: { applicantId },
    });
  }
}

export async function getApplicationById(
  applicationId: string
): Promise<ApplicationWithJob | null> {
  try {
    logger.info('Application detail requested', { applicationId });
    return await applicationRepository.getById(applicationId);
  } catch (error) {
    throw handleServiceError(error, {
      operation: 'Get application by id',
      component: 'applicationService',
      context: { applicationId },
    });
  }
}

export async function cancelApplication(applicationId: string, applicantId: string): Promise<void> {
  try {
    logger.info('Application cancellation started', { applicationId, applicantId });

    await applicationRepository.cancelWithTransaction(applicationId, applicantId);

    logger.info('Application cancellation completed', { applicationId });
    trackEvent('application_cancel', { application_id: applicationId });
  } catch (error) {
    throw handleServiceError(error, {
      operation: 'Cancel application',
      component: 'applicationService',
      context: { applicationId, applicantId },
    });
  }
}

export async function hasAppliedToJob(jobPostingId: string, applicantId: string): Promise<boolean> {
  try {
    return await applicationRepository.hasApplied(jobPostingId, applicantId);
  } catch (error) {
    return handleErrorWithDefault(error, false, {
      operation: 'Check application existence',
      component: 'applicationService',
      context: { jobPostingId, applicantId },
    });
  }
}

export async function getApplicationStats(
  applicantId: string
): Promise<Record<ApplicationStatus, number>> {
  try {
    return await applicationRepository.getStatsByApplicantId(applicantId);
  } catch (error) {
    throw handleServiceError(error, {
      operation: 'Get application stats',
      component: 'applicationService',
      context: { applicantId },
    });
  }
}

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
    logger.info('Application submit started', {
      jobPostingId: input.jobPostingId,
      applicantId,
      assignmentCount: input.assignments.length,
    });

    const context: ApplyContext = {
      applicantId,
      applicantName,
      applicantPhone,
      applicantEmail,
      applicantNickname,
      applicantPhotoURL,
    };

    const result = await applicationRepository.applyWithTransaction(input, context);

    logger.info('Application submit completed', {
      applicationId: result.id,
      jobPostingId: input.jobPostingId,
      assignmentCount: input.assignments.length,
    });

    trace.putAttribute('status', 'success');
    trace.stop();

    const appliedPrimaryRole = result.assignments?.[0]?.roleIds?.[0] || 'other';
    trackJobApply(input.jobPostingId, result.jobPostingTitle, appliedPrimaryRole);

    return result;
  } catch (error) {
    trace.putAttribute('status', 'error');
    trace.stop();

    throw handleServiceError(error, {
      operation: 'Apply to job v2',
      component: 'applicationService',
      context: { jobPostingId: input.jobPostingId, applicantId },
    });
  }
}

export async function requestCancellation(
  input: RequestCancellationInput,
  applicantId: string,
  applicantContext?: { name: string; role: BoardAuthorRole; jobSummary: BoardJobSummary }
): Promise<void> {
  const trace = startApiTrace('requestCancellation');
  trace.putAttribute('applicationId', input.applicationId);

  try {
    const validationResult = cancellationRequestSchema.safeParse(input);
    if (!validationResult.success) {
      const firstError = validationResult.error.issues[0];
      throw toValidationError(
        firstError?.message || 'Please check the cancellation request input.',
        validationResult.error.flatten().fieldErrors
      );
    }

    logger.info('Cancellation request started', {
      applicationId: input.applicationId,
      applicantId,
    });

    await applicationRepository.requestCancellationWithTransaction(
      validationResult.data,
      applicantId
    );

    logger.info('Cancellation request completed', { applicationId: input.applicationId });

    // 대타 글 생성 (best-effort: 실패해도 취소 요청은 유지)
    if (validationResult.data.wantsSubstitutePost && applicantContext) {
      try {
        await createSubstitutePost({
          authorId: applicantId,
          authorName: applicantContext.name,
          authorRole: applicantContext.role,
          applicationId: input.applicationId,
          jobSummary: applicantContext.jobSummary,
          reason: validationResult.data.reason,
        });
        logger.info('Substitute post created', { applicationId: input.applicationId });
      } catch (substituteError) {
        logger.warn('Substitute post creation failed (non-blocking)', {
          applicationId: input.applicationId,
          error: substituteError,
        });
      }
    }

    trace.putAttribute('status', 'success');
    trace.stop();

    trackEvent('cancellation_request', {
      application_id: input.applicationId,
      wants_substitute: validationResult.data.wantsSubstitutePost,
    });
  } catch (error) {
    trace.putAttribute('status', 'error');
    trace.stop();

    throw handleServiceError(error, {
      operation: 'Request cancellation',
      component: 'applicationService',
      context: { applicationId: input.applicationId, applicantId },
    });
  }
}

export async function reviewCancellationRequest(
  input: ReviewCancellationInput,
  reviewerId: string
): Promise<void> {
  const trace = startApiTrace('reviewCancellationRequest');
  trace.putAttribute('applicationId', input.applicationId);
  trace.putAttribute('approved', String(input.approved));

  try {
    const validationResult = reviewCancellationSchema.safeParse(input);
    if (!validationResult.success) {
      const firstError = validationResult.error.issues[0];
      throw toValidationError(
        firstError?.message || 'Please check the cancellation review input.',
        validationResult.error.flatten().fieldErrors
      );
    }

    logger.info('Cancellation review started', {
      applicationId: input.applicationId,
      approved: input.approved,
      reviewerId,
    });

    await applicationRepository.reviewCancellationWithTransaction(
      validationResult.data,
      reviewerId
    );

    logger.info('Cancellation review completed', {
      applicationId: input.applicationId,
      approved: input.approved,
    });

    // 대타 글 아카이브: 취소 거절 시(대타 불필요) AND 취소 승인 시(슬롯 재오픈, 대타 임무 완료)
    try {
      const application = await applicationRepository.getById(input.applicationId);
      if (application) {
        await archiveSubstitutePostByLinkedPosting(
          application.jobPostingId,
          application.applicantId
        );
      }
    } catch (archiveError) {
      logger.warn('Substitute post archive failed on review (non-blocking)', {
        applicationId: input.applicationId,
        approved: input.approved,
        error: archiveError,
      });
    }

    trace.putAttribute('status', 'success');
    trace.stop();

    trackEvent('cancellation_reviewed', {
      application_id: input.applicationId,
      approved: input.approved,
    });
  } catch (error) {
    trace.putAttribute('status', 'error');
    trace.stop();

    throw handleServiceError(error, {
      operation: 'Review cancellation request',
      component: 'applicationService',
      context: { applicationId: input.applicationId, reviewerId },
    });
  }
}

export async function getCancellationRequests(
  jobPostingId: string,
  ownerId: string
): Promise<ApplicationWithJob[]> {
  try {
    logger.info('Cancellation requests requested', { jobPostingId, ownerId });

    const applications = await applicationRepository.getCancellationRequests(jobPostingId, ownerId);

    logger.info('Cancellation requests loaded', {
      jobPostingId,
      count: applications.length,
    });

    return applications;
  } catch (error) {
    throw handleServiceError(error, {
      operation: 'Get cancellation requests',
      component: 'applicationService',
      context: { jobPostingId, ownerId },
    });
  }
}
