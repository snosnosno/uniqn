-- 라이브 운영(ops) 1c-4 — 공개 플레이어뷰 RPC (가장 위험: anon + per-user PII + claim 바인딩).
-- 보안 철칙(§3·§5.3): anon 은 ops 테이블 직접 SELECT 안 함 — claim_token→스코프 SECDEF RPC 만.
--   ops_get_player_view 는 claim_token 일치 **본인 1행의 안전필드만** 반환
--   (phone·nationality·claim_token·player_user_id·note·타참가자 절대 미포함). is_ops_member 미호출(anon).
-- 토큰 = encode(gen_random_bytes(24),'hex'). 반환 jsonb 는 camelCase 키.
-- 상태범위 1c 한정(§0.5 B9): 내 자리·스택·라이브 클럭·블라인드. 탈락 ITM 배너·재진입은 1d/1f.

-- ═══════════════════════════════════════════════════════════════════════════
-- 1) ops_get_player_view(p_claim_token) — anon 공개 플레이어뷰(본인 안전필드 화이트리스트).
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.ops_get_player_view(p_claim_token text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
 SET search_path = 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_p     record;  -- 본인 참가자
  v_seat  record;  -- 본인 좌석(있으면)
  v_t     record;  -- 대회 비-PII 메타
  v_clock record;
  v_cur   record;
  v_stats record;
BEGIN
  IF p_claim_token IS NULL OR char_length(p_claim_token) < 32 THEN
    RAISE EXCEPTION 'OPS_CLAIM_TOKEN_INVALID: 유효하지 않은 플레이어 토큰' USING ERRCODE = 'P0001';
  END IF;

  -- 본인 1행(claim_token UNIQUE). 안전필드만 INTO — PII(phone/nationality/note)·claim_token·player_user_id 미선택.
  SELECT id, tournament_id, entry_number, name, status, chips,
         finish_position, prize_amount, rebuys, add_ons, reentries
    INTO v_p
    FROM public.ops_participants
    WHERE claim_token = p_claim_token;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'OPS_CLAIM_TOKEN_INVALID: 유효하지 않은 플레이어 토큰' USING ERRCODE = 'P0001';
  END IF;

  -- 본인 좌석만(participant_id = 본인). 타 참가자 좌석 절대 조회 안 함.
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

  -- 공개 집계 부분집합(개별 참가자 노출 없음).
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

-- ═══════════════════════════════════════════════════════════════════════════
-- 2) ops_issue_claim_token(p_participant_id, p_actor_id) — 운영자(authed) claim_token 발급(멱등).
--    운영자가 QR 슬립 생성용 토큰 획득. actor 가드 + 참가자 대회의 is_ops_member.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.ops_issue_claim_token(
  p_participant_id uuid, p_actor_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
 SET search_path = 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_tid uuid;
  v_token text;
BEGIN
  IF auth.uid() IS NULL OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;
  SELECT tournament_id, claim_token INTO v_tid, v_token
    FROM public.ops_participants WHERE id = p_participant_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PARTICIPANT_NOT_FOUND: 참가자를 찾을 수 없습니다 (%)', p_participant_id USING ERRCODE = 'P0001';
  END IF;
  IF NOT (public.is_ops_member(v_tid, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 관리 권한 없음' USING ERRCODE = 'P0001';
  END IF;

  IF v_token IS NULL THEN
    v_token := encode(gen_random_bytes(24), 'hex');
    UPDATE public.ops_participants SET claim_token = v_token WHERE id = p_participant_id;
  END IF;

  RETURN jsonb_build_object('participantId', p_participant_id, 'claimToken', v_token);
END;
$function$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3) ops_claim_participant(p_claim_token, p_user_id) — 플레이어(authed) 본인 계정 1회 바인딩.
--    셀프서비스: auth.uid()=p_user_id(본인만) + 토큰 소지. is_ops_member 미검사(플레이어는 멤버 아님).
--    player_user_id 1회 바인딩 — 이미 타인 바인딩 시 OPS_CLAIM_ALREADY_CLAIMED.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.ops_claim_participant(
  p_claim_token text, p_user_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
 SET search_path = 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_p record;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 본인 계정으로만 등록할 수 있습니다' USING ERRCODE = 'P0001';
  END IF;
  IF p_claim_token IS NULL OR char_length(p_claim_token) < 32 THEN
    RAISE EXCEPTION 'OPS_CLAIM_TOKEN_INVALID: 유효하지 않은 플레이어 토큰' USING ERRCODE = 'P0001';
  END IF;

  SELECT id, player_user_id INTO v_p
    FROM public.ops_participants WHERE claim_token = p_claim_token FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'OPS_CLAIM_TOKEN_INVALID: 유효하지 않은 플레이어 토큰' USING ERRCODE = 'P0001';
  END IF;

  IF v_p.player_user_id IS NOT NULL THEN
    IF v_p.player_user_id = p_user_id THEN
      RETURN jsonb_build_object('participantId', v_p.id, 'claimed', true, 'noop', true);  -- 멱등
    END IF;
    RAISE EXCEPTION 'OPS_CLAIM_ALREADY_CLAIMED: 이미 다른 계정에 연결된 참가자입니다' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.ops_participants SET player_user_id = p_user_id WHERE id = v_p.id;
  RETURN jsonb_build_object('participantId', v_p.id, 'claimed', true);
END;
$function$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4) ops_unclaim_participant(p_participant_id, p_actor_id) — 운영자(authed) 바인딩 해제(복구 경로).
--    적대리뷰 대응: claim 은 사용자 self-rebind 불가(비가역)지만, 오클레임/하이재킹 복구를 위해
--    운영자(is_ops_member) override 로 player_user_id=NULL 해제 허용. 이후 정당 플레이어 재클레임 가능.
--    ⚠️ 1d/1f(player_user_id 가 권한키로 승급) 진입 전 view/claim 토큰 분리·PIN 신원게이트 재설계 필수.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.ops_unclaim_participant(
  p_participant_id uuid, p_actor_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
 SET search_path = 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_tid uuid;
BEGIN
  IF auth.uid() IS NULL OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;
  SELECT tournament_id INTO v_tid
    FROM public.ops_participants WHERE id = p_participant_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PARTICIPANT_NOT_FOUND: 참가자를 찾을 수 없습니다 (%)', p_participant_id USING ERRCODE = 'P0001';
  END IF;
  IF NOT (public.is_ops_member(v_tid, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 관리 권한 없음' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.ops_participants SET player_user_id = NULL WHERE id = p_participant_id;
  RETURN jsonb_build_object('participantId', p_participant_id, 'unclaimed', true);
END;
$function$;
