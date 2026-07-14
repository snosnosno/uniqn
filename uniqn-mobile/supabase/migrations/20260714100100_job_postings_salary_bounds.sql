-- 급여 필터(P3) — 타입별 최대 급여 비정규화 컬럼 3 + 부분 인덱스 + 백필.
-- 급여가 compensation jsonb(shared) + role_catalog jsonb 배열(by_role)에 흩어져 있어
-- 서버 범위필터가 불가하므로 role_keys 와 동일 패턴(쓰기 시 클라이언트 계산 + 1회 백필).
-- max 의미: 해당 타입 급여 행(defaultSalary + role_catalog 전체) 중 최대 금액 —
-- "시급 13,000 이상" = 이 공고에서 그 이상 받을 수 있는 역할이 존재. 'other'(협의)는 NULL 유지.
-- additive nullable, RLS/권한 비관여.

ALTER TABLE public.job_postings
  ADD COLUMN IF NOT EXISTS salary_hourly_max integer,
  ADD COLUMN IF NOT EXISTS salary_daily_max integer,
  ADD COLUMN IF NOT EXISTS salary_monthly_max integer;

COMMENT ON COLUMN public.job_postings.salary_hourly_max IS
  '시급 최대값(원) — defaultSalary+role_catalog GREATEST. 협의(other)만이면 NULL. 쓰기 시 serialization.getSalaryBounds 가 계산';
COMMENT ON COLUMN public.job_postings.salary_daily_max IS
  '일급 최대값(원) — salary_hourly_max 와 동일 계약';
COMMENT ON COLUMN public.job_postings.salary_monthly_max IS
  '월급 최대값(원) — salary_hourly_max 와 동일 계약';

-- 브라우즈 필터 대상 행만 부분 인덱스 (NULL = 협의/미설정 — 필터 활성 시 제외 대상)
CREATE INDEX IF NOT EXISTS idx_job_postings_salary_hourly
  ON public.job_postings (salary_hourly_max)
  WHERE salary_hourly_max IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_job_postings_salary_daily
  ON public.job_postings (salary_daily_max)
  WHERE salary_daily_max IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_job_postings_salary_monthly
  ON public.job_postings (salary_monthly_max)
  WHERE salary_monthly_max IS NOT NULL;

-- 백필: 기존 행의 defaultSalary + role_catalog[].salary 를 타입별 GREATEST 집계.
-- amount 문자열 이력 방어: 빈 문자열 NULLIF + 숫자 형태 정규식 통과분만 캐스팅(비정형 값이
-- 있어도 마이그레이션 전체가 abort 되지 않도록 fail-safe). 0 이하는 무의미 값으로 제외.
WITH salary_rows AS (
  SELECT s.id, s.stype, s.amount::numeric AS amount
  FROM (
    SELECT id,
           compensation -> 'defaultSalary' ->> 'type' AS stype,
           NULLIF(compensation -> 'defaultSalary' ->> 'amount', '') AS amount
    FROM public.job_postings
    UNION ALL
    SELECT p.id,
           r -> 'salary' ->> 'type',
           NULLIF(r -> 'salary' ->> 'amount', '')
    FROM public.job_postings p
         CROSS JOIN LATERAL jsonb_array_elements(
           CASE WHEN jsonb_typeof(p.role_catalog) = 'array' THEN p.role_catalog
                ELSE '[]'::jsonb END) r
  ) s
  WHERE s.stype IN ('hourly', 'daily', 'monthly')
    AND s.amount ~ '^[0-9]+(\.[0-9]+)?$'
    AND s.amount::numeric > 0
),
agg AS (
  SELECT id,
         max(amount) FILTER (WHERE stype = 'hourly')::integer  AS hourly_max,
         max(amount) FILTER (WHERE stype = 'daily')::integer   AS daily_max,
         max(amount) FILTER (WHERE stype = 'monthly')::integer AS monthly_max
  FROM salary_rows
  GROUP BY id
)
UPDATE public.job_postings jp
SET salary_hourly_max  = agg.hourly_max,
    salary_daily_max   = agg.daily_max,
    salary_monthly_max = agg.monthly_max
FROM agg
WHERE agg.id = jp.id;
