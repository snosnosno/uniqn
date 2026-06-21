// =============================================================================
// revenuecat-webhook Edge Function
// =============================================================================
// 목적: RevenueCat이 결제/환불 이벤트를 우리에게 통보. 본 함수가 받아서
//   credit_diamonds_atomically RPC를 호출해 wallet_ledger를 갱신한다.
//
// 호출 방식:
//   POST https://<project>.supabase.co/functions/v1/revenuecat-webhook
//   Headers:
//     Authorization: Bearer <REVENUECAT_WEBHOOK_SECRET>
//     Content-Type: application/json
//   Body: RevenueCat webhook payload (api_version + event)
//
// 인증: REVENUECAT_WEBHOOK_SECRET 일치만 허용 (RC 대시보드에서 설정)
//
// 멱등성: event.id를 wallet_ledger.revenuecat_transaction_id에 저장 (UNIQUE).
//   RC가 재시도해도 RPC가 idempotent 응답.
//
// 환불: REFUND, CANCELLATION(소비성 환불 신호, BILLING_ERROR 제외) 이벤트는 음수 diamonds로 RPC 호출.
//   BILLING_ISSUE 는 '갱신 청구 실패' 신호라 무시. SANDBOX 환경 결제는 실 재화 발권 금지(게이트).
//   별도 event.id이므로 새로운 ledger row (refund_purchase reason)가 생성됨.
//
// Spec §5, Plan Phase 2 / 하드닝: docs/planning/2026-06-02-monetization-review-findings.md
// =============================================================================

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { classifyEvent, timingSafeEqualStr } from './eventClassifier.ts';

