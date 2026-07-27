-- ============================================================
-- 근무표 소프트 취소 + 부족 인원 status 필터 회귀 테스트 (2026-07-27)
-- 사용법: psql "$SUPABASE_DB_URL" -f supabase/tests/work_schedule_soft_cancel.test.sql
--
-- 검증 대상: 20260727120000_work_schedule_soft_cancel_and_required_status_filter.sql
--   ① remove_direct_staff 가 하드 DELETE 대신 status='cancelled' 로 남긴다
--   ② 스태프에게 schedule_cancelled 알림이 실제로 생성된다 (종전엔 0건 — DELETE 트리거 부재)
--   ③ filled_positions 회계가 종전(DELETE)과 동일하게 -1 이다
--   ④ 취소 행이 근무표 읽기(get_venue_day_slots)에 다시 나타나지 않는다
--   ⑤ 뺐던 사람을 같은 날·같은 슬롯에 다시 넣을 수 있다(중복 가드가 cancelled 제외)
--   ⑥ 이미 취소된 행을 다시 빼면 멱등 성공 + 알림 중복 없음
--   ⑦ required_count 가 closed 공고 좌석을 배제한다
--   ⑧ required_count 가 active 공고 좌석은 그대로 산입한다(대조군 — 과잉 필터 방지)
--
-- 안전: BEGIN/ROLLBACK 래핑 + 마커 이메일(__sql_fixture_wsc_*@test.local)
-- 하네스: seat_basis_filled_positions 와 동형(CREATE TEMP TABLE _t + DO block + is()).
-- ============================================================

BEGIN;
SELECT plan(10);

CREATE TEMP TABLE _t (k text PRIMARY KEY, v text);

DO $$
DECLARE
  v_owner uuid := gen_random_uuid();
  v_staff uuid := gen_random_uuid();
  v_ws uuid := gen_random_uuid();
  v_container uuid;
  v_normal uuid := gen_random_uuid();
  v_closed uuid := gen_random_uuid();
  v_active uuid := gen_random_uuid();
  v_d text := '2026-08-03';
  v_add jsonb;
  v_res jsonb;
  v_wl uuid;
  v_filled int;
  v_cnt int;
  v_status text;
  v_required int;
  v_schedule jsonb;
