-- uniqn-mobile/supabase/fixtures/jpc_helpers.sql
-- pgTAP RLS 테스트 헬퍼 — JPC 후속 PR
-- 메모리 학습: pitfall_rls_dynamic_verification_sparse_data — matching row count 사전 측정 필수
--             pitfall_test_seed_zod_schema_first — JSONB raw INSERT 함정 회피
--
-- ============================================================================
-- ⚠️ 경고: 이 파일은 supabase/fixtures/ 전용입니다. PROD 등록 금지.
-- ============================================================================
-- ⚠️ 위치 주의: supabase/tests/ 안에 두면 pg_prove 가 plan 없는 helper 파일로
--             보고 "No plan found in TAP output" 으로 fail. supabase/fixtures/
--             분리. npm run test:db:helpers 가 docker cp 으로 등록.
--
-- 이 파일에는 SECURITY DEFINER 함수들이 포함되어 RLS 를 완전히 우회합니다:
--   - jpc_test_force_delete_workspace (workspaces.DELETE 정책 부재 = deny-all 우회)
--   - jpc_test_force_delete_jp (FK ON DELETE NO ACTION 시 app/wl/qr cascade utility)
--   - jpc_check_can_delete_jp (jp DELETE owner case — FK cascade utility 로 정책 동등 평가)
--   - jpc_test_create_user / delete_user / transfer_ws_owner
--   - jpc_test_seed / count_jpc / audit_source / count_notif_* / get_ws_owner
--
-- 이 헬퍼들은 RLS 정책 검증의 부수효과 확인용 (cascade/trigger/audit) 입니다.
-- 2026-05-13: C2 fix (PR #91) 후 jpc INSERT/DELETE cycle 해소 → invoker 패턴 복원.
--             jpc_test_force_delete_jpc / jpc_test_force_insert_jpc 제거.
-- migrations/ 폴더로 옮기거나 prod DB 에 직접 등록하면 ANY authenticated user 가
-- workspace/jp/jpc 의 RLS 를 우회 가능 — catastrophic security incident.
--
-- 등록 방법 (로컬/CI 만):
--   docker exec -i supabase_db_uniqn psql -U postgres -d postgres -f - < supabase/fixtures/jpc_helpers.sql
--   또는 npm run test:db (자동 등록 + supabase test db)
-- ============================================================================

-- ============================================================================
-- 테이블 GRANT 정합 (Supabase CLI 버전 드리프트 방어) — 2026-06-19
-- ============================================================================
-- 배경: 이 RLS 테스트들은 jpc_test_set_user() 로 role=authenticated/anon 전환 후
--       public 테이블에 직접 접근한다. prod 는 Supabase 기본 default-privilege 로
--       anon/authenticated/service_role 에 ALL 테이블 GRANT 를 보유하지만(실측 확인),
--       `supabase/setup-cli@v1 version: latest` 가 받는 최신 로컬 이미지는
--       마이그레이션 생성 테이블에 implicit GRANT 를 더 이상 자동부여하지 않는다.
--       그 결과 RLS 평가 전에 "permission denied for table" (42501) 로 die →
--       db-tests 전면 red (job_postings_anon_public_select + jpc_*_rls 6 +
--       workspace_archive). master #175(2026-06-18) 에서 16/16 subtest fail.
-- 해결: 테스트 스택 grant 를 prod 와 동일하게 맞춰 CLI 버전과 무관하게 결정적으로.
--       RLS 가 실제 행 접근의 보안 경계이므로 테이블 GRANT 확대는 prod 동치이며 안전.
-- ⚠️ 함수는 GRANT 금지: 결제 RPC 하드닝(#172, wallet_grants_hardening.test.sql)이
--    anon/authenticated 에서 REVOKE 한 EXECUTE 를 되살리면 회귀. 테이블/시퀀스만.
-- ⚠️ 이 파일은 fixtures 전용(prod 등록 금지) — 로컬/CI 테스트 DB 에만 적용된다.
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

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
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
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

-- ============================================================================
-- 추가 event_qr_code 시드 (SECURITY DEFINER — RLS 우회)
-- DELETE 4 케이스 매트릭스 (jpc_event_qr_codes_rls) 가 같은 row 1건에 대해
-- SAVEPOINT/ROLLBACK TO 로 격리하던 패턴이 pg_prove 환경에서 silent drop 됨.
-- 4 페르소나 별 개별 qr_id 시드 → SAVEPOINT 불필요 → plan(16) 복원.
-- ============================================================================

CREATE OR REPLACE FUNCTION jpc_seed_extra_qr(p_jp_id uuid, p_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_qr uuid := gen_random_uuid();
  v_work_date date := current_date + 14;
BEGIN
  INSERT INTO public.event_qr_codes (
    id, job_posting_id, user_id, type, code, work_date, is_active, expires_at, created_at
  )
  VALUES (
    v_qr, p_jp_id, p_user_id, 'checkIn',
    encode(gen_random_bytes(16), 'hex'),
    v_work_date::text, true, now() + interval '1 day', now()
  );
  RETURN v_qr;
END;
$$;

-- ============================================================================
-- service_role 우회 헬퍼 (cascade/owner 이양 시나리오용)
-- 메모리: pitfall_set_config_role_not_role_switch
-- ============================================================================

CREATE OR REPLACE FUNCTION jpc_test_create_user(p_role text DEFAULT 'staff')
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_id uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data,
                          created_at, updated_at,
                          confirmation_token, recovery_token,
                          email_change_token_new, email_change)
  VALUES (v_id, 'jpc_extra_'||v_id||'@test.local',
          jsonb_build_object('role', p_role), '{}'::jsonb,
          now(), now(), '', '', '', '');

  INSERT INTO public.users (id, email, name, role, is_active, created_at, updated_at)
  VALUES (v_id, 'jpc_extra_'||v_id||'@test.local', 'jpc extra',
          CASE p_role WHEN 'admin' THEN 'admin'::user_role
                      WHEN 'employer' THEN 'employer'::user_role
                      ELSE 'staff'::user_role END,
          true, now(), now())
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, is_active = EXCLUDED.is_active;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION jpc_test_delete_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION jpc_test_transfer_ws_owner(p_ws_id uuid, p_new_owner uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.workspaces SET owner_id = p_new_owner WHERE id = p_ws_id;
END;
$$;

-- workspaces.DELETE 는 정책 부재 = deny-all (Task 2.1 확인). RLS 우회로
-- FK RESTRICT 동작 검증용 (C1 cascade 시나리오)
CREATE OR REPLACE FUNCTION jpc_test_force_delete_workspace(p_ws_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM public.workspaces WHERE id = p_ws_id;
END;
$$;

-- ============================================================================
-- 검증용 helpers (SECURITY DEFINER — RLS 우회로 cascade/trigger 효과 확인)
-- audit/notifications 의 RLS 가 좁아서 invoker 권한으로 검증 불가.
-- ============================================================================

CREATE OR REPLACE FUNCTION jpc_test_count_jpc(p_jp_id uuid, p_user_id uuid)
RETURNS int
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT count(*)::int FROM public.job_posting_collaborators
   WHERE job_posting_id = p_jp_id AND user_id = p_user_id;
$$;

CREATE OR REPLACE FUNCTION jpc_test_count_jpc_by_jp(p_jp_id uuid)
RETURNS int
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT count(*)::int FROM public.job_posting_collaborators
   WHERE job_posting_id = p_jp_id;
$$;

-- C3 cascade 시 owner 의 DELETE FROM job_postings 가 RLS recursion 트리거
-- (jp_delete_workspace_owner USING → workspaces_select_owner_or_member 의
-- JPC JOIN 분기 → job_postings SELECT RLS 재진입). SECURITY DEFINER 우회로
-- cascade 동작 검증 가능 (Task 2.2 의 jpc_check_can_delete_jp 와 동일 패턴).
CREATE OR REPLACE FUNCTION jpc_test_force_delete_jp(p_jp_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM public.job_postings WHERE id = p_jp_id;
END;
$$;

-- 2026-05-13: jpc_test_force_delete_jpc / jpc_test_force_insert_jpc 제거.
-- C2 fix (PR #91, 20260515100000) 로 workspaces SELECT JPC JOIN cycle 해소 →
-- jpc DELETE (jpc_delete_owner_or_self) / INSERT (jpc_insert_ws_owner) 가
-- invoker 권한으로 직접 호출 가능. jpc_cascade.test.sql C4/C5/C9/C10 참조.

-- C6 검증용 (workspaces.SELECT RLS 우회로 owner_id 확인)
CREATE OR REPLACE FUNCTION jpc_test_get_ws_owner(p_ws_id uuid)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT owner_id FROM public.workspaces WHERE id = p_ws_id;
$$;

-- C7 검증용 (applicantId 필터 — seed 의 outsider application 과 새 applicant 의 INSERT 구분)
CREATE OR REPLACE FUNCTION jpc_test_count_notif_by_applicant(p_applicant uuid, p_type text)
RETURNS int
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT count(*)::int FROM public.notifications
   WHERE type = p_type
     AND data->>'applicantId' = p_applicant::text;
$$;

CREATE OR REPLACE FUNCTION jpc_test_audit_source(p_jp_id uuid, p_target uuid, p_action text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT source FROM public.job_posting_collaborator_audit
   WHERE job_posting_id = p_jp_id
     AND target_user_id = p_target
     AND action         = p_action
   ORDER BY at DESC LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION jpc_test_audit_actor(p_jp_id uuid, p_target uuid, p_action text)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT actor_user_id FROM public.job_posting_collaborator_audit
   WHERE job_posting_id = p_jp_id
     AND target_user_id = p_target
     AND action         = p_action
   ORDER BY at DESC LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION jpc_test_count_notif_by_jp(p_jp_id uuid, p_type text)
RETURNS int
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT count(*)::int FROM public.notifications
   WHERE type = p_type
     AND data->>'jobPostingId' = p_jp_id::text;
$$;

CREATE OR REPLACE FUNCTION jpc_test_count_notif_for_user(p_recipient uuid, p_type text, p_jp_id uuid)
RETURNS int
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT count(*)::int FROM public.notifications
   WHERE recipient_id = p_recipient
     AND type = p_type
     AND data->>'jobPostingId' = p_jp_id::text;
$$;
