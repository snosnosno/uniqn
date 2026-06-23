import { logger } from '@/utils/logger';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { jobPostingRepository } from '@/repositories';
import { workspaceService } from '@/services/workspace';
import { BusinessError, ERROR_CODES } from '@/errors';
import type { TaxSettings } from '@/utils/settlement';
import type {
  CreateJobPostingResult,
  JobPostingStats,
  ScheduleBoardSyncAction,
} from '@/repositories';
import type {
  CreateJobPostingInput,
  JobPosting,
  JobPostingStatus,
  UpdateJobPostingInput,
} from '@/types';

export type { CreateJobPostingResult, JobPostingStats, ScheduleBoardSyncAction };

// =============================================================================
// T-B7+B8: schedule_board_sync_outbox 패턴
// =============================================================================
// fire-and-forget syncScheduleBoardSafely 제거. 모든 board sync 의도를
// outbox 테이블에 영속화하고 sync-schedule-board-outbox Edge Function이
// poll → sync_schedule_board RPC 호출 → status 업데이트로 처리.
//
// U4: outbox insert(snake_case 매핑)는 Repository 로 이관. Service 는 enqueue
// 의도만 표현하며, enqueue 실패가 main mutation 을 롤백시키지 않는 동작은
// Repository 내부에서 동일하게 유지된다.
// =============================================================================

export async function enqueueScheduleBoardSync(
  jobPostingId: string,
  action: ScheduleBoardSyncAction,
  payload: Record<string, unknown> = {}
): Promise<void> {
  await jobPostingRepository.enqueueScheduleBoardSync(jobPostingId, action, payload);
}

/**
 * Postgres FK 제약 위반 (23503) 판별 — workspace_id 참조 무결성 깨진 경우.
 *
 * lookup ↔ INSERT 사이 race window 에서 owner 가 워크스페이스 삭제 시 발생.
 * 사용자에게 친화적 메시지 변환을 위해 별도 분기.
 */
function isWorkspaceFkViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const obj = error as { code?: string; message?: string };
  if (obj.code === '23503') return true;
  return typeof obj.message === 'string' && obj.message.includes('workspace_id');
}

async function createSinglePosting(
  input: CreateJobPostingInput,
  ownerId: string,
  ownerName: string
): Promise<CreateJobPostingResult> {
  // Phase 0 N1 hotfix: workspace_id NOT NULL 제약 충족
  // owner 의 가장 오래된 워크스페이스 사용 (created_at ASC)
  const workspaceId = await workspaceService.getDefaultWorkspaceIdForOwner(ownerId);
  try {
    return await jobPostingRepository.createWithTransaction(input, {
      ownerId,
      ownerName,
      workspaceId,
    });
  } catch (error) {
    // Race: lookup ↔ INSERT 사이 워크스페이스 삭제 → FK 23503
    if (isWorkspaceFkViolation(error)) {
      logger.warn('workspace FK race detected', { ownerId, workspaceId });
      throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
        userMessage: '워크스페이스를 다시 확인해주세요. 잠시 후 다시 시도해주세요.',
        metadata: { ownerId, workspaceId },
      });
    }
    throw error;
  }
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
