import type { User as SupabaseUser } from '@supabase/supabase-js';
import { getUserProfile } from '@/services/auth';
import { logger } from '@/utils/logger';
import { retryWithBackoff } from '@/utils/retry';
import { describeError, importWithFallback } from './appInitializeImports';

export function isFatalAuthError(error: unknown): boolean {
  const errorMessage = (error as { message?: string } | undefined)?.message ?? '';
  return (
    errorMessage.includes('user_not_found') ||
    errorMessage.includes('token_expired') ||
    errorMessage.includes('user_banned')
  );
}

export function getRoleFromUser(user: SupabaseUser): string | null {
  const role = user.app_metadata?.role;
  return typeof role === 'string' ? role : null;
}

export function shouldSynchronizeClaims(
  profileRole: string | null | undefined,
  tokenRole: string | null
) {
  return typeof profileRole === 'string' && profileRole.length > 0 && tokenRole !== profileRole;
}

export async function loadLatestProfile(uid: string) {
  const result = await retryWithBackoff(
    async () => {
      const profile = await getUserProfile(uid);
      if (!profile) {
        throw new Error('Profile not found');
      }
      return profile;
    },
    {
      maxRetries: 3,
      initialDelayMs: 1000,
      backoffMultiplier: 2,
      component: 'useAppInitialize',
      operationName: 'loadUserProfile',
    }
  );

  return result.data;
}

export async function initializeUnreadCount(uid: string): Promise<number> {
  const { getUnreadCounterFromCache } = await importWithFallback(
    () => import('@/services/notifications/notificationService'),
    '@/services/notifications/notificationService'
  );
  const cachedCount = await getUnreadCounterFromCache(uid);

  if (cachedCount !== null) {
    logger.info('Loaded unread count from cache', {
      component: 'useAppInitialize',
      uid,
      unreadCount: cachedCount,
      source: 'counter_document',
    });
    return cachedCount;
  }

  const { getMMKVInstance } = await importWithFallback(
    () => import('@/lib/mmkvStorage'),
    '@/lib/mmkvStorage'
  );
  const storage = getMMKVInstance();
  const debounceKey = `counter_init_${uid}`;
  const lastInitTime = parseInt(storage.getString(debounceKey) ?? '0', 10) || 0;
  const now = Date.now();
  const debounceMs = 10_000;

  if (now - lastInitTime < debounceMs) {
    logger.info('Skipped unread counter initialization due to debounce window', {
      component: 'useAppInitialize',
      uid,
      elapsedMs: now - lastInitTime,
    });
    return 0;
  }

  const { invokeEdgeFunction } = await importWithFallback(
    () => import('@/lib/supabaseFunctions'),
    '@/lib/supabaseFunctions'
  );

  storage.set(debounceKey, String(now));

  try {
    const { data: result, error } = await invokeEdgeFunction<{ unreadCount: number }>(
      'initialize-unread-counter'
    );
    if (error) throw error;
    logger.info('Initialized unread count from server', {
      component: 'useAppInitialize',
      uid,
      unreadCount: result?.unreadCount ?? 0,
      source: 'calculated',
    });
    return result?.unreadCount ?? 0;
  } catch (error) {
    storage.delete(debounceKey);
    logger.warn('Failed to initialize unread count, falling back to zero', {
      component: 'useAppInitialize',
      uid,
      error: describeError(error),
    });
    return 0;
  }
}
