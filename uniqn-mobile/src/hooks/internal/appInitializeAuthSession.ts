import { Platform } from 'react-native';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { logger } from '@/utils/logger';

const INITIAL_AUTH_READY_TIMEOUT_MS = Platform.OS === 'web' ? 5000 : 10000;

export type AuthUserResolution =
  | { user: SupabaseUser; source: 'current' | 'event' }
  | { user: null; source: 'event' | 'timeout' };

export type InitialAuthResolution =
  | { user: SupabaseUser; source: 'current' | 'ready' }
  | { user: null; source: 'ready' | 'timeout' };

export function getCurrentAuthUser(): SupabaseUser | null {
  // Supabase doesn't have a sync currentUser; return null.
  // Callers should use the async version or authStore.
  return null;
}

export async function getCurrentAuthUserAsync(): Promise<SupabaseUser | null> {
  const { data } = await supabase.auth.getUser();
  return data.user;
}

export async function waitForAuthUser(timeoutMs = 3000): Promise<AuthUserResolution> {
  const { data } = await supabase.auth.getUser();
  if (data.user) {
    return { user: data.user, source: 'current' };
  }

  // Wait for auth state change
  return new Promise<AuthUserResolution>((resolve) => {
    let settled = false;

    const timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      subscription.unsubscribe();
      resolve({ user: null, source: 'timeout' });
    }, timeoutMs);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      subscription.unsubscribe();
      resolve({
        user: session?.user ?? null,
        source: 'event',
      });
    });
  });
}

export async function waitForInitialAuthUser(
  timeoutMs = INITIAL_AUTH_READY_TIMEOUT_MS
): Promise<InitialAuthResolution> {
  // First, try to get the current session
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session?.user) {
    return { user: session.user, source: 'current' };
  }

  // Wait for auth state to settle
  return new Promise<InitialAuthResolution>((resolve) => {
    let settled = false;

    const timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      subscription.unsubscribe();
      logger.warn('Timed out waiting for initial auth state', {
        component: 'useAppInitialize',
        timeoutMs,
        platform: Platform.OS,
      });
      resolve({ user: null, source: 'timeout' });
    }, timeoutMs);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      subscription.unsubscribe();

      if (session?.user) {
        resolve({ user: session.user, source: 'ready' });
      } else {
        resolve({ user: null, source: 'ready' });
      }
    });
  });
}
