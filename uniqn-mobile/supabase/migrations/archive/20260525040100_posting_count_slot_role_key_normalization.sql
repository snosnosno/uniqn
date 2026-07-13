-- fix(db): 공고 확정 집계/정원가드 키 정규화 + 중복행 overfill 차단 + 익명 공유링크 GRANT
--
-- 재리뷰(Claude+Codex+실DB, 2026-05-25)에서 드러난 결함 수정:
--  ① 슬롯 키 불일치: count 헬퍼/H1 가드가 raw work_logs.time_slot 사용. 앱은 extractStartTime
--     으로 정규화(범위 '14:00~22:00'→'14:00'). non-TBA 슬롯에서 v_capacity=0 → 가드 무력 + 0/N 표시.
--  ② 커스텀('other') 역할: client 가 role:'other'→'staff' 평탄화(custom_role 에 라벨 보존).
--     count 헬퍼가 role='other' 만 보고 'other:' 키를 못 만들어 'staff' 로 집계 → 정산/표시 손상.
--  ③ 단일 payload 내 동일 (date,slot,role) 2행 → 둘 다 같은 v_existing 대비 통과 → overfill.
--  ④ get_posting_filled_counts 가 anon REVOKE 라 공개/공유링크(/jobs/[id]) 가 permission denied.
--     filled/N 은 공개 카드에 이미 노출되는 count-only 데이터이므로 anon GRANT 로 해소.
--
-- 키 일관성: 표시·집계·가드 3곳이 분기하지 않도록 공유 IMMUTABLE 헬퍼로 단일화.
-- 베이스: 현행 prod confirm_application 본문(20260525035500 의 'staff' 폴백 포함) + 신규 H1.

