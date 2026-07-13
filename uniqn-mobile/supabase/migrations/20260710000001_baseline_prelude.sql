-- =============================================================================
-- baseline 프렐류드 — 확장 / 스키마 권한 / vault 로컬 부트스트랩
-- =============================================================================
-- prod↔repo 파리티 baseline squash(2026-07-11)의 1/4 파일.
--   1) 20260710000001_baseline_prelude.sql        ← 이 파일
--   2) 20260710000002_baseline_schema_from_prod.sql (prod pg_dump --schema-only -n public)
--   3) 20260710000003_baseline_platform_glue.sql   (auth 트리거·storage·realtime·cron)
--   4) 20260710000004_baseline_data_seed.sql       (e2e/QA 계정·app_config 시드)
--
-- 왜 필요한가: 2)의 public 스키마 덤프에는 확장(extensions 스키마 소속)·스키마 레벨
--   권한·vault 시크릿이 담기지 않는다. 덤프 본문이 extensions.* 함수(gen_random_uuid 등)를
--   참조하므로 확장은 덤프보다 먼저 존재해야 한다.
--
-- prod 영향: 없음. 이 파일은 prod에 이미 존재하는 상태의 재기술이며, prod에는
--   `supabase migration repair --status applied`로 기록만 한다(실행 안 함).
--   (구 마이그레이션 240여 개는 supabase/migrations/archive/ 로 이동 — git 히스토리 보존)
--
-- 근거 실측(2026-07-11, prod ygfxukhktpqymahfrvbz):
--   pg_extension: pg_cron@pg_catalog, pg_net@extensions, pg_stat_statements@extensions,
--                 pgcrypto@extensions, plpgsql@pg_catalog, supabase_vault@vault, uuid-ossp@extensions
--   pg_default_acl(public): postgres→ tables arwdDxtm / sequences rwU / functions X
--                           (anon, authenticated, service_role 각각)

-- -----------------------------------------------------------------------------
-- 1. 확장 (supabase 이미지 기본분 외 명시 설치분)
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- -----------------------------------------------------------------------------
-- 2. 스키마 레벨 권한 (구 20260619133156 상당)
--    개별 오브젝트 ACL과 ALTER DEFAULT PRIVILEGES(미래 오브젝트 기본값)는 2) 덤프가
--    말미에 그대로 담고 있다. ⚠️기본권한을 여기(덤프 전)서 걸면 덤프가 만드는 모든
--    함수에 anon EXECUTE 가 선부여되고, pg_dump 의 델타 기반 ACL(REVOKE FROM PUBLIC)이
--    그 오염을 못 지워 prod 하드닝(anon 회수)이 로컬에서 무효화된다 — 실측으로 확인된 함정.
-- -----------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 3. vault 로컬 부트스트랩 (구 20260414000000 블록 이관)
--    cron 잡(net.http_post 계열)이 name 조회로 참조하는 시크릿 2종.
--    prod에는 실값이 이미 등록되어 있어 IF NOT EXISTS로 절대 덮어쓰지 않는다.
-- -----------------------------------------------------------------------------
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
    -- vault 확장 미설치 환경은 silent skip
    NULL;
END $$;
