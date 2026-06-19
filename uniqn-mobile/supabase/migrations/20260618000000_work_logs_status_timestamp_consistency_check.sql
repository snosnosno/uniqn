-- 종결 status(checked_in/checked_out/completed)는 반드시 타임스탬프를 동반해야 한다.
-- 정산 게이트가 check_in_ts/check_out_ts 로 판정하므로 status 와 정합 필수.
-- (수동 상태변경이 status 만 쓰던 P1-3 버그 클래스 재발을 DB 레벨에서 차단)
-- scheduled / cancelled / no_show 는 타임스탬프 불요.
--
-- prod 적용: 2026-06-18 (위반 0건, 백필 불요, MCP apply_migration). convalidated=true 확인.

ALTER TABLE public.work_logs
  DROP CONSTRAINT IF EXISTS work_logs_status_timestamp_consistency;

ALTER TABLE public.work_logs
  ADD CONSTRAINT work_logs_status_timestamp_consistency
  CHECK (
    CASE
      WHEN status = 'checked_in'
        THEN check_in_ts IS NOT NULL
      WHEN status IN ('checked_out', 'completed')
        THEN check_in_ts IS NOT NULL AND check_out_ts IS NOT NULL
      ELSE true
    END
  );
