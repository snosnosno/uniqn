import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib';

function extractJobPostingIdFromCacheEntry(
  data: unknown,
  applicationIds: Set<string>
): string | undefined {
  if (!data || typeof data !== 'object' || !('applicants' in data)) {
    return undefined;
  }

  const applicants = (data as { applicants?: { id?: string; jobPostingId?: string }[] }).applicants;
  if (!Array.isArray(applicants)) {
    return undefined;
  }

  return applicants.find(
    (applicant) =>
      typeof applicant.id === 'string' &&
      applicationIds.has(applicant.id) &&
      typeof applicant.jobPostingId === 'string'
  )?.jobPostingId;
}

export function findJobPostingIdForApplications(
  queryClient: QueryClient,
  applicationIds: string[]
): string | undefined {
  const ids = new Set(applicationIds.filter(Boolean));
  if (ids.size === 0) {
    return undefined;
  }

  const cacheEntries = queryClient.getQueriesData({
    queryKey: queryKeys.applicantManagement.all,
  });

  for (const [, data] of cacheEntries) {
    const jobPostingId = extractJobPostingIdFromCacheEntry(data, ids);
    if (jobPostingId) {
      return jobPostingId;
    }
  }

  return undefined;
}
