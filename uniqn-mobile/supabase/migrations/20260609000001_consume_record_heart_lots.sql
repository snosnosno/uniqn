-- ============================================================
-- M1: consume_diamonds_atomically — 소비한 heart_lot 만료시각 기록
--   목적: 환불(refund) 시 "하트로 결제한 분"을 원래 만료일로 정확히 복원하기 위해,
--         FIFO 소비한 각 lot의 {expires_at, amount}를 heart ledger row metadata에 기록.
--   배경: 하트→다이아 환불 세탁 봉쇄(M2)의 선행 — refund가 이 metadata를 읽어 heart_lot 재생성.
--   불변: 시그니처/멱등(uq_wallet_ledger_consume_ref)/drift guard/FIFO/다이아 폴백/잔액 트리거 전부 보존.
--         추가는 (a) v_lots_consumed 누적 (b) heart ledger row의 metadata.heart_lots_consumed 뿐.
-- 현행 본문 출처: 20260530000003_consume_idempotency.sql
-- ============================================================

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
  v_lots_consumed    JSONB := '[]'::jsonb;  -- M1: FIFO 소비한 lot 만료시각 추적
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
    -- M1: 소비한 lot의 만료시각 + 소비량 기록 (환불 복원용)
    v_lots_consumed := v_lots_consumed || jsonb_build_object(
      'expires_at', v_lot.expires_at,
      'amount', v_take
    );
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
      balance_after_heart, balance_after_diamond, metadata)
    VALUES (p_user_id, 'heart', -v_heart_consumed, p_reason, p_ref_id, p_ref_type,
      v_wallet.heart_balance - v_heart_consumed, v_wallet.diamond_balance - v_diamond_consumed,
      jsonb_build_object('heart_lots_consumed', v_lots_consumed));
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

COMMENT ON FUNCTION public.consume_diamonds_atomically IS
  'FIFO 하트 우선 차감 + 다이아 폴백. heart ledger row metadata.heart_lots_consumed에 소비 lot {expires_at,amount} 기록(M1, 환불 복원용). 멱등 부분 UNIQUE + drift guard. service path는 authenticated.';