BEGIN
  -- ---- 0. seed: owner(employer) + staff + workspace ----
  INSERT INTO auth.users (id, email, aud, role, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES
    (v_owner, '__sql_fixture_wsc_owner@test.local', 'authenticated', 'authenticated', '', '{"role":"employer"}'::jsonb, '{"name":"WSC_OWNER"}'::jsonb, now(), now()),
    (v_staff, '__sql_fixture_wsc_staff@test.local', 'authenticated', 'authenticated', '', '{"role":"staff"}'::jsonb,    '{"name":"WSC_STAFF"}'::jsonb, now(), now());

  INSERT INTO public.users (id, email, name, role, is_active, created_at, updated_at)
  VALUES
    (v_owner, '__sql_fixture_wsc_owner@test.local', 'WSC_OWNER', 'employer'::user_role, true, now(), now()),
    (v_staff, '__sql_fixture_wsc_staff@test.local', 'WSC_STAFF', 'staff'::user_role,    true, now(), now())
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, is_active = EXCLUDED.is_active;

  DELETE FROM public.workspaces WHERE owner_id = v_owner;
  INSERT INTO public.workspaces (id, name, owner_id, created_at, updated_at)
  VALUES (v_ws, '__sql_fixture_wsc_ws', v_owner, now(), now());

  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);

  v_container := (public.get_or_create_venue_container(v_ws, '운영처WSC', 'dated') ->> 'containerId')::uuid;

  -- 일반 공고(비컨테이너) — filled 회계 검증용. 좌석 2.
  INSERT INTO public.job_postings (id, owner_id, workspace_id, title, status, posting_type, total_positions, filled_positions, created_at, updated_at)
  VALUES (v_normal, v_owner, v_ws, '__sql_fixture_wsc_normal', 'active'::posting_status, 'regular'::posting_type, 2, 0, now(), now());

  -- ---- 1~3. 일반 공고에 배치 후 빼기 → 소프트 취소 + 알림 + filled -1 ----
  v_add := public.add_direct_staff(
    v_normal, v_staff,
    jsonb_build_array(jsonb_build_object('date', v_d, 'timeSlot', '18:00', 'role', 'dealer'))
  );
  v_wl := (v_add->'workLogIds'->>0)::uuid;

  SELECT filled_positions INTO v_filled FROM public.job_postings WHERE id = v_normal;
  INSERT INTO _t VALUES ('filled_after_add', v_filled::text);

  -- 취소 알림 대조군: 빼기 전에는 0건이어야 한다
  SELECT count(*) INTO v_cnt FROM public.notifications
  WHERE recipient_id = v_staff AND type = 'schedule_cancelled';
  INSERT INTO _t VALUES ('notif_before_remove', v_cnt::text);

  v_res := public.remove_direct_staff(v_wl);

  -- ① 행이 살아 있고 status='cancelled' (하드 DELETE 였다면 0건)
  SELECT count(*) INTO v_cnt FROM public.work_logs WHERE id = v_wl;
  INSERT INTO _t VALUES ('row_exists_after_remove', v_cnt::text);
  SELECT status::text INTO v_status FROM public.work_logs WHERE id = v_wl;
  INSERT INTO _t VALUES ('status_after_remove', COALESCE(v_status, '(deleted)'));

  -- ② 스태프에게 취소 알림 1건
  SELECT count(*) INTO v_cnt FROM public.notifications
  WHERE recipient_id = v_staff AND type = 'schedule_cancelled';
  INSERT INTO _t VALUES ('notif_after_remove', v_cnt::text);

  -- ③ filled 회계는 종전과 동일하게 -1
  SELECT filled_positions INTO v_filled FROM public.job_postings WHERE id = v_normal;
  INSERT INTO _t VALUES ('filled_after_remove', v_filled::text);

  -- ---- 4. 컨테이너 경로: 취소 행이 근무표 하루 슬롯에 안 보인다 ----
  v_add := public.add_direct_staff(
    v_container, v_staff,
    jsonb_build_array(jsonb_build_object('date', v_d, 'timeSlot', '20:00', 'role', 'dealer'))
  );
  v_wl := (v_add->'workLogIds'->>0)::uuid;
  PERFORM public.remove_direct_staff(v_wl);

  SELECT count(*) INTO v_cnt FROM public.get_venue_day_slots(v_container, v_d);
  INSERT INTO _t VALUES ('day_slots_after_remove', v_cnt::text);

  -- ---- 5. 재추가 가능(중복·정원 가드가 cancelled 를 제외하는지) ----
  BEGIN
    v_add := public.add_direct_staff(
      v_container, v_staff,
      jsonb_build_array(jsonb_build_object('date', v_d, 'timeSlot', '20:00', 'role', 'dealer'))
    );
    INSERT INTO _t VALUES ('readd_ok', 'true');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO _t VALUES ('readd_ok', 'false:' || SQLERRM);
  END;

  -- ---- 6. 멱등: 이미 취소된 행을 다시 빼도 성공 + 알림 중복 없음 ----
  SELECT count(*) INTO v_cnt FROM public.notifications
  WHERE recipient_id = v_staff AND type = 'schedule_cancelled';
  v_res := public.remove_direct_staff(v_wl);
  INSERT INTO _t VALUES ('idempotent_success', (v_res->>'success'));
  SELECT count(*) INTO v_required FROM public.notifications
  WHERE recipient_id = v_staff AND type = 'schedule_cancelled';
  INSERT INTO _t VALUES ('notif_no_duplicate', (v_required = v_cnt)::text);

  -- ---- 7~8. required_count 의 공고 status 필터 ----
  v_schedule := jsonb_build_object(
    'kind', 'dated',
    'requirements', jsonb_build_array(
      jsonb_build_object('date', v_d, 'timeSlots',
        jsonb_build_array(jsonb_build_object('startTime', '19:00', 'roles',
          jsonb_build_array(jsonb_build_object('role', 'dealer', 'count', 4)))))));

  -- 마감된 공고 — 좌석 4 는 더 이상 채울 수 없으므로 required 에서 빠져야 한다
  INSERT INTO public.job_postings (id, owner_id, workspace_id, venue_id, title, status, posting_type, schedule, total_positions, filled_positions, created_at, updated_at)
  VALUES (v_closed, v_owner, v_ws, v_container, '__sql_fixture_wsc_closed', 'closed'::posting_status, 'regular'::posting_type, v_schedule, 4, 0, now(), now());

  SELECT COALESCE(SUM(g.required_count), 0) INTO v_required
  FROM public.get_venue_grid_summary(v_container, v_d, v_d) g;
  INSERT INTO _t VALUES ('required_with_closed_only', v_required::text);

  -- 활성 공고 — 대조군. 좌석 4 는 그대로 산입돼야 한다(과잉 필터 방지)
  INSERT INTO public.job_postings (id, owner_id, workspace_id, venue_id, title, status, posting_type, schedule, total_positions, filled_positions, created_at, updated_at)
  VALUES (v_active, v_owner, v_ws, v_container, '__sql_fixture_wsc_active', 'active'::posting_status, 'regular'::posting_type, v_schedule, 4, 0, now(), now());

  SELECT COALESCE(SUM(g.required_count), 0) INTO v_required
  FROM public.get_venue_grid_summary(v_container, v_d, v_d) g;
  INSERT INTO _t VALUES ('required_with_active', v_required::text);
