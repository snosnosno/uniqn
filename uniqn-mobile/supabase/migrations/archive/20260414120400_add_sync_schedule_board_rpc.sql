-- =============================================================================
-- Root fix: sync_schedule_board(uuid) PL/pgSQL RPC
-- =============================================================================
-- 목적: board_posts + board_memberships sync를 단일 PostgreSQL 트랜잭션으로
--       처리. 기존 boardService.syncScheduleBoardForJobPosting (TS)의 SQL 포팅.
--
--       outbox processor (Edge Function)가 이 RPC를 호출하면, board sync 로직 자체는
--       서버 사이드 단일 트랜잭션으로 race-free 실행됨. 이는 root resolution이며,
--       향후 pg_cron 도입 시 Edge Function 자체도 제거 가능.
--
-- 호환성: TS boardService.executeUpsertSchedulePost / executeReplaceScheduleMemberships
--         의 알고리즘과 동일 결과를 내도록 작성. 차이 발생 시 TS가 source of truth.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- helper 1: format_compensation_label(compensation jsonb) -> text
-- TS: formatCompensationLabel(jobPosting)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._format_compensation_label(p_compensation jsonb)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_amount numeric;
  v_type text;
  v_label text;
BEGIN
  IF p_compensation IS NULL THEN
    RETURN '';
  END IF;

  v_amount := NULLIF((p_compensation #>> '{defaultSalary,amount}'), '')::numeric;
  v_type := p_compensation #>> '{defaultSalary,type}';

  IF v_amount IS NULL OR v_type IS NULL THEN
    RETURN '';
  END IF;

  v_label := CASE v_type
    WHEN 'hourly' THEN '시급'
    WHEN 'daily' THEN '일급'
    WHEN 'monthly' THEN '월급'
    WHEN 'other' THEN '급여'
    ELSE '급여'
  END;

  -- to_char with FM removes leading whitespace; group by 3 digits with comma
  RETURN v_label || ' ' || to_char(v_amount, 'FM999,999,999,999') || '원';
END;
$$;

-- ---------------------------------------------------------------------------
-- helper 2: build_schedule_board_body(job_postings_row) -> text
-- TS: buildScheduleBoardBody(jobPosting)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._build_schedule_board_body(p_jp job_postings)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_lines text[] := ARRAY[]::text[];
  v_dates_label text;
  v_compensation_label text;
  v_location_name text;
  v_description text;
BEGIN
  v_dates_label := CASE
    WHEN p_jp.work_dates IS NOT NULL AND array_length(p_jp.work_dates, 1) > 0
      THEN array_to_string(p_jp.work_dates, ', ')
    ELSE COALESCE(p_jp.work_date, '')
  END;

  v_location_name := COALESCE(p_jp.location ->> 'name', '미정');
  v_compensation_label := public._format_compensation_label(p_jp.compensation);

  v_lines := v_lines || ('공고명: ' || COALESCE(p_jp.title, ''));
  v_lines := v_lines || ('근무일: ' || v_dates_label);
  v_lines := v_lines || ('장소: ' || v_location_name);

  IF v_compensation_label <> '' THEN
    v_lines := v_lines || ('급여: ' || v_compensation_label);
  END IF;

  v_lines := v_lines || (
    '모집 인원: ' || COALESCE(p_jp.filled_positions, 0)::text
    || '/' || COALESCE(p_jp.total_positions, 0)::text
  );

  v_description := COALESCE(p_jp.description, '');
  IF length(trim(v_description)) > 0 THEN
    v_lines := v_lines || '';
    -- Note: TS uses sanitizeBoardText for description. SQL 포팅에서는
    -- 단순 trim만 수행. XSS 방어는 클라이언트 렌더 단계에서 처리.
    v_lines := v_lines || trim(v_description);
  END IF;

  RETURN array_to_string(v_lines, E'\n');
END;
$$;

-- ---------------------------------------------------------------------------
-- main: sync_schedule_board(p_job_posting_id uuid)
-- TS: syncScheduleBoardForJobPosting + executeUpsertSchedulePost +
--     executeReplaceScheduleMemberships
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_schedule_board(p_job_posting_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_jp job_postings%ROWTYPE;
  v_post_id text;
  v_now timestamptz := now();
  v_body text;
  v_owner_name text;
  v_compensation_label text;
  v_base_date text;
  v_member_count int := 0;
  v_post_existed boolean;
  v_job_summary jsonb;
BEGIN
  -- 1. job_posting 조회 (없으면 archived 처리)
  SELECT * INTO v_jp FROM job_postings WHERE id = p_job_posting_id FOR UPDATE;

  IF NOT FOUND THEN
    -- 게시글 존재 시 archived로 마킹
    v_post_id := 'schedule_' || p_job_posting_id::text;
    UPDATE board_posts
       SET status = 'archived',
           updated_at = v_now,
           last_activity_at = v_now
     WHERE id = v_post_id;
    RETURN jsonb_build_object(
      'success', true,
      'archived', true,
      'job_posting_id', p_job_posting_id,
      'post_id', v_post_id
    );
  END IF;

  v_post_id := 'schedule_' || v_jp.id::text;
  v_owner_name := COALESCE(v_jp.owner_name, '구인자');
  v_body := public._build_schedule_board_body(v_jp);
  v_compensation_label := public._format_compensation_label(v_jp.compensation);
  v_base_date := COALESCE(
    v_jp.work_date,
    CASE WHEN v_jp.work_dates IS NOT NULL AND array_length(v_jp.work_dates, 1) > 0
         THEN v_jp.work_dates[1] ELSE '' END,
    ''
  );

  v_job_summary := jsonb_build_object(
    'jobPostingId', v_jp.id::text,
    'title', v_jp.title,
    'workDate', COALESCE(v_jp.work_date, ''),
    'workDates', COALESCE(to_jsonb(v_jp.work_dates), '[]'::jsonb),
    'locationName', COALESCE(v_jp.location ->> 'name', ''),
    'totalPositions', COALESCE(v_jp.total_positions, 0),
    'filledPositions', COALESCE(v_jp.filled_positions, 0),
    'compensationLabel', v_compensation_label,
    'jobPostingStatus', COALESCE(v_jp.status::text, '')
  );

  -- 2. board_posts upsert
  SELECT EXISTS (SELECT 1 FROM board_posts WHERE id = v_post_id) INTO v_post_existed;

  IF v_post_existed THEN
    UPDATE board_posts SET
      board_type = 'schedule',
      source = 'board',
      title = v_jp.title,
      body = v_body,
      author_id = v_jp.owner_id,
      author_name = v_owner_name,
      author_role = 'employer',
      visibility = 'participants_only',
      linked_job_posting_id = v_jp.id,
      is_auto_created = true,
      image_attachments = '[]'::jsonb,
      last_activity_at = v_now,
      updated_at = v_now,
      job_summary = v_job_summary
    WHERE id = v_post_id;
  ELSE
    INSERT INTO board_posts (
      id, board_type, source, title, body, author_id, author_name, author_role,
      visibility, linked_job_posting_id, is_auto_created, image_attachments,
      last_activity_at, updated_at, job_summary, status, is_locked, locked_by, locked_at,
      like_count, dislike_count, comment_count, view_count, created_at
    ) VALUES (
      v_post_id, 'schedule', 'board', v_jp.title, v_body, v_jp.owner_id, v_owner_name, 'employer',
      'participants_only', v_jp.id, true, '[]'::jsonb,
      v_now, v_now, v_job_summary, 'active', false, NULL, NULL,
      0, 0, 0, 0, v_now
    );
  END IF;

  -- 3. board_memberships 재구성 (author + 활성 work_logs staff)
  -- 3a. author 보장
  INSERT INTO board_memberships (
    id, board_type, user_id, post_id, job_posting_id, role, display_name,
    can_read, can_comment, title, work_date, author_id, last_activity_at,
    created_at, updated_at
  ) VALUES (
    gen_random_uuid(), 'schedule', v_jp.owner_id, v_post_id, v_jp.id, 'author',
    v_owner_name,
    true, true, v_jp.title, v_base_date, v_jp.owner_id, v_now,
    v_now, v_now
  )
  ON CONFLICT (user_id, post_id) DO UPDATE SET
    role = 'author',
    display_name = EXCLUDED.display_name,
    title = EXCLUDED.title,
    work_date = EXCLUDED.work_date,
    last_activity_at = v_now,
    updated_at = v_now;

  v_member_count := v_member_count + 1;

  -- 3b. 활성 work_logs staff upsert (cancelled 제외, staff당 1행)
  WITH active_staff AS (
    SELECT DISTINCT ON (wl.staff_id)
      wl.staff_id,
      wl.staff_name,
      wl.staff_nickname,
      wl.date AS work_date,
      COALESCE(wl.updated_at, wl.created_at, v_now) AS last_activity_at
    FROM work_logs wl
    WHERE wl.job_posting_id = v_jp.id
      AND wl.status::text != 'cancelled'
      AND wl.staff_id IS DISTINCT FROM v_jp.owner_id
    ORDER BY wl.staff_id, wl.updated_at DESC NULLS LAST
  ),
  upserted AS (
    INSERT INTO board_memberships (
      id, board_type, user_id, post_id, job_posting_id, role, display_name,
      can_read, can_comment, title, work_date, author_id, last_activity_at,
      created_at, updated_at
    )
    SELECT
      gen_random_uuid(), 'schedule', s.staff_id, v_post_id, v_jp.id, 'confirmed',
      COALESCE(NULLIF(s.staff_nickname, ''), NULLIF(s.staff_name, ''),
               '스태프 ' || right(s.staff_id::text, 4)),
      true, true, v_jp.title, COALESCE(s.work_date, v_base_date), v_jp.owner_id,
      s.last_activity_at, v_now, v_now
    FROM active_staff s
    ON CONFLICT (user_id, post_id) DO UPDATE SET
      role = EXCLUDED.role,
      display_name = EXCLUDED.display_name,
      title = EXCLUDED.title,
      work_date = EXCLUDED.work_date,
      last_activity_at = EXCLUDED.last_activity_at,
      updated_at = v_now
    RETURNING user_id
  )
  SELECT count(*) INTO v_member_count FROM upserted;

  -- 3c. 더 이상 활성이 아닌 staff 멤버십 삭제 (author 제외)
  DELETE FROM board_memberships bm
  WHERE bm.post_id = v_post_id
    AND bm.board_type::text = 'schedule'
    AND bm.user_id IS DISTINCT FROM v_jp.owner_id
    AND NOT EXISTS (
      SELECT 1 FROM work_logs wl
      WHERE wl.job_posting_id = v_jp.id
        AND wl.staff_id = bm.user_id
        AND wl.status::text != 'cancelled'
    );

  RETURN jsonb_build_object(
    'success', true,
    'archived', false,
    'job_posting_id', p_job_posting_id,
    'post_id', v_post_id,
    'created', NOT v_post_existed,
    'member_count', v_member_count + 1  -- staff + author
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_schedule_board(uuid) TO service_role;
-- authenticated에는 권한 부여하지 않음. outbox processor (service_role)만 호출.

COMMENT ON FUNCTION public.sync_schedule_board(uuid) IS
  'Schedule board sync (board_posts + board_memberships)를 단일 트랜잭션으로 처리. outbox processor가 호출. boardService.syncScheduleBoardForJobPosting (TS)의 PL/pgSQL 포팅이며 동일 결과 보장이 목표. job_posting이 없으면 board_posts를 archived로 마킹.';

COMMENT ON FUNCTION public._format_compensation_label(jsonb) IS
  'sync_schedule_board 헬퍼: jobPosting.compensation jsonb → 한국어 급여 라벨';

COMMENT ON FUNCTION public._build_schedule_board_body(job_postings) IS
  'sync_schedule_board 헬퍼: job_postings 행 → 게시글 본문 markdown 텍스트';
