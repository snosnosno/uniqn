-- work_logs timestamptz 전환 Phase D.3 (DESTRUCTIVE)
-- 목표: jsonb 컬럼 + sync trigger + jsonb 오버로드 함수 DROP
-- 사전 조건 (Task 8 검증 완료, 2026-04-21):
--   1. 앱 코드: check_in_time/check_out_time 직접 참조 0건 (RPC response key + generated types 제외)
--   2. DB 함수: fn_sync_work_log_ts 만 참조 (이 migration 에서 함께 DROP)
--   3. 모든 writer/reader 가 check_in_ts/check_out_ts 로 전환됨
-- 참조: docs/superpowers/plans/2026-04-21-worklog-timestamptz-phase-d.md Task 9

-- 1. sync trigger + 함수 DROP
DROP TRIGGER IF EXISTS tr_sync_work_log_ts ON public.work_logs;
DROP FUNCTION IF EXISTS public.fn_sync_work_log_ts();

-- 2. jsonb 오버로드 _fmt_worklog_time(jsonb) DROP (timestamptz 버전만 남김)
DROP FUNCTION IF EXISTS public._fmt_worklog_time(jsonb);

-- 3. jsonb 컬럼 DROP
ALTER TABLE public.work_logs DROP COLUMN check_in_time;
ALTER TABLE public.work_logs DROP COLUMN check_out_time;

COMMENT ON COLUMN public.work_logs.check_in_ts IS
  '출근 시각 (timestamptz). Phase D.3 에서 jsonb check_in_time 제거됨 (2026-04-21).';
COMMENT ON COLUMN public.work_logs.check_out_ts IS
  '퇴근 시각 (timestamptz). Phase D.3 에서 jsonb check_out_time 제거됨 (2026-04-21).';
