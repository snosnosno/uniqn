-- ============================================================
-- T1~T5 보강: wallet 함수 권한 하드닝
-- 배경: Supabase ALTER DEFAULT PRIVILEGES가 신규 함수에 anon/authenticated EXECUTE를
--   자동 부여 → REVOKE FROM PUBLIC만으로는 anon 잔존(advisors 경고).
-- 조치:
--   - backfill_signup_hearts: service_role 전용 의도 강제 (anon/authenticated 차단)
--   - auth.uid() 의존 차감/환불/비용 함수: anon 직접 호출 차단 (공격 표면 축소).
--     authenticated는 유지(내부 auth.uid()/owner 체크로 방어, 프로젝트 전역 패턴 일관).
-- ============================================================

-- 1) 백필은 운영(service_role) 전용
REVOKE EXECUTE ON FUNCTION public.backfill_signup_hearts() FROM anon, authenticated;

-- 2) anon 직접 호출 차단 (로그인 필수 경로 — anon은 auth.uid() NULL이라 기능도 못 함)
REVOKE EXECUTE ON FUNCTION public.create_job_posting_with_payment_atomically(UUID, JSONB, wallet_reason) FROM anon;
REVOKE EXECUTE ON FUNCTION public.refund_job_cancellation_atomically(UUID, UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public._calc_posting_cost(TEXT, UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_posting_cost(TEXT, UUID) FROM anon;

-- 3) consume: 직접 호출은 결제 RPC 내부(SECDEF)에서만 — anon 및 PUBLIC 잔여 차단
REVOKE EXECUTE ON FUNCTION public.consume_diamonds_atomically(UUID, INT, wallet_reason, UUID, TEXT) FROM PUBLIC, anon;
