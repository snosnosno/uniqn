/**
 * Unit tests for shared IdP helpers used by the PortOne Edge Functions.
 *
 * These helpers are intentionally Deno-free (no `Deno.*`, no `jsr:` imports at
 * the module top level) so they run under the project's jest-expo harness.
 */
import { idpError, retryOnError } from '../idp-binding.ts';
import { IDP_ERROR_CODES } from '../idp-errors.ts';

describe('idpError', () => {
  it('PORTONE_CONFIG_MISSING — code 필드를 포함한 500 응답을 반환한다', async () => {
    const res = idpError('PORTONE_CONFIG_MISSING');
    expect(res.status).toBe(500);

    const body = (await res.json()) as { error: string; code: string };
    // 클라이언트 parseEdgeFunctionErrorBody 의 `parsed?.code` 게이트를 통과시키는 핵심 계약.
    expect(body.code).toBe('PORTONE_CONFIG_MISSING');
    expect(body.error).toBe(IDP_ERROR_CODES.PORTONE_CONFIG_MISSING.message);
    // 영문 generic 메시지가 아니라 한글 사용자 메시지여야 한다.
    expect(body.error).not.toContain('non-2xx');
  });
});

describe('retryOnError', () => {
  const noSleep = async () => {};

  it('첫 시도 성공 시 1회만 호출하고 결과를 반환한다', async () => {
    const op = jest.fn(async () => ({ error: null as null | { message: string } }));
    const result = await retryOnError(op, { attempts: 3, delayMs: 1000, sleep: noSleep });

    expect(op).toHaveBeenCalledTimes(1);
    expect(result.error).toBeNull();
  });

  it('error 가 사라질 때까지 재시도하고 성공 결과를 반환한다', async () => {
    let calls = 0;
    const op = jest.fn(async () => {
      calls += 1;
      return { error: calls < 3 ? { message: 'transient' } : null };
    });

    const result = await retryOnError(op, { attempts: 3, delayMs: 1000, sleep: noSleep });

    expect(op).toHaveBeenCalledTimes(3);
    expect(result.error).toBeNull();
  });

  it('attempts 회 모두 실패하면 마지막 error 를 그대로 반환한다 (throw 하지 않음)', async () => {
    const op = jest.fn(async () => ({ error: { message: 'permanent' } }));

    const result = await retryOnError(op, { attempts: 3, delayMs: 1000, sleep: noSleep });

    expect(op).toHaveBeenCalledTimes(3);
    expect(result.error).toEqual({ message: 'permanent' });
  });

  it('attempts 사이에 주입된 sleep 을 호출한다', async () => {
    const sleep = jest.fn(async () => {});
    const op = jest.fn(async () => ({ error: { message: 'x' } }));

    await retryOnError(op, { attempts: 3, delayMs: 500, sleep });

    // 3회 시도 → 시도 사이 2번 대기
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(500);
  });
});
