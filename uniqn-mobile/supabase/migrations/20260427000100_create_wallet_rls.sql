-- 목적: wallet 4 테이블 RLS — 본인 SELECT + admin 전체
-- 배경: SECURITY DEFINER RPC만 쓰기 허용 (직접 INSERT/UPDATE 차단)
-- 스펙: docs/superpowers/specs/2026-04-26-monetization-design.md §3.5
-- 패턴: (SELECT auth.uid()) 래핑 + app_metadata.role 체크

ALTER TABLE public.wallets          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_ledger    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.heart_lots       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diamond_products ENABLE ROW LEVEL SECURITY;

-- 본인 잔액 조회
CREATE POLICY wallet_self_select ON public.wallets
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- admin 모든 잔액 접근
CREATE POLICY wallet_admin_all ON public.wallets
  FOR ALL TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- 본인 ledger 조회
CREATE POLICY ledger_self_select ON public.wallet_ledger
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- admin 전체 ledger
CREATE POLICY ledger_admin_select ON public.wallet_ledger
  FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- 본인 heart_lots 조회
CREATE POLICY heart_lots_self_select ON public.heart_lots
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- 다이아 상품 카탈로그 공개 읽기
CREATE POLICY products_public_read ON public.diamond_products
  FOR SELECT TO authenticated
  USING (active = true);

COMMENT ON POLICY wallet_self_select ON public.wallets IS
  'Phase 1 RLS — write는 SECURITY DEFINER RPC만 허용 (직접 INSERT/UPDATE 정책 없음)';
