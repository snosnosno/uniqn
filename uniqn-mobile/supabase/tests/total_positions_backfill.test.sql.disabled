-- ============================================================
-- Phase 7: total_positions 사람 단위 백필 회귀 테스트
-- ============================================================
-- 목적: 20260418010000_total_positions_person_basis.sql의 CTE 로직을
--       고정된 JSON schedule 케이스에 적용했을 때 사람 단위 total이
--       정확히 계산되는지 검증.
--
-- 사용법:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/total_positions_backfill.test.sql
--   기대 결과: 마지막에 'TOTAL_POSITIONS_BACKFILL_TEST_PASSED' 1행 반환, 에러 0건
--
-- 안전장치:
--   - BEGIN ... ROLLBACK 블록으로 감싸 production에서도 영속 변경 없음
--   - 마커 이메일(__sql_fixture_total_*@test.local) + 임시 uuid 사용
--   - auth.users INSERT 시 handle_new_user 트리거가 public.users 자동 생성
--
-- 시나리오:
--   T1. grouped 3일 동안 dealer×2 + floor×1 → total = 3
--   T2. 비그룹 3일 각각 dealer×2 → total = 2
--   T3. 혼합 (그룹 dealer×2 + 독립 dealer×3) → total = 3
--   T4. 멀티역할 (dealer×2 + floor×1 + serving×1) → total = 4
--   T5. fixed [dealer×2, floor×1] → total = 3
--   T6. dated + requirements=[] → total = 0
--   T7. role='other' customRole='translator' + dealer → 분리 카운트 (translator=1, dealer=2 → total=3)
-- ============================================================

BEGIN;

DO $$
DECLARE
  v_owner_id uuid := gen_random_uuid();
  v_workspace_id uuid := gen_random_uuid();
  v_t1 uuid := gen_random_uuid();  -- grouped 3일 dealer×2 + floor×1 → 3
  v_t2 uuid := gen_random_uuid();  -- 비그룹 3일 각 dealer×2 → 2
  v_t3 uuid := gen_random_uuid();  -- 혼합 dealer×2 + dealer×3 → 3
  v_t4 uuid := gen_random_uuid();  -- 멀티역할 → 4
  v_t5 uuid := gen_random_uuid();  -- fixed [dealer×2, floor×1] → 3
  v_t6 uuid := gen_random_uuid();  -- dated + requirements=[] → 0
  v_t7 uuid := gen_random_uuid();  -- role='other' customRole 분리 → 3
  v_got int;
