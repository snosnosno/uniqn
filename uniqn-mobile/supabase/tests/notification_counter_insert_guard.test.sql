-- ============================================================
-- 알림 미읽음 카운터 INSERT 가드 회귀 테스트
-- ============================================================
-- 목적: 증가(AFTER INSERT)와 감소(AFTER DELETE / AFTER UPDATE OF is_read)의
--   is_read 술어 대칭을 고정한다. 마이그레이션
--   20260731130000_notification_counter_insert_guard.sql 적용 후 실행.
--
-- 시나리오:
--   G1. is_read = false INSERT → 카운터 +1 (정상 경로 보존)
--   G2. is_read = true  INSERT → 카운터 델타 0 (가드 없을 때 +1 이던 결함)
--   G3. is_read = true  INSERT 후 DELETE → 순 델타 0 (누수 없음)
--       가드 없을 때: INSERT 가 +1, DELETE 는 OLD.is_read = true 라 건너뛰어 +1 영구 잔류
--   G4. is_read = NULL INSERT → NOT NULL 위반 (증가만 되고 감소 두 경로가
--       전부 건너뛰던 값이 애초에 들어올 수 없음)
--   G5. 고아 fn_notification_insert_increment 부재
--
-- 하네스: notify_cancellation_recipients.test.sql 과 동일
--   (BEGIN/plan/finish/ROLLBACK, 마커 이메일 __sql_fixture_ncig_*)
-- ============================================================

BEGIN;
SELECT plan(1);

DO $$
DECLARE
  v_uid uuid := gen_random_uuid();
  v_before int;
  v_after int;
  v_null_rejected boolean := false;
BEGIN
  -- seed
  INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (v_uid, '__sql_fixture_ncig_user@test.local', '{"role":"staff"}'::jsonb, '{"name":"NCIG"}'::jsonb, now(), now());

  INSERT INTO public.users (id, email, name, role, is_active, created_at, updated_at)
  VALUES (v_uid, '__sql_fixture_ncig_user@test.local', 'fixture', 'staff'::user_role, true, now(), now())
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, is_active = EXCLUDED.is_active;

  -- G1: is_read = false → +1
  SELECT coalesce((SELECT unread_count FROM public.notification_counters WHERE user_id = v_uid), 0) INTO v_before;
  INSERT INTO public.notifications (recipient_id, type, title, body, is_read)
  VALUES (v_uid, '__sql_fixture_ncig_g1', 'fixture', 'fixture', false);
  SELECT coalesce((SELECT unread_count FROM public.notification_counters WHERE user_id = v_uid), 0) INTO v_after;
  IF v_after - v_before <> 1 THEN
    RAISE EXCEPTION 'G1 fail: 미읽음 INSERT 가 카운터를 올리지 않음 (delta=%)', v_after - v_before;
  END IF;

  -- G2: is_read = true → 델타 0
  SELECT coalesce((SELECT unread_count FROM public.notification_counters WHERE user_id = v_uid), 0) INTO v_before;
  INSERT INTO public.notifications (recipient_id, type, title, body, is_read)
  VALUES (v_uid, '__sql_fixture_ncig_g2', 'fixture', 'fixture', true);
  SELECT coalesce((SELECT unread_count FROM public.notification_counters WHERE user_id = v_uid), 0) INTO v_after;
  IF v_after - v_before <> 0 THEN
    RAISE EXCEPTION 'G2 fail: 읽음 상태 INSERT 가 카운터를 올림 (delta=%) — 증가/감소 술어 비대칭', v_after - v_before;
  END IF;

  -- G3: is_read = true INSERT → DELETE, 순 델타 0
  SELECT coalesce((SELECT unread_count FROM public.notification_counters WHERE user_id = v_uid), 0) INTO v_before;
  INSERT INTO public.notifications (recipient_id, type, title, body, is_read)
  VALUES (v_uid, '__sql_fixture_ncig_g3', 'fixture', 'fixture', true);
  DELETE FROM public.notifications WHERE type = '__sql_fixture_ncig_g3';
  SELECT coalesce((SELECT unread_count FROM public.notification_counters WHERE user_id = v_uid), 0) INTO v_after;
  IF v_after - v_before <> 0 THEN
    RAISE EXCEPTION 'G3 fail: 읽음 INSERT→DELETE 후 카운터 %건 잔류 — 회수 불가 누수', v_after - v_before;
  END IF;

  -- G4: is_read = NULL 은 제약이 거부
  BEGIN
    INSERT INTO public.notifications (recipient_id, type, title, body, is_read)
    VALUES (v_uid, '__sql_fixture_ncig_g4', 'fixture', 'fixture', NULL);
  EXCEPTION WHEN not_null_violation THEN
    v_null_rejected := true;
  END;
  IF NOT v_null_rejected THEN
    RAISE EXCEPTION 'G4 fail: is_read NULL INSERT 가 통과 — NOT NULL 제약 부재';
  END IF;

  -- G5: 고아 함수 부재
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'fn_notification_insert_increment'
  ) THEN
    RAISE EXCEPTION 'G5 fail: 고아 fn_notification_insert_increment 잔존';
  END IF;

  -- Cleanup (역순)
  DELETE FROM public.notifications WHERE recipient_id = v_uid;
  DELETE FROM public.notification_counters WHERE user_id = v_uid;
  -- handle_new_user 가 활성인 스택에서는 auto-workspace 가 생기므로 owner 기준 전체 정리
  DELETE FROM public.workspaces WHERE owner_id = v_uid;
  DELETE FROM auth.users WHERE id = v_uid;
END $$;

SELECT pass('NOTIFICATION_COUNTER_INSERT_GUARD_TEST_PASSED');
SELECT * FROM finish();
ROLLBACK;
