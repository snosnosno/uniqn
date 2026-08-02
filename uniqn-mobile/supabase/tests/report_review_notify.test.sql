-- ============================================================
-- 신고 처리 결과 알림(report_resolved) 회귀 테스트
-- ============================================================
-- 목적: 마이그레이션 20260802170000_notify_on_report_review.sql 의 트리거를 고정한다.
--
-- 배경: 앱 FAQ('faq-report-1')가 "처리 결과는 앱 내 알림으로 안내드립니다"라고 약속했는데
--   reports 에 UPDATE 알림 트리거가 없어 report_resolved 는 한 번도 발송된 적이 없다.
--   수신측(타입·카테고리·템플릿·아이콘·라우트맵)은 100% 배선돼 있었고 송신부만 비어 있었다.
--
-- 시나리오:
--   T1. pending → resolved  → 알림 1건 (이게 핵심 — 무발송 회귀 방지)
--       + category='admin' · link='/notifications' · data.reportId 검증
--   T2. pending → dismissed → 본문이 '처리 완료'와 **다른** 기각 문구
--       (하나로 뭉뚱그리면 기각당한 신고자가 조치가 된 줄 안다)
--   T3. pending → reviewed  → 0건 (중간 상태는 종결이 아니다)
--       이어서 reviewed → resolved → 1건 (두 번째 발화 조건)
--   T4. reporter_id IS NULL → 알림 0건이고 **UPDATE 자체는 성공한다**
--       (recipient_id NOT NULL 이라 가드가 없으면 신고 처리가 통째로 깨진다)
--   T5. reviewer_notes(관리자 내부 메모)가 본문·data 어디에도 없다 — 프라이버시 결정 미확정
--   T6. SECDEF search_path 에 pg_temp 포함 + PUBLIC EXECUTE 회수 상태
--
-- 하네스: worklog_time_slot_change_notify.test.sql 과 동일
--   (BEGIN/plan/finish/ROLLBACK, 마커 이메일 __sql_fixture_rrn_*)
-- ============================================================

BEGIN;
SELECT plan(1);

DO $$
DECLARE
  v_owner uuid := gen_random_uuid();
  v_reporter uuid := gen_random_uuid();
  v_ws uuid;
  v_job uuid;
  v_r_resolved uuid;
  v_r_dismissed uuid;
  v_r_reviewed uuid;
  v_r_orphan uuid;
  v_r_notes uuid;
  v_n int;
  v_body text;
  v_data jsonb;
  v_category text;
  v_link text;
  v_search_path text;
  v_acl aclitem[];
  v_secret constant text := '내부메모_비공개_XYZ';