BEGIN
  -- owner seed (auth.users → trigger → public.users)
  INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (
    v_owner_id, '__sql_fixture_total_owner@test.local',
    '{"role":"employer"}'::jsonb, '{"name":"TOTAL_OWNER"}'::jsonb,
    now(), now()
  );

  -- public.users 명시 INSERT (handle_new_user 트리거 CI 미작동 대비)
  INSERT INTO public.users (id, email, name, role, is_active, created_at, updated_at)
  VALUES (v_owner_id, '__sql_fixture_total_owner@test.local', 'fixture', 'employer'::user_role, true, now(), now())
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, is_active = EXCLUDED.is_active;

  -- workspace seed (job_postings.workspace_id NOT NULL 충족 — PR #88 schema 변경)
  INSERT INTO public.workspaces (id, name, owner_id, created_at, updated_at)
  VALUES (v_workspace_id, '__sql_fixture_total_ws', v_owner_id, now(), now());

  -- ============================================================
  -- T1: grouped 3일, 각 timeSlot에 dealer×2 + floor×1 (3일 반복)
  --     역할별 MAX: dealer=2, floor=1 → SUM = 3
  -- ============================================================
  INSERT INTO public.job_postings (id, owner_id, workspace_id, title, status, total_positions, filled_positions, schedule)
  VALUES (
    v_t1, v_owner_id, v_workspace_id, '__sql_fixture_total_t1', 'draft', 999, 0,
    jsonb_build_object(
      'kind', 'dated',
      'requirements', jsonb_build_array(
        jsonb_build_object('date', '2026-05-01', 'timeSlots', jsonb_build_array(
          jsonb_build_object('roles', jsonb_build_array(
            jsonb_build_object('role', 'dealer', 'count', 2, 'customRole', NULL),
            jsonb_build_object('role', 'floor',  'count', 1, 'customRole', NULL)
          ))
        )),
        jsonb_build_object('date', '2026-05-02', 'timeSlots', jsonb_build_array(
          jsonb_build_object('roles', jsonb_build_array(
            jsonb_build_object('role', 'dealer', 'count', 2, 'customRole', NULL),
            jsonb_build_object('role', 'floor',  'count', 1, 'customRole', NULL)
          ))
        )),
        jsonb_build_object('date', '2026-05-03', 'timeSlots', jsonb_build_array(
          jsonb_build_object('roles', jsonb_build_array(
            jsonb_build_object('role', 'dealer', 'count', 2, 'customRole', NULL),
            jsonb_build_object('role', 'floor',  'count', 1, 'customRole', NULL)
          ))
        ))
      )
    )
  );

  -- ============================================================
  -- T2: 비그룹 3일, 각 dealer×2 (동일 역할, 날짜만 다름)
  --     역할별 MAX: dealer=2 → SUM = 2
  -- ============================================================
  INSERT INTO public.job_postings (id, owner_id, workspace_id, title, status, total_positions, filled_positions, schedule)
  VALUES (
    v_t2, v_owner_id, v_workspace_id, '__sql_fixture_total_t2', 'draft', 999, 0,
    jsonb_build_object(
      'kind', 'dated',
      'requirements', jsonb_build_array(
        jsonb_build_object('date', '2026-05-01', 'timeSlots', jsonb_build_array(
          jsonb_build_object('roles', jsonb_build_array(
            jsonb_build_object('role', 'dealer', 'count', 2, 'customRole', NULL)
          ))
        )),
        jsonb_build_object('date', '2026-05-02', 'timeSlots', jsonb_build_array(
          jsonb_build_object('roles', jsonb_build_array(
            jsonb_build_object('role', 'dealer', 'count', 2, 'customRole', NULL)
          ))
        )),
        jsonb_build_object('date', '2026-05-03', 'timeSlots', jsonb_build_array(
          jsonb_build_object('roles', jsonb_build_array(
            jsonb_build_object('role', 'dealer', 'count', 2, 'customRole', NULL)
          ))
        ))
      )
    )
  );

  -- ============================================================
  -- T3: 혼합 — day1 dealer×2, day2 dealer×3
  --     dealer MAX = 3 → SUM = 3
  -- ============================================================
  INSERT INTO public.job_postings (id, owner_id, workspace_id, title, status, total_positions, filled_positions, schedule)
  VALUES (
    v_t3, v_owner_id, v_workspace_id, '__sql_fixture_total_t3', 'draft', 999, 0,
    jsonb_build_object(
      'kind', 'dated',
      'requirements', jsonb_build_array(
        jsonb_build_object('date', '2026-05-01', 'timeSlots', jsonb_build_array(
          jsonb_build_object('roles', jsonb_build_array(
            jsonb_build_object('role', 'dealer', 'count', 2, 'customRole', NULL)
          ))
        )),
        jsonb_build_object('date', '2026-05-02', 'timeSlots', jsonb_build_array(
          jsonb_build_object('roles', jsonb_build_array(
            jsonb_build_object('role', 'dealer', 'count', 3, 'customRole', NULL)
          ))
        ))
      )
    )
  );

  -- ============================================================
  -- T4: 멀티역할 단일 날짜 — dealer×2 + floor×1 + serving×1
  --     → SUM = 4
  -- ============================================================
  INSERT INTO public.job_postings (id, owner_id, workspace_id, title, status, total_positions, filled_positions, schedule)
  VALUES (
    v_t4, v_owner_id, v_workspace_id, '__sql_fixture_total_t4', 'draft', 999, 0,
    jsonb_build_object(
      'kind', 'dated',
      'requirements', jsonb_build_array(
        jsonb_build_object('date', '2026-05-01', 'timeSlots', jsonb_build_array(
          jsonb_build_object('roles', jsonb_build_array(
            jsonb_build_object('role', 'dealer',  'count', 2, 'customRole', NULL),
            jsonb_build_object('role', 'floor',   'count', 1, 'customRole', NULL),
            jsonb_build_object('role', 'serving', 'count', 1, 'customRole', NULL)
          ))
        ))
      )
    )
  );

  -- ============================================================
  -- T5: fixed roleRequirements [dealer×2, floor×1] → SUM = 3
  -- ============================================================
  INSERT INTO public.job_postings (id, owner_id, workspace_id, title, status, total_positions, filled_positions, schedule)
  VALUES (
    v_t5, v_owner_id, v_workspace_id, '__sql_fixture_total_t5', 'draft', 999, 0,
    jsonb_build_object(
      'kind', 'fixed',
      'roleRequirements', jsonb_build_array(
        jsonb_build_object('role', 'dealer', 'count', 2),
        jsonb_build_object('role', 'floor',  'count', 1)
      )
    )
  );

  -- ============================================================
  -- T6: dated + requirements=[] → 0
  -- ============================================================
  INSERT INTO public.job_postings (id, owner_id, workspace_id, title, status, total_positions, filled_positions, schedule)
  VALUES (
    v_t6, v_owner_id, v_workspace_id, '__sql_fixture_total_t6', 'draft', 999, 0,
    jsonb_build_object('kind', 'dated', 'requirements', '[]'::jsonb)
  );

  -- ============================================================
  -- T7: role='other' customRole='translator' + dealer×2
  --     translator MAX = 1, dealer MAX = 2 → SUM = 3
  -- ============================================================
  INSERT INTO public.job_postings (id, owner_id, workspace_id, title, status, total_positions, filled_positions, schedule)
  VALUES (
    v_t7, v_owner_id, v_workspace_id, '__sql_fixture_total_t7', 'draft', 999, 0,
    jsonb_build_object(
      'kind', 'dated',
      'requirements', jsonb_build_array(
        jsonb_build_object('date', '2026-05-01', 'timeSlots', jsonb_build_array(
          jsonb_build_object('roles', jsonb_build_array(
            jsonb_build_object('role', 'other',  'count', 1, 'customRole', 'translator'),
            jsonb_build_object('role', 'dealer', 'count', 2, 'customRole', NULL)
          ))
        ))
      )
    )
  );

  -- ============================================================
  -- 백필 CTE 실행 (마이그레이션 본체와 동일 로직, 테스트 대상 postings만 한정 X
  -- → idempotent UPDATE이므로 다른 postings에도 안전하지만, BEGIN/ROLLBACK으로 보호)
  -- ============================================================
  WITH role_max AS (
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
      AND NULLIF(role_elem->>'role', '') IS NOT NULL
      AND jp.id IN (v_t1, v_t2, v_t3, v_t4, v_t7)
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
      AND jp.id = v_t5
    GROUP BY jp.id
  ),
  posting_totals AS (
    SELECT posting_id, total FROM dated_totals
    UNION ALL
    SELECT posting_id, total FROM fixed_totals
  )
  UPDATE public.job_postings jp
  SET total_positions = pt.total, updated_at = now()
  FROM posting_totals pt
  WHERE jp.id = pt.posting_id;

  -- 빈 dated 케이스 보정
  UPDATE public.job_postings
  SET total_positions = 0, updated_at = now()
  WHERE id = v_t6
    AND schedule->>'kind' IS DISTINCT FROM 'fixed'
    AND (
      schedule->'requirements' IS NULL
      OR jsonb_typeof(schedule->'requirements') != 'array'
      OR jsonb_array_length(schedule->'requirements') = 0
    );

  -- ============================================================
  -- 검증
  -- ============================================================
  SELECT total_positions INTO v_got FROM public.job_postings WHERE id = v_t1;
  IF v_got IS DISTINCT FROM 3 THEN
    RAISE EXCEPTION 'T1 fail: grouped 3days dealer×2+floor×1 expected total=3, got %', v_got;
  END IF;

  SELECT total_positions INTO v_got FROM public.job_postings WHERE id = v_t2;
  IF v_got IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'T2 fail: 3days dealer×2 expected total=2 (person basis), got %', v_got;
  END IF;

  SELECT total_positions INTO v_got FROM public.job_postings WHERE id = v_t3;
  IF v_got IS DISTINCT FROM 3 THEN
    RAISE EXCEPTION 'T3 fail: mixed dealer×2 + dealer×3 expected total=3, got %', v_got;
  END IF;

  SELECT total_positions INTO v_got FROM public.job_postings WHERE id = v_t4;
  IF v_got IS DISTINCT FROM 4 THEN
    RAISE EXCEPTION 'T4 fail: multi-role dealer×2+floor×1+serving×1 expected total=4, got %', v_got;
  END IF;

  SELECT total_positions INTO v_got FROM public.job_postings WHERE id = v_t5;
  IF v_got IS DISTINCT FROM 3 THEN
    RAISE EXCEPTION 'T5 fail: fixed [dealer×2, floor×1] expected total=3, got %', v_got;
  END IF;

  SELECT total_positions INTO v_got FROM public.job_postings WHERE id = v_t6;
  IF v_got IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'T6 fail: dated + requirements=[] expected total=0, got %', v_got;
  END IF;

  SELECT total_positions INTO v_got FROM public.job_postings WHERE id = v_t7;
  IF v_got IS DISTINCT FROM 3 THEN
    RAISE EXCEPTION 'T7 fail: other:translator(1) + dealer(2) expected total=3, got %', v_got;
  END IF;

  -- ============================================================
  -- Cleanup (ROLLBACK이 모든 변경을 되돌리지만, 명시적으로도 삭제)
  -- ============================================================
  DELETE FROM public.job_postings WHERE id IN (v_t1, v_t2, v_t3, v_t4, v_t5, v_t6, v_t7);
  DELETE FROM public.workspaces WHERE id = v_workspace_id;
  DELETE FROM auth.users WHERE id = v_owner_id;
END $$;

ROLLBACK;

SELECT 'TOTAL_POSITIONS_BACKFILL_TEST_PASSED' AS result;
