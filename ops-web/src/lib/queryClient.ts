import { QueryClient } from '@tanstack/react-query';

/**
 * realtime 콜백이 캐시를 무효화하는 구조라(설계 §5) 창 포커스 재조회를 켜 둔다 —
 * 백그라운드 탭에서 놓친 변경을 탭 복귀 시 보정한다.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 10_000,
        retry: 1,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
    },
  });
}
