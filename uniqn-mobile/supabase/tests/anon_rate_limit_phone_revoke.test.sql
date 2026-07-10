-- ============================================================
-- 2026-07-10 anon 잔존 EXECUTE 회수 회귀 가드
--   (마이그 20260710000000)
-- 검증: check_rate_limit / check_ip_rate_limit / check_phone_exists 의
--        anon EXECUTE 회수 + authenticated 유지.
-- 드리프트 주의: check_rate_limit/check_ip_rate_limit 는 prod-only 라 로컬(레포 빌드)
--   에는 미존재. to_regprocedure() 로 존재 가드 → 미존재 시 pass(skip) 로 대체하여
--   has_function_privilege 의 미존재-함수 ERROR 및 파일 전체 실패를 방지.
--   → 로컬 CI 는 check_phone_exists 만 실효 검증, prod 는 3개 전부 검증.
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

-- ── check_rate_limit (prod-only: 존재 시 검증, 미존재 시 skip-pass) ────────
SELECT CASE
  WHEN to_regprocedure('public.check_rate_limit(text, integer, integer)') IS NULL
    THEN pass('check_rate_limit absent locally (prod-only) — skip anon revoke check')
  ELSE ok(
    NOT has_function_privilege('anon', 'public.check_rate_limit(text, integer, integer)', 'EXECUTE'),
    'anon cannot EXECUTE check_rate_limit (hardened 2026-07-10)')
END;
SELECT CASE
  WHEN to_regprocedure('public.check_rate_limit(text, integer, integer)') IS NULL
    THEN pass('check_rate_limit absent locally — skip authenticated retention check')
  ELSE ok(
    has_function_privilege('authenticated', 'public.check_rate_limit(text, integer, integer)', 'EXECUTE'),
    'authenticated retains EXECUTE on check_rate_limit')
END;

-- ── check_ip_rate_limit (prod-only: 존재 시 검증, 미존재 시 skip-pass) ─────
SELECT CASE
  WHEN to_regprocedure('public.check_ip_rate_limit(text, integer, integer)') IS NULL
    THEN pass('check_ip_rate_limit absent locally (prod-only) — skip anon revoke check')
  ELSE ok(
    NOT has_function_privilege('anon', 'public.check_ip_rate_limit(text, integer, integer)', 'EXECUTE'),
    'anon cannot EXECUTE check_ip_rate_limit (hardened 2026-07-10)')
END;
SELECT CASE
  WHEN to_regprocedure('public.check_ip_rate_limit(text, integer, integer)') IS NULL
    THEN pass('check_ip_rate_limit absent locally — skip authenticated retention check')
  ELSE ok(
    has_function_privilege('authenticated', 'public.check_ip_rate_limit(text, integer, integer)', 'EXECUTE'),
    'authenticated retains EXECUTE on check_ip_rate_limit')
END;

SELECT * FROM finish();
ROLLBACK;