const responseHeaders = {
  'Content-Type': 'application/json',
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface RevenueCatEvent {
  type: string;
  id: string;
  app_user_id: string;
  product_id: string;
  transaction_id?: string;
  original_transaction_id?: string;
  environment?: 'PRODUCTION' | 'SANDBOX';
  store?: 'APP_STORE' | 'PLAY_STORE' | 'AMAZON' | 'STRIPE';
  cancel_reason?: string | null;
  expiration_at_ms?: number | null;
  purchased_at_ms?: number | null;
}

interface RevenueCatPayload {
  api_version?: string;
  event: RevenueCatEvent;
}

function badRequest(message: string, extra?: Record<string, unknown>): Response {
  return new Response(JSON.stringify({ error: message, ...(extra ?? {}) }), {
    status: 400,
    headers: responseHeaders,
  });
}

function unauthorized(): Response {
  return new Response(JSON.stringify({ error: 'unauthorized' }), {
    status: 401,
    headers: responseHeaders,
  });
}

function ok(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: responseHeaders });
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405,
      headers: responseHeaders,
    });
  }

  // 1) 인증: Authorization Bearer <REVENUECAT_WEBHOOK_SECRET>
  const expectedSecret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET');
  if (!expectedSecret) {
    console.error('REVENUECAT_WEBHOOK_SECRET env not configured');
    return new Response(JSON.stringify({ error: 'server_misconfigured' }), {
      status: 500,
      headers: responseHeaders,
    });
  }
  const authHeader = req.headers.get('Authorization');
  // 상수시간 비교 — secret 비교의 타이밍 사이드채널 완화 (=== 단축평가 회피)
  if (!authHeader || !timingSafeEqualStr(authHeader, `Bearer ${expectedSecret}`)) {
    return unauthorized();
  }

  // 2) 페이로드 파싱
  let payload: RevenueCatPayload;
  try {
    payload = (await req.json()) as RevenueCatPayload;
  } catch {
    return badRequest('invalid_json');
  }

  if (!payload || typeof payload !== 'object' || !payload.event) {
    return badRequest('missing_event');
  }

  const event = payload.event;
  const eventType = event.type;

  // 3) 이벤트 분류: SANDBOX 게이트 + IGNORE(BILLING_ISSUE 포함) + credit/refund/unknown
  const allowSandbox = Deno.env.get('REVENUECAT_ALLOW_SANDBOX') === 'true';
  const decision = classifyEvent({
    type: eventType,
    environment: event.environment ?? null,
    cancelReason: event.cancel_reason ?? null,
    allowSandbox,
  });

  // 무시 대상(SANDBOX/구독/청구실패/BILLING_ERROR 취소 등)은 200 OK (RC retry 방지)
  if (decision.action === 'ignore') {
    return ok({ ignored: true, type: eventType, reason: decision.reason });
  }
  // 알려지지 않은 이벤트도 200 (RC retry 폭주 방지) + 로그
  if (decision.action === 'unknown') {
    console.warn(`unknown_event_type: ${eventType}`);
    return ok({ ignored: true, type: eventType, reason: 'unknown_type' });
  }

  // 5) 필수 필드 검증
  if (!event.id || typeof event.id !== 'string') {
    return badRequest('missing_event_id');
  }
  if (!event.app_user_id || !UUID_REGEX.test(event.app_user_id)) {
    // iap-4: RC 익명 id($RCAnonymousID:...) 등 비-UUID 는 특정 사용자에 매핑 불가.
    //   400 으로 응답하면 RC 가 재시도 후 폐기→결제-미적립 영구 손실. 200(ignored)로 응답해
    //   재시도 폭주를 막고, 사용자는 useRestorePurchases 로 로그인 uid 재동기화 시 RC 가
    //   올바른 app_user_id 로 webhook 을 재발행해 복구된다. (관측을 위해 warn 로깅)
    console.warn(`non_uuid_app_user_id (ignored): ${event.app_user_id} event=${event.id}`);
    return ok({ ignored: true, reason: 'non_uuid_user', app_user_id: event.app_user_id });
  }
  if (!event.product_id || typeof event.product_id !== 'string') {
    return badRequest('missing_product_id');
  }

  // 6) Supabase 클라이언트 (service_role)
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured');
    return new Response(JSON.stringify({ error: 'server_misconfigured' }), {
      status: 500,
      headers: responseHeaders,
    });
  }
  const client = createClient(supabaseUrl, serviceRoleKey);

  const isRefund = decision.action === 'refund';

  // 7) product_id → diamonds + bonus_diamonds 조회 (DB 신뢰)
  const { data: product, error: productError } = await client
    .from('diamond_products')
    .select('diamonds, bonus_diamonds, active')
    .eq('product_id', event.product_id)
    .maybeSingle();

  if (productError) {
    console.error('product_query_failed', productError);
    return new Response(JSON.stringify({ error: 'product_query_failed' }), {
      status: 500,
      headers: responseHeaders,
    });
  }

  // iap-1: 환불(REFUND/CANCELLATION)은 product active/존재 게이트를 적용하지 않는다.
  //   운영자가 구SKU 를 비활성화(active=false)/삭제해도 환불 클로백(차감)이 누락되면
  //   사용자가 환불금+다이아를 모두 보유하게 되므로, 환불은 게이트보다 우선한다.
  //   - product 존재(active/inactive 무관): 해당 행의 diamonds 로 차감.
  //   - product 삭제됨: 차감 금액 산출 불가 → 200(ignored)+로깅(재시도 폭주/오차감 방지).
  //     ※ iap-3 한계: 환불 차감량을 '현재' diamond_products 설정에서 산출하므로, 구매↔환불
  //       사이 diamonds/bonus_diamonds 가 변경되면 차감액이 원 적립액과 달라질 수 있다.
  //       정확한 원거래 역추적은 credit 시 transaction_id 저장(스키마 변경)이 선행돼야 함.
  if (!product) {
    if (isRefund) {
      console.warn(`refund_product_not_found (ignored): ${event.product_id} event=${event.id}`);
      return ok({
        ignored: true,
        reason: 'refund_product_not_found',
        product_id: event.product_id,
      });
    }
    console.error(`product_not_found: ${event.product_id}`);
    return badRequest('product_not_found', { product_id: event.product_id });
  }
  if (!isRefund && product.active === false) {
    return badRequest('product_inactive', { product_id: event.product_id });
  }

  const totalDiamonds = (product.diamonds ?? 0) + (product.bonus_diamonds ?? 0);
  if (totalDiamonds <= 0) {
    if (isRefund) {
      console.warn(`refund_invalid_amount (ignored): ${event.product_id} event=${event.id}`);
      return ok({ ignored: true, reason: 'refund_invalid_amount', product_id: event.product_id });
    }
    return badRequest('invalid_product_amount', { product_id: event.product_id });
  }

  const diamondsToCredit = isRefund ? -totalDiamonds : totalDiamonds;

  // 8) credit_diamonds_atomically 호출 (음수=환불, 양수=구매)
  //    revenuecat_transaction_id = event.id (멱등성 키)
  const { data: rpcData, error: rpcError } = await client.rpc('credit_diamonds_atomically', {
    p_user_id: event.app_user_id,
    p_diamonds: diamondsToCredit,
    p_revenuecat_transaction_id: event.id,
    p_product_id: event.product_id,
  });

  if (rpcError) {
    console.error('credit_rpc_failed', {
      message: rpcError.message,
      code: rpcError.code,
      event_id: event.id,
      event_type: eventType,
    });
    // 5xx로 응답하면 RC가 재시도하므로, 멱등성 위반 등 영구 에러는 200으로 swallow
    // 단, 실제 RPC 에러는 retry가 필요할 수 있으니 500
    return new Response(JSON.stringify({ error: 'rpc_failed', detail: rpcError.message }), {
      status: 500,
      headers: responseHeaders,
    });
  }

  return ok({
    success: true,
    event_type: eventType,
    event_id: event.id,
    app_user_id: event.app_user_id,
    product_id: event.product_id,
    diamonds_credited: diamondsToCredit,
    rpc: rpcData ?? null,
  });
});
