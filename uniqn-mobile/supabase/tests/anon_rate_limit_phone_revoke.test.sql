-- ============================================================
-- 2026-07-10 anon/authenticated 잔존 EXECUTE 회수 회귀 가드
--   (마이그 20260710000000 + 20260710030000)
-- 검증: check_phone_exists 는 anon 회수 + authenticated 유지.
--        check_rate_limit / check_ip_rate_limit 는 anon + authenticated 모두 회수
--        (prod 실측 2026-07-12, baseline 파리티: 형제 함수의 authenticated 까지
--         20260710030000 이 REVOKE).
-- 드리프트 주의: check_rate_limit/check_ip_rate_limit 는 과거 prod-only 였으나 baseline
--   파리티 이후 로컬에도 존재. to_regprocedure() 존재 가드는 보존(미존재 시 skip-pass)
--   하되, 이제 로컬에서도 실효 검증된다.
-- 안전: BEGIN/ROLLBACK.
-- ============================================================
BEGIN;
SELECT plan(6);

-- ── check_phone_exists (로컬·prod 공통 존재) ──────────────────────────────
SELECT ok(
  NOT has_function_privilege('anon', 'public.check_phone_exists(text)', 'EXECUTE'),
  'anon cannot EXECUTE check_phone_exists (hardened 2026-07-10)');
SELECT ok(
  has_function_privilege('authenticated', 'public.check_phone_exists(text)', 'EXECUTE'),
  'authenticated retains EXECUTE on check_phone_exists');

-- ── check_rate_limit (baseline 파리티 이후 로컬 존재: 존재 시 검증, 미존재 시 skip) ──
SELECT CASE
  WHEN to_regprocedure('public.check_rate_limit(text, integer, integer)') IS NULL
    THEN pass('check_rate_limit absent locally — skip anon revoke check')
  ELSE ok(
    NOT has_function_privilege('anon', 'public.check_rate_limit(text, integer, integer)', 'EXECUTE'),
    'anon cannot EXECUTE check_rate_limit (hardened 2026-07-10)')
END;
SELECT CASE
  WHEN to_regprocedure('public.check_rate_limit(text, integer, integer)') IS NULL
    THEN pass('check_rate_limit absent locally — skip authenticated revoke check')
  ELSE ok(
    NOT has_function_privilege('authenticated', 'public.check_rate_limit(text, integer, integer)', 'EXECUTE'),
    'authenticated cannot EXECUTE check_rate_limit (형제 회수 20260710030000)')
END;

-- ── check_ip_rate_limit (baseline 파리티 이후 로컬 존재: 존재 시 검증, 미존재 시 skip) ──
SELECT CASE
  WHEN to_regprocedure('public.check_ip_rate_limit(text, integer, integer)') IS NULL
    THEN pass('check_ip_rate_limit absent locally — skip anon revoke check')
  ELSE ok(
    NOT has_function_privilege('anon', 'public.check_ip_rate_limit(text, integer, integer)', 'EXECUTE'),
    'anon cannot EXECUTE check_ip_rate_limit (hardened 2026-07-10)')
END;
SELECT CASE
  WHEN to_regprocedure('public.check_ip_rate_limit(text, integer, integer)') IS NULL
    THEN pass('check_ip_rate_limit absent locally — skip authenticated revoke check')
  ELSE ok(
    NOT has_function_privilege('authenticated', 'public.check_ip_rate_limit(text, integer, integer)', 'EXECUTE'),
    'authenticated cannot EXECUTE check_ip_rate_limit (형제 회수 20260710030000)')
END;

SELECT * FROM finish();
ROLLBACK;
