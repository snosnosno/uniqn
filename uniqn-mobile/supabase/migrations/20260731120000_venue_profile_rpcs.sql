-- uniqn-mobile/supabase/migrations/20260731120000_venue_profile_rpcs.sql
-- 지점 프로필 RPC 2종 신설 (S1 / 묶음 1-B, 2026-07-31)
--
-- 배경: 지점 컨테이너(job_postings status='container')는 생성 RPC 가 location/contact_phone/
--   description 을 INSERT 목록에 넣지 않아 각각 '{}'::jsonb / NULL / NULL 로 방치돼 있었다
--   (baseline:2971-2978). 그래서 근무표 직접배치 스태프의 "내 스케줄" 상세는 지점명 대신
--   '이벤트', 장소 대신 '-' 를 봤다. 신규 테이블·컬럼은 필요 없다 — 기존 컬럼을 채우고
--   전달 경로만 뚫는다.
--
-- 신설 2종:
--   1) update_venue_container — 구인자가 지점 이름·장소명·연락처·소개를 수정한다(쓰기).
--   2) get_my_venue_contexts  — 스태프가 본인이 배치된 지점의 표시 정보를 읽는다(읽기).
--
-- 🔴 get_my_venue_role_salaries 를 확장하지 않은 이유:
--   그 함수는 CROSS JOIN LATERAL jsonb_array_elements(roleSalaries) 라 단가표가 빈 배열이면
--   행이 0개다(20260728185802:43-49). 단가 미설정 신규 지점은 title/location 도 못 받게 된다.
--   LEFT JOIN LATERAL 로 바꾸면 salary NULL 행이 생겨 기존 파서가 깨진다
--   (JobPostingRepositoryVenue.getMyVenueRoleSalaries). 그래서 별도 RPC 가 정답이다.
--
-- 파리티: 함수 2개 신설 → 183 → 185 예상. 정책 111 불변(RLS 정책 변경 없음).

-- ============================================================================
-- 1) update_venue_container — 지점 프로필 수정 (쓰기)
-- ============================================================================
--
-- 부분 갱신 의미론:
--   NULL           = 해당 필드 미변경
--   빈 문자열('')  = 해당 필드 제거(NULL 저장)
--   p_location='{}' = 장소 정보 전체 제거
--   ⚠️ p_name 만 예외 — 빈 문자열이면 INVALID_INPUT(지점명은 제거 불가, NOT NULL 컬럼)
--   ⚠️ location 은 NOT NULL DEFAULT '{}'::jsonb 컬럼이다(prod 실측). "제거"는 NULL 이 아니라
--      '{}' 저장이어야 한다 — NULL 을 쓰면 23502 가 아래 23505 핸들러 밖에서 터져
--      raw Postgres 에러가 클라이언트로 샌다.
--
-- 권한: 쓰기 RPC 정본 4단 게이트(set_venue_role_salary / set_venue_soft_target 와 동형).
--   COALESCE(owner=caller,false) 는 필수 — bare `owner_id = caller` 는 계정삭제로
--   owner_id 가 NULL 이 되면 `IF NOT (NULL OR false ...)` 가 미발화해 비인가가 통과한다
--   ([HIGH-1] 20260717093000:6-12).
--
-- XSS: title·description·contact_phone 은 job_postings_xss_check 트리거가 UPDATE 시에도
--   검사한다(prod 실측: check_xss_fields('title','description','contact_phone')).
--   ⚠️ location 은 그 트리거의 대상이 아니다 → 이 함수가 동일 정규식으로 직접 검사한다.
--
-- 트리거 안전성(2026-07-31 실측): 컨테이너 UPDATE 로 발화 가능한 것은
--   job_posting_notify_update(수신자=활성 지원자) 뿐인데, 컨테이너를 가리키는 applications 는
--   prod 실측 0건이고 apply RPC 가 status<>'active' 를 거부하므로 수신자가 생기지 않는다.
--   fn_recalc_total_and_capacity 는 컨테이너를 명시 분기해 total_positions=0 으로 즉시 반환한다.

