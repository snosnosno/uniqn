-- ============================================================
-- T5: refund 협업자 권한 분기 (비용 주체=owner, caller=owner|협업자)
--   - 본문(멱등·합산·비율·환불 ledger) 보존 (20260427000701)
--   - 권한 확장: caller(auth.uid())가 posting owner 이거나
--     JPC 협업자(is_posting_collaborator) 일 때만 통과
--   - service_role(webhook) 경로는 auth.uid() NULL → 소유주 일치 체크만으로 통과
--   - 환불은 항상 owner 지갑에 적립 (비용 주체 불변)
-- ============================================================

CREATE OR REPLACE FUNCTION public.refund_job_cancellation_atomically(
  p_posting_id UUID,
  p_owner_id   UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
BEGIN
  IF p_posting_id IS NULL OR p_owner_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_args');
  END IF;

  -- 1) 멱등성 (자기 자신의 refund row만 조회 — 타인 row 침범 금지)
  SELECT id INTO v_existing_refund FROM public.wallet_ledger
    WHERE ref_id = p_posting_id
      AND user_id = p_owner_id
      AND reason = 'refund_job_cancelled'
    LIMIT 1;
  IF v_existing_refund IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true);
  END IF;

  -- 2a) posting 존재 + 비용 주체(owner) 일치 검증
  SELECT owner_id INTO v_post_owner
    FROM public.job_postings
   WHERE id = p_posting_id;
  IF v_post_owner IS NULL OR v_post_owner <> p_owner_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  -- 2b) caller 권한:
  --   - service_role: auth.uid() NULL → owner 일치만으로 통과
  --   - owner 본인: v_caller = p_owner_id → 통과
  --   - JPC 협업자: is_posting_collaborator → 통과
  --   - 제3자: unauthorized
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

  -- 4) 환불 비율 계산 (Decision #1)
  v_hours_elapsed := EXTRACT(EPOCH FROM (v_now - v_first_consume_at)) / 3600;
  v_refund_rate := CASE WHEN v_hours_elapsed < 24 THEN 1.0 ELSE 0.5 END;
  v_refund_amount := FLOOR((v_diamond_amount + v_heart_amount) * v_refund_rate)::int;

  -- 5) 환불 ledger row (항상 owner 지갑)
  INSERT INTO public.wallet_ledger(
    user_id, currency_type, delta, reason, ref_id, ref_type,
    balance_after_heart, balance_after_diamond,
    metadata
  )
  SELECT p_owner_id, 'diamond', v_refund_amount, 'refund_job_cancelled',
         p_posting_id, 'job_posting',
         w.heart_balance,
         w.diamond_balance + v_refund_amount,
         jsonb_build_object(
           'original_diamond', v_diamond_amount,
           'original_heart',   v_heart_amount,
           'refund_rate',      v_refund_rate,
           'hours_elapsed',    v_hours_elapsed,
           'cancelled_by',     v_caller
         )
  FROM public.wallets w WHERE w.user_id = p_owner_id;

  RETURN jsonb_build_object(
    'success',          true,
    'refunded_diamonds', v_refund_amount,
    'refund_rate',       v_refund_rate,
    'hours_elapsed',     v_hours_elapsed,
    'original_diamond',  v_diamond_amount,
    'original_heart',    v_heart_amount
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.refund_job_cancellation_atomically(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refund_job_cancellation_atomically(UUID, UUID) TO authenticated, service_role;
