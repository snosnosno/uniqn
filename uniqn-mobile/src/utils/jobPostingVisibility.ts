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
