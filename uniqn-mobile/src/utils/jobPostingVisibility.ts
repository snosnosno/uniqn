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

// 2026-05-19: `isManageableByUser` 제거됨. owner/workspace 기반 클라이언트 가드는
// JPC 협업자를 인지 못해 false-redirect 를 유발했음. 권한 게이트는 RLS 단일 진실.
