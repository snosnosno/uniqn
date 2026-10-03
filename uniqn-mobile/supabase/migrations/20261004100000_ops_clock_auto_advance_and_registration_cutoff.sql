-- ops 레벨 자동 전환 + 레이트 등록 자동 마감 (2026-10-04 사용자 결정).
--
-- 무엇이 바뀌나
--   ① 레벨 시간이 0 이 되면 **다음 레벨로 자동으로 넘어간다**. 지금까지는 00:00 에서 멈추고 운영자가
--      "다음"을 눌러야 했다. 마지막 레벨은 넘어갈 곳이 없어 종전대로 00:00 에서 멈춘다.
--   ② "레벨·브레이크 N 종료 시 등록 마감" 설정. N 다음으로 넘어가는 순간(자동이든 수동이든) 등록을 닫는다.
--      수동 토글은 그대로 쓸 수 있고, **수동으로 다시 열면 자동 설정은 해제**된다.
--
-- 자동 전환을 누가 일으키나 — 서버에는 "시계가 가는" 주체가 없다(남은 시간은 앵커에서 파생).
--   fn_ops_clock_roll_forward 가 "지금까지 끝났어야 할 레벨"을 한 번에 따라잡고, 아래 네 곳이 그것을 부른다.
--     a. 운영 콘솔이 00:00 을 보는 순간 ops_clock_sync (즉시)
--     b. 전광판·플레이어뷰 폴링(ops_get_monitor_snapshot / ops_get_player_view, 4초 간격)
--     c. 참가 등록(ops_register_participant) — 아무도 화면을 안 보고 있어도 마감 판정이 정확하도록
--     d. pg_cron 매분 — 위 셋이 모두 없을 때(구 앱만 켜 둔 경우)의 안전망
--     e. 일시정지·시간 보정(ops_clock_pause / ops_clock_adjust) — 끝난 레벨 위에서 조작하지 않게 먼저 따라잡는다
--   앵커는 `level_started_at += 끝난 레벨 길이` 로 옮긴다 — 늦게 따라잡아도 시계가 밀리지 않는다.
--
-- 락: 넘어갈 것이 없으면(시간이 남음·일시정지·마지막 레벨·종료된 대회) **락을 잡지 않고** 돌아온다.
--   폴링(b)·크론(d)은 대회 행이 잠겨 있으면 기다리지 않고 건너뛴다(SKIP LOCKED) — 다음 폴링이 따라잡는다.
--   공개 폴링이 운영자 쓰기 RPC 뒤에 줄 서서 anon statement_timeout 에 걸리는 일을 막는다.
--
-- prod 적용 순간: 종전에는 "가동 중 + 00:00" 이 사실상 정지였다. 그대로 두면 적용 직후 그동안 흐른 시간을
--   소급해 여러 레벨을 한꺼번에 뛴다 → 적용 시점에 이미 끝나 있는 가동 중 시계는 **일시정지(잔여 0)** 로 바꿔 둔다.
--   운영자가 재개하면 그때 다음 레벨로 넘어간다.
--
-- 계약: anon-executable ops SECDEF = 2 유지. 새 함수는 전부 PUBLIC/anon REVOKE, fn_* 는 authenticated 도 REVOKE.
--       ops_get_* 는 CREATE OR REPLACE 라 기존 ACL(anon GRANT)이 보존된다.
-- 이벤트: 새 enum 값 없이 기존 타입 재사용 — level_set{action:'auto_advance'} · registration_toggled{auto:true}.

-- ── ① 설정 컬럼 ──────────────────────────────────────────────────────────────
ALTER TABLE public.ops_tournaments
  ADD COLUMN IF NOT EXISTS registration_close_after_sort integer;

ALTER TABLE public.ops_tournaments
  DROP CONSTRAINT IF EXISTS ops_tournaments_registration_close_after_sort_check;
ALTER TABLE public.ops_tournaments
  ADD CONSTRAINT ops_tournaments_registration_close_after_sort_check
  CHECK (registration_close_after_sort IS NULL OR registration_close_after_sort >= 1);

COMMENT ON COLUMN public.ops_tournaments.registration_close_after_sort IS
  '레이트 등록 자동 마감 기준(ops_blind_levels.sort). 이 순번의 레벨·브레이크가 끝나 다음으로 넘어가면 등록을 닫는다. NULL=자동 마감 없음. 쓰기는 ops_set_registration_cutoff 전용, 수동으로 등록을 다시 열면 NULL 로 돌아간다.';

-- ── ② 마감 판정(내부) ────────────────────────────────────────────────────────
-- 새 현재 순번이 기준을 넘었고 등록이 열려 있으면 닫는다. 설정값은 남겨 둔다(화면이 "자동 마감됨"을 보여 준다).
CREATE OR REPLACE FUNCTION public.fn_ops_apply_registration_cutoff(
  p_tournament_id uuid, p_sort integer, p_actor_id uuid
) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_after int;
BEGIN
  UPDATE public.ops_tournaments
     SET registration_open = false
   WHERE id = p_tournament_id
     AND registration_open
     AND registration_close_after_sort IS NOT NULL
     AND p_sort > registration_close_after_sort
  RETURNING registration_close_after_sort INTO v_after;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (p_tournament_id, 'registration_toggled', p_actor_id,
          jsonb_build_object('open', false, 'auto', true, 'after_sort', v_after));
  RETURN true;