END $$;

-- ① 소프트 취소 — 행 보존 + status
SELECT is((SELECT v FROM _t WHERE k = 'row_exists_after_remove'), '1',
  'T1: remove_direct_staff 후에도 work_log 행이 남는다(하드 DELETE 아님)');
SELECT is((SELECT v FROM _t WHERE k = 'status_after_remove'), 'cancelled',
  'T2: 남은 행의 status 가 cancelled');

-- ② 취소 알림 — 종전 결함의 핵심
SELECT is((SELECT v FROM _t WHERE k = 'notif_before_remove'), '0',
  'T3: 빼기 전에는 취소 알림 0건(대조군)');
SELECT is((SELECT v FROM _t WHERE k = 'notif_after_remove'), '1',
  'T4: 빼기 후 스태프에게 schedule_cancelled 알림 1건 — DELETE 였을 때는 0건이었다');

-- ③ 회계 무회귀
SELECT is((SELECT v FROM _t WHERE k = 'filled_after_add'), '1',
  'T5: 배치 후 filled_positions +1');
SELECT is((SELECT v FROM _t WHERE k = 'filled_after_remove'), '0',
  'T6: 소프트 취소 후 filled_positions -1 (DELETE 와 동일)');

-- ④⑤⑥ 읽기 필터 · 재추가 · 멱등
SELECT is((SELECT v FROM _t WHERE k = 'day_slots_after_remove'), '0',
  'T7: 취소 행은 근무표 하루 슬롯에 안 보인다');
SELECT is((SELECT v FROM _t WHERE k = 'readd_ok'), 'true',
  'T8: 뺐던 사람을 같은 날·슬롯에 다시 배치할 수 있다');
SELECT is((SELECT v FROM _t WHERE k = 'notif_no_duplicate'), 'true',
  'T9: 이미 취소된 행 재호출 시 알림이 중복 생성되지 않는다');

-- ⑦⑧ required_count status 필터
SELECT is(
  (SELECT v FROM _t WHERE k = 'required_with_closed_only') || '/' ||
  (SELECT v FROM _t WHERE k = 'required_with_active'),
  '0/4',
  'T10: 마감 공고 좌석은 required 에서 배제, 활성 공고 좌석 4 는 산입(대조군)');

SELECT * FROM finish();
ROLLBACK;
