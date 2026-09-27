-- ============================================================
-- 고정 공고 만료 24시간 전 알림 회귀 가드 (마이그 20260927110000)
-- ============================================================
-- 크론이 **매시** 돌기 때문에 멱등이 깨지면 같은 공고에 알림이 하루 24번 쌓인다 —
-- "성공적으로 여러 번 INSERT" 는 에러가 아니라 로그도 안 남는다. 창 판정이 어긋나면
-- 반대로 알림이 아예 안 가서 공고가 조용히 닫힌다. 손상된 값 한 행이 캐스팅 에러를 내면
-- 배치 전체(=모든 사장의 알림)가 매시 멈춘다.
--
-- 시나리오 (now() 는 트랜잭션 안에서 고정이라 창 경계를 분 단위로 조일 수 있다):
--   B1. 인덱스가 UNIQUE + 부분(partial)
--   B2. 알림 대상 — active 23h55m · active 5h · capacity_full 5h · **같은 만료 시각의 다른 공고**
--       (키에서 jobPostingId 가 빠지면 이 둘 중 하나가 삼켜진다) → 4건
--   B3. 제외 — 24h05m(창 밖) · closed · 이미 지남 · regular 공고(fixed_config 가 있어도)
--   B4. 본문 계약 — category/priority/link/정규화된 data.expiresAt/'7일 연장'
--   B5. 손상 값 — 'not-a-date' · **'2026-02-30T00:00:00Z'(모양만 날짜)** 가 capacity_full 에
--       있어도 배치가 죽지 않는다
--   B6. 멱등 — 두 번째 호출에 내 알림 수 그대로
--   B7. 같은 시각을 다른 표기('+00:00')로 다시 써도 중복이 생기지 않는다(키 정규화)
--   B8. 연장으로 만료 시각이 바뀌면 새 키 — 한 번 더 알린다
--
--   C0. 결함 재현: 옛 재오픈(상태만 active)은 트리거가 같은 UPDATE 에서 즉시 닫는다 · anon 실행 불가
--   C1. renew_fixed_posting 재오픈 — 서버 시각 +7일, active 로 남는다
--   C2. 연장 — 상태 불변, 만료 +7일, createdAt 보존
--   C3. 마감·일반 공고는 연장 0행
--   C4. 남의 공고는 RLS 로 0행
--
-- 안전: BEGIN/ROLLBACK 래핑 + 마커 이메일(__sql_fixture_fpe_*@test.local)
-- ============================================================

BEGIN;
SELECT plan(1);

