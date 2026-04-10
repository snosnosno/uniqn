import { logger } from '@/utils/logger';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { jobPostingRepository } from '@/repositories';
import {
  archiveScheduleBoard,
  syncScheduleBoardByJobPostingId,
  syncScheduleBoardForJobPosting,
} from '@/services/boardService';
import type { TaxSettings } from '@/utils/settlement';
import type { CreateJobPostingResult, JobPostingStats } from '@/repositories';
import type {
  CreateJobPostingInput,
  JobPosting,
  JobPostingStatus,
  UpdateJobPostingInput,
} from '@/types';

export type { CreateJobPostingResult, JobPostingStats };

async function syncScheduleBoardSafely(
  task: () => Promise<unknown>,
  context: Record<string, unknown>
) {
  try {
    await task();
  } catch (error) {
    logger.warn('Schedule board sync failed', {
      component: 'jobManagementService',
      ...context,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function createSinglePosting(
  input: CreateJobPostingInput,
  ownerId: string,
  ownerName: string
): Promise<CreateJobPostingResult> {
  return jobPostingRepository.createWithTransaction(input, {
    ownerId,
    ownerName,
  });
}

export async function createJobPosting(
  input: CreateJobPostingInput,
  ownerId: string,
  ownerName: string
): Promise<CreateJobPostingResult> {
  try {
    const result = await createSinglePosting(input, ownerId, ownerName);
    await syncScheduleBoardSafely(() => syncScheduleBoardForJobPosting(result.jobPosting), {
      jobPostingId: result.id,
      ownerId,
      action: 'create',
    });
    return result;
  } catch (error) {
    throw handleServiceError(error, {
      operation: '공고 생성',
      component: 'jobManagementService',
      context: { ownerId },
    });
  }
}

export async function updateJobPosting(
  jobPostingId: string,
  input: UpdateJobPostingInput,
  ownerId: string
): Promise<JobPosting> {
  try {
    logger.info('공고 수정 시작', { jobPostingId, ownerId });

    const result = await jobPostingRepository.updateWithTransaction(jobPostingId, input, ownerId);
    await syncScheduleBoardSafely(() => syncScheduleBoardForJobPosting(result), {
      jobPostingId,
      ownerId,
      action: 'update',
    });

    logger.info('공고 수정 완료', { jobPostingId });
    return result;
  } catch (error) {
    throw handleServiceError(error, {
      operation: '공고 수정',
      component: 'jobManagementService',
      context: { jobPostingId },
    });
  }
}

export async function deleteJobPosting(jobPostingId: string, ownerId: string): Promise<void> {
  try {
    logger.info('공고 삭제 시작', { jobPostingId, ownerId });
    await jobPostingRepository.deleteWithTransaction(jobPostingId, ownerId);
    await syncScheduleBoardSafely(() => archiveScheduleBoard(jobPostingId), {
      jobPostingId,
      ownerId,
      action: 'delete',
    });
    logger.info('공고 삭제 완료', { jobPostingId });
  } catch (error) {
    throw handleServiceError(error, {
      operation: '공고 삭제',
      component: 'jobManagementService',
      context: { jobPostingId },
    });
  }
}

export async function closeJobPosting(jobPostingId: string, ownerId: string): Promise<void> {
  try {
    logger.info('공고 마감 시작', { jobPostingId, ownerId });
    await jobPostingRepository.closeWithTransaction(jobPostingId, ownerId);
    await syncScheduleBoardSafely(() => syncScheduleBoardByJobPostingId(jobPostingId), {
      jobPostingId,
      ownerId,
      action: 'close',
    });
    logger.info('공고 마감 완료', { jobPostingId });
  } catch (error) {
    throw handleServiceError(error, {
      operation: '공고 마감',
      component: 'jobManagementService',
      context: { jobPostingId },
    });
  }
}

export async function reopenJobPosting(jobPostingId: string, ownerId: string): Promise<void> {
  try {
    logger.info('공고 재오픈 시작', { jobPostingId, ownerId });
    await jobPostingRepository.reopenWithTransaction(jobPostingId, ownerId);
    await syncScheduleBoardSafely(() => syncScheduleBoardByJobPostingId(jobPostingId), {
      jobPostingId,
      ownerId,
      action: 'reopen',
    });
    logger.info('공고 재오픈 완료', { jobPostingId });
  } catch (error) {
    throw handleServiceError(error, {
      operation: '공고 재오픈',
      component: 'jobManagementService',
      context: { jobPostingId },
    });
  }
}

export async function getMyJobPostingStats(ownerId: string): Promise<JobPostingStats> {
  try {
    logger.info('내 공고 통계 조회', { ownerId });
    const stats = await jobPostingRepository.getStatsByOwnerId(ownerId);
    logger.info('내 공고 통계 조회 완료', { ownerId, stats });
    return stats;
  } catch (error) {
    throw handleServiceError(error, {
      operation: '내 공고 통계 조회',
      component: 'jobManagementService',
      context: { ownerId },
    });
  }
}

export async function bulkUpdateJobPostingStatus(
  jobPostingIds: string[],
  status: JobPostingStatus,
  ownerId: string
): Promise<number> {
  try {
    logger.info('공고 상태 일괄 변경 시작', { count: jobPostingIds.length, status, ownerId });

    const successCount = await jobPostingRepository.bulkUpdateStatus(
      jobPostingIds,
      status,
      ownerId
    );
    await Promise.all(
      jobPostingIds.map((jobPostingId) =>
        syncScheduleBoardSafely(() => syncScheduleBoardByJobPostingId(jobPostingId), {
          jobPostingId,
          ownerId,
          action: 'bulk-status',
          status,
        })
      )
    );

    logger.info('공고 상태 일괄 변경 완료', { successCount });
    return successCount;
  } catch (error) {
    throw handleServiceError(error, {
      operation: '공고 상태 일괄 변경',
      component: 'jobManagementService',
      context: { status, ownerId },
    });
  }
}

export async function updateJobPostingSettlementSettings(
  jobPostingId: string,
  data: {
    roles: Record<string, unknown>[];
    allowances: Record<string, unknown>;
    taxSettings: TaxSettings;
  },
  ownerId: string
): Promise<void> {
  try {
    logger.info('공고 정산 설정 저장 시작', { jobPostingId, ownerId });
    await jobPostingRepository.updateSettlementSettings(jobPostingId, data, ownerId);
    logger.info('공고 정산 설정 저장 완료', { jobPostingId });
  } catch (error) {
    throw handleServiceError(error, {
      operation: '공고 정산 설정 저장',
      component: 'jobManagementService',
      context: { jobPostingId, ownerId },
    });
  }
}
