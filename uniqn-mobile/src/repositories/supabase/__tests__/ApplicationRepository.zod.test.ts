/**
 * UNIQN Mobile - ApplicationRepository JSONB Zod 검증 테스트
 *
 * @description applications.cancellation_request JSONB 런타임 파싱 안전성 확인.
 *              과거 이슈(6e24a4868): timestamp 스키마 순서 버그 예방 regression guard.
 */

import { cancellationRequestStoredSchema } from '@/schemas/application.schema';

describe('cancellationRequestStoredSchema', () => {
  it('parses valid pending cancellation request JSON from DB', () => {
    const input = {
      status: 'pending',
      requestedAt: '2026-04-17T09:00:00.000Z',
      reason: '개인 사정으로 근무 불가',
    };

    const result = cancellationRequestStoredSchema.safeParse(input);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('pending');
      // ISO string이 그대로 유지되어야 함 (TimestampLike로 변환되면 안 됨)
      expect(result.data.requestedAt).toBe('2026-04-17T09:00:00.000Z');
    }
  });

  it('returns failure on invalid status enum', () => {
    const input = {
      status: 'unknown-status',
      requestedAt: '2026-04-17T09:00:00.000Z',
      reason: 'x',
    };

    const result = cancellationRequestStoredSchema.safeParse(input);

    expect(result.success).toBe(false);
  });
});
