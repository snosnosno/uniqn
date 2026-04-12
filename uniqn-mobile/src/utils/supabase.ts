/**
 * UNIQN Mobile - Supabase Repository 유틸리티
 *
 * @description Supabase PostgREST/Realtime 작업을 위한 유틸리티 함수
 * @version 1.0.0
 *
 * Firebase의 firestore.ts + queryBuilder.ts를 대체하는 Supabase용 헬퍼.
 * Repository 레이어에서 사용하며, 에러 변환 / RPC / 페이지네이션 / 배치 / Realtime /
 * camelCase↔snake_case 변환을 제공한다.
 */

import {
  type PostgrestError,
  type RealtimePostgresChangesPayload,
  type RealtimeChannel,
} from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { logger } from '@/utils/logger';
import {
  AppError,
  BusinessError,
  NetworkError,
  PermissionError,
  AuthError as AppAuthError,
  ERROR_CODES,
  isAppError,
} from '@/errors';
import type { ZodType } from 'zod';
import type { PaginatedResult, UnsubscribeFn } from '@/types/common';

// ============================================================================
// Types
// ============================================================================

/** handleSupabaseError에 전달하는 작업 컨텍스트 */
export interface SupabaseErrorContext {
  operation: string;
  table?: string;
}

// ============================================================================
// 1. Error Conversion
// ============================================================================

/**
 * PostgreSQL/Supabase 에러 코드 → AppError 에러 코드 매핑
 *
 * @see https://www.postgresql.org/docs/current/errcodes-appendix.html
 */
const POSTGREST_ERROR_MAP: Record<string, { code: string; category: string }> = {
  // 인증/권한
  '42501': { code: ERROR_CODES.INFRA_PERMISSION_DENIED, category: 'permission' },
  PGRST301: { code: ERROR_CODES.AUTH_SESSION_EXPIRED, category: 'auth' },
  // 데이터 미존재
  PGRST116: { code: ERROR_CODES.INFRA_NOT_FOUND, category: 'infrastructure' },
  // 중복 키 (unique violation)
  '23505': { code: ERROR_CODES.VALIDATION_SCHEMA, category: 'validation' },
  // 외래 키 위반
  '23503': { code: ERROR_CODES.VALIDATION_SCHEMA, category: 'validation' },
  // NOT NULL 위반
  '23502': { code: ERROR_CODES.VALIDATION_REQUIRED, category: 'validation' },
  // CHECK 위반
  '23514': { code: ERROR_CODES.VALIDATION_SCHEMA, category: 'validation' },
  // 함수 미존재
  '42883': { code: ERROR_CODES.UNKNOWN, category: 'unknown' },
  // rate limit (Supabase 자체)
  '54000': { code: ERROR_CODES.INFRA_QUOTA_EXCEEDED, category: 'infrastructure' },
};

/**
 * Supabase 에러(PostgrestError, AuthError 등)를 AppError로 변환하고 throw
 *
 * @description PostgREST 에러 코드를 분석하여 적절한 AppError 서브클래스로 변환한다.
 *              이미 AppError인 경우 그대로 re-throw 한다.
 * @param error - catch 블록에서 받은 에러
 * @param context - 작업명과 테이블명
 * @throws {AppError} 항상 throw한다 (반환 타입 never)
 *
 * @example
 * ```typescript
 * const { data, error } = await supabase.from('users').select();
 * if (error) handleSupabaseError(error, { operation: 'getUsers', table: 'users' });
 * ```
 */
