import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { applicationRepository } from '@/repositories';

/**
 * 지원자 노쇼 이력 배치 조회 (S3-3).
 *
 * `useApplicantProfiles` 와 같은 배치 관용구 — 목록이 id 를 모아 한 번에 조회한다.
 * 카드마다 개별 조회하면 지원자 20명에 20번 왕복한다(N+1).
 *
 * 🔴 이 값은 사람에 대한 부정적 지표다. 서버가 횟수만 돌려주고 업장·날짜·사유는
 *    애초에 반환하지 않는다 — 클라에서 더 캘 방법 자체를 없애 두었다.
 */
export const APPLICANT_NO_SHOW_COUNTS_QUERY_KEY = 'applicant-no-show-counts';

interface UseApplicantNoShowCountsOptions {
  jobPostingId: string;
  applicantIds: string[];
  enabled?: boolean;
}

export function useApplicantNoShowCounts({
  jobPostingId,
  applicantIds,
  enabled = true,
}: UseApplicantNoShowCountsOptions) {
  const normalizedIds = useMemo(
    () => [...new Set(applicantIds.filter((id): id is string => Boolean(id)))].sort(),
    [applicantIds]
  );

  const { data: noShowCounts, isLoading } = useQuery({
    queryKey: [APPLICANT_NO_SHOW_COUNTS_QUERY_KEY, jobPostingId, normalizedIds.join(',')],
    queryFn: () => applicationRepository.getApplicantNoShowCounts(jobPostingId, normalizedIds),
    enabled: enabled && Boolean(jobPostingId) && normalizedIds.length > 0,
    // 노쇼 이력은 자주 바뀌지 않는다 — 목록을 스크롤할 때마다 다시 물을 이유가 없다.
    staleTime: 5 * 60 * 1000,
  });

  return { noShowCounts, isLoading };
}
