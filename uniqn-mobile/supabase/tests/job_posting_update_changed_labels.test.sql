-- ============================================================
-- 공고 수정 알림 본문 라벨링 회귀 테스트
-- ============================================================
-- 목적: 마이그레이션 20260802160100_job_posting_update_changed_labels.sql 이 재정의한
--   notify_on_job_posting_update 의 **수정 분기 본문**을 고정하고, 손대지 않기로 한
--   취소·마감 분기가 실제로 그대로인지 함께 잠근다.
--
-- 배경: 종전 본문은 어떤 수정이든 "'제목' 공고가 수정되었습니다." 한 문장이라
--   지원자가 **일당이 깎인 건지 오타를 고친 건지 구분할 수 없었다**. 공고엔 변경 이력이
--   없어 상세로 들어가도 대조가 원리적으로 불가능하다.
--   이 알림은 `text[] || 'literal'` 오류로 한 번도 나가지 못하다가 20260727000000 §7 이
--   복구했다 — 즉 **이제부터 실제로 발송된다.** 첫 발송 전에 문구를 잠근다.
--
-- 시나리오:
--   T1. 급여만 변경   → 본문이 '급여가 변경되었습니다.' 로 **시작**한다
--       (목록에서 body 가 2줄로 잘리므로 라벨이 앞에 있어야 한다)
--   T2. 급여+근무일   → '급여·근무일이' — 중요도순. 가나다순(근무일·급여)이면 fail
--   T3. work_date·work_dates·schedule 동시 변경 → '근무일' 이 **1회만** (중복 가드)
--   T4. 제목만 변경   → '제목이' (받침 있음 → 조사 '이')
--   T5. 장소만 변경   → '근무 장소가' (받침 없음 → 조사 '가')
--   T6. data 계약     → changedFields(영어 키) 유지 + changedLabels 신설
--   T7. active→closed   → 마감 문구 원문 그대로 (재정의가 분기를 건드리지 않았다)
--   T8. active→cancelled → 취소 문구 원문 그대로
--   T9. SECDEF search_path 에 pg_temp 보존
--       (CREATE OR REPLACE 의 SET 절이 proconfig 를 통째로 교체한다 — 07-31 실사고)
--
-- 하네스: worklog_time_slot_change_notify.test.sql 과 동일
--   (BEGIN/plan/finish/ROLLBACK, 마커 이름 __sql_fixture_jpcl_*)
-- ============================================================

BEGIN;
SELECT plan(1);

DO $$
DECLARE
  v_owner uuid := gen_random_uuid();
  v_staff uuid := gen_random_uuid();
  v_ws uuid;
  v_job uuid;
  v_job_closed uuid;
  v_job_cancelled uuid;
  v_body text;
  v_data jsonb;
  v_n int;
  v_search_path text;

  -- 특정 공고의 최신 job_updated 본문을 읽는 헬퍼 대신 쓰는 인라인 조회용
  v_title constant text := '__sql_fixture_jpcl_job';
