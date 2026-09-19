/**
 * UNIQN Mobile - 탈퇴 영향 조회 훅
 *
 * @description 탈퇴 화면 사전 경고용. 탈퇴해도 사라지지 않는 근무·정산 건수를 읽는다.
 * @version 1.0.0
 *
 * 왜 필요한가
 *   영구삭제 RPC(`permanently_delete_user`)는 근무·정산 기록을 **취소하지 않고 익명화만** 한다.
 *   사장 근무표에는 '[deleted]' 스태프가 확정 상태로 남고 정원도 계속 소모된다.
 *   화면 문구는 이 사실에 맞게 고쳤지만(2026-08-07), 문구만으로는 "나에게 해당되는지"를
 *   알 수 없다 — 그래서 본인 건수를 실제로 조회해 보여준다.
 *
 * 읽기 전용 조회라 Repository 직접 호출이 허용된다(CLAUDE.md 아키텍처 예외).
 */

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { userRepository } from '@/repositories';
import type { WithdrawalImpact } from '@/repositories';

interface UseWithdrawalImpactResult {
  impact: WithdrawalImpact | undefined;
  isLoading: boolean;
  /** 경고를 띄울 만한 잔여가 있는가 */
  hasImpact: boolean;
}

export function useWithdrawalImpact(userId: string | undefined): UseWithdrawalImpactResult {
  const { data, isLoading } = useQuery<WithdrawalImpact>({
    queryKey: queryKeys.user.withdrawalImpact(userId ?? ''),
    queryFn: () => userRepository.getWithdrawalImpact(userId!),
    enabled: !!userId,
    // 탈퇴 화면에 머무는 동안 재조회가 잦을 이유가 없다. 진입 시 한 번이면 충분.
    staleTime: 5 * 60 * 1000,
  });

  return {
    impact: data,
    isLoading,
    hasImpact: (data?.upcomingWorkCount ?? 0) > 0 || (data?.unsettledPayrollCount ?? 0) > 0,
  };
}
