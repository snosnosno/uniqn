/**
 * 데이터 평면 타임아웃 (감사 err-01)
 *
 * @description 리포지토리 계층에는 `withTimeout` 이 0건이었고 공통 래퍼도 없어
 *   개별 배선이 불가능했다. 그래서 Supabase 클라이언트가 쓰는 fetch 자체를 바꿨다.
 *   여기서 고정하는 계약:
 *   1. 응답이 없으면 상한에서 **실제로 요청을 끊는다**(race 가 아니라 abort).
 *   2. 끊었을 때만 마커를 던진다 — 사용자가 화면을 떠나 취소한 요청까지
 *      "시간 초과"로 보고하면 거짓 신호다.
 *   3. Storage 는 상한이 다르다 — 15초를 걸면 멀쩡한 업로드가 끊긴다.
 */

import {
  createTimeoutFetch,
  SUPABASE_REQUEST_TIMEOUT_MS,
  SUPABASE_STORAGE_TIMEOUT_MS,
  SUPABASE_TIMEOUT_MARKER,
} from '../supabaseFetch';

function createAbortError(): Error {
  const abortError = new Error('The operation was aborted.');
  abortError.name = 'AbortError';
  return abortError;
}

/**
 * 영원히 안 끝나되 abort 신호에는 반응하는 fetch.
 * 실제 fetch 와 마찬가지로 **이미 취소된 signal 을 받으면 즉시 reject** 한다 —
 * 이벤트만 기다리면 그 경우 영원히 매달린다(실제 동작과 어긋나는 목).
 */
function createHangingFetch(): jest.Mock {
  return jest.fn((_input: RequestInfo | URL, init?: RequestInit) => {
    if (init?.signal?.aborted) {
      return Promise.reject(createAbortError());
    }

    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        reject(createAbortError());
      });
    });
  });
}

describe('createTimeoutFetch', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('정상 응답은 그대로 통과시킨다', async () => {
    const response = { ok: true } as Response;
    const baseFetch = jest.fn().mockResolvedValue(response);

    const result = await createTimeoutFetch(baseFetch as unknown as typeof fetch)(
      'https://x.supabase.co/rest/v1/users'
    );

    expect(result).toBe(response);
  });

  it('상한을 넘기면 요청을 실제로 끊고 마커를 던진다', async () => {
    const baseFetch = createHangingFetch();
    const timeoutFetch = createTimeoutFetch(baseFetch as unknown as typeof fetch);

    const pending = timeoutFetch('https://x.supabase.co/rest/v1/work_logs');
    const assertion = expect(pending).rejects.toThrow(SUPABASE_TIMEOUT_MARKER);

    jest.advanceTimersByTime(SUPABASE_REQUEST_TIMEOUT_MS);
    await assertion;

    // race 가 아니라 abort 다 — 요청이 백그라운드에 살아남지 않는다
    const passedInit = baseFetch.mock.calls[0]?.[1] as RequestInit;
    expect(passedInit.signal?.aborted).toBe(true);
  });

  it('상한 직전까지는 끊지 않는다', async () => {
    const baseFetch = createHangingFetch();
    const timeoutFetch = createTimeoutFetch(baseFetch as unknown as typeof fetch);

    const pending = timeoutFetch('https://x.supabase.co/rest/v1/work_logs');
    let settled = false;
    void pending.catch(() => {
      settled = true;
    });

    jest.advanceTimersByTime(SUPABASE_REQUEST_TIMEOUT_MS - 1);
    await Promise.resolve();

    expect(settled).toBe(false);

    // 정리 — 미처리 rejection 방지
    jest.advanceTimersByTime(1);
    await expect(pending).rejects.toThrow();
  });

  it('Storage 는 더 긴 상한을 쓴다 (업로드가 15초에 끊기면 안 된다)', async () => {
    const baseFetch = createHangingFetch();
    const timeoutFetch = createTimeoutFetch(baseFetch as unknown as typeof fetch);

    const pending = timeoutFetch('https://x.supabase.co/storage/v1/object/avatars/a.png');
    let settled = false;
    void pending.catch(() => {
      settled = true;
    });

    // 일반 상한을 한참 넘겨도 살아 있어야 한다
    jest.advanceTimersByTime(SUPABASE_REQUEST_TIMEOUT_MS * 2);
    await Promise.resolve();
    expect(settled).toBe(false);

    jest.advanceTimersByTime(SUPABASE_STORAGE_TIMEOUT_MS);
    await expect(pending).rejects.toThrow(SUPABASE_TIMEOUT_MARKER);
  });

  it('호출자가 취소한 요청은 타임아웃으로 오인하지 않는다', async () => {
    const baseFetch = createHangingFetch();
    const timeoutFetch = createTimeoutFetch(baseFetch as unknown as typeof fetch);
    const callerController = new AbortController();

    const pending = timeoutFetch('https://x.supabase.co/rest/v1/users', {
      signal: callerController.signal,
    });

    callerController.abort();

    // 화면 이탈로 취소된 요청을 "시간 초과"라고 보고하면 거짓 신호가 된다
    await expect(pending).rejects.toThrow(/aborted/i);
    await expect(pending).rejects.not.toThrow(SUPABASE_TIMEOUT_MARKER);
  });

  it('이미 취소된 signal 로 들어오면 즉시 끊는다', async () => {
    const baseFetch = createHangingFetch();
    const timeoutFetch = createTimeoutFetch(baseFetch as unknown as typeof fetch);
    const callerController = new AbortController();
    callerController.abort();

    await expect(
      timeoutFetch('https://x.supabase.co/rest/v1/users', { signal: callerController.signal })
    ).rejects.toThrow();

    const passedInit = baseFetch.mock.calls[0]?.[1] as RequestInit;
    expect(passedInit.signal?.aborted).toBe(true);
  });
});
