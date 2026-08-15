-- ============================================================
-- 공고 일괄 공지 회귀 가드 (S3-2, 마이그 20260813140000)
-- ============================================================
-- 🚨 이 기능의 실패는 전부 "성공처럼 보인다"
--   · 중복 수신: 같은 스태프가 3일 배정돼 있으면 같은 공지를 3번 받는다. 에러는 없다.
--   · 잘못된 수신자: 취소·노쇼 처리된 사람에게 "내일 봬요" 가 간다. 에러는 없다.
--   · 권한 누수: SECDEF 라 RLS 를 우회한다 — 게이트가 함수 안에만 있다.
--   · 연타: 알림은 되돌릴 수 없다. 두 번 눌리면 스태프 전원 알림함에 두 번 남는다.
--
-- 시나리오:
--   D1. owner 가 보내면 활성 배정 스태프에게만 알림이 가고 이력 1건이 남는다
--   D2. 같은 스태프가 여러 날 배정돼도 알림은 1건 (DISTINCT)
--   D3. cancelled / no_show / no_show_at 은 수신자에서 빠진다
--   D4. recipient_count 가 실제 발송 수와 일치한다 (이력이 거짓말하지 않는다)
--   D5. 🔒 무관한 employer 는 PERMISSION_DENIED
--   D6. 60초 내 재발송은 RATE_LIMITED (연타 방어)
--   D7. 빈 값·길이 초과는 VALIDATION_FAILED
--   D8. 🔒 이력 RLS — 무관한 사용자에게는 안 보인다
--
-- 안전: BEGIN/ROLLBACK 래핑 + 마커 이메일(__sql_fixture_jpa_*@test.local)
-- 선행: npm run test:db:helpers (jpc_test_set_user)
-- ============================================================

BEGIN;
SELECT plan(1);

DO $$
DECLARE
  v_owner_id     uuid := gen_random_uuid();
  v_other_id     uuid := gen_random_uuid();
  v_staff_a      uuid := gen_random_uuid();  -- 2일 배정 (중복 수신 검증)
  v_staff_b      uuid := gen_random_uuid();  -- 1일 배정
  v_staff_cancel uuid := gen_random_uuid();  -- 취소
  v_staff_ns     uuid := gen_random_uuid();  -- no_show
  v_staff_nsat   uuid := gen_random_uuid();  -- no_show_at 만

  v_workspace_id uuid := gen_random_uuid();
  v_jp           uuid := gen_random_uuid();

  v_d1 text := to_char(((now() AT TIME ZONE 'Asia/Seoul')::date + 1), 'YYYY-MM-DD');
  v_d2 text := to_char(((now() AT TIME ZONE 'Asia/Seoul')::date + 2), 'YYYY-MM-DD');

  v_sent      integer;
  v_cnt       integer;
  v_history   integer;
  v_recorded  integer;
  v_failed    boolean;