BEGIN
  -- seed
  INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES
    (v_owner, '__sql_fixture_rrn_owner@test.local', '{"role":"employer"}'::jsonb, '{"name":"RRN owner"}'::jsonb, now(), now()),
    (v_reporter, '__sql_fixture_rrn_reporter@test.local', '{"role":"staff"}'::jsonb, '{"name":"RRN reporter"}'::jsonb, now(), now());

  INSERT INTO public.users (id, email, name, role, is_active, created_at, updated_at)
  VALUES
    (v_owner, '__sql_fixture_rrn_owner@test.local', 'fixture owner', 'employer'::user_role, true, now(), now()),
    (v_reporter, '__sql_fixture_rrn_reporter@test.local', 'fixture reporter', 'staff'::user_role, true, now(), now())
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, is_active = EXCLUDED.is_active;

  INSERT INTO public.workspaces (name, owner_id) VALUES ('__sql_fixture_rrn_ws', v_owner)
    RETURNING id INTO v_ws;
  INSERT INTO public.job_postings (title, workspace_id, owner_id) VALUES ('__sql_fixture_rrn_job', v_ws, v_owner)
    RETURNING id INTO v_job;

  INSERT INTO public.reports (type, reporter_type, reporter_id, reporter_name, target_id, target_name, job_posting_id, description)
  VALUES ('no_show', 'employee', v_reporter, 'fixture reporter', v_owner, 'fixture owner', v_job, '노쇼 신고 픽스처')
  RETURNING id INTO v_r_resolved;

  INSERT INTO public.reports (type, reporter_type, reporter_id, reporter_name, target_id, target_name, job_posting_id, description)
  VALUES ('tardiness', 'employee', v_reporter, 'fixture reporter', v_owner, 'fixture owner', v_job, '지각 신고 픽스처')
  RETURNING id INTO v_r_dismissed;

  INSERT INTO public.reports (type, reporter_type, reporter_id, reporter_name, target_id, target_name, job_posting_id, description)
  VALUES ('negligence', 'employee', v_reporter, 'fixture reporter', v_owner, 'fixture owner', v_job, '근무태만 신고 픽스처')
  RETURNING id INTO v_r_reviewed;

  -- reporter_id 는 nullable 이다(탈퇴 등). 알림을 보낼 곳이 없는 행.
  INSERT INTO public.reports (type, reporter_type, reporter_id, reporter_name, target_id, target_name, job_posting_id, description)
  VALUES ('other', 'employee', NULL, '(탈퇴한 사용자)', v_owner, 'fixture owner', v_job, '고아 신고 픽스처')
  RETURNING id INTO v_r_orphan;

  INSERT INTO public.reports (type, reporter_type, reporter_id, reporter_name, target_id, target_name, job_posting_id, description)
  VALUES ('unfair_treatment', 'employee', v_reporter, 'fixture reporter', v_owner, 'fixture owner', v_job, '부당대우 신고 픽스처')
  RETURNING id INTO v_r_notes;

  -- ---- T1: pending → resolved ----
  UPDATE public.reports SET status = 'resolved', reviewed_at = now() WHERE id = v_r_resolved;

  SELECT count(*) INTO v_n FROM public.notifications
   WHERE recipient_id = v_reporter AND type = 'report_resolved'
     AND data->>'reportId' = v_r_resolved::text;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'T1 fail: 신고 처리 결과가 무음으로 통과 (알림 %건, 기대 1)', v_n;
  END IF;

  SELECT body, data, category::text, link INTO v_body, v_data, v_category, v_link
    FROM public.notifications
   WHERE recipient_id = v_reporter AND type = 'report_resolved'
     AND data->>'reportId' = v_r_resolved::text;

  IF v_body NOT LIKE '%조치 완료%' THEN
    RAISE EXCEPTION 'T1 fail: 처리 완료 문구 누락 (body=%)', v_body;
  END IF;
  IF v_body NOT LIKE '%노쇼%' THEN
    RAISE EXCEPTION 'T1 fail: 신고 유형 라벨 누락 (body=%)', v_body;
  END IF;
  -- 클라이언트 SSOT: NOTIFICATION_TYPE_TO_CATEGORY[REPORT_RESOLVED] = ADMIN
  IF v_category IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'T1 fail: category 가 클라 SSOT(admin)와 불일치 (category=%)', COALESCE(v_category, '(null)');
  END IF;
  -- 클라이언트 SSOT: NOTIFICATION_ROUTE_MAP[REPORT_RESOLVED] → { name: 'notifications' }
  IF v_link IS DISTINCT FROM '/notifications' THEN
    RAISE EXCEPTION 'T1 fail: link 가 라우트맵 목적지와 불일치 (link=%)', COALESCE(v_link, '(null)');
  END IF;
  IF v_data->>'reportStatus' IS DISTINCT FROM 'resolved' THEN
    RAISE EXCEPTION 'T1 fail: data.reportStatus 누락 (data=%)', v_data::text;
  END IF;

  -- ---- T2: pending → dismissed (기각 문구가 처리 완료와 달라야 한다) ----
  UPDATE public.reports SET status = 'dismissed', reviewed_at = now() WHERE id = v_r_dismissed;

  SELECT body INTO v_body FROM public.notifications
   WHERE recipient_id = v_reporter AND type = 'report_resolved'
     AND data->>'reportId' = v_r_dismissed::text;
  IF v_body IS NULL THEN
    RAISE EXCEPTION 'T2 fail: 기각 통지 미발송';
  END IF;
  IF v_body LIKE '%조치 완료%' THEN
    RAISE EXCEPTION 'T2 fail: 기각인데 조치 완료로 읽힌다 (body=%)', v_body;
  END IF;
  IF v_body NOT LIKE '%별도 조치 없이 종결%' THEN
    RAISE EXCEPTION 'T2 fail: 기각 문구 누락 (body=%)', v_body;
  END IF;

  -- ---- T3: pending → reviewed 는 침묵, reviewed → resolved 는 발화 ----
  UPDATE public.reports SET status = 'reviewed' WHERE id = v_r_reviewed;
  SELECT count(*) INTO v_n FROM public.notifications
   WHERE recipient_id = v_reporter AND type = 'report_resolved'
     AND data->>'reportId' = v_r_reviewed::text;
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'T3 fail: 중간 상태(reviewed)에서 종결 통지 발송 (알림 %건, 기대 0)', v_n;
  END IF;

  UPDATE public.reports SET status = 'resolved' WHERE id = v_r_reviewed;
  SELECT count(*) INTO v_n FROM public.notifications
   WHERE recipient_id = v_reporter AND type = 'report_resolved'
     AND data->>'reportId' = v_r_reviewed::text;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'T3 fail: reviewed → resolved 전이 미통지 (알림 %건, 기대 1)', v_n;
  END IF;

  -- ---- T4: reporter_id NULL — 알림 0건 + UPDATE 자체는 성공 ----
  UPDATE public.reports SET status = 'resolved' WHERE id = v_r_orphan;
  SELECT count(*) INTO v_n FROM public.notifications
   WHERE type = 'report_resolved' AND data->>'reportId' = v_r_orphan::text;
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'T4 fail: 수신자 없는 신고에 알림 발송 (알림 %건, 기대 0)', v_n;
  END IF;
  SELECT count(*) INTO v_n FROM public.reports WHERE id = v_r_orphan AND status = 'resolved';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'T4 fail: reporter_id NULL 인 신고의 처리가 롤백됨 (기대: 정상 종결)';
  END IF;

  -- ---- T5: 관리자 내부 메모 미노출 ----
  UPDATE public.reports
     SET status = 'resolved', reviewer_notes = v_secret, reviewed_at = now()
   WHERE id = v_r_notes;

  SELECT body, data INTO v_body, v_data FROM public.notifications
   WHERE recipient_id = v_reporter AND type = 'report_resolved'
     AND data->>'reportId' = v_r_notes::text;
  IF v_body IS NULL THEN
    RAISE EXCEPTION 'T5 fail: 통지 미발송(선행 조건 붕괴)';
  END IF;
  IF v_body LIKE '%' || v_secret || '%' OR v_data::text LIKE '%' || v_secret || '%' THEN
    RAISE EXCEPTION 'T5 fail: 관리자 내부 메모(reviewer_notes)가 신고자에게 노출됨 (body=% / data=%)',
      v_body, v_data::text;
  END IF;

  -- ---- T6: SECDEF 하드닝 ----
  SELECT c INTO v_search_path
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace,
         unnest(coalesce(p.proconfig, ARRAY[]::text[])) c
   WHERE n.nspname = 'public' AND p.proname = 'notify_on_report_review'
     AND c LIKE 'search_path=%';
  IF v_search_path IS NULL OR v_search_path NOT ILIKE '%pg_temp%' THEN
    RAISE EXCEPTION 'T6 fail: search_path 에 pg_temp 누락 (proconfig=%)', COALESCE(v_search_path, '(없음)');
  END IF;

  -- proacl 이 NULL 이면 "기본 권한" = 함수는 PUBLIC 에게 EXECUTE 가 열려 있다.
  -- 즉 NULL 자체가 회수 실패 신호다(REVOKE 를 하면 명시 ACL 이 생긴다).
  SELECT p.proacl INTO v_acl
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'notify_on_report_review';
  IF v_acl IS NULL THEN
    RAISE EXCEPTION 'T6 fail: proacl 이 NULL — PUBLIC EXECUTE 가 기본 GRANT 로 열려 있다 (20260731090000 규율 위반)';
  END IF;
  -- grantee 가 빈 문자열인 aclitem('=X/postgres')이 PUBLIC 몫이다.
  IF EXISTS (
    SELECT 1 FROM unnest(v_acl) a
     WHERE a::text LIKE '=%' OR a::text LIKE 'anon=%' OR a::text LIKE 'authenticated=%'
  ) THEN
    RAISE EXCEPTION 'T6 fail: PUBLIC/anon/authenticated EXECUTE 잔존 (proacl=%)', v_acl::text;
  END IF;
END $$;

SELECT pass('report_resolved 알림 — 발화(resolved/dismissed/reviewed→resolved)·중간상태 침묵·수신자 NULL 안전·내부메모 미노출·SECDEF 하드닝');

SELECT * FROM finish();
ROLLBACK;
