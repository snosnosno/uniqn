/**
 * UNIQN Mobile - Supabase Edge Function 호출 래퍼
 *
 * `supabase.functions.invoke` 직접 호출 시 세션 복원/만료 레이스로 401 이 발생함.
 * 이 래퍼는 (1) 호출 전 만료 임박 토큰이면 preflight refresh, (2) 401 수신 시
 * 1회 refresh 후 재시도를 수행한다.
 *
 * 예외: 호출부가 `headers.Authorization` 을 명시적으로 지정하면 preflight/refresh
 * 모두 생략 — signUp 직후 등 메모리 세션 미동기 상태에서 토큰을 직접 전달하는
 * 경로는 기존 동작을 유지한다.
 */
import type { FunctionInvokeOptions } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { logger } from '@/utils/logger';

const REFRESH_SKEW_MS = 30_000;

export type InvokeEdgeFunctionOptions = Pick<FunctionInvokeOptions, 'body' | 'headers'>;

export type InvokeEdgeFunctionResult<T> = {
  data: T | null;
  error: Error | null;
};

async function ensureFreshSession(): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session || !session.expires_at) return;

  const msUntilExpiry = session.expires_at * 1000 - Date.now();
  if (msUntilExpiry > REFRESH_SKEW_MS) return;

  const { error } = await supabase.auth.refreshSession();
  if (error) {
    logger.warn('Edge Function preflight refreshSession 실패', {
      component: 'supabaseFunctions',
      error: error.message,
    });
  }
}

function isAuthError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const err = error as {
    status?: number;
    context?: { status?: number } | Response;
    message?: string;
  };
  if (err.status === 401) return true;
  const ctx = err.context;
  if (ctx && typeof ctx === 'object' && 'status' in ctx && ctx.status === 401) return true;
  if (typeof err.message === 'string') {
    return /\b401\b|unauthoriz/i.test(err.message);
  }
  return false;
}

export async function invokeEdgeFunction<T = unknown>(
  name: string,
  options: InvokeEdgeFunctionOptions = {}
): Promise<InvokeEdgeFunctionResult<T>> {
  const hasExplicitAuth = Boolean(options.headers?.Authorization);

  if (!hasExplicitAuth) {
    await ensureFreshSession();
  }

  const first = await supabase.functions.invoke<T>(name, options);
  if (!first.error) {
    return { data: first.data ?? null, error: null };
  }

  if (hasExplicitAuth || !isAuthError(first.error)) {
    return { data: null, error: first.error as Error };
  }

  logger.info('Edge Function 401 감지 - refreshSession 후 1회 재시도', {
    component: 'supabaseFunctions',
    name,
  });

  const { error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError) {
    logger.warn('401 후 refreshSession 실패', {
      component: 'supabaseFunctions',
      name,
      error: refreshError.message,
    });
    return { data: null, error: first.error as Error };
  }

  const second = await supabase.functions.invoke<T>(name, options);
  return {
    data: second.data ?? null,
    error: (second.error as Error | null) ?? null,
  };
}
