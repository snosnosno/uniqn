-- heart_lots 만료 처리 함수 + pg_cron 등록
-- Decision #3: 알림 없음, 잔량 0 + ledger expire_heart row만
-- Spec §3.4, Plan Task 11
-- 실행 시점: 매일 KST 자정 (UTC 15:00 전일)
-- 작동: amount_remaining > 0 AND expires_at <= now() lot을 모두 처리하여
--   ledger expire_heart row 생성 + lot.amount_remaining = 0 set.
--   wallets 캐시는 ledger insert trigger가 GREATEST(0, ...)로 안전 갱신.

CREATE OR REPLACE FUNCTION public.fn_expire_heart_lots()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_lot         RECORD;
  v_total       INT := 0;
  v_users_count INT := 0;
  v_now         TIMESTAMPTZ := now();
BEGIN
  FOR v_lot IN
    SELECT id, user_id, amount_remaining
    FROM public.heart_lots
    WHERE amount_remaining > 0 AND expires_at <= v_now
    FOR UPDATE
  LOOP
    -- ledger row (cache trigger가 wallets 갱신)
    INSERT INTO public.wallet_ledger(
      user_id, currency_type, delta, reason, ref_id, ref_type,
      balance_after_heart, balance_after_diamond, metadata
    )
    SELECT v_lot.user_id, 'heart', -v_lot.amount_remaining, 'expire_heart',
           v_lot.id, 'heart_lot',
           GREATEST(0, w.heart_balance - v_lot.amount_remaining),
           w.diamond_balance,
           jsonb_build_object('expired_at', v_now)
    FROM public.wallets w WHERE w.user_id = v_lot.user_id;

    UPDATE public.heart_lots SET amount_remaining = 0 WHERE id = v_lot.id;
    v_total := v_total + v_lot.amount_remaining;
    v_users_count := v_users_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'expired_hearts', v_total,
    'affected_users', v_users_count,
    'run_at', v_now
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_expire_heart_lots() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_expire_heart_lots() TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_expire_heart_lots() TO postgres;

COMMENT ON FUNCTION public.fn_expire_heart_lots() IS
  'heart_lots FIFO 만료 처리. amount_remaining=0 + expire_heart ledger row. wallets 캐시는 trigger GREATEST(0,...) 안전. Decision #3 (알림 없음). Spec §3.4.';

-- pg_cron 등록 (매일 KST 자정 = UTC 15:00 전일)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- 기존 등록 idempotent 제거 후 재등록
    PERFORM cron.unschedule('expire_heart_lots_daily')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire_heart_lots_daily');

    PERFORM cron.schedule(
      'expire_heart_lots_daily',
      '0 15 * * *',
      $cmd$SELECT public.fn_expire_heart_lots();$cmd$
    );
  END IF;
END $$;