DO $$
DECLARE
  v_owner_id     uuid := gen_random_uuid();
  v_workspace_id uuid := gen_random_uuid();

  v_jp_edge_in   uuid := gen_random_uuid();  -- 23h55m active   → 알림
  v_jp_soon      uuid := gen_random_uuid();  -- 5h active       → 알림 (B7/B8 대상)
  v_jp_twin      uuid := gen_random_uuid();  -- 5h active, soon 과 같은 만료 문자열 → 알림
  v_jp_full      uuid := gen_random_uuid();  -- 5h capacity_full → 알림
  v_jp_edge_out  uuid := gen_random_uuid();  -- 24h05m          → 없음
  v_jp_closed    uuid := gen_random_uuid();  -- closed          → 없음
  v_jp_past      uuid := gen_random_uuid();  -- -1h             → 없음
  v_jp_regular   uuid := gen_random_uuid();  -- regular         → 없음
  v_jp_garbage   uuid := gen_random_uuid();  -- 'not-a-date'    → 없음, 안 죽음
  v_jp_badday    uuid := gen_random_uuid();  -- '2026-02-30…'   → 없음, 안 죽음

  v_outsider_id  uuid := gen_random_uuid();
  v_rs      record;
  v_rows    int;
  v_status  text;
  v_expect_exp text := to_char((now() + interval '7 days') AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_is_uniq boolean;
  v_pred    text;
  v_mine    int;
  v_ids     uuid[];
  v_n       record;
  v_soon_at timestamptz := now() + interval '5 hours';
  v_fixed_schedule jsonb := jsonb_build_object('kind','fixed','requirements', jsonb_build_array(
      jsonb_build_object('date','FIXED_SCHEDULE','timeSlots', jsonb_build_array(
        jsonb_build_object('startTime','19:00','roles', jsonb_build_array(
          jsonb_build_object('role','dealer','count',1)))))));
  v_dated_schedule jsonb := jsonb_build_object('kind','dated','requirements', jsonb_build_array(
      jsonb_build_object('date', to_char((now() AT TIME ZONE 'Asia/Seoul')::date + 10, 'YYYY-MM-DD'), 'timeSlots', jsonb_build_array(
        jsonb_build_object('startTime','19:00','roles', jsonb_build_array(
          jsonb_build_object('role','dealer','count',1)))))));
BEGIN
  -- ------------------------------------------------------------
  -- 0. seed
  -- ------------------------------------------------------------
  INSERT INTO auth.users (id, email, aud, role, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (v_owner_id, '__sql_fixture_fpe_owner@test.local', 'authenticated', 'authenticated', '', '{"role":"employer"}'::jsonb, '{"name":"FPE_OWNER"}'::jsonb, now(), now());

  INSERT INTO public.users (id, email, name, role, is_active, created_at, updated_at)
  VALUES (v_owner_id, '__sql_fixture_fpe_owner@test.local', 'fixture', 'employer'::user_role, true, now(), now())
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, is_active = EXCLUDED.is_active;

  INSERT INTO auth.users (id, email, aud, role, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (v_outsider_id, '__sql_fixture_fpe_outsider@test.local', 'authenticated', 'authenticated', '', '{"role":"employer"}'::jsonb, '{"name":"FPE_OUT"}'::jsonb, now(), now());
  INSERT INTO public.users (id, email, name, role, is_active, created_at, updated_at)
  VALUES (v_outsider_id, '__sql_fixture_fpe_outsider@test.local', 'fixture', 'employer'::user_role, true, now(), now())
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, is_active = EXCLUDED.is_active;

  INSERT INTO public.workspaces (id, name, owner_id, created_at, updated_at)
  VALUES (v_workspace_id, '__sql_fixture_fpe_ws', v_owner_id, now(), now());

  -- ------------------------------------------------------------
  -- B1. 인덱스가 UNIQUE + 부분 인덱스인가
  -- ------------------------------------------------------------
  SELECT i.indisunique, pg_get_expr(i.indpred, i.indrelid)
    INTO v_is_uniq, v_pred
    FROM pg_index i
    JOIN pg_class c ON c.oid = i.indexrelid
   WHERE c.relname = 'notifications_fixed_posting_expiring_idem';

  IF v_is_uniq IS NULL THEN
    RAISE EXCEPTION 'B1 fail: 멱등 인덱스 notifications_fixed_posting_expiring_idem 가 없다';
  END IF;
  IF NOT v_is_uniq THEN
    RAISE EXCEPTION 'B1 fail: 멱등 인덱스가 UNIQUE 가 아니다 — 매시 크론이 중복을 쌓는다';
  END IF;
  IF v_pred IS NULL OR v_pred NOT LIKE '%fixed_posting_expiring%' THEN
    RAISE EXCEPTION 'B1 fail: 부분 인덱스 조건이 사라졌다 (pred=%)', coalesce(v_pred, '(none)');
  END IF;

  -- ------------------------------------------------------------
  -- 1. 공고 — 만료 시각·상태·유형만 다르게. 만료 문자열은 앱과 같은 ISO 'Z' 형식.
  -- ------------------------------------------------------------
  INSERT INTO public.job_postings (id, title, workspace_id, owner_id, status, posting_type, schedule, fixed_config, created_at, updated_at)
  SELECT id, title, v_workspace_id, v_owner_id, status::posting_status, ptype::posting_type, sched,
         jsonb_build_object('durationDays', 7, 'expiresAt', exp), now(), now()
  FROM (VALUES
    (v_jp_edge_in,  '__fpe_edge_in',  'active',        'fixed',   v_fixed_schedule,
       to_char((now() + interval '23 hours 55 minutes') AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
    (v_jp_soon,     '__fpe_soon',     'active',        'fixed',   v_fixed_schedule,
       to_char(v_soon_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
    (v_jp_twin,     '__fpe_twin',     'active',        'fixed',   v_fixed_schedule,
       to_char(v_soon_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
    (v_jp_full,     '__fpe_full',     'capacity_full', 'fixed',   v_fixed_schedule,
       to_char(v_soon_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
    (v_jp_edge_out, '__fpe_edge_out', 'active',        'fixed',   v_fixed_schedule,
       to_char((now() + interval '24 hours 5 minutes') AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
    (v_jp_closed,   '__fpe_closed',   'closed',        'fixed',   v_fixed_schedule,
       to_char(v_soon_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
    (v_jp_past,     '__fpe_past',     'active',        'fixed',   v_fixed_schedule,
       to_char((now() - interval '1 hour') AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
    (v_jp_regular,  '__fpe_regular',  'active',        'regular', v_dated_schedule,
       to_char(v_soon_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
    (v_jp_garbage,  '__fpe_garbage',  'active',        'fixed',   v_fixed_schedule, 'not-a-date'),
    -- 만료 트리거는 active 의 UPDATE 만 막는다 — capacity_full INSERT 로는 그대로 들어온다.
    (v_jp_badday,   '__fpe_badday',   'capacity_full', 'fixed',   v_fixed_schedule, '2026-02-30T00:00:00.000Z')
  ) AS t(id, title, status, ptype, sched, exp);

  -- ------------------------------------------------------------
  -- 2. 1차 실행 — B2~B5 (손상 값이 있어도 에러 없이 끝나야 한다)
  -- ------------------------------------------------------------
  PERFORM public.fn_notify_fixed_postings_expiring();

  SELECT count(*), array_agg((data ->> 'jobPostingId')::uuid ORDER BY 1)
    INTO v_mine, v_ids
    FROM public.notifications
   WHERE recipient_id = v_owner_id AND type = 'fixed_posting_expiring';

  IF v_mine <> 4 THEN
    RAISE EXCEPTION 'B2/B3 fail: 알림 4건(23h55m·5h·같은 시각 쌍·capacity_full)이어야 한다 (got %, ids=%)', v_mine, v_ids;
  END IF;
  IF NOT (v_ids @> ARRAY[v_jp_edge_in, v_jp_soon, v_jp_twin, v_jp_full]) THEN
    RAISE EXCEPTION 'B2 fail: 알림 대상이 어긋났다 (ids=%)', v_ids;
  END IF;

  SELECT * INTO v_n FROM public.notifications
   WHERE recipient_id = v_owner_id AND type = 'fixed_posting_expiring'
     AND data ->> 'jobPostingId' = v_jp_soon::text;
  IF v_n.category::text <> 'job' OR v_n.priority <> 'high' THEN
    RAISE EXCEPTION 'B4 fail: category/priority 계약 위반 (%/%)', v_n.category, v_n.priority;
  END IF;
  IF v_n.link <> format('/my-postings/%s', v_jp_soon) THEN
    RAISE EXCEPTION 'B4 fail: 목적지는 [7일 연장]이 있는 관리 화면이어야 한다 (%)', v_n.link;
  END IF;
  IF v_n.data ->> 'expiresAt' <> to_char(v_soon_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
     OR v_n.body NOT LIKE '%7일 연장%' THEN
    RAISE EXCEPTION 'B4 fail: 정규화된 data.expiresAt/본문 계약 위반 (data=%, body=%)', v_n.data, v_n.body;
  END IF;

  -- ------------------------------------------------------------
  -- B6. 멱등 — 두 번째 호출에 내 알림 수 그대로
  -- ------------------------------------------------------------
  PERFORM public.fn_notify_fixed_postings_expiring();
  SELECT count(*) INTO v_mine FROM public.notifications
   WHERE recipient_id = v_owner_id AND type = 'fixed_posting_expiring';
  IF v_mine <> 4 THEN
    RAISE EXCEPTION 'B6 fail: 재실행에 중복이 들어갔다 (got %) — 매시 크론이 알림함을 도배한다', v_mine;
  END IF;

  -- ------------------------------------------------------------
  -- B7. 같은 시각의 다른 표기 — 키가 정규화돼 중복이 없어야 한다
  -- ------------------------------------------------------------
  UPDATE public.job_postings
     SET fixed_config = jsonb_set(fixed_config, '{expiresAt}',
       to_jsonb(to_char(v_soon_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"+00:00"')))
   WHERE id = v_jp_soon;

  PERFORM public.fn_notify_fixed_postings_expiring();
  SELECT count(*) INTO v_mine FROM public.notifications
   WHERE recipient_id = v_owner_id AND type = 'fixed_posting_expiring';
  IF v_mine <> 4 THEN
    RAISE EXCEPTION 'B7 fail: 같은 만료 시각의 다른 표기로 중복 알림이 갔다 (got %)', v_mine;
  END IF;

  -- ------------------------------------------------------------
  -- B8. 만료 시각이 바뀌면 새 키 — 한 번 더 알린다
  -- ------------------------------------------------------------
  UPDATE public.job_postings
     SET fixed_config = jsonb_set(fixed_config, '{expiresAt}',
       to_jsonb(to_char((now() + interval '6 hours') AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')))
   WHERE id = v_jp_soon;

  PERFORM public.fn_notify_fixed_postings_expiring();
  SELECT count(*) INTO v_mine FROM public.notifications
   WHERE recipient_id = v_owner_id AND type = 'fixed_posting_expiring';
  IF v_mine <> 5 THEN
    RAISE EXCEPTION 'B8 fail: 만료 시각이 바뀐 뒤 새 알림이 1건 더 있어야 한다 (got %)', v_mine;
  END IF;

  -- ============================================================
  -- C. renew_fixed_posting RPC — 서버 시각 연장·재오픈
  -- ============================================================
  -- C0. 결함 재현 — 상태만 active 로 돌리면(옛 방식) 과거 expiresAt 때문에 **같은 UPDATE 에서**
  --     트리거 tr_fixed_posting_expired 가 곧바로 closed 로 되돌린다.
  UPDATE public.job_postings SET status = 'closed' WHERE id = v_jp_past;
  UPDATE public.job_postings SET status = 'active' WHERE id = v_jp_past;
  SELECT status::text INTO v_status FROM public.job_postings WHERE id = v_jp_past;
  IF v_status <> 'closed' THEN
    RAISE EXCEPTION 'C0 전제 깨짐: 옛 재오픈이 즉시 닫히지 않았다 (status=%) — 트리거 동작이 바뀌었나', v_status;
  END IF;

  IF has_function_privilege('anon', 'public.renew_fixed_posting(uuid, boolean)', 'EXECUTE') THEN
    RAISE EXCEPTION 'C0 fail: anon 이 renew_fixed_posting 을 실행할 수 있다';
  END IF;

  PERFORM jpc_test_set_user(v_owner_id);

  -- C1. 재오픈 — 과거 만료 공고도 서버 시각 +7일로 다시 잡혀 active 로 남는다
  SELECT * INTO v_rs FROM public.renew_fixed_posting(v_jp_past, true);
  IF v_rs.result_status IS DISTINCT FROM 'active' OR v_rs.result_expires_at IS DISTINCT FROM v_expect_exp THEN
    RAISE EXCEPTION 'C1 fail: 재오픈 결과 (status=%, expires=%, expect=%)', v_rs.result_status, v_rs.result_expires_at, v_expect_exp;
  END IF;

  -- C2. 연장 — 게시 중 공고는 상태 그대로, 만료만 +7일 · createdAt 보존
  --     (capacity_full 픽스처는 실제 채운 자리가 없어 좌석 트리거가 UPDATE 때 active 로 되돌리므로
  --      active 공고로 본다 — 상태 불변 여부는 '재오픈이 아니면 status 를 안 바꾼다'로 충분하다)
  SELECT * INTO v_rs FROM public.renew_fixed_posting(v_jp_edge_in, false);
  IF v_rs.result_status IS DISTINCT FROM 'active' OR v_rs.result_expires_at IS DISTINCT FROM v_expect_exp THEN
    RAISE EXCEPTION 'C2 fail: 연장 결과 (status=%, expires=%)', v_rs.result_status, v_rs.result_expires_at;
  END IF;

  -- C3. 연장은 마감 공고·일반 공고를 건드리지 않는다(0행)
  SELECT count(*) INTO v_rows FROM public.renew_fixed_posting(v_jp_closed, false);
  IF v_rows <> 0 THEN RAISE EXCEPTION 'C3 fail: 마감 공고가 연장됐다'; END IF;
  SELECT count(*) INTO v_rows FROM public.renew_fixed_posting(v_jp_regular, false);
  IF v_rows <> 0 THEN RAISE EXCEPTION 'C3 fail: 일반 공고가 연장됐다'; END IF;

  -- C4. 남의 공고 — RLS 가 막아 0행(SECURITY INVOKER)
  PERFORM jpc_test_set_user(v_outsider_id);
  SELECT count(*) INTO v_rows FROM public.renew_fixed_posting(v_jp_twin, false);
  IF v_rows <> 0 THEN RAISE EXCEPTION 'C4 fail: 다른 사장이 남의 공고를 연장했다'; END IF;

  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claims', NULL, true);

  SELECT fixed_config ->> 'createdAt' INTO v_status FROM public.job_postings WHERE id = v_jp_edge_in;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'C2 fail: 연장 뒤 createdAt 이 사라졌다';
  END IF;
  SELECT fixed_config ->> 'expiresAt' INTO v_status FROM public.job_postings WHERE id = v_jp_twin;
  IF v_status = v_expect_exp THEN
    RAISE EXCEPTION 'C4 fail: 남의 공고 만료가 바뀌었다';
  END IF;
END $$;

SELECT pass('고정 공고 만료 예정 알림(B1-B8) + renew_fixed_posting 서버 시각 연장·재오픈·권한(C0-C4)');

SELECT * FROM finish();
ROLLBACK;
