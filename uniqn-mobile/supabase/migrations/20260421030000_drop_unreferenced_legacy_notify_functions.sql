-- 레거시 fn_notify_* 함수 본체 DROP (후속 리팩토링 #2)
-- 대상: trigger 0 참조 + 다른 함수 호출 0 참조 확인된 13개
-- 보존: cancellation_request / inquiry_created / review_created / tournament_approval (trigger 보유)
-- 참고: .gstack/qa-reports/LEGACY-TRIGGERS-AUDIT.md
-- 감사 쿼리:
--   SELECT proname FROM pg_proc
--   WHERE proname LIKE 'fn_notify_%' AND pronamespace = 'public'::regnamespace;
--   + 함수 내부 호출 참조(pg_get_functiondef 정규식) 모두 빈 결과 확인

DROP FUNCTION IF EXISTS public.fn_notify_application_status();
DROP FUNCTION IF EXISTS public.fn_notify_application_submitted();
DROP FUNCTION IF EXISTS public.fn_notify_check_in_out();
DROP FUNCTION IF EXISTS public.fn_notify_comment_created();
DROP FUNCTION IF EXISTS public.fn_notify_no_show();
DROP FUNCTION IF EXISTS public.fn_notify_payroll_completed();
DROP FUNCTION IF EXISTS public.fn_notify_post_locked();
DROP FUNCTION IF EXISTS public.fn_notify_posting_cancelled();
DROP FUNCTION IF EXISTS public.fn_notify_posting_closed();
DROP FUNCTION IF EXISTS public.fn_notify_posting_updated();
DROP FUNCTION IF EXISTS public.fn_notify_report_created();
DROP FUNCTION IF EXISTS public.fn_notify_schedule_cancelled();
DROP FUNCTION IF EXISTS public.fn_notify_schedule_created();
