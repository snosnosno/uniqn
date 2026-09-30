import { afterEach, describe, expect, it, vi } from 'vitest';
import { logger, redact } from './logger';

describe('logger', () => {
  afterEach(() => vi.restoreAllMocks());

  it('비밀번호·토큰 키는 가린다', () => {
    expect(redact({ password: 'x', monitorToken: 'y', tournamentId: 't' })).toEqual({
      password: '[가림]',
      monitorToken: '[가림]',
      tournamentId: 't',
    });
  });

  it('error(message, Error, ctx) 는 에러 객체를 함께 넘긴다', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const err = new Error('boom');
    logger.error('실패', err, { a: 1 });
    expect(spy).toHaveBeenCalledWith('[ops] 실패', { a: 1 }, err);
  });

  it('console.log 는 쓰지 않는다', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    logger.info('정보');
    expect(log).not.toHaveBeenCalled();
  });
});
