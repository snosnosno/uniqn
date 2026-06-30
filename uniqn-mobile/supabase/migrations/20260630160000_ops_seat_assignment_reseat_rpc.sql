-- 배정 2종 확정 RPC: 전원 재배치(랜덤 / 칩 드래프트 공통 적용기)
-- 잠금 순서: advisory(대회) → 대회 FOR UPDATE → 좌석 FOR UPDATE(id asc) → 참가자 FOR UPDATE(id asc)
-- 좌석을 참가자보다 먼저 잠가 1b assign/move/redraw 좌석-우선 규약과 통일 → ABBA 데드락 회피.
-- 패턴: 20260625130100_ops_1b_seat_rpcs.sql (락순서·가드 관용구)
--       20260630120100_ops_1d_bust_reenter_prize_rpcs.sql (advisory 락·참가자 FOR UPDATE)
-- 에러코드 신규: SEAT_ASSIGNMENT_INVALID=E6129 / INVALID_REDRAW_MODE=E6131 (E6130=클라 전담)
CREATE OR REPLACE FUNCTION public.ops_reseat_participants(
  p_tournament_id uuid,
  p_actor_id      uuid,
  p_assignments   jsonb,   -- [{"participant_id":uuid,"seat_id":uuid}, ...] 전 풀 플레이어 목표좌석
  p_mode          text     -- 'random_draw' | 'chip_draft'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions', 'pg_temp'
AS $$
DECLARE
  v_pids     uuid[];
  v_seat_ids uuid[];
  v_n        int;
  v_t_status text;
  v_moved    int := 0;
  v_seated   int := 0;
  r          record;
BEGIN
  -- 1. actor 가드
  IF auth.uid() IS NULL OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 권한이 없어요.' USING ERRCODE = 'P0001';
  END IF;

  -- 2. mode 검증
  IF p_mode IS NULL OR p_mode NOT IN ('random_draw', 'chip_draft') THEN
    RAISE EXCEPTION 'INVALID_REDRAW_MODE: 지원하지 않는 배정 방식이에요.' USING ERRCODE = 'P0001';
  END IF;

  -- 3. assignments 파싱·구조 검증
  IF p_assignments IS NULL OR jsonb_typeof(p_assignments) <> 'array' OR jsonb_array_length(p_assignments) = 0 THEN
    RAISE EXCEPTION 'SEAT_ASSIGNMENT_INVALID: 좌석 배정 정보가 올바르지 않아요.' USING ERRCODE = 'P0001';
  END IF;
  SELECT array_agg((e->>'participant_id')::uuid), array_agg((e->>'seat_id')::uuid)
    INTO v_pids, v_seat_ids
    FROM jsonb_array_elements(p_assignments) e;
  IF array_position(v_pids, NULL) IS NOT NULL OR array_position(v_seat_ids, NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'SEAT_ASSIGNMENT_INVALID: 좌석 배정 정보가 올바르지 않아요.' USING ERRCODE = 'P0001';
  END IF;
  v_n := array_length(v_pids, 1);
  -- 참가자·좌석 중복 금지
  IF (SELECT count(DISTINCT x) FROM unnest(v_pids) x) <> v_n
     OR (SELECT count(DISTINCT x) FROM unnest(v_seat_ids) x) <> v_n THEN
    RAISE EXCEPTION 'SEAT_ASSIGNMENT_INVALID: 좌석 배정 정보가 올바르지 않아요.' USING ERRCODE = 'P0001';
  END IF;

  -- 4. advisory → 대회 FOR UPDATE → 멤버십
  PERFORM pg_advisory_xact_lock(hashtext('ops_tournament_' || p_tournament_id::text)::bigint);
  SELECT status INTO v_t_status FROM public.ops_tournaments WHERE id = p_tournament_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TOURNAMENT_NOT_FOUND: 대회를 찾을 수 없어요.' USING ERRCODE = 'P0001';
  END IF;
  IF v_t_status = 'completed' THEN
    RAISE EXCEPTION 'INVALID_STATUS: 종료된 대회는 재배치할 수 없어요.' USING ERRCODE = 'P0001';
  END IF;
  IF NOT (public.is_ops_member(p_tournament_id, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 권한이 없어요.' USING ERRCODE = 'P0001';
  END IF;

  -- 5. 좌석 잠금(id asc) — 참가자보다 먼저 잠가 비-advisory 좌석 RPC(assign/move/redraw)의
  --    좌석-우선 규약과 통일(ABBA 데드락 회피). 목표 좌석 ∪ 풀 플레이어 현재 점유 좌석.
  PERFORM 1 FROM public.ops_seats
    WHERE tournament_id = p_tournament_id AND (id = ANY(v_seat_ids) OR participant_id = ANY(v_pids))
    ORDER BY id FOR UPDATE;

  -- 6. 참가자 잠금·가드(id asc) — 좌석 잠금 이후
  PERFORM 1 FROM public.ops_participants
    WHERE tournament_id = p_tournament_id AND id = ANY(v_pids)
    ORDER BY id FOR UPDATE;
  IF (SELECT count(*) FROM public.ops_participants
      WHERE tournament_id = p_tournament_id AND id = ANY(v_pids)) <> v_n THEN
    RAISE EXCEPTION 'PARTICIPANT_NOT_FOUND: 참가자를 찾을 수 없어요.' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.ops_participants
    WHERE tournament_id = p_tournament_id AND id = ANY(v_pids)
      AND status NOT IN ('active', 'checked_in')
  ) THEN
    RAISE EXCEPTION 'PARTICIPANT_NOT_ACTIVE: 활성/대기 상태 참가자만 배정할 수 있어요.' USING ERRCODE = 'P0001';
  END IF;

  -- 7. 목표 좌석 가드: 존재·동일대회·적격 테이블·외부인 미점유
  FOR r IN SELECT unnest(v_seat_ids) AS seat_id LOOP
    PERFORM 1 FROM public.ops_seats s JOIN public.ops_tables t ON t.id = s.table_id
      WHERE s.id = r.seat_id AND s.tournament_id = p_tournament_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'SEAT_ASSIGNMENT_INVALID: 좌석 배정 정보가 올바르지 않아요.' USING ERRCODE = 'P0001';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.ops_seats s JOIN public.ops_tables t ON t.id = s.table_id
      WHERE s.id = r.seat_id AND t.status = 'open' AND t.lock_type = 'none'
    ) THEN
      RAISE EXCEPTION 'TABLE_NOT_OPEN: 닫혔거나 잠긴 테이블에는 배정할 수 없어요.' USING ERRCODE = 'P0001';
    END IF;
    -- 외부인(풀에 없는 참가자) 동시 착석 → TOCTOU 충돌
    IF EXISTS (
      SELECT 1 FROM public.ops_seats s
      WHERE s.id = r.seat_id AND s.participant_id IS NOT NULL AND NOT (s.participant_id = ANY(v_pids))
    ) THEN
      RAISE EXCEPTION 'SEAT_VERSION_CONFLICT: 좌석 상태가 바뀌었어요. 다시 계산해 주세요.' USING ERRCODE = 'P0001';
    END IF;
  END LOOP;

  -- 8. 소스 보호 가드: 풀 참가자가 비적격 테이블(마감/대기/잠금/피처)에 앉아 있으면 거부
  --    피처/잠금 테이블 점유자는 재배치에서 보호(클라가 풀에서 선제외, 서버 백스톱).
  IF EXISTS (
    SELECT 1 FROM public.ops_seats s JOIN public.ops_tables t ON t.id = s.table_id
    WHERE s.tournament_id = p_tournament_id AND s.participant_id = ANY(v_pids)
      AND NOT (t.status = 'open' AND t.lock_type = 'none')
  ) THEN
    RAISE EXCEPTION 'SEAT_ASSIGNMENT_INVALID: 보호된(마감/대기/잠금/피처) 테이블 참가자는 재배치 대상이 아니에요.' USING ERRCODE = 'P0001';
  END IF;

  -- 9. 전원 비우기(풀 플레이어 현재 좌석 vacate → partial UNIQUE 충돌 회피)
  --    derangement(p1@s1→s2, p2@s2→s1) 시 중간 상태 없이 한 번에 비움.
  UPDATE public.ops_seats SET participant_id = NULL
    WHERE tournament_id = p_tournament_id AND participant_id = ANY(v_pids);

  -- 10. 목표 앉히기(9 이후라 풀 플레이어 좌석 미보유 → 단일점유 충돌 불가)
  FOR r IN
    SELECT (e->>'participant_id')::uuid AS pid, (e->>'seat_id')::uuid AS sid
      FROM jsonb_array_elements(p_assignments) e
  LOOP
    UPDATE public.ops_seats SET participant_id = r.pid WHERE id = r.sid;
  END LOOP;
  v_moved := v_n; -- 전원 비우고 다시 앉혔으므로 배정 수 = v_n

  -- 11. checked_in → active 승급
  WITH upd AS (
    UPDATE public.ops_participants SET status = 'active'
      WHERE tournament_id = p_tournament_id AND id = ANY(v_pids) AND status = 'checked_in'
      RETURNING 1
  )
  SELECT count(*) INTO v_seated FROM upd;

  -- 12. 이벤트 (⚠️컬럼명은 type — ops_events에 event_type 컬럼 없음. 기존 1a~1d 전부 type 사용)
  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (p_tournament_id, 'table_redraw', p_actor_id,
          jsonb_build_object('mode', p_mode, 'moved', v_moved, 'seated', v_seated));

  -- 13. 반환
  RETURN jsonb_build_object('moved', v_moved, 'seated', v_seated, 'mode', p_mode);
END;
$$;
