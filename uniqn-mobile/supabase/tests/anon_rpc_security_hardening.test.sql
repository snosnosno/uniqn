-- ============================================================
-- 2026-06-21 anon RPC 보안 하드닝 회귀 가드
--   (20260621090000 / 20260621090100 / 20260621090200)
-- 검증:
--   1) 위험 SECDEF RPC 의 anon EXECUTE 회수 (authenticated 유지)
--   2) 변이 RPC 의 auth.uid() 호출자 바인딩 가드 (미인증/타인 위조 차단, 본인 통과)
--   3) VCS↔prod 드리프트 정합화 구조 단언
-- auth.uid()/role 은 request.jwt.claims 로 시뮬레이션. 안전: BEGIN/ROLLBACK.
-- ============================================================
BEGIN;
SELECT plan(20);

-- ─── 1) EXECUTE 권한: anon 회수 / authenticated 유지 ─────────────────────────
SELECT ok(NOT has_function_privilege('anon', 'public.permanently_delete_user(uuid)', 'EXECUTE'),
  'anon cannot EXECUTE permanently_delete_user');
SELECT ok(NOT has_function_privilege('anon', 'public.update_user_role(uuid, text)', 'EXECUTE'),
  'anon cannot EXECUTE update_user_role');
SELECT ok(NOT has_function_privilege('anon', 'public.confirm_application(uuid, uuid, jsonb, jsonb, jsonb, text, boolean, jsonb)', 'EXECUTE'),
  'anon cannot EXECUTE confirm_application');
SELECT ok(NOT has_function_privilege('anon', 'public.cancel_application_atomically(uuid, text, uuid, text, text)', 'EXECUTE'),
  'anon cannot EXECUTE cancel_application_atomically');
SELECT ok(NOT has_function_privilege('anon', 'public.process_qr_checkin_atomically(uuid, uuid, uuid, text, timestamptz, text)', 'EXECUTE'),
  'anon cannot EXECUTE process_qr_checkin_atomically');
SELECT ok(NOT has_function_privilege('anon', 'public.list_all_applications(application_status)', 'EXECUTE'),
  'anon cannot EXECUTE list_all_applications');
SELECT ok(has_function_privilege('authenticated', 'public.confirm_application(uuid, uuid, jsonb, jsonb, jsonb, text, boolean, jsonb)', 'EXECUTE'),
  'authenticated retains EXECUTE on confirm_application (no regression)');
-- allowlist 유지 (가입/공개 경로)
SELECT ok(has_function_privilege('anon', 'public.check_email_exists(text)', 'EXECUTE'),
  'anon retains EXECUTE on check_email_exists (signup path)');
SELECT ok(has_function_privilege('anon', 'public.get_posting_filled_counts(uuid[])', 'EXECUTE'),
  'anon retains EXECUTE on get_posting_filled_counts (public share)');

-- ─── 2) permanently_delete_user 호출자 바인딩 가드 ──────────────────────────
-- 미인증(auth.uid() IS NULL) → PERMISSION_DENIED
SELECT set_config('request.jwt.claims', '', true);
SELECT throws_ok(
  $$ SELECT public.permanently_delete_user('11111111-1111-1111-1111-111111111111') $$,
  NULL, 'PERMISSION_DENIED: 본인 또는 관리자만 삭제 가능',
  'permanently_delete_user blocks anon (NULL auth.uid)');

-- 타인(caller<>target, 비admin) → PERMISSION_DENIED
SELECT set_config('request.jwt.claims',
  jsonb_build_object('sub', '22222222-2222-2222-2222-222222222222', 'app_metadata', jsonb_build_object('role','staff'))::text, true);
SELECT throws_ok(
  $$ SELECT public.permanently_delete_user('33333333-3333-3333-3333-333333333333') $$,
  NULL, 'PERMISSION_DENIED: 본인 또는 관리자만 삭제 가능',
  'permanently_delete_user blocks authenticated forging another user');

-- 본인(caller==target) → 가드 통과(존재X 라 USER_NOT_FOUND, PERMISSION_DENIED 아님)
SELECT set_config('request.jwt.claims',
  jsonb_build_object('sub', '44444444-4444-4444-4444-444444444444', 'app_metadata', jsonb_build_object('role','staff'))::text, true);
SELECT throws_ok(
  $$ SELECT public.permanently_delete_user('44444444-4444-4444-4444-444444444444') $$,
  NULL, 'USER_NOT_FOUND: 44444444-4444-4444-4444-444444444444',
  'permanently_delete_user allows self past guard (USER_NOT_FOUND, not PERMISSION_DENIED)');

-- ─── 3) confirm_application 호출자 바인딩 ────────────────────────────────────
-- caller<>p_owner_id (비admin) → PERMISSION_DENIED: 호출자 인증 불일치
SELECT set_config('request.jwt.claims',
  jsonb_build_object('sub', '55555555-5555-5555-5555-555555555555', 'app_metadata', jsonb_build_object('role','employer'))::text, true);
SELECT throws_ok(
  $$ SELECT public.confirm_application('00000000-0000-0000-0000-000000000000', '66666666-6666-6666-6666-666666666666') $$,
  NULL, 'PERMISSION_DENIED: 호출자 인증 불일치',
  'confirm_application blocks caller<>owner forgery');

-- ─── 4) cancel_application_atomically 호출자 바인딩 (RETURN unauthorized) ─────
SELECT set_config('request.jwt.claims',
  jsonb_build_object('sub', '77777777-7777-7777-7777-777777777777', 'app_metadata', jsonb_build_object('role','staff'))::text, true);
SELECT is(
  (public.cancel_application_atomically('00000000-0000-0000-0000-000000000000','staff_initiates','88888888-8888-8888-8888-888888888888')->>'error'),
  'unauthorized',
  'cancel_application_atomically blocks caller<>actor forgery');

-- 미인증 → unauthorized
SELECT set_config('request.jwt.claims', '', true);
SELECT is(
  (public.cancel_application_atomically('00000000-0000-0000-0000-000000000000','staff_initiates','88888888-8888-8888-8888-888888888888')->>'error'),
  'unauthorized',
  'cancel_application_atomically blocks anon (NULL auth.uid)');

-- ─── 5) process_qr_checkin_atomically 호출자 바인딩 (RETURN unauthorized) ─────
SELECT set_config('request.jwt.claims',
  jsonb_build_object('sub', '99999999-9999-9999-9999-999999999999', 'app_metadata', jsonb_build_object('role','staff'))::text, true);
SELECT is(
  (public.process_qr_checkin_atomically('00000000-0000-0000-0000-000000000000','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','00000000-0000-0000-0000-000000000000','checkIn', now(), NULL)->>'error'),
  'unauthorized',
  'process_qr_checkin_atomically blocks caller<>staff forgery');

SELECT set_config('request.jwt.claims', '', true);

-- ─── 6) 드리프트 정합화 구조 단언 ───────────────────────────────────────────
SELECT has_trigger('public', 'users', 'prevent_role_escalation',
  'prevent_role_escalation trigger exists on users (sec-auth-1)');
SELECT has_index('public', 'applications', 'applications_job_posting_id_applicant_id_key',
  'applications (job_posting_id, applicant_id) UNIQUE exists (dataint-1)');
SELECT hasnt_function('public', 'sync_role_to_auth',
  'duplicate sync_role_to_auth function removed (sec-auth-4)');

SELECT * FROM finish();
ROLLBACK;
