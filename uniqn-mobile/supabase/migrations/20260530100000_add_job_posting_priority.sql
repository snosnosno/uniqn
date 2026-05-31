-- ⚠️ DRAFT — NOT APPLIED TO PROD. 유료화(monetization flag) ON 이후 적용. Lane D.
--
-- 목적: featured / boost 정렬을 위한 priority 컬럼 + 정렬 인덱스.
--   priority 가 높을수록 목록 상단에 노출(featured/boost). default 0 = 일반 공고.
--   유료 featured 결제(Lane D)가 이 값을 올려 노출 우선순위를 부여한다.
--
-- ⚠️ 이 컬럼은 prod 에 존재하지 않으며, 적용 전까지 getList/active-postings 의
--   orderBy 에 priority 를 넣어서는 안 된다(컬럼 부재로 전 read 실패). 클라 코드의
--   `// TODO(Lane D)` 마커 참조.

ALTER TABLE public.job_postings
  ADD COLUMN IF NOT EXISTS priority integer NOT NULL DEFAULT 0;

-- featured 정렬용 복합 인덱스: priority DESC(상단 노출) → work_date DESC(최신 근무일).
--   목록 쿼리가 `ORDER BY priority DESC, work_date DESC` 일 때 인덱스로 정렬 비용 제거.
CREATE INDEX IF NOT EXISTS idx_job_postings_priority_work_date
  ON public.job_postings (priority DESC, work_date DESC);

COMMENT ON COLUMN public.job_postings.priority IS
  'featured/boost 노출 우선순위. 높을수록 목록 상단. default 0 = 일반. Lane D 유료화 적용 후 활성. (DRAFT)';