BEGIN
  -- seed
  INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES
    (v_owner, '__sql_fixture_jpcl_owner@test.local', '{"role":"employer"}'::jsonb, '{"name":"JPCL owner"}'::jsonb, now(), now()),
    (v_staff, '__sql_fixture_jpcl_staff@test.local', '{"role":"staff"}'::jsonb, '{"name":"JPCL staff"}'::jsonb, now(), now());

  INSERT INTO public.users (id, email, name, role, is_active, created_at, updated_at)
  VALUES
    (v_owner, '__sql_fixture_jpcl_owner@test.local', 'fixture owner', 'employer'::user_role, true, now(), now()),
    (v_staff, '__sql_fixture_jpcl_staff@test.local', 'fixture staff', 'staff'::user_role, true, now(), now())
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, is_active = EXCLUDED.is_active;

  INSERT INTO public.workspaces (name, owner_id) VALUES ('__sql_fixture_jpcl_ws', v_owner)
    RETURNING id INTO v_ws;

  INSERT INTO public.job_postings (title, workspace_id, owner_id, status)
    VALUES (v_title, v_ws, v_owner, 'active'::posting_status) RETURNING id INTO v_job;
  INSERT INTO public.job_postings (title, workspace_id, owner_id, status)
    VALUES ('__sql_fixture_jpcl_closed', v_ws, v_owner, 'active'::posting_status) RETURNING id INTO v_job_closed;
  INSERT INTO public.job_postings (title, workspace_id, owner_id, status)
    VALUES ('__sql_fixture_jpcl_cancelled', v_ws, v_owner, 'active'::posting_status) RETURNING id INTO v_job_cancelled;

  -- 지원자가 있어야 알림이 생성된다(수신자 집합 = confirmed/applied/cancellation_pending)
  INSERT INTO public.applications (applicant_id, job_posting_id, applicant_name)
    VALUES (v_staff, v_job, 'fixture staff');
  INSERT INTO public.applications (applicant_id, job_posting_id, applicant_name)
    VALUES (v_staff, v_job_closed, 'fixture staff');
  INSERT INTO public.applications (applicant_id, job_posting_id, applicant_name)
    VALUES (v_staff, v_job_cancelled, 'fixture staff');

  -- 지원 접수 등 선행 알림 제거 — 이후 단계는 "이번 UPDATE 가 만든 것"만 본다
  DELETE FROM public.notifications WHERE recipient_id = v_staff;

  -- ---- T1: 급여만 변경 ----
  UPDATE public.job_postings
     SET compensation = '{"type":"daily","amount":150000}'::jsonb
   WHERE id = v_job;

  SELECT body INTO v_body FROM public.notifications
   WHERE recipient_id = v_staff AND type = 'job_updated' AND data->>'jobPostingId' = v_job::text;
  IF v_body IS NULL THEN
    RAISE EXCEPTION 'T1 fail: 급여 변경 알림 미발송';
  END IF;
  IF v_body NOT LIKE '급여가 변경되었습니다.%' THEN
    RAISE EXCEPTION 'T1 fail: 본문이 라벨로 시작하지 않는다 (body=%)', v_body;
  END IF;
  DELETE FROM public.notifications WHERE recipient_id = v_staff;

  -- ---- T2: 급여 + 근무일 (중요도순 — 가나다순이면 '근무일·급여' 가 된다) ----
  UPDATE public.job_postings
     SET compensation = '{"type":"daily","amount":120000}'::jsonb,
         work_dates = ARRAY['2026-09-01', '2026-09-02']
   WHERE id = v_job;

  SELECT body INTO v_body FROM public.notifications
   WHERE recipient_id = v_staff AND type = 'job_updated' AND data->>'jobPostingId' = v_job::text;
  IF v_body NOT LIKE '급여·근무일이 변경되었습니다.%' THEN
    RAISE EXCEPTION 'T2 fail: 라벨 순서/조사 불일치 — 기대 "급여·근무일이 …" (body=%)', COALESCE(v_body, '(알림 없음)');
  END IF;
  DELETE FROM public.notifications WHERE recipient_id = v_staff;

  -- ---- T3: 날짜 축 3개 동시 변경 → '근무일' 1회만 ----
  UPDATE public.job_postings
     SET work_date = '2026-10-01',
         work_dates = ARRAY['2026-10-01', '2026-10-02'],
         schedule = '{"timeSlots":[{"time":"18:00"}]}'::jsonb
   WHERE id = v_job;

  SELECT body, data INTO v_body, v_data FROM public.notifications
   WHERE recipient_id = v_staff AND type = 'job_updated' AND data->>'jobPostingId' = v_job::text;
  IF v_body IS DISTINCT FROM '근무일이 변경되었습니다. ''' || v_title || ''' 공고를 확인해 주세요.' THEN
    RAISE EXCEPTION 'T3 fail: 날짜 축 3개가 라벨 3개로 새어나왔다 (body=%)', COALESCE(v_body, '(알림 없음)');
  END IF;

  -- ---- T6: data 계약 — 영어 키 유지 + 한글 라벨 신설 ----
  IF v_data->>'changedFields' IS NULL OR v_data->>'changedFields' NOT LIKE '%workDate%' THEN
    RAISE EXCEPTION 'T6 fail: changedFields(영어 키) 계약이 깨졌다 (data=%)', v_data::text;
  END IF;
  IF v_data->>'changedLabels' IS DISTINCT FROM '근무일' THEN
    RAISE EXCEPTION 'T6 fail: changedLabels 누락/불일치 (data=%)', v_data::text;
  END IF;
  DELETE FROM public.notifications WHERE recipient_id = v_staff;

  -- ---- T4: 제목만 변경 → 받침 있음 → 조사 '이' ----
  UPDATE public.job_postings SET title = v_title || '_수정' WHERE id = v_job;
  SELECT body INTO v_body FROM public.notifications
   WHERE recipient_id = v_staff AND type = 'job_updated' AND data->>'jobPostingId' = v_job::text;
  IF v_body NOT LIKE '제목이 변경되었습니다.%' THEN
    RAISE EXCEPTION 'T4 fail: 받침 있는 라벨의 조사가 틀렸다 (body=%)', COALESCE(v_body, '(알림 없음)');
  END IF;
  DELETE FROM public.notifications WHERE recipient_id = v_staff;

  -- ---- T5: 장소만 변경 → 받침 없음 → 조사 '가' ----
  UPDATE public.job_postings
     SET location = '{"address":"서울시 강남구"}'::jsonb
   WHERE id = v_job;
  SELECT body INTO v_body FROM public.notifications
   WHERE recipient_id = v_staff AND type = 'job_updated' AND data->>'jobPostingId' = v_job::text;
  IF v_body NOT LIKE '근무 장소가 변경되었습니다.%' THEN
    RAISE EXCEPTION 'T5 fail: 받침 없는 라벨의 조사가 틀렸다 (body=%)', COALESCE(v_body, '(알림 없음)');
  END IF;
  DELETE FROM public.notifications WHERE recipient_id = v_staff;

  -- ---- T7: active → closed (마감 분기 원문 보존) ----
  UPDATE public.job_postings SET status = 'closed'::posting_status WHERE id = v_job_closed;
  SELECT body INTO v_body FROM public.notifications
   WHERE recipient_id = v_staff AND type = 'job_closed' AND data->>'jobPostingId' = v_job_closed::text;
  IF v_body IS DISTINCT FROM '''__sql_fixture_jpcl_closed''가 마감되었습니다.' THEN
    RAISE EXCEPTION 'T7 fail: 마감 분기 문구가 바뀌었다 (body=%)', COALESCE(v_body, '(알림 없음)');
  END IF;
  DELETE FROM public.notifications WHERE recipient_id = v_staff;

  -- ---- T8: active → cancelled (취소 분기 원문 보존) ----
  UPDATE public.job_postings SET status = 'cancelled'::posting_status WHERE id = v_job_cancelled;
  SELECT body INTO v_body FROM public.notifications
   WHERE recipient_id = v_staff AND type = 'job_cancelled' AND data->>'jobPostingId' = v_job_cancelled::text;
  IF v_body IS DISTINCT FROM '''__sql_fixture_jpcl_cancelled''가 취소되었습니다.' THEN
    RAISE EXCEPTION 'T8 fail: 취소 분기 문구가 바뀌었다 (body=%)', COALESCE(v_body, '(알림 없음)');
  END IF;

  -- 취소 알림은 high 우선순위여야 한다(원문 계약)
  SELECT count(*) INTO v_n FROM public.notifications
   WHERE recipient_id = v_staff AND type = 'job_cancelled' AND priority = 'high'
     AND data->>'jobPostingId' = v_job_cancelled::text;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'T8 fail: 취소 알림 우선순위 계약 붕괴 (high %건, 기대 1)', v_n;
  END IF;

  -- ---- T9: SECDEF search_path 에 pg_temp 보존 ----
  SELECT c INTO v_search_path
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace,
         unnest(coalesce(p.proconfig, ARRAY[]::text[])) c
   WHERE n.nspname = 'public' AND p.proname = 'notify_on_job_posting_update'
     AND c LIKE 'search_path=%';
  IF v_search_path IS NULL OR v_search_path NOT ILIKE '%pg_temp%' THEN
    RAISE EXCEPTION 'T9 fail: CREATE OR REPLACE 가 pg_temp 하드닝을 되돌림 (proconfig=%)',
      COALESCE(v_search_path, '(없음)');
  END IF;
END $$;

SELECT pass('공고 수정 알림 — 라벨 선두배치·중요도순·날짜축 중복가드·조사(이/가)·data 계약·취소/마감 분기 원문 보존·pg_temp 보존');

SELECT * FROM finish();
ROLLBACK;
