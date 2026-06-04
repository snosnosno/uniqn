import { STATUS } from '@/constants';
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

/**
 * 검색 결과 가시성 — 브라우즈 목록(getList)과 동일 규칙으로 정합한다.
 * - regular/urgent/fixed: release 가시성(isSupportedReleasePosting)
 * - tournament: 승인(approved)된 공고만 (getList 의 approvalStatus 게이트와 일치)
 *
 * getList 는 status IN (active, capacity_full) + tournament approvalStatus=approved 를
 * 적용하지만, 검색 dataFetcher 는 active + isCanonicalDatedPosting 만 걸러 fixed 가 전량
 * 탈락하고 미승인 대회가 노출됐다. 본 함수로 후처리 가시성을 통일한다.
 * (EF-jobsearch-2: fixed 검색 누락 / EF-jobsearch-3: 미승인 대회 노출 회귀 가드)
 */
export function isSearchVisiblePosting(
  posting: Pick<JobPosting, 'schemaVersion' | 'postingType' | 'schedule' | 'tournamentConfig'>
): boolean {
  if (!isSupportedReleasePosting(posting)) return false;
  if ((posting.postingType ?? 'regular') === 'tournament') {
    return posting.tournamentConfig?.approvalStatus === STATUS.TOURNAMENT.APPROVED;
  }
  return true;
}

export function isEmployerManageablePosting(
  posting: Pick<JobPosting, 'schemaVersion' | 'postingType' | 'schedule'>
): boolean {
  return isSupportedReleasePosting(posting);
}

// 2026-05-19: `isManageableByUser` 제거됨. owner/workspace 기반 클라이언트 가드는
// JPC 협업자를 인지 못해 false-redirect 를 유발했음. 권한 게이트는 RLS 단일 진실.
