-- 라이브 운영(ops) 1c — live_stats 재계산 함수/트리거 + 클럭/블라인드 변이 SECDEF RPC.
-- 패턴 출처: 20260625120200_ops_1a_rpcs.sql (actor 가드·FOR UPDATE·is_ops_member·ops_events append·P0001),
--           20260625130100_ops_1b_seat_rpcs.sql (jsonb 배열 순회·전체교체 delete+insert).
-- 공통 규약(계약 §Global Constraints):
--   · search_path = public, extensions, pg_temp (토큰 생성 없으나 1a/1b 변이 RPC 와 동일 유지)
--   · actor 가드: auth.uid() IS NULL OR (auth.uid() IS DISTINCT FROM p_actor AND NOT is_admin())
--   · 자식 RPC: 토너먼트 FOR UPDATE(클럭 직렬화) 후 is_ops_member(t_id, actor) OR is_admin() 강제
--   · 호출당 ops_events 1행 append
--   · 비즈니스 RAISE 는 ERRCODE='P0001'
-- ⚠️ §0.5 B3: 클럭/블라인드 RPC 는 recompute 를 명시 호출하지 않음 — 재계산 트리거가 담당.
-- 권한(REVOKE anon / GRANT authenticated) 은 후속 grants 마이그(20260627100200)에서 처리.

