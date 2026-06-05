-- [P2] wallet 4테이블 DML REVOKE (방어심층)
--
-- 근거: rev1 보안·머니 리뷰 (docs/planning/2026-06-05-rev1-security-money-fixes.md §1-2)
-- 문제: anon/authenticated 가 wallets/wallet_ledger/heart_lots/diamond_products 에
--       INSERT/UPDATE/DELETE 테이블 GRANT 보유(실측 확인). 현재 RLS default-deny 로
--       직접 write 는 차단되나, "향후 write 정책 추가" 회귀에 무방비.
-- 효과: 테이블 GRANT 자체를 회수 → RLS 정책이 생겨도 anon/authenticated 직접 write 불가.
-- 안전: SECDEF RPC(consume/credit/refund/grant 등)는 정의자(owner) 권한으로 쓰므로 무영향.
--       SELECT 권한은 보존(webhook product 조회·잔액 조회 정상).
-- 주의: FORCE ROW LEVEL SECURITY 는 정의자 BYPASSRLS 미검증으로 본 마이그에서 제외(별도 검증 후).

REVOKE INSERT, UPDATE, DELETE ON public.wallets          FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.wallet_ledger    FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.heart_lots       FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.diamond_products FROM anon, authenticated;