export function handleSupabaseError(error: unknown, context: SupabaseErrorContext): never {
  // 이미 AppError면 re-throw
  if (isAppError(error)) {
    throw error;
  }

  const metadata = { ...context, supabaseCode: '' };

  // PostgrestError 형태 ({ code, message, details, hint })
  if (isPostgrestError(error)) {
    metadata.supabaseCode = error.code;
    const mapping = POSTGREST_ERROR_MAP[error.code];

    if (mapping) {
      if (mapping.category === 'permission') {
        throw new PermissionError(mapping.code, {
          message: error.message,
          originalError: new Error(error.message),
          metadata,
        });
      }
      if (mapping.category === 'auth') {
        throw new AppAuthError(mapping.code, {
          message: error.message,
          originalError: new Error(error.message),
          metadata,
        });
      }
      throw new AppError({
        code: mapping.code,
        category: mapping.category as AppError['category'],
        message: error.message,
        originalError: new Error(error.message),
        metadata,
      });
    }

    // 매핑 없는 PostgrestError
    throw new AppError({
      code: ERROR_CODES.UNKNOWN,
      category: 'infrastructure',
      message: error.message,
      originalError: new Error(error.message),
      metadata,
    });
  }

  // 네트워크 에러 (fetch 실패 등)
  if (
    error instanceof TypeError &&
    (error.message.includes('fetch') || error.message.includes('network'))
  ) {
    throw new NetworkError(ERROR_CODES.NETWORK_OFFLINE, {
      message: error.message,
      originalError: error,
      metadata,
    });
  }

  // 일반 Error
  const originalError = error instanceof Error ? error : new Error(String(error));
  throw new AppError({
    code: ERROR_CODES.UNKNOWN,
    category: 'unknown',
    message: originalError.message,
    originalError,
    metadata,
  });
}

/** PostgrestError 형태 여부를 판별 */
function isPostgrestError(error: unknown): error is PostgrestError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    typeof (error as PostgrestError).message === 'string'
  );
}

// ============================================================================
// 2. Transaction Helper via RPC
// ============================================================================

/**
 * PostgreSQL 함수를 RPC로 호출
 *
 * @description Supabase는 클라이언트 측 트랜잭션을 지원하지 않으므로,
 *              다중 문서 변경이 필요한 경우 서버 측 함수(plpgsql)를 RPC로 호출한다.
 *              단순 CRUD는 PostgREST 호출이 이미 원자적이므로 RPC 불필요.
 * @param functionName - Supabase에 등록된 함수 이름
 * @param params - 함수 파라미터 (snake_case)
 * @returns 함수 반환값
 *
 * @example
 * ```typescript
 * const result = await runRpc<{ success: boolean }>(
 *   'apply_to_job',
 *   { p_user_id: userId, p_job_id: jobId }
 * );
 * ```
 */
export async function runRpc<T>(functionName: string, params: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(functionName, params);
  if (error) {
    handleSupabaseError(error, { operation: `rpc:${functionName}` });
  }
  return data as T;
}

// ============================================================================
// 3. Pagination Helper
// ============================================================================

/**
 * 범위 기반 페이지네이션 쿼리 실행
 *
 * @description Firestore의 cursor 기반(startAfter) 페이지네이션을 Supabase의
 *              range 기반 페이지네이션으로 대체한다. pageSize + 1 개를 조회하여
 *              hasMore를 판별하고, PaginatedResult 형태로 반환한다.
 * @param table - 테이블 이름
 * @param options - 정렬, 필터, 페이지 크기, 커서 옵션
 * @returns PaginatedResult<T> (items, lastDoc, hasMore)
 *
 * @example
 * ```typescript
 * const result = await paginatedQuery<User>('users', {
 *   select: 'id, name, email',
 *   orderBy: 'created_at',
 *   ascending: false,
 *   pageSize: 20,
 *   cursor: lastCreatedAt,
 *   filters: (q) => q.eq('is_active', true),
 * });
 * ```
 */
export async function paginatedQuery<T extends Record<string, unknown>>(
  table: string,
  options: {
    select?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    filters?: (query: any) => any;
    orderBy: string;
    ascending?: boolean;
    pageSize: number;
    cursor?: unknown;
  }
): Promise<PaginatedResult<T>> {
  const { select = '*', filters, orderBy, ascending = false, pageSize, cursor } = options;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = supabase.from(table).select(select);

  // 필터 적용
  if (filters) {
    query = filters(query);
  }

  // 커서 기반 페이지네이션: 정렬 방향에 따라 gt/lt
  if (cursor !== undefined && cursor !== null) {
    query = ascending ? query.gt(orderBy, cursor) : query.lt(orderBy, cursor);
  }

  // 정렬 + limit (pageSize + 1로 hasMore 판별)
  query = query.order(orderBy, { ascending }).limit(pageSize + 1);

  const { data, error } = await query;

  if (error) {
    handleSupabaseError(error, { operation: 'paginatedQuery', table });
  }

  const rows = (data ?? []) as T[];
  const hasMore = rows.length > pageSize;
  const items = hasMore ? rows.slice(0, pageSize) : rows;
  const lastItem = items.length > 0 ? items[items.length - 1] : null;
  const lastDoc = lastItem ? lastItem[orderBy] : null;

  return { items, lastDoc, hasMore };
}

