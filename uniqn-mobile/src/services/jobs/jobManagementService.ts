import { logger } from '@/utils/logger';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { jobPostingRepository } from '@/repositories';
import { requireCurrentUser } from '@/services/auth/authCoreService';
import { workspaceService } from '@/services/workspace';
import { BusinessError, PermissionError, ERROR_CODES } from '@/errors';
import { defaultVenueName } from '@/constants/defaultNames';
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
  PostingLocation,
  UpdateJobPostingInput,
} from '@/types';
import { geocodeAddress } from './geocodingService';

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

/**
 * 지점 0개 워크스페이스에 자동 생성할 기본 운영처명(코스메틱 — 그리드 useEnsureDefaultVenue 와
 * 카운트검사로 수렴). 이 경로는 서버 성격이라 닉네임을 모르므로 폴백('내 지점')을 받는다.
 * 상수를 따로 두지 않는 이유는 그게 다섯 번째 기본명 포크였기 때문이다(S1, defaultNames SSOT).
 */
const DEFAULT_VENUE_NAME = defaultVenueName();

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

// =============================================================================
// 지오코딩 (주소 검색 2단계 — B2)
// =============================================================================
// 좌표는 **저장 시점에 한 번** 계산한다. 읽기 경로에는 카카오 키도, 네트워크 호출도 붙지 않는다.
// 실패는 전부 "좌표 없음"으로 접히고 길찾기는 주소 텍스트 검색으로 폴백한다 — 부가 기능이
// 공고 저장을 막아선 안 된다(geocodingService 는 throw 하지 않는다).

/**
 * 지오코딩에 넣을 주소.
 *
 * 🔴 우선순위는 **`toCanonicalLocation` 과 반드시 같아야 한다**(`district ?? address`).
 *    거기서 폼의 '주소'가 저장 직전 `district` 로 접히기 때문이다. 여기서 `address` 를 먼저
 *    보면, 둘 다 실린 입력에서 **핀은 `address` 자리인데 화면에 보이는 주소는 `district`** 인
 *    상태가 만들어진다 — 좌표와 주소 텍스트가 서로 다른 곳을 가리키는, 아무 에러도 안 나는 결함이다.
 *    (B1 이 물려준 `district ?? address` 붕괴가 4곳 전부 district 우선인 것과 같은 이유.)
 *
 * 🔑 `detailedAddress`(층/호)는 **넣지 않는다**. '3층 301호'가 붙으면 매칭률만 떨어진다.
 */
function pickGeocodeAddress(location?: Partial<PostingLocation>): string | undefined {
  const district = location?.district?.trim();
  if (district) return district;
  const address = location?.address?.trim();
  return address || undefined;
}

/**
 * 수정 시 좌표를 어떻게 할지 판정한다 — `undefined`(유지) / 좌표 / `null`(지움).
 *
 * 🔴 옛 좌표를 새 주소에 남기지 않는 것이 이 함수의 존재 이유다. 주소가 바뀌었는데 지오코딩이
 *    실패하면 **지운다** — 좌표가 없으면 주소 텍스트로 폴백하지만, 틀린 좌표는 길찾기가
 *    엉뚱한 곳으로 자신 있게 안내한다. 후자가 더 나쁘다.
 */
async function resolveGeoForUpdate(
  jobPostingId: string,
  input: UpdateJobPostingInput
): Promise<CreateJobPostingInput['geo']> {
  // 주소를 제출하지 않은 갱신(상태 변경·정산 설정 등)은 좌표에 의견이 없다.
  if (input.location === undefined) return undefined;

  // 🔴 **판정 기준을 저장 기준과 같게 맞춘다.** `mergeJobPostingInput` 은
  //    `{...base.location, ...patch.location}` 이라 patch 에 주소 키가 **아예 없으면** 옛 주소가
  //    그대로 저장된다. 그런데 여기서 값만 보고 "주소를 지웠다"로 읽으면
  //    **주소는 남았는데 좌표만 증발**한다 — 두 기준이 갈라진 자리다.
  //    키가 하나라도 있으면 그게 의견이고(값이 비었으면 진짜 지움), 둘 다 없으면 의견이 없다.
  const location = input.location;
  const statesAddress =
    Object.prototype.hasOwnProperty.call(location, 'district') ||
    Object.prototype.hasOwnProperty.call(location, 'address');
  if (!statesAddress) return undefined;

  const nextAddress = pickGeocodeAddress(location);

  // 주소를 지웠다 → 좌표도 지운다. 근거 없는 핀을 남기지 않는다.
  // 🔑 스냅샷 조회보다 **먼저** 판정한다 — 이 분기는 스냅샷을 한 번도 안 보므로,
  //    뒤에 두면 결과를 쓰지도 않을 왕복을 매번 한다(그 뒤 `updateWithTransaction` 의
  //    `loadAndVerifyMutateAccess` 가 같은 행을 또 읽어 동일 행 2회 조회가 된다).
  if (!nextAddress) return null;

  let snapshot: Awaited<ReturnType<typeof jobPostingRepository.getGeocodeSnapshot>> = null;
  try {
    snapshot = await jobPostingRepository.getGeocodeSnapshot(jobPostingId);
  } catch (error) {
    // 스냅샷은 최적화·정확도 보조일 뿐이다. 못 읽었다고 저장을 막지 않는다.
    // 못 읽으면 "주소가 바뀐 것으로 간주"한다 — 재계산이 실패하면 좌표를 지우게 되지만,
    // 그게 안전한 방향이다. 좌표가 없으면 주소 텍스트로 폴백하고, 틀린 좌표는 폴백이 없다.
    logger.warn('지오코딩 스냅샷 조회 실패 — 주소가 바뀐 것으로 간주하고 재계산', {
      jobPostingId,
      error: String(error),
    });
  }

  // 주소가 그대로이고 좌표도 이미 있으면 건드리지 않는다(호출 0회).
  if (snapshot?.hasGeo && snapshot.address === nextAddress) return undefined;

  // 여기까지 왔으면 주소가 바뀌었거나 좌표가 없다 — 실패해도 null 이 정답이다.
  return await geocodeAddress(nextAddress);
}

export async function createJobPosting(
  input: CreateJobPostingInput,
  ownerId: string,
  ownerName: string,
  workspaceId?: string
): Promise<CreateJobPostingResult> {
  try {
    const geo = await geocodeAddress(pickGeocodeAddress(input.location));
    const result = await createSinglePosting({ ...input, geo }, ownerId, ownerName, workspaceId);
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
  ownerId: string,
  expectedUpdatedAt: string | null
): Promise<JobPosting> {
  try {
    logger.info('공고 수정 시작', { jobPostingId, ownerId });

    const geo = await resolveGeoForUpdate(jobPostingId, input);
    const result = await jobPostingRepository.updateWithTransaction(
      jobPostingId,
      // `geo` 가 undefined 면 키를 아예 넣지 않는다 — mergeJobPostingInput 의 스프레드가
      // 명시적 undefined 도 그대로 실어 나르므로, 키 유무로 "의견 없음"을 표현한다.
      geo === undefined ? input : { ...input, geo },
      ownerId,
      expectedUpdatedAt
    );
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
