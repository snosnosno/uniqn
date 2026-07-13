-- credit_diamonds_atomically: 충전 + 환불 통합 RPC
-- RevenueCat webhook 전용 (service_role only)
-- p_diamonds 양수=구매, 음수=환불
-- revenuecat_transaction_id UNIQUE 멱등성
-- 첫 구매 시 +5💎 보너스 자동 (Decision #7)
-- Spec §4.2, Plan Task 5

CREATE OR REPLACE FUNCTION public.credit_diamonds_atomically(
  p_user_id                   UUID,
  p_diamonds                  INT,
  p_revenuecat_transaction_id TEXT,
  p_product_id                TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_wallet              wallets%ROWTYPE;
  v_existing            UUID;
  v_first_purchase      BOOLEAN := false;
  v_bonus               INT := 0;
  v_new_diamond_balance INT;
BEGIN
  -- 0) NULL 가드
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_USER_ID: cannot be NULL';
  END IF;
  IF p_diamonds = 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT: p_diamonds must be non-zero';
  END IF;
  IF p_revenuecat_transaction_id IS NULL OR p_revenuecat_transaction_id = '' THEN
    RAISE EXCEPTION 'INVALID_TRANSACTION_ID: required for idempotency';
  END IF;

  -- 1) 멱등성 체크 (같은 transaction_id 재호출 방지)
  SELECT id INTO v_existing FROM public.wallet_ledger
    WHERE revenuecat_transaction_id = p_revenuecat_transaction_id;
  IF FOUND THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true);
  END IF;

  -- 2) wallet 행 잠금 (없으면 생성)
  INSERT INTO public.wallets(user_id) VALUES (p_user_id)
    ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO v_wallet FROM public.wallets
    WHERE user_id = p_user_id FOR UPDATE;

  -- 3) 첫 구매 판정 (lifetime_purchased_diamonds = 0 AND p_diamonds > 0)
  IF p_diamonds > 0 AND v_wallet.lifetime_purchased_diamonds = 0 THEN
    v_first_purchase := true;
    v_bonus := 5;
  END IF;

  v_new_diamond_balance := v_wallet.diamond_balance + p_diamonds + v_bonus;

  -- 4) 메인 ledger row (구매 또는 환불)
  INSERT INTO public.wallet_ledger(
    user_id, currency_type, delta, reason, ref_type,
    balance_after_heart, balance_after_diamond,
    revenuecat_transaction_id, metadata
  ) VALUES (
    p_user_id, 'diamond', p_diamonds,
    CASE WHEN p_diamonds > 0 THEN 'purchase'::wallet_reason
         ELSE 'refund_purchase'::wallet_reason END,
    'revenuecat',
    v_wallet.heart_balance,
    v_wallet.diamond_balance + p_diamonds,
    p_revenuecat_transaction_id,
    jsonb_build_object('product_id', p_product_id, 'is_first_purchase', v_first_purchase)
  );

  -- 5) 첫 구매 보너스 row (별도 ledger entry, transaction_id NULL로 구별)
  IF v_bonus > 0 THEN
    INSERT INTO public.wallet_ledger(
      user_id, currency_type, delta, reason, ref_type,
      balance_after_heart, balance_after_diamond, metadata
    ) VALUES (
      p_user_id, 'diamond', v_bonus, 'grant_first_purchase_bonus', 'revenuecat',
      v_wallet.heart_balance,
      v_wallet.diamond_balance + p_diamonds + v_bonus,
      jsonb_build_object('source_transaction_id', p_revenuecat_transaction_id)
    );
  END IF;

  -- 6) lifetime 누계 (구매만 누적, 환불 음수는 누적 안 함)
  IF p_diamonds > 0 THEN
    UPDATE public.wallets
       SET lifetime_purchased_diamonds = lifetime_purchased_diamonds + p_diamonds
     WHERE user_id = p_user_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'diamonds_credited', p_diamonds,
    'first_purchase_bonus', v_bonus,
    'new_diamond_balance', GREATEST(0, v_new_diamond_balance)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.credit_diamonds_atomically(UUID, INT, TEXT, TEXT) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_diamonds_atomically(UUID, INT, TEXT, TEXT) TO service_role;

COMMENT ON FUNCTION public.credit_diamonds_atomically IS
  'RevenueCat webhook 전용 (service_role only). p_diamonds 양수=구매, 음수=환불. revenuecat_transaction_id UNIQUE 멱등성. 첫 구매 시 +5💎 보너스 자동. Spec §4.2 + Decision #7';
