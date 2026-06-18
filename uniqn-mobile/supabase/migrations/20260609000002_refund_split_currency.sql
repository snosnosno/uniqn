-- ============================================================
-- M2: refund_job_cancellation_atomically — 통화별 분리 환불 (하트→다이아 세탁 봉쇄)
--
-- 결함(P1): 기존 환불은 (다이아+하트) 합산을 무조건 'diamond'로 적립하고 heart_lots를
--           복원하지 않음 → 무료·90일만료 하트가 영구·유료 다이아로 환전(세탁).
--
-- 수정:
--   · 다이아 분: FLOOR(diamond_amount * rate) → diamond ledger row (현행과 동일).
--   · 하트 분 : M1이 기록한 heart ledger metadata.heart_lots_consumed 를 읽어,
--              각 소비 lot의 FLOOR(amount * rate)만큼 **원래 expires_at로 heart_lot 재생성**.
--              이미 만료된 lot(expires_at <= now)은 복원 제외(house-favorable·정확).
--              합산 delta로 heart ledger row 1건 기록 → 잔액 트리거가 캐시 sync.
--   · legacy fallback: 소비 row에 metadata 없으면(M1 이전) FLOOR(heart_amount*rate)를 신규 90일 lot로.
--   · 멱등 인덱스: (user_id, ref_id, reason) → (..., currency_type) 로 교체
--                 (heart row + diamond row 공존 허용, 이중환불은 여전히 차단).
--
-- 멱등 보장: wallets FOR UPDATE 직렬화 + 락 안 선조회(any refund row → idempotent) 가 1차,
--            부분 UNIQUE 인덱스가 backstop. heart_lots INSERT는 heart ledger row가 실제
--            삽입된 경우에만(ON CONFLICT 미충돌) 수행 → 중복 lot 생성 차단.
-- 현행 본문 출처: 20260602000010_refund_idempotency_lock.sql
-- ============================================================

-- (1) 멱등 인덱스 교체: currency_type 포함 (heart+diamond 2행 공존 허용)
DROP INDEX IF EXISTS public.uq_wallet_ledger_refund_job;
CREATE UNIQUE INDEX IF NOT EXISTS uq_wallet_ledger_refund_job
  ON public.wallet_ledger(user_id, ref_id, reason, currency_type)
  WHERE reason = 'refund_job_cancelled';

