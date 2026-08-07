-- ops 결함② — 노쇼 표시/취소 RPC.
--
-- 배경: `ops_participant_status` 에 `no_show` 가 있는데 **이 값을 쓰는 함수가 0개**였다
--   (2026-08-08 prod pg_proc 실측: no_show 를 언급하는 ops 함수는 ops_assign_seat ·
--    ops_redraw_waitlist_fill · ops_import_staff_from_posting **3개뿐이고 전부 제외 필터**).
--   등록만 하고 오지 않은 참가자를 표시할 방법이 없어, 대기 인원 수·좌석 배정 풀에 영구히 남았다.
--
-- ── 설계 결정 ─────────────────────────────────────────────
--  · **게이트를 checked_in 하나로 좁혔다.** TS 상태기계 표는 `registered` 에서도 markNoShow 를
--    허용하지만, 같은 실측에서 **`registered` 를 쓰거나 읽는 ops 함수도 0개**였다
--    (ops_register_participant 는 active|checked_in 만 만든다) — 즉 도달 불가 상태다.
--    두 출발 상태를 허용하면 되돌리기 목적지가 모호해지므로(어디로 돌려놓아야 하나) 좁힌다.
--    선등록 흐름이 생기면 ops_events 의 status_before 를 읽어 복원하는 형태로 확장하라.
--  · **되돌리기는 checked_in 으로.** TS 표의 `no_show → activate: active` 를 따르지 않는다 —
--    active 는 "착석"의 의미이고, 좌석 없이 active 를 만들면 ops_live_stats 의 playing/
--    average_stack 이 좌석 없는 인원을 세어 오염된다. 대기열로 돌려놓으면 ops_assign_seat ·
--    ops_redraw_waitlist_fill 이 정상 경로로 다시 집어간다. (TS 표도 이 마이그와 함께 수정)
--  · **active 는 거부.** 착석해서 칩을 가진 참가자는 노쇼가 아니다 — 좌석 해제·순위·상금을
--    원자로 처리하는 ops_bust_participant 가 그 경로다.
--  · **좌석 점유 시 거부(fail-closed).** checked_in 은 정의상 좌석이 없지만(등록 시 배정 실패분),
--    데이터가 어긋나 좌석이 남아 있으면 조용히 유령 좌석을 만든다. 그 경우는 접고 알린다.
--  · **대회 status 게이트 없음** — ops_add_rebuy · ops_set_participant_chips 파리티.
--    대회 스코프 읽기가 없으므로 advisory lock / 대회행 FOR UPDATE 도 불필요(참가자 단일행 변이).
--  · chips 는 건드리지 않는다 — 되돌렸을 때 등록 시 받은 스택이 그대로 복원돼야 한다.
--    live_stats 는 active 만 세므로 checked_in↔no_show 왕복은 집계에 영향이 없다.
--
-- 계약: anon-executable ops SECDEF = **2 유지**(monitor/player) — PUBLIC/anon 명시 REVOKE.
-- 이벤트 타입 player_no_show / player_no_show_undone 은 20260808200000 에서 선행 추가.
-- 파리티: 신규 함수 1개 → 202 → **203**. 정책 변경 0 → 111 불변.
-- 회귀 고정: supabase/tests/ops_set_participant_no_show.test.sql

