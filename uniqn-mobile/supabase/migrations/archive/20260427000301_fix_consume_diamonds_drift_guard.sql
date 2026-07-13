-- 후속 보강 (코드 리뷰 HIGH 이슈): cache drift over-debit 방어
-- 배경: heart_lots 실제 합과 wallets.heart_balance 캐시가 drift할 수 있음.
-- 그 경우 lot 소비 후 다이아 차감 분이 실제 diamond_balance를 초과할 위험.
-- 해결: lot loop 종료 후 v_remaining 을 v_wallet.diamond_balance와 재비교.
-- 참조: pitfall_denormalized_counter_drift.md (cached counter for write-gating 금지)

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
BEGIN
  -- p_user_id NULL 가드 (이전 review LOW 이슈)
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_USER_ID: user_id required';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT: % must be positive', p_amount;
  END IF;

  INSERT INTO wallets(user_id) VALUES (p_user_id)
    ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO v_wallet FROM wallets WHERE user_id = p_user_id FOR UPDATE;

  -- 사전 캐시 검증 (빠른 reject용)
  IF v_wallet.heart_balance + v_wallet.diamond_balance < p_amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE: have %h+%d, need %',
      v_wallet.heart_balance, v_wallet.diamond_balance, p_amount;
  END IF;

  -- 하트 FIFO 소비
  FOR v_lot IN
    SELECT * FROM heart_lots
    WHERE user_id = p_user_id
      AND amount_remaining > 0
      AND expires_at > v_now
    ORDER BY expires_at ASC, granted_at ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining = 0;
    v_take := LEAST(v_lot.amount_remaining, v_remaining);
    UPDATE heart_lots SET amount_remaining = amount_remaining - v_take
      WHERE id = v_lot.id;
    v_heart_consumed := v_heart_consumed + v_take;
    v_remaining := v_remaining - v_take;
  END LOOP;

  -- *** NEW: drift guard — lot 합계가 cache보다 적었을 때 ***
  -- v_remaining이 실제 다이아 잔액보다 크면 over-debit 위험 → 거부
  IF v_remaining > v_wallet.diamond_balance THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE: lot drift detected, real heart=%, real diamond=%, remaining need=%',
      v_heart_consumed, v_wallet.diamond_balance, v_remaining;
  END IF;

  IF v_remaining > 0 THEN
    v_diamond_consumed := v_remaining;
  END IF;

  -- ledger 기록
  IF v_heart_consumed > 0 THEN
    INSERT INTO wallet_ledger(
      user_id, currency_type, delta, reason, ref_id, ref_type,
      balance_after_heart, balance_after_diamond
    ) VALUES (
      p_user_id, 'heart', -v_heart_consumed, p_reason, p_ref_id, p_ref_type,
      v_wallet.heart_balance - v_heart_consumed,
      v_wallet.diamond_balance - v_diamond_consumed
    );
  END IF;
  IF v_diamond_consumed > 0 THEN
    INSERT INTO wallet_ledger(
      user_id, currency_type, delta, reason, ref_id, ref_type,
      balance_after_heart, balance_after_diamond
    ) VALUES (
      p_user_id, 'diamond', -v_diamond_consumed, p_reason, p_ref_id, p_ref_type,
      v_wallet.heart_balance - v_heart_consumed,
      v_wallet.diamond_balance - v_diamond_consumed
    );
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

-- GRANT는 OR REPLACE로 보존되지만 명시적으로 재선언 (defense in depth)
GRANT EXECUTE ON FUNCTION public.consume_diamonds_atomically(UUID, INT, wallet_reason, UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION public.consume_diamonds_atomically IS
  '하트→다이아 우선순위 차감. SECURITY DEFINER + FOR UPDATE race-free. INSUFFICIENT_BALANCE / INVALID_AMOUNT / INVALID_USER_ID 예외. 사전 캐시 + 사후 lot 합계 양쪽 검증으로 drift over-debit 방지. Spec §4.1 + 코드 리뷰 보강 (drift guard, NULL 가드).';