-- ═══════════════════════════════════════════════════════════════════════════
-- A. live_stats 재계산 본체 (인자 있음 → 직접 트리거 부착 불가, 래퍼는 아래 B)
--    §1.3 집계 upsert. §0.5: CASCADE 가드·bigint·avg_stack_bb COALESCE 0.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.fn_ops_recompute_live_stats(p_tournament_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_buy_in_cost int;
  v_rebuy_cost  int;
  v_addon_cost  int;
  v_playing      int;
  v_entries      int;
  v_reentries    int;
  v_total_rebuys bigint;
  v_total_addons bigint;
  v_total_chips  bigint;
  v_tables_open  int;
  v_seats_total  int;
  v_seats_free   int;
  v_average_stack bigint;
  v_big_blind    int;
  v_avg_stack_bb numeric;
  v_prize_pool   bigint;
BEGIN
  -- [CASCADE 가드] 대회 삭제 중 자식 DELETE 트리거가 부르면 조용히 종료(live_stats FK 위반 방지). §0.5
  IF NOT EXISTS (SELECT 1 FROM public.ops_tournaments WHERE id = p_tournament_id) THEN
    RETURN;
  END IF;

  -- 코스트 config
  SELECT buy_in_cost, rebuy_cost, addon_cost
    INTO v_buy_in_cost, v_rebuy_cost, v_addon_cost
    FROM public.ops_tournaments WHERE id = p_tournament_id;

  -- 참가자 집계 (모든 서브쿼리 WHERE tournament_id 필수 — cross-tenant 차단. §0.5)
  SELECT
    count(*) FILTER (WHERE status = 'active'),
    count(*),
    COALESCE(sum(reentries), 0),
    COALESCE(sum(rebuys), 0),
    COALESCE(sum(add_ons), 0),
    COALESCE(sum(chips) FILTER (WHERE status = 'active'), 0)
  INTO v_playing, v_entries, v_reentries, v_total_rebuys, v_total_addons, v_total_chips
  FROM public.ops_participants
  WHERE tournament_id = p_tournament_id;

  -- open 테이블 수
  SELECT count(*)
    INTO v_tables_open
    FROM public.ops_tables
    WHERE tournament_id = p_tournament_id AND status = 'open';

  -- open 테이블의 좌석 수 / 빈 좌석 수
  SELECT count(s.id), count(s.id) FILTER (WHERE s.participant_id IS NULL)
    INTO v_seats_total, v_seats_free
    FROM public.ops_seats s
    JOIN public.ops_tables t ON t.id = s.table_id
    WHERE s.tournament_id = p_tournament_id AND t.status = 'open';

  -- 평균 스택 = round(total_chips / NULLIF(playing,0)) — playing 0 이면 0
  v_average_stack := COALESCE(round(v_total_chips::numeric / NULLIF(v_playing, 0))::bigint, 0);

  -- 현재 레벨 big_blind (clock.current_level_sort → blind_levels). 없으면 NULL.
  SELECT bl.big_blind
    INTO v_big_blind
    FROM public.ops_blind_levels bl
    JOIN public.ops_clock c
      ON c.tournament_id = bl.tournament_id AND c.current_level_sort = bl.sort
    WHERE bl.tournament_id = p_tournament_id;

  -- §0.5 B1: NOT NULL 컬럼 — big_blind 0/NULL(브레이크·미설정)에서 NULL→0 강제(23502 등록롤백 방지)
  v_avg_stack_bb := COALESCE(v_average_stack::numeric / NULLIF(v_big_blind, 0), 0);

  -- 상금 풀 = 엔트리·buy_in_cost + Σrebuys·rebuy_cost + Σadd_ons·addon_cost
  v_prize_pool := v_entries::bigint * COALESCE(v_buy_in_cost, 0)
                + v_total_rebuys      * COALESCE(v_rebuy_cost, 0)
                + v_total_addons      * COALESCE(v_addon_cost, 0);

  INSERT INTO public.ops_live_stats AS ls (
    tournament_id, playing, entries, unique_players, reentries_total,
    tables_open, seats_total, seats_free,
    total_chips, average_stack, avg_stack_bb, prize_pool, updated_at
  ) VALUES (
    p_tournament_id, v_playing, v_entries, v_entries, v_reentries,
    v_tables_open, v_seats_total, v_seats_free,
    v_total_chips, v_average_stack, v_avg_stack_bb, v_prize_pool, now()
  )
  ON CONFLICT (tournament_id) DO UPDATE SET
    playing         = EXCLUDED.playing,
    entries         = EXCLUDED.entries,
    unique_players  = EXCLUDED.unique_players,
    reentries_total = EXCLUDED.reentries_total,
    tables_open     = EXCLUDED.tables_open,
    seats_total     = EXCLUDED.seats_total,
    seats_free      = EXCLUDED.seats_free,
    total_chips     = EXCLUDED.total_chips,
    average_stack   = EXCLUDED.average_stack,
    avg_stack_bb    = EXCLUDED.avg_stack_bb,
    prize_pool      = EXCLUDED.prize_pool,
    updated_at      = now();
END;
$function$;

-- ═══════════════════════════════════════════════════════════════════════════
-- B. 트리거 래퍼 (인자 없는 RETURNS trigger — NEW/OLD 에서 tournament_id 추출 → 본체 호출). §0.5 B3
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.fn_ops_live_stats_recompute_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_tid uuid;
BEGIN
  v_tid := COALESCE(NEW.tournament_id, OLD.tournament_id);
  IF v_tid IS NOT NULL THEN
    PERFORM public.fn_ops_recompute_live_stats(v_tid);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- 재계산 트리거 부착 (원천 5종).
-- participants/seats/tables/blind_levels: 모든 행 변경. clock: 레벨 변경 시만(avg_stack_bb 갱신).
DROP TRIGGER IF EXISTS trg_ops_participants_recompute_stats ON public.ops_participants;
CREATE TRIGGER trg_ops_participants_recompute_stats
  AFTER INSERT OR UPDATE OR DELETE ON public.ops_participants
  FOR EACH ROW EXECUTE FUNCTION public.fn_ops_live_stats_recompute_trigger();

DROP TRIGGER IF EXISTS trg_ops_seats_recompute_stats ON public.ops_seats;
CREATE TRIGGER trg_ops_seats_recompute_stats
  AFTER INSERT OR UPDATE OR DELETE ON public.ops_seats
  FOR EACH ROW EXECUTE FUNCTION public.fn_ops_live_stats_recompute_trigger();

DROP TRIGGER IF EXISTS trg_ops_tables_recompute_stats ON public.ops_tables;
CREATE TRIGGER trg_ops_tables_recompute_stats
  AFTER INSERT OR UPDATE OR DELETE ON public.ops_tables
  FOR EACH ROW EXECUTE FUNCTION public.fn_ops_live_stats_recompute_trigger();

DROP TRIGGER IF EXISTS trg_ops_blind_levels_recompute_stats ON public.ops_blind_levels;
CREATE TRIGGER trg_ops_blind_levels_recompute_stats
  AFTER INSERT OR UPDATE OR DELETE ON public.ops_blind_levels
  FOR EACH ROW EXECUTE FUNCTION public.fn_ops_live_stats_recompute_trigger();

DROP TRIGGER IF EXISTS trg_ops_clock_recompute_stats ON public.ops_clock;
CREATE TRIGGER trg_ops_clock_recompute_stats
  AFTER UPDATE ON public.ops_clock
  FOR EACH ROW
  WHEN (OLD.current_level_sort IS DISTINCT FROM NEW.current_level_sort)
  EXECUTE FUNCTION public.fn_ops_live_stats_recompute_trigger();

-- ═══════════════════════════════════════════════════════════════════════════
-- C. 클럭/블라인드 변이 RPC (5종)
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) ops_set_blind_levels — 전체 스케줄 교체(delete+insert, sort 1..N 연속) + 클럭 clamp/재앵커. §0.5 B2
CREATE OR REPLACE FUNCTION public.ops_set_blind_levels(
  p_tournament_id uuid, p_actor_id uuid, p_levels jsonb)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
 SET search_path = 'public', 'extensions', 'pg_temp'
