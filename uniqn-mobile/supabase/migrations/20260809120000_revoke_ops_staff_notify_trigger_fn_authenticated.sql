-- 트리거 함수 notify_on_ops_staff_insert 의 authenticated EXECUTE 회수 (규약 정렬)
--
-- 배경
--   결함⑦-1(20260809100000)이 이 트리거 함수에 `GRANT EXECUTE ... TO authenticated` 를 걸었다.
--   그 파일의 주석은 정작 "트리거 함수는 직접 호출 대상이 아니다(RETURNS trigger). PUBLIC
--   상속 EXECUTE 를 회수해 ops SECDEF 하드닝 규율과 동일하게 맞춘다" 라고 적혀 있다 —
--   **주석의 의도와 코드가 어긋난 상태로 머지됐다.** 회귀 테스트가 anon 만 단언하고
--   authenticated 를 보지 않아 게이트에도 걸리지 않았다.
--
--   이 레포의 확립된 규약은 20260731090000_revoke_public_execute_trigger_functions.sql 이고,
--   거기서 트리거 전용 함수 33개를 `REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated` 로
--   회수했다. 즉 authenticated 도 회수 대상이다. prod 실측에서도 다른 notify_on_* 트리거
--   함수는 전부 authenticated EXECUTE 가 없다.
--
-- 안전성 근거 (20260731090000 의 근거를 그대로 승계)
--   1. 트리거 함수는 테이블 소유자 권한으로 실행되므로 호출자 role 의 EXECUTE 권한과 무관하다.
--      회수해도 ops_add_staff(SECDEF, owner=postgres) 경로의 트리거 발화는 그대로 동작한다.
--   2. 이미 authenticated 회수 상태인 트리거 함수 33개가 정상 동작 중이라는 것이 실증이다.
--   3. service_role / postgres 의 EXECUTE 는 유지한다(Edge Function·마이그레이션 경로).
--
-- 위험도 (정직하게)
--   권한 상승 경로는 아니었다. prod 실측으로 직접 호출은 엔진이 막는다:
--     SQLSTATE 0A000 / "trigger functions can only be called as triggers".
--   실제 영향은 ① 규약 이탈 ② Supabase 어드바이저
--   `authenticated_security_definer_function_executable` WARN 1건 추가
--   ③ PostgREST 스키마에 호출 불가능한 RPC 가 노출되는 것이다.
--
-- 파리티: 함수 수 변화 없음 → PARITY_EXPECT_FUNCS=208 불변. 정책 111 불변(RLS 미변경).
-- 회귀 고정: supabase/tests/ops_staff_assignment_notify.test.sql [24]

DO $$
BEGIN
  -- 반환형이 trigger 인지 재확인 — 동명의 일반 RPC 를 실수로 잠그지 않도록 방어한다
  -- (20260731090000 과 동일한 방어 패턴).
  IF EXISTS (
    SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      JOIN pg_type t ON t.oid = p.prorettype
     WHERE n.nspname = 'public'
       AND p.proname = 'notify_on_ops_staff_insert'
       AND p.pronargs = 0
       AND t.typname = 'trigger'
  ) THEN
    REVOKE EXECUTE ON FUNCTION public.notify_on_ops_staff_insert()
      FROM PUBLIC, anon, authenticated;
  ELSE
    RAISE WARNING '트리거 함수 아님 또는 미존재 — 건너뜀: public.notify_on_ops_staff_insert()';
  END IF;
END $$;
