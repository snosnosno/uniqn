-- cron.job_run_details 보존 정책 도입 (로그 무한 누적 차단)
--
-- 배경
--   프로덕션 DB 431MB 중 cron.job_run_details 가 218MB(158,630행)를 차지했다.
--   public 스키마 전체가 4.1MB 인 것과 비교하면 사실상 DB 를 로그가 점유한 상태다.
--   sync-schedule-board-outbox 크론이 매분 실행(주 10,080회)되는데 pg_cron 은
--   실행 이력을 자동으로 지우지 않고, 이 테이블에는 autovacuum 이 한 번도 돈 적이 없다
--   (pg_stat_all_tables.last_autovacuum IS NULL 실측).
--
-- 안전성
--   실행 이력 로그일 뿐 애플리케이션 경로에서 읽지 않는다. 최근 7일치는 남겨
--   크론 장애 조사가 가능하도록 한다.
--   ※ DELETE 는 공간을 즉시 반환하지 않는다. 일회성 VACUUM FULL 은 트랜잭션 안에서
--     실행할 수 없어 이 마이그레이션에 포함하지 않았고, 운영 명령으로 별도 수행한다.

-- 1) 일회성 정리 — 7일 초과 이력 삭제
DELETE FROM cron.job_run_details
WHERE end_time < now() - interval '7 days'
   OR (end_time IS NULL AND start_time < now() - interval '7 days');

-- 2) 매일 보존 정책 실행 (KST 01:30 = UTC 16:30)
--    재적용 시 중복 등록을 막기 위해 기존 잡을 먼저 해제한다.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-cron-run-details') THEN
    PERFORM cron.unschedule('purge-cron-run-details');
  END IF;
END $$;

SELECT cron.schedule(
  'purge-cron-run-details',
  '30 16 * * *',
  $cron$
    DELETE FROM cron.job_run_details
    WHERE end_time < now() - interval '7 days'
       OR (end_time IS NULL AND start_time < now() - interval '7 days');
  $cron$
);
