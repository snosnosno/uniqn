-- ============================================================
-- 레거시 tr_notify_report_created 트리거 DROP — 신고 알림 중복 발행 차단
-- ============================================================
-- 배경:
--   Phase 2 audit(20260420235202) 에서 work_logs/job_postings/board_posts 의
--   레거시 notify trigger 7개는 DROP 했으나 reports 테이블의
--   tr_notify_report_created 를 누락. 신규 report_notify_insert
--   (notify_on_report_insert, 20260417040000) 와 동시 발동하여 같은 신고에
--   두 건의 알림이 생성됨 (title "🚨 새로운 신고 접수" + "신고 접수",
--   후자는 type label 미매핑으로 raw 값 "false_posting" 노출).
--
-- 정책: Phase 2 계승 — 트리거만 DROP, 함수 본체는 보존.
-- ============================================================

DROP TRIGGER IF EXISTS tr_notify_report_created ON public.reports;

-- 이미 발행된 중복 행 정리 (report_created type 중 신규 report_notify_insert
-- 와 같은 reportId 를 가진 건). 신규 new_report 는 그대로 둡니다.
DELETE FROM public.notifications
WHERE type = 'report_created'
  AND (data ->> 'reportId') IN (
    SELECT DISTINCT data ->> 'reportId'
    FROM public.notifications
    WHERE type = 'new_report'
      AND data ? 'reportId'
  );
