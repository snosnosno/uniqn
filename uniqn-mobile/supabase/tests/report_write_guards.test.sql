-- ============================================================
-- 신고 쓰기 경로 서버측 가드 회귀 테스트
-- ============================================================
-- 대상 마이그레이션
--   · 20260802170200_create_report_evidence_server_guard.sql
--       create_report 가 p_evidence_urls 를 검증한다(본인 폴더 이미지 경로, 최대 3장).
--       종전에는 클라 zod 가 유일한 방어였고 이 RPC 는 authenticated 에 열려 있어
--       PostgREST 직접 호출로 임의 외부 URL 을 심을 수 있었다(관리자 기기 비콘).
--   · 20260802170300_reports_identity_pin.sql
--       reports 의 reporter_id/target_id/job_posting_id 불변.
--       rep_update 정책에 WITH CHECK 이 없어 관리자 raw PATCH 로 신고 수신자를
--       바꿔치기하면 신설 알림 트리거가 엉뚱한 사람에게 발송됐다.
--   · 20260802190000_reports_xss_check_column_expansion.sql
--       reports_xss_check 가 description 단일 컬럼만 보던 것을 자유 텍스트 전부로 확장.
--       create_report 가 authenticated 에 열려 있어 클라 zod 를 RPC 직접 호출로 우회하면
--       target_name 오염이 알림 data.targetName 까지 전파됐다.
--
-- ⚠️ 42501 만 단언하면 red-스왑에 걸린다(다른 이유의 권한 오류도 통과) —
--    메시지까지 함께 본다.
-- ============================================================

BEGIN;
SELECT plan(17);

-- ---- 픽스처 ----
INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('c0000000-0000-4000-8000-000000000001', '__rwg_reporter@test.local', '{"role":"staff"}',    '{}', now(), now()),
  ('c0000000-0000-4000-8000-000000000002', '__rwg_target@test.local',   '{"role":"employer"}', '{}', now(), now()),
  ('c0000000-0000-4000-8000-000000000003', '__rwg_other@test.local',    '{"role":"staff"}',    '{}', now(), now()),
  ('c0000000-0000-4000-8000-000000000004', '__rwg_admin@test.local',    '{"role":"admin"}',    '{}', now(), now());

INSERT INTO public.users (id, email, name, role, is_active, created_at, updated_at)
VALUES
  ('c0000000-0000-4000-8000-000000000001', '__rwg_reporter@test.local', 'rwg reporter', 'staff'::user_role,    true, now(), now()),
  ('c0000000-0000-4000-8000-000000000002', '__rwg_target@test.local',   'rwg target',   'employer'::user_role, true, now(), now()),
  ('c0000000-0000-4000-8000-000000000003', '__rwg_other@test.local',    'rwg other',    'staff'::user_role,    true, now(), now()),
  ('c0000000-0000-4000-8000-000000000004', '__rwg_admin@test.local',    'rwg admin',    'admin'::user_role,    true, now(), now())
-- auth.users INSERT 가 handle_new_user 트리거로 public.users 를 이미 만든다 — 역할만 덮어쓴다.
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, is_active = EXCLUDED.is_active;

INSERT INTO public.workspaces (id, name, owner_id)
VALUES ('c0000000-0000-4000-8000-000000000010', '__rwg_ws', 'c0000000-0000-4000-8000-000000000002');

INSERT INTO public.job_postings (id, title, workspace_id, owner_id, status)
VALUES ('c0000000-0000-4000-8000-000000000020', '__rwg 공고', 'c0000000-0000-4000-8000-000000000010',
        'c0000000-0000-4000-8000-000000000002', 'active'::posting_status);

-- 신고자로 인증 컨텍스트 고정 (create_report 는 auth.uid() = p_reporter_id 를 요구한다)
SELECT set_config('request.jwt.claims',
  jsonb_build_object('sub', 'c0000000-0000-4000-8000-000000000001',
                     'app_metadata', jsonb_build_object('role','staff'))::text, true);

-- ============================================================
-- create_report 증빙 검증
-- ============================================================