BEGIN
  -- ------------------------------------------------------------
  -- 0. seed
  -- ------------------------------------------------------------
  INSERT INTO auth.users (id, email, aud, role, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  SELECT u.id, u.email, 'authenticated', 'authenticated', '', u.meta, '{"name":"JPA"}'::jsonb, now(), now()
  FROM (VALUES
    (v_owner_id,     '__sql_fixture_jpa_owner@test.local',  '{"role":"employer"}'::jsonb),
    (v_other_id,     '__sql_fixture_jpa_other@test.local',  '{"role":"employer"}'::jsonb),
    (v_staff_a,      '__sql_fixture_jpa_a@test.local',      '{"role":"staff"}'::jsonb),
    (v_staff_b,      '__sql_fixture_jpa_b@test.local',      '{"role":"staff"}'::jsonb),
    (v_staff_cancel, '__sql_fixture_jpa_c@test.local',      '{"role":"staff"}'::jsonb),
    (v_staff_ns,     '__sql_fixture_jpa_n@test.local',      '{"role":"staff"}'::jsonb),
    (v_staff_nsat,   '__sql_fixture_jpa_m@test.local',      '{"role":"staff"}'::jsonb)
  ) AS u(id, email, meta);

  INSERT INTO public.users (id, email, name, role, is_active, created_at, updated_at)
  SELECT id, email, 'fixture',
    CASE WHEN (raw_app_meta_data ->> 'role') = 'employer' THEN 'employer'::user_role ELSE 'staff'::user_role END,
    true, now(), now()
  FROM auth.users
  WHERE id IN (v_owner_id, v_other_id, v_staff_a, v_staff_b, v_staff_cancel, v_staff_ns, v_staff_nsat)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;

  INSERT INTO public.workspaces (id, name, owner_id, created_at, updated_at)
  VALUES (v_workspace_id, '__sql_fixture_jpa_ws', v_owner_id, now(), now());

  INSERT INTO public.job_postings (id, title, workspace_id, owner_id, status, schedule, created_at, updated_at)
  VALUES (v_jp, '__sql_fixture_jpa_jp', v_workspace_id, v_owner_id, 'active'::posting_status,
    jsonb_build_object('kind','dated','requirements','[]'::jsonb), now(), now());

  INSERT INTO public.work_logs (staff_id, job_posting_id, date, status, role, owner_id, no_show_at)
  VALUES
    (v_staff_a,      v_jp, v_d1, 'scheduled'::work_log_status, 'dealer'::staff_role, v_owner_id, NULL),
    (v_staff_a,      v_jp, v_d2, 'scheduled'::work_log_status, 'dealer'::staff_role, v_owner_id, NULL),
    (v_staff_b,      v_jp, v_d1, 'scheduled'::work_log_status, 'dealer'::staff_role, v_owner_id, NULL),
    (v_staff_cancel, v_jp, v_d1, 'cancelled'::work_log_status, 'dealer'::staff_role, v_owner_id, NULL),
    (v_staff_ns,     v_jp, v_d1, 'no_show'::work_log_status,   'dealer'::staff_role, v_owner_id, NULL),
    (v_staff_nsat,   v_jp, v_d1, 'scheduled'::work_log_status, 'dealer'::staff_role, v_owner_id, to_jsonb(now()::text));

  -- ------------------------------------------------------------
  -- D1~D4. 정상 발송
  -- ------------------------------------------------------------
  PERFORM jpc_test_set_user(v_owner_id);

  v_sent := public.send_job_posting_announcement(v_jp, '복장 안내', '검은 상의로 준비해주세요.');

  IF v_sent <> 2 THEN
    RAISE EXCEPTION 'D1/D2/D3 fail: 수신자가 %명이다 (기대 2 — staff_a·staff_b 만. '
      'a 는 2일 배정이라 DISTINCT 가 없으면 3, 취소·노쇼를 안 거르면 5가 된다)', v_sent;
  END IF;

  -- ⚠️ 여기서 role 을 되돌린다. jpc_test_set_user 는 authenticated 로 전환하는데
  --    notifications RLS(notif_select)는 `recipient_id = auth.uid()` 라 **보낸 사람에게는
  --    수신자의 알림이 보이지 않는다.** 그 상태로 세면 항상 0건이 나와 거짓 실패가 된다.
  RESET ROLE;

  -- D2: staff_a 는 2일 배정인데 알림은 1건이어야 한다
  SELECT count(*)::int INTO v_cnt
    FROM public.notifications
   WHERE recipient_id = v_staff_a AND type = 'posting_announcement';
  IF v_cnt <> 1 THEN
    RAISE EXCEPTION 'D2 fail: 2일 배정 스태프가 알림을 %건 받았다 (기대 1)', v_cnt;
  END IF;

  -- D3: 취소·노쇼 3인은 한 건도 받지 않는다
  SELECT count(*)::int INTO v_cnt
    FROM public.notifications
   WHERE type = 'posting_announcement'
     AND recipient_id IN (v_staff_cancel, v_staff_ns, v_staff_nsat);
  IF v_cnt <> 0 THEN
    RAISE EXCEPTION 'D3 fail: 취소·노쇼 스태프에게 %건이 갔다 (기대 0)', v_cnt;
  END IF;

  -- D4: 이력 1건 + recipient_count 가 실제와 일치
  SELECT count(*)::int INTO v_history
    FROM public.job_posting_announcements WHERE job_posting_id = v_jp;
  IF v_history <> 1 THEN
    RAISE EXCEPTION 'D4 fail: 이력이 %건이다 (기대 1)', v_history;
  END IF;

  SELECT recipient_count INTO v_recorded
    FROM public.job_posting_announcements WHERE job_posting_id = v_jp;
  IF v_recorded <> v_sent THEN
    RAISE EXCEPTION 'D4 fail: 이력의 수신자 수(%)가 실제 발송 수(%)와 다르다 — 이력이 거짓말하면 안 본 것만 못하다', v_recorded, v_sent;
  END IF;

  -- ------------------------------------------------------------
  -- D6. 연타 방어 (다시 owner 컨텍스트로)
  -- ------------------------------------------------------------
  PERFORM jpc_test_set_user(v_owner_id);

  v_failed := false;
  BEGIN
    PERFORM public.send_job_posting_announcement(v_jp, '또 보냄', '연타');
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%RATE_LIMITED%' THEN v_failed := true;
    ELSE RAISE EXCEPTION 'D6 fail: 예상 밖 에러 — %', SQLERRM; END IF;
  END;
  IF NOT v_failed THEN
    RAISE EXCEPTION 'D6 fail: 60초 내 재발송이 통과했다 — 연타 한 번에 스태프 전원이 같은 공지를 두 번 받는다';
  END IF;

  -- ------------------------------------------------------------
  -- D7. 입력 검증
  -- ------------------------------------------------------------
  v_failed := false;
  BEGIN
    PERFORM public.send_job_posting_announcement(v_jp, '   ', '내용');
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%VALIDATION_FAILED%' THEN v_failed := true; END IF;
  END;
  IF NOT v_failed THEN
    RAISE EXCEPTION 'D7 fail: 공백뿐인 제목이 통과했다';
  END IF;

  v_failed := false;
  BEGIN
    PERFORM public.send_job_posting_announcement(v_jp, repeat('가', 51), '내용');
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%VALIDATION_FAILED%' THEN v_failed := true; END IF;
  END;
  IF NOT v_failed THEN
    RAISE EXCEPTION 'D7 fail: 51자 제목이 통과했다 (한도 50)';
  END IF;

  -- ------------------------------------------------------------
  -- D5 / D8. 무관한 employer
  -- ------------------------------------------------------------
  PERFORM jpc_test_set_user(v_other_id);

  v_failed := false;
  BEGIN
    PERFORM public.send_job_posting_announcement(v_jp, '침입', '남의 공고에 공지');
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%PERMISSION_DENIED%' THEN v_failed := true;
    ELSE RAISE EXCEPTION 'D5 fail: 예상 밖 에러 — %', SQLERRM; END IF;
  END;
  IF NOT v_failed THEN
    RAISE EXCEPTION 'D5 fail: 무관한 employer 가 남의 공고 스태프에게 공지를 보냈다';
  END IF;

  -- D8: 이력도 안 보여야 한다 (RLS)
  SELECT count(*)::int INTO v_cnt FROM public.job_posting_announcements;
  IF v_cnt <> 0 THEN
    RAISE EXCEPTION 'D8 fail: 무관한 사용자에게 발송 이력 %건이 보인다 (기대 0)', v_cnt;
  END IF;

  -- ------------------------------------------------------------
  -- Cleanup — jpc_test_set_user 가 role 을 바꿔 놓았다(auth.users 정리 불가)
  -- ------------------------------------------------------------
  RESET ROLE;

  DELETE FROM public.job_posting_announcements WHERE job_posting_id = v_jp;
  DELETE FROM public.notifications
   WHERE recipient_id IN (v_owner_id, v_other_id, v_staff_a, v_staff_b, v_staff_cancel, v_staff_ns, v_staff_nsat);
  DELETE FROM public.work_logs WHERE job_posting_id = v_jp;
  DELETE FROM public.job_postings WHERE id = v_jp;
  DELETE FROM public.workspaces WHERE id = v_workspace_id;
  DELETE FROM public.workspaces
   WHERE owner_id IN (v_owner_id, v_other_id, v_staff_a, v_staff_b, v_staff_cancel, v_staff_ns, v_staff_nsat);
  DELETE FROM auth.users
   WHERE id IN (v_owner_id, v_other_id, v_staff_a, v_staff_b, v_staff_cancel, v_staff_ns, v_staff_nsat);
END $$;

SELECT pass('JOB_POSTING_ANNOUNCEMENTS_TEST_PASSED');
SELECT * FROM finish();
ROLLBACK;
