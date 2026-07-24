-- user_consents 동의 원장 정합성 + 기존 사용자 동의 백필 (2026-07-25)
--
-- 배경:
--   verify-and-save-portone-profile EF 가 실제 스키마에 없는 컬럼
--   (terms_of_service/privacy_policy/marketing)에 upsert 하고 에러도 확인하지
--   않아 user_consents 가 0행으로 비어 있었고, users.terms_agreed /
--   privacy_agreed / marketing_agreed 도 가입 시 기록되지 않았다.
--   그 결과 앱 '내 정보 > 동의 정보'가 전원 미동의로 표시됐다.
--
-- 조치:
--   1) EF upsert onConflict(user_id, consent_type) 대상 유니크 인덱스 추가
--   2) 기존 사용자 users.terms_agreed / privacy_agreed 백필
--      - third_party_agreed 는 동일 EF 가입 경로에서 terms/privacy 필수 동의
--        검증(400 차단)을 통과한 뒤에만 true 로 기록되므로 백필 근거로 사용
--      - marketing_agreed 는 원 선택값 복구 불가 → 변경하지 않음(false 유지)

-- 1) 유니크 인덱스 (테이블 현재 0행 — 충돌 불가)
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_consents_user_type
  ON public.user_consents (user_id, consent_type);

-- 2) 기존 사용자 필수 동의 백필
UPDATE public.users
SET terms_agreed = true,
    privacy_agreed = true
WHERE third_party_agreed IS TRUE
  AND (terms_agreed IS DISTINCT FROM true OR privacy_agreed IS DISTINCT FROM true);
