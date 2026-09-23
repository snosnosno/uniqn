-- ============================================================
-- 핵심 퍼널 이벤트 + 관리자 DAU RPC 회귀 테스트
-- ============================================================
-- 목적: 마이그레이션 20260923100000_analytics_core_funnel_events_and_dau.sql 의 계약을 고정한다.
--
-- 🚨 이 파일이 존재하는 이유
--   마이그레이션 안의 스모크는 적용 시점 한 번뿐이다. 이후 어떤 마이그레이션이 화이트리스트를
--   되돌리거나 DAU 함수의 게이트를 풀어도 그 스모크는 다시 돌지 않는다.
--   특히 DAU 는 "0 이 나온다"가 정상 값과 구분되지 않는다 — 집계가 조용히 깨져도 화면은
--   그럴듯한 0 을 그린다(이 마이그가 고친 결함 자체가 그 형태였다). 그래서 값까지 단언한다.
--
-- 시나리오:
--   F1. 핵심 퍼널 8종이 인증 경로로 INSERT 된다
--   F2. anon 은 핵심 퍼널을 넣을 수 없다 (ae_anon_insert 가 넓어지지 않음)
--   F3. 기존 이벤트(app_session_start·공유 짝)가 밀려나지 않았다
--   D1. admin 은 연속 날짜를 받고, 활동한 날만 고유 사용자 수가 찬다 (같은 사용자 2행 = 1)
--   D2. 범위 밖(과거) 행은 세지 않는다
--   D3. 비관리자 인증 사용자는 거부된다 (P0001)
--   D4. p_days 범위 밖은 거부된다 (22023)
--   D5. anon EXECUTE 권한이 없다
-- ============================================================

BEGIN;
SELECT plan(1);

DO $$
DECLARE
  v_u1 uuid := gen_random_uuid();
  v_u2 uuid := gen_random_uuid();
  v_admin uuid := gen_random_uuid();
  v_event text;
  v_rejected boolean;
  v_rows int;
  v_today_count int;
  v_nonzero_days int;
  v_old_count int;
