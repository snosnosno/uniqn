-- 후속 보강: refund_job_cancellation_atomically 권한 체크 순서 조정
-- 배경: 타인이 호출 시 user_id 필터 때문에 no_consumption_found가 먼저 응답됨.
--   보안상 deny는 동일하나 spec(Plan Task 8)은 unauthorized 응답 기대.
--   posting 존재 + 소유주 일치 검증을 consumption 합산 전으로 이동한다.
-- 멱등성 → 권한 → 합산 → 환불 순서로 명확화.

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

  -- 2) 권한: posting 존재 + 소유주 일치 (consumption 합산 이전에)
  IF NOT EXISTS (
    SELECT 1 FROM public.job_postings WHERE id = p_posting_id AND owner_id = p_owner_id
  ) THEN
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

  -- 5) 환불 ledger row
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
