-- ============================================================
-- T3: consume_diamonds_atomically 멱등성 (시그니처 불변)
--   - 부분 UNIQUE 인덱스: 동일 (user_id, ref_id, reason, currency_type) 1행
--     (currency_type 포함 — heart+diamond 2행 동시 기록 시 self-conflict 방지)
--   - 함수 진입부 선조회 가드 + 기존 결과 반환
-- 현행 본문(20260427000301) 보존: drift guard / FIFO / ledger insert
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS uq_wallet_ledger_consume_ref
  ON public.wallet_ledger (user_id, ref_id, reason, currency_type)
  WHERE reason IN ('consume_job_posting','consume_job_extend','consume_job_upgrade')
    AND ref_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.consume_diamonds_atomically(
  p_user_id  UUID,
  p_amount   INT,
  p_reason   wallet_reason,
  p_ref_id   UUID,
  p_ref_type TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_wallet           wallets%ROWTYPE;
  v_heart_consumed   INT := 0;
  v_diamond_consumed INT := 0;
  v_remaining        INT := p_amount;
  v_lot              RECORD;
  v_take             INT;
  v_now              TIMESTAMPTZ := now();
  v_existing         RECORD;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_USER_ID: user_id required';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT: % must be positive', p_amount;
  END IF;

  -- 멱등 선조회: 동일 ref 차감 이미 있으면 재차감 없이 기존 합산 반환
  IF p_ref_id IS NOT NULL
     AND p_reason IN ('consume_job_posting','consume_job_extend','consume_job_upgrade') THEN
    SELECT
      COALESCE(SUM(CASE WHEN currency_type='heart'   THEN -delta ELSE 0 END),0)::int AS h,
      COALESCE(SUM(CASE WHEN currency_type='diamond' THEN -delta ELSE 0 END),0)::int AS d,
      count(*) AS n
    INTO v_existing
    FROM public.wallet_ledger
    WHERE user_id = p_user_id AND ref_id = p_ref_id AND reason = p_reason;
    IF v_existing.n > 0 THEN
      RETURN jsonb_build_object(
        'success', true, 'idempotent', true,
        'heart_consumed', v_existing.h, 'diamond_consumed', v_existing.d
      );
    END IF;
  END IF;

  INSERT INTO wallets(user_id) VALUES (p_user_id) ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO v_wallet FROM wallets WHERE user_id = p_user_id FOR UPDATE;

  IF v_wallet.heart_balance + v_wallet.diamond_balance < p_amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE: have %h+%d, need %',
      v_wallet.heart_balance, v_wallet.diamond_balance, p_amount;
  END IF;

  FOR v_lot IN
    SELECT * FROM heart_lots
    WHERE user_id = p_user_id AND amount_remaining > 0 AND expires_at > v_now
    ORDER BY expires_at ASC, granted_at ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining = 0;
    v_take := LEAST(v_lot.amount_remaining, v_remaining);
    UPDATE heart_lots SET amount_remaining = amount_remaining - v_take WHERE id = v_lot.id;
    v_heart_consumed := v_heart_consumed + v_take;
    v_remaining := v_remaining - v_take;
  END LOOP;

  IF v_remaining > v_wallet.diamond_balance THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE: lot drift detected, real heart=%, real diamond=%, remaining need=%',
      v_heart_consumed, v_wallet.diamond_balance, v_remaining;
  END IF;

  IF v_remaining > 0 THEN
    v_diamond_consumed := v_remaining;
  END IF;

  IF v_heart_consumed > 0 THEN
    INSERT INTO wallet_ledger(user_id, currency_type, delta, reason, ref_id, ref_type,
      balance_after_heart, balance_after_diamond)
    VALUES (p_user_id, 'heart', -v_heart_consumed, p_reason, p_ref_id, p_ref_type,
      v_wallet.heart_balance - v_heart_consumed, v_wallet.diamond_balance - v_diamond_consumed);
  END IF;
  IF v_diamond_consumed > 0 THEN
    INSERT INTO wallet_ledger(user_id, currency_type, delta, reason, ref_id, ref_type,
      balance_after_heart, balance_after_diamond)
    VALUES (p_user_id, 'diamond', -v_diamond_consumed, p_reason, p_ref_id, p_ref_type,
      v_wallet.heart_balance - v_heart_consumed, v_wallet.diamond_balance - v_diamond_consumed);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'heart_consumed', v_heart_consumed,
    'diamond_consumed', v_diamond_consumed,
    'new_heart_balance', v_wallet.heart_balance - v_heart_consumed,
    'new_diamond_balance', v_wallet.diamond_balance - v_diamond_consumed
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.consume_diamonds_atomically(UUID, INT, wallet_reason, UUID, TEXT) TO authenticated;
