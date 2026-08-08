/**
 * ops 스태프별 근태 대상 work_log 해석 훅 (결함 ⑦-2).
 *
 * 로스터(useOpsStaff)와 **별도 쿼리**다. 로스터는 `ops_staff` 를 보지만 이 훅은 `work_logs` 의
 * 상태(취소·정산 확정)까지 반영해야 하고, 그쪽은 ops 테이블을 건드리지 않고도 바뀐다.
 *
 * 🔑 해석은 서비스 → Repository → SECDEF RPC 를 경유한다. 평범한 SELECT 로 바꾸면
 *    RLS 의 "0건"(안 보임)과 "행 없음"을 구분하지 못해 화면이 거짓 안내를 띄운다.
 */
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { queryKeys, cachingPolicies } from '@/lib/queryClient';
import { resolveWorkLogs } from '@/services/ops/opsStaffService';
import type { OpsStaffWorkLogLink } from '@/types/ops';

export function useOpsStaffWorkLogs(
  tournamentId: string | undefined,
  actorId: string | undefined
): UseQueryResult<OpsStaffWorkLogLink[]> {
  return useQuery({
    queryKey: tournamentId
      ? queryKeys.ops.staffWorkLogs(tournamentId)
      : [...queryKeys.ops.all, 'staffWorkLogs', 'none'],
    queryFn: () => resolveWorkLogs(tournamentId as string, actorId as string),
    enabled: !!tournamentId && !!actorId,
    staleTime: cachingPolicies.realtime,
  });
}
