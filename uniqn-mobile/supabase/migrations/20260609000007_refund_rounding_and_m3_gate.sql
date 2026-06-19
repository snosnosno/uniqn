-- 리뷰 적발 P2/P3 정리:
--  (P2) 환불 라운딩 비일관 — 다이아는 aggregate FLOOR(total*rate), 하트는 per-lot FLOOR(amount*rate)
--       → rate=0.5에서 1하트 lot 다수면 각 FLOOR(0.5)=0으로 하트 환불 총 0(다이아식이면 1).
--       수정: 하트도 eligible(미만료) lot 합산 후 aggregate FLOOR(eligible_total*rate)를
--            만료순(soonest-first, house-favorable) 그리디 분배 → 만료일 보존 + 정확한 총량.
--  (P3) 다이아 ledger row의 balance_after_heart가 아직 적용 안 된 하트 환불을 선반영(감사 시퀀스 부정확)
--       → 다이아 row는 v_locked_heart(그 시점 진짜 스냅샷) 기록. 하트 row가 최종값.
--  (P3) M3 멱등(이미 cancelled) 분기가 refund 결과를 검사 안 해 self-heal 실패를 swallow
--       → 1차 경로와 동일 RAISE 게이트 적용.
-- refund/M3 모두 CREATE OR REPLACE라 권한(20260609000005/000006의 service_role-only) 보존.

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
  v_eligible_lots     JSONB := '[]'::jsonb;
  v_eligible_total    INT := 0;
  v_remaining_refund  INT := 0;
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

  INSERT INTO public.wallets(user_id) VALUES (p_owner_id) ON CONFLICT (user_id) DO NOTHING;
  SELECT heart_balance, diamond_balance INTO v_locked_heart, v_locked_diamond
    FROM public.wallets WHERE user_id = p_owner_id FOR UPDATE;

  SELECT id INTO v_existing_refund FROM public.wallet_ledger
    WHERE ref_id = p_posting_id AND user_id = p_owner_id AND reason = 'refund_job_cancelled'
    LIMIT 1;
  IF v_existing_refund IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true);
  END IF;

  SELECT owner_id INTO v_post_owner FROM public.job_postings WHERE id = p_posting_id;
  IF v_post_owner IS NULL OR v_post_owner <> p_owner_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  IF v_caller IS NOT NULL
     AND v_caller <> p_owner_id
     AND NOT public.is_posting_collaborator(p_posting_id, v_caller) THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  SELECT
    COALESCE(SUM(CASE WHEN currency_type='diamond' THEN -delta ELSE 0 END), 0)::int,
    COALESCE(SUM(CASE WHEN currency_type='heart'   THEN -delta ELSE 0 END), 0)::int,
    MIN(created_at)
  INTO v_diamond_amount, v_heart_amount, v_first_consume_at
  FROM public.wallet_ledger
  WHERE ref_id = p_posting_id AND user_id = p_owner_id
    AND reason IN ('consume_job_posting','consume_job_extend','consume_job_upgrade');

  IF v_first_consume_at IS NULL OR (v_diamond_amount + v_heart_amount) <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_consumption_found');
  END IF;

  v_hours_elapsed := EXTRACT(EPOCH FROM (v_now - v_first_consume_at)) / 3600;
  v_refund_rate := CASE WHEN v_hours_elapsed < 24 THEN 1.0 ELSE 0.5 END;

  -- 다이아 환불액 (aggregate FLOOR)
  v_diamond_refund := FLOOR(v_diamond_amount * v_refund_rate)::int;

  -- 하트 분 복원: M1 metadata에서 소비 lot 집계
  SELECT COALESCE(jsonb_agg(j.elem), '[]'::jsonb)
  INTO v_consumed_lots
  FROM public.wallet_ledger wl
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(wl.metadata->'heart_lots_consumed', '[]'::jsonb)) AS j(elem)
  WHERE wl.ref_id = p_posting_id AND wl.user_id = p_owner_id AND wl.currency_type = 'heart'
    AND wl.reason IN ('consume_job_posting','consume_job_extend','consume_job_upgrade');

  IF jsonb_array_length(v_consumed_lots) > 0 THEN
    -- eligible(미만료) lot만 만료순 정렬 + 합산
    SELECT COALESCE(jsonb_agg(t.elem ORDER BY (t.elem->>'expires_at')::timestamptz ASC), '[]'::jsonb),
           COALESCE(SUM((t.elem->>'amount')::int), 0)::int
    INTO v_eligible_lots, v_eligible_total
    FROM jsonb_array_elements(v_consumed_lots) AS t(elem)
    WHERE (t.elem->>'expires_at')::timestamptz > v_now;

    -- aggregate FLOOR(총 eligible * rate)를 목표로 만료순 그리디 분배(만료일 보존)
    v_heart_refund := FLOOR(v_eligible_total * v_refund_rate)::int;
    v_remaining_refund := v_heart_refund;
    FOR v_elem IN SELECT t.elem FROM jsonb_array_elements(v_eligible_lots) AS t(elem) LOOP
      EXIT WHEN v_remaining_refund <= 0;
      v_orig_amount  := (v_elem->>'amount')::int;
      v_orig_expires := (v_elem->>'expires_at')::timestamptz;
      v_restore := LEAST(v_orig_amount, v_remaining_refund);
      IF v_restore > 0 THEN
        v_restore_lots := v_restore_lots || jsonb_build_object('amount', v_restore, 'expires_at', v_orig_expires);
        v_remaining_refund := v_remaining_refund - v_restore;
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

  -- 다이아 환불 row (먼저). balance_after_heart는 이 시점 진짜 스냅샷(하트 환불 전).
  IF v_diamond_refund > 0 THEN
    INSERT INTO public.wallet_ledger(
      user_id, currency_type, delta, reason, ref_id, ref_type,
      balance_after_heart, balance_after_diamond, metadata
    )
    VALUES (
      p_owner_id, 'diamond', v_diamond_refund, 'refund_job_cancelled',
      p_posting_id, 'job_posting',
      v_locked_heart,
      v_locked_diamond + v_diamond_refund,
      v_meta
    )
    ON CONFLICT (user_id, ref_id, reason, currency_type) WHERE reason = 'refund_job_cancelled' DO NOTHING;
  END IF;

  -- 하트 환불 row + heart_lot 재생성
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
    IF v_heart_inserted > 0 THEN
      FOR v_elem IN SELECT t.elem FROM jsonb_array_elements(v_restore_lots) AS t(elem) LOOP
        INSERT INTO public.heart_lots(
          user_id, amount_initial, amount_remaining, expires_at, source, source_ref_id
        )
        VALUES (
          p_owner_id, (v_elem->>'amount')::int, (v_elem->>'amount')::int,
          (v_elem->>'expires_at')::timestamptz, 'refund_job_cancelled', p_posting_id
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
  '공고취소 환불 — 통화별 분리(M2). 하트=eligible lot aggregate FLOOR를 만료순 분배(원만료일 보존, P2 라운딩 정정). 다이아 row balance_after_heart=락 스냅샷(P3). 세탁 봉쇄.';

-- M3: 멱등(이미 cancelled) 분기에도 환불 실패 게이트 적용(self-heal swallow 제거)
CREATE OR REPLACE FUNCTION public.cancel_job_posting_with_refund_atomically(
  p_posting_id uuid,
  p_owner_id   uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller     UUID := auth.uid();
  v_post_owner UUID;
  v_status     public.posting_status;
  v_refund     JSONB;
BEGIN
  IF p_posting_id IS NULL OR p_owner_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_args');
  END IF;

  SELECT owner_id, status INTO v_post_owner, v_status
    FROM public.job_postings WHERE id = p_posting_id;
  IF v_post_owner IS NULL OR v_post_owner <> p_owner_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  IF v_caller IS NOT NULL
     AND v_caller <> p_owner_id
     AND NOT public.is_posting_collaborator(p_posting_id, v_caller) THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  IF v_status = 'cancelled' THEN
    v_refund := public.refund_job_cancellation_atomically(p_posting_id, p_owner_id);
    -- self-heal 환불도 실패 게이트(1차 경로와 동일) — no_consumption_found는 정상
    IF COALESCE((v_refund->>'success')::boolean, false) IS NOT TRUE
       AND COALESCE(v_refund->>'error', '') <> 'no_consumption_found' THEN
      RAISE EXCEPTION 'REFUND_FAILED: %', COALESCE(v_refund->>'error', 'unknown');
    END IF;
    RETURN jsonb_build_object('success', true, 'idempotent', true, 'refund', v_refund);
  END IF;

  UPDATE public.job_postings
     SET status = 'cancelled', updated_at = now()
   WHERE id = p_posting_id;

  v_refund := public.refund_job_cancellation_atomically(p_posting_id, p_owner_id);

  IF COALESCE((v_refund->>'success')::boolean, false) IS NOT TRUE
     AND COALESCE(v_refund->>'error', '') <> 'no_consumption_found' THEN
    RAISE EXCEPTION 'REFUND_FAILED: %', COALESCE(v_refund->>'error', 'unknown');
  END IF;

  RETURN jsonb_build_object('success', true, 'refund', v_refund);
END;
$function$;
