-- ============================================================
-- P1#10: 취소요청 알림 수신자 확장 회귀 테스트
-- ============================================================
-- 목적: 유저플로우 감사(2026-07-10) 클러스터 E — 취소요청 제출 시
--   owner 1명뿐 아니라 워크스페이스 멤버·공고 협업자에게도 통지되는지 검증.
--   마이그레이션 20260711030000_notify_cancellation_request_recipients.sql
--   (함수 확장 + tr_notify_cancellation_request 트리거 보장) 적용 후 실행.
--
-- 시나리오:
--   N1. confirmed → cancellation_pending 전이 시 수신자 = {owner, 멤버, 협업자} 정확히 3행
--   N2. 신청자 본인은 수신 제외
--   N3. 외부인 수신 없음 (N1 의 "정확히 3행"이 함께 고정)
--   N4. 중복 발송 없음 (수신자별 1행)
--
-- 하네스: cancel_application_employer_initiates.test.sql 과 동일
--   (BEGIN/plan/finish/ROLLBACK, 마커 이메일 __sql_fixture_ncr_*)
-- ============================================================

BEGIN;
SELECT plan(1);

DO $$
DECLARE
  v_owner_id uuid := gen_random_uuid();
  v_member_id uuid := gen_random_uuid();
  v_collab_id uuid := gen_random_uuid();
  v_staff_id uuid := gen_random_uuid();
  v_outsider_id uuid := gen_random_uuid();
  v_workspace_id uuid := gen_random_uuid();
  v_job_id uuid := gen_random_uuid();
  v_app_id uuid := gen_random_uuid();
  v_count int;
BEGIN
  -- seed
  INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES
    (v_owner_id,    '__sql_fixture_ncr_owner@test.local',    '{"role":"employer"}'::jsonb, '{"name":"OWNER"}'::jsonb, now(), now()),
    (v_member_id,   '__sql_fixture_ncr_member@test.local',   '{"role":"employer"}'::jsonb, '{"name":"MEMBER"}'::jsonb, now(), now()),
    (v_collab_id,   '__sql_fixture_ncr_collab@test.local',   '{"role":"employer"}'::jsonb, '{"name":"COLLAB"}'::jsonb, now(), now()),
    (v_staff_id,    '__sql_fixture_ncr_staff@test.local',    '{"role":"staff"}'::jsonb,    '{"name":"STAFF"}'::jsonb, now(), now()),
    (v_outsider_id, '__sql_fixture_ncr_outsider@test.local', '{"role":"staff"}'::jsonb,    '{"name":"OUT"}'::jsonb, now(), now());

  INSERT INTO public.users (id, email, name, role, is_active, created_at, updated_at)
  SELECT id, email, 'fixture',
    CASE WHEN id IN (v_owner_id, v_member_id, v_collab_id) THEN 'employer'::user_role ELSE 'staff'::user_role END,
    true, now(), now()
  FROM auth.users WHERE id IN (v_owner_id, v_member_id, v_collab_id, v_staff_id, v_outsider_id)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, is_active = EXCLUDED.is_active;

  INSERT INTO public.workspaces (id, name, owner_id, created_at, updated_at)
  VALUES (v_workspace_id, '__sql_fixture_ncr_ws', v_owner_id, now(), now());

  INSERT INTO public.workspace_members (workspace_id, user_id, invited_by)
  VALUES (v_workspace_id, v_member_id, v_owner_id);

  INSERT INTO public.job_postings (
    id, owner_id, workspace_id, title, total_positions, filled_positions, status, created_at, updated_at
  )
  VALUES (v_job_id, v_owner_id, v_workspace_id, '__sql_fixture: ncr', 5, 0, 'active', now(), now());

  INSERT INTO public.job_posting_collaborators (job_posting_id, user_id, added_by)
  VALUES (v_job_id, v_collab_id, v_owner_id);

  INSERT INTO public.applications (
    id, job_posting_id, applicant_id, applicant_name, status, cancellation_request, created_at, updated_at
  )
  VALUES (
    v_app_id, v_job_id, v_staff_id, 'STAFF', 'confirmed',
    jsonb_build_object('status', 'pending', 'reason', '개인 사정', 'requested_at', now()::text),
    now(), now()
  );

  -- 행위: confirmed → cancellation_pending 전이 (AFTER UPDATE 트리거 발화)
  UPDATE public.applications SET status = 'cancellation_pending' WHERE id = v_app_id;

  -- N1+N3+N4: 수신자 정확히 {owner, member, collaborator} 3행
  SELECT COUNT(*) INTO v_count FROM public.notifications
  WHERE type = 'cancellation_requested' AND (data->>'applicationId')::uuid = v_app_id;
  IF v_count != 3 THEN
    RAISE EXCEPTION 'N1 fail: expected 3 recipients, got % (owner-only 잔존 또는 트리거 미발화)', v_count;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.notifications WHERE type = 'cancellation_requested'
    AND recipient_id = v_owner_id AND (data->>'applicationId')::uuid = v_app_id) THEN
    RAISE EXCEPTION 'N1 fail: owner 미수신';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.notifications WHERE type = 'cancellation_requested'
    AND recipient_id = v_member_id AND (data->>'applicationId')::uuid = v_app_id) THEN
    RAISE EXCEPTION 'N1 fail: 워크스페이스 멤버 미수신';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.notifications WHERE type = 'cancellation_requested'
    AND recipient_id = v_collab_id AND (data->>'applicationId')::uuid = v_app_id) THEN
    RAISE EXCEPTION 'N1 fail: 공고 협업자 미수신';
  END IF;

  -- N2: 신청자 본인 제외
  IF EXISTS (SELECT 1 FROM public.notifications WHERE type = 'cancellation_requested'
    AND recipient_id = v_staff_id AND (data->>'applicationId')::uuid = v_app_id) THEN
    RAISE EXCEPTION 'N2 fail: 신청자 본인에게 발송됨';
  END IF;

  -- Cleanup (역순)
  DELETE FROM public.notifications WHERE (data->>'applicationId')::uuid = v_app_id;
  DELETE FROM public.applications WHERE id = v_app_id;
  DELETE FROM public.job_posting_collaborators WHERE job_posting_id = v_job_id;
  DELETE FROM public.job_postings WHERE id = v_job_id;
  DELETE FROM public.workspace_members WHERE workspace_id = v_workspace_id;
  DELETE FROM public.workspaces WHERE id = v_workspace_id;
  DELETE FROM auth.users WHERE id IN (v_owner_id, v_member_id, v_collab_id, v_staff_id, v_outsider_id);
END $$;

SELECT pass('NOTIFY_CANCELLATION_RECIPIENTS_TEST_PASSED');
SELECT * FROM finish();
ROLLBACK;
