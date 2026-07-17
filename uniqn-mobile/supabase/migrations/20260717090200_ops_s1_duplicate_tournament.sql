-- ops 전면 개방 S1 — A4 대회 복제(d4 확정): "지난 대회와 같은 설정으로 새 대회".
-- 복사 대상: 대회 설정 컬럼 전체(칩/비용/재진입/색상 등) + 블라인드 구조 + monitor_config(C6-⑥).
-- 복사 제외(사유):
--   · job_posting_id — 공고 연결은 이벤트 단위 계약(워크스페이스 스코프 오염 방지, 연결 변경은 소유자 전용 규약)
--   · monitor_token — 토큰 재사용 금지(신규 대회는 ops_rotate_monitor_token 으로 재발급)
--   · ops_prizes — 절대금액 상금 구조는 엔트리 수 종속(복사 시 오표시 위험), 대회 중 재설정이 관례
--   · 참가자/테이블/좌석/이벤트 — 라이브 상태는 복제 대상 아님
-- ops_clock/ops_live_stats 행은 trg_ops_init_derived_rows(AFTER INSERT)가 자동 생성.
-- 계약: anon-executable ops SECDEF =2 유지 — PUBLIC/anon REVOKE 필수.

CREATE OR REPLACE FUNCTION public.ops_duplicate_tournament(
  p_source_tournament_id uuid,
  p_actor_id uuid,
  p_name text DEFAULT NULL,
  p_event_date date DEFAULT NULL
) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_src record;
  v_new_id uuid;
  v_levels_copied int := 0;
BEGIN
  -- actor 바인딩(위조 차단) — NULL 가드 포함
  IF auth.uid() IS NULL OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_src FROM public.ops_tournaments WHERE id = p_source_tournament_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TOURNAMENT_NOT_FOUND: 대회를 찾을 수 없습니다 (%)', p_source_tournament_id
      USING ERRCODE = 'P0001';
  END IF;

  -- 복제는 소유자 전용(F3 1차 owner 단위 — 워크스페이스 멤버 복제는 후속)
  IF v_src.owner_id IS DISTINCT FROM p_actor_id AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 소유자만 복제할 수 있습니다' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.ops_tournaments (
    owner_id, job_posting_id, name, venue, event_date, game_type, status,
    seats_per_table, starting_chips, color,
    buy_in_chips, rebuy_chips, addon_chips,
    buy_in_cost, fee_cost, rebuy_cost, addon_cost, bounty_cost,
    registration_open, auto_seat_on_register, reentry_allowed, max_reentries,
    monitor_config
  )
  VALUES (
    p_actor_id, NULL, COALESCE(NULLIF(btrim(p_name), ''), v_src.name), v_src.venue,
    p_event_date, v_src.game_type, 'upcoming',
    v_src.seats_per_table, v_src.starting_chips, v_src.color,
    v_src.buy_in_chips, v_src.rebuy_chips, v_src.addon_chips,
    v_src.buy_in_cost, v_src.fee_cost, v_src.rebuy_cost, v_src.addon_cost, v_src.bounty_cost,
    true, v_src.auto_seat_on_register, v_src.reentry_allowed, v_src.max_reentries,
    v_src.monitor_config
  )
  RETURNING id INTO v_new_id;

  INSERT INTO public.ops_blind_levels
    (tournament_id, level, small_blind, big_blind, ante, duration_sec, is_break, sort)
  SELECT v_new_id, level, small_blind, big_blind, ante, duration_sec, is_break, sort
    FROM public.ops_blind_levels
   WHERE tournament_id = v_src.id;
  GET DIAGNOSTICS v_levels_copied = ROW_COUNT;

  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (v_new_id, 'tournament_created', p_actor_id,
          jsonb_build_object('name', COALESCE(NULLIF(btrim(p_name), ''), v_src.name),
                             'duplicated_from', v_src.id));

  RETURN jsonb_build_object('tournament_id', v_new_id, 'levels_copied', v_levels_copied);
END;
$$;

ALTER FUNCTION public.ops_duplicate_tournament(uuid, uuid, text, date) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.ops_duplicate_tournament(uuid, uuid, text, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ops_duplicate_tournament(uuid, uuid, text, date) FROM anon;
GRANT EXECUTE ON FUNCTION public.ops_duplicate_tournament(uuid, uuid, text, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ops_duplicate_tournament(uuid, uuid, text, date) TO service_role;
