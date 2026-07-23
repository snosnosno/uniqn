-- ops_blind_presets save/delete SECDEF RPC(B6): 소유자 전용 저장/삭제.
--   ops_save_blind_preset  — 신규 or 동명 갱신(upsert). levels 화이트리스트 재조립(임의 필드 유입 차단).
--   ops_delete_blind_preset — owner_id 스코프 삭제(타인 프리셋 삭제 불가).
-- 스펙: taskB-4-brief.md(Step 3). 패턴: ops_set_blind_levels(actor 바인딩 + 입력 검증), ops 1e M3 하드닝
--   (신규 SECDEF 는 PUBLIC/anon EXECUTE 회수 + authenticated GRANT — 기본 PUBLIC 상속 차단).
-- ⚠️ actor 바인딩 NULL fail-open 차단: auth.uid() IS NULL 이면 즉시 거부(IS DISTINCT FROM 만으로는
--    NULL 비교가 true 라 통과할 수 있어 IS NULL 을 앞세운다).

-- 저장(신규 or 동명 갱신 — upsert). levels 는 화이트리스트 재조립.
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

CREATE OR REPLACE FUNCTION public.ops_delete_blind_preset(
  p_actor_id uuid, p_preset_id uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'actor 불일치' USING ERRCODE = 'P0001';
  END IF;
  DELETE FROM public.ops_blind_presets
   WHERE id = p_preset_id AND owner_id = p_actor_id;
END;
$$;

-- anon 계약 보존 — 신규 함수 PUBLIC/anon EXECUTE 회수 필수(SECDEF 기본 PUBLIC 상속 차단)
REVOKE ALL ON FUNCTION public.ops_save_blind_preset(uuid, text, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ops_delete_blind_preset(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ops_save_blind_preset(uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ops_delete_blind_preset(uuid, uuid) TO authenticated;

COMMENT ON FUNCTION public.ops_save_blind_preset(uuid, text, jsonb) IS
  '블라인드 프리셋 저장(B6). actor 바인딩 + levels 화이트리스트 재조립 + 동명 upsert. anon REVOKE.';
COMMENT ON FUNCTION public.ops_delete_blind_preset(uuid, uuid) IS
  '블라인드 프리셋 삭제(B6). actor 바인딩 + owner_id 스코프(타인 삭제 불가). anon REVOKE.';
