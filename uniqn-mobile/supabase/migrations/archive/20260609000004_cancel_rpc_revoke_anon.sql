-- M3 보안 보강: cancel_job_posting_with_refund_atomically(신규 함수)에 Supabase
-- default privilege로 anon EXECUTE가 직접 부여됨. M3의 REVOKE FROM PUBLIC만으로는
-- anon 직접 grant가 남아 anon(auth.uid()=NULL)이 인가 가드를 우회 → 임의 공고 취소 가능.
-- anon 명시 REVOKE로 봉쇄(다른 머니 RPC 패턴 동일: authenticated/service_role만 허용).
-- (이미 적용된 20260609000003은 불변 — 본 forward 마이그로 정정)
REVOKE EXECUTE ON FUNCTION public.cancel_job_posting_with_refund_atomically(uuid, uuid) FROM anon;