-- (2) 환불 RPC: 통화별 분리 + 하트 lot 원만료일 복원
CREATE OR REPLACE FUNCTION public.refund_job_cancellation_atomically(p_posting_id uuid, p_owner_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_existing_refund   UUID;
  v_first_consume_at  TIMESTAMPTZ;
  v_hours_elapsed     NUMERIC;
  v_refund_rate       NUMERIC;
  v_diamond_amount    INT;
  v_heart_amount      INT;
  v_diamond_refund    INT := 0;
  v_heart_refund      INT := 0;
  v_now               TIMESTAMPTZ := now();
  v_caller            UUID        := auth.uid();
  v_post_owner        UUID;
  v_locked_heart      INT;
  v_locked_diamond    INT;
  v_consumed_lots     JSONB;
  v_restore_lots      JSONB := '[]'::jsonb;
  v_elem              JSONB;
  v_orig_expires      TIMESTAMPTZ;
  v_orig_amount       INT;
  v_restore           INT;
  v_meta              JSONB;
  v_heart_inserted    INT := 0;
BEGIN
  IF p_posting_id IS NULL OR p_owner_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_args');
  END IF;

  -- wallet 행 잠금 — consume/credit과 직렬화(캐시 drift 방지) + 멱등 선조회를 임계영역 안으로.
  INSERT INTO public.wallets(user_id) VALUES (p_owner_id) ON CONFLICT (user_id) DO NOTHING;
  SELECT heart_balance, diamond_balance INTO v_locked_heart, v_locked_diamond
    FROM public.wallets WHERE user_id = p_owner_id FOR UPDATE;

  -- 1) 멱등성 (락 보유 상태) — 동일 posting 환불 row가 이미 있으면 종료
  SELECT id INTO v_existing_refund FROM public.wallet_ledger
    WHERE ref_id = p_posting_id
      AND user_id = p_owner_id
      AND reason = 'refund_job_cancelled'
    LIMIT 1;
  IF v_existing_refund IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true);
  END IF;

  -- 2a) posting 존재 + 비용 주체(owner) 일치
  SELECT owner_id INTO v_post_owner FROM public.job_postings WHERE id = p_posting_id;
  IF v_post_owner IS NULL OR v_post_owner <> p_owner_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  -- 2b) caller 권한: service_role(NULL) / owner 본인 / JPC 협업자
  IF v_caller IS NOT NULL
     AND v_caller <> p_owner_id
     AND NOT public.is_posting_collaborator(p_posting_id, v_caller) THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  -- 3) 차감 row 합산 (다이아/하트 별)
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

  -- 4) 환불 비율 (24h 내 100% / 이후 50%)
  v_hours_elapsed := EXTRACT(EPOCH FROM (v_now - v_first_consume_at)) / 3600;
  v_refund_rate := CASE WHEN v_hours_elapsed < 24 THEN 1.0 ELSE 0.5 END;

  -- 5) 다이아 분 환불액
  v_diamond_refund := FLOOR(v_diamond_amount * v_refund_rate)::int;

  -- 6) 하트 분 복원 계획 — M1 metadata에서 소비 lot {expires_at, amount} 집계
  SELECT COALESCE(jsonb_agg(j.elem), '[]'::jsonb)
  INTO v_consumed_lots
  FROM public.wallet_ledger wl
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(wl.metadata->'heart_lots_consumed', '[]'::jsonb)) AS j(elem)
  WHERE wl.ref_id = p_posting_id
    AND wl.user_id = p_owner_id
    AND wl.currency_type = 'heart'
    AND wl.reason IN ('consume_job_posting','consume_job_extend','consume_job_upgrade');

  IF jsonb_array_length(v_consumed_lots) > 0 THEN
    -- 정밀 복원: 소비 lot별 원만료일 보존, 이미 만료분 제외
    FOR v_elem IN SELECT jsonb_array_elements(v_consumed_lots) LOOP
      v_orig_expires := (v_elem->>'expires_at')::timestamptz;
      v_orig_amount  := (v_elem->>'amount')::int;
      IF v_orig_expires > v_now THEN
        v_restore := FLOOR(v_orig_amount * v_refund_rate)::int;
        IF v_restore > 0 THEN
          v_restore_lots := v_restore_lots || jsonb_build_object('amount', v_restore, 'expires_at', v_orig_expires);
          v_heart_refund := v_heart_refund + v_restore;
        END IF;
      END IF;
    END LOOP;
  ELSIF v_heart_amount > 0 THEN
    -- legacy fallback (M1 이전 소비 row, metadata 없음): 신규 90일 lot
    v_restore := FLOOR(v_heart_amount * v_refund_rate)::int;
    IF v_restore > 0 THEN
      v_restore_lots := v_restore_lots || jsonb_build_object('amount', v_restore, 'expires_at', v_now + interval '90 days');
      v_heart_refund := v_restore;
    END IF;
  END IF;

  v_meta := jsonb_build_object(
    'original_diamond', v_diamond_amount,
    'original_heart',   v_heart_amount,
    'refunded_diamond', v_diamond_refund,
    'refunded_heart',   v_heart_refund,
    'refund_rate',      v_refund_rate,
    'hours_elapsed',    v_hours_elapsed,
    'restored_lots',    jsonb_array_length(v_restore_lots),
    'cancelled_by',     v_caller
  );

  -- 7) 다이아 환불 ledger row (분이 있을 때만)
  IF v_diamond_refund > 0 THEN
    INSERT INTO public.wallet_ledger(
      user_id, currency_type, delta, reason, ref_id, ref_type,
      balance_after_heart, balance_after_diamond, metadata
    )
    VALUES (
      p_owner_id, 'diamond', v_diamond_refund, 'refund_job_cancelled',
      p_posting_id, 'job_posting',
      v_locked_heart + v_heart_refund,
      v_locked_diamond + v_diamond_refund,
      v_meta
    )
    ON CONFLICT (user_id, ref_id, reason, currency_type) WHERE reason = 'refund_job_cancelled' DO NOTHING;
  END IF;

  -- 8) 하트 환불 ledger row + heart_lot 재생성 (분이 있을 때만)
  IF v_heart_refund > 0 THEN
    INSERT INTO public.wallet_ledger(
      user_id, currency_type, delta, reason, ref_id, ref_type,
      balance_after_heart, balance_after_diamond, metadata
    )
    VALUES (
      p_owner_id, 'heart', v_heart_refund, 'refund_job_cancelled',
      p_posting_id, 'job_posting',
      v_locked_heart + v_heart_refund,
      v_locked_diamond + v_diamond_refund,
      v_meta
    )
    ON CONFLICT (user_id, ref_id, reason, currency_type) WHERE reason = 'refund_job_cancelled' DO NOTHING;

    GET DIAGNOSTICS v_heart_inserted = ROW_COUNT;
    -- ledger heart row가 실제 삽입된 경우에만 lot 생성(중복 lot 방지)
    IF v_heart_inserted > 0 THEN
      FOR v_elem IN SELECT jsonb_array_elements(v_restore_lots) LOOP
        INSERT INTO public.heart_lots(
          user_id, amount_initial, amount_remaining, expires_at, source, source_ref_id
        )
        VALUES (
          p_owner_id,
          (v_elem->>'amount')::int,
          (v_elem->>'amount')::int,
          (v_elem->>'expires_at')::timestamptz,
          'refund_job_cancelled',
          p_posting_id
        );
      END LOOP;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success',           true,
    'refunded_diamonds', v_diamond_refund,
    'refunded_hearts',   v_heart_refund,
    'refund_rate',       v_refund_rate,
    'hours_elapsed',     v_hours_elapsed,
    'original_diamond',  v_diamond_amount,
    'original_heart',    v_heart_amount
  );
END;
$function$;

COMMENT ON FUNCTION public.refund_job_cancellation_atomically IS
  '공고취소 환불 — 통화별 분리(M2). 다이아분=diamond ledger, 하트분=원만료일 heart_lot 재생성(만료분 제외, metadata 없으면 90일 fallback). wallets FOR UPDATE 직렬화 + currency_type 포함 부분 UNIQUE로 이중환불 차단. 하트→다이아 세탁 봉쇄.';
