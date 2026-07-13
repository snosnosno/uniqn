-- work_logs timestamptz 전환 Phase A (후속 리팩토링 #5)
-- 목표: check_in_ts / check_out_ts 컬럼 추가 + 기존 row backfill + sync trigger
-- 기존 jsonb 컬럼(check_in_time/check_out_time)은 유지 — Phase B/C/D 에서 코드 이전 후 제거 예정
-- 현재 모든 row가 ISO string format (jsonb 'string' 타입) 확인됨 (2026-04-21 WK-004 정규화 완료 상태)
-- Phase 설계:
--   A (이 migration): DB 신규 컬럼 + sync trigger (기존 앱 코드 영향 0)
--   B: Repository writers dual-write (timestamptz 직접 쓰기)
--   C: Repository readers switch (check_in_ts 우선 읽기)
--   D: 기존 jsonb 컬럼 DROP + rename (destructive, 별도 리뷰 후 진행)

-- 1. 컬럼 추가
ALTER TABLE public.work_logs
  ADD COLUMN IF NOT EXISTS check_in_ts timestamptz,
  ADD COLUMN IF NOT EXISTS check_out_ts timestamptz;

-- 2. 기존 row backfill
UPDATE public.work_logs
SET
  check_in_ts = CASE
    WHEN check_in_time IS NOT NULL AND jsonb_typeof(check_in_time) = 'string'
      THEN (check_in_time #>> '{}')::timestamptz
    ELSE NULL
  END,
  check_out_ts = CASE
    WHEN check_out_time IS NOT NULL AND jsonb_typeof(check_out_time) = 'string'
      THEN (check_out_time #>> '{}')::timestamptz
    ELSE NULL
  END
WHERE check_in_time IS NOT NULL OR check_out_time IS NOT NULL;

-- 3. Sync trigger: jsonb 컬럼 쓰기 시 timestamptz 자동 동기화
-- BEFORE INSERT/UPDATE OF 절 — 기존 writer 코드 수정 없이 신규 컬럼도 유지되므로 앱 호환성 보존
CREATE OR REPLACE FUNCTION public.fn_sync_work_log_ts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.check_in_ts := CASE
    WHEN NEW.check_in_time IS NOT NULL AND jsonb_typeof(NEW.check_in_time) = 'string'
      THEN (NEW.check_in_time #>> '{}')::timestamptz
    ELSE NULL
  END;
  NEW.check_out_ts := CASE
    WHEN NEW.check_out_time IS NOT NULL AND jsonb_typeof(NEW.check_out_time) = 'string'
      THEN (NEW.check_out_time #>> '{}')::timestamptz
    ELSE NULL
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_sync_work_log_ts ON public.work_logs;
CREATE TRIGGER tr_sync_work_log_ts
BEFORE INSERT OR UPDATE OF check_in_time, check_out_time
ON public.work_logs
FOR EACH ROW
EXECUTE FUNCTION public.fn_sync_work_log_ts();

-- 4. 인덱스 — Phase C 에서 읽기 경로 전환 시 쿼리 성능 위해 미리 생성
CREATE INDEX IF NOT EXISTS idx_work_logs_check_in_ts ON public.work_logs(check_in_ts);
CREATE INDEX IF NOT EXISTS idx_work_logs_check_out_ts ON public.work_logs(check_out_ts);
