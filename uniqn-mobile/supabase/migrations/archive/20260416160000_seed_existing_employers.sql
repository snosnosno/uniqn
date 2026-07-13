-- =============================================================================
-- Migration: 기존 employer 유저 approved 이력 seed
--
-- 대상: role = 'employer'인 기존 유저 (현재 QA 테스트 계정 1명)
-- - reviewed_by: NULL (시스템 seed임을 표시)
-- - agreements_snapshot: 기존 employer_agreements 값, 없으면 {"_seeded": true}
-- - submitted_at / reviewed_at: employer_registered_at 또는 now()
--
-- 멱등성: employer_applications.id는 gen_random_uuid()이므로 ON CONFLICT는
-- 효과 없음. NOT EXISTS guard로 중복 seed 방지 (재실행 안전).
-- =============================================================================

INSERT INTO public.employer_applications (
  user_id,
  status,
  submitted_at,
  reviewed_at,
  reviewed_by,
  rejection_reason,
  rejection_category,
  agreements_snapshot,
  supersedes_id,
  created_at
)
SELECT
  u.id,
  'approved',
  COALESCE(u.employer_registered_at, now()),
  COALESCE(u.employer_registered_at, now()),
  NULL,    -- 시스템 seed: 검토자 없음
  NULL,
  NULL,
  CASE
    WHEN u.employer_agreements IS NOT NULL
         AND u.employer_agreements != '{}'::JSONB
         AND u.employer_agreements != 'null'::JSONB
    THEN u.employer_agreements
    ELSE '{"_seeded": true}'::JSONB
  END,
  NULL,
  COALESCE(u.employer_registered_at, now())
FROM public.users u
WHERE u.role = 'employer'
  -- 멱등성 가드: 기존 approved 이력이 없는 employer만 seed
  AND NOT EXISTS (
    SELECT 1 FROM public.employer_applications ea
    WHERE ea.user_id = u.id AND ea.status = 'approved'
  );