BEGIN
  -- 테스트 격리: 트랜잭션 안의 기존 행이 DAU 값을 오염시키지 않도록 비운다(ROLLBACK 으로 복원).
  DELETE FROM public.analytics_events;

  -- F1: 핵심 퍼널 8종 — u1 이 전부 남긴다(오늘 2행 이상 = DAU 1)
  PERFORM jpc_test_set_user(v_u1);
  FOREACH v_event IN ARRAY ARRAY[
    'signup', 'login', 'job_view', 'job_apply',
    'job_create', 'check_in', 'check_out', 'settlement_complete'
  ] LOOP
    BEGIN
      INSERT INTO public.analytics_events (event, props) VALUES (v_event, '{}'::jsonb);
    EXCEPTION WHEN check_violation THEN
      RAISE EXCEPTION 'F1 fail: 핵심 퍼널 % 가 화이트리스트에 없다', v_event;
    END;
  END LOOP;

  -- F3: 기존 이벤트 보존
  FOREACH v_event IN ARRAY ARRAY['app_session_start', 'job_share_created', 'job_share_opened', 'ops_hub_entered'] LOOP
    BEGIN
      INSERT INTO public.analytics_events (event, props) VALUES (v_event, '{}'::jsonb);
    EXCEPTION WHEN check_violation THEN
      RAISE EXCEPTION 'F3 fail: 기존 이벤트 % 가 화이트리스트에서 밀려났다', v_event;
    END;
  END LOOP;

  -- u2 도 오늘 활동 1건 → 오늘 DAU = 2
  PERFORM jpc_test_set_user(v_u2);
  INSERT INTO public.analytics_events (event, props) VALUES ('login', '{"method":"email"}'::jsonb);

  -- F2: anon 은 핵심 퍼널을 못 넣는다 — tk 를 실어 가드는 통과시키고 RLS 만 본다
  PERFORM jpc_test_set_anon();
  v_rejected := false;
  BEGIN
    INSERT INTO public.analytics_events (event, props) VALUES ('login', '{"tk":"abcd1234"}'::jsonb);
  EXCEPTION WHEN insufficient_privilege THEN
    v_rejected := true;
  END;
  IF NOT v_rejected THEN
    RAISE EXCEPTION 'F2 fail: anon 이 login 이벤트를 넣었다 — ae_anon_insert 가 넓어졌다';
  END IF;

  -- D2 준비: u2 의 과거 행(40일 전) — 트리거가 created_at 을 now() 로 덮으므로 신뢰 컨텍스트에서 되돌린다
  PERFORM jpc_test_clear_user();
  PERFORM set_config('role', 'postgres', true);
  UPDATE public.analytics_events
     SET created_at = now() - interval '40 days'
   WHERE user_id = v_u2;
  -- 오늘 u2 활동을 다시 1건 (위 UPDATE 로 옮겨 갔으므로). 가드는 auth.uid() 가 NULL 이면
  -- 익명 경로로 판정해 tk 를 요구하므로, 신뢰 컨텍스트가 아니라 인증 경로로 넣는다.
  PERFORM jpc_test_set_user(v_u2);
  INSERT INTO public.analytics_events (event, props) VALUES ('job_view', '{}'::jsonb);

  -- D1 / D2: admin 조회
  PERFORM jpc_test_set_user_with_role(v_admin, 'admin');

  SELECT count(*), max(active_users) FILTER (WHERE activity_date = (now() AT TIME ZONE 'Asia/Seoul')::date),
         count(*) FILTER (WHERE active_users > 0)
    INTO v_rows, v_today_count, v_nonzero_days
    FROM public.get_admin_daily_active_users(7, 'Asia/Seoul');

  IF v_rows <> 7 THEN
    RAISE EXCEPTION 'D1 fail: 7일 요청에 %행 — 빈 날도 0 으로 채운 연속 날짜여야 한다', v_rows;
  END IF;
  IF v_today_count IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'D1 fail: 오늘 DAU 가 % — u1(12행)·u2(1행) 고유 사용자 2 여야 한다', v_today_count;
  END IF;
  IF v_nonzero_days <> 1 THEN
    RAISE EXCEPTION 'D2 fail: 활동일이 %일 — 40일 전 행이 7일 범위에 섞였다', v_nonzero_days;
  END IF;

  SELECT sum(active_users) INTO v_old_count FROM public.get_admin_daily_active_users(60, 'Asia/Seoul');
  IF v_old_count <> 3 THEN
    RAISE EXCEPTION 'D2 fail: 60일 합계 % — 오늘 2 + 40일 전 1 = 3 이어야 한다', v_old_count;
  END IF;

  -- D4: 범위 밖 p_days
  v_rejected := false;
  BEGIN
    PERFORM * FROM public.get_admin_daily_active_users(91);
  EXCEPTION WHEN invalid_parameter_value THEN
    v_rejected := true;
  END;
  IF NOT v_rejected THEN
    RAISE EXCEPTION 'D4 fail: p_days=91 이 통과했다';
  END IF;

  -- D3: 비관리자 거부
  PERFORM jpc_test_set_user(v_u1);
  v_rejected := false;
  BEGIN
    PERFORM * FROM public.get_admin_daily_active_users(7);
  EXCEPTION WHEN raise_exception THEN
    v_rejected := true;
  END;
  IF NOT v_rejected THEN
    RAISE EXCEPTION 'D3 fail: 비관리자가 DAU 를 조회했다 — admin 게이트가 풀렸다';
  END IF;

  -- D5: anon EXECUTE 없음
  PERFORM jpc_test_clear_user();
  PERFORM set_config('role', 'postgres', true);
  IF has_function_privilege('anon', 'public.get_admin_daily_active_users(integer, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'D5 fail: anon 이 get_admin_daily_active_users 를 실행할 수 있다';
  END IF;
END;
$$;

SELECT pass('핵심 퍼널·DAU 계약 (F1 8종 기록 · F2 anon 차단 · F3 기존 보존 · D1 연속·고유 · D2 범위 · D3 게이트 · D4 인자 · D5 anon)');

SELECT * FROM finish();
ROLLBACK;
