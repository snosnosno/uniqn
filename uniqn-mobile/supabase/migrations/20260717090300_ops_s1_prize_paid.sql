-- ops 전면 개방 S1 — C4 상금 지급 마킹(paid_at). undo-first(§12.4-2): 같은 RPC 로 지급/취소 왕복.
-- 이벤트 타입 prize_paid / prize_paid_undone 은 20260717090000 에서 선행 추가(같은 트랜잭션 사용 금지 함정).
-- 계약: anon-executable ops SECDEF =2 유지 — PUBLIC/anon REVOKE 필수.

ALTER TABLE public.ops_participants
  ADD COLUMN IF NOT EXISTS prize_paid_at timestamptz;

COMMENT ON COLUMN public.ops_participants.prize_paid_at IS
  '상금 지급 완료 시각(C4). NULL=미지급. 쓰기는 ops_set_prize_paid 전용(undo 시 NULL 복귀).';

CREATE OR REPLACE FUNCTION public.ops_set_prize_paid(
  p_participant_id uuid,
  p_actor_id uuid,
  p_paid boolean
) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_p record;
  v_paid_at timestamptz;
BEGIN
  -- actor 바인딩(위조 차단) — NULL 가드 포함
  IF auth.uid() IS NULL OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;

  IF p_paid IS NULL THEN
    RAISE EXCEPTION 'OPS_PRIZE_PAID_INVALID: 지급 여부가 지정되지 않았습니다' USING ERRCODE = 'P0001';
  END IF;

  SELECT id, tournament_id, entry_number, prize_amount, prize_paid_at
    INTO v_p
    FROM public.ops_participants
    WHERE id = p_participant_id
    FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PARTICIPANT_NOT_FOUND: 참가자를 찾을 수 없습니다 (%)', p_participant_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT (public.is_ops_member(v_p.tournament_id, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 관리 권한 없음' USING ERRCODE = 'P0001';
  END IF;

  -- 상금이 배정되지 않은 참가자는 지급 마킹 대상 아님
  IF v_p.prize_amount IS NULL OR v_p.prize_amount <= 0 THEN
    RAISE EXCEPTION 'OPS_PRIZE_NOT_ASSIGNED: 상금이 배정되지 않은 참가자입니다' USING ERRCODE = 'P0001';
  END IF;

  -- 멱등: 이미 원하는 상태면 no-op (이벤트 중복 append 방지)
  IF (p_paid AND v_p.prize_paid_at IS NOT NULL) OR (NOT p_paid AND v_p.prize_paid_at IS NULL) THEN
    RETURN jsonb_build_object('participant_id', v_p.id, 'prize_paid_at', v_p.prize_paid_at);
  END IF;

  v_paid_at := CASE WHEN p_paid THEN now() ELSE NULL END;

  UPDATE public.ops_participants SET prize_paid_at = v_paid_at WHERE id = v_p.id;

  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (v_p.tournament_id,
          CASE WHEN p_paid THEN 'prize_paid'::public.ops_event_type
               ELSE 'prize_paid_undone'::public.ops_event_type END,
          p_actor_id,
          jsonb_build_object('entry_number', v_p.entry_number, 'amount', v_p.prize_amount));

  RETURN jsonb_build_object('participant_id', v_p.id, 'prize_paid_at', v_paid_at);
END;
$$;

ALTER FUNCTION public.ops_set_prize_paid(uuid, uuid, boolean) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.ops_set_prize_paid(uuid, uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ops_set_prize_paid(uuid, uuid, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.ops_set_prize_paid(uuid, uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ops_set_prize_paid(uuid, uuid, boolean) TO service_role;
