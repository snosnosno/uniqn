import type { JobPosting } from '@/types';

export function isCanonicalDatedPosting(
  posting: Pick<JobPosting, 'postingType' | 'schedule'>
): boolean {
  return posting.postingType !== 'fixed' && posting.schedule.kind !== 'fixed';
}
