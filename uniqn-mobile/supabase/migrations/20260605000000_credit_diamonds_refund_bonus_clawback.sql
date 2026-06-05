-- [P1] 첫충전 보너스 환불 클로백 — credit_diamonds_atomically
--
-- 근거: rev1 보안·머니 리뷰 (docs/planning/2026-06-05-rev1-security-money-fixes.md §1-1)
-- 문제: 첫충전 +5💎 보너스를 별도 row 로 적립하나, 환불(p_diamonds<0) 경로가 메인 row 만
--       반전하고 보너스·lifetime 을 건드리지 않아 buy→refund 로 계정당 5💎 영구취득.
-- 결정: lifetime_purchased_diamonds 를 net(구매−환불) 의미로 전환.
--       전액환불로 net lifetime 이 0 에 도달하면 미상환 첫충전 보너스를 클로백(음수 row).
--       이후 재구매 시 보너스 재취득 = 실제 retain 된 첫구매에만 보너스(정합).
-- 안전: 적용 시점 prod purchase/refund/bonus ledger row 0건, lifetime>0 지갑 0건 → 기존 데이터 영향 0.
--       본문은 현행(20260427000400) 보존 + step 6 만 net/clawback 으로 교체.

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
  v_net_bonus           INT := 0;   -- [P1] 미상환 첫충전 보너스 잔액(grant_first_purchase_bonus delta 합)
  v_lifetime_after      INT;        -- [P1] 환불 후 net lifetime
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

  -- 6) lifetime 누계 + 환불 클로백 (P1: net 의미 + 첫충전 보너스 회수)
  IF p_diamonds > 0 THEN
    -- 구매: lifetime 가산
    UPDATE public.wallets
       SET lifetime_purchased_diamonds = lifetime_purchased_diamonds + p_diamonds
     WHERE user_id = p_user_id;
  ELSE
    -- 환불: lifetime 을 net(구매−환불)으로 감소 (floor 0)
    v_lifetime_after := GREATEST(0, v_wallet.lifetime_purchased_diamonds + p_diamonds);

    -- 미상환 첫충전 보너스 잔액 = grant_first_purchase_bonus delta 합(지급+ / 기존 클로백-)
    SELECT COALESCE(SUM(delta), 0)::int
      INTO v_net_bonus
      FROM public.wallet_ledger
     WHERE user_id = p_user_id
       AND reason = 'grant_first_purchase_bonus';

    -- net lifetime 이 0 으로 떨어졌고 미상환 보너스가 남아있으면 보너스 클로백 row 적립
    -- (메인 환불 row 뒤에 INSERT → 잔액 캐시 트리거가 클로백 반영값을 최종 복사)
    IF v_lifetime_after = 0 AND v_net_bonus > 0 THEN
      INSERT INTO public.wallet_ledger(
        user_id, currency_type, delta, reason, ref_type,
        balance_after_heart, balance_after_diamond, metadata
      ) VALUES (
        p_user_id, 'diamond', -v_net_bonus, 'grant_first_purchase_bonus', 'revenuecat',
        v_wallet.heart_balance,
        GREATEST(0, v_wallet.diamond_balance + p_diamonds - v_net_bonus),
        jsonb_build_object('clawback', true, 'source_transaction_id', p_revenuecat_transaction_id)
      );
      v_new_diamond_balance := v_new_diamond_balance - v_net_bonus;  -- 반환값에도 반영
    END IF;

    UPDATE public.wallets
       SET lifetime_purchased_diamonds = v_lifetime_after
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

-- 권한 보존: webhook(service_role) 전용. #163 anon/authenticated REVOKE 유지(CREATE OR REPLACE는 권한 보존).
COMMENT ON FUNCTION public.credit_diamonds_atomically IS
  'RevenueCat webhook 전용 (service_role only). p_diamonds 양수=구매, 음수=환불. '
  'revenuecat_transaction_id UNIQUE 멱등성. 첫 구매 시 +5💎 보너스. '
  '[P1 2026-06-05] 환불 시 lifetime net 감소 + net lifetime=0 도달 시 첫충전 보너스 클로백.';
