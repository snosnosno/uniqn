/**
 * revenuecat-webhook eventClassifier 단위 테스트 (Deno-free → jest-expo).
 * 근거: docs/planning/2026-06-02-monetization-review-findings.md
 */
import { classifyEvent, timingSafeEqualStr } from '../eventClassifier.ts';

describe('classifyEvent', () => {
  // 실 RC 이벤트는 항상 environment 를 포함(PRODUCTION|SANDBOX). 분류 로직 테스트의
  // 기본 환경을 PRODUCTION 으로 고정한다(환경 게이트는 아래 별도 케이스에서 검증).
  const base = { allowSandbox: false, environment: 'PRODUCTION' } as const;

  it('INITIAL_PURCHASE (prod) → credit', () => {
    expect(
      classifyEvent({ ...base, type: 'INITIAL_PURCHASE', environment: 'PRODUCTION' }).action
    ).toBe('credit');
  });

  it('NON_RENEWING_PURCHASE → credit', () => {
    expect(classifyEvent({ ...base, type: 'NON_RENEWING_PURCHASE' }).action).toBe('credit');
  });

  it('REFUND → refund', () => {
    expect(classifyEvent({ ...base, type: 'REFUND' }).action).toBe('refund');
  });

  it('CANCELLATION (소비성 환불 신호) → refund', () => {
    expect(
      classifyEvent({ ...base, type: 'CANCELLATION', cancelReason: 'CUSTOMER_SUPPORT' }).action
    ).toBe('refund');
  });

  it('CANCELLATION + BILLING_ERROR (갱신 청구실패, 환불 아님) → ignore', () => {
    const r = classifyEvent({ ...base, type: 'CANCELLATION', cancelReason: 'BILLING_ERROR' });
    expect(r.action).toBe('ignore');
    expect(r.reason).toBe('billing_error_not_refund');
  });

  it('BILLING_ISSUE (청구 실패 통보) → ignore (차감 금지)', () => {
    const r = classifyEvent({ ...base, type: 'BILLING_ISSUE' });
    expect(r.action).toBe('ignore');
    expect(r.reason).toBe('ignored_type');
  });

  it('RENEWAL → ignore', () => {
    expect(classifyEvent({ ...base, type: 'RENEWAL' }).action).toBe('ignore');
  });

  it('SANDBOX 결제 + allowSandbox=false → ignore (실 발권 차단)', () => {
    const r = classifyEvent({
      type: 'INITIAL_PURCHASE',
      environment: 'SANDBOX',
      allowSandbox: false,
    });
    expect(r.action).toBe('ignore');
    expect(r.reason).toBe('sandbox');
  });

  it('SANDBOX 결제 + allowSandbox=true → credit (테스트 환경 허용)', () => {
    expect(
      classifyEvent({ type: 'INITIAL_PURCHASE', environment: 'SANDBOX', allowSandbox: true }).action
    ).toBe('credit');
  });

  it('SANDBOX 게이트는 환불에도 우선 적용 → ignore', () => {
    expect(
      classifyEvent({ type: 'REFUND', environment: 'SANDBOX', allowSandbox: false }).action
    ).toBe('ignore');
  });

  it('알 수 없는 타입 → unknown', () => {
    expect(classifyEvent({ ...base, type: 'SOME_FUTURE_EVENT' }).action).toBe('unknown');
  });

  // --- 환경 게이트 화이트리스트(fail-closed) 회귀 — environment 누락/비표준값 차단 ---
  it('environment 누락(undefined) + allowSandbox=false → ignore (fail-closed)', () => {
    const r = classifyEvent({ type: 'INITIAL_PURCHASE', allowSandbox: false });
    expect(r.action).toBe('ignore');
    expect(r.reason).toBe('non_production');
  });

  it('environment null + allowSandbox=false → ignore (fail-closed)', () => {
    const r = classifyEvent({ type: 'INITIAL_PURCHASE', environment: null, allowSandbox: false });
    expect(r.action).toBe('ignore');
    expect(r.reason).toBe('non_production');
  });

  it('environment 소문자/오타("sandbox") + allowSandbox=false → ignore (fail-closed)', () => {
    const r = classifyEvent({
      type: 'INITIAL_PURCHASE',
      environment: 'sandbox',
      allowSandbox: false,
    });
    expect(r.action).toBe('ignore');
    expect(r.reason).toBe('non_production');
  });

  it('environment 미래 신규값("STAGING") + allowSandbox=false → ignore (fail-closed)', () => {
    const r = classifyEvent({ type: 'REFUND', environment: 'STAGING', allowSandbox: false });
    expect(r.action).toBe('ignore');
    expect(r.reason).toBe('non_production');
  });

  it('environment 누락 + allowSandbox=true → credit (개발/검증 우회는 유지)', () => {
    expect(classifyEvent({ type: 'INITIAL_PURCHASE', allowSandbox: true }).action).toBe('credit');
  });
});

describe('timingSafeEqualStr', () => {
  it('동일 문자열 → true', () => {
    expect(timingSafeEqualStr('Bearer abc123', 'Bearer abc123')).toBe(true);
  });

  it('다른 문자열(동일 길이) → false', () => {
    expect(timingSafeEqualStr('Bearer abc123', 'Bearer abc124')).toBe(false);
  });

  it('길이 다름 → false', () => {
    expect(timingSafeEqualStr('Bearer abc', 'Bearer abc123')).toBe(false);
  });

  it('둘 다 빈 문자열 → true', () => {
    expect(timingSafeEqualStr('', '')).toBe(true);
  });

  it('유니코드 안전 (멀티바이트)', () => {
    expect(timingSafeEqualStr('키秘密', '키秘密')).toBe(true);
    expect(timingSafeEqualStr('키秘密', '키秘x')).toBe(false);
  });
});
