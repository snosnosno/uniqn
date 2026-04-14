import { logger } from '@/utils/logger';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { jobPostingRepository } from '@/repositories';
import { supabase } from '@/lib/supabase';
import type { TaxSettings } from '@/utils/settlement';
import type { CreateJobPostingResult, JobPostingStats } from '@/repositories';
import type {
  CreateJobPostingInput,
  JobPosting,
  JobPostingStatus,
  UpdateJobPostingInput,
} from '@/types';

export type { CreateJobPostingResult, JobPostingStats };

// =============================================================================
// T-B7+B8: schedule_board_sync_outbox 패턴
// =============================================================================
// fire-and-forget syncScheduleBoardSafely 제거. 모든 board sync 의도를
// outbox 테이블에 영속화하고 sync-schedule-board-outbox Edge Function이
// poll → sync_schedule_board RPC 호출 → status 업데이트로 처리.
// =============================================================================

type ScheduleBoardSyncAction = 'create' | 'update' | 'delete' | 'close' | 'reopen';

async function enqueueScheduleBoardSync(
  jobPostingId: string,
  action: ScheduleBoardSyncAction,
  payload: Record<string, unknown> = {}
): Promise<void> {
  const { error } = await supabase.from('schedule_board_sync_outbox').insert({
    job_posting_id: jobPostingId,
    action,
    payload,
    status: 'pending',
    retry_count: 0,
  });

  if (error) {
    // outbox insert 실패는 main mutation을 롤백시키지 않음.
    // 사용자 경험 보호 차원에서 warn 로그만 남기고, outbox failed_retry_limit
    // 모니터링 + 수동 백필이 안전망. 이는 아키텍처 결정.
    logger.warn('Schedule board sync enqueue 실패', {
      component: 'jobManagementService',
      jobPostingId,
      action,
      error: error.message,
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
    await enqueueScheduleBoardSync(result.id, 'create', {
      jobPostingId: result.id,
      ownerId,
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
    await enqueueScheduleBoardSync(jobPostingId, 'update', { jobPostingId, ownerId });

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
    await enqueueScheduleBoardSync(jobPostingId, 'delete', { jobPostingId, ownerId });
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
    await enqueueScheduleBoardSync(jobPostingId, 'close', { jobPostingId, ownerId });
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
    await enqueueScheduleBoardSync(jobPostingId, 'reopen', { jobPostingId, ownerId });
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

/**
 * bulkUpdateJobPostingStatus의 status별 outbox action 매핑.
 *
 * outbox CHECK 제약(create/update/delete/close/reopen)이 'bulk-status'를 허용하지
 * 않으므로 status 값으로 분기:
 * - closed → close
 * - active → reopen (재오픈 의도)
 * - 그 외 → update (단순 상태 변경)
 *
 * 처리 자체는 sync_schedule_board RPC가 현재 DB 상태로부터 멱등하게 수행.
 */
function bulkActionFor(status: JobPostingStatus): ScheduleBoardSyncAction {
  if (status === 'closed') return 'close';
  if (status === 'active') return 'reopen';
  return 'update';
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

    const action = bulkActionFor(status);
    await Promise.all(
      jobPostingIds.map((jobPostingId) =>
        enqueueScheduleBoardSync(jobPostingId, action, { jobPostingId, status, ownerId })
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
