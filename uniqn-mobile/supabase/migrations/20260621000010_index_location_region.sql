-- A4 (region 후속): location->>'region' 부분 인덱스
--
-- 배경: 지역 필터는 getList 에서 `location->>'region' = $slug` 로 적용된다
--   (JobPostingRepository.ts). location 은 jsonb 컬럼이라 인덱스 없이는 seq-scan.
--   현재 공고 수에선 무해하나, 표현식 부분 인덱스를 미리 깔아 둔다.
--
-- 부분 인덱스(WHERE region IS NOT NULL): region 미설정 행은 필터 대상이 아니므로 제외해
--   인덱스 크기를 줄인다. eq 매칭이라 btree 표현식 인덱스로 충분.

CREATE INDEX IF NOT EXISTS idx_job_postings_location_region
  ON public.job_postings ((location->>'region'))
  WHERE location->>'region' IS NOT NULL;
