-- ops 블라인드 구조 저장 — 레이트 등록 자동 마감 기준이 "순번"이 아니라 "그 레벨"을 따라가게 한다.
--
-- 무엇이 문제였나 (2026-10-04 리뷰 LOW)
--   자동 마감 기준은 ops_tournaments.registration_close_after_sort — 블라인드 구조의 **순번(sort)** 이다.
--   그런데 ops_set_blind_levels 는 구조를 통째로 지우고 1..N 으로 다시 매긴다. 기준보다 앞의 레벨을 하나
--   지우면(또는 끼우면) 순번은 그대로인데 그 순번이 가리키는 레벨이 조용히 바뀐다.
--     예) [L1, L2, 휴식, L3] 에서 "휴식(sort 3) 종료 시 마감" 으로 둔 뒤 L1 을 지우면
--         [L2, 휴식, L3] 이 되고 sort 3 은 L3 — 마지막 순번이라 설정이 지워진다(운영자는 모른다).
--         L2 를 지웠다면 sort 3 이 L3 을 가리켜 **한 레벨 늦게** 마감된다.
--
-- 어떻게 고치나
--   서버는 레벨의 정체를 모른다(지우고 다시 넣는다 — 안정 id 없음). 그래서 클라이언트가 각 행에
--   "저장 전 순번" `prev_sort` 를 실어 보낸다(새로 만든 행은 null). 서버는 옛 기준 순번을 prev_sort 로
--   가진 행의 **새 순번**으로 기준을 옮긴다. 그 행이 없으면(지워졌거나 프리셋으로 통째 교체) 설정을 지운다.
--
-- 하위 호환
--   `prev_sort` 키가 **한 행에도 없으면** 종전 동작 그대로다(구 앱·테스트 픽스처). 키가 하나라도 있으면
--   "따라가기 모드" — 그 요청의 모든 행을 정체가 알려진 것으로 본다(키 없는 행 = 새 행).
--   마지막 순번이 된 기준은 종전대로 지운다(넘어갈 레벨이 없어 영영 발동하지 않는다).
--
-- 범위 밖: 현재 레벨(ops_clock.current_level_sort)은 종전대로 순번 clamp 만 한다 — 진행 중 저장은
--   화면이 "타이머가 재계산됩니다" 로 확인을 받는 기존 계약이다.
--
-- 계약: 기존 함수 CREATE OR REPLACE(시그니처 동일) — 신규 함수·트리거·정책 없음 → 파리티 257/106 불변.
--       ACL 은 CREATE OR REPLACE 로 보존(anon REVOKE · authenticated GRANT).
--       반환에 `cutoff_sort`(저장 뒤 기준 순번, 없으면 null)를 더한다 — 기존 키(count·reanchored)는 그대로.
-- 회귀 고정: supabase/tests/ops_registration_cutoff.test.sql (28~33)

CREATE OR REPLACE FUNCTION public.ops_set_blind_levels(p_tournament_id uuid, p_actor_id uuid, p_levels jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  a jsonb;
  v_sort int := 0;
  v_count int;
  v_cur_sort int;
  v_new_sort int;
  v_reanchored boolean := false;
  v_cutoff int;
  v_new_cutoff int;
  v_tracks boolean;
BEGIN
  IF auth.uid() IS NULL OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;
  SELECT registration_close_after_sort INTO v_cutoff
    FROM public.ops_tournaments WHERE id = p_tournament_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TOURNAMENT_NOT_FOUND: 대회를 찾을 수 없습니다 (%)', p_tournament_id USING ERRCODE = 'P0001';
  END IF;
  IF NOT (public.is_ops_member(p_tournament_id, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 관리 권한 없음' USING ERRCODE = 'P0001';
  END IF;
  IF jsonb_typeof(p_levels) <> 'array' OR jsonb_array_length(p_levels) = 0 THEN
    RAISE EXCEPTION 'OPS_BLIND_LEVELS_INVALID: 블라인드 레벨이 비었습니다' USING ERRCODE = 'P0001';
  END IF;
  -- 서버 상한(클라 zod .max(100)과 동일 계약) — 무상한이면 대량 배열로 행 팽창/이벤트 스팸 가능
  IF jsonb_array_length(p_levels) > 100 THEN
    RAISE EXCEPTION 'OPS_BLIND_LEVELS_INVALID: 블라인드 레벨은 최대 100개입니다' USING ERRCODE = 'P0001';
  END IF;
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

  -- 따라가기 모드 판정 — prev_sort 키가 한 행에라도 있으면 이 요청은 행의 정체를 알려 주는 클라이언트다.
  v_tracks := EXISTS (SELECT 1 FROM jsonb_array_elements(p_levels) e WHERE e ? 'prev_sort');

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
    -- 옛 기준 순번을 달고 온 행 = 기준이던 그 레벨. 같은 prev_sort 가 둘이면(잘못된 요청) 앞의 것을 따른다.
    IF v_tracks AND v_cutoff IS NOT NULL AND v_new_cutoff IS NULL
       AND jsonb_typeof(a->'prev_sort') = 'number' AND (a->'prev_sort')::numeric = v_cutoff THEN
      v_new_cutoff := v_sort;
    END IF;
  END LOOP;
  v_count := v_sort;

  -- §0.5 B2: 교체 후 current_level_sort clamp [1, N]. 변하면 안전 재앵커.
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

  -- 자동 마감 기준 정리.
  --   따라가기 모드: 기준이던 레벨의 새 순번으로 옮긴다. 그 레벨이 없어졌으면 지운다.
  --   종전 모드    : 순번을 그대로 둔다.
  --   공통         : 기준이 마지막 순번이 됐거나 구조 밖이면 지운다(넘어갈 곳이 없어 영영 발동하지 않는다).
  IF v_cutoff IS NOT NULL THEN
    IF NOT v_tracks THEN
      v_new_cutoff := v_cutoff;
    END IF;
    IF v_new_cutoff IS NOT NULL AND v_new_cutoff >= v_count THEN
      v_new_cutoff := NULL;
    END IF;
    IF v_new_cutoff IS DISTINCT FROM v_cutoff THEN
      UPDATE public.ops_tournaments SET registration_close_after_sort = v_new_cutoff
       WHERE id = p_tournament_id;
    END IF;
  END IF;

  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (p_tournament_id, 'level_set', p_actor_id,
          jsonb_build_object('action', 'blind_levels_set', 'count', v_count, 'reanchored', v_reanchored));

  RETURN jsonb_build_object('tournament_id', p_tournament_id, 'count', v_count, 'reanchored', v_reanchored,
                            'cutoff_sort', v_new_cutoff);
END;
$$;

COMMENT ON FUNCTION public.ops_set_blind_levels(uuid, uuid, jsonb) IS
  '블라인드 구조 전체 교체. 행에 prev_sort(저장 전 순번, 새 행은 null)를 실으면 레이트 등록 자동 마감 기준이 그 레벨을 따라 새 순번으로 옮겨진다(없어졌으면 해제). 키가 없으면 순번 유지(구 클라이언트). 멤버 게이트.';
