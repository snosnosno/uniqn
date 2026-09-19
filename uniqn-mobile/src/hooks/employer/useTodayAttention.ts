/**
 * useTodayAttention — 내 공고 탭 "오늘 한 줄" 데이터 (읽기 전용, 구인자 IA S3)
 *
 * 범위는 '나'(owner_id) 다 — 지점·팀 선택과 무관하게 내 공고 전체를 센다.
 * 쿼리 키를 `workSchedule` 아래에 둔 이유: 근무표를 당겨 새로고침하면 이 한 줄도 같이 갱신된다.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { workLogRepository } from '@/repositories';
import { summarizeTodayAttention, type TodayAttentionSummary } from '@/domains/staff';
import { useAuthStore } from '@/stores/authStore';
import { getTodayString } from '@/utils/date';

export const todayAttentionQueryKey = (ownerId: string, today: string) =>
  ['workSchedule', 'ownerAttention', ownerId, today] as const;

export interface UseTodayAttentionResult {
  summary: TodayAttentionSummary;
  isError: boolean;
  /** 당겨서 새로고침이 끝날 때까지 기다릴 수 있도록 Promise 를 돌려준다. */
  refetch: () => Promise<unknown>;
}

export function useTodayAttention(): UseTodayAttentionResult {
  const ownerId = useAuthStore((state) => state.user?.uid);
  const today = getTodayString();

  const query = useQuery({
    queryKey: todayAttentionQueryKey(ownerId ?? '', today),
    queryFn: () => workLogRepository.getAttentionByOwnerId(ownerId as string, today),
    enabled: Boolean(ownerId),
  });

  // `now` 는 데이터가 바뀔 때 새로 잡는다 — 야간 유예 경계는 다음 refetch 에서 반영된다
  // (근무표 배너와 같은 절충. 분 단위 타이머를 둘 만한 값이 아니다).
  const summary = useMemo(
    () => summarizeTodayAttention(query.data ?? [], new Date()),
    [query.data]
  );

  return {
    summary,
    isError: query.isError,
    refetch: () => query.refetch(),
  };
}
