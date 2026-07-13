-- =============================================================================
-- Migration: fcm_tokens 별도 테이블 생성
--
-- 배경: NotificationRepository.ts가 'fcm_tokens' 별도 테이블을 참조하나,
--       기존 스키마에는 users.fcm_tokens JSONB 컬럼만 존재했음.
--       1유저 다기기 지원 + 플랫폼/타입 메타데이터 저장을 위해 별도 테이블 생성.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.fcm_tokens (
  user_id           UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token             TEXT        NOT NULL,
  type              TEXT        NOT NULL CHECK (type IN ('expo', 'fcm')),
  platform          TEXT        NOT NULL CHECK (platform IN ('ios', 'android')),
  registered_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_refreshed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, token)
);

-- 성능: 유저별 토큰 목록 조회
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_user_id ON public.fcm_tokens(user_id);

-- RLS 활성화
ALTER TABLE public.fcm_tokens ENABLE ROW LEVEL SECURITY;

-- 본인만 자신의 토큰 조회
CREATE POLICY "fcm_tokens_select_own"
  ON public.fcm_tokens
  FOR SELECT
  USING (auth.uid() = user_id);

-- 본인만 자신의 토큰 등록
CREATE POLICY "fcm_tokens_insert_own"
  ON public.fcm_tokens
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 본인만 자신의 토큰 갱신
CREATE POLICY "fcm_tokens_update_own"
  ON public.fcm_tokens
  FOR UPDATE
  USING (auth.uid() = user_id);

-- 본인만 자신의 토큰 삭제
CREATE POLICY "fcm_tokens_delete_own"
  ON public.fcm_tokens
  FOR DELETE
  USING (auth.uid() = user_id);

-- admin 전체 조회 (push 발송 대상 토큰 조회용)
CREATE POLICY "fcm_tokens_admin_select"
  ON public.fcm_tokens
  FOR SELECT
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );
