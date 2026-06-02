-- ============================================================
-- Fix-1a: 결제 도메인 권한 하드닝 (20260602000000_wallet_grants_hardening_p0)
-- anon/authenticated 의 발권·소각·만료·IDOR 직접호출 차단 + 정상 경로 보존 검증.
-- 근거: docs/planning/2026-06-02-monetization-review-findings.md
-- 안전: BEGIN/ROLLBACK (권한 조회만, 변이 없음)
-- ============================================================
BEGIN;
SELECT plan(15);

-- [P0/P1] anon 직접호출 전면 차단
SELECT ok(NOT has_function_privilege('anon', 'public.credit_diamonds_atomically(uuid,integer,text,text)', 'EXECUTE'),
  'anon cannot EXECUTE credit_diamonds_atomically (no anon diamond minting)');
SELECT ok(NOT has_function_privilege('anon', 'public.grant_heart_atomically(uuid,integer,wallet_reason,uuid,integer)', 'EXECUTE'),
  'anon cannot EXECUTE grant_heart_atomically (no anon heart minting)');
SELECT ok(NOT has_function_privilege('anon', 'public.fn_expire_heart_lots()', 'EXECUTE'),
  'anon cannot EXECUTE fn_expire_heart_lots');
SELECT ok(NOT has_function_privilege('anon', 'public.get_wallet_summary(uuid)', 'EXECUTE'),
  'anon cannot EXECUTE get_wallet_summary (IDOR closed)');
SELECT ok(NOT has_function_privilege('anon', 'public.consume_diamonds_atomically(uuid,integer,wallet_reason,uuid,text)', 'EXECUTE'),
  'anon cannot EXECUTE consume_diamonds_atomically');
SELECT ok(NOT has_function_privilege('anon', 'public.claim_daily_attendance()', 'EXECUTE'),
  'anon cannot EXECUTE claim_daily_attendance');

-- [P0/P1] authenticated 직접호출 차단 (발권/소각/만료는 래퍼·cron·service_role 전용)
SELECT ok(NOT has_function_privilege('authenticated', 'public.credit_diamonds_atomically(uuid,integer,text,text)', 'EXECUTE'),
  'authenticated cannot EXECUTE credit_diamonds_atomically');
SELECT ok(NOT has_function_privilege('authenticated', 'public.grant_heart_atomically(uuid,integer,wallet_reason,uuid,integer)', 'EXECUTE'),
  'authenticated cannot EXECUTE grant_heart_atomically');
SELECT ok(NOT has_function_privilege('authenticated', 'public.consume_diamonds_atomically(uuid,integer,wallet_reason,uuid,text)', 'EXECUTE'),
  'authenticated cannot EXECUTE consume_diamonds_atomically directly (wrapper-only)');
SELECT ok(NOT has_function_privilege('authenticated', 'public.fn_expire_heart_lots()', 'EXECUTE'),
  'authenticated cannot EXECUTE fn_expire_heart_lots');

-- 정상 경로 보존: authenticated 본인 잔액조회/출석/공고생성은 유지
SELECT ok(has_function_privilege('authenticated', 'public.get_wallet_summary(uuid)', 'EXECUTE'),
  'authenticated CAN EXECUTE get_wallet_summary (own balance preserved)');
SELECT ok(has_function_privilege('authenticated', 'public.claim_daily_attendance()', 'EXECUTE'),
  'authenticated CAN EXECUTE claim_daily_attendance (own attendance preserved)');
SELECT ok(has_function_privilege('authenticated', 'public.create_job_posting_with_payment_atomically(uuid,jsonb,wallet_reason)', 'EXECUTE'),
  'authenticated CAN EXECUTE create_job_posting_with_payment (posting creation preserved)');

-- service_role(webhook/cron/backend) 는 발권 함수 유지
SELECT ok(has_function_privilege('service_role', 'public.credit_diamonds_atomically(uuid,integer,text,text)', 'EXECUTE'),
  'service_role CAN EXECUTE credit_diamonds_atomically (webhook credit preserved)');
SELECT ok(has_function_privilege('service_role', 'public.grant_heart_atomically(uuid,integer,wallet_reason,uuid,integer)', 'EXECUTE'),
  'service_role CAN EXECUTE grant_heart_atomically');

SELECT * FROM finish();
ROLLBACK;
