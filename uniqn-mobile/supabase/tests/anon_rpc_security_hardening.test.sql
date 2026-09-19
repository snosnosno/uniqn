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
SELECT plan(22);

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
-- (제거됨) list_all_applications 는 저장소에 실재하지 않는 phantom 함수.
--   has_function_privilege 가 미존재 함수에 ERROR 를 던져 파일 전체가 실패하므로 단언 삭제.
--   REVOKE 루프는 미존재 함수를 멱등 skip 하므로 보호 대상 자체가 없음.
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

-- ─── 7) permanently_delete_user 의 service_role 신뢰 채널 (2026-08-07) ──────────
-- 배경: 크론 EF process-scheduled-deletions 가 service_role 로 이 RPC 를 부르는데
--   auth.uid()=NULL 이라 위 2)의 가드에 전량 차단돼 "매일 실행되면서 처리량 영구 0"이었다.
--   마이그 20260807150000 이 신뢰 채널을 열되, 지울 수 있는 대상을 캡으로 좁혔다.
-- ⚠️ 이 블록은 반드시 위 단언들 **뒤**에 온다 — 여기서 세팅하는 GUC 가 앞 단언에 번지지 않도록.
-- ⚠️ 4)·5)가 마지막에 claims 를 ''로 되돌려 놓으므로, 아래는 매번 명시적으로 다시 세팅한다.

-- (19) 픽스처: 활성 계정 1건. handle_new_user 트리거가 public.users(status='active') 를 만든다.
--      GoTrue NOT NULL 함정 — 토큰류 컬럼은 반드시 ''(NULL 금지). BEGIN/ROLLBACK 으로 소멸.
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, reauthentication_token, phone_change, phone_change_token,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'ac110000-0000-4000-a000-0000000000ac',
  'authenticated', 'authenticated', 'active-target@test.local',
  crypt(gen_random_uuid()::text, gen_salt('bf')), now(),
  '', '', '', '', '', '', '', '',
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
);
SELECT ok(
  EXISTS(SELECT 1 FROM public.users
          WHERE id = 'ac110000-0000-4000-a000-0000000000ac' AND status = 'active'),
  'service_role 픽스처: 활성 public.users 행이 생성되어 있다');

-- (20) 모던 JWT claims 의 service_role → 호출자 가드 통과 (미존재 UUID 라 USER_NOT_FOUND)
--      RED 기준: 마이그 20260807150000 적용 전에는 PERMISSION_DENIED 로 실패해야 한다.
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
SELECT set_config('request.jwt.claim.role', '', true);
SELECT throws_ok(
  $$ SELECT public.permanently_delete_user('99999999-9999-4999-a999-999999999999') $$,
  NULL, 'USER_NOT_FOUND: 99999999-9999-4999-a999-999999999999',
  'permanently_delete_user allows service_role past guard (modern JWT claims)');

-- (21) 레거시 GUC 의 service_role 도 동일 — prod 선례(check_application_tournament_approval)가
--      두 형태를 모두 인식하므로 양쪽을 다 고정한다.
SELECT set_config('request.jwt.claims', '', true);
SELECT set_config('request.jwt.claim.role', 'service_role', true);
SELECT throws_ok(
  $$ SELECT public.permanently_delete_user('99999999-9999-4999-a999-999999999999') $$,
  NULL, 'USER_NOT_FOUND: 99999999-9999-4999-a999-999999999999',
  'permanently_delete_user allows service_role past guard (legacy GUC)');

-- (22) 피해 상한: 신뢰 채널이라도 '예약 만료된 deactivated' 가 아니면 지울 수 없다.
--      EF 조회가 망가지거나 서비스 키가 오용돼도 활성 계정은 삭제 불가여야 한다.
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
SELECT set_config('request.jwt.claim.role', '', true);
SELECT throws_ok(
  $$ SELECT public.permanently_delete_user('ac110000-0000-4000-a000-0000000000ac') $$,
  NULL, 'NOT_ELIGIBLE_FOR_SCHEDULED_DELETION: ac110000-0000-4000-a000-0000000000ac',
  'permanently_delete_user blocks service_role from deleting an active account');

SELECT set_config('request.jwt.claims', '', true);
SELECT set_config('request.jwt.claim.role', '', true);

SELECT * FROM finish();
ROLLBACK;
