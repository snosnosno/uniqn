-- P1 — verify-and-save-portone-profile 멱등성 layer.
--
-- 같은 identityVerificationId가 두 번 처리되어 다른 user.id로 신원이
-- 박히는 race / replay 차단. caller binding(P0 #1)이 1차 layer라면 본
-- 테이블은 2차 layer — token이 노출돼도 verification 자체는 once-only.
--
-- 흐름: verify-and-save-portone-profile 진입 직후 service_role로
-- INSERT 시도. PRIMARY KEY 위반(23505)이면 이미 처리된 verification으로
-- IV_ALREADY_PROCESSED 반환.

CREATE TABLE IF NOT EXISTS public.processed_identity_verifications (
  verification_id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  function_name TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.processed_identity_verifications IS
  'PortOne identityVerificationId 멱등성 — once-only 처리 보장. P1 verification_id replay 차단.';
COMMENT ON COLUMN public.processed_identity_verifications.verification_id IS
  'PortOne identityVerificationId (예: inicis-identity-<uuid>)';
COMMENT ON COLUMN public.processed_identity_verifications.function_name IS
  '처리한 Edge Function 이름 — 디버깅 + 향후 다중 함수 멱등성 확장 대비';

CREATE INDEX IF NOT EXISTS idx_processed_iv_processed_at
  ON public.processed_identity_verifications (processed_at DESC);

CREATE INDEX IF NOT EXISTS idx_processed_iv_user_id
  ON public.processed_identity_verifications (user_id);

-- RLS — 사용자 본인 레코드만 SELECT. INSERT/UPDATE/DELETE는 service_role만.
ALTER TABLE public.processed_identity_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "processed_iv_select_self"
  ON public.processed_identity_verifications
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- INSERT/UPDATE/DELETE 정책 없음 → service_role(Edge Function)만 접근.
-- 클라이언트가 직접 멱등성 레코드를 만들거나 지울 수 없도록 deny-by-default.
