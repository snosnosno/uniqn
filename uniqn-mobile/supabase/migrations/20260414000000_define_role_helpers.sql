-- 역할 헬퍼 함수 — 로컬 부트스트랩 회피 + git 이력 명시화
--
-- 배경:
--   - get_my_role() 및 is_employer_or_admin() 가 prod 에 존재하나 정의 마이그레이션이
--     git 이력에서 누락됨 (`feedback_localhost_dev_production_db` 메모리 참조).
--   - 20260414013837 / 20260414015346 / workspace RLS 정책이 두 함수를 사용하므로
--     로컬 supabase start 시 undefined_function 에러로 부트스트랩 실패.
--   - 본 마이그레이션은 가장 이른 타임스탬프로 두 함수를 정의 → 모든 후속 마이그레이션이
--     안전하게 참조 가능.
--   - prod 영향: CREATE OR REPLACE 이므로 동일 정의 시 no-op.
--   - master 의 20260512062312_define_is_employer_or_admin_helper.sql 와 중복되나
--     idempotent 함수 정의이므로 두 번 실행되어도 안전.

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SET search_path = 'public'
AS $$
  SELECT coalesce(
    auth.jwt() -> 'app_metadata' ->> 'role',
    ''
  );
$$;

CREATE OR REPLACE FUNCTION public.is_employer_or_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
  SELECT coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'employer'),
    false
  );
$$;

COMMENT ON FUNCTION public.get_my_role() IS
  'JWT app_metadata.role 추출 — RLS 정책에서 admin/employer 판별용';

COMMENT ON FUNCTION public.is_employer_or_admin() IS
  'employer 또는 admin 권한 확인 — SECURITY DEFINER + STABLE (RLS 핫패스)';

-- ============================================================================
-- 로컬 부트스트랩 vault 시드 — 20260417000000 / 20260417070000 의 fail-fast 회피
-- ============================================================================
-- prod 영향: IF NOT EXISTS 로 가드, 이미 등록된 secret 은 덮어쓰지 않음.
-- local 영향: dummy 값으로 assertion 통과, push notifications 트리거는 dummy 호출
--             (push 자체는 edge function 으로 대체되어 trigger 작동 여부 무관).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'supabase_url') THEN
    PERFORM vault.create_secret('http://127.0.0.1:54321', 'supabase_url');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'service_role_key') THEN
    PERFORM vault.create_secret('local-bootstrap-dummy-key', 'service_role_key');
  END IF;
EXCEPTION
  WHEN undefined_table THEN
    -- vault 확장 미설치 환경 (구버전 Supabase 등) 은 silent skip
    NULL;
END $$;