CREATE OR REPLACE FUNCTION public.ops_set_participant_no_show(
  p_participant_id uuid,
  p_actor_id uuid,
  p_no_show boolean
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = 'public', 'extensions', 'pg_temp'
AS $$
DECLARE
  v_p record;
  v_seat_count int;
  v_next public.ops_participant_status;
BEGIN
  -- 1) actor 바인딩(위조 차단) — NULL 가드 포함
  IF auth.uid() IS NULL
     OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;

  -- 2) 순수 인자 검증 — 행 잠금 전에 판정(잠금 보유 시간 최소화).
  --    boolean 이지만 NULL 은 접는다. NULL 을 흘리면 아래 분기가 어느 쪽도 타지 않고
  --    "성공했는데 아무 일도 안 일어난" 응답이 나간다 — 결함④와 같은 종류의 조용한 실패.
  IF p_no_show IS NULL THEN
    RAISE EXCEPTION 'NO_SHOW_FLAG_INVALID: 노쇼 여부(true/false)를 지정해야 합니다'
      USING ERRCODE = 'P0001';
  END IF;

  -- 3) 참가자 행 FOR UPDATE
  SELECT id, tournament_id, status
    INTO v_p
    FROM public.ops_participants
    WHERE id = p_participant_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PARTICIPANT_NOT_FOUND: 참가자를 찾을 수 없습니다 (%)', p_participant_id
      USING ERRCODE = 'P0001';
  END IF;

  -- 4) 멤버십 2차 가드
  IF NOT (public.is_ops_member(v_p.tournament_id, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 관리 권한 없음' USING ERRCODE = 'P0001';
  END IF;

  -- 5) 멱등 no-op — 이미 목표 상태면 이벤트 0행. 실시간 목록에서 두 번 눌리기 쉽다.
  IF (p_no_show AND v_p.status = 'no_show')
     OR (NOT p_no_show AND v_p.status = 'checked_in') THEN
    RETURN jsonb_build_object('participant_id', p_participant_id,
                              'status', v_p.status, 'status_before', v_p.status);
  END IF;

  -- 6) 상태 게이트
  IF p_no_show THEN
    IF v_p.status <> 'checked_in' THEN
      RAISE EXCEPTION 'PARTICIPANT_NOT_PENDING: 대기(checked_in) 참가자만 노쇼 처리할 수 있습니다 (status=%)',
        v_p.status USING ERRCODE = 'P0001';
    END IF;
    v_next := 'no_show';
  ELSE
    IF v_p.status <> 'no_show' THEN
      RAISE EXCEPTION 'PARTICIPANT_NOT_NO_SHOW: 노쇼로 표시된 참가자만 취소할 수 있습니다 (status=%)',
        v_p.status USING ERRCODE = 'P0001';
    END IF;
    v_next := 'checked_in';
  END IF;

  -- 7) 좌석 점유 fail-closed — checked_in 은 정의상 미착석이므로 여기 걸리면 데이터 불일치다.
  IF p_no_show THEN
    SELECT count(*) INTO v_seat_count
      FROM public.ops_seats WHERE participant_id = p_participant_id;
    IF v_seat_count > 0 THEN
      RAISE EXCEPTION 'PARTICIPANT_SEATED: 좌석을 점유한 참가자는 노쇼 처리할 수 없습니다 (좌석 %개) — 좌석 비우기를 먼저 사용하세요',
        v_seat_count USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- 8) 갱신 — updated_at 은 trg_ops_participants_set_updated_at(BEFORE UPDATE)이 자동 처리.
  --    live_stats 재계산은 DEFERRED CONSTRAINT TRIGGER 가 커밋 시 수행(이 함수 안에서 읽으면 stale).
  UPDATE public.ops_participants SET status = v_next WHERE id = p_participant_id;

  -- 9) 감사 이벤트 1행 append
  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (v_p.tournament_id,
          (CASE WHEN p_no_show THEN 'player_no_show' ELSE 'player_no_show_undone' END)
            ::public.ops_event_type,
          p_actor_id,
          jsonb_build_object('participant_id', p_participant_id,
                             'status_before', v_p.status,
                             'status_after', v_next));

  RETURN jsonb_build_object('participant_id', p_participant_id,
                            'status', v_next, 'status_before', v_p.status);
END;
$$;

ALTER FUNCTION public.ops_set_participant_no_show(uuid, uuid, boolean) OWNER TO postgres;

COMMENT ON FUNCTION public.ops_set_participant_no_show(uuid, uuid, boolean) IS
  '노쇼 표시/취소 — ops 결함②. checked_in ↔ no_show 왕복만 허용한다. active 는 거부(그 경로는 '
  'ops_bust_participant), registered 는 도달 불가 상태라 게이트에서 제외. 되돌리기는 active 가 '
  '아니라 checked_in 으로 — 좌석 없는 active 는 live_stats 의 playing/average_stack 을 오염시킨다.';

REVOKE ALL ON FUNCTION public.ops_set_participant_no_show(uuid, uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ops_set_participant_no_show(uuid, uuid, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.ops_set_participant_no_show(uuid, uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ops_set_participant_no_show(uuid, uuid, boolean) TO service_role;
