-- uniqn-mobile/supabase/tests/jpc_helpers.sql
-- pgTAP RLS 테스트 헬퍼 — JPC 후속 PR
-- 메모리 학습: pitfall_rls_dynamic_verification_sparse_data — matching row count 사전 측정 필수
--             pitfall_test_seed_zod_schema_first — JSONB raw INSERT 함정 회피

-- ============================================================================
-- 4 페르소나 + 리소스 셋업 (트랜잭션 안에서만 호출, ROLLBACK 로 정리)
-- ============================================================================

CREATE OR REPLACE FUNCTION jpc_test_seed()
RETURNS TABLE (
  owner_id        uuid,
  ws_editor_id    uuid,
  collaborator_id uuid,
  outsider_id     uuid,
  workspace_id    uuid,
  job_posting_id  uuid,
  application_id  uuid,
  work_log_id     uuid,
  qr_code_id      uuid
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_owner       uuid := gen_random_uuid();
  v_editor      uuid := gen_random_uuid();
  v_collab      uuid := gen_random_uuid();
  v_outsider    uuid := gen_random_uuid();
  v_ws          uuid := gen_random_uuid();
  v_jp          uuid := gen_random_uuid();
  v_app         uuid := gen_random_uuid();
  v_wl          uuid := gen_random_uuid();
  v_qr          uuid := gen_random_uuid();
  v_work_date   date := current_date + 14;
BEGIN
  -- auth.users (메모리: pitfall_supabase_auth_users_seed — NULL 토큰 회피)
  INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, recovery_token, email_change_token_new, email_change)
  VALUES
    (v_owner,    'jpc_owner_'    || v_owner    || '@test.local', '{"role":"employer"}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
    (v_editor,   'jpc_editor_'   || v_editor   || '@test.local', '{"role":"employer"}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
    (v_collab,   'jpc_collab_'   || v_collab   || '@test.local', '{"role":"employer"}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
    (v_outsider, 'jpc_outsider_' || v_outsider || '@test.local', '{"role":"staff"}'::jsonb,    '{}'::jsonb, now(), now(), '', '', '', '');

  -- public.users 동기화 + role 명시 (RPC create_workspace 의 PERMISSION_DENIED 회피)
  -- helpers seed 의 owner/editor/collab 은 employer, outsider 는 staff.
  -- ON CONFLICT 시 UPDATE: handle_new_user 트리거가 디폴트 'staff' 로 만들어둬도 보정.
  INSERT INTO public.users (id, email, name, role, is_active, created_at, updated_at)
  SELECT id, email, 'jpc test',
    CASE WHEN id = v_outsider THEN 'staff'::user_role ELSE 'employer'::user_role END,
    true, now(), now()
  FROM auth.users
  WHERE id IN (v_owner, v_editor, v_collab, v_outsider)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, is_active = EXCLUDED.is_active;

  -- workspace + 멤버
  INSERT INTO public.workspaces (id, name, owner_id, created_at, updated_at)
  VALUES (v_ws, 'jpc test ws', v_owner, now(), now());

  INSERT INTO public.workspace_members (workspace_id, user_id, role, joined_at)
  VALUES (v_ws, v_editor, 'editor', now());

  -- job_posting
  INSERT INTO public.job_postings (
    id, owner_id, owner_name, workspace_id, title, status, posting_type,
    work_date, work_dates, total_positions, filled_positions, view_count,
    schema_version, contact_phone, created_at, updated_at
  )
  VALUES (
    v_jp, v_owner, 'jpc owner', v_ws, 'jpc test posting', 'active', 'regular',
    v_work_date::text, ARRAY[v_work_date::text], 3, 0, 0, 3, '+82101111111', now(), now()
  );

  -- collaborator 등록
  INSERT INTO public.job_posting_collaborators (job_posting_id, user_id, added_by)
  VALUES (v_jp, v_collab, v_owner);

  -- application (outsider 가 지원)
  INSERT INTO public.applications (
    id, job_posting_id, applicant_id, applicant_name, status, created_at, updated_at
  )
  VALUES (v_app, v_jp, v_outsider, 'outsider applicant', 'applied', now(), now());

  -- work_log
  INSERT INTO public.work_logs (
    id, application_id, staff_id, job_posting_id, owner_id, date, status, role, created_at, updated_at
  )
  VALUES (v_wl, v_app, v_outsider, v_jp, v_owner, v_work_date::text, 'scheduled', 'staff', now(), now());

  -- event_qr_code (staff 본인 발급 가정)
  -- 실제 스키마: qr_token 대신 code 컬럼 사용
  INSERT INTO public.event_qr_codes (
    id, job_posting_id, user_id, type, code, work_date, is_active, expires_at, created_at
  )
  VALUES (v_qr, v_jp, v_outsider, 'checkIn', encode(gen_random_bytes(16), 'hex'), v_work_date::text, true, now() + interval '1 day', now());

  RETURN QUERY SELECT v_owner, v_editor, v_collab, v_outsider, v_ws, v_jp, v_app, v_wl, v_qr;
END;
$$;

-- ============================================================================
-- JWT 클레임 스위치 — Supabase RLS 의 (SELECT auth.uid()) 가 읽는 컨텍스트
-- ============================================================================

CREATE OR REPLACE FUNCTION jpc_test_set_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', p_user_id::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);
END;
$$;

CREATE OR REPLACE FUNCTION jpc_test_set_anon()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
  PERFORM set_config('role', 'anon', true);
END;
$$;

-- ============================================================================
-- DELETE 정책 동등 검증 함수 (SECURITY DEFINER)
-- job_postings DELETE 매트릭스는 jp_delete_workspace_owner USING 의
-- SELECT FROM workspaces → workspaces_select_owner_or_member 의 JPC JOIN 분기 →
-- job_postings SELECT RLS recursion 으로 직접 DELETE 검증 불가.
-- 정책 동등 로직을 SECURITY DEFINER 함수로 평가하여 RLS 우회.
-- ============================================================================

CREATE OR REPLACE FUNCTION jpc_check_can_delete_jp(p_user_id uuid, p_jp_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_allowed boolean;
BEGIN
  -- 정책: job_postings_delete_owner_or_admin (owner OR admin)
  --       OR jp_delete_workspace_owner (workspace.owner OR admin)
  SELECT
    EXISTS (
      SELECT 1 FROM public.job_postings jp
        LEFT JOIN public.workspaces w ON w.id = jp.workspace_id
      WHERE jp.id = p_jp_id
        AND (jp.owner_id = p_user_id OR w.owner_id = p_user_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.users WHERE id = p_user_id AND role = 'admin'::user_role
    )
  INTO v_allowed;
  RETURN v_allowed;
END;
$$;

-- ============================================================================
-- 추가 job_posting 시드 (SECURITY DEFINER — RLS 우회)
-- 메모리: pitfall_set_config_role_not_role_switch — set_config('role', 'service_role')
-- 은 GUC 만 셋, 실제 role switch 아님. 별도 jp 가 필요한 RLS 매트릭스 케이스
-- (예: applications INSERT 의 outsider 본인 명의 jp2 INSERT) 는 이 함수 경유.
-- ============================================================================

CREATE OR REPLACE FUNCTION jpc_seed_extra_jp(p_ws_id uuid, p_owner_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_jp2 uuid := gen_random_uuid();
  v_work_date date := current_date + 15;
BEGIN
  INSERT INTO public.job_postings (
    id, owner_id, owner_name, workspace_id, title, status, posting_type,
    work_date, work_dates, total_positions, filled_positions, view_count,
    schema_version, contact_phone, created_at, updated_at
  )
  VALUES (
    v_jp2, p_owner_id, 'jpc owner2', p_ws_id, 'jpc test posting 2', 'active', 'regular',
    v_work_date::text, ARRAY[v_work_date::text], 2, 0, 0, 3, '+82102222222', now(), now()
  );
  RETURN v_jp2;
END;
$$;
