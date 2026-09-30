/**
 * ops 변이 팩토리 — 모바일 useOpsMutations 의 반복(온라인 가드 → Service 사본 → 무효화 → 토스트)을
 * 선언형으로 줄인다. 선택적으로 **낙관적 반영**(DESIGN.md: 상태 변경 0ms)을 붙이고 실패 시 되돌린다.
 */
import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { toast } from 'sonner';
import { toUserMessage } from '@/lib/errorMessage';
import { logger } from '@/lib/logger';
import { requireOnline } from '@/lib/online';
import { useActorId } from '../useActorId';

export interface Optimistic<V, D> {
  key: QueryKey;
  update: (data: D | undefined, vars: V) => D | undefined;
}

export interface OpsMutationSpec<V, R, D = unknown> {
  /** 오프라인 차단·로그 태그 */
  op: string;
  run: (vars: V, actorId: string) => Promise<R>;
  /** 성공(또는 낙관적 실패 롤백 후) 다시 불러올 키 */
  invalidate: QueryKey[];
  /** 성공 토스트 문구. null 이면 토스트 없음(화면이 직접 안내할 때). */
  success?: (result: R, vars: V) => string | null;
  optimistic?: Optimistic<V, D>;
  onSuccess?: (result: R, vars: V) => void;
}

export function useOpsMutation<V, R, D = unknown>(spec: OpsMutationSpec<V, R, D>) {
  const qc = useQueryClient();
  const actorId = useActorId();
  return useMutation<R, unknown, V, { previous?: D }>({
    mutationKey: ['ops', spec.op],
    mutationFn: (vars) => {
      requireOnline(spec.op);
      return spec.run(vars, actorId);
    },
    onMutate: async (vars) => {
      if (!spec.optimistic) return {};
      const { key, update } = spec.optimistic;
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<D>(key);
      qc.setQueryData<D>(key, (old) => update(old, vars));
      return { previous };
    },
    onError: (error, _vars, ctx) => {
      if (spec.optimistic && ctx && 'previous' in ctx) {
        qc.setQueryData(spec.optimistic.key, ctx.previous);
      }
      logger.warn(`${spec.op} 실패`, { error: String(error) });
      toast.error(toUserMessage(error));
    },
    onSuccess: (result, vars) => {
      const message = spec.success?.(result, vars);
      if (message) toast.success(message);
      spec.onSuccess?.(result, vars);
    },
    onSettled: () => {
      // 같은 작업이 연타로 겹쳐 있으면 마지막 것이 끝날 때만 다시 불러온다 — 먼저 끝난 요청의 재조회가
      // 뒤 요청의 낙관적 값을 덮어써 깜빡이는 것을 막는다(리뷰 W4).
      if (qc.isMutating({ mutationKey: ['ops', spec.op] }) > 1) return;
      for (const key of spec.invalidate) void qc.invalidateQueries({ queryKey: key });
    },
  });
}
