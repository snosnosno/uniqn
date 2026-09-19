import { useEffect, useRef } from 'react';
import { queryClient } from '@/lib/queryClient';
import { useDeepLinkSetup } from '@/hooks/useDeepLink';
import { useNavigationTracking } from '@/hooks/useNavigationTracking';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { reportAppSessionStart } from '@/services/observability/analyticsService';
import { logger } from '@/utils/logger';

export default function AuthenticatedRuntime() {
  useNavigationTracking();
  useDeepLinkSetup();

  // 롤아웃 계기판(testgap-01) — 이 컴포넌트는 `isAuthenticated` 일 때만 마운트되므로
  // 여기가 "세션이 성립한 직후"를 뜻하는 유일한 지점이다. anon 은 RLS 상 이 이벤트를
  // 넣을 수 없으니 로그인 이전에 부르면 조용히 버려진다.
  useEffect(() => {
    reportAppSessionStart();
  }, []);

  const { isOnline } = useNetworkStatus();
  const prevOnlineRef = useRef<boolean | null>(null);

  useEffect(() => {
    const wasOnline = prevOnlineRef.current;
    prevOnlineRef.current = isOnline;

    if (wasOnline === null) {
      return;
    }

    let cancelled = false;

    const syncRuntime = async () => {
      if (!wasOnline && isOnline) {
        logger.info('Network restored - reattaching authenticated runtime');

        const [{ RealtimeManager }, tokenRefreshService, { refreshQueriesAfterReconnect }] =
          await Promise.all([
            import('@/shared/realtime/RealtimeManager'),
            import('@/services/observability/tokenRefreshService'),
            import('@/services/offline/reconnectSyncService'),
          ]);

        if (cancelled) {
          return;
        }

        RealtimeManager.onNetworkReconnect();
        tokenRefreshService.onNetworkReconnect();
        await refreshQueriesAfterReconnect(queryClient);
        return;
      }

      if (wasOnline && !isOnline) {
        logger.info('Network lost - detaching authenticated runtime');

        const { RealtimeManager } = await import('@/shared/realtime/RealtimeManager');

        if (cancelled) {
          return;
        }

        RealtimeManager.onNetworkDisconnect();
      }
    };

    void syncRuntime();

    return () => {
      cancelled = true;
    };
  }, [isOnline]);

  return null;
}
