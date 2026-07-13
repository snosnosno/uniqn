-- =============================================================================
-- board_reports UPDATE RLS 갭 복구 — admin 신고 처리 (reports.rep_update 대칭)
-- =============================================================================
-- 근본원인(2026-07-13, prod 라이브 실측 + baseline 파리티가 노출):
--   public.board_reports 에 UPDATE 정책이 전혀 없어(brep_insert/brep_select 2개뿐)
--   admin 의 게시판 신고 처리(BoardRepositoryOperations.executeReviewReport 의
--   `.from('board_reports').update({status})`)가 RLS 로 매치 0행 → 조용히 no-op.
--   supabase-js 는 0-rows 를 에러로 안 봐서 "게시판 신고를 처리했습니다" 토스트는 뜨나
--   status 는 pending 그대로 → 상세페이지 "처리 상태: 해결" 미표시(e2e admin-board-reports:155).
--
-- 왜 baseline 이 노출했나: master(마이그 replay)에는 base_schema 의 고아 정책
--   board_reports_update_admin 이 살아있어 거짓 GREEN 이었다. prod 는 그 정책이
--   (마이그 이력 밖에서) 제거된 상태 = 실제 admin 신고처리가 prod 에서 깨져 있었음.
--   baseline squash 가 prod 를 정직히 재현하며 이 실결함을 드러냈다.
--
-- 대칭 근거: public.reports(일반 신고)에는 rep_update(FOR UPDATE USING
--   get_my_role()='admin')가 이미 존재. board_reports 만 누락 = 비대칭 갭.
--   DELETE 는 reports/board_reports 양쪽 다 정책 없음(신고는 처리만·삭제 안 함,
--   앱 코드도 board_reports delete 호출 0건) → brep_update 하나만 신설.
--
-- 적용: prod = MCP apply_migration + red-green(정책 0→1·admin UPDATE 0→1행 실증) /
--        로컬 = db reset. WITH CHECK 는 rep_update 와 동일하게 생략(USING 이 both 적용).
-- 파리티: prod·repo 동시 반영 → 정책 카운트 103→104(가드 기대값 동시 갱신).

DROP POLICY IF EXISTS brep_update ON public.board_reports;
CREATE POLICY brep_update ON public.board_reports
  FOR UPDATE
  USING ((SELECT public.get_my_role()) = 'admin'::text);
