-- 공고 워크스페이스 협업 편집 (PR #4 — M2 백필)
-- production-critical: 모든 employer 에 1인 워크스페이스 자동 생성 + 본인 공고 workspace_id 채움.
-- 트랜잭션 boundary: 함수 1회 호출 = 단일 트랜잭션. 실패 시 자동 rollback.
-- 멱등성: 이미 owner 인 워크스페이스가 있으면 스킵, 이미 채워진 workspace_id 도 스킵.
-- 적용 후 검증: jp_null_workspace = 0 AND owner_workspace_drift = 0.

DO $$
DECLARE
  v_seeded_workspaces integer := 0;
  v_backfilled_postings integer := 0;
  v_null_remaining integer;
BEGIN
  -- 1) 기존 employer 1인 워크스페이스 자동 생성 (멱등)
  WITH inserted AS (
    INSERT INTO public.workspaces (id, name, owner_id, member_count, created_at)
    SELECT
      gen_random_uuid(),
      COALESCE(NULLIF(u.name, ''), NULLIF(u.email, ''), '내') || ' 워크스페이스',
      u.id,
      0,
      now()
    FROM public.users u
    WHERE u.role = 'employer'
      AND u.is_active = true
      AND NOT EXISTS (SELECT 1 FROM public.workspaces w WHERE w.owner_id = u.id)
    RETURNING 1
  )
  SELECT count(*) INTO v_seeded_workspaces FROM inserted;
  RAISE NOTICE '워크스페이스 신규 생성: %', v_seeded_workspaces;

  -- 2) 본인 공고 workspace_id 채움 (NULL 인 row 만, 멱등)
  WITH backfilled AS (
    UPDATE public.job_postings jp
    SET workspace_id = w.id
    FROM public.workspaces w
    WHERE jp.owner_id = w.owner_id
      AND jp.workspace_id IS NULL
    RETURNING 1
  )
  SELECT count(*) INTO v_backfilled_postings FROM backfilled;
  RAISE NOTICE '공고 backfill: %', v_backfilled_postings;

  -- 3) 검증 — active employer 가 작성한 공고는 NULL 이면 안 됨
  SELECT count(*)
  INTO v_null_remaining
  FROM public.job_postings jp
  WHERE jp.workspace_id IS NULL
    AND jp.owner_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = jp.owner_id AND u.role = 'employer' AND u.is_active = true
    );

  IF v_null_remaining > 0 THEN
    RAISE EXCEPTION 'BACKFILL_INCOMPLETE: % active-employer job_postings still have NULL workspace_id', v_null_remaining;
  END IF;

  RAISE NOTICE 'M2 백필 완료 — 신규 워크스페이스 % / 백필 공고 % / 잔여 NULL 0', v_seeded_workspaces, v_backfilled_postings;
END$$;
