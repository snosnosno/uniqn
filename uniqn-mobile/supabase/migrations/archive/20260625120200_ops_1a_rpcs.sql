-- OPS 1a — 변이 SECDEF RPC 7종 (raw write 금지: 모든 ops 쓰기는 이 RPC만 경유).
-- 패턴 출처:
--   · actor 바인딩 가드: 20260621090100_bind_mutation_rpcs_to_auth_uid.sql
--   · FOR UPDATE 할당:  20260427000300_create_consume_diamonds_rpc.sql
--   · 상태 전이 가드:   20260421001906_relax_review_report_state_transitions.sql
-- 공통 규약(계약 §6):
--   · search_path = public, extensions, pg_temp
--   · actor 가드: auth.uid() IS NULL OR (auth.uid() IS DISTINCT FROM p_actor AND NOT is_admin())
--   · 자식 RPC: 토너먼트 로드 후 is_ops_member(t_id, actor) OR is_admin() 강제
--   · 호출당 ops_events 1행 append (update 제외)
--   · 모든 비즈니스 RAISE 는 ERRCODE='P0001' (Repository.mapOpsRpcError 매핑)
-- 권한(REVOKE anon / GRANT authenticated,service_role) 은 후속 grants 마이그레이션에서 처리.

-- ───────────────────────────────────────────────────────────────────────────
-- 1) ops_create_tournament — 대회 생성 (status 'upcoming')
CREATE OR REPLACE FUNCTION public.ops_create_tournament(
  p_owner_id uuid,
  p_name text,
  p_venue text,
  p_event_date date,
  p_game_type text,
  p_job_posting_id uuid,
  p_starting_chips int,
  p_seats_per_table int,
  p_config jsonb
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_tournament_id uuid;
  v_jp record;
BEGIN
  -- [보안] 호출자 바인딩: p_owner_id 는 호출자 본인(또는 admin).
  IF auth.uid() IS NULL
     OR (auth.uid() IS DISTINCT FROM p_owner_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;

  -- 공고 연동 시: 호출자가 해당 공고를 관리할 수 있어야 함.
  IF p_job_posting_id IS NOT NULL THEN
    SELECT id, owner_id, workspace_id INTO v_jp
      FROM public.job_postings WHERE id = p_job_posting_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'TOURNAMENT_NOT_FOUND: 공고를 찾을 수 없습니다 (%)', p_job_posting_id
        USING ERRCODE = 'P0001';
    END IF;
    IF NOT (
      v_jp.owner_id = p_owner_id
      OR public.is_workspace_member(v_jp.workspace_id, p_owner_id)
      OR public.is_admin()
    ) THEN
      RAISE EXCEPTION 'PERMISSION_DENIED: 공고 관리 권한 없음' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  INSERT INTO public.ops_tournaments (
    owner_id, job_posting_id, name, venue, event_date, game_type,
    status, seats_per_table, starting_chips,
    buy_in_chips, rebuy_chips, addon_chips,
    buy_in_cost, fee_cost, rebuy_cost, addon_cost
  ) VALUES (
    p_owner_id, p_job_posting_id, p_name, p_venue, p_event_date,
    COALESCE(NULLIF(p_game_type, ''), 'NLH'),
    'upcoming', COALESCE(p_seats_per_table, 9), COALESCE(p_starting_chips, 0),
    COALESCE((p_config->>'buy_in_chips')::int, 0),
    COALESCE((p_config->>'rebuy_chips')::int, 0),
    COALESCE((p_config->>'addon_chips')::int, 0),
    COALESCE((p_config->>'buy_in_cost')::int, 0),
    COALESCE((p_config->>'fee_cost')::int, 0),
    COALESCE((p_config->>'rebuy_cost')::int, 0),
    COALESCE((p_config->>'addon_cost')::int, 0)
  ) RETURNING id INTO v_tournament_id;

  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (v_tournament_id, 'tournament_created', p_owner_id,
          jsonb_build_object('name', p_name));

  RETURN jsonb_build_object('tournament_id', v_tournament_id);
END;
$function$;

-- ───────────────────────────────────────────────────────────────────────────
-- 2) ops_update_tournament — 화이트리스트 필드만 패치 (이벤트 없음)
CREATE OR REPLACE FUNCTION public.ops_update_tournament(
  p_tournament_id uuid,
  p_actor_id uuid,
  p_patch jsonb
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL
     OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;

  SELECT id INTO v_id FROM public.ops_tournaments
    WHERE id = p_tournament_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TOURNAMENT_NOT_FOUND: 대회를 찾을 수 없습니다 (%)', p_tournament_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT (public.is_ops_member(p_tournament_id, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 관리 권한 없음' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.ops_tournaments SET
    name            = COALESCE(p_patch->>'name', name),
    venue           = COALESCE(p_patch->>'venue', venue),
    event_date      = COALESCE((p_patch->>'event_date')::date, event_date),
    game_type       = COALESCE(p_patch->>'game_type', game_type),
    starting_chips  = COALESCE((p_patch->>'starting_chips')::int, starting_chips),
    seats_per_table = COALESCE((p_patch->>'seats_per_table')::int, seats_per_table),
    buy_in_chips    = COALESCE((p_patch->>'buy_in_chips')::int, buy_in_chips),
    rebuy_chips     = COALESCE((p_patch->>'rebuy_chips')::int, rebuy_chips),
    addon_chips     = COALESCE((p_patch->>'addon_chips')::int, addon_chips),
    buy_in_cost     = COALESCE((p_patch->>'buy_in_cost')::int, buy_in_cost),
    fee_cost        = COALESCE((p_patch->>'fee_cost')::int, fee_cost),
    rebuy_cost      = COALESCE((p_patch->>'rebuy_cost')::int, rebuy_cost),
    addon_cost      = COALESCE((p_patch->>'addon_cost')::int, addon_cost),
    color           = COALESCE(p_patch->>'color', color)
  WHERE id = p_tournament_id;

  RETURN jsonb_build_object('tournament_id', p_tournament_id);
END;
$function$;

-- ───────────────────────────────────────────────────────────────────────────
-- 3) ops_set_tournament_status — 상태 전이 가드 + FOR UPDATE
CREATE OR REPLACE FUNCTION public.ops_set_tournament_status(
  p_tournament_id uuid,
  p_actor_id uuid,
  p_status ops_tournament_status
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_current ops_tournament_status;
BEGIN
  IF auth.uid() IS NULL
     OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;

  SELECT status INTO v_current FROM public.ops_tournaments
    WHERE id = p_tournament_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TOURNAMENT_NOT_FOUND: 대회를 찾을 수 없습니다 (%)', p_tournament_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT (public.is_ops_member(p_tournament_id, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 관리 권한 없음' USING ERRCODE = 'P0001';
  END IF;

  -- 합법 전이: upcoming→active, active→completed, active→upcoming(되돌리기), upcoming→completed(취소).
  IF NOT (
    (v_current = 'upcoming' AND p_status IN ('active', 'completed'))
    OR (v_current = 'active' AND p_status IN ('completed', 'upcoming'))
  ) THEN
    RAISE EXCEPTION 'INVALID_STATUS: % → % 전이 불가', v_current, p_status
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.ops_tournaments SET status = p_status WHERE id = p_tournament_id;

  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (p_tournament_id, 'tournament_status_changed', p_actor_id,
          jsonb_build_object('from', v_current, 'to', p_status));

  RETURN jsonb_build_object('tournament_id', p_tournament_id, 'status', p_status);
END;
$function$;

-- ───────────────────────────────────────────────────────────────────────────
-- 4) ops_register_participant — 워크인 등록(→active). entry# 는 next_entry_seq+1 (FOR UPDATE 직렬화)
CREATE OR REPLACE FUNCTION public.ops_register_participant(
  p_tournament_id uuid,
  p_actor_id uuid,
  p_name text,
  p_nationality text,
  p_phone text,
  p_buy_in_amount int
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_t record;
  v_entry int;
  v_participant_id uuid;
BEGIN
  IF auth.uid() IS NULL
     OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;

  -- 행 잠금: entry# 할당 직렬화.
  SELECT id, registration_open, starting_chips, next_entry_seq
    INTO v_t
    FROM public.ops_tournaments
    WHERE id = p_tournament_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TOURNAMENT_NOT_FOUND: 대회를 찾을 수 없습니다 (%)', p_tournament_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT (public.is_ops_member(p_tournament_id, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 관리 권한 없음' USING ERRCODE = 'P0001';
  END IF;

  IF v_t.registration_open = false THEN
    RAISE EXCEPTION 'REGISTRATION_CLOSED: 등록이 마감되었습니다' USING ERRCODE = 'P0001';
  END IF;

  v_entry := v_t.next_entry_seq + 1;
  UPDATE public.ops_tournaments SET next_entry_seq = v_entry WHERE id = p_tournament_id;

  INSERT INTO public.ops_participants (
    tournament_id, entry_number, name, nationality, phone,
    status, chips, buy_in_amount
  ) VALUES (
    p_tournament_id, v_entry, p_name, p_nationality, p_phone,
    'active', v_t.starting_chips, p_buy_in_amount
  ) RETURNING id INTO v_participant_id;

  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (p_tournament_id, 'player_registered', p_actor_id,
          jsonb_build_object('participant_id', v_participant_id, 'entry_number', v_entry));

  RETURN jsonb_build_object('participant_id', v_participant_id, 'entry_number', v_entry);
END;
$function$;

-- ───────────────────────────────────────────────────────────────────────────
-- 5) ops_add_rebuy — 리바이 (active 참가자만), 칩 += t.rebuy_chips
CREATE OR REPLACE FUNCTION public.ops_add_rebuy(
  p_participant_id uuid,
  p_actor_id uuid
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_p record;
  v_rebuy_chips int;
  v_chips_before int;
  v_chips_after int;
  v_rebuys int;
BEGIN
  IF auth.uid() IS NULL
     OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;

  SELECT id, tournament_id, status, chips
    INTO v_p
    FROM public.ops_participants
    WHERE id = p_participant_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PARTICIPANT_NOT_FOUND: 참가자를 찾을 수 없습니다 (%)', p_participant_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT (public.is_ops_member(v_p.tournament_id, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 관리 권한 없음' USING ERRCODE = 'P0001';
  END IF;

  IF v_p.status <> 'active' THEN
    RAISE EXCEPTION 'PARTICIPANT_NOT_ACTIVE: 활성 참가자만 리바이 가능 (status=%)', v_p.status
      USING ERRCODE = 'P0001';
  END IF;

  SELECT rebuy_chips INTO v_rebuy_chips FROM public.ops_tournaments
    WHERE id = v_p.tournament_id;

  v_chips_before := v_p.chips;
  UPDATE public.ops_participants
    SET rebuys = rebuys + 1, chips = chips + COALESCE(v_rebuy_chips, 0)
    WHERE id = p_participant_id
    RETURNING chips, rebuys INTO v_chips_after, v_rebuys;

  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (v_p.tournament_id, 'player_rebuy', p_actor_id,
          jsonb_build_object('participant_id', p_participant_id,
                             'chips_before', v_chips_before,
                             'chips_after', v_chips_after));

  RETURN jsonb_build_object('participant_id', p_participant_id,
                            'chips', v_chips_after, 'rebuys', v_rebuys);
END;
$function$;

-- ───────────────────────────────────────────────────────────────────────────
-- 6) ops_add_addon — 애드온 (active 참가자만), 칩 += t.addon_chips
CREATE OR REPLACE FUNCTION public.ops_add_addon(
  p_participant_id uuid,
  p_actor_id uuid
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_p record;
  v_addon_chips int;
  v_chips_before int;
  v_chips_after int;
  v_add_ons int;
BEGIN
  IF auth.uid() IS NULL
     OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;

  SELECT id, tournament_id, status, chips
    INTO v_p
    FROM public.ops_participants
    WHERE id = p_participant_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PARTICIPANT_NOT_FOUND: 참가자를 찾을 수 없습니다 (%)', p_participant_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT (public.is_ops_member(v_p.tournament_id, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 관리 권한 없음' USING ERRCODE = 'P0001';
  END IF;

  IF v_p.status <> 'active' THEN
    RAISE EXCEPTION 'PARTICIPANT_NOT_ACTIVE: 활성 참가자만 애드온 가능 (status=%)', v_p.status
      USING ERRCODE = 'P0001';
  END IF;

  SELECT addon_chips INTO v_addon_chips FROM public.ops_tournaments
    WHERE id = v_p.tournament_id;

  v_chips_before := v_p.chips;
  UPDATE public.ops_participants
    SET add_ons = add_ons + 1, chips = chips + COALESCE(v_addon_chips, 0)
    WHERE id = p_participant_id
    RETURNING chips, add_ons INTO v_chips_after, v_add_ons;

  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (v_p.tournament_id, 'player_addon', p_actor_id,
          jsonb_build_object('participant_id', p_participant_id,
                             'chips_before', v_chips_before,
                             'chips_after', v_chips_after));

  RETURN jsonb_build_object('participant_id', p_participant_id,
                            'chips', v_chips_after, 'add_ons', v_add_ons);
END;
$function$;

-- ───────────────────────────────────────────────────────────────────────────
-- 7) ops_toggle_registration — 등록 개폐
CREATE OR REPLACE FUNCTION public.ops_toggle_registration(
  p_tournament_id uuid,
  p_actor_id uuid,
  p_open boolean
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL
     OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;

  SELECT id INTO v_id FROM public.ops_tournaments
    WHERE id = p_tournament_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TOURNAMENT_NOT_FOUND: 대회를 찾을 수 없습니다 (%)', p_tournament_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT (public.is_ops_member(p_tournament_id, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 관리 권한 없음' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.ops_tournaments SET registration_open = p_open WHERE id = p_tournament_id;

  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (p_tournament_id, 'registration_toggled', p_actor_id,
          jsonb_build_object('open', p_open));

  RETURN jsonb_build_object('tournament_id', p_tournament_id, 'registration_open', p_open);
END;
$function$;
