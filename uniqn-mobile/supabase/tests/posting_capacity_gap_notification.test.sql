-- ============================================================
-- D-2/D-1 정원 미달 알림 회귀 가드 (S3-1, 마이그 20260813110000)
-- ============================================================
-- 배경: 사장은 공고를 올려 두고 잊는다. 근무 당일 아침에야 "한 명 못 채웠네"를 알면
--   그때는 메울 방법이 없다. 근무일 이틀 전·하루 전에 알려 아직 손쓸 수 있게 한다.
--
-- 🚨 이 파일이 존재하는 이유 — 이 기능은 **두 가지 방식으로 조용히 망가진다**
--   ① 멱등 실패: `notifications` 에는 멱등 컬럼이 없다. 크론이 두 번 돌거나 같은 날
--      재배포로 재실행되면 같은 알림이 그대로 또 INSERT 된다. 알림함이 같은 문장으로
--      도배되면 사장은 그다음부터 알림 자체를 안 본다 — 기능이 스스로를 망친다.
--      마이그레이션은 부분 UNIQUE 인덱스 + ON CONFLICT DO NOTHING 으로 막는데,
--      인덱스 표현식이 하나라도 어긋나면 **충돌이 안 나서 조용히 중복이 들어간다**.
--      "성공적으로 두 번 INSERT" 는 에러가 아니므로 어떤 로그도 남지 않는다.
--   ② 판정축 실패: 채움을 넓게 세면(노쇼를 채움으로 착각) **알림이 아예 안 간다**.
--      거짓 침묵은 로그도 안 남고 사용자도 모른다 — 빈 자리로 당일을 맞고 나서야 안다.
--
-- 시나리오:
--   A1. 인덱스가 UNIQUE + 부분(partial) 이다 (표현식 4개 · type 조건)
--   A2. D-1 미달만 알림 · D-2 충족은 침묵 (날짜별 판정 — 공고 합계가 아님)
--   A3. 알림 본문 계약: dOffset/missingCount/workDate/priority
--   A4. 노쇼 3형태(status=no_show · cancelled · **no_show_at 만**)는 채움에서 빠진다
--   A5. FIXED_SCHEDULE 고정 공고는 날짜 캐스팅 에러 없이 무시된다
--   A6. closed 공고는 미달이어도 알림 없음
--   A7. 멱등 — 두 번째 호출은 전역 0건, 내 알림 수도 그대로
--   A8. 멱등 인덱스가 진짜로 중복을 **거부**한다 (ON CONFLICT 없는 직접 INSERT → unique_violation)
--
-- 안전: BEGIN/ROLLBACK 래핑 + 마커 이메일(__sql_fixture_pcg_*@test.local)
-- ============================================================

BEGIN;
SELECT plan(1);

DO $$
DECLARE
  v_owner_id     uuid := gen_random_uuid();
  v_staff_id     uuid := gen_random_uuid();
  v_workspace_id uuid := gen_random_uuid();

  v_jp_gap    uuid := gen_random_uuid();  -- A2/A3: D-1 미달 · D-2 충족
  v_jp_ns     uuid := gen_random_uuid();  -- A4: 노쇼 3형태
  v_jp_fixed  uuid := gen_random_uuid();  -- A5: FIXED_SCHEDULE
  v_jp_closed uuid := gen_random_uuid();  -- A6: closed

  v_today date := (now() AT TIME ZONE 'Asia/Seoul')::date;
  v_d1    date := (now() AT TIME ZONE 'Asia/Seoul')::date + 1;
  v_d2    date := (now() AT TIME ZONE 'Asia/Seoul')::date + 2;

  v_first    int;
  v_second   int;
  v_cnt      int;
  v_mine     int;
  v_is_uniq  boolean;
  v_pred     text;
  v_n        record;
  v_dup_rejected boolean := false;
