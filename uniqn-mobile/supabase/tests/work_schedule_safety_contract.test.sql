-- 근무표 안전 계약 카탈로그 회귀
-- 실제 행위 테스트는 역할별 통합 fixture에서 수행하고, 이 파일은
-- 감사 표면·권한·트리거가 마이그레이션에서 빠지지 않았는지 빠르게 고정한다.

BEGIN;
SELECT plan(7);

SELECT has_table(
  'public',
  'work_schedule_audit_events',
  '배치 해제 감사 이벤트 테이블이 존재한다'
);
-- 🔑 has_function 의 3번째 인자는 타입 배열이다. `'fn(uuid, text)'` 처럼 괄호째 넘기면
--    그 문자열 전체를 함수 이름으로 찾아 항상 실패한다.
SELECT has_function(
  'public',
  'release_scheduled_assignment',
  ARRAY['uuid', 'text'],
  '출근 전 직접 배치 해제 RPC가 존재한다'
);
SELECT ok(
  has_function_privilege(
    'authenticated',
    'public.release_scheduled_assignment(uuid, text)',
    'EXECUTE'
  ),
  '인증 사용자에게만 배치 해제 RPC 실행 권한이 있다'
);
SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.release_scheduled_assignment(uuid, text)',
    'EXECUTE'
  ),
  '익명 사용자 배치 해제 RPC 실행은 차단된다'
);
SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.remove_direct_staff(uuid)',
    'EXECUTE'
  ),
  '구형 사유 없는 직접 배치 해제 RPC는 앱 역할에서 차단된다'
);
-- 🔑 pgTAP 에는 `has_policy` 가 없다(있는 것은 policies_are·policy_roles_are·policy_cmd_is).
--    없는 함수를 부르면 그 자리에서 죽어 남은 단언이 통째로 실행되지 않는다 —
--    "planned 8 but ran 5" 가 바로 그 증상이었다. pg_policies 직접 조회로 고정한다.
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'work_schedule_audit_events'
      AND policyname = 'work_schedule_audit_events_select_participant'
  ),
  '감사 이벤트는 참여자 조회 정책을 가진다'
);
-- 🔑 이름이 `zz_` 인 것이 계약이다 — 기존 `tr_work_logs_pin_payroll`(RPC 전용 차단)보다
--    뒤에 발화해야 기존 에러 계약을 가로채지 않는다. 마이그 주석 참조.
SELECT has_trigger(
  'public',
  'work_logs',
  'zz_work_log_payroll_owner',
  '정산 변경 owner 트리거가 기존 payroll 차단 트리거 뒤에 존재한다'
);

SELECT * FROM finish();
ROLLBACK;
