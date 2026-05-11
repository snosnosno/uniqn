/**
 * @file Sentry redact filter unit tests (Spec A).
 *
 * sensitive keys 마스킹 + 깊은 traversal + event/breadcrumb 진입점 검증.
 */
import type { Breadcrumb, ErrorEvent } from '@sentry/react-native';
import {
  REDACT_KEYS,
  applyRedactToBreadcrumb,
  applyRedactToEvent,
  redactValue,
} from '../../../src/services/observability/sentryRedact';

describe('redactValue (key-match traversal)', () => {
  it('top-level sensitive key → [REDACTED]', () => {
    const out = redactValue({
      identityVerificationId: 'iv-abc-123',
      benign: 'ok',
    }) as Record<string, unknown>;
    expect(out.identityVerificationId).toBe('[REDACTED]');
    expect(out.benign).toBe('ok');
  });

  it('nested sensitive key → 깊이 무관 마스킹', () => {
    const out = redactValue({
      request: { headers: { Authorization: 'Bearer xyz', cookie: 'c=1' } },
      body: { id_token: 'eyJhbGc...', userId: 'u-123' },
    }) as Record<string, unknown>;
    const request = out.request as Record<string, Record<string, string>>;
    const body = out.body as Record<string, string>;
    expect(request.headers.Authorization).toBe('[REDACTED]');
    expect(request.headers.cookie).toBe('c=1');
    expect(body.id_token).toBe('[REDACTED]');
    expect(body.userId).toBe('u-123');
  });

  it('array 안 객체도 traversal', () => {
    const out = redactValue([{ accessToken: 't' }, { foo: 'bar' }]) as Record<string, string>[];
    expect(out[0].accessToken).toBe('[REDACTED]');
    expect(out[1].foo).toBe('bar');
  });

  it('null / undefined / primitive 입력은 그대로', () => {
    expect(redactValue(null)).toBeNull();
    expect(redactValue(undefined)).toBeUndefined();
    expect(redactValue('plain')).toBe('plain');
    expect(redactValue(42)).toBe(42);
  });

  it('대소문자 무관 key match (CamelCase / snake_case 모두)', () => {
    const out = redactValue({
      AuthorizationCode: 'a',
      Identity_Verification_Id: 'b',
    }) as Record<string, string>;
    expect(out.AuthorizationCode).toBe('[REDACTED]');
    expect(out.Identity_Verification_Id).toBe('[REDACTED]');
  });
});

describe('applyRedactToEvent / applyRedactToBreadcrumb', () => {
  it('event.extra / event.request.data 마스킹 (event 자체는 drop 안 함)', () => {
    const event = {
      extra: { authorizationCode: 'apple-code', ok: 1 },
      request: { data: { refresh_token: 'rt', user: 'u' } },
    } as unknown as ErrorEvent;
    const out = applyRedactToEvent(event);
    expect(out).not.toBeNull();
    const extra = (out as ErrorEvent).extra as Record<string, unknown>;
    const data = ((out as ErrorEvent).request as { data: Record<string, string> }).data;
    expect(extra.authorizationCode).toBe('[REDACTED]');
    expect(extra.ok).toBe(1);
    expect(data.refresh_token).toBe('[REDACTED]');
    expect(data.user).toBe('u');
  });

  it('breadcrumb.data 마스킹 (breadcrumb 자체는 drop 안 함)', () => {
    const crumb = {
      category: 'http',
      data: { identityVerificationId: 'iv-1', url: '/x' },
    } as unknown as Breadcrumb;
    const out = applyRedactToBreadcrumb(crumb);
    expect(out).not.toBeNull();
    const data = (out as Breadcrumb).data as Record<string, string>;
    expect(data.identityVerificationId).toBe('[REDACTED]');
    expect(data.url).toBe('/x');
  });
});

describe('REDACT_KEYS coverage (회귀)', () => {
  it('spec v2 명시 키 모두 포함 (token / code / hash)', () => {
    const required = [
      'authorizationCode',
      'identityVerificationId',
      'id_token',
      'refresh_token',
      'access_token',
      'authorization',
    ];
    for (const k of required) {
      expect(REDACT_KEYS).toContain(k);
    }
  });

  it('PII 키 포함 (PortOne verifiedCustomer 자료)', () => {
    const piiKeys = [
      'phone',
      'phoneNumber',
      'birthDate',
      'email',
      'nickname',
      'displayName',
      'fullName',
    ];
    for (const k of piiKeys) {
      expect(REDACT_KEYS).toContain(k);
    }
  });

  it('PII 키도 redactValue가 마스킹 — 실제 동작 검증', () => {
    const out = redactValue({
      verifiedCustomer: {
        name: '홍길동',
        phoneNumber: '+821012345678',
        birthDate: '19900101',
        email: 'user@example.com',
        nickname: 'gildong',
      },
    }) as Record<string, Record<string, string>>;
    const vc = out.verifiedCustomer;
    expect(vc.phoneNumber).toBe('[REDACTED]');
    expect(vc.birthDate).toBe('[REDACTED]');
    expect(vc.email).toBe('[REDACTED]');
    expect(vc.nickname).toBe('[REDACTED]');
    // 'name'은 false-positive 위험으로 제외 (Error.name 등) — verifiedCustomer.name은 마스킹 안 됨
    expect(vc.name).toBe('홍길동');
  });
});
