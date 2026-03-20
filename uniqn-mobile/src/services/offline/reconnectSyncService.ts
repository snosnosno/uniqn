import { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { logger } from '@/utils/logger';

let reconnectRefreshPromise: Promise<void> | null = null;

async function invalidateInOrder(queryClient: QueryClient, queryKey: readonly unknown[]) {
  await queryClient.invalidateQueries({
    queryKey,
    refetchType: 'active',
  });
}

export function refreshQueriesAfterReconnect(queryClient: QueryClient): Promise<void> {
  if (reconnectRefreshPromise) {
    return reconnectRefreshPromise;
  }

  reconnectRefreshPromise = (async () => {
    const startedAt = Date.now();

    try {
      await invalidateInOrder(queryClient, queryKeys.user.all);
      await invalidateInOrder(queryClient, queryKeys.notifications.all);
      await invalidateInOrder(queryClient, queryKeys.applications.all);
      await invalidateInOrder(queryClient, queryKeys.schedules.all);
      await invalidateInOrder(queryClient, queryKeys.workLogs.all);
      await invalidateInOrder(queryClient, queryKeys.jobPostings.all);

      logger.info('reconnect_refresh_duration', {
        component: 'reconnectSyncService',
        durationMs: Date.now() - startedAt,
      });
    } finally {
      reconnectRefreshPromise = null;
    }
  })();

  return reconnectRefreshPromise;
}