CREATE OR REPLACE FUNCTION public.update_venue_container(
  p_container_id  uuid,
  p_name          text  DEFAULT NULL,
  p_location      jsonb DEFAULT NULL,
  p_contact_phone text  DEFAULT NULL,
  p_description   text  DEFAULT NULL,
  p_defaults      jsonb DEFAULT NULL
) RETURNS jsonb
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  -- check_xss_fields(baseline:1271) 와 동일 정규식. 그 함수는 location 을 검사하지 않으므로
  -- 여기서 같은 패턴을 재사용한다 — 원본이 바뀌면 이쪽도 함께 갱신할 것.
  c_xss_pattern  constant text   := '<\s*script|javascript\s*:|on\w+\s*=|<\s*iframe|<\s*object|<\s*embed';
  -- postingLocationSchema(jobPosting.schema.ts:127-135) 의 키 집합과 동일. strict.
  c_loc_keys     constant text[] := ARRAY['name', 'district', 'region', 'detailedAddress'];
  -- 🔴 시간 축은 의도적으로 제외(사용자 결정 4 · 핸드오프 §J). 서버가 강제한다.
  c_default_keys constant text[] := ARRAY['roles'];

  v_caller        uuid := (SELECT auth.uid());
  v_ws            uuid;
  v_owner_id      uuid;
  v_schedule      jsonb;
  v_now           timestamptz := now();
  v_name          text;
  v_location      jsonb;
  v_contact_phone text;
  v_description   text;
  v_profile       jsonb;
  v_key           text;
  v_val           jsonb;
  v_text          text;
  v_id            uuid;
  v_out_title     text;
  v_out_location  jsonb;
  v_out_phone     text;
  v_out_desc      text;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 인증이 필요합니다';
  END IF;

  SELECT jp.workspace_id, jp.owner_id, jp.schedule
    INTO v_ws, v_owner_id, v_schedule
  FROM public.job_postings jp
  WHERE jp.id = p_container_id
    AND jp.status = 'container'::public.posting_status
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'VENUE_NOT_FOUND: %', p_container_id;
  END IF;

  IF NOT (
    COALESCE(v_owner_id = v_caller, false)
    OR public.is_workspace_member(v_ws, v_caller)
    OR public.is_posting_collaborator(p_container_id, v_caller)
    OR public.is_admin()
  ) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 운영처 관리 권한이 없습니다';
  END IF;

  -- ── 지점명 ────────────────────────────────────────────────────────────────
  IF p_name IS NOT NULL THEN
    v_name := btrim(p_name);
    IF length(v_name) = 0 THEN
      RAISE EXCEPTION 'INVALID_INPUT: 지점명이 필요합니다';
    END IF;
    -- 원문 길이 기준(trim 아님) — 공백 패딩으로 저장 원문이 상한을 우회하지 못하게 한다
    -- (set_venue_role_salary 관용구, 20260723100000:38-45).
    IF length(p_name) > 50 THEN
      RAISE EXCEPTION 'INVALID_INPUT: 지점명은 50자 이하여야 합니다';
    END IF;
  END IF;

  -- ── 연락처 ────────────────────────────────────────────────────────────────
  IF p_contact_phone IS NOT NULL THEN
    v_contact_phone := NULLIF(btrim(p_contact_phone), '');
    IF v_contact_phone IS NOT NULL AND length(p_contact_phone) > 25 THEN
      RAISE EXCEPTION 'INVALID_INPUT: 연락처는 25자 이하여야 합니다';
    END IF;
  END IF;

  -- ── 소개 ──────────────────────────────────────────────────────────────────
  IF p_description IS NOT NULL THEN
    v_description := NULLIF(btrim(p_description), '');
    IF v_description IS NOT NULL AND length(p_description) > 500 THEN
      RAISE EXCEPTION 'INVALID_INPUT: 지점 소개는 500자 이하여야 합니다';
    END IF;
  END IF;

  -- ── 장소 정보(jsonb) ──────────────────────────────────────────────────────
  IF p_location IS NOT NULL THEN
    IF jsonb_typeof(p_location) <> 'object' THEN
      RAISE EXCEPTION 'INVALID_INPUT: 장소 정보 형식이 올바르지 않습니다';
    END IF;
    v_location := '{}'::jsonb;  -- NOT NULL 컬럼 — "제거"는 NULL 이 아니라 빈 객체다
    FOR v_key, v_val IN SELECT key, value FROM jsonb_each(p_location) LOOP
      IF NOT (v_key = ANY(c_loc_keys)) THEN
        RAISE EXCEPTION 'INVALID_INPUT: 장소 정보에 허용되지 않는 항목이 있습니다 (%)', v_key;
      END IF;
      IF jsonb_typeof(v_val) = 'null' THEN
        CONTINUE;
      END IF;
      IF jsonb_typeof(v_val) <> 'string' THEN
        RAISE EXCEPTION 'INVALID_INPUT: 장소 정보 값은 문자열이어야 합니다 (%)', v_key;
      END IF;
      v_text := btrim(v_val #>> '{}');
      IF v_text = '' THEN
        CONTINUE;  -- 빈 값은 키 자체를 넣지 않는다(소비처는 "있으면 표시" 방어)
      END IF;
      IF v_text ~* c_xss_pattern THEN
        RAISE EXCEPTION 'INVALID_INPUT: 장소 정보에 허용되지 않는 문자가 포함되어 있습니다';
      END IF;
      IF v_key = 'detailedAddress' AND length(v_text) > 200 THEN
        RAISE EXCEPTION 'INVALID_INPUT: 상세 주소는 200자 이하여야 합니다';
      END IF;
      IF v_key IN ('name', 'district') AND length(v_text) > 100 THEN
        RAISE EXCEPTION 'INVALID_INPUT: 장소 정보는 100자 이하여야 합니다 (%)', v_key;
      END IF;
      IF v_key = 'region' AND length(v_text) > 50 THEN
        RAISE EXCEPTION 'INVALID_INPUT: 지역 값이 올바르지 않습니다';
      END IF;
      v_location := v_location || jsonb_build_object(v_key, v_text);
    END LOOP;
  END IF;

  -- ── 지점 기본값(schedule.venueProfile) ────────────────────────────────────
  -- 🔴 schedule 을 통째로 교체하지 않는다. kind 는 uniq_venue_container 인덱스의
  --    구성요소이고(baseline:11967), roleSalaries·softTargets 는 단가표·목표인원의 저장소다.
  --    형제 키를 지우면 컨테이너 identity 가 깨져 동명 중복 생성이 열린다.
  IF p_defaults IS NOT NULL THEN
    IF jsonb_typeof(p_defaults) <> 'object' THEN
      RAISE EXCEPTION 'INVALID_INPUT: 지점 기본값 형식이 올바르지 않습니다';
    END IF;
    FOR v_key IN SELECT jsonb_object_keys(p_defaults) LOOP
      IF NOT (v_key = ANY(c_default_keys)) THEN
        RAISE EXCEPTION
          'INVALID_INPUT: 지점 기본값에 허용되지 않는 항목이 있습니다 (%) — 근무 시간은 지점 설정이 아니라 배치·공고 작성 때마다 입력합니다',
          v_key;
      END IF;
    END LOOP;
    IF p_defaults ? 'roles' AND jsonb_typeof(p_defaults -> 'roles') <> 'array' THEN
      RAISE EXCEPTION 'INVALID_INPUT: 기본 역할은 배열이어야 합니다';
    END IF;

    v_schedule := COALESCE(v_schedule, '{}'::jsonb);
    IF p_defaults = '{}'::jsonb THEN
      v_schedule := v_schedule - 'venueProfile';
    ELSE
      v_profile := COALESCE(v_schedule -> 'venueProfile', '{}'::jsonb) || p_defaults;
      v_schedule := v_schedule || jsonb_build_object('venueProfile', v_profile);
    END IF;
  END IF;

  -- ── 저장 ──────────────────────────────────────────────────────────────────
  -- 23505 는 uniq_venue_container(workspace_id, lower(title), schedule->>'kind') 충돌뿐이다.
  -- UPDATE 문만 감싼다 — 함수 전체를 감싸면 다른 unique 위반까지 같은 문구로 삼킨다.
  BEGIN
    UPDATE public.job_postings jp
    SET title         = COALESCE(v_name, jp.title),
        location      = CASE WHEN p_location IS NULL THEN jp.location ELSE v_location END,
        contact_phone = CASE WHEN p_contact_phone IS NULL THEN jp.contact_phone ELSE v_contact_phone END,
        description   = CASE WHEN p_description IS NULL THEN jp.description ELSE v_description END,
        schedule      = CASE WHEN p_defaults IS NULL THEN jp.schedule ELSE v_schedule END,
        updated_at    = v_now
    WHERE jp.id = p_container_id
    RETURNING jp.id, jp.title, jp.location, jp.contact_phone, jp.description
      INTO v_id, v_out_title, v_out_location, v_out_phone, v_out_desc;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'INVALID_INPUT: 같은 이름의 지점이 이미 있습니다';
  END;

  RETURN jsonb_build_object(
    'containerId',  v_id,
    'name',         v_out_title,
    'location',     v_out_location,
    'contactPhone', v_out_phone,
    'description',  v_out_desc
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_venue_container(uuid, text, jsonb, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_venue_container(uuid, text, jsonb, text, text, jsonb) TO authenticated;

COMMENT ON FUNCTION public.update_venue_container(uuid, text, jsonb, text, text, jsonb) IS
  '지점 컨테이너 프로필(이름·장소·연락처·소개) 수정. 부분 갱신(NULL=미변경, 빈문자=제거, location ''{}''=제거). 권한 4단 게이트 + FOR UPDATE. 23505 → INVALID_INPUT 변환. 기본 근무시간은 의도적 미지원(사용자 결정 4).';

-- ============================================================================
-- 2) get_my_venue_contexts — 스태프 본인 배치 지점의 표시 정보 (읽기)
-- ============================================================================
--
-- 지점당 정확히 1행. LATERAL 이 없다는 것이 이 RPC 의 존재 이유다(위 헤더 참조).
-- 권한 술어는 20260728185802 와 **동일** — 소프트 취소(#357) 이후 cancelled/no_show 는
-- "현재 배치"의 근거가 아니다(.claude/rules/supabase-patterns.md §11).
-- owner_name: 컨테이너 행의 owner_name 은 생성 RPC 가 안 채워 NULL 이므로 users.name 으로 폴백.
--   일반 공고는 이미 같은 값을 공개 목록에서 노출하며, 이 RPC 는 "현재 배치된 스태프"로
--   한정되므로 기존보다 좁은 노출면이다.

CREATE OR REPLACE FUNCTION public.get_my_venue_contexts(p_ids uuid[])
RETURNS TABLE(
  job_posting_id uuid,
  title          text,
  location       jsonb,
  contact_phone  text,
  description    text,
  owner_name     text
)
    LANGUAGE sql
    STABLE
    SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $$
  SELECT
    jp.id            AS job_posting_id,
    jp.title         AS title,
    jp.location      AS location,
    jp.contact_phone AS contact_phone,
    jp.description   AS description,
    COALESCE(NULLIF(btrim(COALESCE(jp.owner_name, '')), ''), u.name) AS owner_name
  FROM public.job_postings jp
  LEFT JOIN public.users u ON u.id = jp.owner_id
  WHERE jp.id = ANY(p_ids)
    AND jp.status = 'container'::public.posting_status
    AND EXISTS (
      SELECT 1
      FROM public.work_logs wl
      WHERE wl.job_posting_id = jp.id
        AND wl.staff_id = (SELECT auth.uid())
        AND wl.status NOT IN ('cancelled', 'no_show')
    );
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_venue_contexts(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_venue_contexts(uuid[]) TO authenticated;

COMMENT ON FUNCTION public.get_my_venue_contexts(uuid[]) IS
  'staff 본인이 *현재* 배치된 지점 컨테이너의 표시 정보(이름·장소·연락처·소개·담당자명)를 지점당 1행 반환한다. get_my_venue_role_salaries 와 달리 LATERAL 이 없어 단가표가 비어 있어도 행이 나온다 — 그것이 이 RPC 를 별도로 만든 이유다.';
