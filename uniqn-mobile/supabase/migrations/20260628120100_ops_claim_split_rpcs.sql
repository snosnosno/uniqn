-- 라이브 운영(ops) claim 토큰 분리 — RPC.
-- 보안 핵심: 읽기(view_token)와 claim(8자 PIN) 분리. 구 2-인자 claim·issue_claim_token DROP(오버로딩 우회 차단).
-- player_view 는 파라미터명 변경(claim_token→view_token) 위해 DROP 후 CREATE(42P13 회피).

-- ── 1) 구 함수 명시 DROP (오버로딩 잔존 = 우회구멍) ──
DROP FUNCTION IF EXISTS public.ops_get_player_view(text);
DROP FUNCTION IF EXISTS public.ops_issue_claim_token(uuid, uuid);
DROP FUNCTION IF EXISTS public.ops_claim_participant(text, uuid);

-- ── 2) ops_get_player_view(p_view_token) — anon 공개 읽기(본인 안전필드만) ──
CREATE FUNCTION public.ops_get_player_view(p_view_token text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
 SET search_path = 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_p record; v_seat record; v_t record; v_clock record; v_cur record; v_stats record;
BEGIN
  IF p_view_token IS NULL OR char_length(p_view_token) < 32 THEN
    RAISE EXCEPTION 'OPS_VIEW_TOKEN_INVALID: 유효하지 않은 플레이어 토큰' USING ERRCODE = 'P0001';
  END IF;

  -- 본인 1행. 안전필드만 — view_token/claim_pin_hash/phone/nationality/note/player_user_id 미선택.
  SELECT id, tournament_id, entry_number, name, status, chips,
         finish_position, prize_amount, rebuys, add_ons, reentries
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

  SELECT name, venue, game_type, status
    INTO v_t FROM public.ops_tournaments WHERE id = v_p.tournament_id;

  SELECT current_level_sort, level_started_at, is_running, paused_remaining_sec
    INTO v_clock FROM public.ops_clock WHERE tournament_id = v_p.tournament_id;

  SELECT level, small_blind, big_blind, ante, duration_sec, is_break
    INTO v_cur FROM public.ops_blind_levels
    WHERE tournament_id = v_p.tournament_id AND sort = v_clock.current_level_sort;

  SELECT playing, entries, average_stack, avg_stack_bb
    INTO v_stats FROM public.ops_live_stats WHERE tournament_id = v_p.tournament_id;

  RETURN jsonb_build_object(
    'me', jsonb_build_object(
      'entryNumber', v_p.entry_number, 'name', v_p.name, 'status', v_p.status::text,
      'chips', v_p.chips, 'finishPosition', v_p.finish_position, 'prizeAmount', v_p.prize_amount,
      'rebuys', v_p.rebuys, 'addOns', v_p.add_ons, 'reentries', v_p.reentries,
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
    'serverNow', now()
  );
END;
$function$;

-- ── 3) ops_issue_player_credentials — 운영자 발급(view_token 멱등 + PIN 로테이트) ──
CREATE FUNCTION public.ops_issue_player_credentials(p_participant_id uuid, p_actor_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
 SET search_path = 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_tid uuid; v_token text; v_rand bytea; v_pin text;
BEGIN
  IF auth.uid() IS NULL OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;
  SELECT tournament_id, view_token INTO v_tid, v_token
    FROM public.ops_participants WHERE id = p_participant_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PARTICIPANT_NOT_FOUND: 참가자를 찾을 수 없습니다 (%)', p_participant_id USING ERRCODE = 'P0001';
  END IF;
  IF NOT (public.is_ops_member(v_tid, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 관리 권한 없음' USING ERRCODE = 'P0001';
  END IF;

  -- view_token 멱등(안정 URL/QR). 미발급 시에만 생성.
  IF v_token IS NULL THEN
    v_token := encode(gen_random_bytes(24), 'hex');
  END IF;

  -- 새 PIN 로테이트(균일 8자 base32 — 256=8*32 모듈로 편향 0).
  v_rand := gen_random_bytes(8);
  v_pin := (SELECT string_agg(
              substr('0123456789ABCDEFGHJKMNPQRSTVWXYZ', 1 + (get_byte(v_rand, g) % 32), 1),
              '' ORDER BY g)
            FROM generate_series(0, 7) AS g);

  UPDATE public.ops_participants
    SET view_token = v_token,
        claim_pin_hash = crypt(v_pin, gen_salt('bf'))
    WHERE id = p_participant_id;

  RETURN jsonb_build_object('participantId', p_participant_id, 'viewToken', v_token, 'claimPin', v_pin);
END;
$function$;

-- ── 4) ops_claim_participant(view_token, pin, user_id) — 플레이어 본인 바인딩(PIN 게이트) ──
CREATE FUNCTION public.ops_claim_participant(p_view_token text, p_claim_pin text, p_user_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
 SET search_path = 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_p record;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 본인 계정으로만 등록할 수 있습니다' USING ERRCODE = 'P0001';
  END IF;
  -- fail-closed: NULL 명시 가드(NULL ~ regex = NULL 우회 차단).
  IF p_view_token IS NULL OR char_length(p_view_token) < 32 THEN
    RAISE EXCEPTION 'OPS_VIEW_TOKEN_INVALID: 유효하지 않은 플레이어 토큰' USING ERRCODE = 'P0001';
  END IF;
  IF p_claim_pin IS NULL OR upper(p_claim_pin) !~ '^[0-9A-HJKMNP-TV-Z]{8}$' THEN
    RAISE EXCEPTION 'OPS_CLAIM_PIN_INVALID: 연결 PIN 형식이 올바르지 않습니다' USING ERRCODE = 'P0001';
  END IF;

  SELECT id, player_user_id, claim_pin_hash INTO v_p
    FROM public.ops_participants WHERE view_token = p_view_token FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'OPS_VIEW_TOKEN_INVALID: 유효하지 않은 플레이어 토큰' USING ERRCODE = 'P0001';
  END IF;

  -- NULL-안전 PIN 검증 + 오라클 회피(미발급=오답과 동일 코드).
  IF v_p.claim_pin_hash IS NULL
     OR crypt(upper(p_claim_pin), v_p.claim_pin_hash) IS DISTINCT FROM v_p.claim_pin_hash THEN
    RAISE EXCEPTION 'OPS_CLAIM_PIN_INVALID: 연결 PIN이 올바르지 않습니다' USING ERRCODE = 'P0001';
  END IF;

  IF v_p.player_user_id IS NOT NULL THEN
    IF v_p.player_user_id = p_user_id THEN
      RETURN jsonb_build_object('participantId', v_p.id, 'claimed', true, 'noop', true);
    END IF;
    RAISE EXCEPTION 'OPS_CLAIM_ALREADY_CLAIMED: 이미 다른 계정에 연결된 참가자입니다' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.ops_participants SET player_user_id = p_user_id WHERE id = v_p.id;
  RETURN jsonb_build_object('participantId', v_p.id, 'claimed', true);
END;
$function$;
