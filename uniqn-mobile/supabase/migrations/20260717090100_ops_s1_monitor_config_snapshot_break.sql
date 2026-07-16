-- ops 전면 개방 S1 — C1(다음 브레이크 카운트다운) + C6(TV 모니터 프리셋+5슬롯).
-- 스펙: docs/superpowers/specs/2026-07-17-ops-tv-monitor-preset-slots-design.md (결정 T1~T6)
-- 구성:
--   ① ops_tournaments.monitor_config jsonb 컬럼 (NULL = 기본값 full+기본 5슬롯)
--   ② ops_set_monitor_config SECDEF RPC — owner 전용 · 서버측 화이트리스트 검증(P0001)
--   ③ ops_get_monitor_snapshot 교체 — monitorConfig · payouts(상위 5) · nextBreak 동시 편승
--   ④ ops_get_player_view 교체 — nextBreak 편승
-- 계약: anon-executable ops SECDEF =2(monitor/player) 유지 — 신규 함수는 PUBLIC/anon REVOKE.
--       CREATE OR REPLACE 는 기존 ACL 을 보존하므로 ③④의 anon GRANT 는 그대로 유지된다.

-- ① monitor_config 컬럼
ALTER TABLE public.ops_tournaments
  ADD COLUMN IF NOT EXISTS monitor_config jsonb;

COMMENT ON COLUMN public.ops_tournaments.monitor_config IS
  'TV 모니터 구성(C6). {"v":1,"preset":"full|mirror|classic","slots":[모듈id|null ×5]}. NULL=기본(full+기본 5슬롯). 쓰기는 ops_set_monitor_config 전용, 서버측 화이트리스트로 재조립 저장(비-PII 보증).';

-- ② TV 모니터 구성 쓰기 RPC — owner 전용
CREATE OR REPLACE FUNCTION public.ops_set_monitor_config(
  p_tournament_id uuid,
  p_actor_id uuid,
  p_config jsonb
) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_t record;
  v_preset text;
  v_slots jsonb;
  v_slot_text text;
  v_clean jsonb;
  i int;
BEGIN
  -- actor 바인딩(위조 차단) — NULL 가드 포함(IS DISTINCT FROM)
  IF auth.uid() IS NULL OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;

  SELECT id, owner_id INTO v_t
    FROM public.ops_tournaments WHERE id = p_tournament_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TOURNAMENT_NOT_FOUND: 대회를 찾을 수 없습니다 (%)', p_tournament_id
      USING ERRCODE = 'P0001';
  END IF;

  -- owner 전용(스태프 쓰기 분리는 F3 후속과 동축 — 스펙 §4-2)
  IF v_t.owner_id IS DISTINCT FROM p_actor_id AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 소유자만 TV 모니터 구성을 변경할 수 있습니다'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_config IS NULL THEN
    -- NULL = 기본값 복귀
    UPDATE public.ops_tournaments SET monitor_config = NULL WHERE id = p_tournament_id;
    INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
    VALUES (p_tournament_id, 'monitor_config_set', p_actor_id, jsonb_build_object('reset', true));
    RETURN jsonb_build_object('tournament_id', p_tournament_id, 'monitor_config', NULL);
  END IF;

  -- 서버측 화이트리스트 검증(T5) — 위반 시 P0001
  IF jsonb_typeof(p_config) <> 'object' THEN
    RAISE EXCEPTION 'OPS_MONITOR_CONFIG_INVALID: 구성은 객체여야 합니다' USING ERRCODE = 'P0001';
  END IF;
  IF COALESCE(p_config->>'v', '') <> '1' THEN
    RAISE EXCEPTION 'OPS_MONITOR_CONFIG_INVALID: 지원하지 않는 구성 버전' USING ERRCODE = 'P0001';
  END IF;
  v_preset := p_config->>'preset';
  IF v_preset IS NULL OR v_preset NOT IN ('full', 'mirror', 'classic') THEN
    RAISE EXCEPTION 'OPS_MONITOR_CONFIG_INVALID: 알 수 없는 preset' USING ERRCODE = 'P0001';
  END IF;
  v_slots := p_config->'slots';
  IF v_slots IS NULL OR jsonb_typeof(v_slots) <> 'array' OR jsonb_array_length(v_slots) <> 5 THEN
    RAISE EXCEPTION 'OPS_MONITOR_CONFIG_INVALID: slots 는 길이 5 배열이어야 합니다' USING ERRCODE = 'P0001';
  END IF;
  FOR i IN 0..4 LOOP
    IF jsonb_typeof(v_slots->i) NOT IN ('null', 'string') THEN
      RAISE EXCEPTION 'OPS_MONITOR_CONFIG_INVALID: 슬롯 원소는 모듈 id 또는 null 이어야 합니다'
        USING ERRCODE = 'P0001';
    END IF;
    v_slot_text := v_slots->>i;
    IF v_slot_text IS NOT NULL AND v_slot_text NOT IN (
      'players', 'totalChips', 'avgStack', 'regStatus', 'nextBreak',
      'nextBlinds', 'entries', 'tables', 'prizePool', 'koPool'
    ) THEN
      RAISE EXCEPTION 'OPS_MONITOR_CONFIG_INVALID: 알 수 없는 슬롯 모듈(%)', v_slot_text
        USING ERRCODE = 'P0001';
    END IF;
  END LOOP;

  -- 알려진 키만 재조립 저장(임의 키 저장 금지 — anon 스냅샷으로 흘러가는 비-PII 보증)
  v_clean := jsonb_build_object('v', 1, 'preset', v_preset, 'slots', v_slots);

  UPDATE public.ops_tournaments SET monitor_config = v_clean WHERE id = p_tournament_id;

  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (p_tournament_id, 'monitor_config_set', p_actor_id, jsonb_build_object('preset', v_preset));

  RETURN jsonb_build_object('tournament_id', p_tournament_id, 'monitor_config', v_clean);
END;
$$;

ALTER FUNCTION public.ops_set_monitor_config(uuid, uuid, jsonb) OWNER TO postgres;

-- anon-executable =2 계약 유지: 신규 SECDEF 는 PUBLIC 상속 EXECUTE 를 명시 회수
REVOKE ALL ON FUNCTION public.ops_set_monitor_config(uuid, uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ops_set_monitor_config(uuid, uuid, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.ops_set_monitor_config(uuid, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ops_set_monitor_config(uuid, uuid, jsonb) TO service_role;

-- ③ 전광판 스냅샷 교체 — monitorConfig · payouts(상위 5) · nextBreak 추가.
--    기존 반환 키는 전부 보존(구버전 클라 호환). ACL 은 CREATE OR REPLACE 로 보존(anon GRANT 유지).
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

  SELECT id, name, venue, event_date, game_type, status, color, registration_open, monitor_config
    INTO v_t FROM public.ops_tournaments WHERE monitor_token = p_monitor_token;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'OPS_MONITOR_TOKEN_INVALID: 유효하지 않은 모니터 토큰' USING ERRCODE = 'P0001';
  END IF;

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

-- ④ 플레이어 뷰 교체 — nextBreak 편승(C1). 기존 반환 키 전부 보존.
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
