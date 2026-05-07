-- 목적: 하트 FIFO 우선 소비 + 부족분 다이아 차감 RPC
-- 패턴: cancel_application_atomically (FOR UPDATE 잠금)
-- 스펙: docs/superpowers/specs/2026-04-26-monetization-design.md §4.1

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
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT: % must be positive', p_amount;
  END IF;

  INSERT INTO wallets(user_id) VALUES (p_user_id)
    ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO v_wallet FROM wallets WHERE user_id = p_user_id FOR UPDATE;

  IF v_wallet.heart_balance + v_wallet.diamond_balance < p_amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE: have %h+%d, need %',
      v_wallet.heart_balance, v_wallet.diamond_balance, p_amount;
  END IF;

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

  IF v_remaining > 0 THEN
    v_diamond_consumed := v_remaining;
  END IF;

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

GRANT EXECUTE ON FUNCTION public.consume_diamonds_atomically(UUID, INT, wallet_reason, UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION public.consume_diamonds_atomically IS
  '하트→다이아 우선순위로 차감. SECURITY DEFINER + FOR UPDATE로 race-free. 잔액 부족 시 INSUFFICIENT_BALANCE 예외. Spec §4.1';

-- ============================================================================
-- TEST SCENARIOS (executed via mcp__supabase__execute_sql 2026-04-26)
-- ============================================================================
-- Test user: b2222222-2222-4222-b222-222222222222
-- All 5 scenarios passed. See task report for evidence.
--
-- Scenario 1: 정상 차감 (다이아만)
--   Setup: wallet (0h, 100d)
--   Call:  consume(10, 'consume_job_posting', task4_test_1)
--   Expect: heart_consumed=0, diamond_consumed=10, new_h=0, new_d=90
--
-- Scenario 2: 잔액 부족
--   Setup: wallet (5h, 0d)  (no active lots)
--   Call:  consume(10)
--   Expect: EXCEPTION 'INSUFFICIENT_BALANCE: have 5h+0d, need 10'
--
-- Scenario 3: 하트 우선 소비
--   Setup: wallet (7h, 10d) + heart_lot(7, expires +30d)
--   Call:  consume(10)
--   Expect: heart_consumed=7, diamond_consumed=3, new_h=0, new_d=7
--
-- Scenario 4: 음수 amount
--   Call:  consume(-5)
--   Expect: EXCEPTION 'INVALID_AMOUNT: -5 must be positive'
--
-- Scenario 5: 만료 lot 무시
--   Setup: wallet (5h, 5d) + heart_lot(5, expires_at = now() - 1d)
--   Call:  consume(5)
--   Expect: heart_consumed=0 (만료 lot skip), diamond_consumed=5, new_h=5, new_d=0
--
-- Cleanup: DELETE FROM wallet_ledger WHERE ref_type LIKE 'task4_test%';
--          DELETE FROM heart_lots WHERE source_ref_id IN (...);
--          UPDATE wallets SET heart_balance=0, diamond_balance=0 WHERE user_id=...;