END;
$$;

ALTER FUNCTION public.fn_ops_apply_registration_cutoff(uuid, integer, uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.fn_ops_apply_registration_cutoff(uuid, integer, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_ops_apply_registration_cutoff(uuid, integer, uuid) TO service_role;

-- ── ③ 자동 전환(내부) ────────────────────────────────────────────────────────
-- 반환 = 넘어간 레벨 수(0 이면 아무 일도 없음). 락 순서는 다른 클럭 RPC 와 같다(대회 행 → 클럭 행).
-- 폴링이 4초마다 부르므로, 락을 잡기 전에 "넘어갈 게 있는지"를 락 없이 먼저 본다.
-- p_wait=false(폴링·크론): 대회 행이 잠겨 있으면 기다리지 않고 0 을 돌려준다 — 다음 호출이 따라잡는다.
DROP FUNCTION IF EXISTS public.fn_ops_clock_roll_forward(uuid);
CREATE OR REPLACE FUNCTION public.fn_ops_clock_roll_forward(
  p_tournament_id uuid, p_wait boolean DEFAULT true
) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_clock record;
  v_duration int;
  v_from int;
  v_sort int;
  v_started timestamptz;
  v_advanced int := 0;
BEGIN
  -- 락 없는 선검사 — 대부분의 호출은 여기서 끝난다. 넘어갈 곳이 없는 경우(마지막 레벨·종료된 대회)도
  -- 여기서 걸러야 한다: 종료된 대회의 시계는 가동 중인 채 00:00 에 남아 있어, 안 거르면 폴링마다 락을 잡는다.
  SELECT c.current_level_sort, c.level_started_at, c.is_running, bl.duration_sec, t.status
    INTO v_clock
    FROM public.ops_clock c
    JOIN public.ops_tournaments t ON t.id = c.tournament_id
    LEFT JOIN public.ops_blind_levels bl
      ON bl.tournament_id = c.tournament_id AND bl.sort = c.current_level_sort
   WHERE c.tournament_id = p_tournament_id;
  IF NOT FOUND OR NOT v_clock.is_running OR v_clock.level_started_at IS NULL
     OR v_clock.status = 'completed'
     OR v_clock.duration_sec IS NULL
     OR now() < v_clock.level_started_at + make_interval(secs => v_clock.duration_sec)
     OR NOT EXISTS (SELECT 1 FROM public.ops_blind_levels n
                     WHERE n.tournament_id = p_tournament_id
                       AND n.sort = v_clock.current_level_sort + 1) THEN
    RETURN 0;
  END IF;

  IF p_wait THEN
    PERFORM 1 FROM public.ops_tournaments WHERE id = p_tournament_id FOR UPDATE;
  ELSE
    PERFORM 1 FROM public.ops_tournaments WHERE id = p_tournament_id FOR UPDATE SKIP LOCKED;
  END IF;
  IF NOT FOUND THEN
    RETURN 0;
  END IF;
  -- 락을 잡은 뒤 다시 읽는다(그 사이 다른 호출이 이미 넘겼을 수 있다).
  SELECT current_level_sort, level_started_at, is_running
    INTO v_clock FROM public.ops_clock WHERE tournament_id = p_tournament_id FOR UPDATE;
  IF NOT FOUND OR NOT v_clock.is_running OR v_clock.level_started_at IS NULL THEN
    RETURN 0;
  END IF;

  v_from := v_clock.current_level_sort;
  v_sort := v_from;
  v_started := v_clock.level_started_at;
  -- 레벨은 최대 100 개(ops_set_blind_levels 상한)라 반복은 유한하다.
  LOOP
    SELECT duration_sec INTO v_duration FROM public.ops_blind_levels
      WHERE tournament_id = p_tournament_id AND sort = v_sort;
    EXIT WHEN v_duration IS NULL;
    EXIT WHEN now() < v_started + make_interval(secs => v_duration);
    -- 마지막 레벨이면 넘어갈 곳이 없다 — 00:00 에서 멈춘다.
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.ops_blind_levels
                           WHERE tournament_id = p_tournament_id AND sort = v_sort + 1);
    v_started := v_started + make_interval(secs => v_duration);
    v_sort := v_sort + 1;
    v_advanced := v_advanced + 1;
  END LOOP;

  IF v_advanced = 0 THEN
    RETURN 0;
  END IF;

  UPDATE public.ops_clock SET
    current_level_sort   = v_sort,
    level_started_at     = v_started,
    paused_remaining_sec = NULL
  WHERE tournament_id = p_tournament_id;

  -- 사람이 아니라 시간이 넘겼다 — actor 없음.
  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (p_tournament_id, 'level_set', NULL,
          jsonb_build_object('action', 'auto_advance', 'sort', v_sort, 'from_sort', v_from));

  PERFORM public.fn_ops_apply_registration_cutoff(p_tournament_id, v_sort, NULL);
  RETURN v_advanced;
END;
$$;

ALTER FUNCTION public.fn_ops_clock_roll_forward(uuid, boolean) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.fn_ops_clock_roll_forward(uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_ops_clock_roll_forward(uuid, boolean) TO service_role;

-- ── ④ 콘솔용 동기화 RPC ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.ops_clock_sync(p_tournament_id uuid, p_actor_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_advanced int;
  v_sort int;
BEGIN
  IF auth.uid() IS NULL OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ops_tournaments WHERE id = p_tournament_id) THEN
    RAISE EXCEPTION 'TOURNAMENT_NOT_FOUND: 대회를 찾을 수 없습니다 (%)', p_tournament_id USING ERRCODE = 'P0001';
  END IF;
  IF NOT (public.is_ops_member(p_tournament_id, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 관리 권한 없음' USING ERRCODE = 'P0001';
  END IF;

  v_advanced := public.fn_ops_clock_roll_forward(p_tournament_id);
  SELECT current_level_sort INTO v_sort FROM public.ops_clock WHERE tournament_id = p_tournament_id;
  RETURN jsonb_build_object('tournament_id', p_tournament_id, 'advanced', v_advanced,
                            'current_level_sort', v_sort);
END;
$$;

ALTER FUNCTION public.ops_clock_sync(uuid, uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.ops_clock_sync(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ops_clock_sync(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ops_clock_sync(uuid, uuid) TO service_role;

COMMENT ON FUNCTION public.ops_clock_sync(uuid, uuid) IS
  '끝난 레벨을 따라잡는다(자동 전환). 콘솔이 00:00 을 볼 때 호출. 멤버 게이트. anon REVOKE.';

-- ── ⑤ 자동 마감 설정 RPC ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.ops_set_registration_cutoff(
  p_tournament_id uuid, p_actor_id uuid, p_after_sort integer
) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_cur_sort int;
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

  IF p_after_sort IS NOT NULL THEN
    -- 설정 직전에 시계를 따라잡는다 — 이미 지나간 레벨을 기준으로 잡지 못하게.
    PERFORM public.fn_ops_clock_roll_forward(p_tournament_id);
    IF NOT EXISTS (SELECT 1 FROM public.ops_blind_levels
                    WHERE tournament_id = p_tournament_id AND sort = p_after_sort) THEN
      RAISE EXCEPTION 'OPS_INVALID_LEVEL: 존재하지 않는 레벨 (sort=%)', p_after_sort USING ERRCODE = 'P0001';
    END IF;
    -- 마지막 순번은 끝나도 넘어갈 레벨이 없어 영영 발동하지 않는다.
    IF NOT EXISTS (SELECT 1 FROM public.ops_blind_levels
                    WHERE tournament_id = p_tournament_id AND sort = p_after_sort + 1) THEN
      RAISE EXCEPTION 'OPS_INVALID_LEVEL: 마지막 레벨은 마감 기준이 될 수 없습니다 (sort=%)', p_after_sort
        USING ERRCODE = 'P0001';
    END IF;
    SELECT current_level_sort INTO v_cur_sort FROM public.ops_clock WHERE tournament_id = p_tournament_id;
    IF v_cur_sort IS NOT NULL AND v_cur_sort > p_after_sort THEN
      RAISE EXCEPTION 'OPS_INVALID_LEVEL: 이미 지난 레벨 (sort=%)', p_after_sort USING ERRCODE = 'P0001';
    END IF;
  END IF;

  UPDATE public.ops_tournaments SET registration_close_after_sort = p_after_sort
   WHERE id = p_tournament_id;

  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (p_tournament_id, 'registration_toggled', p_actor_id,
          jsonb_build_object('action', 'cutoff_set', 'after_sort', p_after_sort));

  RETURN jsonb_build_object('tournament_id', p_tournament_id,
                            'registration_close_after_sort', p_after_sort);
END;
$$;

ALTER FUNCTION public.ops_set_registration_cutoff(uuid, uuid, integer) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.ops_set_registration_cutoff(uuid, uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ops_set_registration_cutoff(uuid, uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ops_set_registration_cutoff(uuid, uuid, integer) TO service_role;

COMMENT ON FUNCTION public.ops_set_registration_cutoff(uuid, uuid, integer) IS
  '레이트 등록 자동 마감 기준(레벨·브레이크 sort) 설정/해제(NULL). 멤버 게이트. 지난 레벨은 거부. anon REVOKE.';

-- ── ⑥ 수동 레벨 이동 — 본문은 baseline 과 같고 마감 판정 1줄 추가 ───────────────
CREATE OR REPLACE FUNCTION public.ops_clock_set_level(p_tournament_id uuid, p_actor_id uuid, p_sort integer) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $$
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
  IF NOT EXISTS (SELECT 1 FROM public.ops_blind_levels
                   WHERE tournament_id = p_tournament_id AND sort = p_sort) THEN
    RAISE EXCEPTION 'OPS_INVALID_LEVEL: 존재하지 않는 레벨 (sort=%)', p_sort USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.ops_clock SET
    current_level_sort   = p_sort,
    level_started_at     = now(),
    paused_remaining_sec = NULL
  WHERE tournament_id = p_tournament_id;

  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (p_tournament_id, 'level_set', p_actor_id,
          jsonb_build_object('action', 'set_level', 'sort', p_sort));

  -- 수동으로 넘겨도 자동 마감 기준을 넘으면 등록을 닫는다.
  PERFORM public.fn_ops_apply_registration_cutoff(p_tournament_id, p_sort, p_actor_id);

  RETURN jsonb_build_object('tournament_id', p_tournament_id, 'current_level_sort', p_sort);
END;
$$;

-- ── ⑦ 등록 토글 — 수동으로 열면 자동 마감 설정 해제 ──────────────────────────
CREATE OR REPLACE FUNCTION public.ops_toggle_registration(p_tournament_id uuid, p_actor_id uuid, p_open boolean) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_id uuid;
  v_cutoff int;
  v_was_open boolean;
  v_clear boolean;
BEGIN
  IF auth.uid() IS NULL
     OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;

  SELECT id, registration_close_after_sort, registration_open INTO v_id, v_cutoff, v_was_open
    FROM public.ops_tournaments WHERE id = p_tournament_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TOURNAMENT_NOT_FOUND: 대회를 찾을 수 없습니다 (%)', p_tournament_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT (public.is_ops_member(p_tournament_id, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 관리 권한 없음' USING ERRCODE = 'P0001';
  END IF;

  -- 닫힌 등록을 수동으로 여는 것은 "자동 마감을 따르지 않겠다"는 뜻 — 설정을 지운다(안 지우면 다음 레벨 전환에
  -- 다시 닫힌다). 이미 열려 있는데 또 "열기"가 온 것(연타·다른 기기의 중복 요청)은 설정을 건드리지 않는다.
  v_clear := p_open AND NOT v_was_open AND v_cutoff IS NOT NULL;
  UPDATE public.ops_tournaments SET
    registration_open = p_open,
    registration_close_after_sort = CASE WHEN v_clear THEN NULL ELSE registration_close_after_sort END
  WHERE id = p_tournament_id;

  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (p_tournament_id, 'registration_toggled', p_actor_id,
          CASE WHEN v_clear
               THEN jsonb_build_object('open', p_open, 'cutoff_cleared', true)
               ELSE jsonb_build_object('open', p_open) END);

  RETURN jsonb_build_object('tournament_id', p_tournament_id, 'registration_open', p_open);
END;
$$;

-- ── ⑧ 참가 등록 — 본문은 baseline 과 같고 "시계 따라잡기 + 등록 상태 재확인" 추가 ──
CREATE OR REPLACE FUNCTION public.ops_register_participant(p_tournament_id uuid, p_actor_id uuid, p_name text, p_nationality text, p_phone text, p_buy_in_amount integer) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE v_t record; v_entry int; v_participant_id uuid; v_seat_id uuid;
        v_status public.ops_participant_status; v_table_no int; v_seat_no int;
        v_open boolean;
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

  -- 자동 마감: 아무 화면도 시계를 따라잡지 않았더라도 여기서 따라잡고, 그 결과로 등록 상태를 다시 읽는다.
  v_open := v_t.registration_open;
  IF public.fn_ops_clock_roll_forward(p_tournament_id) > 0 THEN
    SELECT registration_open INTO v_open FROM public.ops_tournaments WHERE id = p_tournament_id;
  END IF;
  IF v_open = false THEN
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
$$;

-- ── ⑨ 블라인드 구조 저장 — 본문은 20260724120000 과 같고 "사라진 기준 해제" 1문 추가 ──
CREATE OR REPLACE FUNCTION public.ops_set_blind_levels(p_tournament_id uuid, p_actor_id uuid, p_levels jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  a jsonb;
  v_sort int := 0;
  v_count int;
  v_cur_sort int;
  v_new_sort int;
  v_reanchored boolean := false;
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
  IF jsonb_typeof(p_levels) <> 'array' OR jsonb_array_length(p_levels) = 0 THEN
    RAISE EXCEPTION 'OPS_BLIND_LEVELS_INVALID: 블라인드 레벨이 비었습니다' USING ERRCODE = 'P0001';
  END IF;
  -- 서버 상한(클라 zod .max(100)과 동일 계약) — 무상한이면 대량 배열로 행 팽창/이벤트 스팸 가능
  IF jsonb_array_length(p_levels) > 100 THEN
    RAISE EXCEPTION 'OPS_BLIND_LEVELS_INVALID: 블라인드 레벨은 최대 100개입니다' USING ERRCODE = 'P0001';
  END IF;
  FOR a IN SELECT * FROM jsonb_array_elements(p_levels) LOOP
    IF COALESCE((a->>'duration_sec')::int, 0) <= 0 THEN
      RAISE EXCEPTION 'OPS_BLIND_LEVELS_INVALID: duration_sec 는 0보다 커야 합니다' USING ERRCODE = 'P0001';
    END IF;
    IF COALESCE((a->>'small_blind')::int, 0) < 0
       OR COALESCE((a->>'big_blind')::int, 0) < 0
       OR COALESCE((a->>'ante')::int, 0) < 0 THEN
      RAISE EXCEPTION 'OPS_BLIND_LEVELS_INVALID: 블라인드/안티는 음수 불가' USING ERRCODE = 'P0001';
    END IF;
  END LOOP;

  DELETE FROM public.ops_blind_levels WHERE tournament_id = p_tournament_id;
  FOR a IN SELECT * FROM jsonb_array_elements(p_levels) LOOP
    v_sort := v_sort + 1;
    INSERT INTO public.ops_blind_levels (
      tournament_id, level, small_blind, big_blind, ante, duration_sec, is_break, sort)
    VALUES (
      p_tournament_id,
      COALESCE((a->>'level')::int, v_sort),
      COALESCE((a->>'small_blind')::int, 0),
      COALESCE((a->>'big_blind')::int, 0),
      COALESCE((a->>'ante')::int, 0),
      (a->>'duration_sec')::int,
      COALESCE((a->>'is_break')::boolean, false),
      v_sort);
  END LOOP;
  v_count := v_sort;

  -- §0.5 B2: 교체 후 current_level_sort clamp [1, N]. 변하면 안전 재앵커.
  SELECT current_level_sort INTO v_cur_sort FROM public.ops_clock
    WHERE tournament_id = p_tournament_id FOR UPDATE;
  IF v_cur_sort IS NOT NULL THEN
    v_new_sort := LEAST(GREATEST(v_cur_sort, 1), v_count);
    IF v_new_sort IS DISTINCT FROM v_cur_sort THEN
      UPDATE public.ops_clock SET
        current_level_sort   = v_new_sort,
        level_started_at     = now(),
        is_running           = false,
        paused_remaining_sec = NULL
      WHERE tournament_id = p_tournament_id;
      v_reanchored := true;
    END IF;
  END IF;

  -- 자동 마감 기준이 가리키던 순번이 구조에서 사라졌거나 마지막 순번이 됐으면 설정을 지운다
  -- (마지막 레벨은 넘어갈 곳이 없어 영영 발동하지 않는다).
  UPDATE public.ops_tournaments SET registration_close_after_sort = NULL
   WHERE id = p_tournament_id AND registration_close_after_sort >= v_count;

  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (p_tournament_id, 'level_set', p_actor_id,
          jsonb_build_object('action', 'blind_levels_set', 'count', v_count, 'reanchored', v_reanchored));

  RETURN jsonb_build_object('tournament_id', p_tournament_id, 'count', v_count, 'reanchored', v_reanchored);
END;
$$;

-- ── ⑩ 전광판 스냅샷 — 본문은 20260717090100 과 같고 맨 앞에 "시계 따라잡기" 1줄 추가 ──
--    기존 반환 키 전부 보존. ACL 은 CREATE OR REPLACE 로 보존(anon GRANT 유지).
CREATE OR REPLACE FUNCTION public.ops_get_monitor_snapshot(p_monitor_token text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_t record; v_clock record; v_stats record; v_cur record; v_next record;
  v_next_break jsonb; v_payouts jsonb;
BEGIN
  IF p_monitor_token IS NULL OR char_length(p_monitor_token) < 32 THEN
    RAISE EXCEPTION 'OPS_MONITOR_TOKEN_INVALID: 유효하지 않은 모니터 토큰' USING ERRCODE = 'P0001';
  END IF;

  SELECT id INTO v_t FROM public.ops_tournaments WHERE monitor_token = p_monitor_token;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'OPS_MONITOR_TOKEN_INVALID: 유효하지 않은 모니터 토큰' USING ERRCODE = 'P0001';
  END IF;

  -- 끝난 레벨을 따라잡는다(자동 전환). 넘어갈 게 없으면 락 없이, 대회 행이 잠겨 있으면 기다리지 않고 돌아온다.
  PERFORM public.fn_ops_clock_roll_forward(v_t.id, false);

  SELECT id, name, venue, event_date, game_type, status, color, registration_open, monitor_config
    INTO v_t FROM public.ops_tournaments WHERE monitor_token = p_monitor_token;

  SELECT current_level_sort, level_started_at, is_running, paused_remaining_sec
    INTO v_clock FROM public.ops_clock WHERE tournament_id = v_t.id;

  SELECT playing, entries, reentries_total, tables_open, seats_total, seats_free,
         total_chips, average_stack, avg_stack_bb, prize_pool, knockout_pool
    INTO v_stats FROM public.ops_live_stats WHERE tournament_id = v_t.id;

  SELECT level, small_blind, big_blind, ante, duration_sec, is_break
    INTO v_cur FROM public.ops_blind_levels
    WHERE tournament_id = v_t.id AND sort = v_clock.current_level_sort;

  SELECT level, small_blind, big_blind, ante, duration_sec, is_break
    INTO v_next FROM public.ops_blind_levels
    WHERE tournament_id = v_t.id AND sort = v_clock.current_level_sort + 1;

  -- C1 다음 브레이크: 현재 레벨 시작 앵커(level_started_at) 기준 브레이크 시작까지 누적 초.
  -- 클라는 클럭과 동일한 앵커로 카운트다운을 계산한다(표면별 드리프트 0 — §12.4-4).
  v_next_break := NULL;
  IF v_clock.current_level_sort IS NOT NULL THEN
    SELECT jsonb_build_object(
             'level', b.level,
             'sort', b.sort,
             'secondsFromLevelStart', (
               SELECT COALESCE(SUM(x.duration_sec), 0)::int
                 FROM public.ops_blind_levels x
                WHERE x.tournament_id = v_t.id
                  AND x.sort >= v_clock.current_level_sort
                  AND x.sort < b.sort))
      INTO v_next_break
      FROM public.ops_blind_levels b
     WHERE b.tournament_id = v_t.id
       AND b.is_break
       AND b.sort > v_clock.current_level_sort
     ORDER BY b.sort
     LIMIT 1;
  END IF;

  -- C6/T4 프라이즈 패널: 상위 5 (position·amount). 없으면 빈 배열(패널 자동 숨김).
  SELECT COALESCE(jsonb_agg(jsonb_build_object('position', s.rank, 'amount', s.amount)
                            ORDER BY s.rank), '[]'::jsonb)
    INTO v_payouts
    FROM (SELECT rank, amount FROM public.ops_prizes
           WHERE tournament_id = v_t.id ORDER BY rank LIMIT 5) s;

  RETURN jsonb_build_object(
    'tournament', jsonb_build_object('name', v_t.name, 'venue', v_t.venue, 'eventDate', v_t.event_date,
      'gameType', v_t.game_type, 'status', v_t.status::text, 'color', v_t.color, 'registrationOpen', v_t.registration_open),
    'clock', jsonb_build_object('currentLevelSort', v_clock.current_level_sort, 'levelStartedAt', v_clock.level_started_at,
      'isRunning', COALESCE(v_clock.is_running, false), 'pausedRemainingSec', v_clock.paused_remaining_sec),
    'currentLevel', CASE WHEN v_cur IS NULL THEN NULL ELSE jsonb_build_object('level', v_cur.level, 'smallBlind', v_cur.small_blind,
      'bigBlind', v_cur.big_blind, 'ante', v_cur.ante, 'durationSec', v_cur.duration_sec, 'isBreak', v_cur.is_break) END,
    'nextLevel', CASE WHEN v_next IS NULL THEN NULL ELSE jsonb_build_object('level', v_next.level, 'smallBlind', v_next.small_blind,
      'bigBlind', v_next.big_blind, 'ante', v_next.ante, 'durationSec', v_next.duration_sec, 'isBreak', v_next.is_break) END,
    'stats', jsonb_build_object('playing', COALESCE(v_stats.playing,0), 'entries', COALESCE(v_stats.entries,0),
      'reentriesTotal', COALESCE(v_stats.reentries_total,0), 'tablesOpen', COALESCE(v_stats.tables_open,0),
      'seatsTotal', COALESCE(v_stats.seats_total,0), 'seatsFree', COALESCE(v_stats.seats_free,0),
      'totalChips', COALESCE(v_stats.total_chips,0), 'averageStack', COALESCE(v_stats.average_stack,0),
      'avgStackBb', COALESCE(v_stats.avg_stack_bb,0), 'prizePool', COALESCE(v_stats.prize_pool,0), 'knockoutPool', v_stats.knockout_pool),
    'nextBreak', v_next_break,
    'payouts', v_payouts,
    'monitorConfig', v_t.monitor_config,
    'serverNow', now());
END;
$$;

-- ── ⑪ 플레이어 뷰 — 본문은 20260717090100 과 같고 "시계 따라잡기" 1줄 추가 ────────
CREATE OR REPLACE FUNCTION public.ops_get_player_view(p_view_token text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_p record; v_seat record; v_t record; v_clock record; v_cur record; v_stats record;
  v_next_break jsonb;
BEGIN
  IF p_view_token IS NULL OR char_length(p_view_token) < 32 THEN
    RAISE EXCEPTION 'OPS_VIEW_TOKEN_INVALID: 유효하지 않은 플레이어 토큰' USING ERRCODE = 'P0001';
  END IF;

  -- 본인 1행. 안전필드만 — view_token/claim_pin_hash/phone/nationality/note/player_user_id 미선택.
  SELECT id, tournament_id, entry_number, name, status, chips,
         finish_position, prize_amount, rebuys, add_ons, reentries, knockouts
    INTO v_p
    FROM public.ops_participants
    WHERE view_token = p_view_token;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'OPS_VIEW_TOKEN_INVALID: 유효하지 않은 플레이어 토큰' USING ERRCODE = 'P0001';
  END IF;

  -- 끝난 레벨을 따라잡는다(자동 전환). 넘어갈 게 없으면 락 없이, 대회 행이 잠겨 있으면 기다리지 않고 돌아온다.
  PERFORM public.fn_ops_clock_roll_forward(v_p.tournament_id, false);

  SELECT t.table_no, s.seat_no
    INTO v_seat
    FROM public.ops_seats s
    JOIN public.ops_tables t ON t.id = s.table_id
    WHERE s.participant_id = v_p.id;

  -- bounty_cost 는 적립 계산에만 사용(자체는 반환 안 함).
  SELECT name, venue, game_type, status, bounty_cost
    INTO v_t FROM public.ops_tournaments WHERE id = v_p.tournament_id;

  SELECT current_level_sort, level_started_at, is_running, paused_remaining_sec
    INTO v_clock FROM public.ops_clock WHERE tournament_id = v_p.tournament_id;

  SELECT level, small_blind, big_blind, ante, duration_sec, is_break
    INTO v_cur FROM public.ops_blind_levels
    WHERE tournament_id = v_p.tournament_id AND sort = v_clock.current_level_sort;

  SELECT playing, entries, average_stack, avg_stack_bb
    INTO v_stats FROM public.ops_live_stats WHERE tournament_id = v_p.tournament_id;

  -- C1 다음 브레이크 — 모니터 스냅샷과 동일 산식(동일 데이터 소스, 표면별 드리프트 금지).
  v_next_break := NULL;
  IF v_clock.current_level_sort IS NOT NULL THEN
    SELECT jsonb_build_object(
             'level', b.level,
             'sort', b.sort,
             'secondsFromLevelStart', (
               SELECT COALESCE(SUM(x.duration_sec), 0)::int
                 FROM public.ops_blind_levels x
                WHERE x.tournament_id = v_p.tournament_id
                  AND x.sort >= v_clock.current_level_sort
                  AND x.sort < b.sort))
      INTO v_next_break
      FROM public.ops_blind_levels b
     WHERE b.tournament_id = v_p.tournament_id
       AND b.is_break
       AND b.sort > v_clock.current_level_sort
     ORDER BY b.sort
     LIMIT 1;
  END IF;

  RETURN jsonb_build_object(
    'me', jsonb_build_object(
      'entryNumber', v_p.entry_number, 'name', v_p.name, 'status', v_p.status::text,
      'chips', v_p.chips, 'finishPosition', v_p.finish_position, 'prizeAmount', v_p.prize_amount,
      'rebuys', v_p.rebuys, 'addOns', v_p.add_ons, 'reentries', v_p.reentries,
      'knockouts', v_p.knockouts,
      -- [후속] ::bigint 승격 — knockouts(int) × bounty_cost(int) 의 int*int 오버플로 차단(#226 동일 클래스).
      'bountyAccrued', CASE WHEN v_t.bounty_cost IS NULL THEN NULL
                            ELSE v_p.knockouts::bigint * v_t.bounty_cost END,
      'tableNo', v_seat.table_no, 'seatNo', v_seat.seat_no),
    'tournament', jsonb_build_object(
      'name', v_t.name, 'venue', v_t.venue, 'gameType', v_t.game_type, 'status', v_t.status::text),
    'clock', jsonb_build_object(
      'currentLevelSort', v_clock.current_level_sort, 'levelStartedAt', v_clock.level_started_at,
      'isRunning', COALESCE(v_clock.is_running, false), 'pausedRemainingSec', v_clock.paused_remaining_sec),
    'currentLevel', CASE WHEN v_cur IS NULL THEN NULL ELSE jsonb_build_object(
      'level', v_cur.level, 'smallBlind', v_cur.small_blind, 'bigBlind', v_cur.big_blind,
      'ante', v_cur.ante, 'durationSec', v_cur.duration_sec, 'isBreak', v_cur.is_break) END,
    'stats', jsonb_build_object(
      'playing', COALESCE(v_stats.playing, 0), 'entries', COALESCE(v_stats.entries, 0),
      'averageStack', COALESCE(v_stats.average_stack, 0), 'avgStackBb', COALESCE(v_stats.avg_stack_bb, 0)),
    'nextBreak', v_next_break,
    'serverNow', now()
  );
END;
$$;

-- ── ⑪-2 일시정지 — 본문은 baseline 과 같고 "시계 따라잡기" 1줄 추가 ────────────
--    끝난 레벨 위에서 멈추면 잔여 0 으로 굳고, 재개할 때 초과분만큼 일정이 밀린다.
CREATE OR REPLACE FUNCTION public.ops_clock_pause(p_tournament_id uuid, p_actor_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_clock record;
  v_duration int;
  v_remaining int;
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

  -- 끝난 레벨이 있으면 먼저 넘긴 뒤, 지금 레벨의 잔여로 멈춘다.
  PERFORM public.fn_ops_clock_roll_forward(p_tournament_id);

  SELECT * INTO v_clock FROM public.ops_clock WHERE tournament_id = p_tournament_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TOURNAMENT_NOT_FOUND: 클럭 행 없음 (%)', p_tournament_id USING ERRCODE = 'P0001';
  END IF;
  IF NOT v_clock.is_running THEN
    RETURN jsonb_build_object('tournament_id', p_tournament_id, 'is_running', false, 'noop', true);
  END IF;

  SELECT duration_sec INTO v_duration FROM public.ops_blind_levels
    WHERE tournament_id = p_tournament_id AND sort = v_clock.current_level_sort;

  v_remaining := GREATEST(0,
    COALESCE(v_duration, 0)
    - COALESCE(FLOOR(EXTRACT(EPOCH FROM (now() - v_clock.level_started_at)))::int, 0));

  UPDATE public.ops_clock SET
    is_running           = false,
    paused_remaining_sec = v_remaining
  WHERE tournament_id = p_tournament_id;

  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (p_tournament_id, 'level_pause', p_actor_id,
          jsonb_build_object('remaining_sec', v_remaining));

  RETURN jsonb_build_object('tournament_id', p_tournament_id, 'is_running', false,
                            'paused_remaining_sec', v_remaining);
END;
$$;

-- ── ⑪-3 시간 보정 — baseline 본문 + "시계 따라잡기" + 보정을 현재 레벨 안으로 묶기 ──
--    자동 전환이 생긴 뒤로는 음수 보정이 레벨 길이를 넘으면 그 초과분이 다음 레벨로 흘러 들어가
--    (한 번의 큰 음수로 마지막 레벨까지 뛸 수 있다) 등록 자동 마감까지 일으킨다.
--    → 가동 중 보정은 잔여 0 까지만 줄인다. 그러면 다음 레벨은 처음부터 시작한다.
CREATE OR REPLACE FUNCTION public.ops_clock_adjust(p_tournament_id uuid, p_actor_id uuid, p_delta_sec integer) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_clock record;
  v_duration int;
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

  -- 끝난 레벨이 있으면 먼저 넘긴다 — 보정이 "화면에 보이는 지금 레벨"에 적용되게.
  PERFORM public.fn_ops_clock_roll_forward(p_tournament_id);

  SELECT * INTO v_clock FROM public.ops_clock WHERE tournament_id = p_tournament_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TOURNAMENT_NOT_FOUND: 클럭 행 없음 (%)', p_tournament_id USING ERRCODE = 'P0001';
  END IF;

  IF v_clock.is_running THEN
    SELECT duration_sec INTO v_duration FROM public.ops_blind_levels
      WHERE tournament_id = p_tournament_id AND sort = v_clock.current_level_sort;
    UPDATE public.ops_clock SET
      level_started_at = CASE
        WHEN v_duration IS NULL THEN level_started_at + make_interval(secs => p_delta_sec)
        -- 앵커를 "레벨 길이만큼 전" 보다 과거로 보내지 않는다 = 잔여가 0 아래로 내려가지 않는다.
        ELSE GREATEST(level_started_at + make_interval(secs => p_delta_sec),
                      now() - make_interval(secs => v_duration))
      END
    WHERE tournament_id = p_tournament_id;
  ELSE
    UPDATE public.ops_clock SET
      paused_remaining_sec = GREATEST(COALESCE(paused_remaining_sec, 0) + p_delta_sec, 0)
    WHERE tournament_id = p_tournament_id;
  END IF;

  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (p_tournament_id, 'level_set', p_actor_id,
          jsonb_build_object('action', 'adjust', 'adjust_sec', p_delta_sec));

  RETURN jsonb_build_object('tournament_id', p_tournament_id, 'adjust_sec', p_delta_sec);
END;
$$;

-- ── ⑫ 적용 시점 정규화 + 안전망 크론 ────────────────────────────────────────
-- 종전에는 "가동 중 + 00:00" 이 사실상 정지였다. 이미 끝나 있는 가동 중 시계를 그대로 두면 적용 직후
-- 그동안 흐른 시간을 소급해 여러 레벨을 뛴다 → 일시정지(잔여 0)로 바꿔 둔다. 운영자가 재개하면 그때 넘어간다.
-- (종료된 대회의 시계도 여기서 멈춘다. 이 UPDATE 는 재실행해도 같은 결과다.)
UPDATE public.ops_clock c
   SET is_running = false, paused_remaining_sec = 0
  FROM public.ops_blind_levels bl
 WHERE bl.tournament_id = c.tournament_id AND bl.sort = c.current_level_sort
   AND c.is_running AND c.level_started_at IS NOT NULL
   AND now() >= c.level_started_at + make_interval(secs => bl.duration_sec);

-- 안전망 크론 — 매분. 화면이 하나도 열려 있지 않거나 구 앱만 켜 둔 대회용.
-- 종료된 대회는 대상에서 빼고, 잠긴 대회는 기다리지 않는다(한 대회의 락 대기가 그 분의 전 대회를 붙잡지 않게).
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ops-clock-roll-forward') THEN
    PERFORM cron.unschedule('ops-clock-roll-forward');
  END IF;

  PERFORM cron.schedule(
    'ops-clock-roll-forward',
    '* * * * *',
    $cron$ SELECT public.fn_ops_clock_roll_forward(c.tournament_id, false)
             FROM public.ops_clock c
             JOIN public.ops_tournaments t ON t.id = c.tournament_id
            WHERE c.is_running AND t.status <> 'completed' AND t.archived_at IS NULL; $cron$
  );
EXCEPTION
  -- 로컬 Docker 에 pg_cron 이 없을 때 db:reset 이 통째로 실패하지 않게(20260813110000 선례)
  WHEN undefined_table OR undefined_function OR invalid_schema_name THEN
    RAISE WARNING '[ops] pg_cron 미설치 — 레벨 자동 전환 안전망 크론 skip (함수는 생성됨)';
END $do$;
