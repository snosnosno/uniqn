-- 20260507144734_add_users_identity_ci_hash_column.sql
-- PortOne 본인인증 CI 해시 컬럼 추가 (Edge Function이 가정하던 컬럼).
--
-- 근본원인: verify-portone-identity / verify-and-save-portone-profile 코드는
-- users.identity_ci_hash 별도 컬럼을 가정했으나 마이그레이션이 누락되어 있었음.
-- 동일인 중복 가입 차단(hasDuplicateIdentity)을 위해 인덱스 검색 가능한 별도 컬럼으로 분리.

-- 1. 컬럼 추가
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS identity_ci_hash text;

-- 2. 중복 검사 성능을 위한 partial 인덱스 (NULL 제외)
-- UNIQUE 제약은 PortOne 정책 확인 후 별도 마이그레이션으로 추가 검토
CREATE INDEX IF NOT EXISTS users_identity_ci_hash_idx
  ON public.users (identity_ci_hash)
  WHERE identity_ci_hash IS NOT NULL;

-- 3. 기존 identity jsonb의 ciHash 값을 새 컬럼으로 백필
-- (이 마이그레이션 시점에는 컬럼명이 'identity', 다음 마이그레이션에서 'identity_data'로 rename)
UPDATE public.users
SET identity_ci_hash = identity->>'ciHash'
WHERE identity ? 'ciHash'
  AND identity->>'ciHash' IS NOT NULL
  AND identity_ci_hash IS NULL;

-- 4. 컬럼 설명
COMMENT ON COLUMN public.users.identity_ci_hash IS
  'PortOne 본인인증 CI(Connecting Information) 해시. 동일인 중복 가입 검사용. identity_data jsonb의 ciHash 필드와 동기화 유지.';
