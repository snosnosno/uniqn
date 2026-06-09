-- 리뷰 적발 P1: refund_job_cancellation_atomically가 authenticated에 직접 열려있고
-- status='cancelled' 게이트가 없어, 인증된 owner가 active 공고에 refund를 직접 호출 →
-- "취소 없는 환불"(공고는 active 유지·잔액 복원) = 유료화 시 구조적 매출 누수.
--
-- M4(클라 deleteWithTransaction이 cancel_job_posting_with_refund_atomically(M3) 단일 RPC로 전환)
-- 이후 refund의 합법 호출자는 M3(SECURITY DEFINER, postgres 권한 내부 호출)뿐 →
-- authenticated GRANT는 합법 용도 dead, 익스플로잇 표면으로만 live.
-- consume(20260609000005)와 동일 패턴으로 service_role-only 봉쇄.
REVOKE EXECUTE ON FUNCTION public.refund_job_cancellation_atomically(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_job_cancellation_atomically(uuid, uuid) TO service_role;
