-- refund_job_cancellation_atomically:
-- 공고 취소 시 다이아 환불을 단일 트랜잭션으로 수행
-- 24h 이내 100% / 이후 50% (FLOOR) — Decision #1
-- 하트+다이아 합산을 다이아로 환불 (하트 만료 정책상 다이아 비례 환불)
-- 같은 ref_id에 refund_job_cancelled row 있으면 idempotent
-- Spec §11, Plan Task 8

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
BEGIN
  -- 0) NULL 가드
  IF p_posting_id IS NULL OR p_owner_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_args');
  END IF;

  -- 1) 멱등성: 이미 같은 공고에 refund_job_cancelled row가 있는지
  SELECT id INTO v_existing_refund FROM public.wallet_ledger
    WHERE ref_id = p_posting_id
      AND user_id = p_owner_id
      AND reason = 'refund_job_cancelled'
    LIMIT 1;
  IF v_existing_refund IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true);
  END IF;

  -- 2) 차감 row 합산 (consume_job_posting / extend / upgrade 모두)
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

  -- 3) 권한 검증 (posting 소유주 일치)
  IF NOT EXISTS (
    SELECT 1 FROM public.job_postings WHERE id = p_posting_id AND owner_id = p_owner_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  -- 4) 환불 비율 계산 (Decision #1)
  v_hours_elapsed := EXTRACT(EPOCH FROM (v_now - v_first_consume_at)) / 3600;
  v_refund_rate := CASE WHEN v_hours_elapsed < 24 THEN 1.0 ELSE 0.5 END;
  -- 다이아만 환불 (하트는 만료 정책상 환불 어려움 → 다이아 비례 환불)
  v_refund_amount := FLOOR((v_diamond_amount + v_heart_amount) * v_refund_rate)::int;

  -- 5) 환불 ledger row (다이아로 환불, balance는 캐시 trigger가 동기화)
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
           'original_heart', v_heart_amount,
           'refund_rate', v_refund_rate,
           'hours_elapsed', v_hours_elapsed
         )
  FROM public.wallets w WHERE w.user_id = p_owner_id;

  RETURN jsonb_build_object(
    'success', true,
    'refunded_diamonds', v_refund_amount,
    'refund_rate', v_refund_rate,
    'hours_elapsed', v_hours_elapsed,
    'original_diamond', v_diamond_amount,
    'original_heart', v_heart_amount
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.refund_job_cancellation_atomically(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refund_job_cancellation_atomically(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refund_job_cancellation_atomically(UUID, UUID) TO service_role;

COMMENT ON FUNCTION public.refund_job_cancellation_atomically IS
  '공고 취소 환불. 24h 이내 100%, 이후 50% (FLOOR). 하트+다이아 합산을 다이아로 환불. ref_id에 같은 refund row 있으면 idempotent. Decision #1, Spec §11.';
