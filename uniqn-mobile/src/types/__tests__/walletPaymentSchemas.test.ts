// src/types/__tests__/walletPaymentSchemas.test.ts
import { CreatePostingPaymentResultSchema, RefundResultSchema } from '@/types/wallet';

describe('CreatePostingPaymentResultSchema', () => {
  it('신규 삽입 응답을 파싱한다', () => {
    const parsed = CreatePostingPaymentResultSchema.parse({
      success: true,
      posting_id: '11111111-1111-4111-8111-111111111111',
      diamonds_consumed: 10,
      hearts_consumed: 0,
      total_consumed: 10,
    });
    expect(parsed.posting_id).toBe('11111111-1111-4111-8111-111111111111');
    expect(parsed.total_consumed).toBe(10);
  });

  it('멱등 재시도 응답(idempotent:true)을 파싱한다', () => {
    const parsed = CreatePostingPaymentResultSchema.parse({
      success: true,
      posting_id: '22222222-2222-4222-8222-222222222222',
      idempotent: true,
      diamonds_consumed: 0,
      hearts_consumed: 0,
      total_consumed: 0,
    });
    expect(parsed.idempotent).toBe(true);
  });

  it('consumed 카운트 누락 시 0으로 기본값', () => {
    const parsed = CreatePostingPaymentResultSchema.parse({
      success: true,
      posting_id: '33333333-3333-4333-8333-333333333333',
    });
    expect(parsed.total_consumed).toBe(0);
  });
});

describe('RefundResultSchema', () => {
  it('환불 성공 응답을 파싱한다', () => {
    const parsed = RefundResultSchema.parse({
      success: true,
      refunded_diamonds: 5,
      refund_rate: 1.0,
      hours_elapsed: 3.2,
      original_diamond: 5,
      original_heart: 0,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.refunded_diamonds).toBe(5);
    }
  });

  it('무차감 응답(success:false)을 파싱한다', () => {
    const parsed = RefundResultSchema.parse({ success: false, error: 'no_consumption_found' });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error).toBe('no_consumption_found');
    }
  });

  it('멱등 응답(idempotent)을 파싱한다', () => {
    const parsed = RefundResultSchema.parse({ success: true, idempotent: true });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.idempotent).toBe(true);
    }
  });
});
