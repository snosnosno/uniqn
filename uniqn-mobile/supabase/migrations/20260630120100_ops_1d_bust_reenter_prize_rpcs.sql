-- OPS 1d M2 — bust / reenter / set_prize_structure RPC.
-- 골격: 20260625120200_ops_1a_rpcs.sql (ops_add_rebuy). "in-play=active" 단일 정의.
-- 적대검증 반영(spec §14): finish_position="생존수 이상 최소 미사용 순위"(재진입 충돌 불가),
--   advisory 락 v_tournament_id, 마지막 생존자 가드, winner active 한정·FOR UPDATE, 좌석 id 오름차순.

-- ───────────────────────────────────────────────────────────────────────────
-- 1) ops_bust_participant — 탈락 처리(순위/상금 자동매핑·좌석해제·우승 자동확정)
CREATE OR REPLACE FUNCTION public.ops_bust_participant(
  p_participant_id uuid,
  p_actor_id uuid
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_tournament_id uuid;
  v_status public.ops_participant_status;
  v_t_status public.ops_tournament_status;
  v_active int;
  v_used_count int;
  v_finish int;
  v_prize int;
  v_active2 int;
  v_winner uuid;
  v_winner_prize int;
  v_seat_id uuid;
  v_winner_json jsonb;
BEGIN
  -- 1) actor 가드
  IF auth.uid() IS NULL
     OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;

  -- 2) 참가자 잠금
  SELECT tournament_id, status INTO v_tournament_id, v_status
    FROM public.ops_participants WHERE id = p_participant_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PARTICIPANT_NOT_FOUND: 참가자를 찾을 수 없습니다 (%)', p_participant_id
      USING ERRCODE = 'P0001';
  END IF;

  -- 3) 멤버십
  IF NOT (public.is_ops_member(v_tournament_id, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 관리 권한 없음' USING ERRCODE = 'P0001';
  END IF;

  -- 4) advisory 락 먼저 → 대회 상태 잠금/검증
  PERFORM pg_advisory_xact_lock(hashtext('ops_tournament_' || v_tournament_id::text)::bigint);
  SELECT status INTO v_t_status FROM public.ops_tournaments
    WHERE id = v_tournament_id FOR UPDATE;
  IF v_t_status <> 'active' THEN
    RAISE EXCEPTION 'INVALID_STATUS: 진행 중(active) 대회만 탈락 처리 가능 (status=%)', v_t_status
      USING ERRCODE = 'P0001';
  END IF;

  -- 5) 참가자 status 가드
  IF v_status = 'busted' THEN
    RAISE EXCEPTION 'PARTICIPANT_ALREADY_BUSTED: 이미 탈락 처리된 참가자입니다' USING ERRCODE = 'P0001';
  ELSIF v_status <> 'active' THEN
    RAISE EXCEPTION 'PARTICIPANT_NOT_ACTIVE: 활성 참가자만 탈락 처리 가능 (status=%)', v_status
      USING ERRCODE = 'P0001';
  END IF;

  -- 6) 생존수(자기 포함) + 마지막 생존자 가드
  SELECT count(*) INTO v_active FROM public.ops_participants
    WHERE tournament_id = v_tournament_id AND status = 'active';
  IF v_active <= 1 THEN
    RAISE EXCEPTION 'PARTICIPANT_LAST_SURVIVOR: 마지막 생존자는 탈락 처리할 수 없습니다(우승 처리 대상)'
      USING ERRCODE = 'P0001';
  END IF;

  -- 7) finish_position = 생존수 이상 최소 미사용 순위(재진입 충돌 불가)
  SELECT count(*) INTO v_used_count FROM public.ops_participants
    WHERE tournament_id = v_tournament_id AND finish_position IS NOT NULL;
  SELECT g INTO v_finish
    FROM generate_series(v_active, v_active + v_used_count) AS g
    WHERE NOT EXISTS (
      SELECT 1 FROM public.ops_participants
      WHERE tournament_id = v_tournament_id AND finish_position = g)
    ORDER BY g LIMIT 1;

  -- 8) prize 매핑(없으면 NULL=out of money)
  SELECT amount INTO v_prize FROM public.ops_prizes
    WHERE tournament_id = v_tournament_id AND rank = v_finish;

  -- 9) 변이
  UPDATE public.ops_participants
    SET status = 'busted', busted_at = now(), finish_position = v_finish,
        prize_amount = v_prize, chips = 0
    WHERE id = p_participant_id;

  -- 10) 좌석 해제(id 오름차순 잠금 — 1b 좌석 RPC와 동일 순서, 데드락 회피)
  FOR v_seat_id IN
    SELECT id FROM public.ops_seats
    WHERE participant_id = p_participant_id ORDER BY id FOR UPDATE
  LOOP
    UPDATE public.ops_seats SET participant_id = NULL WHERE id = v_seat_id;
    INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
    VALUES (v_tournament_id, 'seat_freed', p_actor_id,
            jsonb_build_object('participant_id', p_participant_id, 'seat_id', v_seat_id));
  END LOOP;

  -- 11) 이벤트
  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (v_tournament_id, 'player_busted', p_actor_id,
          jsonb_build_object('participant_id', p_participant_id,
                             'finish_position', v_finish, 'prize_amount', v_prize));
  IF v_prize IS NOT NULL THEN
    INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
    VALUES (v_tournament_id, 'prize_assigned', p_actor_id,
            jsonb_build_object('participant_id', p_participant_id, 'rank', v_finish, 'amount', v_prize));
  END IF;

  -- 12) 우승 자동확정(active 만 후보)
  SELECT count(*) INTO v_active2 FROM public.ops_participants
    WHERE tournament_id = v_tournament_id AND status = 'active';
  v_winner_json := NULL;
  IF v_active2 = 1 THEN
    SELECT id INTO v_winner FROM public.ops_participants
      WHERE tournament_id = v_tournament_id AND status = 'active' FOR UPDATE;
    SELECT amount INTO v_winner_prize FROM public.ops_prizes
      WHERE tournament_id = v_tournament_id AND rank = 1;
    UPDATE public.ops_participants
      SET finish_position = 1, prize_amount = v_winner_prize WHERE id = v_winner;
    UPDATE public.ops_tournaments SET status = 'completed' WHERE id = v_tournament_id;
    INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
    VALUES (v_tournament_id, 'tournament_status_changed', p_actor_id,
            jsonb_build_object('from', 'active', 'to', 'completed', 'reason', 'winner_finalized'));
    IF v_winner_prize IS NOT NULL THEN
      INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
      VALUES (v_tournament_id, 'prize_assigned', p_actor_id,
              jsonb_build_object('participant_id', v_winner, 'rank', 1, 'amount', v_winner_prize));
    END IF;
    v_winner_json := jsonb_build_object('participant_id', v_winner,
                                        'finish_position', 1, 'prize_amount', v_winner_prize);
  END IF;

  -- 13) 반환
  RETURN jsonb_build_object(
    'participant_id', p_participant_id,
    'finish_position', v_finish,
    'prize_amount', v_prize,
    'winner_finalized', (v_active2 = 1),
    'winner', v_winner_json);
