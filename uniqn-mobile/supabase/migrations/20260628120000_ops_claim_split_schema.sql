-- 라이브 운영(ops) claim 토큰 분리 — 스키마: claim_token→view_token rename + claim_pin_hash.
-- 읽기 능력(view_token, anon)과 쓰기 비밀(claim_pin_hash, bcrypt) 분리. prod 0행 → 데이터 마이그 불요.
ALTER TABLE public.ops_participants RENAME COLUMN claim_token TO view_token;
-- UNIQUE 제약/인덱스(ops_participants_claim_token_key)는 rename 자동 추종.

ALTER TABLE public.ops_participants
  ADD COLUMN IF NOT EXISTS claim_pin_hash text;

COMMENT ON COLUMN public.ops_participants.view_token IS '읽기 능력(anon player_view 키). 공유·유출 허용(읽기만). 운영자 read 가능(D8).';
COMMENT ON COLUMN public.ops_participants.claim_pin_hash IS 'claim 비밀의 bcrypt 해시. null=미발급. anon/공개 경로 절대 미반환.';
