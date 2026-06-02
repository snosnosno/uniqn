/**
 * revenuecat-webhook 이벤트 분류 + 인증 헬퍼 (순수 로직)
 *
 * idp-binding 헬퍼와 동일하게 **Deno-free** (no `Deno.*`, no top-level `jsr:` import) 로
 * 작성하여 프로젝트 jest-expo 하네스에서 단위 테스트가 가능하다.
 *
 * 근거: docs/planning/2026-06-02-monetization-review-findings.md
 *   - webhook-no-environment-gate (P1): SANDBOX 결제로 실 다이아 발권
 *   - cancellation-blind-deduct (P2): BILLING_ISSUE / BILLING_ERROR 를 환불로 오분류해 오차감
 *   - webhook-non-constant-time-compare (P2): secret === 비교 타이밍 사이드채널
 */

// 잔액 증가 이벤트
export const CREDIT_TYPES = new Set<string>(['INITIAL_PURCHASE', 'NON_RENEWING_PURCHASE']);

// 잔액 감소(환불) 이벤트.
//   - REFUND: 확정 환불 → 차감
//   - CANCELLATION: 소비성 결제에서는 환불 신호 → 차감 (단 cancel_reason=BILLING_ERROR 제외)
// BILLING_ISSUE 는 제거됨 — '갱신 청구 실패' 신호로 환불/취소가 아니라 무시 대상.
export const REFUND_TYPES = new Set<string>(['REFUND', 'CANCELLATION']);

// 무시할 이벤트 (구독 미사용 / 단순 정보 / 청구 실패)
export const IGNORE_TYPES = new Set<string>([
  'RENEWAL',
  'EXPIRATION',
  'PRODUCT_CHANGE',
  'TRANSFER',
  'SUBSCRIBER_ALIAS',
  'NON_SUBSCRIPTION_PURCHASE', // 일부 RC 버전 별칭
  'TEST',
  // BILLING_ISSUE: 갱신 청구 실패 통보 — 기지급 소비분 회수가 아님. 차감 금지(무시).
  'BILLING_ISSUE',
]);

export type EventAction = 'credit' | 'refund' | 'ignore' | 'unknown';

export interface ClassifyInput {
  type: string;
  environment?: string | null;
  cancelReason?: string | null;
  allowSandbox: boolean;
}

export interface ClassifyResult {
  action: EventAction;
  reason?: string;
}

/**
 * RC 이벤트를 credit/refund/ignore/unknown 으로 분류한다.
 * 우선순위: SANDBOX 게이트 → IGNORE → CREDIT → REFUND/CANCELLATION → unknown.
 */
export function classifyEvent(input: ClassifyInput): ClassifyResult {
  const { type, environment, cancelReason, allowSandbox } = input;

  // 1) SANDBOX 게이트 — 테스트 결제(무과금)로 실 재화가 발권되지 않도록 차단.
  //    sandbox 빌드가 prod RC 프로젝트를 가리킬 때의 누출 경로를 봉쇄.
  if (environment === 'SANDBOX' && !allowSandbox) {
    return { action: 'ignore', reason: 'sandbox' };
  }

  if (IGNORE_TYPES.has(type)) {
    return { action: 'ignore', reason: 'ignored_type' };
  }

  if (CREDIT_TYPES.has(type)) {
    return { action: 'credit' };
  }

  if (type === 'REFUND') {
    return { action: 'refund' };
  }

  if (type === 'CANCELLATION') {
    // 소비성 다이아: CANCELLATION 은 환불 처리 신호 → 차감. 단 갱신 청구실패(BILLING_ERROR)는 환불 아님.
    if (cancelReason === 'BILLING_ERROR') {
      return { action: 'ignore', reason: 'billing_error_not_refund' };
    }
    return { action: 'refund' };
  }

  return { action: 'unknown' };
}

/**
 * 상수시간 문자열 비교 — 인증 secret 비교의 타이밍 사이드채널 완화.
 * 길이가 달라도 가능한 만큼 시간을 소비한 뒤 false 반환.
 */
export function timingSafeEqualStr(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  const len = Math.max(ab.length, bb.length);
  // 길이 차이는 즉시 diff 에 반영(누설 불가피한 정보)하되, 루프는 항상 len 만큼 수행.
  let diff = ab.length ^ bb.length;
  for (let i = 0; i < len; i++) {
    diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  }
  return diff === 0;
}