AS $function$
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
  -- 클럭 직렬화: 토너먼트 행 잠금(클럭 RPC 와 동일 락 자원).
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
  -- 값 검증(duration>0, 음수 금지) — 테이블 CHECK 와 동일하나 명시 거부로 친절한 에러.
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

  -- 전체 교체: delete + insert sort 1..N
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

  -- §0.5 B2: 교체 후 current_level_sort clamp [1, N]. 변하면 안전 재앵커(틀린 블라인드/NaN 카운트다운 차단).
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

  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (p_tournament_id, 'level_set', p_actor_id,
          jsonb_build_object('action', 'blind_levels_set', 'count', v_count, 'reanchored', v_reanchored));

  RETURN jsonb_build_object('tournament_id', p_tournament_id, 'count', v_count, 'reanchored', v_reanchored);
END;
$function$;

-- 2) ops_clock_start — 시작/재개. 블라인드 없으면 거부. 재개 시 남은시간 보존. §1.2
CREATE OR REPLACE FUNCTION public.ops_clock_start(
  p_tournament_id uuid, p_actor_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
 SET search_path = 'public', 'extensions', 'pg_temp'
AS $function$
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
  IF NOT EXISTS (SELECT 1 FROM public.ops_blind_levels WHERE tournament_id = p_tournament_id) THEN
    RAISE EXCEPTION 'OPS_NO_BLIND_LEVELS: 블라인드 레벨이 없습니다' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_clock FROM public.ops_clock WHERE tournament_id = p_tournament_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TOURNAMENT_NOT_FOUND: 클럭 행 없음 (%)', p_tournament_id USING ERRCODE = 'P0001';
  END IF;
  IF v_clock.is_running THEN
    -- 이미 진행 중 → 멱등 무시
    RETURN jsonb_build_object('tournament_id', p_tournament_id, 'is_running', true, 'noop', true);
  END IF;

  -- 현재 레벨 길이. 현재 sort 에 레벨이 없으면 첫 레벨로 클램프.
  SELECT duration_sec INTO v_duration FROM public.ops_blind_levels
    WHERE tournament_id = p_tournament_id AND sort = v_clock.current_level_sort;
  IF v_duration IS NULL THEN
    SELECT sort, duration_sec INTO v_clock.current_level_sort, v_duration
      FROM public.ops_blind_levels WHERE tournament_id = p_tournament_id ORDER BY sort LIMIT 1;
  END IF;

  -- 재개 시 남은시간 보존: level_started_at = now() - 경과(=duration - 남은). 신규 시작이면 paused_remaining_sec=NULL → 경과 0.
  UPDATE public.ops_clock SET
    current_level_sort   = v_clock.current_level_sort,
    is_running           = true,
    level_started_at     = now() - make_interval(secs => (v_duration - COALESCE(v_clock.paused_remaining_sec, v_duration))),
    paused_remaining_sec = NULL
  WHERE tournament_id = p_tournament_id;

  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (p_tournament_id, 'level_play', p_actor_id,
          jsonb_build_object('level_sort', v_clock.current_level_sort));

  RETURN jsonb_build_object('tournament_id', p_tournament_id, 'is_running', true,
                            'current_level_sort', v_clock.current_level_sort);
END;
$function$;

-- 3) ops_clock_pause — 일시정지. 잔여 스냅샷. running 아니면 무시. §1.2
CREATE OR REPLACE FUNCTION public.ops_clock_pause(
  p_tournament_id uuid, p_actor_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
 SET search_path = 'public', 'extensions', 'pg_temp'
AS $function$
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

  SELECT * INTO v_clock FROM public.ops_clock WHERE tournament_id = p_tournament_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TOURNAMENT_NOT_FOUND: 클럭 행 없음 (%)', p_tournament_id USING ERRCODE = 'P0001';
  END IF;
  IF NOT v_clock.is_running THEN
    -- running 아니면 무시(멱등)
    RETURN jsonb_build_object('tournament_id', p_tournament_id, 'is_running', false, 'noop', true);
  END IF;

  SELECT duration_sec INTO v_duration FROM public.ops_blind_levels
    WHERE tournament_id = p_tournament_id AND sort = v_clock.current_level_sort;

  -- 잔여 = duration - 서버경과(트랜잭션 now 기준). 음수면 0.
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
$function$;

-- 4) ops_clock_set_level — 특정 레벨로 이동(수동 레벨전환). 존재하는 sort 만. §1.2
CREATE OR REPLACE FUNCTION public.ops_clock_set_level(
  p_tournament_id uuid, p_actor_id uuid, p_sort int)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
 SET search_path = 'public', 'extensions', 'pg_temp'
