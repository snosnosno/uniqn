import { Platform } from 'react-native';
import type { User as FirebaseUser } from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase';
import { logger } from '@/utils/logger';

const INITIAL_AUTH_READY_TIMEOUT_MS = Platform.OS === 'web' ? 5000 : 10000;

export type AuthUserResolution =
  | { user: FirebaseUser; source: 'current' | 'event' }
  | { user: null; source: 'event' | 'timeout' };

export type InitialAuthResolution =
  | { user: FirebaseUser; source: 'current' | 'ready' }
  | { user: null; source: 'ready' | 'timeout' };

export function getCurrentAuthUser(): FirebaseUser | null {
  return getFirebaseAuth().currentUser;
}

export async function waitForAuthUser(timeoutMs = 3000): Promise<AuthUserResolution> {
  const auth = getFirebaseAuth();

  if (auth.currentUser) {
    return { user: auth.currentUser, source: 'current' };
  }

  return new Promise<AuthUserResolution>((resolve) => {
    let unsubscribe: (() => void) | null = null;

    const timeoutId = setTimeout(() => {
      unsubscribe?.();
      resolve({ user: null, source: 'timeout' });
    }, timeoutMs);

    unsubscribe = auth.onAuthStateChanged((user) => {
      clearTimeout(timeoutId);
      unsubscribe?.();
      resolve({
        user,
        source: 'event',
      });
    });
  });
}

export async function waitForInitialAuthUser(
  timeoutMs = INITIAL_AUTH_READY_TIMEOUT_MS
): Promise<InitialAuthResolution> {
  const auth = getFirebaseAuth();

  if (auth.currentUser) {
    return { user: auth.currentUser, source: 'current' };
  }

  if (typeof auth.authStateReady !== 'function') {
    const fallbackResolution = await waitForAuthUser(timeoutMs);

    if (fallbackResolution.user) {
      return {
        user: fallbackResolution.user,
        source: fallbackResolution.source === 'current' ? 'current' : 'ready',
      };
    }

    return {
      user: null,
      source: fallbackResolution.source === 'timeout' ? 'timeout' : 'ready',
    };
  }

  let timedOut = false;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  try {
    await Promise.race([
      auth.authStateReady(),
      new Promise<void>((resolve) => {
        timeoutId = setTimeout(() => {
          timedOut = true;
          resolve();
        }, timeoutMs);
      }),
    ]);
  } catch (error) {
    logger.warn('authStateReady failed during initialization, falling back to auth observer', {
      component: 'useAppInitialize',
      error: error instanceof Error ? error.message : String(error),
    });

    const fallbackResolution = await waitForAuthUser(timeoutMs);

    if (fallbackResolution.user) {
      return {
        user: fallbackResolution.user,
        source: fallbackResolution.source === 'current' ? 'current' : 'ready',
      };
    }

    return {
      user: null,
      source: fallbackResolution.source === 'timeout' ? 'timeout' : 'ready',
    };
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }

  if (auth.currentUser) {
    return { user: auth.currentUser, source: 'ready' };
  }

  if (timedOut) {
    logger.warn('Timed out waiting for initial auth state', {
      component: 'useAppInitialize',
      timeoutMs,
      platform: Platform.OS,
    });
    return { user: null, source: 'timeout' };
  }

  return { user: null, source: 'ready' };
}
