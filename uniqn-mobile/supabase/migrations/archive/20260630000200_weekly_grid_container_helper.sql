-- 주간 배치 그리드 — Phase 1 ③ 운영처 컨테이너 생성 헬퍼 (E2/E3 멱등 + race 방지)
--
-- get_or_create_venue_container: 워크스페이스의 운영처(venue)를 대표하는 숨김 컨테이너 공고를
--   멱등하게 확보한다. 동시 생성(race)에도 컨테이너가 정확히 1개만 존재하도록
--   ON CONFLICT (uniq_venue_container) DO NOTHING → 미반환 시 SELECT 폴백.
--
-- 보안:
--   * SECURITY DEFINER + search_path=public,extensions,pg_temp (S3).
--   * 워크스페이스 멤버/관리자만 호출 가능(본문 재검증). anon REVOKE(S2).
--   * 운영처명 XSS 검증은 TS 경계(z.string().refine(xssValidation))에서 통과분만 전달(S1).
--     본 함수는 공백/길이 등 최소 무결성만 본다.
--
-- 카운터: 컨테이너는 filled_positions 를 쓰지 않는다(read-time COUNT). total_positions=0 고정.
-- softTargets 는 requirements 와 분리해 schedule.softTargets 에 둔다(MAX_CAPACITY 가드 회피, §4.4).
CREATE OR REPLACE FUNCTION public.get_or_create_venue_container(
  p_workspace_id uuid,
  p_name text,
  p_kind text DEFAULT 'dated',
  p_period jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_owner uuid := auth.uid();
  v_container_id uuid;
  v_now timestamptz := now();
  v_norm_name text;
  v_schedule jsonb;
BEGIN
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 인증이 필요합니다';
  END IF;

  -- 권한: 워크스페이스 멤버/관리자만 운영처 생성
  IF NOT (public.is_workspace_member(p_workspace_id, v_owner) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 워크스페이스 권한이 없습니다';
  END IF;

  v_norm_name := btrim(COALESCE(p_name, ''));
  IF length(v_norm_name) = 0 THEN
    RAISE EXCEPTION 'INVALID_INPUT: 운영처명이 필요합니다';
  END IF;
  IF p_kind NOT IN ('dated', 'fixed') THEN
    RAISE EXCEPTION 'INVALID_INPUT: kind 는 dated|fixed 만 허용합니다 (%)', p_kind;
  END IF;

  -- 컨테이너 schedule: requirements 없이 softTargets(빈 맵) 만. period 가 있으면 부가.
  v_schedule := jsonb_build_object('kind', p_kind, 'softTargets', '{}'::jsonb);
  IF p_period IS NOT NULL THEN
    v_schedule := v_schedule || jsonb_build_object('period', p_period);
  END IF;

  -- E3 race 방지: 멱등 키 충돌 시 DO NOTHING → RETURNING 미반환 → SELECT 폴백.
  INSERT INTO job_postings (
    workspace_id, owner_id, title, status, posting_type,
    total_positions, filled_positions, schedule, schema_version,
    created_at, updated_at
  ) VALUES (
    p_workspace_id, v_owner, v_norm_name, 'container'::posting_status, 'regular'::posting_type,
    0, 0, v_schedule, 3,
    v_now, v_now
  )
  ON CONFLICT (workspace_id, lower(title), (schedule ->> 'kind')) WHERE status = 'container'
  DO NOTHING
  RETURNING id INTO v_container_id;

  IF v_container_id IS NULL THEN
    SELECT id INTO v_container_id
    FROM job_postings
    WHERE workspace_id = p_workspace_id
      AND lower(title) = lower(v_norm_name)
      AND (schedule ->> 'kind') = p_kind
      AND status = 'container'
    LIMIT 1;
  END IF;

  -- venue_id = self (컨테이너 자기참조). INSERT 시점엔 id 미정이라 사후 1회 갱신.
  UPDATE job_postings
  SET venue_id = id, updated_at = v_now
  WHERE id = v_container_id
    AND venue_id IS DISTINCT FROM id;

  RETURN jsonb_build_object(
    'containerId', v_container_id,
    'workspaceId', p_workspace_id,
    'name', v_norm_name,
    'kind', p_kind
  );
END;
$function$;

-- 권한: 미인증(anon) 차단(S2), 인증 사용자만(본문에서 워크스페이스 권한 재검증).
REVOKE ALL ON FUNCTION public.get_or_create_venue_container(uuid, text, text, jsonb) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_or_create_venue_container(uuid, text, text, jsonb) TO authenticated;

COMMENT ON FUNCTION public.get_or_create_venue_container(uuid, text, text, jsonb) IS
  '운영처(venue) 컨테이너 공고(status=container) 멱등 확보. ON CONFLICT(uniq_venue_container) race 방지, venue_id=self, softTargets 분리.';
