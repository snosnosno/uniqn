import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { jobPostingAnnouncementRepository } from '@/repositories';
import { requireOnlineForMutation } from '@/services/offline/remoteMutationGuard';
import type { JobPostingAnnouncement } from '@/repositories';

export const JOB_POSTING_ANNOUNCEMENTS_QUERY_KEY = 'job-posting-announcements';

/**
 * 공고 일괄 공지 — 발송 + 이력 조회 (S3-2).
 *
 * 🔑 이력이 이 기능의 절반이다. 알림은 받는 사람 것이라 사장 쪽에는 "무엇을 언제 몇 명에게
 *    보냈는지"가 남지 않는다. 이력이 없으면 사장은 같은 공지를 또 보내거나("보냈던가?")
 *    안 보낸 걸 보냈다고 착각한다.
 */
export function useJobPostingAnnouncements(jobPostingId: string) {
  const queryClient = useQueryClient();

  const {
    data: announcements,
    isLoading,
    error,
    refetch,
  } = useQuery<JobPostingAnnouncement[]>({
    queryKey: [JOB_POSTING_ANNOUNCEMENTS_QUERY_KEY, jobPostingId],
    queryFn: () => jobPostingAnnouncementRepository.listByPosting(jobPostingId),
    enabled: Boolean(jobPostingId),
  });

  const mutation = useMutation({
    mutationFn: ({ title, body }: { title: string; body: string }) => {
      // 오프라인에서 큐잉하면 안 되는 쓰기다 — 나중에 몰래 나가면 사장은 보낸 줄 모르는
      // 공지가 스태프에게 도착한다. 지금 보낼 수 없으면 지금 실패해야 한다.
      requireOnlineForMutation('useJobPostingAnnouncements.send');
      return jobPostingAnnouncementRepository.send(jobPostingId, title, body);
    },
    onSuccess: () => {
      // 낙관 업데이트를 하지 않는 이유: 실제 수신자 수는 서버만 안다.
      // 추정치를 먼저 보여주면 "3명에게 보냄"이 잠깐 떴다가 1명으로 바뀐다.
      void queryClient.invalidateQueries({
        queryKey: [JOB_POSTING_ANNOUNCEMENTS_QUERY_KEY, jobPostingId],
      });
    },
  });

  const send = useCallback(
    (title: string, body: string) => mutation.mutateAsync({ title, body }),
    [mutation]
  );

  return {
    announcements: announcements ?? [],
    isLoading,
    error: error as Error | null,
    refetch,
    send,
    isSending: mutation.isPending,
  };
}
