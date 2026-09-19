-- ============================================================
-- 롤아웃 계기판 이벤트 회귀 테스트 (감사 testgap-01)
-- ============================================================
-- 목적: `app_session_start` 가 analytics_events 화이트리스트에 살아 있고,
--   기존 6개 ops 퍼널 이벤트를 하나도 밀어내지 않았음을 고정한다.
--   마이그레이션 20260811100000_analytics_app_session_start_event.sql 적용 후 실행.
--
-- 🚨 이 파일이 존재하는 이유
--   CHECK 제약을 이름으로 짚어 교체하면, 이름이 어긋났을 때 DROP 이 조용히 지나가고
--   ADD 가 제약을 하나 더 만들어 **둘이 AND 로 묶인다**. 그러면 새 값은 여전히 거부되는데
--   마이그레이션은 성공으로 보인다. 마이그레이션 안에도 단언을 넣었지만, 그건 적용 시점
--   한 번뿐이다 — 이후의 어떤 마이그레이션이 화이트리스트를 되돌려도 잡히지 않는다.
--
-- 시나리오:
--   A1. app_session_start 실제 INSERT 가 통과한다 (CHECK 통과 + 트리거 캐노니컬라이즈)
--   A2. 기존 6개 ops 이벤트가 전부 살아 있다 (교체 과정에서 밀려나지 않음)
--   A3. 화이트리스트 밖 값은 여전히 거부된다 (제약이 느슨해지지 않음)
--   A4. event 화이트리스트 CHECK 이 정확히 1개다 (AND 결합 없음)
-- ============================================================

BEGIN;
SELECT plan(1);

DO $$
DECLARE
  v_uid uuid := gen_random_uuid();
  v_check_count int;
  v_inserted int;
  v_event text;
  v_rejected boolean := false;
BEGIN
  -- seed — analytics_events 의 BEFORE INSERT 가드는 auth.uid() 가 NULL 이면 **익명 경로**로
  -- 판정해 props.tk 를 강제한다. 실제 app_session_start 는 로그인 세션에서만 나가므로
  -- (AuthenticatedRuntime 은 isAuthenticated 일 때만 마운트된다) JWT 컨텍스트를 주입해
  -- 프로덕션과 같은 인증 경로로 검증한다. GUC 직접 조작 금지 — 헬퍼 경유가 규약이다.
  INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (v_uid, '__sql_fixture_ass_user@test.local', '{"role":"staff"}'::jsonb, '{"name":"ASS"}'::jsonb, now(), now());

  INSERT INTO public.users (id, email, name, role, is_active, created_at, updated_at)
  VALUES (v_uid, '__sql_fixture_ass_user@test.local', 'fixture', 'staff'::user_role, true, now(), now())
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;

  -- A4: event 화이트리스트 CHECK 이 정확히 1개 (둘로 갈리면 AND 결합으로 새 값이 막힌다)
  SELECT count(*) INTO v_check_count
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
   WHERE nsp.nspname = 'public'
     AND rel.relname = 'analytics_events'
     AND con.contype = 'c'
     AND pg_get_constraintdef(con.oid) LIKE '%ops_hub_impression%';

  IF v_check_count <> 1 THEN
    RAISE EXCEPTION 'A4 fail: event 화이트리스트 CHECK 이 %개다 (1개여야 한다 — 여러 개면 AND 로 묶여 새 값이 조용히 막힌다)', v_check_count;
  END IF;

  PERFORM jpc_test_set_user(v_uid);

  -- A1: 롤아웃 계기판 이벤트가 실제로 들어간다 (인증 사용자 경로)
  INSERT INTO public.analytics_events (event, props)
  VALUES ('app_session_start',
          '{"v":"1.0.6","build":"12","rt":"1.0.6","platform":"ios","ota":"embedded","channel":"production"}'::jsonb);

  -- A2: 기존 6개 ops 퍼널 이벤트가 전부 살아 있다
  FOREACH v_event IN ARRAY ARRAY[
    'ops_hub_impression',
    'ops_hub_entered',
    'ops_tournament_created',
    'ops_public_view_opened',
    'ops_claim_converted',
    'ops_limit_reached'
  ] LOOP
    BEGIN
      INSERT INTO public.analytics_events (event, props) VALUES (v_event, '{}'::jsonb);
    EXCEPTION WHEN check_violation THEN
      RAISE EXCEPTION 'A2 fail: 기존 이벤트 % 가 화이트리스트에서 밀려났다', v_event;
    END;
  END LOOP;

  -- A3: 화이트리스트 밖 값은 여전히 거부된다
  BEGIN
    INSERT INTO public.analytics_events (event, props)
    VALUES ('__sql_fixture_ass_not_allowed', '{}'::jsonb);
  EXCEPTION WHEN check_violation THEN
    v_rejected := true;
  END;

  IF NOT v_rejected THEN
    RAISE EXCEPTION 'A3 fail: 화이트리스트 밖 이벤트가 통과했다 — 제약이 느슨해졌다';
  END IF;

  -- 조회는 admin 전용 정책이라 인증 컨텍스트로는 0건이 나온다.
  -- 신뢰 컨텍스트로 돌아와서 센다 — "0건 = 차단"으로 오독하지 않기 위해서다.
  PERFORM jpc_test_clear_user();
  PERFORM set_config('role', 'postgres', true);

  SELECT count(*) INTO v_inserted
    FROM public.analytics_events
   WHERE event = 'app_session_start' AND props->>'v' = '1.0.6';

  IF v_inserted <> 1 THEN
    RAISE EXCEPTION 'A1 fail: app_session_start 가 기록되지 않았다 (count=%)', v_inserted;
  END IF;
END;
$$;

SELECT pass('app_session_start 화이트리스트 계약 (A1 기록 · A2 기존 6종 보존 · A3 밖 거부 · A4 CHECK 단일)');

SELECT * FROM finish();
ROLLBACK;
