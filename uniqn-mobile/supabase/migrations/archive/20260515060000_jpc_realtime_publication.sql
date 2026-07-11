-- Realtime publication ADD TABLE — Phase 4
-- 플랜: docs/superpowers/plans/2026-05-11-job-posting-collaborators.md (Phase 4)
--
-- D9: collaborator 추가/제거 실시간 동기화 — 푸시 알림 받은 직후 my-postings 자동 갱신
-- 메모리 학습: pitfall_realtime_publication_required — 새 테이블 사용 시 publication 등록 필수

ALTER PUBLICATION supabase_realtime ADD TABLE public.job_posting_collaborators;

-- 검증 (마이그레이션 후 수동):
-- SELECT schemaname, tablename FROM pg_publication_tables
-- WHERE pubname = 'supabase_realtime' AND tablename = 'job_posting_collaborators';
