import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

/**
 * 탭 복귀(visibilitychange)·네트워크 복구(online) 때 이 대회의 ops 쿼리를 전부 무효화한다 — 설계 §5.
 * 백그라운드 탭은 브라우저가 타이머·소켓을 스로틀링해 realtime 이벤트를 놓칠 수 있다.
 * (TanStack 의 refetchOnWindowFocus 는 `focus` 기준이라 탭 전환만으로는 부족한 경우가 있어 명시한다.)
 */
export function useResyncOnReturn(tournamentId: string): void {
  const qc = useQueryClient();
  useEffect(() => {
    const resync = () => {
      void qc.invalidateQueries({
        predicate: (q) => q.queryKey[0] === 'ops' && q.queryKey.includes(tournamentId),
      });
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') resync();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('online', resync);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', resync);
    };
  }, [qc, tournamentId]);
}
