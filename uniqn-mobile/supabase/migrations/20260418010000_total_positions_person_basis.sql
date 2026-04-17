-- ============================================================================
-- total_positions 사람 단위(person basis) 백필
-- Phase 7 of "confirmed-count-sync" 시리즈
-- ----------------------------------------------------------------------------
-- 기존: total_positions = Σ slot.role.count (슬롯 단위, 3일×딜러2 = 6)
-- 신규: total_positions = Σ_role MAX_{all timeslots}(count) (사람 단위)
-- 이유: 선행 마이그레이션(20260418000000_person_basis_filled_positions.sql)이
--       filled_positions을 사람 단위로 전환 → total_positions과 의미 단위
--       미스매치 → auto-close(filled >= total) 오동작. 본 마이그레이션으로 해소.
--
-- 알고리즘 (Phase 6 TS calculateTotalPositionsFromSchedule와 의미 동등):
--   schedule.kind = 'fixed':
--     total = SUM(roleRequirements[].count)
--
--   schedule.kind != 'fixed' (regular/tournament/urgent, dated):
--     역할별로 모든 timeSlots[].roles[]의 count MAX → 역할별 MAX의 SUM
--     role 키: role = 'other' → 'other:<customRole>' (분리 카운트)
--              그 외 → role 그대로
--
--   빈 케이스:
--     fixed + roleRequirements 없음/빈 배열 → 0
--     dated + requirements 없음/빈 배열 → 0
--
-- Related:
--   - docs/analysis/2026-04-17-confirmed-count-sync-root-cause.md
--   - src/domains/job-posting/stats.ts (TS 영역 동일 알고리즘)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) dated/fixed 각각 posting별 사람 단위 total 계산 후 UPDATE
-- ----------------------------------------------------------------------------
WITH role_max AS (
  -- dated posting: (posting, role_key)별 count MAX
  SELECT
    jp.id AS posting_id,
    CASE
      WHEN role_elem->>'role' = 'other'
        THEN 'other:' || COALESCE(role_elem->>'customRole', '')
      ELSE COALESCE(role_elem->>'role', '')
    END AS role_key,
    MAX(NULLIF(role_elem->>'count', '')::int) AS max_count
  FROM public.job_postings jp
  CROSS JOIN LATERAL jsonb_array_elements(jp.schedule->'requirements') AS req
  CROSS JOIN LATERAL jsonb_array_elements(req->'timeSlots') AS slot
  CROSS JOIN LATERAL jsonb_array_elements(slot->'roles') AS role_elem
  WHERE jp.schedule->>'kind' IS DISTINCT FROM 'fixed'
    AND jp.schedule ? 'requirements'
    AND jsonb_typeof(jp.schedule->'requirements') = 'array'
    -- TS getRoleKey와 동일하게 role 필드가 비어있으면 스킵 (Codex advisor review)
    AND NULLIF(role_elem->>'role', '') IS NOT NULL
  GROUP BY jp.id, role_key
),
dated_totals AS (
  SELECT posting_id, COALESCE(SUM(max_count), 0)::int AS total
  FROM role_max
  GROUP BY posting_id
),
fixed_totals AS (
  SELECT
    jp.id AS posting_id,
    COALESCE(SUM(NULLIF(r->>'count', '')::int), 0)::int AS total
  FROM public.job_postings jp
  LEFT JOIN LATERAL jsonb_array_elements(jp.schedule->'roleRequirements') AS r ON TRUE
  WHERE jp.schedule->>'kind' = 'fixed'
  GROUP BY jp.id
),
posting_totals AS (
  SELECT posting_id, total FROM dated_totals
  UNION ALL
  SELECT posting_id, total FROM fixed_totals
)
UPDATE public.job_postings jp
SET
  total_positions = pt.total,
  updated_at = now()
FROM posting_totals pt
WHERE jp.id = pt.posting_id
  AND jp.total_positions IS DISTINCT FROM pt.total;

-- ----------------------------------------------------------------------------
-- 2) 빈 dated 케이스: requirements 없음/빈 배열 → 0
--    (role_max에 row 없음 → dated_totals에 posting 누락 → 위 UPDATE 미적용)
-- ----------------------------------------------------------------------------
UPDATE public.job_postings
SET
  total_positions = 0,
  updated_at = now()
WHERE schedule->>'kind' IS DISTINCT FROM 'fixed'
  AND (
    schedule->'requirements' IS NULL
    OR jsonb_typeof(schedule->'requirements') != 'array'
    OR jsonb_array_length(schedule->'requirements') = 0
  )
  AND total_positions IS DISTINCT FROM 0;

-- ----------------------------------------------------------------------------
-- 3) 백필 결과 로그 (idempotent — 재실행 시 WHERE 조건으로 0행 업데이트)
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_dated_count int;
  v_fixed_count int;
BEGIN
  SELECT COUNT(*) INTO v_dated_count
  FROM public.job_postings
  WHERE schedule->>'kind' IS DISTINCT FROM 'fixed';

  SELECT COUNT(*) INTO v_fixed_count
  FROM public.job_postings
  WHERE schedule->>'kind' = 'fixed';

  RAISE NOTICE 'total_positions 사람 단위 백필 완료 (dated=% fixed=%)', v_dated_count, v_fixed_count;
END $$;
