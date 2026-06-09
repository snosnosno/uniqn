-- M1 회귀 봉쇄: consume_diamonds_atomically는 rev1 하드닝(20260602000000_wallet_grants_hardening_p0)
-- 으로 service_role-only로 잠겼으나, M1(20260609000001)의 CREATE OR REPLACE 끝 GRANT TO
-- authenticated가 authenticated를 재부여 → 회귀.
-- consume는 p_user_id를 검증 없이 신뢰(정상 경로=SECURITY DEFINER인 create_job_posting_with_payment
-- 가 definer 권한으로 호출)하므로 authenticated 직접호출 = 타인 지갑 잔액 파괴 표면.
-- 하드닝 상태(anon/authenticated 차단, service_role only) 복원.
-- (이미 적용된 20260609000001은 불변 — 본 forward 마이그로 정정)
REVOKE EXECUTE ON FUNCTION public.consume_diamonds_atomically(UUID, INT, wallet_reason, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_diamonds_atomically(UUID, INT, wallet_reason, UUID, TEXT) TO service_role;
