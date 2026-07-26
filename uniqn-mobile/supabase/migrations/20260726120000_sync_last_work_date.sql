-- last_work_date 동기화 트리거 + 백필
--
-- 문제: job_postings.last_work_date 컬럼은 baseline 부터 존재하고 크론
--   `expire-by-last-work-date`(jobid 13, 매일 15:17 UTC)가 이 컬럼을 읽어 근무일이
--   지난 공고를 자동 마감하도록 설계돼 있는데, **이 컬럼에 값을 쓰는 코드가 어디에도
--   없다**(클라이언트·Edge Function·트리거 전부). prod 실측 결과 32행 전부 NULL 이고
--   크론은 `last_work_date IS NOT NULL` 가드에 걸려 매일 0건을 닫아 왔다.
--   그 결과 브라우즈 가능한 25건 중 16건이 모든 근무일이 지난 공고로 남아 있다.
--
-- 해결: work_dates 배열의 최대 날짜를 last_work_date 로 동기화하는 BEFORE 트리거를
--   달고 기존 행을 백필한다. 이것만으로 죽어 있던 자동 마감이 되살아난다.
--
-- 사전 검증(적용 전 prod 실측):
--   - job_postings 기존 트리거 10종 중 last_work_date 를 건드리는 것 없음 → 중복 아님
--   - enforce_jp_status_transition 은 'cancelled' 전환만 막음 → 크론의 active→closed 통과
--   - notify_on_job_posting_update 의 변경필드 목록에 last_work_date 가 없어
--     백필 UPDATE 는 '공고 수정' 알림을 발생시키지 않는다(빈 배열 → early return)
--   - fn_fixed_posting_expired 가 백필 UPDATE 를 틈타 상태를 뒤집을 fixed 공고: 0건
--   - 백필 대상 28행 / NULL 유지 4행 / 백필 후 크론이 닫을 공고 10건
--     (사장 알림 2명, 지원자 알림 1명)

-- ── 1) 동기화 함수 ──────────────────────────────────────────────────────────
-- SECURITY INVOKER: NEW 값 계산만 하므로 권한 승격이 필요 없다(최소 권한 원칙).
CREATE OR REPLACE FUNCTION public.fn_sync_last_work_date()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- work_dates 는 text[] 다. 형식이 깨진 값이 섞여도 캐스팅 예외로 INSERT 전체가
  -- 실패하지 않도록 YYYY-MM-DD 인 원소만 취한다(없으면 NULL → 크론이 건너뜀).
  NEW.last_work_date := (
    SELECT max(d::date)
    FROM unnest(coalesce(NEW.work_dates, ARRAY[]::text[])) AS d
    WHERE d ~ '^\d{4}-\d{2}-\d{2}$'
  );
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_sync_last_work_date() IS
  'work_dates 최대 날짜를 last_work_date 로 동기화. 자동 마감 크론(fn_expire_by_last_work_date)의 입력을 채운다.';

-- ── 2) 트리거 ───────────────────────────────────────────────────────────────
-- UPDATE OF work_dates: 근무일이 안 바뀐 UPDATE 는 재계산하지 않는다(불필요한 쓰기 회피).
DROP TRIGGER IF EXISTS tr_job_postings_sync_last_work_date ON public.job_postings;
CREATE TRIGGER tr_job_postings_sync_last_work_date
  BEFORE INSERT OR UPDATE OF work_dates ON public.job_postings
  FOR EACH ROW EXECUTE FUNCTION public.fn_sync_last_work_date();

-- ── 3) 백필 ────────────────────────────────────────────────────────────────
-- 값이 실제로 달라지는 행만 건드린다(IS DISTINCT FROM) — updated_at 오염 최소화.
UPDATE public.job_postings jp
SET last_work_date = calc.lwd
FROM (
  SELECT id,
         (SELECT max(d::date)
            FROM unnest(coalesce(work_dates, ARRAY[]::text[])) AS d
           WHERE d ~ '^\d{4}-\d{2}-\d{2}$') AS lwd
  FROM public.job_postings
) AS calc
WHERE jp.id = calc.id
  AND jp.last_work_date IS DISTINCT FROM calc.lwd;
