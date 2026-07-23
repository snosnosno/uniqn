-- ops 블라인드 levels 서버 상한(=100) — PR#313 후속.
--   클라 zod .max(100)만 있고 서버(ops_set_blind_levels·ops_save_blind_preset)는 무상한이던 갭 봉합.
--   두 함수 모두 CREATE OR REPLACE 전체 교체(기존 ACL 보존·COMMENT 는 상한 문구로 갱신, 함수 카운트 불변 → parity 가드 무변).
--   사전존재 100+ 레벨 재저장 거부 엣지(fable LOW): prod 실측 최대 레벨 수 확인 후 하드 캡 채택 —
--   초과 데이터가 없으므로 재저장 거부 케이스는 실존하지 않는다(적용 전 실측이 게이트).

-- ── ops_set_blind_levels: 본문은 baseline(20260710000002)과 동일 + 상한 검사 1블록 추가 ──
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

  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (p_tournament_id, 'level_set', p_actor_id,
          jsonb_build_object('action', 'blind_levels_set', 'count', v_count, 'reanchored', v_reanchored));

  RETURN jsonb_build_object('tournament_id', p_tournament_id, 'count', v_count, 'reanchored', v_reanchored);
END;
$$;

-- ── ops_save_blind_preset: 본문은 20260724000100 과 동일 + 상한 검사 1블록 추가 ──
CREATE OR REPLACE FUNCTION public.ops_save_blind_preset(
  p_actor_id uuid, p_name text, p_levels jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_id uuid;
  v_levels jsonb;
BEGIN
  -- actor 바인딩(위조 차단)
  IF auth.uid() IS NULL OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'actor 불일치' USING ERRCODE = 'P0001';
  END IF;
  IF p_name IS NULL OR char_length(p_name) = 0 THEN
    RAISE EXCEPTION '이름 필요' USING ERRCODE = 'P0001';
  END IF;
  -- 입력 형태 검증 — 비배열/결손/음수/0분 차단
  IF p_levels IS NULL OR jsonb_typeof(p_levels) <> 'array' THEN
    RAISE EXCEPTION 'levels 배열 필요' USING ERRCODE = 'P0001';
  END IF;
  -- 서버 상한(클라 zod .max(100)과 동일 계약)
  IF jsonb_array_length(p_levels) > 100 THEN
    RAISE EXCEPTION '레벨 개수 초과(최대 100)' USING ERRCODE = 'P0001';
  END IF;
  -- 신뢰경계 방어(golden #6, sibling ops_set_prize_structure 문형): 캐스트(::int/::bigint/::boolean)
  -- 전에 숫자 필드(level·smallBlind·bigBlind·ante·durationSec)는 정규식 선검증, isBreak 는 boolean
  -- 텍스트 선검증. 비-숫자/소수/음수/불리언/누락 키가 아래 캐스트에서 raw 22P02(친절 P0001 경로
  -- 우회)로 누출되던 갭 차단. coalesce(...,'') 로 누락 키(NULL)도 정규식 불일치로 함께 거부.
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_levels) e
    WHERE coalesce(e->>'level', '')       !~ '^[0-9]+$'
       OR coalesce(e->>'smallBlind', '')  !~ '^[0-9]+$'
       OR coalesce(e->>'bigBlind', '')    !~ '^[0-9]+$'
       OR coalesce(e->>'ante', '')        !~ '^[0-9]+$'
       OR coalesce(e->>'durationSec', '') !~ '^[0-9]+$'
       OR coalesce(e->>'isBreak', '') NOT IN ('true', 'false')
  ) THEN
    RAISE EXCEPTION '레벨 값 불량' USING ERRCODE = 'P0001';
  END IF;
  -- 선검증으로 숫자 필드는 음이 아닌 정수 텍스트 보장(캐스트 안전). durationSec 는 0 초과여야 함.
  PERFORM 1
  FROM jsonb_array_elements(p_levels) e
  WHERE (e->>'durationSec')::int <= 0;
  IF FOUND THEN
    RAISE EXCEPTION '레벨 값 불량' USING ERRCODE = 'P0001';
  END IF;

  -- 화이트리스트 재조립(임의 필드 유입 차단)
  SELECT jsonb_agg(jsonb_build_object(
    'level', (e->>'level')::int,
    'smallBlind', (e->>'smallBlind')::bigint,
    'bigBlind', (e->>'bigBlind')::bigint,
    'ante', (e->>'ante')::bigint,
    'durationSec', (e->>'durationSec')::int,
    'isBreak', (e->>'isBreak')::boolean
  )) INTO v_levels
  FROM jsonb_array_elements(p_levels) e;

  INSERT INTO public.ops_blind_presets (owner_id, name, levels)
  VALUES (p_actor_id, p_name, COALESCE(v_levels, '[]'::jsonb))
  ON CONFLICT (owner_id, name)                    -- spec §3.2 "동명 갱신"(upsert)
  DO UPDATE SET levels = EXCLUDED.levels, updated_at = now()
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.ops_set_blind_levels(uuid, uuid, jsonb) IS
  '블라인드 구조 전체교체(1c). 멤버 게이트 + 입력 검증 + 개수 상한 100 + 클럭 clamp 재앵커.';
COMMENT ON FUNCTION public.ops_save_blind_preset(uuid, text, jsonb) IS
  '블라인드 프리셋 저장(B6). actor 바인딩 + levels 화이트리스트 재조립 + 개수 상한 100 + 동명 upsert. anon REVOKE.';
