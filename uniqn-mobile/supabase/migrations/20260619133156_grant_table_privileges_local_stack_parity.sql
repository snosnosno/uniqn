-- public 테이블/시퀀스 권한 명시화 — 로컬 Supabase 스택을 prod와 동일하게 (e2e 42501 회귀 해소)
--
-- 배경: base_schema 이래 모든 public 테이블이 Supabase 플랫폼 default 권한에만 의존했다
--   (마이그레이션에 테이블 GRANT 0개). prod는 클라우드 플랫폼이 anon/authenticated/service_role
--   에 default 권한을 부여하므로 정상이나, 로컬 CLI 스택(`supabase start`)은 현행 CLI 이미지에서
--   이 default 권한을 자동 부여하지 않는다 → 모든 PostgREST 쿼리가 42501 permission denied.
--   증상: e2e 로그인 후 화면 전역 타임아웃(run 27769458739 / 27787809344 — app_config(authenticated
--   startup 버전체크) 42501 ×560k, board_posts(service_role seed) 42501). pgTAP의 #179와 동일 클래스.
--   ⚠️ supabase/setup-cli 버전 pin(2.107.0, #180)으로는 미해결(run 27787809344 재현으로 검증됨).
--
-- 해결: prod 실측 권한 그대로를 명시 GRANT 한다(스키마를 플랫폼 magic 비의존으로).
--   prod에는 이미 동일 권한이 있어 멱등 no-op. 로컬 스택만 정합 복구된다.
--
-- 보존 불변식(절대 위반 금지):
--   1) 함수 권한은 건드리지 않는다 — 머니 RPC anon REVOKE 하드닝(#163 등) 보존.
--   2) wallet 4테이블 DML 하드닝(20260605000010)을 동일하게 재적용 — 아래 GRANT ALL이
--      anon/authenticated를 넓히지 못하게 마지막에 다시 REVOKE.
--   prod 실측 정합: 일반 테이블=anon/authenticated/service_role 전체 DML / wallet 4테이블=
--   anon·authenticated는 SELECT만(INSERT/UPDATE/DELETE 없음), service_role 전체.

-- 1) 스키마 USAGE
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- 2) 테이블 — Supabase 표준(전체 권한). 행 접근은 RLS가 통제.
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;

-- 3) 시퀀스 — serial/identity insert 대비
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- 4) 향후 생성 객체에도 동일 default(플랫폼 동작 미러; 함수는 제외 — 신규 함수 anon 자동부여 회귀 방지)
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;

-- 5) wallet 4테이블 DML 하드닝 재적용 (20260605000010 미러 — 2)/4)가 anon/authenticated를 넓히는 것 방지)
REVOKE INSERT, UPDATE, DELETE ON public.wallets          FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.wallet_ledger    FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.heart_lots       FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.diamond_products FROM anon, authenticated;
