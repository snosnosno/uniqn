import { describe, expect, it } from 'vitest';
import {
  AppError,
  BusinessError,
  ERROR_CODES,
  NetworkError,
  PermissionError,
} from '@/core/errors/AppError';
import { handleSupabaseError } from './supabaseError';

const ctx = { operation: 'test', table: 'ops' };

function thrown(error: unknown): AppError {
  try {
    handleSupabaseError(error, ctx);
  } catch (e) {
    return e as AppError;
  }
  throw new Error('handleSupabaseError 가 throw 하지 않았습니다');
}

describe('handleSupabaseError (웹)', () => {
  it('이미 AppError 면 그대로 다시 던진다', () => {
    const original = new BusinessError(ERROR_CODES.OPS_SEAT_TAKEN);
    expect(thrown(original)).toBe(original);
  });

  it('42501 은 권한 에러', () => {
    const e = thrown({ code: '42501', message: 'permission denied for function x' });
    expect(e).toBeInstanceOf(PermissionError);
    expect(e.code).toBe(ERROR_CODES.INFRA_PERMISSION_DENIED);
  });

  it('PGRST301(JWT 만료)은 세션 만료 코드', () => {
    expect(thrown({ code: 'PGRST301', message: 'JWT expired' }).code).toBe(
      ERROR_CODES.AUTH_SESSION_EXPIRED
    );
  });

  it('code 가 빈 PostgrestError 인데 메시지가 네트워크면 네트워크 에러(오분류 방지)', () => {
    const e = thrown({ code: '', message: 'TypeError: Failed to fetch (network)' });
    expect(e).toBeInstanceOf(NetworkError);
  });

  it('브라우저 fetch 단절(TypeError: Failed to fetch)은 오프라인', () => {
    const e = thrown(new TypeError('Failed to fetch'));
    expect(e).toBeInstanceOf(NetworkError);
    expect(e.code).toBe(ERROR_CODES.NETWORK_OFFLINE);
  });

  it('Safari fetch 단절(TypeError: Load failed)도 오프라인 — iPad 현장 주력 브라우저', () => {
    expect(thrown(new TypeError('Load failed'))).toBeInstanceOf(NetworkError);
    expect(thrown({ code: '', message: 'TypeError: Load failed' })).toBeInstanceOf(NetworkError);
  });

  it('매핑 없는 PostgrestError 는 UNKNOWN — 원문 영어를 사용자 문구로 노출하지 않는다', () => {
    const e = thrown({ code: 'XX000', message: 'internal something' });
    expect(e.code).toBe(ERROR_CODES.UNKNOWN);
    expect(e.userMessage).not.toContain('internal something');
  });

  it('일반 값도 AppError 로 감싼다', () => {
    expect(thrown('boom')).toBeInstanceOf(AppError);
  });
});
