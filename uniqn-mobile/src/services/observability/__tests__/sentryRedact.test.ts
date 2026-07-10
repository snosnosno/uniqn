import {
  applyRedactToBreadcrumb,
  applyRedactToEvent,
  applyRedactToTransaction,
  redactValue,
} from '../sentryRedact';
import type { Breadcrumb, ErrorEvent, TransactionEvent } from '@sentry/react-native';

describe('sentryRedact', () => {
  describe('키 이름 일치 기반 마스킹 (기존 회귀)', () => {
    it('email 키를 마스킹한다', () => {
      const result = redactValue({ email: 'user@example.com' }) as Record<string, unknown>;
      expect(result.email).toBe('[REDACTED]');
    });

    it('password 키를 마스킹한다', () => {
      const result = redactValue({ password: 'hunter2' }) as Record<string, unknown>;
      expect(result.password).toBe('[REDACTED]');
    });

    it('authorization 키를 마스킹한다', () => {
      const result = redactValue({ authorization: 'Bearer xyz' }) as Record<string, unknown>;
      expect(result.authorization).toBe('[REDACTED]');
    });

    it('access_token 키를 마스킹한다', () => {
      const result = redactValue({ access_token: 'abc123' }) as Record<string, unknown>;
      expect(result.access_token).toBe('[REDACTED]');
    });

    it('phone 키를 마스킹한다', () => {
      const result = redactValue({ phone: '01012345678' }) as Record<string, unknown>;
      expect(result.phone).toBe('[REDACTED]');
    });
  });

  describe('문자열 본문 값 패턴 마스킹 (신규)', () => {
    it('event.message 안에 박힌 이메일을 마스킹한다', () => {
      const event = { message: 'login failed for user@x.com' } as unknown as ErrorEvent;
      const result = applyRedactToEvent(event) as unknown as { message: string };

      expect(result.message).toContain('[EMAIL]');
      expect(result.message).not.toContain('user@x.com');
    });

    it('exception.values[].value 안에 박힌 JWT를 마스킹한다', () => {
      const jwt =
        'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
      const event = {
        exception: { values: [{ type: 'Error', value: `token=${jwt}` }] },
      } as unknown as ErrorEvent;
      const result = applyRedactToEvent(event) as unknown as {
        exception: { values: { value: string }[] };
      };

      expect(result.exception.values[0].value).toContain('[JWT]');
      expect(result.exception.values[0].value).not.toContain(jwt);
    });

    it('request.url 쿼리스트링 안의 이메일·전화번호를 마스킹한다', () => {
      const event = {
        request: { url: 'https://a/b?email=user@x.com&phone=01012345678' },
      } as unknown as ErrorEvent;
      const result = applyRedactToEvent(event) as unknown as { request: { url: string } };

      expect(result.request.url).toContain('[EMAIL]');
      expect(result.request.url).toContain('[PHONE]');
      expect(result.request.url).not.toContain('user@x.com');
      expect(result.request.url).not.toContain('01012345678');
    });

    it('breadcrumb.message 안에 박힌 이메일을 마스킹한다', () => {
      const breadcrumb = { message: 'contact user@x.com for support' } as Breadcrumb;
      const result = applyRedactToBreadcrumb(breadcrumb) as unknown as { message: string };

      expect(result.message).toContain('[EMAIL]');
      expect(result.message).not.toContain('user@x.com');
    });

    it('transaction span data.url 쿼리스트링의 PII를 마스킹한다 (G8 — beforeSendTransaction)', () => {
      const txn = {
        type: 'transaction',
        transaction: 'GET /rest/v1/users',
        spans: [
          {
            op: 'http.client',
            data: { url: 'https://api/rest/v1/users?email=user@x.com&phone=01012345678' },
          },
        ],
      } as unknown as TransactionEvent;
      const result = applyRedactToTransaction(txn) as unknown as {
        spans: { data: { url: string } }[];
      };

      expect(result.spans[0].data.url).toContain('[EMAIL]');
      expect(result.spans[0].data.url).toContain('[PHONE]');
      expect(result.spans[0].data.url).not.toContain('user@x.com');
      expect(result.spans[0].data.url).not.toContain('01012345678');
    });

    it('breadcrumb.data 문자열 값 안의 전화번호를 마스킹한다', () => {
      const breadcrumb = {
        data: { note: '010-1234-5678로 연락 바랍니다' },
      } as unknown as Breadcrumb;
      const result = applyRedactToBreadcrumb(breadcrumb) as unknown as { data: { note: string } };

      expect(result.data.note).toContain('[PHONE]');
      expect(result.data.note).not.toContain('010-1234-5678');
    });

    it('국제표기(+82) 전화번호를 마스킹한다', () => {
      const result = redactValue({ note: '문의: +82 10-1234-5678' }) as Record<string, unknown>;

      expect(result.note).toContain('[PHONE]');
      expect(result.note).not.toContain('10-1234-5678');
    });

    it('주민등록번호 패턴 전체를 마스킹한다', () => {
      const result = redactValue({ note: '901231-1234567' }) as Record<string, unknown>;

      expect(result.note).toBe('[RRN]');
    });

    it('Bearer 토큰 헤더 문자열을 마스킹한다', () => {
      const result = redactValue({
        note: 'Authorization header: Bearer abcDEF123456789012xyz==',
      }) as Record<string, unknown>;

      expect(result.note).toContain('[TOKEN]');
      expect(result.note).not.toContain('abcDEF123456789012xyz');
    });
  });

  describe('신규 REDACT_KEYS 커버리지', () => {
    it.each(['token', 'pin', 'view_token', 'residentRegistrationNumber'])(
      '%s 키를 마스킹한다',
      (key) => {
        const result = redactValue({ [key]: 'sensitive-value' }) as Record<string, unknown>;
        expect(result[key]).toBe('[REDACTED]');
      }
    );
  });

  describe('불변식', () => {
    it('applyRedactToEvent는 null을 반환하지 않는다', () => {
      const event = { message: 'hello world' } as unknown as ErrorEvent;
      expect(applyRedactToEvent(event)).not.toBeNull();
    });

    it('applyRedactToBreadcrumb는 null을 반환하지 않는다', () => {
      const breadcrumb = { message: 'hello world' } as Breadcrumb;
      expect(applyRedactToBreadcrumb(breadcrumb)).not.toBeNull();
    });

    it('원본 객체를 mutate하지 않는다', () => {
      const original = {
        email: 'user@example.com',
        nested: { phone: '01012345678', note: 'contact user@x.com' },
      };
      const snapshot = JSON.parse(JSON.stringify(original));

      redactValue(original);

      expect(original).toEqual(snapshot);
    });

    it('Date 인스턴스를 그대로 보존한다', () => {
      const date = new Date('2026-01-01T00:00:00Z');
      const result = redactValue({ createdAt: date }) as { createdAt: unknown };

      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.createdAt).toBe(date);
    });
  });

  describe('과잉 마스킹 금지', () => {
    it('정상 UUID는 마스킹하지 않는다', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const result = redactValue({ id: uuid }) as Record<string, unknown>;

      expect(result.id).toBe(uuid);
    });

    it('정상 URL 경로는 마스킹하지 않는다', () => {
      const url = 'https://api.uniqn.app/v1/postings/123';
      const result = redactValue({ url }) as Record<string, unknown>;

      expect(result.url).toBe(url);
    });

    it('Sentry 구조 필드(event_id·trace_id = 32자 hex)를 오염시키지 않는다', () => {
      // 범용 hex 마스킹이 event_id/trace_id 를 [TOKEN] 으로 오염시키면 이벤트 식별·
      // 분산추적이 깨진다(2026-07-10 회귀 검출). 이 필드는 반드시 원본 유지.
      const event = {
        event_id: 'fc6d8c0c43fc4630ad850ee518f1b9d0',
        contexts: {
          trace: { trace_id: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6', span_id: '9c2a1f0b3d4e5f60' },
        },
      } as unknown as ErrorEvent;
      const result = applyRedactToEvent(event) as unknown as {
        event_id: string;
        contexts: { trace: { trace_id: string; span_id: string } };
      };

      expect(result.event_id).toBe('fc6d8c0c43fc4630ad850ee518f1b9d0');
      expect(result.contexts.trace.trace_id).toBe('a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6');
      expect(result.contexts.trace.span_id).toBe('9c2a1f0b3d4e5f60');
    });

    it('에러 타입 문자열은 마스킹하지 않는다', () => {
      const result = redactValue({ type: 'TypeError' }) as Record<string, unknown>;
      expect(result.type).toBe('TypeError');
    });
  });

  describe('depth 초과 처리 (G3)', () => {
    it('MAX_DEPTH를 넘는 중첩 안의 시크릿을 그대로 통과시키지 않는다', () => {
      let deep: Record<string, unknown> = { secret: 'leaked-at-the-bottom' };
      for (let i = 0; i < 12; i += 1) {
        deep = { nested: deep };
      }

      const serialized = JSON.stringify(redactValue(deep));

      expect(serialized).not.toContain('leaked-at-the-bottom');
    });
  });
});
