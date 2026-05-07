-- grant_heart_atomically: 하트 적립 (lot 생성 + ledger 기록)
-- daily_attendance는 KST 기준 일일 1회 제한
-- claim_daily_attendance: 클라이언트 호출용 wrapper (본인만)
-- get_wallet_summary: 잔액 + 만료 임박(7일 이내) lot 조회
-- Spec §4.3, Plan Task 6

CREATE OR REPLACE FUNCTION public.grant_heart_atomically(
  p_user_id          UUID,
  p_amount           INT,
  p_reason           wallet_reason,
  p_source_ref_id    UUID DEFAULT NULL,
  p_expires_in_days  INT  DEFAULT 90
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_lot_id    UUID;
  v_expires   TIMESTAMPTZ := now() + (p_expires_in_days || ' days')::interval;
  v_today_kst DATE := (now() AT TIME ZONE 'Asia/Seoul')::date;
BEGIN
  -- 0) NULL 가드 + amount 검증
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_USER_ID: cannot be NULL';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT: % must be positive', p_amount;
  END IF;
  IF p_expires_in_days IS NULL OR p_expires_in_days <= 0 THEN
    RAISE EXCEPTION 'INVALID_EXPIRES_IN_DAYS: % must be positive', p_expires_in_days;
  END IF;

  -- 1) daily_attendance KST 일일 1회 제한
  IF p_reason = 'grant_daily_attendance' THEN
    IF EXISTS (
      SELECT 1 FROM public.wallet_ledger
      WHERE user_id = p_user_id
        AND reason = 'grant_daily_attendance'
        AND (created_at AT TIME ZONE 'Asia/Seoul')::date = v_today_kst
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'already_attended_today');
    END IF;
  END IF;

  -- 2) wallet 행 보장
  INSERT INTO public.wallets(user_id) VALUES (p_user_id)
    ON CONFLICT (user_id) DO NOTHING;

  -- 3) lot 생성 (만료 단위)
  INSERT INTO public.heart_lots(
    user_id, amount_initial, amount_remaining, expires_at, source, source_ref_id
  )
  VALUES (p_user_id, p_amount, p_amount, v_expires, p_reason, p_source_ref_id)
  RETURNING id INTO v_lot_id;

  -- 4) ledger row (trigger가 wallets 캐시 sync 처리)
  INSERT INTO public.wallet_ledger(
    user_id, currency_type, delta, reason, ref_id, ref_type,
    balance_after_heart, balance_after_diamond
  )
  SELECT p_user_id, 'heart', p_amount, p_reason,
         v_lot_id, 'heart_lot',
         w.heart_balance + p_amount, w.diamond_balance
    FROM public.wallets w
   WHERE w.user_id = p_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'lot_id', v_lot_id,
    'expires_at', v_expires,
    'amount', p_amount
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.grant_heart_atomically(UUID, INT, wallet_reason, UUID, INT) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_heart_atomically(UUID, INT, wallet_reason, UUID, INT) TO service_role;

COMMENT ON FUNCTION public.grant_heart_atomically IS
  '하트 적립 (lot + ledger). service_role only. daily_attendance는 KST 기준 일일 1회. Spec §4.3';

-- ──────────────────────────────────────────────────────────────────
-- claim_daily_attendance: 본인 출석 체크 (authenticated 호출용)
-- ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.claim_daily_attendance()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid UUID := (SELECT auth.uid());
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;
  RETURN public.grant_heart_atomically(v_uid, 1, 'grant_daily_attendance'::wallet_reason, NULL, 90);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_daily_attendance() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_daily_attendance() TO authenticated;

COMMENT ON FUNCTION public.claim_daily_attendance IS
  '본인 출석 체크 wrapper — 1💖, 90일 만료. KST 기준 일일 1회.';

-- ──────────────────────────────────────────────────────────────────
-- get_wallet_summary: 잔액 + 만료 임박(7일 이내) lot 조회
-- p_user_id 미지정 시 auth.uid() 사용. 타인 조회는 admin만.
-- Decision #3: 만료 임박 lot inline 표시용 (별도 푸시/배너 없음)
-- ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_wallet_summary(p_user_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid    UUID := COALESCE(p_user_id, (SELECT auth.uid()));
  v_caller UUID := (SELECT auth.uid());
  v_role   TEXT := COALESCE((auth.jwt() -> 'app_metadata' ->> 'role'), '');
  v_wallet public.wallets%ROWTYPE;
  v_lots   JSONB;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  -- 본인 조회만 허용 (admin 또는 service_role 우회)
  -- v_caller가 NULL이면 service_role 호출 (MCP 등) — 통과
  IF v_caller IS NOT NULL AND v_uid <> v_caller AND v_role <> 'admin' THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;

  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = v_uid;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'heart_balance', 0,
      'diamond_balance', 0,
      'lifetime_purchased_diamonds', 0,
      'expiring_lots', '[]'::jsonb
    );
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'lot_id', id,
      'amount_remaining', amount_remaining,
      'expires_at', expires_at,
      'source', source
    ) ORDER BY expires_at ASC
  ), '[]'::jsonb) INTO v_lots
  FROM public.heart_lots
  WHERE user_id = v_uid
    AND amount_remaining > 0
    AND expires_at BETWEEN now() AND now() + interval '7 days';

  RETURN jsonb_build_object(
    'heart_balance', v_wallet.heart_balance,
    'diamond_balance', v_wallet.diamond_balance,
    'lifetime_purchased_diamonds', v_wallet.lifetime_purchased_diamonds,
    'expiring_lots', v_lots
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_wallet_summary(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_wallet_summary(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_wallet_summary(UUID) TO service_role;

COMMENT ON FUNCTION public.get_wallet_summary IS
  '본인 잔액 + 7일 이내 만료 lot 조회. UI inline 표시용 (Decision #3 — 푸시/배너 없음).';
