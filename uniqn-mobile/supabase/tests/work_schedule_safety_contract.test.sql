-- 근무표 안전 계약 카탈로그 회귀
-- 실제 행위 테스트는 역할별 통합 fixture에서 수행하고, 이 파일은
-- 감사 표면·권한·트리거가 마이그레이션에서 빠지지 않았는지 빠르게 고정한다.

BEGIN;
SELECT plan(8);

SELECT has_table(
  'public',
  'work_schedule_audit_events',
  '배치 해제 감사 이벤트 테이블이 존재한다'
);
SELECT has_function(
  'public',
  'release_scheduled_assignment(uuid, text)',
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
SELECT has_policy(
  'public',
  'work_schedule_audit_events',
  'work_schedule_audit_events_select_participant',
  '감사 이벤트는 참여자 조회 정책을 가진다'
);
SELECT has_trigger(
  'public',
  'work_logs',
  'tr_work_log_payroll_owner',
  '정산 변경 owner 트리거가 존재한다'
);
SELECT has_trigger(
  'public',
  'work_logs',
  'tr_settled_work_log_lock',
  '정산 완료 잠금 트리거가 존재한다'
);

SELECT * FROM finish();
ROLLBACK;
