-- Fix-2: 환불 동시성 하드닝 — 이중환불 차단 + lost-update(캐시 drift) 해소
--
-- 근거: docs/planning/2026-06-02-monetization-review-findings.md
--   - refund-idempotency-no-unique (P1): 잠금없는 SELECT-then-INSERT + refund UNIQUE 부재 → 동시 이중환불
--   - refund-balance-lost-update (P1): 환불이 FOR UPDATE 없이 wallets 읽음 → 동시 차감/환불 시 캐시 drift
--
-- 현재 prod wallet_ledger 에 refund_job_cancelled row 0건이라 부분 UNIQUE 인덱스 생성 안전.
-- ⚠️ 본문 변경 포함 — prod 미적용. CI(신규 스택 pgTAP) Red-Green 후 머지 시 반영.

-- (1) DB 최종 방어선: 동일 posting 당 환불 1회 (부분 UNIQUE)
CREATE UNIQUE INDEX IF NOT EXISTS uq_wallet_ledger_refund_job
  ON public.wallet_ledger(user_id, ref_id, reason)
  WHERE reason = 'refund_job_cancelled';

-- (2) 환불 RPC: wallet FOR UPDATE 직렬화 + 멱등 선조회를 락 안으로 + ON CONFLICT graceful
CREATE OR REPLACE FUNCTION public.refund_job_cancellation_atomically(p_posting_id uuid, p_owner_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_existing_refund   UUID;
  v_first_consume_at  TIMESTAMPTZ;
  v_hours_elapsed     NUMERIC;
  v_refund_rate       NUMERIC;
  v_refund_amount     INT;
  v_diamond_amount    INT;
  v_heart_amount      INT;
  v_now               TIMESTAMPTZ := now();
  v_caller            UUID        := auth.uid();
  v_post_owner        UUID;
  v_locked_heart      INT;
  v_locked_diamond    INT;
  v_inserted          INT := 0;
BEGIN
  IF p_posting_id IS NULL OR p_owner_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_args');
  END IF;

  -- [Fix-2] wallet 행 잠금 — consume/credit(둘 다 FOR UPDATE)과 직렬화하여 동시 환불/차감 캐시
  --         drift(lost-update) 제거 + 이후 멱등 선조회를 임계영역 안으로 들임.
  INSERT INTO public.wallets(user_id) VALUES (p_owner_id) ON CONFLICT (user_id) DO NOTHING;
  SELECT heart_balance, diamond_balance INTO v_locked_heart, v_locked_diamond
    FROM public.wallets WHERE user_id = p_owner_id FOR UPDATE;

  -- 1) 멱등성 (락 보유 상태 — 동시 호출은 여기서 직렬화됨)
  SELECT id INTO v_existing_refund FROM public.wallet_ledger
    WHERE ref_id = p_posting_id
      AND user_id = p_owner_id
      AND reason = 'refund_job_cancelled'
    LIMIT 1;
  IF v_existing_refund IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true);
  END IF;

  -- 2a) posting 존재 + 비용 주체(owner) 일치 검증
  SELECT owner_id INTO v_post_owner FROM public.job_postings WHERE id = p_posting_id;
  IF v_post_owner IS NULL OR v_post_owner <> p_owner_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  -- 2b) caller 권한: service_role(NULL) / owner 본인 / JPC 협업자 만 허용
  IF v_caller IS NOT NULL
     AND v_caller <> p_owner_id
     AND NOT public.is_posting_collaborator(p_posting_id, v_caller) THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  -- 3) 차감 row 합산
  SELECT
    COALESCE(SUM(CASE WHEN currency_type='diamond' THEN -delta ELSE 0 END), 0)::int,
    COALESCE(SUM(CASE WHEN currency_type='heart'   THEN -delta ELSE 0 END), 0)::int,
    MIN(created_at)
  INTO v_diamond_amount, v_heart_amount, v_first_consume_at
  FROM public.wallet_ledger
  WHERE ref_id = p_posting_id
    AND user_id = p_owner_id
    AND reason IN ('consume_job_posting','consume_job_extend','consume_job_upgrade');

  IF v_first_consume_at IS NULL OR (v_diamond_amount + v_heart_amount) <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_consumption_found');
  END IF;

  -- 4) 환불 비율 계산 (Decision #1: 24h 내 100% / 이후 50%)
  v_hours_elapsed := EXTRACT(EPOCH FROM (v_now - v_first_consume_at)) / 3600;
  v_refund_rate := CASE WHEN v_hours_elapsed < 24 THEN 1.0 ELSE 0.5 END;
  v_refund_amount := FLOOR((v_diamond_amount + v_heart_amount) * v_refund_rate)::int;

  -- 5) 환불 ledger row (항상 owner 지갑, 잠긴 잔액 스냅샷 사용) — 동시 경합은 부분 UNIQUE 가 차단
  INSERT INTO public.wallet_ledger(
    user_id, currency_type, delta, reason, ref_id, ref_type,
    balance_after_heart, balance_after_diamond, metadata
  )
  VALUES (
    p_owner_id, 'diamond', v_refund_amount, 'refund_job_cancelled',
    p_posting_id, 'job_posting',
    v_locked_heart,
    v_locked_diamond + v_refund_amount,
    jsonb_build_object(
      'original_diamond', v_diamond_amount,
      'original_heart',   v_heart_amount,
      'refund_rate',      v_refund_rate,
      'hours_elapsed',    v_hours_elapsed,
      'cancelled_by',     v_caller
    )
  )
  ON CONFLICT (user_id, ref_id, reason) WHERE reason = 'refund_job_cancelled' DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  IF v_inserted = 0 THEN
    -- 동시 환불이 먼저 커밋됨 → 이중환불 방지, 멱등 반환
    RETURN jsonb_build_object('success', true, 'idempotent', true);
  END IF;

  RETURN jsonb_build_object(
    'success',          true,
    'refunded_diamonds', v_refund_amount,
    'refund_rate',       v_refund_rate,
    'hours_elapsed',     v_hours_elapsed,
    'original_diamond',  v_diamond_amount,
    'original_heart',    v_heart_amount
  );
END;
$function$;