-- 1. 본인 폴더의 이미지 경로는 통과한다 (가드가 정상 경로를 막지 않는지부터 본다)
SELECT isnt(
  public.create_report(
    'no_show','employee',
    'c0000000-0000-4000-8000-000000000001','rwg reporter',
    'c0000000-0000-4000-8000-000000000002','rwg target',
    'c0000000-0000-4000-8000-000000000020','__rwg 공고',
    '정상 증빙',
    ARRAY['c0000000-0000-4000-8000-000000000001/sub-1/1754100000-abc123.jpg'],
    'medium'::report_severity
  )->>'report_id',
  NULL,
  '본인 업로드 경로 증빙은 그대로 통과한다');

-- 2. 외부 http(s) URL 은 거부한다 (관리자 기기 비콘 차단 — 이 테스트가 이 마이그의 존재 이유다)
SELECT throws_ok(
  $$ SELECT public.create_report(
       'tardiness','employee',
       'c0000000-0000-4000-8000-000000000001','rwg reporter',
       'c0000000-0000-4000-8000-000000000002','rwg target',
       'c0000000-0000-4000-8000-000000000020','__rwg 공고',
       '외부 URL 증빙',
       ARRAY['https://attacker.example/beacon.png?r=1'],
       'medium'::report_severity) $$,
  NULL, 'INVALID_EVIDENCE_REF: 증빙은 본인이 업로드한 이미지 경로여야 합니다',
  '외부 http(s) URL 증빙은 서버에서 거부된다');

-- 3. 남의 uid 폴더 경로는 거부한다 (Storage RLS 와 같은 축)
SELECT throws_ok(
  $$ SELECT public.create_report(
       'negligence','employee',
       'c0000000-0000-4000-8000-000000000001','rwg reporter',
       'c0000000-0000-4000-8000-000000000002','rwg target',
       'c0000000-0000-4000-8000-000000000020','__rwg 공고',
       '남의 폴더 증빙',
       ARRAY['c0000000-0000-4000-8000-000000000003/sub-1/1754100000-abc123.jpg'],
       'medium'::report_severity) $$,
  NULL, 'INVALID_EVIDENCE_REF: 증빙은 본인이 업로드한 이미지 경로여야 합니다',
  '남의 uid 로 시작하는 경로는 거부된다');

-- 4. 경로 탈출은 거부한다
SELECT throws_ok(
  $$ SELECT public.create_report(
       'early_leave','employee',
       'c0000000-0000-4000-8000-000000000001','rwg reporter',
       'c0000000-0000-4000-8000-000000000002','rwg target',
       'c0000000-0000-4000-8000-000000000020','__rwg 공고',
       '탈출 증빙',
       ARRAY['c0000000-0000-4000-8000-000000000001/../../etc/passwd.jpg'],
       'medium'::report_severity) $$,
  NULL, 'INVALID_EVIDENCE_REF: 증빙은 본인이 업로드한 이미지 경로여야 합니다',
  '경로 탈출(../) 증빙은 거부된다');

-- 5. 4장 이상은 거부한다 (클라 상한 3과 동일 — 배열 폭탄 차단)
SELECT throws_ok(
  $$ SELECT public.create_report(
       'dress_code','employee',
       'c0000000-0000-4000-8000-000000000001','rwg reporter',
       'c0000000-0000-4000-8000-000000000002','rwg target',
       'c0000000-0000-4000-8000-000000000020','__rwg 공고',
       '과다 증빙',
       ARRAY['c0000000-0000-4000-8000-000000000001/s/1.jpg',
             'c0000000-0000-4000-8000-000000000001/s/2.jpg',
             'c0000000-0000-4000-8000-000000000001/s/3.jpg',
             'c0000000-0000-4000-8000-000000000001/s/4.jpg'],
       'medium'::report_severity) $$,
  NULL, 'TOO_MANY_EVIDENCE: 증빙은 최대 3장까지 첨부할 수 있습니다 (요청 4)',
  '증빙 4장은 거부된다');

