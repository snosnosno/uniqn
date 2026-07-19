-- =============================================================================
-- job_postings 를 supabase_realtime publication 에 추가
-- =============================================================================
--
-- 배경:
--   useJobDetail(id, { realtime: true }) 이 job_postings 를 구독하지만
--   (app/(employer)/my-postings/[id]/_layout.tsx, .../index.tsx),
--   job_postings 는 publication 에 등록되어 있지 않아 변경 이벤트가 영원히
--   도달하지 않는다. 초기 1회 fetch + 별도 useQuery 덕분에 화면은 정상
--   표시되므로 에러도 경고도 없이 "라이브 갱신만 조용히 안 되는" 상태였다.
--
-- 효과:
--   협업자/공동 소유자가 다른 기기에서 공고를 수정·마감·삭제하면
--   공고 상세 화면이 즉시 반영된다.
--
-- 참고:
--   20260710000003_baseline_platform_glue.sql 의 16테이블 등록과 동일한
--   멱등 패턴. 이미 등록돼 있으면 아무 것도 하지 않는다.
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'job_postings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.job_postings;
  END IF;
EXCEPTION
  WHEN undefined_object THEN
    RAISE WARNING '[realtime] supabase_realtime publication 부재 — skip';
END $$;
