-- ops 참가자 일괄 등록 — 명단 붙여넣기용(2026-10-04).
--
-- 한 명씩 등록하는 ops_register_participant 를 한 트랜잭션 안에서 반복 호출한다.
--   · 등록 규칙(마감 판정·엔트리 번호·자동 착석·이벤트 1건)은 단건 RPC 그대로 — 여기에 복제하지 않는다.
--   · 한 줄이라도 실패하면 전부 되돌린다(원자성). "절반만 들어간 명단"을 만들지 않는다.
--   · 상한 200명 — 대량 배열로 행·이벤트를 부풀리지 못하게.
-- 입력 p_rows: [{"name": "...", "phone": "...", "nationality": "..."}, ...] (phone·nationality 생략 가능)
-- 계약: anon-executable ops SECDEF = 2 유지 — PUBLIC/anon REVOKE.

CREATE OR REPLACE FUNCTION public.ops_register_participants_bulk(
  p_tournament_id uuid,
  p_actor_id uuid,
  p_rows jsonb,
  p_buy_in_amount integer DEFAULT NULL
) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  r jsonb;
  v_idx int := 0;
  v_name text;
  v_one jsonb;
  v_results jsonb := '[]'::jsonb;
BEGIN
  -- actor 바인딩은 단건 RPC 도 다시 하지만, 입력 검증 오류보다 먼저 권한 오류가 나오게 여기서도 본다.
  IF auth.uid() IS NULL OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' OR jsonb_array_length(p_rows) = 0 THEN
    RAISE EXCEPTION 'OPS_BULK_REGISTER_INVALID: 등록할 명단이 비었습니다' USING ERRCODE = 'P0001';
  END IF;
  IF jsonb_array_length(p_rows) > 200 THEN
    RAISE EXCEPTION 'OPS_BULK_REGISTER_INVALID: 한 번에 200명까지 등록할 수 있습니다' USING ERRCODE = 'P0001';
  END IF;

  -- 대회 행을 먼저 잠근다 — 반복 중간에 다른 등록이 끼어들어 엔트리 번호가 섞이지 않게.
  PERFORM 1 FROM public.ops_tournaments WHERE id = p_tournament_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TOURNAMENT_NOT_FOUND: 대회를 찾을 수 없습니다 (%)', p_tournament_id USING ERRCODE = 'P0001';
  END IF;

  FOR r IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
    v_idx := v_idx + 1;
    IF jsonb_typeof(r) <> 'object' THEN
      RAISE EXCEPTION 'OPS_BULK_REGISTER_INVALID: %번째 줄 형식이 올바르지 않습니다', v_idx USING ERRCODE = 'P0001';
    END IF;
    v_name := btrim(COALESCE(r->>'name', ''));
    IF v_name = '' OR char_length(v_name) > 50 THEN
      RAISE EXCEPTION 'OPS_BULK_REGISTER_INVALID: %번째 줄 이름이 비었거나 50자를 넘습니다', v_idx USING ERRCODE = 'P0001';
    END IF;
    IF char_length(COALESCE(r->>'phone', '')) > 30 OR char_length(COALESCE(r->>'nationality', '')) > 40 THEN
      RAISE EXCEPTION 'OPS_BULK_REGISTER_INVALID: %번째 줄 연락처·국적이 너무 깁니다', v_idx USING ERRCODE = 'P0001';
    END IF;

    v_one := public.ops_register_participant(
      p_tournament_id, p_actor_id, v_name,
      NULLIF(btrim(COALESCE(r->>'nationality', '')), ''),
      NULLIF(btrim(COALESCE(r->>'phone', '')), ''),
      p_buy_in_amount);
    v_results := v_results || jsonb_build_array(v_one);
  END LOOP;

  RETURN jsonb_build_object('tournament_id', p_tournament_id, 'count', v_idx, 'participants', v_results);
END;
$$;

ALTER FUNCTION public.ops_register_participants_bulk(uuid, uuid, jsonb, integer) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.ops_register_participants_bulk(uuid, uuid, jsonb, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ops_register_participants_bulk(uuid, uuid, jsonb, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ops_register_participants_bulk(uuid, uuid, jsonb, integer) TO service_role;

COMMENT ON FUNCTION public.ops_register_participants_bulk(uuid, uuid, jsonb, integer) IS
  '참가자 일괄 등록(최대 200명, 전부 성공 또는 전부 취소). 등록 규칙은 ops_register_participant 를 그대로 호출. anon REVOKE.';
