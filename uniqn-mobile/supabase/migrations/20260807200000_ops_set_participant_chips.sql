-- ops 결함① — 참가자 칩 카운트 수동 입력.
-- 배경: chips 를 바꾸는 경로가 리바이/애드온의 고정 증분과 bust 뿐이라, 칩드래프트 재배치 정렬
--       (chipDraft.ts:33 chips 내림차순)과 전광판 total_chips 가 전부 명목값이었다.
-- 이벤트 타입 player_chips_set 은 20260807190000 에서 선행 추가(같은 트랜잭션 사용 금지 함정).
-- 계약: anon-executable ops SECDEF =2 유지 — PUBLIC/anon REVOKE 필수.
--
-- 설계 결정(2026-08-07 승인):
--  · 참가자 게이트 = active + checked_in — checked_in(대기)도 등록 시 starting_chips 를 받고
--    RedrawModal.tsx:112-114 재배치 풀에 포함되므로, 배제하면 결함①이 반만 닫힌다.
--    busted 는 계속 거부(bust/undo_bust 가 chips 를 원자로 다루는 경로 보호).
--  · 대회 status 게이트 없음 — 같은 chips 컬럼을 쓰는 ops_add_rebuy 파리티. 대회 스코프 읽기가
--    없으므로 advisory lock / 대회행 FOR UPDATE 도 불필요(참가자 단일행 변이).
--  · 낙관적 잠금 미채택 — 마지막 쓰기 승리. 교차 변경 추적은 ops_events 의 chips_before/after.
--  · 0 거부 — 0칩 active 참가자는 live_stats 의 playing/average_stack 을 오염시킨다.
--    탈락은 순위·좌석해제·상금을 원자로 처리하는 ops_bust_participant 전용 경로.

CREATE OR REPLACE FUNCTION public.ops_set_participant_chips(
  p_participant_id uuid,
  p_actor_id uuid,
  p_chips integer
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = 'public', 'extensions', 'pg_temp'
AS $$
DECLARE
  v_p record;
BEGIN
  -- 1) actor 바인딩(위조 차단) — NULL 가드 포함
  IF auth.uid() IS NULL
     OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;

  -- 2) 순수 인자 검증 — 행 잠금 전에 판정(잠금 보유 시간 최소화)
  --    상한 = int4 안전 라운드 캡. 발행총칩 기반 캡은 쓰지 않는다(starting_chips 기본값 0 이면
  --    무력하고, 보너스칩 대회에서 정당한 정정을 거부한다).
  IF p_chips IS NULL OR p_chips < 1 OR p_chips > 2000000000 THEN
    RAISE EXCEPTION 'CHIPS_INVALID: 칩은 1 이상 20억 이하여야 합니다 (0칩은 탈락 처리를 사용하세요, 입력=%)',
      p_chips USING ERRCODE = 'P0001';
  END IF;

  -- 3) 참가자 행 FOR UPDATE — ops_add_rebuy 와 동일한 단일행 변이
  SELECT id, tournament_id, status, chips
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

  -- 5) 참가자 상태 게이트 — active(착석) + checked_in(대기)
  IF v_p.status NOT IN ('active', 'checked_in') THEN
    RAISE EXCEPTION 'PARTICIPANT_NOT_ACTIVE: 참가 중인 참가자만 칩 수정 가능 (status=%)', v_p.status
      USING ERRCODE = 'P0001';
  END IF;

  -- 6) 동일값 = 멱등 no-op(이벤트 0행). 프리필 UI 특성상 무변경 저장이 흔해 감사 로그가 오염된다.
  IF p_chips = v_p.chips THEN
    RETURN jsonb_build_object('participant_id', p_participant_id,
                              'chips', v_p.chips, 'chips_before', v_p.chips);
  END IF;

  -- 7) 갱신 — updated_at 은 trg_ops_participants_set_updated_at(BEFORE UPDATE)이 자동 처리.
  --    live_stats 재계산은 trg_ops_participants_recompute_stats(DEFERRED CONSTRAINT TRIGGER,
  --    UPDATE OF 컬럼 필터 없음)가 커밋 시 수행 — 이 함수 안에서 live_stats 를 읽으면 stale.
  UPDATE public.ops_participants SET chips = p_chips WHERE id = p_participant_id;

  -- 8) 감사 이벤트 1행 append — player_rebuy payload 관용구와 동일 형태
  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (v_p.tournament_id, 'player_chips_set'::public.ops_event_type, p_actor_id,
          jsonb_build_object('participant_id', p_participant_id,
                             'chips_before', v_p.chips,
                             'chips_after', p_chips));

  RETURN jsonb_build_object('participant_id', p_participant_id,
                            'chips', p_chips, 'chips_before', v_p.chips);
END;
$$;

ALTER FUNCTION public.ops_set_participant_chips(uuid, uuid, integer) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.ops_set_participant_chips(uuid, uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ops_set_participant_chips(uuid, uuid, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.ops_set_participant_chips(uuid, uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ops_set_participant_chips(uuid, uuid, integer) TO service_role;
