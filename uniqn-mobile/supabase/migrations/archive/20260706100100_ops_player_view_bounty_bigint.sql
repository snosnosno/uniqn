-- OPS 1f 후속 — ops_get_player_view.bountyAccrued int*int 오버플로 수선 (#226 knockout_pool 과 동일 클래스).
-- 배경: bountyAccrued = v_p.knockouts(int) * v_t.bounty_cost(int) = int*int → 한 플레이어 knockouts>21 +
--   bounty 1억(CHECK 상한)이면 22억 > int max(2,147,483,647) → 22003 numeric overflow 로 플레이어뷰가 터진다.
--   read 경로(anon 공개 뷰)라 조용하지만(mutation 미차단), #226 이 고친 tournament-wide knockout_pool 의
--   per-player 적립 형제 지점. 현실 미도달이나 정공법 = bigint 승격.
-- 변경 1곳만: 산식 v_p.knockouts * v_t.bounty_cost → v_p.knockouts::bigint * v_t.bounty_cost.
--   함수 본체는 20260704100200_ops_1f_prize_rpcs.sql 의 live 정의 베이스 전건 보존(회귀 금지).
--   CREATE OR REPLACE — 시그니처 불변 → 기존 GRANT(anon/authenticated EXECUTE) 보존.
CREATE OR REPLACE FUNCTION public.ops_get_player_view(p_view_token text)
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
    'serverNow', now()
  );
END;
$function$;
