-- Legacy notify triggers audit (2026-04-20) — 7개 중복 trigger DROP
-- 상세: .gstack/qa-reports/LEGACY-TRIGGERS-AUDIT.md
-- 보존: tr_notify_cancellation_request (owner 고유 알림), tr_notify_tournament_approval (resubmit 경로 유지)
-- 신규 notify_on_* trigger가 동일 recipient/event/의미를 모두 커버하여 안전하게 DROP

DROP TRIGGER IF EXISTS tr_notify_check_in_out ON public.work_logs;
DROP TRIGGER IF EXISTS tr_notify_no_show ON public.work_logs;
DROP TRIGGER IF EXISTS tr_notify_payroll_completed ON public.work_logs;
DROP TRIGGER IF EXISTS tr_notify_schedule_cancelled ON public.work_logs;
DROP TRIGGER IF EXISTS tr_notify_posting_cancelled ON public.job_postings;
DROP TRIGGER IF EXISTS tr_notify_posting_updated ON public.job_postings;
DROP TRIGGER IF EXISTS tr_notify_post_locked ON public.board_posts;

-- 함수 본체 DROP은 스킵 (다른 경로 참조 가능성 — FIX WINDOW 2A 방침 계승)

-- 기존 중복 notification dedup SQL 불필요:
--   대상 type 쌍(check_in/staff_checked_in, no_show/no_show_alert, settlement_completed,
--   schedule_cancelled, job_posting_cancelled/job_cancelled, job_posting_updated/job_updated,
--   post_locked/board_locked) 모두 WHERE COUNT(*)>1 검증 결과 0 rows 확인됨.