-- 6. 증빙 없는 신고는 여전히 통과한다 (가드가 기본 경로를 막지 않는다)
SELECT isnt(
  public.create_report(
    'communication','employee',
    'c0000000-0000-4000-8000-000000000001','rwg reporter',
    'c0000000-0000-4000-8000-000000000002','rwg target',
    'c0000000-0000-4000-8000-000000000020','__rwg 공고',
    '증빙 없는 신고', NULL, 'low'::report_severity
  )->>'report_id',
  NULL,
  '증빙 NULL 인 신고는 통과한다');

-- ============================================================
-- reports 신원 고정 트리거
-- ============================================================

-- 관리자 컨텍스트 + 실제 PostgREST 롤(authenticated)로 전환한다.
-- current_user 데니리스트를 실제로 밟아야 이 가드를 검증한 것이 된다.
SELECT set_config('request.jwt.claims',
  jsonb_build_object('sub', 'c0000000-0000-4000-8000-000000000004',
                     'app_metadata', jsonb_build_object('role','admin'))::text, true);
SET LOCAL ROLE authenticated;

-- 7. reporter_id 를 다른 사용자로 재지정 → 차단 (알림 수신자 위조 차단)
SELECT throws_ok(
  $$ UPDATE public.reports
        SET reporter_id = 'c0000000-0000-4000-8000-000000000003', status = 'resolved'
      WHERE description = '정상 증빙' $$,
  NULL, 'REPORT_REPORTER_IMMUTABLE: reports.reporter_id 는 다른 사용자로 변경할 수 없습니다 (수신자 위조 차단)',
  '관리자라도 신고 수신자를 바꿔치기할 수 없다');

-- 8. reporter_id NULL 화도 직접 경로에서는 차단 (계정 삭제 경로 전용)
SELECT throws_ok(
  $$ UPDATE public.reports SET reporter_id = NULL WHERE description = '정상 증빙' $$,
  NULL, 'REPORT_REPORTER_IMMUTABLE: reports.reporter_id 는 직접 해제할 수 없습니다 (계정 삭제 경로 전용)',
  '직접 PATCH 로 신고자 참조를 해제할 수 없다');

-- 9. target_id 변경 → 차단 (피신고자 바꿔치기)
SELECT throws_ok(
  $$ UPDATE public.reports SET target_id = 'c0000000-0000-4000-8000-000000000003' WHERE description = '정상 증빙' $$,
  NULL, 'REPORT_TARGET_IMMUTABLE: reports.target_id 는 변경할 수 없습니다 (피신고자 바꿔치기 차단)',
  '피신고자를 바꿔치기할 수 없다');

-- 10. 정상 처리(상태 전이)는 그대로 통과한다 — 가드가 본업을 막지 않는지 확인
SELECT lives_ok(
  $$ UPDATE public.reports
        SET status = 'resolved', reviewed_at = now()
      WHERE description = '정상 증빙' $$,
  '신원을 건드리지 않는 상태 전이는 통과한다');

RESET ROLE;

-- 11. 신뢰 컨텍스트(SECDEF definer = postgres)에서는 NULL 화가 통과한다
--     permanently_delete_user 가 실제로 `UPDATE reports SET reporter_id = NULL` 을 수행한다.
SELECT lives_ok(
  $$ UPDATE public.reports SET reporter_id = NULL WHERE description = '증빙 없는 신고' $$,
  '신뢰 컨텍스트에서는 탈퇴 참조 해제가 통과한다 (계정 삭제 경로 보존)');

-- ============================================================
-- reports_xss_check 컬럼 확장 (20260802190000)
-- ============================================================
-- 클라 zod 는 create_report 가 authenticated 에 열려 있어 PostgREST 직접 호출로
-- 통째 우회된다 — 아래는 그 우회 경로(= RPC 직접 호출)를 그대로 재현한다.
--
-- ⚠️ type 은 기존 성공 INSERT 2건(no_show·communication)과 겹치지 않게 골랐다.
--    겹치면 24h DUPLICATE_REPORT 사전검사에 먼저 걸려 트리거까지 도달하지 못한다.

