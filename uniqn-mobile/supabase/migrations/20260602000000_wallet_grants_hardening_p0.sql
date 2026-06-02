-- Fix-1a: 결제 도메인 P0/P1 권한 하드닝 (anon 통화 발권 + 잔액 IDOR + 타인 소각 벡터 차단)
--
-- 근거: docs/planning/2026-06-02-monetization-review-findings.md (유료화 롤아웃 前 적대적 리뷰)
-- 선행 하드닝 20260530000006 이 누락한 함수들의 anon EXECUTE 회수 + consume authenticated 회수.
-- Supabase ALTER DEFAULT PRIVILEGES 가 신규 함수에 anon/authenticated EXECUTE 를 자동부여하므로
-- REVOKE ... FROM PUBLIC 만으로는 anon 명시권한이 잔존한다(20260530000006 주석 참조).
--
-- ⚠️ 본문(로직) 변경 없음 — GRANT 만 조정. 모든 함수가 SECURITY DEFINER 라
--    래퍼(create_job_posting_with_payment)/cron/webhook 의 내부 호출은 definer(postgres) 권한으로
--    동작하므로 EXECUTE 회수의 영향을 받지 않는다. (직접 RPC 호출 경로만 봉쇄.)

-- [P0] 무인증 다이아 발권 차단 — webhook(service_role) 전용. 공개 anon 키로 임의 user 무한 적립 차단.
REVOKE EXECUTE ON FUNCTION public.credit_diamonds_atomically(uuid, integer, text, text) FROM anon, PUBLIC;

-- [P0] 무인증 하트 발권 차단 — claim_daily_attendance 래퍼(SECDEF) / service_role 전용.
REVOKE EXECUTE ON FUNCTION public.grant_heart_atomically(uuid, integer, wallet_reason, uuid, integer) FROM anon, PUBLIC;

-- [P1→P2] 무인증 만료 트리거 차단 — pg_cron(service_role/postgres) 전용. 인자 없이 전체 만료 처리하는 내부 함수.
REVOKE EXECUTE ON FUNCTION public.fn_expire_heart_lots() FROM anon, authenticated, PUBLIC;

-- [P1] 무인증 잔액 IDOR 차단 — anon(auth.uid()=NULL) 이 본문 권한가드를 단락시켜 임의 UUID 의
--      diamond/lifetime_purchased 잔액을 조회하던 경로를 봉쇄. authenticated 교차조회는 본문
--      `v_caller IS NOT NULL AND v_uid <> v_caller` 가드가 PERMISSION_DENIED 로 이미 차단하므로 유지.
REVOKE EXECUTE ON FUNCTION public.get_wallet_summary(uuid) FROM anon, PUBLIC;

-- [P1] 타인 잔액 소각 차단 — consume 는 create_job_posting_with_payment(SECDEF) 래퍼 경유로만 호출됨
--      (직접 .rpc('consume_diamonds_atomically') 클라 코드 0건). 직접 호출 봉쇄로 타인 차감 벡터 제거.
REVOKE EXECUTE ON FUNCTION public.consume_diamonds_atomically(uuid, integer, wallet_reason, uuid, text) FROM anon, authenticated, PUBLIC;

-- [P3] 무인증 출석 호출 차단 — 본문에 NOT_AUTHENTICATED 가드가 있으나 anon 공격표면 축소.
REVOKE EXECUTE ON FUNCTION public.claim_daily_attendance() FROM anon, PUBLIC;
