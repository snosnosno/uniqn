-- =============================================================================
-- 출퇴근/평가 알림 중복 발송 회귀 가드
-- =============================================================================
-- 사용법:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/worklog_checkinout_notify_single_trigger.test.sql
--   pg_prove 호환: BEGIN/plan/finish/ROLLBACK
--
-- 배경:
--   work_logs UPDATE 시 동일 함수 notify_on_work_log_checkinout_update()를
--   호출하는 트리거가 둘(work_log_notify_checkinout_update + tr_notify_work_log_checkinout)
--   공존하면 한 번의 출퇴근 UPDATE가 알림을 2배 INSERT → 푸시 2건 발송.
--   (마이그레이션 20260620151331에서 구버전 트리거 DROP으로 해소)
--
-- 불변식: 해당 함수를 호출하는 work_logs 트리거는 정확히 1개여야 한다.
-- =============================================================================

BEGIN;
SELECT plan(1);

SELECT is(
  (
    SELECT count(*)::int
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    JOIN pg_proc p ON t.tgfoid = p.oid
    WHERE n.nspname = 'public'
      AND c.relname = 'work_logs'
      AND p.proname = 'notify_on_work_log_checkinout_update'
      AND NOT t.tgisinternal
  ),
  1,
  'work_logs에서 출퇴근 알림 함수를 호출하는 트리거는 정확히 1개 (중복 발송 회귀 가드)'
);

SELECT finish();
ROLLBACK;