-- 신고자 컨텍스트 복귀 (create_report 는 auth.uid() = p_reporter_id 를 요구한다)
SELECT set_config('request.jwt.claims',
  jsonb_build_object('sub', 'c0000000-0000-4000-8000-000000000001',
                     'app_metadata', jsonb_build_object('role','staff'))::text, true);

-- 12. [대조군] description 오염은 종전대로 차단된다.
--     확장을 되돌려도 green 이어야 하는 항목 — red 가 "추가된 컬럼" 때문임을 증명한다.
SELECT throws_ok(
  $$ SELECT public.create_report(
       'inappropriate','employee',
       'c0000000-0000-4000-8000-000000000001','rwg reporter',
       'c0000000-0000-4000-8000-000000000002','rwg target',
       'c0000000-0000-4000-8000-000000000020','__rwg 공고',
       '<script>alert(1)</script>', NULL, 'medium'::report_severity) $$,
  NULL, 'XSS pattern detected in field: description',
  'description 오염은 종전대로 차단된다 (대조군)');

-- 13. target_name 오염 차단 — 이 확장의 본체.
--     notify_on_report_review 가 이 값을 notifications.data.targetName 으로 복사한다.
SELECT throws_ok(
  $$ SELECT public.create_report(
       'unfair_treatment','employee',
       'c0000000-0000-4000-8000-000000000001','rwg reporter',
       'c0000000-0000-4000-8000-000000000002','<script>alert(1)</script>',
       'c0000000-0000-4000-8000-000000000020','__rwg 공고',
       '대상 이름 오염 신고', NULL, 'medium'::report_severity) $$,
  NULL, 'XSS pattern detected in field: target_name',
  'RPC 직접 호출로 심은 target_name 오염이 서버에서 차단된다');

-- 14. reporter_name 오염 차단 — 클라 생성 스키마에 필드 자체가 없어 zod 방어가 0인 컬럼.
SELECT throws_ok(
  $$ SELECT public.create_report(
       'false_posting','employee',
       'c0000000-0000-4000-8000-000000000001','<iframe src=//evil>',
       'c0000000-0000-4000-8000-000000000002','rwg target',
       'c0000000-0000-4000-8000-000000000020','__rwg 공고',
       '신고자 이름 오염 신고', NULL, 'medium'::report_severity) $$,
  NULL, 'XSS pattern detected in field: reporter_name',
  'reporter_name 오염이 서버에서 차단된다');

-- 15. job_posting_title 오염 차단
SELECT throws_ok(
  $$ SELECT public.create_report(
       'employer_negligence','employee',
       'c0000000-0000-4000-8000-000000000001','rwg reporter',
       'c0000000-0000-4000-8000-000000000002','rwg target',
       'c0000000-0000-4000-8000-000000000020','<object data=x>',
       '공고 제목 오염 신고', NULL, 'medium'::report_severity) $$,
  NULL, 'XSS pattern detected in field: job_posting_title',
  'job_posting_title 오염이 서버에서 차단된다');

-- 16. UPDATE 경로 — reviewer_notes 오염 차단 (review_report 가 쓰는 관리자 입력 컬럼).
--     여기는 RESET ROLE 이후(postgres)라 RLS 무관하게 트리거만 검증한다.
--     신원 컬럼을 건드리지 않으므로 tr_reports_pin_identity 는 발화하지 않는다.
SELECT throws_ok(
  $$ UPDATE public.reports SET reviewer_notes = '<img onerror=alert(1) src=x>'
      WHERE description = '정상 증빙' $$,
  NULL, 'XSS pattern detected in field: reviewer_notes',
  'UPDATE 로 심는 reviewer_notes 오염이 차단된다');

-- 17. [대조군] 정상 reviewer_notes 는 통과한다 — 확장이 본업을 막지 않는다.
SELECT lives_ok(
  $$ UPDATE public.reports SET reviewer_notes = '지각 사실 확인, 경고 조치'
      WHERE description = '정상 증빙' $$,
  '정상 reviewer_notes 는 통과한다');

SELECT * FROM finish();
ROLLBACK;
