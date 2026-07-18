import { logger } from '@/utils/logger';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { jobPostingRepository } from '@/repositories';
import { requireCurrentUser } from '@/services/auth/authCoreService';
import { workspaceService } from '@/services/workspace';
import { BusinessError, PermissionError, ERROR_CODES } from '@/errors';
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

/**
 * 공고를 붙일 workspace_id 를 결정한다.
 *
 * P1#8: 목록 조회는 활성 워크스페이스(activeWorkspace) 스코프인데 생성은 항상
 * default(가장 오래된) 워크스페이스로 붙어, 워크스페이스 B 선택 후 만든 공고가
 * B 목록에서 사라지는 결함이 있었다.
 *
 * - requestedWorkspaceId 가 있으면(활성 워크스페이스 컨텍스트) 그 값을 사용하되,
 *   owner 소유/멤버인지 검증한다. 아니면 조용히 default 로 붙지 않고 명시 에러로
 *   차단한다(fail-closed) — "조용한 오붙음"이 이 결함의 본질이므로.
 * - 미전달(레거시/edge) 시 기존 default 조회로 fallback 한다.
 */
async function resolveWorkspaceId(ownerId: string, requestedWorkspaceId?: string): Promise<string> {
  if (!requestedWorkspaceId) {
    // Phase 0 N1 hotfix: workspace_id NOT NULL 제약 충족
    // owner 의 가장 오래된 워크스페이스 사용 (created_at ASC)
    return workspaceService.getDefaultWorkspaceIdForOwner(ownerId);
  }

  const accessible = await workspaceService.isMemberOfWorkspace(requestedWorkspaceId, ownerId);
  if (!accessible) {
    logger.warn('공고 생성 — 전달된 workspaceId 접근 권한 없음', { ownerId, requestedWorkspaceId });
    throw new PermissionError(ERROR_CODES.SECURITY_UNAUTHORIZED_ACCESS, {
      userMessage: '선택한 팀에 공고를 등록할 권한이 없어요.',
      metadata: { ownerId, requestedWorkspaceId },
    });
  }
  return requestedWorkspaceId;
}

/** 지점 0개 워크스페이스에 자동 생성할 기본 운영처명(코스메틱 — 그리드 useEnsureDefaultVenue 와 카운트검사로 수렴). */
const DEFAULT_VENUE_NAME = '기본 지점';

/**
 * 공고를 담을 기본 지점(venue 컨테이너)을 정한다.
 * 대회도 포함한다 — 근무표에서 대회 기간 인원/부족을 집계하기 위함(2026-07-19 결정).
 * 지점 1개면 그 지점, 0개면 기본 지점 생성, 2개 이상이면 미연결(폼 선택칩=B5 담당).
 *
 * venueId 가 이미 지정됐으면 진입하지 않는다(지정값 유지).
 *
 * NON-BLOCKING: 지점 조회/생성 실패는 공고 생성을 실패시키지 않는다(로그 후 venue_id 없이 진행, 기존 동작 보존).
 */
async function resolveDefaultVenueId(
  input: CreateJobPostingInput,
  workspaceId: string
): Promise<string | undefined> {
  let resolvedVenueId = input.venueId;
  if (!resolvedVenueId) {
    try {
      const venues = await jobPostingRepository.getVenueContainers(workspaceId);
      if (venues.length === 1) {
        resolvedVenueId = venues[0].id;
      } else if (venues.length === 0) {
        const container = await jobPostingRepository.getOrCreateVenueContainer(workspaceId, {
          name: DEFAULT_VENUE_NAME,
          kind: 'dated',
        });
        resolvedVenueId = container.id;
      }
      // 지점 2개 이상 → 자동 연결하지 않는다(폼 선택칩=B5). resolvedVenueId 미지정 유지.
    } catch (error) {
      logger.warn('공고 생성 — 기본 지점 자동 연결 실패(무시하고 진행)', {
        workspaceId,
        error: String(error),
      });
    }
  }
  return resolvedVenueId;
}

async function createSinglePosting(
  input: CreateJobPostingInput,
  ownerId: string,
  ownerName: string,
  requestedWorkspaceId?: string
): Promise<CreateJobPostingResult> {
  const workspaceId = await resolveWorkspaceId(ownerId, requestedWorkspaceId);
  const venueId = await resolveDefaultVenueId(input, workspaceId);
  try {
    return await jobPostingRepository.createWithTransaction(
      { ...input, venueId },
      {
        ownerId,
        ownerName,
        workspaceId,
      }
    );
  } catch (error) {
    // Race: lookup ↔ INSERT 사이 워크스페이스 삭제 → FK 23503
    if (isWorkspaceFkViolation(error)) {
      logger.warn('workspace FK race detected', { ownerId, workspaceId });
      throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
        userMessage: '팀을 다시 확인해주세요. 잠시 후 다시 시도해주세요.',
        metadata: { ownerId, workspaceId },
      });
    }
    throw error;
  }
}

export async function createJobPosting(
  input: CreateJobPostingInput,
  ownerId: string,
  ownerName: string,
  workspaceId?: string
): Promise<CreateJobPostingResult> {
  try {
    const result = await createSinglePosting(input, ownerId, ownerName, workspaceId);
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
  }
): Promise<void> {
  try {
    // 인가 주체는 세션에서 파생한다 — 클라이언트가 넘긴 값은 신뢰하지 않는다
    const actorId = (await requireCurrentUser()).id;
    logger.info('공고 정산 설정 저장 시작', { jobPostingId, actorId });
    await jobPostingRepository.updateSettlementSettings(jobPostingId, data, actorId);
    logger.info('공고 정산 설정 저장 완료', { jobPostingId });
  } catch (error) {
    throw handleServiceError(error, {
      operation: '공고 정산 설정 저장',
      component: 'jobManagementService',
      context: { jobPostingId },
    });
  }
}
