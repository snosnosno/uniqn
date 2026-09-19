/**
 * [근무] 사람 줄 취소 요청 검토 (구인자 IA S1b)
 *
 * 지원자 조회 캐시에서 검토 대기 취소 요청을 인덱스로 만들고, 승인·거절 뮤테이션을 묶는다.
 * 사람 줄은 `workLog.applicationId` 로 이 인덱스를 찾는다(`findPendingCancellation`).
 */
import { useCallback, useMemo } from 'react';
import { buildPendingCancellationIndex } from '@/domains/application/pendingCancellationIndex';
import { useApplicantsByJobPosting } from './useApplicantsByJobPosting';
import { useReviewCancellation } from './useCancellationManagement';

export function useStaffCancellationReview(jobPostingId: string) {
  // 🚨 realtime 을 켜지 않는다 — 이 훅은 인스턴스마다 구독을 따로 열고 디듀프가 없다.
  //    스택 아래 공고 상세가 같은 공고를 이미 구독하고, 그 onUpdate 가 같은 캐시에 쓴다
  //    (settlements.tsx 의 취소 요청 수 조회와 같은 이유).
  const { data } = useApplicantsByJobPosting(jobPostingId);
  const { mutateAsync, isPending, variables } = useReviewCancellation();

  const applicants = data?.applicants;
  const cancellationIndex = useMemo(
    () => buildPendingCancellationIndex(applicants ?? []),
    [applicants]
  );

  const approveAsync = useCallback(
    (applicationId: string) => mutateAsync({ applicationId, approved: true }),
    [mutateAsync]
  );

  const rejectAsync = useCallback(
    (applicationId: string, rejectionReason: string) =>
      mutateAsync({ applicationId, approved: false, rejectionReason }),
    [mutateAsync]
  );

  return {
    cancellationIndex,
    /** 지금 검토 중인 지원서 id — 그 지원서의 줄만 잠근다(CANCEL-15). */
    reviewingApplicationId: isPending ? (variables?.applicationId ?? null) : null,
    approveAsync,
    rejectAsync,
  };
}