AS $function$
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

  -- current_level_sort 변경 + 새 앵커. paused_remaining_sec 초기화(새 레벨 = 잔여=full). is_running 유지.
  UPDATE public.ops_clock SET
    current_level_sort   = p_sort,
    level_started_at     = now(),
    paused_remaining_sec = NULL
  WHERE tournament_id = p_tournament_id;

  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (p_tournament_id, 'level_set', p_actor_id,
          jsonb_build_object('action', 'set_level', 'sort', p_sort));

  RETURN jsonb_build_object('tournament_id', p_tournament_id, 'current_level_sort', p_sort);
END;
$function$;

-- 5) ops_clock_adjust — ±N초 보정. 부호 규약: p_delta_sec>0 = 잔여시간 증가. §0.5 B7
--    ⚠️ 구현 메모: running 일 때 잔여 증가 = 앵커를 미래로(+delta). (계획 §0.5 본문의 '-=' 는 자체 계약
--       'p_delta>0=잔여증가' 및 paused 분기와 수학적으로 불일치하는 오기 → 계약/테스트를 따라 '+=' 채택.)
CREATE OR REPLACE FUNCTION public.ops_clock_adjust(
  p_tournament_id uuid, p_actor_id uuid, p_delta_sec int)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
 SET search_path = 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_clock record;
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

  SELECT * INTO v_clock FROM public.ops_clock WHERE tournament_id = p_tournament_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TOURNAMENT_NOT_FOUND: 클럭 행 없음 (%)', p_tournament_id USING ERRCODE = 'P0001';
  END IF;

  IF v_clock.is_running THEN
    -- 진행 중: 앵커를 +delta 미래로 → 경과 감소 → 잔여 증가(+delta).
    UPDATE public.ops_clock SET
      level_started_at = level_started_at + make_interval(secs => p_delta_sec)
    WHERE tournament_id = p_tournament_id;
  ELSE
    -- 일시정지/미시작: 잔여 스냅샷에 직접 +delta(하한 0).
    UPDATE public.ops_clock SET
      paused_remaining_sec = GREATEST(COALESCE(paused_remaining_sec, 0) + p_delta_sec, 0)
    WHERE tournament_id = p_tournament_id;
  END IF;

  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (p_tournament_id, 'level_set', p_actor_id,
          jsonb_build_object('action', 'adjust', 'adjust_sec', p_delta_sec));

  RETURN jsonb_build_object('tournament_id', p_tournament_id, 'adjust_sec', p_delta_sec);
END;
$function$;

-- ═══════════════════════════════════════════════════════════════════════════
-- D. backfill 재계산 — 재계산 함수 존재 이후 기존 대회 live_stats 채움(멱등, 0표시 방지). §0.5
-- ═══════════════════════════════════════════════════════════════════════════
SELECT public.fn_ops_recompute_live_stats(id) FROM public.ops_tournaments;
