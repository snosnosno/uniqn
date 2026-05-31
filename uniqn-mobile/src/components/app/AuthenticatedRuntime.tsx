import { useEffect, useRef } from 'react';
import { queryClient } from '@/lib/queryClient';
import { useDeepLinkSetup } from '@/hooks/useDeepLink';
import { useNavigationTracking } from '@/hooks/useNavigationTracking';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useRevenueCatSession } from '@/hooks/useRevenueCatSession';
import { logger } from '@/utils/logger';

export default function AuthenticatedRuntime() {
  useNavigationTracking();
  useDeepLinkSetup();
  useRevenueCatSession();

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
