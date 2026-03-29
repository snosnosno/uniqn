import { getMMKVInstance } from '@/lib/mmkvStorage';
import { logger } from '@/utils/logger';

type ProtectedAuthFlowKind = 'apple_login' | 'email_signup' | 'social_signup';

interface ProtectedAuthFlowState {
  kind: ProtectedAuthFlowKind;
  expiresAt: number;
}

const DEFAULT_FLOW_PROTECTION_TTL_MS = 2 * 60 * 1000;
const PROTECTED_AUTH_FLOW_STORAGE_KEY = 'protected-auth-flows';
const protectedAuthFlows = new Map<string, ProtectedAuthFlowState>();
let hasHydratedProtectedAuthFlows = false;

function persistProtectedAuthFlows(): void {
  try {
    const storage = getMMKVInstance();
    if (protectedAuthFlows.size === 0) {
      storage.delete(PROTECTED_AUTH_FLOW_STORAGE_KEY);
      return;
    }

    storage.set(
      PROTECTED_AUTH_FLOW_STORAGE_KEY,
      JSON.stringify(Object.fromEntries(protectedAuthFlows.entries()))
    );
  } catch (error) {
    logger.warn('Failed to persist protected auth flows', {
      component: 'protectedAuthFlow',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function hydrateProtectedAuthFlows(now = Date.now()): void {
  if (hasHydratedProtectedAuthFlows) {
    return;
  }

  hasHydratedProtectedAuthFlows = true;

  try {
    const storage = getMMKVInstance();
    const serializedState = storage.getString(PROTECTED_AUTH_FLOW_STORAGE_KEY);
    if (!serializedState) {
      return;
    }

    const parsedState = JSON.parse(serializedState) as Record<string, ProtectedAuthFlowState>;
    for (const [uid, state] of Object.entries(parsedState)) {
      if (
        typeof state?.kind === 'string' &&
        typeof state?.expiresAt === 'number' &&
        state.expiresAt > now
      ) {
        protectedAuthFlows.set(uid, state);
      }
    }
  } catch (error) {
    logger.warn('Failed to hydrate protected auth flows', {
      component: 'protectedAuthFlow',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function purgeExpiredFlows(now = Date.now()): void {
  hydrateProtectedAuthFlows(now);

  let mutated = false;
  for (const [uid, state] of protectedAuthFlows.entries()) {
    if (state.expiresAt <= now) {
      protectedAuthFlows.delete(uid);
      mutated = true;
    }
  }

  if (mutated) {
    persistProtectedAuthFlows();
  }
}

export function protectAuthFlow(
  uid: string,
  kind: ProtectedAuthFlowKind,
  ttlMs = DEFAULT_FLOW_PROTECTION_TTL_MS
): void {
  purgeExpiredFlows();
  protectedAuthFlows.set(uid, {
    kind,
    expiresAt: Date.now() + ttlMs,
  });
  persistProtectedAuthFlows();
}

export function clearProtectedAuthFlow(uid?: string | null): void {
  if (!uid) {
    return;
  }

  hydrateProtectedAuthFlows();
  protectedAuthFlows.delete(uid);
  persistProtectedAuthFlows();
}

export function getProtectedAuthFlowKind(uid?: string | null): ProtectedAuthFlowKind | null {
  if (!uid) {
    return null;
  }

  purgeExpiredFlows();
  return protectedAuthFlows.get(uid)?.kind ?? null;
}

export function isProtectedAuthFlow(uid?: string | null): boolean {
  return getProtectedAuthFlowKind(uid) !== null;
}