END;
$function$;

-- ───────────────────────────────────────────────────────────────────────────
-- 2) ops_reenter_participant — 재진입(동일 행 재활성화·카운터·auto-seat)
CREATE OR REPLACE FUNCTION public.ops_reenter_participant(
  p_participant_id uuid,
  p_actor_id uuid
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_tournament_id uuid;
  v_status public.ops_participant_status;
  v_reentries int;
  v_t_status public.ops_tournament_status;
  v_reentry_allowed boolean;
  v_max_reentries int;
  v_starting_chips int;
  v_auto_seat boolean;
  v_seat_id uuid;
  v_new_status public.ops_participant_status;
  v_seated boolean;
BEGIN
  IF auth.uid() IS NULL
     OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;

  SELECT tournament_id, status, reentries INTO v_tournament_id, v_status, v_reentries
    FROM public.ops_participants WHERE id = p_participant_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PARTICIPANT_NOT_FOUND: 참가자를 찾을 수 없습니다 (%)', p_participant_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT (public.is_ops_member(v_tournament_id, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 관리 권한 없음' USING ERRCODE = 'P0001';
  END IF;

  -- advisory 락 먼저 → 대회 잠금
  PERFORM pg_advisory_xact_lock(hashtext('ops_tournament_' || v_tournament_id::text)::bigint);
  SELECT status, reentry_allowed, max_reentries, starting_chips, auto_seat_on_register
    INTO v_t_status, v_reentry_allowed, v_max_reentries, v_starting_chips, v_auto_seat
    FROM public.ops_tournaments WHERE id = v_tournament_id FOR UPDATE;
  IF v_t_status <> 'active' THEN
    RAISE EXCEPTION 'INVALID_STATUS: 진행 중(active) 대회만 재진입 가능 (status=%)', v_t_status
      USING ERRCODE = 'P0001';
  END IF;

  IF v_status <> 'busted' THEN
    RAISE EXCEPTION 'PARTICIPANT_NOT_BUSTED: 탈락 상태가 아니어서 재진입할 수 없습니다 (status=%)', v_status
      USING ERRCODE = 'P0001';
  END IF;
  IF v_reentry_allowed = false THEN
    RAISE EXCEPTION 'REENTRY_NOT_ALLOWED: 이 대회는 재진입이 허용되지 않습니다' USING ERRCODE = 'P0001';
  END IF;
  IF v_max_reentries IS NOT NULL AND v_reentries >= v_max_reentries THEN
    RAISE EXCEPTION 'MAX_REENTRIES_EXCEEDED: 최대 재진입 횟수를 초과했습니다 (max=%)', v_max_reentries
      USING ERRCODE = 'P0001';
  END IF;

  -- auto-seat 결정(register 미러: 좌석 확보 시에만 active)
  v_seat_id := NULL;
  IF v_auto_seat THEN
    SELECT s.id INTO v_seat_id
      FROM public.ops_seats s
      JOIN public.ops_tables t ON t.id = s.table_id
      WHERE s.tournament_id = v_tournament_id
        AND s.participant_id IS NULL
        AND t.status = 'open' AND t.lock_type = 'none'
      ORDER BY s.table_no, s.seat_no
      LIMIT 1 FOR UPDATE OF s SKIP LOCKED;
  END IF;
  v_seated := v_seat_id IS NOT NULL;
  v_new_status := CASE WHEN v_seated THEN 'active'::public.ops_participant_status
                       ELSE 'checked_in'::public.ops_participant_status END;

  UPDATE public.ops_participants
    SET chips = v_starting_chips, finish_position = NULL, busted_at = NULL,
        prize_amount = NULL, reentries = v_reentries + 1, status = v_new_status
    WHERE id = p_participant_id;

  IF v_seated THEN
    UPDATE public.ops_seats SET participant_id = p_participant_id WHERE id = v_seat_id;
  END IF;

  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (v_tournament_id, 'player_reentered', p_actor_id,
          jsonb_build_object('participant_id', p_participant_id,
                             'reentries', v_reentries + 1, 'seated', v_seated));

  RETURN jsonb_build_object('participant_id', p_participant_id,
                            'reentries', v_reentries + 1, 'status', v_new_status, 'seated', v_seated);
END;
$function$;

-- ───────────────────────────────────────────────────────────────────────────
-- 3) ops_set_prize_structure — 순위별 고정 상금 구조 replace-all
CREATE OR REPLACE FUNCTION public.ops_set_prize_structure(
  p_tournament_id uuid,
  p_actor_id uuid,
  p_prizes jsonb
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_t_status public.ops_tournament_status;
  v_count int;
  v_distinct int;
  v_bad int;
BEGIN
  IF auth.uid() IS NULL
     OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;

  SELECT status INTO v_t_status FROM public.ops_tournaments
    WHERE id = p_tournament_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TOURNAMENT_NOT_FOUND: 대회를 찾을 수 없습니다 (%)', p_tournament_id
      USING ERRCODE = 'P0001';
  END IF;
  IF NOT (public.is_ops_member(p_tournament_id, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 관리 권한 없음' USING ERRCODE = 'P0001';
  END IF;
  IF v_t_status = 'completed' THEN
    RAISE EXCEPTION 'INVALID_STATUS: 종료된 대회의 상금 구조는 변경할 수 없습니다' USING ERRCODE = 'P0001';
  END IF;

  IF jsonb_typeof(p_prizes) <> 'array' THEN
    RAISE EXCEPTION 'PRIZE_STRUCTURE_INVALID: 상금 구조 형식이 올바르지 않습니다' USING ERRCODE = 'P0001';
  END IF;

  SELECT count(*),
         count(DISTINCT (e->>'rank')::int),
         count(*) FILTER (WHERE (e->>'rank') IS NULL OR (e->>'amount') IS NULL
                             OR (e->>'rank')::int <= 0 OR (e->>'amount')::int < 1)
    INTO v_count, v_distinct, v_bad
    FROM jsonb_array_elements(p_prizes) e;
  IF v_bad > 0 OR v_count <> v_distinct THEN
    RAISE EXCEPTION 'PRIZE_STRUCTURE_INVALID: 순위·금액이 올바르지 않습니다(중복/0이하)' USING ERRCODE = 'P0001';
  END IF;

  DELETE FROM public.ops_prizes WHERE tournament_id = p_tournament_id;
  IF v_count > 0 THEN
    INSERT INTO public.ops_prizes (tournament_id, rank, amount)
    SELECT p_tournament_id, (e->>'rank')::int, (e->>'amount')::int
      FROM jsonb_array_elements(p_prizes) e;
  END IF;

  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (p_tournament_id, 'prize_structure_set', p_actor_id,
          jsonb_build_object('count', v_count));

  RETURN jsonb_build_object('tournament_id', p_tournament_id, 'count', v_count);
END;
$function$;
