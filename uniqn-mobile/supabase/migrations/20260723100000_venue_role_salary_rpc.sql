-- uniqn-mobile/supabase/migrations/20260723100000_venue_role_salary_rpc.sql
-- 지점(컨테이너) 역할별 단가표 쓰기 RPC (JIT 급여 설계 §A, 2026-07-23)
--
-- 컨테이너 행은 jp_container_no_direct_update(RESTRICTIVE)가 직접 UPDATE 를 차단하므로
-- softTargets(set_venue_soft_target)와 동일하게 SECDEF RPC 단일 경로로만 쓴다.
-- 인가 게이트: COALESCE(owner=caller,false) OR 워크스페이스 멤버 OR 콜라보 OR admin (fail-closed).
-- upsert 단위: 표준 역할=role, 커스텀=other+customRole. p_salary_type NULL = 해당 엔트리 삭제.
-- '협의(other)' 타입 불허 — 단가표 목적이 자동 정산 계산이므로 amount:0 은 폴백과 같은 오답.

CREATE OR REPLACE FUNCTION public.set_venue_role_salary(
  p_venue uuid,
  p_role text,
  p_custom_role text DEFAULT NULL,
  p_salary_type text DEFAULT NULL,
  p_amount integer DEFAULT NULL
) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_ws uuid;
  v_owner_id uuid;
  v_schedule jsonb;
  v_existing jsonb;
  v_entries jsonb;
  v_entry jsonb;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 인증이 필요합니다';
  END IF;

  IF p_role IS NULL OR length(trim(p_role)) = 0 THEN
    RAISE EXCEPTION 'INVALID_INPUT: 역할이 필요합니다';
  END IF;
  -- 원문 길이 기준(trim 아님) — 공백 패딩으로 저장 원문이 상한을 우회하지 못하게 한다.
  IF length(p_role) > 50 THEN
    RAISE EXCEPTION 'INVALID_INPUT: 역할은 50자 이하여야 합니다';
  END IF;
  IF p_role = 'other' AND (p_custom_role IS NULL OR length(trim(p_custom_role)) = 0) THEN
    RAISE EXCEPTION 'INVALID_INPUT: 커스텀 역할명이 필요합니다';
  END IF;
  IF p_custom_role IS NOT NULL AND length(p_custom_role) > 50 THEN
    RAISE EXCEPTION 'INVALID_INPUT: 역할명은 50자 이하여야 합니다';
  END IF;

  IF p_salary_type IS NOT NULL THEN
    IF p_salary_type NOT IN ('hourly', 'daily', 'monthly') THEN
      RAISE EXCEPTION 'INVALID_INPUT: 급여 유형이 올바르지 않습니다 (%)', p_salary_type;
    END IF;
    IF p_amount IS NULL OR p_amount < 0 OR p_amount > 100000000 THEN
      RAISE EXCEPTION 'INVALID_INPUT: 금액은 0~100,000,000 사이여야 합니다';
    END IF;
  END IF;

  SELECT workspace_id, owner_id, schedule
    INTO v_ws, v_owner_id, v_schedule
  FROM public.job_postings
  WHERE id = p_venue AND status = 'container'::posting_status
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'VENUE_NOT_FOUND: %', p_venue;
  END IF;

  IF NOT (
    COALESCE(v_owner_id = v_caller, false)
    OR public.is_workspace_member(v_ws, v_caller)
    OR public.is_posting_collaborator(p_venue, v_caller)
    OR public.is_admin()
  ) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 운영처 관리 권한이 없습니다';
  END IF;

  -- 이형 방어: 기존 roleSalaries 가 배열이 아니면(손상/구버전 형태) '[]' 로 취급 —
  -- jsonb_array_elements raw 에러를 막고 이번 쓰기로 정상 배열로 자가 치유한다.
  IF jsonb_typeof(v_schedule -> 'roleSalaries') IS DISTINCT FROM 'array' THEN
    v_existing := '[]'::jsonb;
  ELSE
    v_existing := v_schedule -> 'roleSalaries';
  END IF;

  -- 같은 역할(커스텀은 customRole 단위) 기존 엔트리 제거 후, 삭제 요청이 아니면 새 엔트리 추가.
  SELECT COALESCE(jsonb_agg(e), '[]'::jsonb) INTO v_entries
  FROM jsonb_array_elements(v_existing) AS e
  WHERE NOT (
    e ->> 'role' = p_role
    AND (p_role <> 'other' OR COALESCE(e ->> 'customRole', '') = COALESCE(p_custom_role, ''))
  );

  IF p_salary_type IS NOT NULL THEN
    v_entry := jsonb_build_object(
      'role', p_role,
      'salary', jsonb_build_object('type', p_salary_type, 'amount', p_amount)
    );
    IF p_role = 'other' THEN
      v_entry := v_entry || jsonb_build_object('customRole', p_custom_role);
    END IF;
    v_entries := v_entries || jsonb_build_array(v_entry);
  END IF;

  -- 재조립 후 엔트리 수 상한(무한 증식·페이로드 팽창 방어). 정상 운영 역할 수를 크게 상회하는 값.
  IF jsonb_array_length(v_entries) > 50 THEN
    RAISE EXCEPTION 'INVALID_INPUT: 역할 단가 항목은 50개를 초과할 수 없습니다';
  END IF;

  UPDATE public.job_postings
  SET schedule = jsonb_set(COALESCE(v_schedule, '{}'::jsonb), '{roleSalaries}', v_entries, true),
      updated_at = now()
  WHERE id = p_venue;

  RETURN jsonb_build_object('venueId', p_venue, 'roleSalaries', v_entries);
END;
$$;

-- SECDEF 하드닝: anon/public 실행 차단, authenticated 만 허용.
REVOKE EXECUTE ON FUNCTION public.set_venue_role_salary(uuid, text, text, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_venue_role_salary(uuid, text, text, text, integer) TO authenticated;
