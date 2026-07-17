-- 공고그리드 + 주문서 공고작성 출시 전 보안 하드닝 (2026-07-17)
--
-- 출시 전 4축 리뷰(보안 축)가 적발한 HIGH 2건 + MEDIUM 2건 교정.
-- 대상: 주간 배치 그리드(플래그 ON 전) + 주문서 대회 공고작성.
--
-- [HIGH-1] 그리드/스태프 RPC NULL owner_id fail-open (A01 Broken Access Control)
--   add_direct_staff / remove_direct_staff / set_venue_soft_target 의 인가 게이트가
--   `owner_id = 호출자` bare 비교라, 계정삭제(ON DELETE SET NULL)로 owner_id=NULL 된
--   고아 공고에서 NULL 로 전파되어 `IF NOT (NULL OR false...)` 가 미발화 → 비인가 통과.
--   같은 baseline 의 cancel_application(:1043) 이 쓰는 COALESCE(owner=actor,false) 관용구로 고정.
--   ※ add/remove_direct_staff 는 그리드 플래그와 무관하게 이미 라이브(#229) — 즉시 노출.
--   함수 본문은 baseline(20260710000002) 실측 원본 그대로 + 게이트 한 줄 COALESCE 만 변경.
--
-- [HIGH-2] 대회 공고 자체승인 DB 게이트 부재 (A01 승인 워크플로 우회)
--   jp_insert WITH CHECK 가 역할만 검사(tournament_config 무검사)라, employer 가 raw
--   PostgREST 로 approvalStatus='approved' 직접 INSERT/UPDATE → admin 심사 없이 공개+지원수락.
--   enforce_jp_status_transition(baseline:1822) 관용구를 미러링한 BEFORE 트리거로 차단.
--   정상 승인은 approve-job-posting Edge Function(service_role, auth.uid()=NULL)이라 우회로 통과.
--
-- [M-1] jp_insert owner_id 바인딩 — ⚠️ 문서화된 지연 결정. 아래 섹션 주석 필독.
--
-- [M-2] XSS 서버 경계 확대 (A03, defense-in-depth)
--   work_logs.notes/custom_role 는 add_direct_staff 로 주입되나 XSS 트리거 부재였음.
--   job_postings 는 title/description 만 검사. applications(message,notes) 선례와 동형으로 확대.
--
-- 회귀 고정: supabase/tests/grid_order_sheet_security_hardening.test.sql
-- ⚠️ prod 적용 전: 라이브 함수 본문 파리티(pg_get_functiondef) 실측 권장(파일 기준 감사).
-- 멱등: CREATE OR REPLACE FUNCTION / DROP TRIGGER IF EXISTS + CREATE / DROP POLICY IF EXISTS + CREATE.

-- ============================================================================
-- [HIGH-1] 인가 게이트 NULL owner_id fail-closed (COALESCE 한 줄)
--   add_direct_staff / remove_direct_staff / set_venue_soft_target
-- ============================================================================

CREATE OR REPLACE FUNCTION public.add_direct_staff(p_job_posting_id uuid, p_staff_id uuid, p_assignments jsonb DEFAULT '[]'::jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_owner uuid := auth.uid();
  v_job record;
  v_staff record;
  v_is_fixed boolean;
  v_work_log_ids uuid[] := '{}';
  v_wl_id uuid;
  v_assignment jsonb;
  v_now timestamptz := now();
  v_existing int;
  v_capacity int;
  v_rec record;
  v_already int;
BEGIN
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 인증이 필요합니다';
  END IF;
  IF jsonb_array_length(COALESCE(p_assignments, '[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'INVALID_INPUT: 배정(날짜/역할) 정보가 필요합니다';
  END IF;

  SELECT id, name, nickname, photo_url, photo_url_blurhash
    INTO v_staff
  FROM public.users
  WHERE id = p_staff_id
    AND is_active = true
    AND COALESCE(status, 'active') NOT IN ('deleted', 'deactivated');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'STAFF_NOT_FOUND: 대상 사용자를 찾을 수 없습니다 (%)', p_staff_id;
  END IF;

  SELECT * INTO v_job FROM job_postings WHERE id = p_job_posting_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'POSTING_NOT_FOUND: %', p_job_posting_id;
  END IF;
  IF NOT (
    COALESCE(v_job.owner_id = v_owner, false)
    OR public.is_workspace_member(v_job.workspace_id, v_owner)
    OR public.is_posting_collaborator(v_job.id, v_owner)
    OR public.is_admin()
  ) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 공고 관리 권한이 없습니다';
  END IF;

  v_is_fixed := (v_job.schedule->>'kind') = 'fixed';

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
    WHERE wl.job_posting_id = p_job_posting_id
      AND wl.date = v_rec.a_date
      AND public._posting_slot_key(wl.time_slot) = v_rec.slot_key
      AND public._posting_role_key(wl.role::text, wl.custom_role) = v_rec.role_key
      AND wl.status NOT IN ('cancelled', 'no_show');

    SELECT COALESCE(MAX((r->>'count')::int), 0) INTO v_capacity
    FROM jsonb_array_elements(COALESCE(v_job.schedule->'requirements', '[]'::jsonb)) req
    CROSS JOIN jsonb_array_elements(COALESCE(req->'timeSlots', '[]'::jsonb)) ts
    CROSS JOIN jsonb_array_elements(COALESCE(ts->'roles', '[]'::jsonb)) r
    WHERE COALESCE(req->>'date', 'FIXED_SCHEDULE') = v_rec.a_date
      AND (CASE
            WHEN COALESCE((ts->>'isTimeToBeAnnounced')::boolean, false) THEN '미정'
            WHEN COALESCE(ts->>'startTime', ts->>'time') IS NOT NULL
              THEN public._posting_slot_key(COALESCE(ts->>'startTime', ts->>'time'))
            WHEN v_is_fixed THEN 'NEGOTIABLE'
            ELSE public._posting_slot_key(COALESCE(ts->>'startTime', ts->>'time'))
          END) = v_rec.slot_key
      AND public._posting_role_key(r->>'role', r->>'customRole') = v_rec.role_key;

    IF v_capacity > 0 AND v_existing + v_rec.requested > v_capacity THEN
      RAISE EXCEPTION 'MAX_CAPACITY_REACHED: role=% date=% slot=% (% / %)',
        v_rec.role_key, v_rec.a_date, v_rec.slot_key, v_existing + v_rec.requested, v_capacity;
    END IF;
  END LOOP;

  SELECT COUNT(*) INTO v_already
  FROM work_logs wl
  WHERE wl.job_posting_id = p_job_posting_id
    AND wl.staff_id = p_staff_id
    AND wl.status NOT IN ('cancelled', 'no_show');

  FOR v_assignment IN SELECT * FROM jsonb_array_elements(p_assignments)
  LOOP
    IF EXISTS (
      SELECT 1 FROM work_logs wl
      WHERE wl.job_posting_id = p_job_posting_id
        AND wl.staff_id = p_staff_id
        AND wl.date = (v_assignment->>'date')
        AND public._posting_slot_key(wl.time_slot)
            = public._posting_slot_key(v_assignment->>'timeSlot')
        AND public._posting_role_key(wl.role::text, wl.custom_role)
            = public._posting_role_key(v_assignment->>'role', v_assignment->>'customRole')
        AND wl.status NOT IN ('cancelled', 'no_show')
    ) THEN
      RAISE EXCEPTION 'DUPLICATE_ASSIGNMENT: 이미 추가된 스태프/일정입니다';
    END IF;

    INSERT INTO work_logs (
      staff_id, job_posting_id, application_id,
      date, time_slot,
      staff_name, staff_nickname, staff_photo_url, staff_photo_url_blurhash,
      role, custom_role, owner_id,
      status, is_fixed_posting, notes,
      created_at, updated_at
    ) VALUES (
      p_staff_id, p_job_posting_id, NULL,
      v_assignment->>'date', v_assignment->>'timeSlot',
      v_staff.name, v_staff.nickname, v_staff.photo_url, v_staff.photo_url_blurhash,
      COALESCE((v_assignment->>'role')::staff_role, 'staff'::staff_role),
      v_assignment->>'customRole', v_owner,
      'scheduled', v_is_fixed, v_assignment->>'notes',
      v_now, v_now
    ) RETURNING id INTO v_wl_id;
    v_work_log_ids := array_append(v_work_log_ids, v_wl_id);
  END LOOP;

  IF v_already = 0 AND v_job.status <> 'container'::posting_status THEN
    UPDATE job_postings SET
      filled_positions = filled_positions + 1,
      stats = jsonb_set(
        COALESCE(stats, '{}'::jsonb),
        '{filledPositions}',
        to_jsonb(COALESCE((stats->>'filledPositions')::int, 0) + 1)
      ),
      updated_at = v_now
    WHERE id = p_job_posting_id;

    UPDATE job_postings SET
      status = 'capacity_full'::posting_status,
      updated_at = v_now
    WHERE id = p_job_posting_id
      AND status = 'active'
      AND total_positions > 0
      AND filled_positions >= total_positions;
  END IF;

  RETURN jsonb_build_object(
    'jobPostingId', p_job_posting_id,
    'staffId', p_staff_id,
    'workLogIds', to_jsonb(v_work_log_ids)
  );
END;
$$;


CREATE OR REPLACE FUNCTION public.remove_direct_staff(p_work_log_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_owner uuid := auth.uid();
  v_wl record;
  v_job record;
  v_now timestamptz := now();
  v_remaining int;
BEGIN
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 인증이 필요합니다';
  END IF;

  SELECT * INTO v_wl FROM work_logs WHERE id = p_work_log_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'WORK_LOG_NOT_FOUND: %', p_work_log_id;
  END IF;

  IF v_wl.application_id IS NOT NULL THEN
    RAISE EXCEPTION 'NOT_DIRECT_STAFF: 지원서 연동 스태프는 확정 취소로 처리해야 합니다';
  END IF;

  IF v_wl.status IN ('checked_in', 'checked_out', 'completed') THEN
    RAISE EXCEPTION 'STAFF_ALREADY_CHECKED_IN: 출근 처리된 스태프는 삭제할 수 없습니다';
  END IF;

  SELECT * INTO v_job FROM job_postings WHERE id = v_wl.job_posting_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'POSTING_NOT_FOUND: %', v_wl.job_posting_id;
  END IF;
  IF NOT (
    COALESCE(v_job.owner_id = v_owner, false)
    OR public.is_workspace_member(v_job.workspace_id, v_owner)
    OR public.is_posting_collaborator(v_job.id, v_owner)
    OR public.is_admin()
  ) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 공고 관리 권한이 없습니다';
  END IF;

  DELETE FROM work_logs WHERE id = p_work_log_id;

  SELECT COUNT(*) INTO v_remaining
  FROM work_logs wl
  WHERE wl.job_posting_id = v_wl.job_posting_id
    AND wl.staff_id = v_wl.staff_id
    AND wl.status NOT IN ('cancelled', 'no_show');

  IF v_remaining = 0 AND v_job.status <> 'container'::posting_status THEN
    UPDATE job_postings SET
      filled_positions = GREATEST(filled_positions - 1, 0),
      stats = jsonb_set(
        COALESCE(stats, '{}'::jsonb),
        '{filledPositions}',
        to_jsonb(GREATEST(COALESCE((stats->>'filledPositions')::int, 0) - 1, 0))
      ),
      updated_at = v_now
    WHERE id = v_wl.job_posting_id;

    UPDATE job_postings SET
      status = 'active'::posting_status,
      updated_at = v_now
    WHERE id = v_wl.job_posting_id
      AND filled_positions < total_positions
      AND (
        status = 'capacity_full'
        OR (
          status = 'closed'
          AND COALESCE(closed_reason, '') NOT IN ('expired', 'expired_by_work_date')
        )
      );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'workLogId', p_work_log_id,
    'staffRemoved', v_remaining = 0
  );
END;
$$;


CREATE OR REPLACE FUNCTION public.set_venue_soft_target(p_venue uuid, p_date text, p_count integer) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_ws uuid;
  v_owner_id uuid;
  v_schedule jsonb;
  v_targets jsonb;
  v_date_key text;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 인증이 필요합니다';
  END IF;

  IF p_count IS NULL THEN
    RAISE EXCEPTION 'INVALID_INPUT: 목표 인원(count)이 필요합니다';
  END IF;
  IF p_count < 0 THEN
    RAISE EXCEPTION 'INVALID_INPUT: 목표 인원은 0 이상이어야 합니다 (%)', p_count;
  END IF;

  BEGIN
    v_date_key := to_char(p_date::date, 'YYYY-MM-DD');
  EXCEPTION
    WHEN invalid_datetime_format OR datetime_field_overflow OR invalid_text_representation THEN
      RAISE EXCEPTION 'INVALID_INPUT: 날짜 형식이 올바르지 않습니다 (%)', p_date;
  END;

  SELECT workspace_id, owner_id, schedule
    INTO v_ws, v_owner_id, v_schedule
  FROM public.job_postings
  WHERE id = p_venue AND status = 'container'::posting_status
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'VENUE_NOT_FOUND: %', p_venue;
  END IF;

  IF NOT (
    COALESCE(v_owner_id = v_caller, false)
    OR public.is_workspace_member(v_ws, v_caller)
    OR public.is_posting_collaborator(p_venue, v_caller)
    OR public.is_admin()
  ) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 운영처 관리 권한이 없습니다';
  END IF;

  v_targets := COALESCE(v_schedule -> 'softTargets', '{}'::jsonb);
  IF p_count = 0 THEN
    v_targets := v_targets - v_date_key;
  ELSE
    v_targets := jsonb_set(v_targets, ARRAY[v_date_key], to_jsonb(p_count), true);
  END IF;

  UPDATE public.job_postings
  SET schedule = jsonb_set(COALESCE(v_schedule, '{}'::jsonb), '{softTargets}', v_targets, true),
      updated_at = now()
  WHERE id = p_venue;

  RETURN jsonb_build_object(
    'venueId', p_venue,
    'date', v_date_key,
    'count', p_count,
    'softTargets', v_targets
  );
END;
$$;



-- ============================================================================
-- [HIGH-2] 대회 공고 승인 권한 강제 트리거
-- ============================================================================
-- enforce_jp_status_transition(baseline:1822) 과 동일 관용구:
--   SECDEF + search_path public,pg_temp + auth.uid() IS NULL 우회(service_role/Edge/마이그)
--   + admin 허용. tournament 공고가 approvalStatus='approved' 로 신규 INSERT 되거나
--   비-approved → approved 로 UPDATE 될 때 비-admin·비-service 는 차단.
CREATE OR REPLACE FUNCTION public.enforce_tournament_approval_authority()
  RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
  AS $$
DECLARE
  v_caller_uid uuid;
  v_is_admin boolean;
  v_new_status text;
  v_old_status text;
BEGIN
  -- 대회 공고가 아니면 무관
  IF NEW.posting_type IS DISTINCT FROM 'tournament' THEN
    RETURN NEW;
  END IF;

  v_new_status := NEW.tournament_config ->> 'approvalStatus';

  -- approved 로 만드는 쓰기만 관심 대상
  IF v_new_status IS DISTINCT FROM 'approved' THEN
    RETURN NEW;
  END IF;

  -- UPDATE 인데 이미 approved 였다면(승인 상태 유지) 통과
  IF TG_OP = 'UPDATE' THEN
    v_old_status := OLD.tournament_config ->> 'approvalStatus';
    IF v_old_status IS NOT DISTINCT FROM 'approved' THEN
      RETURN NEW;
    END IF;
  END IF;

  -- service_role / Edge Function / 마이그레이션(=JWT 없음) 은 우회
  -- (approve-job-posting Edge Function 이 service_role 로 UPDATE → auth.uid()=NULL)
  v_caller_uid := (SELECT auth.uid());
  IF v_caller_uid IS NULL THEN
    RETURN NEW;
  END IF;

  -- admin 은 허용
  v_is_admin := coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
    false
  );
  IF v_is_admin THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION
    'tournament_approval_admin_only: 대회 공고 승인은 관리자만 가능합니다 (id=%)',
    NEW.id
    USING ERRCODE = '42501';
END;
$$;

ALTER FUNCTION public.enforce_tournament_approval_authority() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.enforce_tournament_approval_authority() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_tournament_approval_authority ON public.job_postings;
CREATE TRIGGER trg_tournament_approval_authority
  BEFORE INSERT OR UPDATE ON public.job_postings
  FOR EACH ROW EXECUTE FUNCTION public.enforce_tournament_approval_authority();

-- ============================================================================
-- [M-1] jp_insert owner_id 바인딩  ⚠️ 문서화된 지연 결정 — 적용 전 판단 필요
-- ============================================================================
-- 배경: prod 진실 = jp_insert 역할 게이트(admin/employer)만. owner_id 바인딩은
--   pitfall_job_postings_insert_loose_rls_by_design 에서 "별도 PR 사안"으로 명시 지연됨.
--   본 섹션은 impersonation(owner_id=피해자 위조 INSERT → 피해자 명의 스캠 공고) 방어를 추가한다.
-- ⚠️ 적용 전 QA 필수: ①employer 본인 생성 ②워크스페이스 멤버 생성 ③admin 대리 생성
--   3경로가 여전히 성공하는지 확인. 정상 경로는 owner_id=생성자(auth.uid())
--   (createWithTransaction: owner_id=context.ownerId=생성자)라 바인딩이 안전할 것으로 분석되나,
--   미검증 대리-생성 경로가 있으면 이 섹션(DROP/CREATE POLICY jp_insert)만 제외하고 적용하라.
DROP POLICY IF EXISTS jp_insert ON public.job_postings;
CREATE POLICY jp_insert ON public.job_postings
  FOR INSERT
  WITH CHECK (
    ((SELECT public.get_my_role()) = ANY (ARRAY['admin'::text, 'employer'::text]))
    AND (owner_id = (SELECT auth.uid()) OR (SELECT public.get_my_role()) = 'admin')
  );

-- ============================================================================
-- [M-2] XSS 서버 경계 확대 (defense-in-depth)
-- ============================================================================
-- job_postings: title/description → + contact_phone (전화번호 텍스트, 정상값 오탐 없음)
DROP TRIGGER IF EXISTS job_postings_xss_check ON public.job_postings;
CREATE TRIGGER job_postings_xss_check
  BEFORE INSERT OR UPDATE ON public.job_postings
  FOR EACH ROW EXECUTE FUNCTION public.check_xss_fields('title', 'description', 'contact_phone');

-- work_logs: notes/custom_role 는 add_direct_staff 로 주입되나 XSS 트리거 부재였음.
--   applications(message,notes) 선례와 동형. 역할명/메모라 정상값엔 오탐 없음.
DROP TRIGGER IF EXISTS work_logs_xss_check ON public.work_logs;
CREATE TRIGGER work_logs_xss_check
  BEFORE INSERT OR UPDATE ON public.work_logs
  FOR EACH ROW EXECUTE FUNCTION public.check_xss_fields('notes', 'custom_role');
