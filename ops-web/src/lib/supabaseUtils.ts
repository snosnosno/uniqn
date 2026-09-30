/**
 * Supabase 유틸 (웹 소유) — 모바일 `uniqn-mobile/src/utils/supabase.ts` 중 ops 사본이 쓰는 것만.
 *
 * 동기화 사본(Repository·opsRpcError)이 `@/utils/supabase` 대신 이 모듈을 쓴다
 * (scripts/sync-ops-core.mjs REMAP). 모바일 원본은 RN 싱글턴·로거·타임아웃 마커에 묶여 있어 통째로 옮기지 않고,
 * **분류표·toCamelCase 는 사본(`core/supabaseTables.ts`)에서 가져온다** — 모바일이 바꾸면 --check 가 드러낸다.
 *
 * 빠진 모바일 특례: MAX_CAPACITY(지원 정원)·work_logs 시간형식·SEARCH_RATE_LIMITED — ops RPC 와 무관.
 */
import {
  AppError,
  AuthError,
  ERROR_CODES,
  NetworkError,
  PermissionError,
  isAppError,
} from '@/core/errors/AppError';
import { isNetworkErrorMessage as isMobileNetworkMessage } from '@/core/errors/errorUtils';
import { POSTGREST_ERROR_MAP } from '@/core/supabaseTables';

export { toCamelCase } from '@/core/supabaseTables';

export interface SupabaseErrorContext {
  operation: string;
  table?: string;
}

interface PostgrestErrorLike {
  code: string;
  message: string;
}

/**
 * 브라우저 전용 fetch 단절 문구. 모바일 패턴(RN)에 없는 것만 더한다.
 * - Chrome/Edge: `TypeError: Failed to fetch` (이미 'fetch' 가 없어 모바일 패턴에 안 걸린다)
 * - Safari(iPad 현장 주력): `TypeError: Load failed`
 * - Firefox: `NetworkError when attempting to fetch resource.` (모바일 'network' 에 걸림)
 */
const BROWSER_NETWORK_PATTERNS = ['failed to fetch', 'load failed'];

export function isNetworkErrorMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return isMobileNetworkMessage(message) || BROWSER_NETWORK_PATTERNS.some((p) => lower.includes(p));
}

function isPostgrestError(error: unknown): error is PostgrestErrorLike {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    typeof (error as PostgrestErrorLike).message === 'string'
  );
}

export function handleSupabaseError(error: unknown, context: SupabaseErrorContext): never {
  if (isAppError(error)) throw error;

  const metadata = { ...context };

  if (isPostgrestError(error)) {
    const base = {
      message: error.message,
      originalError: new Error(error.message),
      metadata: { ...metadata, supabaseCode: error.code },
    };
    const mapping = POSTGREST_ERROR_MAP[error.code];
    if (mapping?.category === 'permission') throw new PermissionError(mapping.code, base);
    if (mapping?.category === 'auth') throw new AuthError(mapping.code, base);
    if (mapping) {
      throw new AppError({
        code: mapping.code,
        category: mapping.category as AppError['category'],
        ...base,
      });
    }
    if (isNetworkErrorMessage(error.message)) {
      throw new NetworkError(ERROR_CODES.NETWORK_REQUEST_FAILED, base);
    }
    throw new AppError({ code: ERROR_CODES.UNKNOWN, category: 'infrastructure', ...base });
  }

  // TypeError 뿐 아니라 일반 Error 도 본다 — fetch 래퍼가 에러 클래스를 바꿔 던지는 경우가 있다.
  if (error instanceof Error && isNetworkErrorMessage(error.message)) {
    throw new NetworkError(ERROR_CODES.NETWORK_OFFLINE, {
      message: error.message,
      originalError: error,
      metadata,
    });
  }

  const originalError = error instanceof Error ? error : new Error(String(error));
  throw new AppError({
    code: ERROR_CODES.UNKNOWN,
    category: 'unknown',
    message: originalError.message,
    originalError,
    metadata,
  });
}