// ============================================================================
// 4. Batch Operations
// ============================================================================

/**
 * 다수 행 일괄 삽입
 *
 * @description PostgREST는 배열 insert를 네이티브로 지원하므로 청킹 불필요.
 *              onConflict 옵션으로 upsert 동작도 가능.
 * @param table - 테이블 이름
 * @param items - 삽입할 행 배열 (snake_case 필드)
 * @param options - onConflict 컬럼 지정 시 upsert
 * @returns 삽입된 행 배열
 *
 * @example
 * ```typescript
 * const inserted = await batchInsert('notifications', [
 *   { user_id: '1', message: '알림1' },
 *   { user_id: '2', message: '알림2' },
 * ]);
 * ```
 */
export async function batchInsert<T extends Record<string, unknown>>(
  table: string,
  items: T[],
  options?: { onConflict?: string }
): Promise<T[]> {
  if (items.length === 0) return [];

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const query = options?.onConflict
    ? supabase
        .from(table)
        .upsert(items as any, { onConflict: options.onConflict })
        .select()
    : supabase
        .from(table)
        .insert(items as any)
        .select();
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const { data, error } = await query;

  if (error) {
    handleSupabaseError(error, { operation: 'batchInsert', table });
  }

  return (data ?? []) as T[];
}

/**
 * 다수 행 개별 업데이트
 *
 * @description PostgREST는 배치 업데이트를 지원하지 않으므로 Promise.all로 병렬 처리.
 *              대량 업데이트가 필요하면 RPC(plpgsql)를 권장.
 * @param table - 테이블 이름
 * @param items - { id, updates } 배열
 *
 * @example
 * ```typescript
 * await batchUpdate('work_logs', [
 *   { id: 'abc', updates: { status: 'completed' } },
 *   { id: 'def', updates: { status: 'completed' } },
 * ]);
 * ```
 */
export async function batchUpdate<T extends Record<string, unknown>>(
  table: string,
  items: readonly { id: string; updates: Partial<T> }[]
): Promise<void> {
  if (items.length === 0) return;

  const results = await Promise.all(
    items.map(({ id, updates }) =>
      supabase
        .from(table)
        .update(updates as Record<string, unknown>)
        .eq('id', id)
    )
  );

  const errors = results
    .map((r, i) => (r.error ? { id: items[i].id, error: r.error } : null))
    .filter(Boolean);

  if (errors.length > 0) {
    const firstError = errors[0]!;
    logger.warn('batchUpdate 부분 실패', {
      table,
      totalItems: items.length,
      failedCount: errors.length,
      failedIds: errors.map((e) => e!.id),
    });
    handleSupabaseError(firstError.error, {
      operation: `batchUpdate (${errors.length}/${items.length} failed)`,
      table,
    });
  }
}

// ============================================================================
// 5. Update Assertion Helper
// ============================================================================

/**
 * Supabase update 결과에서 실제 변경된 행 수 검증
 *
 * @description PostgREST는 조건부 update가 0 rows를 매칭해도 error: null을 반환.
 *              이 함수로 실제 변경 여부를 확인하여 silent no-op을 방지한다.
 * @throws BusinessError 변경된 행이 없을 때
 */
export function assertUpdated(
  data: unknown[] | null,
  context: { operation: string; table: string; id?: string }
): void {
  if (!data || data.length === 0) {
    throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
      message: `${context.operation}: 변경된 행 없음 (이미 처리되었거나 조건 불일치)`,
      userMessage: '이미 처리된 요청이거나 상태가 변경되었습니다. 새로고침 후 다시 시도해 주세요.',
      metadata: { table: context.table, id: context.id },
    });
  }
}

// ============================================================================
// 6. Realtime Subscription Helper
// ============================================================================

/**
 * 채널별 subscriber 목록 (deduplication용)
 *
 * 같은 channelName으로 여러 번 createRealtimeSubscription이 호출되면
 * Supabase 채널은 하나만 만들고, 콜백만 subscriber 배열에 추가한다.
 * ref-count가 0이 되면 채널을 완전히 제거한다.
 */
