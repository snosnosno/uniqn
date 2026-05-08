import type { JobPosting, PostingType, SupportedReleasePostingType } from '@/types';

export const SUPPORTED_RELEASE_POSTING_TYPES = [
  'regular',
  'tournament',
  'urgent',
] as const satisfies SupportedReleasePostingType[];

export const SUPPORTED_INTERNAL_POSTING_TYPES = [
  'regular',
  'fixed',
  'tournament',
  'urgent',
] as const satisfies PostingType[];

export function isSupportedReleasePosting(
  posting: Pick<JobPosting, 'schemaVersion' | 'postingType' | 'schedule'>
): boolean {
  const postingType = posting.postingType ?? 'regular';

  return (
    posting.schemaVersion === 3 &&
    ((postingType === 'fixed' && posting.schedule.kind === 'fixed') ||
      (posting.schedule.kind === 'dated' &&
        SUPPORTED_INTERNAL_POSTING_TYPES.includes(postingType as PostingType)))
  );
}

export function isCanonicalDatedPosting(
  posting: Pick<JobPosting, 'schemaVersion' | 'postingType' | 'schedule'>
): boolean {
  const postingType = posting.postingType ?? 'regular';

  return (
    posting.schemaVersion === 3 &&
    posting.schedule.kind === 'dated' &&
    SUPPORTED_RELEASE_POSTING_TYPES.includes(postingType as SupportedReleasePostingType)
  );
}

export function isEmployerManageablePosting(
  posting: Pick<JobPosting, 'schemaVersion' | 'postingType' | 'schedule'>
): boolean {
  return isSupportedReleasePosting(posting);
}

/**
 * Phase 2A — 사용자가 공고를 "관리 (편집 / 마감 / 지원자 확정)" 할 수 있는지.
 *
 * UI 분기 전용 (라우트 가드 등). 실제 권한 게이트는 RLS jp_select / jp_update 가
 * 단일 진실 — 본 함수는 클라이언트 사이드 가드일 뿐이며 RLS 가 차단할 수도 있다.
 *
 * @param job - 대상 공고
 * @param userId - 현재 사용자 uid
 * @param userWorkspaceIds - 사용자가 owner 또는 멤버인 워크스페이스 ID 목록
 *                           (useWorkspaces.workspaces.map(w => w.id))
 */
export function isManageableByUser(
  job: Pick<JobPosting, 'ownerId' | 'workspaceId'>,
  userId: string,
  userWorkspaceIds: string[]
): boolean {
  if (job.ownerId === userId) return true;
  if (job.workspaceId && userWorkspaceIds.includes(job.workspaceId)) return true;
  return false;
}
