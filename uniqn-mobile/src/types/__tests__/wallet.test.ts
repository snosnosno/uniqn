import { ClaimAttendanceResponseSchema, PostingCostSchema } from '@/types/wallet';

describe('ClaimAttendanceResponseSchema', () => {
  it('성공 응답을 파싱한다', () => {
    const raw = {
      success: true,
      lot_id: '11111111-1111-1111-8111-111111111111',
      expires_at: '2026-08-28T00:00:00Z',
      amount: 1,
    };
    const parsed = ClaimAttendanceResponseSchema.parse(raw);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.amount).toBe(1);
      expect(parsed.lot_id).toBe('11111111-1111-1111-8111-111111111111');
    }
  });

  it('이미 출석 응답을 파싱한다', () => {
    const raw = { success: false, error: 'already_attended_today' };
    const parsed = ClaimAttendanceResponseSchema.parse(raw);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error).toBe('already_attended_today');
    }
  });

  it('알 수 없는 error 문자열은 거부한다', () => {
    const raw = { success: false, error: 'something_else' };
    expect(() => ClaimAttendanceResponseSchema.parse(raw)).toThrow();
  });
});

describe('PostingCostSchema', () => {
  it('get_posting_cost 응답을 파싱한다', () => {
    const parsed = PostingCostSchema.parse({
      type: 'urgent',
      cost: 0,
      is_paid: false,
      currency_hint: 'diamond',
    });
    expect(parsed.cost).toBe(0);
    expect(parsed.is_paid).toBe(false);
  });
});
