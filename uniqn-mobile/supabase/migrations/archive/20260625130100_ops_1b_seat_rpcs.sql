-- OPS 1b — 좌석/테이블 변이 SECDEF RPC + auto-seat 활성화.
-- 패턴: 20260625120200_ops_1a_rpcs.sql (actor 가드·is_ops_member·ops_events append·P0001).
-- 권한은 후속 grants 마이그에서.

-- 공통 헬퍼: actor + 멤버십 가드를 RAISE 하는 인라인은 각 함수에 복제(SECDEF 경계).

-- 1) ops_add_table — 테이블 + 빈좌석 N 개설
CREATE OR REPLACE FUNCTION public.ops_add_table(
  p_tournament_id uuid, p_actor_id uuid, p_seat_count int,
  p_name text, p_lock_type public.ops_table_lock_type, p_priority int)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
 SET search_path = 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE v_table_no int; v_table_id uuid; v_seats int; i int;
BEGIN
  IF auth.uid() IS NULL OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;
  PERFORM 1 FROM public.ops_tournaments WHERE id = p_tournament_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TOURNAMENT_NOT_FOUND: 대회를 찾을 수 없습니다 (%)', p_tournament_id USING ERRCODE = 'P0001';
  END IF;
  IF NOT (public.is_ops_member(p_tournament_id, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 관리 권한 없음' USING ERRCODE = 'P0001';
  END IF;

  v_seats := COALESCE(NULLIF(p_seat_count, 0), 9);
  IF v_seats < 1 OR v_seats > 11 THEN
    RAISE EXCEPTION 'INVALID_SEAT_COUNT: 좌석수는 1~11 (got %)', v_seats USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(max(table_no), 0) + 1 INTO v_table_no
    FROM public.ops_tables WHERE tournament_id = p_tournament_id;

  INSERT INTO public.ops_tables (tournament_id, table_no, name, lock_type, priority)
  VALUES (p_tournament_id, v_table_no, NULLIF(p_name, ''), COALESCE(p_lock_type, 'none'), p_priority)
  RETURNING id INTO v_table_id;

  FOR i IN 1..v_seats LOOP
    INSERT INTO public.ops_seats (tournament_id, table_id, table_no, seat_no)
    VALUES (p_tournament_id, v_table_id, v_table_no, i);
  END LOOP;

  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (p_tournament_id, 'table_added', p_actor_id,
          jsonb_build_object('table_id', v_table_id, 'table_no', v_table_no, 'seats', v_seats));

  RETURN jsonb_build_object('table_id', v_table_id, 'table_no', v_table_no);
END;
$function$;

-- 2) ops_set_table_lock — lock_type 변경 (무이벤트)
CREATE OR REPLACE FUNCTION public.ops_set_table_lock(
  p_table_id uuid, p_actor_id uuid, p_lock_type public.ops_table_lock_type)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
 SET search_path = 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE v_tid uuid;
BEGIN
  IF auth.uid() IS NULL OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;
  SELECT tournament_id INTO v_tid FROM public.ops_tables WHERE id = p_table_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TABLE_NOT_FOUND: 테이블을 찾을 수 없습니다 (%)', p_table_id USING ERRCODE = 'P0001';
  END IF;
  IF NOT (public.is_ops_member(v_tid, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 관리 권한 없음' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.ops_tables SET lock_type = p_lock_type WHERE id = p_table_id;
  RETURN jsonb_build_object('table_id', p_table_id, 'lock_type', p_lock_type);
END;
$function$;

-- 3) ops_set_table_priority — priority 변경 (무이벤트). 본문은 (2)와 동형, lock_type→priority.
CREATE OR REPLACE FUNCTION public.ops_set_table_priority(
  p_table_id uuid, p_actor_id uuid, p_priority int)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
 SET search_path = 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE v_tid uuid;
BEGIN
  IF auth.uid() IS NULL OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;
  SELECT tournament_id INTO v_tid FROM public.ops_tables WHERE id = p_table_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TABLE_NOT_FOUND: 테이블을 찾을 수 없습니다 (%)', p_table_id USING ERRCODE = 'P0001';
  END IF;
  IF NOT (public.is_ops_member(v_tid, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 관리 권한 없음' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.ops_tables SET priority = p_priority WHERE id = p_table_id;
  RETURN jsonb_build_object('table_id', p_table_id, 'priority', p_priority);
END;
$function$;

-- 4) ops_close_table — status 전이. closed 는 빈좌석일 때만.
CREATE OR REPLACE FUNCTION public.ops_close_table(
  p_table_id uuid, p_actor_id uuid, p_status public.ops_table_status)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
 SET search_path = 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE v_tid uuid; v_occupied int;
BEGIN
  IF auth.uid() IS NULL OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;
  SELECT tournament_id INTO v_tid FROM public.ops_tables WHERE id = p_table_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TABLE_NOT_FOUND: 테이블을 찾을 수 없습니다 (%)', p_table_id USING ERRCODE = 'P0001';
  END IF;
  IF NOT (public.is_ops_member(v_tid, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 관리 권한 없음' USING ERRCODE = 'P0001';
  END IF;
  IF p_status = 'closed' THEN
    -- TOCTOU 차단: 이 테이블 좌석 전부 잠금 → 동시 배정/이동/대기채움/auto-seat 직렬화.
    PERFORM 1 FROM public.ops_seats WHERE table_id = p_table_id ORDER BY id FOR UPDATE;
    SELECT count(*) INTO v_occupied FROM public.ops_seats
      WHERE table_id = p_table_id AND participant_id IS NOT NULL;
    IF v_occupied > 0 THEN
      RAISE EXCEPTION 'TABLE_HAS_OCCUPANTS: 점유 좌석 % 개 — 먼저 비우세요', v_occupied USING ERRCODE = 'P0001';
    END IF;
  END IF;
  UPDATE public.ops_tables SET status = p_status WHERE id = p_table_id;
  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (v_tid, 'table_closed', p_actor_id, jsonb_build_object('table_id', p_table_id, 'status', p_status));
  RETURN jsonb_build_object('table_id', p_table_id, 'status', p_status);
END;
$function$;

-- 5) ops_assign_seat — 빈좌석에 unseated 참가자 수동 배정 → active
CREATE OR REPLACE FUNCTION public.ops_assign_seat(
  p_seat_id uuid, p_participant_id uuid, p_actor_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
 SET search_path = 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE v_seat record; v_p record; v_table_status public.ops_table_status;
BEGIN
  IF auth.uid() IS NULL OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;
  SELECT s.id, s.tournament_id, s.table_id, s.participant_id, s.table_no, s.seat_no
    INTO v_seat FROM public.ops_seats s WHERE s.id = p_seat_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SEAT_NOT_FOUND: 좌석을 찾을 수 없습니다 (%)', p_seat_id USING ERRCODE = 'P0001';
  END IF;
  IF NOT (public.is_ops_member(v_seat.tournament_id, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 관리 권한 없음' USING ERRCODE = 'P0001';
  END IF;
  IF v_seat.participant_id IS NOT NULL THEN
    RAISE EXCEPTION 'SEAT_TAKEN: 이미 점유된 좌석' USING ERRCODE = 'P0001';
  END IF;
  SELECT status INTO v_table_status FROM public.ops_tables WHERE id = v_seat.table_id;
  IF v_table_status <> 'open' THEN
    RAISE EXCEPTION 'TABLE_NOT_OPEN: open 테이블만 배정 가능 (status=%)', v_table_status USING ERRCODE = 'P0001';
  END IF;
  SELECT id, tournament_id, status INTO v_p FROM public.ops_participants
    WHERE id = p_participant_id FOR UPDATE;
  IF NOT FOUND OR v_p.tournament_id <> v_seat.tournament_id THEN
    RAISE EXCEPTION 'PARTICIPANT_NOT_FOUND: 참가자를 찾을 수 없습니다 (%)', p_participant_id USING ERRCODE = 'P0001';
  END IF;
  IF v_p.status = 'busted' OR v_p.status = 'no_show' THEN
    RAISE EXCEPTION 'PARTICIPANT_NOT_ACTIVE: 탈락/미출석 참가자는 좌석배정 불가' USING ERRCODE = 'P0001';
  END IF;
  -- 단일점유: 이미 다른 좌석이면 partial UNIQUE 가 막지만 명시 검증.
  IF EXISTS (SELECT 1 FROM public.ops_seats WHERE tournament_id = v_seat.tournament_id
               AND participant_id = p_participant_id) THEN
    RAISE EXCEPTION 'PARTICIPANT_ALREADY_SEATED: 이미 좌석 배정됨' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.ops_seats SET participant_id = p_participant_id WHERE id = p_seat_id;
  UPDATE public.ops_participants SET status = 'active'
    WHERE id = p_participant_id AND status <> 'active';
  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (v_seat.tournament_id, 'player_moved', p_actor_id,
          jsonb_build_object('participant_id', p_participant_id, 'to_table', v_seat.table_no,
                             'to_seat', v_seat.seat_no, 'from', NULL));
  RETURN jsonb_build_object('seat_id', p_seat_id, 'participant_id', p_participant_id);
END;
$function$;

-- 6) ops_move_seat — 두 좌석 FOR UPDATE(id 정렬), from NULL → to 세팅
CREATE OR REPLACE FUNCTION public.ops_move_seat(
  p_from_seat_id uuid, p_to_seat_id uuid, p_actor_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
 SET search_path = 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE v_first uuid; v_second uuid; v_from record; v_to record; v_table_status public.ops_table_status;
BEGIN
  IF auth.uid() IS NULL OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;
  IF p_from_seat_id = p_to_seat_id THEN
    RAISE EXCEPTION 'INVALID_MOVE: 동일 좌석' USING ERRCODE = 'P0001';
  END IF;
  -- 데드락 회피: id 오름차순 잠금.
  v_first := LEAST(p_from_seat_id, p_to_seat_id);
  v_second := GREATEST(p_from_seat_id, p_to_seat_id);
  PERFORM 1 FROM public.ops_seats WHERE id = v_first FOR UPDATE;
  PERFORM 1 FROM public.ops_seats WHERE id = v_second FOR UPDATE;

  SELECT id, tournament_id, participant_id, table_no, seat_no INTO v_from
    FROM public.ops_seats WHERE id = p_from_seat_id;
  SELECT id, tournament_id, table_id, participant_id, table_no, seat_no INTO v_to
    FROM public.ops_seats WHERE id = p_to_seat_id;
  IF v_from.id IS NULL OR v_to.id IS NULL THEN
    RAISE EXCEPTION 'SEAT_NOT_FOUND: 좌석을 찾을 수 없습니다' USING ERRCODE = 'P0001';
  END IF;
  IF v_from.tournament_id <> v_to.tournament_id THEN
    RAISE EXCEPTION 'INVALID_MOVE: 다른 대회 좌석' USING ERRCODE = 'P0001';
  END IF;
  IF NOT (public.is_ops_member(v_from.tournament_id, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 관리 권한 없음' USING ERRCODE = 'P0001';
  END IF;
  IF v_from.participant_id IS NULL THEN
    RAISE EXCEPTION 'SEAT_NOT_OCCUPIED: 출발 좌석이 비어있음' USING ERRCODE = 'P0001';
  END IF;
  IF v_to.participant_id IS NOT NULL THEN
    RAISE EXCEPTION 'SEAT_TAKEN: 도착 좌석이 점유됨' USING ERRCODE = 'P0001';
  END IF;
  SELECT status INTO v_table_status FROM public.ops_tables WHERE id = v_to.table_id;
  IF v_table_status <> 'open' THEN
    RAISE EXCEPTION 'TABLE_NOT_OPEN: open 테이블로만 이동 가능 (status=%)', v_table_status USING ERRCODE = 'P0001';
  END IF;
  -- partial UNIQUE 회피: from 먼저 비움.
  UPDATE public.ops_seats SET participant_id = NULL WHERE id = p_from_seat_id;
  UPDATE public.ops_seats SET participant_id = v_from.participant_id WHERE id = p_to_seat_id;
  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (v_from.tournament_id, 'player_moved', p_actor_id,
          jsonb_build_object('participant_id', v_from.participant_id,
                             'from_table', v_from.table_no, 'from_seat', v_from.seat_no,
                             'to_table', v_to.table_no, 'to_seat', v_to.seat_no));
  RETURN jsonb_build_object('participant_id', v_from.participant_id,
                            'from_seat_id', p_from_seat_id, 'to_seat_id', p_to_seat_id);
END;
$function$;

-- 7) ops_free_seat — 좌석 비우기 (참가자 status 유지)
CREATE OR REPLACE FUNCTION public.ops_free_seat(p_seat_id uuid, p_actor_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
 SET search_path = 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE v_seat record;
BEGIN
  IF auth.uid() IS NULL OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;
  SELECT id, tournament_id, participant_id, table_no, seat_no INTO v_seat
    FROM public.ops_seats WHERE id = p_seat_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SEAT_NOT_FOUND: 좌석을 찾을 수 없습니다 (%)', p_seat_id USING ERRCODE = 'P0001';
  END IF;
  IF NOT (public.is_ops_member(v_seat.tournament_id, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 관리 권한 없음' USING ERRCODE = 'P0001';
  END IF;
  IF v_seat.participant_id IS NULL THEN
    RAISE EXCEPTION 'SEAT_NOT_OCCUPIED: 빈 좌석' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.ops_seats SET participant_id = NULL WHERE id = p_seat_id;
  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (v_seat.tournament_id, 'seat_freed', p_actor_id,
          jsonb_build_object('participant_id', v_seat.participant_id,
                             'table', v_seat.table_no, 'seat', v_seat.seat_no));
  RETURN jsonb_build_object('seat_id', p_seat_id);
END;
$function$;

-- 8) ops_redraw_waitlist_fill — 미리보기 확정. 좌석별 expected-value TOCTOU 검증.
-- p_assignments = [{"seat_id":uuid, "participant_id":uuid, "expected":uuid|null}, ...]
--   expected = 미리보기 시점 좌석 participant_id(빈좌석이면 null). 현재값과 다르면 SEAT_VERSION_CONFLICT.
CREATE OR REPLACE FUNCTION public.ops_redraw_waitlist_fill(
  p_tournament_id uuid, p_actor_id uuid, p_assignments jsonb)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
 SET search_path = 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE a jsonb; v_seat record; v_expected uuid; v_pid uuid; v_moved int := 0;
        v_seat_ids uuid[];
        v_lock_id uuid; v_p_tid uuid; v_p_status public.ops_participant_status; v_t_status public.ops_table_status; v_t_lock public.ops_table_lock_type;
BEGIN
  IF auth.uid() IS NULL OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;
  IF NOT (public.is_ops_member(p_tournament_id, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 관리 권한 없음' USING ERRCODE = 'P0001';
  END IF;
  IF jsonb_typeof(p_assignments) <> 'array' OR jsonb_array_length(p_assignments) = 0 THEN
    RAISE EXCEPTION 'INVALID_ASSIGNMENTS: 배정 목록이 비었습니다' USING ERRCODE = 'P0001';
  END IF;

  -- 결정적 락 순서: 관련 좌석 id 오름차순 FOR UPDATE.
  SELECT array_agg(value->>'seat_id' ORDER BY value->>'seat_id')
    INTO v_seat_ids FROM jsonb_array_elements(p_assignments);
  -- id 오름차순 잠금(ops_move_seat 와 동일 규율) — array 정렬만으론 락 획득 순서 보장 안됨.
  FOR v_lock_id IN SELECT id FROM public.ops_seats WHERE id = ANY(v_seat_ids::uuid[]) ORDER BY id LOOP
    PERFORM 1 FROM public.ops_seats WHERE id = v_lock_id FOR UPDATE;
  END LOOP;

  FOR a IN SELECT * FROM jsonb_array_elements(p_assignments) LOOP
    v_pid := (a->>'participant_id')::uuid;
    v_expected := NULLIF(a->>'expected', '')::uuid;
    SELECT id, tournament_id, table_id, participant_id, table_no, seat_no INTO v_seat
      FROM public.ops_seats WHERE id = (a->>'seat_id')::uuid;
    IF v_seat.id IS NULL OR v_seat.tournament_id <> p_tournament_id THEN
      RAISE EXCEPTION 'SEAT_NOT_FOUND: 좌석 % 없음', a->>'seat_id' USING ERRCODE = 'P0001';
    END IF;
    -- TOCTOU: 미리보기 시점 값과 현재값 불일치면 거부.
    IF v_seat.participant_id IS DISTINCT FROM v_expected THEN
      RAISE EXCEPTION 'SEAT_VERSION_CONFLICT: 좌석 상태가 변경됨 — 다시 시도' USING ERRCODE = 'P0001';
    END IF;
    -- 대상 좌석이 비어야(대기채움), 참가자가 미착석이어야.
    IF v_seat.participant_id IS NOT NULL THEN
      RAISE EXCEPTION 'SEAT_TAKEN: 좌석 점유됨' USING ERRCODE = 'P0001';
    END IF;
    IF EXISTS (SELECT 1 FROM public.ops_seats WHERE tournament_id = p_tournament_id
                 AND participant_id = v_pid) THEN
      RAISE EXCEPTION 'PARTICIPANT_ALREADY_SEATED: 참가자 % 이미 착석', v_pid USING ERRCODE = 'P0001';
    END IF;
    -- 참가자 동일 대회 + 활성가능 상태 검증 (cross-tenant/탈락 차단).
    SELECT tournament_id, status INTO v_p_tid, v_p_status
      FROM public.ops_participants WHERE id = v_pid FOR UPDATE;
    IF NOT FOUND OR v_p_tid <> p_tournament_id THEN
      RAISE EXCEPTION 'PARTICIPANT_NOT_FOUND: 참가자 % 없음/타대회', v_pid USING ERRCODE = 'P0001';
    END IF;
    IF v_p_status = 'busted' OR v_p_status = 'no_show' THEN
      RAISE EXCEPTION 'PARTICIPANT_NOT_ACTIVE: 탈락/미출석 참가자는 배정 불가' USING ERRCODE = 'P0001';
    END IF;
    -- 대상 좌석 테이블은 open·unlocked 만 (대기채움 범위 — closed/standby/locked 제외).
    SELECT status, lock_type INTO v_t_status, v_t_lock
      FROM public.ops_tables WHERE id = v_seat.table_id;
    IF v_t_status <> 'open' OR v_t_lock <> 'none' THEN
      RAISE EXCEPTION 'TABLE_NOT_OPEN: redraw 대상 테이블은 open·unlocked 만 (status=%, lock=%)', v_t_status, v_t_lock USING ERRCODE = 'P0001';
    END IF;
    UPDATE public.ops_seats SET participant_id = v_pid WHERE id = v_seat.id;
    UPDATE public.ops_participants SET status = 'active' WHERE id = v_pid AND status <> 'active';
    v_moved := v_moved + 1;
  END LOOP;

  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (p_tournament_id, 'table_redraw', p_actor_id,
          jsonb_build_object('mode', 'waitlist_fill', 'moved', v_moved));
  RETURN jsonb_build_object('moved', v_moved);
END;
$function$;

-- 9) ops_register_participant v2 — auto-seat 활성화 (1a 본문 + 좌석 배정)
CREATE OR REPLACE FUNCTION public.ops_register_participant(
  p_tournament_id uuid, p_actor_id uuid, p_name text,
  p_nationality text, p_phone text, p_buy_in_amount int)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
 SET search_path = 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE v_t record; v_entry int; v_participant_id uuid; v_seat_id uuid;
        v_status public.ops_participant_status; v_table_no int; v_seat_no int;
BEGIN
  IF auth.uid() IS NULL OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;
  SELECT id, registration_open, starting_chips, next_entry_seq, auto_seat_on_register
    INTO v_t FROM public.ops_tournaments WHERE id = p_tournament_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TOURNAMENT_NOT_FOUND: 대회를 찾을 수 없습니다 (%)', p_tournament_id USING ERRCODE = 'P0001';
  END IF;
  IF NOT (public.is_ops_member(p_tournament_id, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 관리 권한 없음' USING ERRCODE = 'P0001';
  END IF;
  IF v_t.registration_open = false THEN
    RAISE EXCEPTION 'REGISTRATION_CLOSED: 등록이 마감되었습니다' USING ERRCODE = 'P0001';
  END IF;

  v_entry := v_t.next_entry_seq + 1;
  UPDATE public.ops_tournaments SET next_entry_seq = v_entry WHERE id = p_tournament_id;

  -- auto-seat: open·unlocked 테이블의 빈좌석 1개(table_no,seat_no asc) 잠금 시도.
  v_seat_id := NULL;
  IF v_t.auto_seat_on_register THEN
    SELECT s.id, s.table_no, s.seat_no INTO v_seat_id, v_table_no, v_seat_no
      FROM public.ops_seats s
      JOIN public.ops_tables t ON t.id = s.table_id
      WHERE s.tournament_id = p_tournament_id
        AND s.participant_id IS NULL
        AND t.status = 'open' AND t.lock_type = 'none'
      ORDER BY s.table_no, s.seat_no
      LIMIT 1 FOR UPDATE OF s SKIP LOCKED;
  END IF;

  v_status := CASE WHEN v_seat_id IS NOT NULL THEN 'active'::public.ops_participant_status
                   ELSE 'checked_in'::public.ops_participant_status END;

  INSERT INTO public.ops_participants (tournament_id, entry_number, name, nationality, phone,
                                       status, chips, buy_in_amount)
  VALUES (p_tournament_id, v_entry, p_name, p_nationality, p_phone,
          v_status, v_t.starting_chips, p_buy_in_amount)
  RETURNING id INTO v_participant_id;

  IF v_seat_id IS NOT NULL THEN
    UPDATE public.ops_seats SET participant_id = v_participant_id WHERE id = v_seat_id;
  END IF;

  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (p_tournament_id, 'player_registered', p_actor_id,
          jsonb_build_object('participant_id', v_participant_id, 'entry_number', v_entry,
                             'seated', v_seat_id IS NOT NULL,
                             'table', v_table_no, 'seat', v_seat_no));

  RETURN jsonb_build_object('participant_id', v_participant_id, 'entry_number', v_entry,
                            'status', v_status, 'seated', v_seat_id IS NOT NULL);
END;
$function$;
