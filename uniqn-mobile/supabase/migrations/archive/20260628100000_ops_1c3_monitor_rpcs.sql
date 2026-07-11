-- 라이브 운영(ops) 1c-3 — 공개 모니터(전광판) RPC.
-- 보안 철칙(§3): anon 은 ops 테이블 직접 SELECT 하지 않는다. 공개 데이터는 token→스코프 SECDEF RPC 만 통과.
--   ops_get_monitor_snapshot 은 monitor_token 일치 1행의 **비-PII 화이트리스트 투영만** 반환
--   (참가자 PII·claim_token·monitor_token·owner_id·코스트 미포함). is_ops_member 호출 안 함(anon poison 회피).
-- 패턴: 20260627100100_ops_1c_clock_rpcs.sql(actor 가드/FOR UPDATE/is_ops_member),
--       토큰 = encode(gen_random_bytes(24),'hex')(48자 hex, 192bit — base64url Postgres 미지원, §0.5 B4).
-- 반환 jsonb 는 클라 소비 편의를 위해 **camelCase 키**(toCamelCase 가 shallow 라 중첩 변환 회피).

-- ═══════════════════════════════════════════════════════════════════════════
-- 1) ops_rotate_monitor_token — 운영자(authed) 모니터 토큰 발급/회전.
--    멱등: 토큰 없으면 생성·있으면 그대로 반환(인쇄 QR/링크 보존). p_force=true 면 강제 재발급(유출 대응).
--    토큰 발급은 참가자/클럭 상태변경이 아니므로 ops_events 미기록(§0.5: rotate event 생략 가능).
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.ops_rotate_monitor_token(
  p_tournament_id uuid, p_actor_id uuid, p_force boolean DEFAULT false)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
 SET search_path = 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_token text;
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

  SELECT monitor_token INTO v_token FROM public.ops_tournaments WHERE id = p_tournament_id;
  IF v_token IS NULL OR p_force THEN
    v_token := encode(gen_random_bytes(24), 'hex');   -- 48자 hex(192bit), URL-safe
    UPDATE public.ops_tournaments SET monitor_token = v_token WHERE id = p_tournament_id;
  END IF;

  RETURN jsonb_build_object('tournamentId', p_tournament_id, 'monitorToken', v_token);
END;
$function$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2) ops_get_monitor_snapshot — anon 공개 전광판 스냅샷(비-PII 화이트리스트 투영).
--    토큰가드(NULL/길이<32) → P0001. monitor_token 미일치 → P0001(존재 노출 회피).
--    SECDEF 로 RLS 우회하되 **반환값 화이트리스트**로 유출 차단. is_ops_member 미호출(anon).
--    상태범위 1c 한정(§0.5 B9): 시작전/진행/일시정지/브레이크/레벨전환. 종료·우승자·상금 미포함.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.ops_get_monitor_snapshot(p_monitor_token text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
 SET search_path = 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_t     record;
  v_clock record;
  v_stats record;
  v_cur   record;
  v_next  record;
BEGIN
  IF p_monitor_token IS NULL OR char_length(p_monitor_token) < 32 THEN
    RAISE EXCEPTION 'OPS_MONITOR_TOKEN_INVALID: 유효하지 않은 모니터 토큰' USING ERRCODE = 'P0001';
  END IF;

  SELECT id, name, venue, event_date, game_type, status, color, registration_open
    INTO v_t
    FROM public.ops_tournaments
    WHERE monitor_token = p_monitor_token;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'OPS_MONITOR_TOKEN_INVALID: 유효하지 않은 모니터 토큰' USING ERRCODE = 'P0001';
  END IF;

  SELECT current_level_sort, level_started_at, is_running, paused_remaining_sec
    INTO v_clock FROM public.ops_clock WHERE tournament_id = v_t.id;

  SELECT playing, entries, reentries_total, tables_open, seats_total, seats_free,
         total_chips, average_stack, avg_stack_bb, prize_pool
    INTO v_stats FROM public.ops_live_stats WHERE tournament_id = v_t.id;

  SELECT level, small_blind, big_blind, ante, duration_sec, is_break
    INTO v_cur FROM public.ops_blind_levels
    WHERE tournament_id = v_t.id AND sort = v_clock.current_level_sort;

  SELECT level, small_blind, big_blind, ante, duration_sec, is_break
    INTO v_next FROM public.ops_blind_levels
    WHERE tournament_id = v_t.id AND sort = v_clock.current_level_sort + 1;

  RETURN jsonb_build_object(
    'tournament', jsonb_build_object(
      'name', v_t.name, 'venue', v_t.venue, 'eventDate', v_t.event_date,
      'gameType', v_t.game_type, 'status', v_t.status::text, 'color', v_t.color,
      'registrationOpen', v_t.registration_open),
    'clock', jsonb_build_object(
      'currentLevelSort', v_clock.current_level_sort, 'levelStartedAt', v_clock.level_started_at,
      'isRunning', COALESCE(v_clock.is_running, false), 'pausedRemainingSec', v_clock.paused_remaining_sec),
    'currentLevel', CASE WHEN v_cur IS NULL THEN NULL ELSE jsonb_build_object(
      'level', v_cur.level, 'smallBlind', v_cur.small_blind, 'bigBlind', v_cur.big_blind,
      'ante', v_cur.ante, 'durationSec', v_cur.duration_sec, 'isBreak', v_cur.is_break) END,
    'nextLevel', CASE WHEN v_next IS NULL THEN NULL ELSE jsonb_build_object(
      'level', v_next.level, 'smallBlind', v_next.small_blind, 'bigBlind', v_next.big_blind,
      'ante', v_next.ante, 'durationSec', v_next.duration_sec, 'isBreak', v_next.is_break) END,
    'stats', jsonb_build_object(
      'playing', COALESCE(v_stats.playing, 0), 'entries', COALESCE(v_stats.entries, 0),
      'reentriesTotal', COALESCE(v_stats.reentries_total, 0), 'tablesOpen', COALESCE(v_stats.tables_open, 0),
      'seatsTotal', COALESCE(v_stats.seats_total, 0), 'seatsFree', COALESCE(v_stats.seats_free, 0),
      'totalChips', COALESCE(v_stats.total_chips, 0), 'averageStack', COALESCE(v_stats.average_stack, 0),
      'avgStackBb', COALESCE(v_stats.avg_stack_bb, 0), 'prizePool', COALESCE(v_stats.prize_pool, 0)),
    'serverNow', now()
  );
END;
$function$;