-- ── 공유 키 헬퍼 ──────────────────────────────────────────────────────────────
-- 슬롯 키: TBA/빈값 → '미정', 그 외 '시작시각'(범위 '~'/'-' 앞부분, trim). parseTimeSlot 과 동치.
CREATE OR REPLACE FUNCTION public._posting_slot_key(p_time_slot text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $function$
  SELECT CASE
    WHEN p_time_slot IS NULL OR btrim(p_time_slot) = '' OR btrim(p_time_slot) = '미정' THEN '미정'
    ELSE btrim((regexp_split_to_array(p_time_slot, '[-~]'))[1])
  END;
$function$;

-- 역할 키: custom_role 있으면 'other:<custom>' (role 이 'staff' 로 평탄화됐어도 복원),
--          role='other' 면 'other:<custom>', 그 외 role 원본. roleMatchKey 와 동치.
CREATE OR REPLACE FUNCTION public._posting_role_key(p_role text, p_custom_role text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $function$
  SELECT CASE
    WHEN COALESCE(btrim(p_custom_role), '') <> '' THEN 'other:' || btrim(p_custom_role)
    WHEN p_role = 'other' THEN 'other:'
    ELSE p_role
  END;
$function$;

COMMENT ON FUNCTION public._posting_slot_key(text) IS '슬롯 표시/집계 공유 키 — TBA→미정, 범위→시작시각. parseTimeSlot 동치.';
COMMENT ON FUNCTION public._posting_role_key(text, text) IS '역할 표시/집계 공유 키 — custom_role 우선 other:<custom>. roleMatchKey 동치.';

-- ── 1. 집계 헬퍼: 키 정규화 적용 ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.count_posting_confirmed_by_slot(
  p_job_posting_ids uuid[]
)
RETURNS TABLE (
  job_posting_id uuid,
  work_date text,
  time_slot text,
  role_key text,
  confirmed_count int
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $function$
  SELECT
    wl.job_posting_id,
    wl.date AS work_date,
    public._posting_slot_key(wl.time_slot) AS time_slot,
    public._posting_role_key(wl.role::text, wl.custom_role) AS role_key,
    COUNT(*)::int AS confirmed_count
  FROM public.work_logs wl
  WHERE wl.job_posting_id = ANY(p_job_posting_ids)
    AND wl.status NOT IN ('cancelled', 'no_show')
  GROUP BY wl.job_posting_id, wl.date,
    public._posting_slot_key(wl.time_slot),
    public._posting_role_key(wl.role::text, wl.custom_role);
$function$;

-- 익명 공유링크(/jobs/[id]) 도 filled/N 표시 가능하도록 anon 추가(count-only, PII 없음)
GRANT EXECUTE ON FUNCTION public.get_posting_filled_counts(uuid[]) TO authenticated, anon;

-- ── 2. confirm_application: H1 가드를 키-집계 set 기반으로 재작성(중복행 차단) ──
CREATE OR REPLACE FUNCTION public.confirm_application(
  p_application_id uuid,
  p_owner_id uuid,
  p_assignments jsonb DEFAULT '[]'::jsonb,
  p_original_application jsonb DEFAULT NULL::jsonb,
  p_confirmation_history jsonb DEFAULT '[]'::jsonb,
  p_notes text DEFAULT NULL::text,
  p_is_fixed_posting boolean DEFAULT false,
  p_assignments_v3 jsonb DEFAULT NULL::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_app record;
  v_job record;
  v_work_log_ids uuid[] := '{}';
  v_wl_id uuid;
  v_assignment jsonb;
  v_now timestamptz := now();
  v_existing int;
  v_capacity int;
  v_rec record;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = p_owner_id AND is_active = true
  ) THEN
    RAISE EXCEPTION 'ACCOUNT_DISABLED: owner account is disabled (%)', p_owner_id;
  END IF;

  SELECT * INTO v_app FROM applications WHERE id = p_application_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'APPLICATION_NOT_FOUND: %', p_application_id; END IF;
  IF v_app.status != 'applied' THEN
    RAISE EXCEPTION 'INVALID_STATUS: 현재 상태 %, applied만 확정 가능', v_app.status;
  END IF;

  SELECT * INTO v_job FROM job_postings WHERE id = v_app.job_posting_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'POSTING_NOT_FOUND: %', v_app.job_posting_id; END IF;

  -- H4: 권한 술어 (RLS jp_update_workspace_member 와 정렬)
  IF NOT (
    v_job.owner_id = p_owner_id
    OR public.is_workspace_member(v_job.workspace_id, p_owner_id)
    OR public.is_posting_collaborator(v_job.id, p_owner_id)
    OR public.is_admin()
  ) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 공고 관리 권한 없음';
  END IF;

  -- H1: 역할/슬롯별 정원 가드 — 요청 payload 를 키별로 집계(중복행 합산)하여 1회 검증.
  --      키는 공유 헬퍼로 정규화(슬롯=시작시각, 역할=custom 우선) → 표시/집계와 동일.
  IF NOT p_is_fixed_posting AND jsonb_array_length(p_assignments) > 0 THEN
    FOR v_rec IN
      SELECT
        (a->>'date') AS a_date,
        public._posting_slot_key(a->>'timeSlot') AS slot_key,
        public._posting_role_key(a->>'role', a->>'customRole') AS role_key,
        COUNT(*)::int AS requested
      FROM jsonb_array_elements(p_assignments) a
      GROUP BY 1, 2, 3
    LOOP
      SELECT COUNT(*) INTO v_existing
      FROM work_logs wl
      WHERE wl.job_posting_id = v_app.job_posting_id
        AND wl.date = v_rec.a_date
        AND public._posting_slot_key(wl.time_slot) = v_rec.slot_key
        AND public._posting_role_key(wl.role::text, wl.custom_role) = v_rec.role_key
        AND wl.status NOT IN ('cancelled', 'no_show');

      SELECT COALESCE(MAX((r->>'count')::int), 0) INTO v_capacity
      FROM jsonb_array_elements(COALESCE(v_job.schedule->'requirements', '[]'::jsonb)) req
      CROSS JOIN jsonb_array_elements(COALESCE(req->'timeSlots', '[]'::jsonb)) ts
      CROSS JOIN jsonb_array_elements(COALESCE(ts->'roles', '[]'::jsonb)) r
      WHERE req->>'date' = v_rec.a_date
        AND (CASE WHEN COALESCE((ts->>'isTimeToBeAnnounced')::boolean, false)
                  THEN '미정'
                  ELSE public._posting_slot_key(COALESCE(ts->>'startTime', ts->>'time')) END) = v_rec.slot_key
        AND public._posting_role_key(r->>'role', r->>'customRole') = v_rec.role_key;

      IF v_capacity > 0 AND v_existing + v_rec.requested > v_capacity THEN
        RAISE EXCEPTION 'MAX_CAPACITY_REACHED: role=% date=% slot=% (% / %)',
          v_rec.role_key, v_rec.a_date, v_rec.slot_key, v_existing + v_rec.requested, v_capacity;
      END IF;
    END LOOP;
  END IF;

  -- work_logs INSERT (flat 포맷) — 프로덕션과 동일(blurhash 컬럼 포함, role 폴백 'staff')
  IF NOT p_is_fixed_posting AND jsonb_array_length(p_assignments) > 0 THEN
    FOR v_assignment IN SELECT * FROM jsonb_array_elements(p_assignments)
    LOOP
      INSERT INTO work_logs (
        staff_id, job_posting_id, application_id,
        assignment_group_id, date, time_slot,
        staff_name, staff_nickname, staff_photo_url, staff_photo_url_blurhash,
        role, custom_role, owner_id,
        status, is_fixed_posting,
        created_at, updated_at
      ) VALUES (
        v_app.applicant_id, v_app.job_posting_id, p_application_id,
        v_assignment->>'groupId', v_assignment->>'date', v_assignment->>'timeSlot',
        v_app.applicant_name, v_app.applicant_nickname,
        v_app.applicant_photo_url, v_app.applicant_photo_url_blurhash,
        COALESCE((v_assignment->>'role')::staff_role, 'staff'::staff_role),
        v_assignment->>'customRole', p_owner_id,
        'scheduled', false, v_now, v_now
      ) RETURNING id INTO v_wl_id;
      v_work_log_ids := array_append(v_work_log_ids, v_wl_id);
    END LOOP;
  END IF;

  UPDATE applications SET
    status = 'confirmed',
    assignments = COALESCE(p_assignments_v3, assignments),
    original_application = COALESCE(p_original_application, original_application),
    confirmation_history = p_confirmation_history,
    confirmed_at = v_now,
    processed_by = p_owner_id::text,
    processed_at = v_now,
    notes = COALESCE(p_notes, notes),
    updated_at = v_now
  WHERE id = p_application_id;

  -- confirmedApplicants 갱신은 tr_update_job_posting_stats trigger 담당(중복 증가 금지). filledPositions 만 유지.
  UPDATE job_postings SET
    filled_positions = filled_positions + 1,
    stats = jsonb_set(
      COALESCE(stats, '{}'::jsonb),
      '{filledPositions}',
      to_jsonb(COALESCE((stats->>'filledPositions')::int, 0) + 1)
    ),
    updated_at = v_now
  WHERE id = v_app.job_posting_id;

  RETURN jsonb_build_object(
    'applicationId', p_application_id,
    'workLogIds', to_jsonb(v_work_log_ids),
    'assignmentCount', jsonb_array_length(p_assignments)
  );
END;
$function$;
