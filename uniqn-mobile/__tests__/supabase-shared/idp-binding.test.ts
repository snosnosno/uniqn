/**
 * @file _shared/idp-binding 단위 테스트 (PR-A: apple/portone caller binding)
 *
 * spec: docs/specs/apple-portone-caller-binding.md (v3, line 138~159)
 * 대상 함수는 Deno deploy 환경에서 동작하지만, Web Crypto API + 표준 TextEncoder만
 * 사용하도록 작성되어 Node.js 19+ jest 환경에서도 동일하게 import/실행 가능.
 */
import {
  createDeterministicHash,
  idpError,
  isVerificationRecent,
  logDiDiagnostic,
  normalizeBirthDate,
  normalizeGender,
  toE164,
  validateAge,
} from '../../supabase/functions/_shared/idp-binding';
import { IDP_ERROR_CODES } from '../../supabase/functions/_shared/idp-errors';

describe('isVerificationRecent (5분 TTL 가드)', () => {
  let nowSpy: jest.SpyInstance;
  const NOW = new Date('2026-05-11T12:00:00.000Z').getTime();

  beforeEach(() => {
    nowSpy = jest.spyOn(Date, 'now').mockReturnValue(NOW);
  });
  afterEach(() => {
    nowSpy.mockRestore();
  });

  it('verifiedAt 정확히 5분 1ms 전 → false (만료)', () => {
    const verifiedAt = new Date(NOW - 5 * 60 * 1000 - 1).toISOString();
    expect(isVerificationRecent(verifiedAt)).toBe(false);
  });

  it('verifiedAt 4분 59초 전 → true (window 내)', () => {
    const verifiedAt = new Date(NOW - (4 * 60 + 59) * 1000).toISOString();
    expect(isVerificationRecent(verifiedAt)).toBe(true);
  });

  it('verifiedAt undefined → false', () => {
    expect(isVerificationRecent(undefined)).toBe(false);
  });

  it('verifiedAt invalid string → false', () => {
    expect(isVerificationRecent('not-a-date')).toBe(false);
  });
});

describe('idpError (에러 코드 → Response)', () => {
  it('code → message/status 매핑이 IDP_ERROR_CODES와 일치', async () => {
    const res = idpError('IV_TIMESTAMP_EXPIRED');
    expect(res.status).toBe(IDP_ERROR_CODES.IV_TIMESTAMP_EXPIRED.status);
    expect(res.headers.get('Content-Type')).toBe('application/json');
    const body = await res.json();
    expect(body).toEqual({
      error: IDP_ERROR_CODES.IV_TIMESTAMP_EXPIRED.message,
      code: 'IV_TIMESTAMP_EXPIRED',
    });
  });

  it('detail 옵셔널 — 인자 없으면 detail 키 미포함, 있으면 포함', async () => {
    const without = await idpError('IV_DUPLICATE_PHONE').json();
    const withDetail = await idpError('IV_DUPLICATE_PHONE', 'phone=+8210...').json();
    expect(without).not.toHaveProperty('detail');
    expect(withDetail.detail).toBe('phone=+8210...');
  });
});

describe('createDeterministicHash (HMAC-SHA256 회귀)', () => {
  it('동일 input + secret → 동일 hex hash, 다른 secret → 다른 hash', async () => {
    const a = await createDeterministicHash('user-ci-12345', 'secret-A');
    const b = await createDeterministicHash('user-ci-12345', 'secret-A');
    const c = await createDeterministicHash('user-ci-12345', 'secret-B');
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('normalizeBirthDate / normalizeGender (회귀)', () => {
  it('birthDate: 8자리 숫자 / 하이픈 / 잘못된 입력 처리, gender: MALE/FEMALE만 통과', () => {
    expect(normalizeBirthDate('19901225')).toBe('19901225');
    expect(normalizeBirthDate('1990-12-25')).toBe('19901225');
    expect(normalizeBirthDate('901225')).toBeUndefined();
    expect(normalizeBirthDate(undefined)).toBeUndefined();

    expect(normalizeGender('MALE')).toBe('male');
    expect(normalizeGender('female')).toBe('female');
    expect(normalizeGender('OTHER')).toBeUndefined();
    expect(normalizeGender(undefined)).toBeUndefined();
  });
});

describe('toE164 (전화번호 정규화 회귀)', () => {
  it('010/011 → +82, +82는 그대로, 그 외는 cleaned', () => {
    expect(toE164('010-1234-5678')).toBe('+821012345678');
    expect(toE164('011 999 8888')).toBe('+82119998888');
    expect(toE164('+821012345678')).toBe('+821012345678');
    expect(toE164('821012345678')).toBe('821012345678');
  });
});

describe('validateAge (만 나이 회귀)', () => {
  it('만 minAge 이상이면 true, 미만이면 false. 잘못된 birthDate는 false', () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');

    const adult = `${yyyy - 20}${mm}${dd}`;
    const teen = `${yyyy - 13}${mm}${dd}`;

    expect(validateAge(adult, 14)).toBe(true);
    expect(validateAge(teen, 14)).toBe(false);
    expect(validateAge('not-a-date', 14)).toBe(false);
  });
});

describe('logDiDiagnostic (Spec C — PortOne di 진단 로그, PII redact)', () => {
  let spy: jest.SpyInstance;
  beforeEach(() => {
    spy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });
  afterEach(() => {
    spy.mockRestore();
  });

  it('di 존재 시 hasDi=true + diLength만 로깅 (di 값 자체는 로깅 안 함)', () => {
    logDiDiagnostic({ di: 'abc123def-XYZ' }, 'unit-test');
    expect(spy).toHaveBeenCalledWith(
      '[di-diagnostic]',
      expect.objectContaining({
        context: 'unit-test',
        hasDi: true,
        diLength: 13,
        diType: 'string',
      })
    );
    const arg = spy.mock.calls[0][1];
    expect(JSON.stringify(arg)).not.toContain('abc123def');
  });

  it('di 없음 시 hasDi=false', () => {
    logDiDiagnostic({}, 'unit-test');
    expect(spy).toHaveBeenCalledWith(
      '[di-diagnostic]',
      expect.objectContaining({ hasDi: false, diLength: 0, diType: 'undefined' })
    );
  });

  it('null / undefined verifiedCustomer 입력 안전 처리', () => {
    logDiDiagnostic(null, 'ctx');
    logDiDiagnostic(undefined, 'ctx');
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