BEGIN
  -- ------------------------------------------------------------
  -- 0. seed
  -- ------------------------------------------------------------
  INSERT INTO auth.users (id, email, aud, role, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES
    (v_owner_id, '__sql_fixture_pcg_owner@test.local', 'authenticated', 'authenticated', '', '{"role":"employer"}'::jsonb, '{"name":"PCG_OWNER"}'::jsonb, now(), now()),
    (v_staff_id, '__sql_fixture_pcg_staff@test.local', 'authenticated', 'authenticated', '', '{"role":"staff"}'::jsonb,    '{"name":"PCG_STAFF"}'::jsonb, now(), now());

  INSERT INTO public.users (id, email, name, role, is_active, created_at, updated_at)
  SELECT id, email, 'fixture',
    CASE WHEN id = v_owner_id THEN 'employer'::user_role ELSE 'staff'::user_role END,
    true, now(), now()
  FROM auth.users WHERE id IN (v_owner_id, v_staff_id)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, is_active = EXCLUDED.is_active;

  INSERT INTO public.workspaces (id, name, owner_id, created_at, updated_at)
  VALUES (v_workspace_id, '__sql_fixture_pcg_ws', v_owner_id, now(), now());

  -- ------------------------------------------------------------
  -- A1. 인덱스가 UNIQUE + 부분 인덱스인가
  -- ------------------------------------------------------------
  -- 인덱스가 UNIQUE 가 아니면 ON CONFLICT 가 걸릴 대상이 없어 중복이 **조용히** 들어간다.
  SELECT i.indisunique, pg_get_expr(i.indpred, i.indrelid)
    INTO v_is_uniq, v_pred
    FROM pg_index i
    JOIN pg_class c ON c.oid = i.indexrelid
   WHERE c.relname = 'notifications_posting_capacity_gap_idem';

  IF v_is_uniq IS NULL THEN
    RAISE EXCEPTION 'A1 fail: 멱등 인덱스 notifications_posting_capacity_gap_idem 가 없다';
  END IF;
  IF NOT v_is_uniq THEN
    RAISE EXCEPTION 'A1 fail: 멱등 인덱스가 UNIQUE 가 아니다 — ON CONFLICT 가 아무것도 막지 못한다';
  END IF;
  IF v_pred IS NULL OR v_pred NOT LIKE '%posting_capacity_gap%' THEN
    RAISE EXCEPTION 'A1 fail: 부분 인덱스 조건이 사라졌다 (pred=%) — 다른 알림 타입까지 UNIQUE 가 걸린다', coalesce(v_pred, '(none)');
  END IF;

  -- ------------------------------------------------------------
  -- 1. 공고 생성
  -- ------------------------------------------------------------
  -- A2/A3: D-1 은 2명 필요, D-2 는 1명 필요
  INSERT INTO public.job_postings (id, title, workspace_id, owner_id, status, schedule, created_at, updated_at)
  VALUES (v_jp_gap, '__sql_fixture_pcg_gap', v_workspace_id, v_owner_id, 'active'::posting_status,
    jsonb_build_object('kind','dated','requirements', jsonb_build_array(
      jsonb_build_object('date', to_char(v_d1,'YYYY-MM-DD'), 'timeSlots', jsonb_build_array(
        jsonb_build_object('startTime','19:00','roles', jsonb_build_array(
          jsonb_build_object('role','dealer','count',2))))),
      jsonb_build_object('date', to_char(v_d2,'YYYY-MM-DD'), 'timeSlots', jsonb_build_array(
        jsonb_build_object('startTime','19:00','roles', jsonb_build_array(
          jsonb_build_object('role','dealer','count',1)))))
    )), now(), now());

  -- A4: D-2 에 3명 필요. 노쇼 3형태를 깔아 채움이 0 이 되는지 본다.
  INSERT INTO public.job_postings (id, title, workspace_id, owner_id, status, schedule, created_at, updated_at)
  VALUES (v_jp_ns, '__sql_fixture_pcg_noshow', v_workspace_id, v_owner_id, 'approved'::posting_status,
    jsonb_build_object('kind','dated','requirements', jsonb_build_array(
      jsonb_build_object('date', to_char(v_d2,'YYYY-MM-DD'), 'timeSlots', jsonb_build_array(
        jsonb_build_object('startTime','19:00','roles', jsonb_build_array(
          jsonb_build_object('role','dealer','count',3)))))
    )), now(), now());

  -- A5: 고정 공고 — date 가 날짜가 아니다. 정규식 가드가 없으면 여기서 캐스팅이 죽는다.
  INSERT INTO public.job_postings (id, title, workspace_id, owner_id, status, schedule, created_at, updated_at)
  VALUES (v_jp_fixed, '__sql_fixture_pcg_fixed', v_workspace_id, v_owner_id, 'active'::posting_status,
    jsonb_build_object('kind','fixed','requirements', jsonb_build_array(
      jsonb_build_object('date','FIXED_SCHEDULE','timeSlots', jsonb_build_array(
        jsonb_build_object('startTime','19:00','roles', jsonb_build_array(
          jsonb_build_object('role','dealer','count',9)))))
    )), now(), now());

  -- A6: closed — 미달이어도 알림 대상이 아니다.
  INSERT INTO public.job_postings (id, title, workspace_id, owner_id, status, schedule, created_at, updated_at)
  VALUES (v_jp_closed, '__sql_fixture_pcg_closed', v_workspace_id, v_owner_id, 'closed'::posting_status,
    jsonb_build_object('kind','dated','requirements', jsonb_build_array(
      jsonb_build_object('date', to_char(v_d1,'YYYY-MM-DD'), 'timeSlots', jsonb_build_array(
        jsonb_build_object('startTime','19:00','roles', jsonb_build_array(
          jsonb_build_object('role','dealer','count',5)))))
    )), now(), now());

  -- ------------------------------------------------------------
  -- 2. work_logs — 채움
  -- ------------------------------------------------------------
  -- gap 공고: D-1 에 1명(2 필요 → 1 부족), D-2 에 1명(1 필요 → 충족)
  INSERT INTO public.work_logs (staff_id, job_posting_id, date, status, role, owner_id)
  VALUES
    (v_staff_id, v_jp_gap, to_char(v_d1,'YYYY-MM-DD'), 'scheduled'::work_log_status, 'dealer'::staff_role, v_owner_id),
    (v_staff_id, v_jp_gap, to_char(v_d2,'YYYY-MM-DD'), 'scheduled'::work_log_status, 'dealer'::staff_role, v_owner_id);

  -- noshow 공고: 3행 전부 '채움 아님' 이어야 한다.
  --   ③ 은 status 가 scheduled 인데 no_show_at 만 찍힌 행이다. 좌석 트리거는 이걸 채움으로 세지만
  --      앱(confirmedStaffService.ts:44)은 노쇼로 읽는다. 알림도 앱과 같은 축이어야 한다.
  INSERT INTO public.work_logs (staff_id, job_posting_id, date, status, role, owner_id, no_show_at)
  VALUES
    (v_staff_id, v_jp_ns, to_char(v_d2,'YYYY-MM-DD'), 'cancelled'::work_log_status, 'dealer'::staff_role, v_owner_id, NULL),
    (v_staff_id, v_jp_ns, to_char(v_d2,'YYYY-MM-DD'), 'no_show'::work_log_status,   'dealer'::staff_role, v_owner_id, to_jsonb(now()::text)),
    (v_staff_id, v_jp_ns, to_char(v_d2,'YYYY-MM-DD'), 'scheduled'::work_log_status, 'dealer'::staff_role, v_owner_id, to_jsonb(now()::text));

  -- ------------------------------------------------------------
  -- 3. 1회차 실행
  -- ------------------------------------------------------------
  v_first := public.fn_notify_posting_capacity_gap();

  SELECT count(*)::int INTO v_mine
    FROM public.notifications
   WHERE recipient_id = v_owner_id AND type = 'posting_capacity_gap';

  IF v_mine <> 2 THEN
    RAISE EXCEPTION 'A2 fail: 정원 미달 알림이 %건이다 (기대 2건 — gap 공고 D-1 · noshow 공고 D-2)', v_mine;
  END IF;

  -- A2: D-2 가 충족된 gap 공고에는 D-2 알림이 없어야 한다 (날짜별 판정)
  SELECT count(*)::int INTO v_cnt
    FROM public.notifications
   WHERE recipient_id = v_owner_id AND type = 'posting_capacity_gap'
     AND data ->> 'jobPostingId' = v_jp_gap::text;
  IF v_cnt <> 1 THEN
    RAISE EXCEPTION 'A2 fail: gap 공고 알림이 %건이다 (기대 1건 — D-1 만). 공고 합계로 판정하면 D-2 까지 샌다', v_cnt;
  END IF;

  -- A3: 본문 계약 — D-1
  SELECT * INTO v_n
    FROM public.notifications
   WHERE recipient_id = v_owner_id AND type = 'posting_capacity_gap'
     AND data ->> 'jobPostingId' = v_jp_gap::text;

  IF v_n.data ->> 'workDate' <> to_char(v_d1,'YYYY-MM-DD') THEN
    RAISE EXCEPTION 'A3 fail: workDate 가 % 다 (기대 %)', v_n.data ->> 'workDate', to_char(v_d1,'YYYY-MM-DD');
  END IF;
  IF (v_n.data ->> 'dOffset')::int <> 1 THEN
    RAISE EXCEPTION 'A3 fail: dOffset 이 % 다 (기대 1)', v_n.data ->> 'dOffset';
  END IF;
  IF (v_n.data ->> 'missingCount')::int <> 1 THEN
    RAISE EXCEPTION 'A3 fail: missingCount 가 % 다 (기대 1 — 2명 필요 · 1명 채움)', v_n.data ->> 'missingCount';
  END IF;
  IF v_n.priority <> 'urgent' THEN
    RAISE EXCEPTION 'A3 fail: D-1 priority 가 % 다 (기대 urgent — 하루 전은 마지막 기회다)', v_n.priority;
  END IF;
  IF v_n.category <> 'job'::public.notification_category THEN
    RAISE EXCEPTION 'A3 fail: category 가 % 다 (기대 job)', v_n.category;
  END IF;
  IF v_n.link <> format('/my-postings/%s', v_jp_gap) THEN
    RAISE EXCEPTION 'A3 fail: link 가 % 다 — 구직자 뷰로 보내면 사장이 자리를 채울 수 없다', v_n.link;
  END IF;

  -- A4: 노쇼 3형태가 전부 채움에서 빠졌는가 (missing 이 3 이어야 한다)
  SELECT * INTO v_n
    FROM public.notifications
   WHERE recipient_id = v_owner_id AND type = 'posting_capacity_gap'
     AND data ->> 'jobPostingId' = v_jp_ns::text;

  IF v_n IS NULL THEN
    RAISE EXCEPTION 'A4 fail: 노쇼 공고에 알림이 없다 — 노쇼를 채움으로 세면 거짓 침묵이 된다';
  END IF;
  IF (v_n.data ->> 'missingCount')::int <> 3 THEN
    RAISE EXCEPTION 'A4 fail: missingCount 가 % 다 (기대 3 — cancelled·no_show·no_show_at 셋 다 채움 아님). '
      'no_show_at 만 찍힌 행을 채움으로 세면 여기서 2가 된다', v_n.data ->> 'missingCount';
  END IF;
  IF (v_n.data ->> 'dOffset')::int <> 2 THEN
    RAISE EXCEPTION 'A4 fail: dOffset 이 % 다 (기대 2)', v_n.data ->> 'dOffset';
  END IF;
  IF v_n.priority <> 'high' THEN
    RAISE EXCEPTION 'A4 fail: D-2 priority 가 % 다 (기대 high)', v_n.priority;
  END IF;

  -- A5 / A6: 고정 공고·closed 공고는 알림 대상이 아니다
  SELECT count(*)::int INTO v_cnt
    FROM public.notifications
   WHERE type = 'posting_capacity_gap'
     AND data ->> 'jobPostingId' IN (v_jp_fixed::text, v_jp_closed::text);
  IF v_cnt <> 0 THEN
    RAISE EXCEPTION 'A5/A6 fail: 고정·closed 공고에 알림이 %건 갔다 (기대 0)', v_cnt;
  END IF;

  -- ------------------------------------------------------------
  -- 4. A7. 멱등 — 두 번째 호출
  -- ------------------------------------------------------------
  v_second := public.fn_notify_posting_capacity_gap();

  IF v_second <> 0 THEN
    RAISE EXCEPTION 'A7 fail: 두 번째 호출이 %건을 넣었다 (기대 0). '
      '멱등 인덱스 표현식이 어긋나면 충돌이 안 나서 중복이 조용히 들어간다', v_second;
  END IF;

  SELECT count(*)::int INTO v_cnt
    FROM public.notifications
   WHERE recipient_id = v_owner_id AND type = 'posting_capacity_gap';
  IF v_cnt <> v_mine THEN
    RAISE EXCEPTION 'A7 fail: 재실행 후 알림이 %건 → %건으로 늘었다', v_mine, v_cnt;
  END IF;

  -- ------------------------------------------------------------
  -- 5. A8. 인덱스가 진짜로 거부하는가 (ON CONFLICT 없는 직접 INSERT)
  -- ------------------------------------------------------------
  -- A7 은 "함수가 중복을 안 넣는다"만 보인다. ON CONFLICT 가 삼킨 것인지
  -- 애초에 대상이 없었던 것인지 구분하려면 인덱스를 직접 때려 봐야 한다.
  BEGIN
    INSERT INTO public.notifications (recipient_id, type, category, title, body, link, data, priority)
    VALUES (v_owner_id, 'posting_capacity_gap', 'job'::public.notification_category,
            '중복 시도', '중복 시도', '/x',
            jsonb_build_object(
              'jobPostingId', v_jp_gap,
              'workDate',     to_char(v_d1,'YYYY-MM-DD'),
              'dOffset',      1,
              'missingCount', 1),
            'urgent');
  EXCEPTION
    WHEN unique_violation THEN
      v_dup_rejected := true;
  END;

  IF NOT v_dup_rejected THEN
    RAISE EXCEPTION 'A8 fail: 같은 (공고,근무일,D-offset) 알림이 두 번 들어갔다 — 멱등 인덱스가 실효가 없다';
  END IF;

  -- ------------------------------------------------------------
  -- Cleanup (역순)
  -- ------------------------------------------------------------
  DELETE FROM public.notifications WHERE recipient_id IN (v_owner_id, v_staff_id);
  DELETE FROM public.work_logs WHERE job_posting_id IN (v_jp_gap, v_jp_ns, v_jp_fixed, v_jp_closed);
  DELETE FROM public.job_postings WHERE id IN (v_jp_gap, v_jp_ns, v_jp_fixed, v_jp_closed);
  DELETE FROM public.workspaces WHERE id = v_workspace_id;
  DELETE FROM public.workspaces WHERE owner_id IN (v_owner_id, v_staff_id);
  DELETE FROM auth.users WHERE id IN (v_owner_id, v_staff_id);
END $$;

SELECT pass('POSTING_CAPACITY_GAP_NOTIFICATION_TEST_PASSED');
SELECT * FROM finish();
ROLLBACK;
