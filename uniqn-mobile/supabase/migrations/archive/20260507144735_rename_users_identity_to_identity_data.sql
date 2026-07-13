-- 20260507144735_rename_users_identity_to_identity_data.sql
-- users.identity (jsonb) 컬럼을 identity_data로 rename.
--
-- 근본원인: verify-portone-identity / verify-and-save-portone-profile Edge Function이
-- 'identity_data' 컬럼명으로 코딩되어 있었으나 DB 컬럼명만 'identity'였음.
-- 코드 변경 대신 DB 컬럼명을 코드에 맞춤 (코드가 의도한 이름).
--
-- 영향 범위 검증 (rename 전 grep):
--   - src/ 코드베이스: users.identity (jsonb) 직접 참조 0건
--   - DB function/trigger: NEW.identity 참조 0건
--   - RLS 정책: identity 컬럼 미사용
-- 데이터 손실 없음 (RENAME COLUMN은 데이터 보존).

ALTER TABLE public.users
  RENAME COLUMN identity TO identity_data;

COMMENT ON COLUMN public.users.identity_data IS
  'PortOne 본인인증으로 받은 신원 정보 jsonb. provider/channel/identityVerificationId/verifiedAt/name/birthDate/gender/phoneNumber/ciHash/isForeigner.';
