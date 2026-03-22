import { logger } from '@/utils/logger';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { jobPostingRepository } from '@/repositories';
import type { CreateJobPostingResult, JobPostingStats } from '@/repositories';
import type {
  CreateJobPostingInput,
  JobPosting,
  JobPostingStatus,
  PostingRoleCatalogEntry,
  UpdateJobPostingInput,
} from '@/types';
import type { PostingDateRequirement } from '@/types/jobPosting';

export type { CreateJobPostingResult, JobPostingStats };

function getRoleKey(role: { role?: string; customRole?: string }): string {
  if (role.role === 'other' && role.customRole) {
    return `other:${role.customRole}`;
  }

  return role.role ?? '';
}

function extractRequirementRoleKeys(requirement: PostingDateRequirement): Set<string> {
  const roleKeys = new Set<string>();

  requirement.timeSlots.forEach((slot) => {
    slot.roles.forEach((role) => {
      const key = getRoleKey(role);
      if (key) {
        roleKeys.add(key);
      }
    });
  });

  return roleKeys;
}

function filterRoleCatalogByRequirement(
  roleCatalog: PostingRoleCatalogEntry[],
  requirement: PostingDateRequirement
): PostingRoleCatalogEntry[] {
  const allowedKeys = extractRequirementRoleKeys(requirement);
  return roleCatalog.filter((role) => allowedKeys.has(getRoleKey(role)));
}

function buildSingleDatePostingInput(
  input: CreateJobPostingInput,
  requirement: PostingDateRequirement
): CreateJobPostingInput {
  return {
    ...input,
    schedule: {
      kind: 'dated',
      primaryDate: requirement.date,
      allDates: [requirement.date],
      requirements: [requirement],
    },
    roleCatalog: filterRoleCatalogByRequirement(input.roleCatalog, requirement),
  };
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

async function createMultiplePostingsByDate(
  input: CreateJobPostingInput,
  ownerId: string,
  ownerName: string
): Promise<CreateJobPostingResult[]> {
  if (input.schedule.kind !== 'dated') {
    return [await createSinglePosting(input, ownerId, ownerName)];
  }

  const requirements = input.schedule.requirements ?? [];
  const results: CreateJobPostingResult[] = [];
  const createdIds: string[] = [];

  try {
    for (const requirement of requirements) {
      const result = await createSinglePosting(
        buildSingleDatePostingInput(input, requirement),
        ownerId,
        ownerName
      );
      results.push(result);
      createdIds.push(result.id);
    }
  } catch (error) {
    if (createdIds.length > 0) {
      await rollbackCreatedPostings(createdIds);
    }
    throw error;
  }

  return results;
}

async function rollbackCreatedPostings(createdIds: string[]): Promise<void> {
  const failedIds: string[] = [];

  for (const id of createdIds) {
    try {
      const posting = await jobPostingRepository.getById(id);
      if (posting?.status === 'cancelled') {
        continue;
      }

      await jobPostingRepository.updateStatus(id, 'cancelled');
    } catch (rollbackError) {
      failedIds.push(id);
      logger.error('공고 롤백 실패', rollbackError as Error, {
        id,
        component: 'jobManagementService',
      });
    }
  }

  if (failedIds.length > 0) {
    logger.error('일부 공고 롤백 실패, 수동 정리 필요', {
      failedIds,
      totalCreated: createdIds.length,
      failedCount: failedIds.length,
      component: 'jobManagementService',
    });
  }
}

export async function createJobPosting(
  input: CreateJobPostingInput,
  ownerId: string,
  ownerName: string
): Promise<CreateJobPostingResult | CreateJobPostingResult[]> {
  try {
    const isMultiDateType = input.postingType === 'regular' || input.postingType === 'urgent';
    const hasMultipleDates =
      input.schedule.kind === 'dated' && input.schedule.requirements.length > 1;

    if (isMultiDateType && hasMultipleDates) {
      return await createMultiplePostingsByDate(input, ownerId, ownerName);
    }

    return await createSinglePosting(input, ownerId, ownerName);
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
    taxSettings: { type: string; value: number; taxableItems?: string[] };
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
