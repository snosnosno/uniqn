/**
 * Supabase 데이터 평면 타임아웃 (감사 err-01).
 *
 * ## 왜 여기인가
 * `withTimeout` 은 이미 있었지만 auth 3서비스에만 붙어 있었고, `src/repositories/` 에는
 * **0건**이었다. 리포지토리는 `supabase.from(...)`/`supabase.rpc(...)` 를 47개 파일에서
 * 330회 직접 `await` 한다 — 공통 래퍼가 없다. `handleSupabaseError` 는 이미 실패한 뒤에
 * 부르는 변환기라 감쌀 대상이 아니고, 진짜 래퍼인 `runRpc` 는 5개 파일만 쓴다.
 *
 * 그래서 호출부 330곳을 고치는 대신 **클라이언트가 쓰는 fetch 자체**를 바꾼다.
 * 이 한 지점이 PostgREST·RPC·Storage·Auth 전부를 덮는다.
 *
 * ## Promise.race 가 아니라 AbortController 인 이유
 * `withTimeout` 은 race 라서 진 쪽을 버릴 뿐 요청은 계속 살아 있다(소켓·배터리 낭비).
 * 여기서는 실제로 요청을 끊는다.
 *
 * ## 마커로 판별하는 이유 (postgrest-js 실측)
 * postgrest-js 는 fetch 예외를 잡아 `{ message, details, hint, code }` 로 바꾸는데,
 * **`code` 를 항상 빈 문자열로 버린다**(dist/index.cjs 의 fetch catch 분기).
 * 살아남는 건 `` `${err.name}: ${err.message}` `` 형태의 message 뿐이다.
 * 그래서 에러 코드가 아니라 **메시지 마커**로 식별해야 한다.
 */

/** 이 마커가 message 에 있으면 우리가 끊은 요청이다. `handleSupabaseError` 가 E1002 로 매핑한다. */
export const SUPABASE_TIMEOUT_MARKER = 'UNIQN_REQUEST_TIMEOUT';

/**
 * 일반 데이터 요청 상한.
 * 모바일 저속망을 감안해 넉넉히 잡되, "무한 스피너"로 느껴지는 구간에는 들어가지 않는 값이다.
 */
export const SUPABASE_REQUEST_TIMEOUT_MS = 15_000;

/**
 * Storage 상한 — 파일 업로드/다운로드는 정상적으로도 오래 걸린다.
 * 여기에 15초를 걸면 멀쩡한 프로필 사진 업로드가 끊긴다.
 */
export const SUPABASE_STORAGE_TIMEOUT_MS = 120_000;

/** Realtime 은 WebSocket 이라 이 fetch 를 타지 않는다(참고). */
function resolveTimeoutMs(url: string): number {
  return url.includes('/storage/v1/') ? SUPABASE_STORAGE_TIMEOUT_MS : SUPABASE_REQUEST_TIMEOUT_MS;
}

function resolveUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return (input as Request).url ?? '';
}

/**
 * 타임아웃을 강제하는 fetch 를 만든다.
 *
 * 호출자가 이미 `signal` 을 넘긴 경우(TanStack Query 의 쿼리 취소 등)에는 그 취소를
 * 그대로 존중하고, **우리 타임아웃과 합성**한다. 둘을 구분해서 우리 타임아웃일 때만
 * 마커를 던진다 — 사용자가 화면을 떠나 취소된 요청을 "시간 초과"로 보고하면 거짓 신호다.
 */
export function createTimeoutFetch(baseFetch: typeof fetch = fetch): typeof fetch {
  return async function timeoutFetch(
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    const timeoutMs = resolveTimeoutMs(resolveUrl(input));
    const controller = new AbortController();
    const callerSignal = init?.signal ?? null;

    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);

    const onCallerAbort = () => controller.abort();
    if (callerSignal) {
      if (callerSignal.aborted) {
        controller.abort();
      } else {
        callerSignal.addEventListener('abort', onCallerAbort, { once: true });
      }
    }

    try {
      return await baseFetch(input, { ...init, signal: controller.signal });
    } catch (error) {
      if (timedOut && !callerSignal?.aborted) {
        const timeoutError = new Error(
          `${SUPABASE_TIMEOUT_MARKER}: 요청이 ${timeoutMs}ms 안에 끝나지 않아 중단했습니다.`
        );
        timeoutError.name = 'UniqnTimeoutError';
        throw timeoutError;
      }
      throw error;
    } finally {
      clearTimeout(timer);
      callerSignal?.removeEventListener('abort', onCallerAbort);
    }
  } as typeof fetch;
}