interface RealtimeChannelEntry {
  channel: RealtimeChannel;
  subscribers: ((payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void)[];
  errorHandlers: ((status: string) => void)[];
  refCount: number;
}

const realtimeChannelRegistry = new Map<string, RealtimeChannelEntry>();

/**
 * 테이블의 Realtime 변경사항 구독 생성 (채널 중복 방지)
 *
 * @description postgres_changes 이벤트를 구독하고, 해제 함수를 반환한다.
 *              같은 table+filter 조합은 Supabase 채널을 하나만 생성하고
 *              콜백을 공유한다 (ref-counting). 마지막 구독자가 해제하면 채널도 제거된다.
 * @param table - 구독할 테이블 이름
 * @param filter - PostgREST 필터 (예: 'user_id=eq.abc'). undefined면 전체
 * @param callback - 변경 이벤트 핸들러
 * @param onError - 채널 에러 핸들러 (선택)
 * @returns 구독 해제 함수 (UnsubscribeFn)
 *
 * @example
 * ```typescript
 * const unsubscribe = createRealtimeSubscription(
 *   'notifications',
 *   'user_id=eq.abc123',
 *   (payload) => {
 *     if (payload.eventType === 'INSERT') addNotification(payload.new);
 *   }
 * );
 * // 정리 시
 * unsubscribe();
 * ```
 */
export function createRealtimeSubscription(
  table: string,
  filter: string | undefined,
  callback: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void,
  onError?: (status: string) => void
): UnsubscribeFn {
  const channelName = `realtime:${table}:${filter ?? 'all'}`;

  const existing = realtimeChannelRegistry.get(channelName);

  if (existing) {
    // 기존 채널에 subscriber만 추가
    existing.subscribers.push(callback);
    if (onError) {
      existing.errorHandlers.push(onError);
    }
    existing.refCount++;

    if (__DEV__) {
      logger.debug('Realtime 채널 재사용 (subscriber 추가)', {
        channelName,
        refCount: existing.refCount,
      });
    }

    return () => {
      removeRealtimeSubscriber(channelName, callback, onError);
    };
  }

  // registry에 없지만 Supabase client에 동일 이름의 채널이 남아있으면 먼저 제거
  // (페이지 이동/HMR 등으로 registry는 초기화됐지만 클라이언트 채널은 살아있는 경우)
  const orphanChannel = supabase
    .getChannels()
    // supabase.channel(name)은 topic을 전달한 이름 그대로 저장하므로 첫 번째 조건만 사용.
    // (realtime:${channelName}은 이중 prefix가 되어 실제로 매칭되지 않음)
    .find((ch) => ch.topic === channelName);
  if (orphanChannel) {
    logger.warn('Realtime 고아 채널 제거 후 재생성', { channelName });
    supabase.removeChannel(orphanChannel).catch(() => {
      /* 무시 */
    });
  }

  // 새 채널 생성: 모든 subscriber에게 이벤트를 fan-out하는 단일 핸들러 등록
  const channelConfig = {
    event: '*' as const,
    schema: 'public' as const,
    table,
    ...(filter ? { filter } : {}),
  };

  const entry: RealtimeChannelEntry = {
    channel: null as unknown as RealtimeChannel, // 아래에서 할당
    subscribers: [callback],
    errorHandlers: onError ? [onError] : [],
    refCount: 1,
  };

  const fanOutCallback = (
    payload: RealtimePostgresChangesPayload<Record<string, unknown>>
  ): void => {
    const current = realtimeChannelRegistry.get(channelName);
    if (!current) return;
    for (const sub of current.subscribers) {
      sub(payload);
    }
  };

  const channel: RealtimeChannel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      channelConfig,
      fanOutCallback as (payload: RealtimePostgresChangesPayload<{ [key: string]: string }>) => void
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        logger.info('Realtime 구독 시작', { table, filter });
      } else if (status === 'CHANNEL_ERROR') {
        logger.error('Realtime 채널 에러', new Error(`CHANNEL_ERROR: ${table}`), { table, filter });
        const current = realtimeChannelRegistry.get(channelName);
        if (current) {
          for (const handler of current.errorHandlers) {
            handler('CHANNEL_ERROR');
          }
        }
      } else if (status === 'TIMED_OUT') {
        logger.warn('Realtime 구독 타임아웃', { table, filter });
        const current = realtimeChannelRegistry.get(channelName);
        if (current) {
          for (const handler of current.errorHandlers) {
            handler('TIMED_OUT');
          }
        }
      } else if (status === 'CLOSED') {
        logger.info('Realtime 채널 종료', { table, filter });
      }
    });

  entry.channel = channel;
  realtimeChannelRegistry.set(channelName, entry);

  return () => {
    removeRealtimeSubscriber(channelName, callback, onError);
  };
}

/**
 * subscriber를 제거하고 마지막 subscriber라면 채널도 해제한다.
 */
function removeRealtimeSubscriber(
  channelName: string,
  callback: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void,
  onError?: (status: string) => void
): void {
  const entry = realtimeChannelRegistry.get(channelName);
  if (!entry) return;

  entry.subscribers = entry.subscribers.filter((s) => s !== callback);
  if (onError) {
    entry.errorHandlers = entry.errorHandlers.filter((h) => h !== onError);
  }
  entry.refCount--;

  if (__DEV__) {
    logger.debug('Realtime subscriber 제거', { channelName, refCount: entry.refCount });
  }

  if (entry.refCount <= 0) {
    supabase.removeChannel(entry.channel);
    realtimeChannelRegistry.delete(channelName);

    if (__DEV__) {
      logger.debug('Realtime 채널 제거 (마지막 subscriber)', { channelName });
    }
  }
}

// ============================================================================
// 7. camelCase ↔ snake_case Conversion
// ============================================================================

/**
 * camelCase 키를 snake_case로 변환
 *
 * @description TypeScript 객체(camelCase)를 PostgreSQL 컬럼(snake_case)으로 변환.
 *              Repository 레이어의 쓰기 작업에서 사용.
 * @param obj - camelCase 키를 가진 객체
 * @returns snake_case 키를 가진 새 객체 (원본 불변)
 *
 * @example
 * ```typescript
 * toSnakeCase({ userId: '1', createdAt: new Date() })
 * // → { user_id: '1', created_at: Date }
 * ```
 */
export function toSnakeCase(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    const snakeKey = key
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
      .replace(/([a-z\d])([A-Z])/g, '$1_$2')
      .toLowerCase();
    result[snakeKey] = obj[key];
  }
  return result;
}

/**
 * snake_case 키를 camelCase로 변환
 *
 * @description PostgreSQL 행(snake_case)을 TypeScript 객체(camelCase)로 변환.
 *              Repository 레이어의 읽기 작업에서 사용.
 * @param obj - snake_case 키를 가진 객체
 * @returns camelCase 키를 가진 새 객체 (원본 불변)
 *
 * @example
 * ```typescript
 * toCamelCase<User>({ user_id: '1', created_at: '2026-01-01' })
 * // → { userId: '1', createdAt: '2026-01-01' }
 * ```
 */
const KNOWN_ACRONYMS: Record<string, string> = {
  Url: 'URL',
  Urls: 'URLs',
};

export function toCamelCase<T>(obj: Record<string, unknown>): T {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    let camelKey = key.replace(/_([a-z])/g, (_, ch: string) => ch.toUpperCase());
    // Restore known acronyms at end of key (e.g., photoUrl → photoURL)
    for (const [suffix, replacement] of Object.entries(KNOWN_ACRONYMS)) {
      if (camelKey.endsWith(suffix) && camelKey !== suffix.toLowerCase()) {
        camelKey = camelKey.slice(0, -suffix.length) + replacement;
        break;
      }
    }
    result[camelKey] = obj[key];
  }
  return result as T;
}

// ============================================================================
// 8. Json Field Validation
// ============================================================================

/**
 * Json 필드를 Zod 스키마로 안전하게 파싱
 *
 * @description DB의 Json 컬럼 값을 Zod 스키마로 검증하여 타입 안전성 확보.
 *              파싱 실패 시 fallback 값을 반환하고 경고 로그를 남긴다.
 * @param schema - Zod 스키마
 * @param data - 검증 대상 데이터 (DB에서 읽은 Json 값)
 * @param fallback - 파싱 실패 시 반환할 기본값
 * @param context - 로그에 포함할 컨텍스트 문자열 (예: 'board_post.image_attachments')
 * @returns 파싱 성공 시 타입 안전한 값, 실패 시 fallback
 */
export function safeParseJson<T>(
  schema: ZodType<T>,
  data: unknown,
  fallback: T,
  context?: string
): T {
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  logger.warn('Json 필드 파싱 실패', { context, errors: result.error.issues.slice(0, 3) });
  return fallback;
}
