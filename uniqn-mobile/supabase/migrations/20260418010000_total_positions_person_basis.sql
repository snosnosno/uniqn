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
-- 방어적 처리 (Codex adversarial review 2026-04-17 반영):
--   - 중첩 jsonb_array_elements 호출 전 jsonb_typeof = 'array' 가드(CASE)로
--     scalar/object timeSlots/roles에서 에러 발생 방지.
--   - count 문자열은 정규식(`^-?[0-9]+$`) 통과한 것만 정수 캐스팅하여
--     `' '`/`'abc'`/`'null'` 등 dirty data에서 InvalidTextRepresentation 차단.
--
-- Related:
--   - docs/advisor-review-phase-6-7.md (Codex advisor 1차 리뷰)
--   - src/domains/job-posting/stats.ts (TS 영역 동일 알고리즘)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Precondition: 선행 마이그레이션 20260418000000 이 적용되어야 함
-- ----------------------------------------------------------------------------
-- 20260418000000_person_basis_filled_positions은 filled_positions을 사람 단위로
-- 전환한다. 본 마이그레이션이 단독 적용되면 total=사람, filled=슬롯 미스매치가
-- 남아 auto-close 로직이 계속 오작동하므로 의존성을 강제한다.
--
-- 단독 배포(worktree 1 미머지)를 가드: Supabase가 적용 이력을 저장하는
-- supabase_migrations.schema_migrations에 선행 버전이 없으면 RAISE EXCEPTION.
-- ----------------------------------------------------------------------------
DO $precondition$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM supabase_migrations.schema_migrations
    WHERE version = '20260418000000'
  ) THEN
    RAISE EXCEPTION
      'MIGRATION_DEPENDENCY_MISSING: 20260418010000_total_positions_person_basis requires 20260418000000_person_basis_filled_positions to be applied first. Merge fix/confirmed-count-sync (worktree 1) before deploying this migration.';
  END IF;
END
$precondition$;

DO $$
DECLARE
  v_updated_main int;
  v_updated_zero int;
  v_total_dated int;
  v_total_fixed int;
BEGIN
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
      MAX(
        CASE
          WHEN (role_elem->>'count') ~ '^-?[0-9]+$'
            THEN (role_elem->>'count')::int
          ELSE NULL
        END
      ) AS max_count
    FROM public.job_postings jp
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE
        WHEN jsonb_typeof(jp.schedule->'requirements') = 'array'
          THEN jp.schedule->'requirements'
        ELSE '[]'::jsonb
      END
    ) AS req
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE
        WHEN jsonb_typeof(req->'timeSlots') = 'array'
          THEN req->'timeSlots'
        ELSE '[]'::jsonb
      END
    ) AS slot
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE
        WHEN jsonb_typeof(slot->'roles') = 'array'
          THEN slot->'roles'
        ELSE '[]'::jsonb
      END
    ) AS role_elem
    WHERE jp.schedule->>'kind' IS DISTINCT FROM 'fixed'
      -- TS getRoleKey와 동일하게 role 필드가 비어있으면 스킵
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
      COALESCE(
        SUM(
          CASE
            WHEN (r->>'count') ~ '^-?[0-9]+$'
              THEN (r->>'count')::int
            ELSE 0
          END
        ),
        0
      )::int AS total
    FROM public.job_postings jp
    LEFT JOIN LATERAL jsonb_array_elements(
      CASE
        WHEN jsonb_typeof(jp.schedule->'roleRequirements') = 'array'
          THEN jp.schedule->'roleRequirements'
        ELSE '[]'::jsonb
      END
    ) AS r ON TRUE
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

  GET DIAGNOSTICS v_updated_main = ROW_COUNT;

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

  GET DIAGNOSTICS v_updated_zero = ROW_COUNT;

  -- ----------------------------------------------------------------------------
  -- 3) 백필 결과 로그 (실제 영향 row 수 포함)
  -- ----------------------------------------------------------------------------
  SELECT COUNT(*) INTO v_total_dated
  FROM public.job_postings
  WHERE schedule->>'kind' IS DISTINCT FROM 'fixed';

  SELECT COUNT(*) INTO v_total_fixed
  FROM public.job_postings
  WHERE schedule->>'kind' = 'fixed';

  RAISE NOTICE
    'total_positions 사람 단위 백필 완료 (영향 row: 메인=% 빈dated=% / 전체: dated=% fixed=%)',
    v_updated_main, v_updated_zero, v_total_dated, v_total_fixed;
END $$;
