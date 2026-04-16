-- =============================================================================
-- Migration: employer_applications 테이블 + RLS
--
-- 구인자 등록 관리자 승인 플로우 — 신청 이력 append-only 저장
-- 설계 문서: user-master-design-20260416-134945.md (Approach B 선택)
-- =============================================================================

CREATE TABLE public.employer_applications (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        NOT NULL REFERENCES public.users(id),
  status              TEXT        NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  submitted_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at         TIMESTAMPTZ,
  reviewed_by         UUID        REFERENCES public.users(id),   -- NULL = 시스템 seed
  rejection_reason    TEXT,
  rejection_category  TEXT        CHECK (
    rejection_category IN ('duplicate', 'dummy', 'identity_mismatch', 'other')
  ),
  agreements_snapshot JSONB       NOT NULL,                       -- 신청 당시 약관/서약 버전 고정
  supersedes_id       UUID        REFERENCES public.employer_applications(id), -- 재신청 체인
  created_at          TIMESTAMPTZ DEFAULT now()
);

-- 유저별 status 조회 (본인 상태 확인, admin 필터링)
CREATE INDEX idx_employer_applications_user_status
  ON public.employer_applications(user_id, status);

-- pending 건 조회 성능 (관리자 대시보드, SLA 모니터링)
CREATE INDEX idx_employer_applications_pending
  ON public.employer_applications(submitted_at)
  WHERE status = 'pending';

-- =============================================================================
-- RLS
-- =============================================================================

ALTER TABLE public.employer_applications ENABLE ROW LEVEL SECURITY;

-- 본인은 자신의 신청 내역만 SELECT 가능
CREATE POLICY "employer_applications_select_own"
  ON public.employer_applications
  FOR SELECT
  USING (auth.uid() = user_id);

-- admin 전체 SELECT (목록, 상세, SLA 모니터링)
CREATE POLICY "employer_applications_admin_select"
  ON public.employer_applications
  FOR SELECT
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- 직접 INSERT/UPDATE/DELETE 차단 — RPC(SECURITY DEFINER) 경유만 허용
-- (정책 없음 = 기본 deny)
