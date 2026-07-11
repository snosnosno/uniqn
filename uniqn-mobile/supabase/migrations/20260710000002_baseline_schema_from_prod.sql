--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: pg_database_owner
--

CREATE SCHEMA IF NOT EXISTS public;


ALTER SCHEMA public OWNER TO pg_database_owner;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: pg_database_owner
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: announcement_category; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.announcement_category AS ENUM (
    'notice',
    'update',
    'event',
    'maintenance'
);


ALTER TYPE public.announcement_category OWNER TO postgres;

--
-- Name: announcement_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.announcement_status AS ENUM (
    'draft',
    'published',
    'archived'
);


ALTER TYPE public.announcement_status OWNER TO postgres;

--
-- Name: application_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.application_status AS ENUM (
    'applied',
    'confirmed',
    'rejected',
    'cancelled',
    'completed',
    'cancellation_pending'
);


ALTER TYPE public.application_status OWNER TO postgres;

--
-- Name: board_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.board_type AS ENUM (
    'notice',
    'schedule',
    'free',
    'tda',
    'substitute'
);


ALTER TYPE public.board_type OWNER TO postgres;

--
-- Name: inquiry_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.inquiry_status AS ENUM (
    'open',
    'in_progress',
    'closed'
);


ALTER TYPE public.inquiry_status OWNER TO postgres;

--
-- Name: notification_category; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.notification_category AS ENUM (
    'application',
    'attendance',
    'settlement',
    'job',
    'system',
    'admin',
    'review'
);


ALTER TYPE public.notification_category OWNER TO postgres;

--
-- Name: ops_event_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.ops_event_type AS ENUM (
    'tournament_created',
    'tournament_status_changed',
    'registration_toggled',
    'player_registered',
    'player_checked_in',
    'player_rebuy',
    'player_addon',
    'player_busted',
    'player_reentered',
    'player_moved',
    'seat_freed',
    'table_added',
    'table_closed',
    'table_redraw',
    'prize_assigned',
    'level_play',
    'level_pause',
    'level_set',
    'prize_structure_set',
    'player_bust_undone',
    'prize_corrected',
    'posting_linked',
    'posting_unlinked',
    'staff_imported',
    'staff_added',
    'staff_removed',
    'table_staff_assigned',
    'table_staff_unassigned'
);


ALTER TYPE public.ops_event_type OWNER TO postgres;

--
-- Name: ops_participant_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.ops_participant_status AS ENUM (
    'registered',
    'checked_in',
    'active',
    'busted',
    'no_show'
);


ALTER TYPE public.ops_participant_status OWNER TO postgres;

--
-- Name: ops_table_lock_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.ops_table_lock_type AS ENUM (
    'none',
    'locked',
    'feature'
);


ALTER TYPE public.ops_table_lock_type OWNER TO postgres;

--
-- Name: ops_table_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.ops_table_status AS ENUM (
    'open',
    'closed',
    'standby'
);


ALTER TYPE public.ops_table_status OWNER TO postgres;

--
-- Name: ops_tournament_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.ops_tournament_status AS ENUM (
    'upcoming',
    'active',
    'completed'
);


ALTER TYPE public.ops_tournament_status OWNER TO postgres;

--
-- Name: payroll_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.payroll_status AS ENUM (
    'pending',
    'completed',
    'failed'
);


ALTER TYPE public.payroll_status OWNER TO postgres;

--
-- Name: posting_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.posting_status AS ENUM (
    'draft',
    'pending',
    'approved',
    'active',
    'capacity_full',
    'closed',
    'cancelled',
    'expired',
    'rejected',
    'container'
);


ALTER TYPE public.posting_status OWNER TO postgres;

--
-- Name: posting_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.posting_type AS ENUM (
    'regular',
    'fixed',
    'tournament',
    'urgent'
);


ALTER TYPE public.posting_type OWNER TO postgres;

--
-- Name: report_severity; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.report_severity AS ENUM (
    'low',
    'medium',
    'high',
    'critical'
);


ALTER TYPE public.report_severity OWNER TO postgres;

--
-- Name: review_sentiment; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.review_sentiment AS ENUM (
    'positive',
    'neutral',
    'negative'
);


ALTER TYPE public.review_sentiment OWNER TO postgres;

--
-- Name: staff_role; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.staff_role AS ENUM (
    'dealer',
    'floor',
    'serving',
    'manager',
    'staff',
    'other'
);


ALTER TYPE public.staff_role OWNER TO postgres;

--
-- Name: user_role; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.user_role AS ENUM (
    'admin',
    'employer',
    'staff'
);


ALTER TYPE public.user_role OWNER TO postgres;

--
-- Name: work_log_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.work_log_status AS ENUM (
    'scheduled',
    'checked_in',
    'checked_out',
    'completed',
    'cancelled',
    'no_show'
);


ALTER TYPE public.work_log_status OWNER TO postgres;

--
-- Name: workspace_role; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.workspace_role AS ENUM (
    'editor'
);


ALTER TYPE public.workspace_role OWNER TO postgres;

SET default_table_access_method = heap;

--
-- Name: job_postings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.job_postings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    schema_version integer DEFAULT 3,
    title text NOT NULL,
    description text,
    status public.posting_status DEFAULT 'draft'::public.posting_status NOT NULL,
    owner_id uuid,
    owner_name text,
    posting_type public.posting_type DEFAULT 'regular'::public.posting_type,
    work_date text,
    work_dates text[],
    last_work_date date,
    role_keys text[],
    total_positions integer DEFAULT 0,
    filled_positions integer DEFAULT 0,
    view_count integer DEFAULT 0,
    stats jsonb DEFAULT '{"filledPositions": 0, "totalApplicants": 0, "activeApplicants": 0, "confirmedApplicants": 0, "cancellationPendingApplicants": 0}'::jsonb,
    closed_at timestamp with time zone,
    closed_reason text,
    tags text[],
    contact_phone text,
    location jsonb DEFAULT '{}'::jsonb NOT NULL,
    schedule jsonb DEFAULT '{}'::jsonb NOT NULL,
    role_catalog jsonb DEFAULT '[]'::jsonb,
    compensation jsonb DEFAULT '{}'::jsonb,
    questions jsonb DEFAULT '{"items": []}'::jsonb,
    fixed_config jsonb,
    tournament_config jsonb,
    urgent_config jsonb,
    rejection_reason text,
    og_image_url text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    og_image_url_blurhash text,
    workspace_id uuid NOT NULL,
    venue_id uuid,
    CONSTRAINT job_postings_closed_reason_check CHECK ((closed_reason = ANY (ARRAY['manual'::text, 'expired'::text, 'expired_by_work_date'::text, 'owner_deleted'::text])))
);


ALTER TABLE public.job_postings OWNER TO postgres;

--
-- Name: COLUMN job_postings.og_image_url_blurhash; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.job_postings.og_image_url_blurhash IS 'impeccable v2 §18. OG 이미지 blurhash 해시. 공고 카드 placeholder.';


--
-- Name: COLUMN job_postings.workspace_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.job_postings.workspace_id IS 'NOT NULL 보장 (M3 — PR #5). RLS 가 workspace 멤버십으로 권한 강제.';


--
-- Name: _build_schedule_board_body(public.job_postings); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public._build_schedule_board_body(p_jp public.job_postings) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO 'public'
    AS $$
DECLARE
  v_lines text[] := ARRAY[]::text[];
  v_description text;
BEGIN
  v_lines := v_lines || (
    '이 게시글은 "' || COALESCE(p_jp.title, '') ||
    '"의 단체 대화방이에요. 공지사항, 문의사항, 소통 등 자유롭게 사용가능합니다.'
  );

  v_description := COALESCE(p_jp.description, '');
  IF length(trim(v_description)) > 0 THEN
    v_lines := v_lines || '';
    -- XSS 방어는 클라이언트 렌더 단계에서 처리.
    v_lines := v_lines || trim(v_description);
  END IF;

  RETURN array_to_string(v_lines, E'\n');
END;
$$;


ALTER FUNCTION public._build_schedule_board_body(p_jp public.job_postings) OWNER TO postgres;

--
-- Name: _fmt_worklog_time(timestamp with time zone); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public._fmt_worklog_time(p_ts timestamp with time zone) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO 'public'
    AS $$
BEGIN
  IF p_ts IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN to_char(p_ts AT TIME ZONE 'Asia/Seoul', 'HH24:MI');
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;


ALTER FUNCTION public._fmt_worklog_time(p_ts timestamp with time zone) OWNER TO postgres;

--
-- Name: FUNCTION _fmt_worklog_time(p_ts timestamp with time zone); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public._fmt_worklog_time(p_ts timestamp with time zone) IS 'work_logs.check_in_ts 등 timestamptz 를 Asia/Seoul HH:MM 으로 포맷. NULL 입력 → NULL.';


--
-- Name: _format_compensation_label(jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public._format_compensation_label(p_compensation jsonb) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO 'public'
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

  RETURN v_label || ' ' || to_char(v_amount, 'FM999,999,999,999') || '원';
END;
$$;


ALTER FUNCTION public._format_compensation_label(p_compensation jsonb) OWNER TO postgres;

--
-- Name: _posting_role_key(text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public._posting_role_key(p_role text, p_custom_role text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
  SELECT CASE
    WHEN COALESCE(btrim(p_custom_role), '') <> '' THEN 'other:' || btrim(p_custom_role)
    WHEN p_role = 'other' THEN 'other:'
    ELSE p_role
  END;
$$;


ALTER FUNCTION public._posting_role_key(p_role text, p_custom_role text) OWNER TO postgres;

--
-- Name: FUNCTION _posting_role_key(p_role text, p_custom_role text); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public._posting_role_key(p_role text, p_custom_role text) IS '역할 표시/집계 공유 키 — custom_role 우선 other:<custom>. roleMatchKey 동치.';


--
-- Name: _posting_slot_key(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public._posting_slot_key(p_time_slot text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
  SELECT CASE
    WHEN p_time_slot IS NULL OR btrim(p_time_slot) = '' OR btrim(p_time_slot) = '미정' THEN '미정'
    ELSE btrim((regexp_split_to_array(p_time_slot, '[-~]'))[1])
  END;
$$;


ALTER FUNCTION public._posting_slot_key(p_time_slot text) OWNER TO postgres;

--
-- Name: FUNCTION _posting_slot_key(p_time_slot text); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public._posting_slot_key(p_time_slot text) IS '슬롯 표시/집계 공유 키 — TBA→미정, 범위→시작시각. parseTimeSlot 동치.';


--
-- Name: accept_workspace_invitation(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.accept_workspace_invitation(p_invitation_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_inv record;
  v_already_member boolean;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
  END IF;

  -- FOR UPDATE 로 동시 수락 race 차단
  SELECT * INTO v_inv FROM public.workspace_invitations WHERE id = p_invitation_id FOR UPDATE;
  IF v_inv IS NULL THEN
    RAISE EXCEPTION 'INVITATION_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF v_inv.invitee_user_id != v_caller_id THEN
    RAISE EXCEPTION 'PERMISSION_DENIED' USING ERRCODE = '42501';
  END IF;

  -- 멱등성: 이미 accepted 이고 멤버 row 존재하면 success ack
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = v_inv.workspace_id AND user_id = v_caller_id
  ) INTO v_already_member;

  IF v_inv.status = 'accepted' AND v_already_member THEN
    RETURN jsonb_build_object(
      'invitationId', v_inv.id,
      'workspaceId', v_inv.workspace_id,
      'idempotent', true
    );
  END IF;

  IF v_inv.status != 'pending' THEN
    RAISE EXCEPTION 'INVITATION_%', upper(v_inv.status) USING ERRCODE = 'P0001';
  END IF;

  IF v_inv.expires_at < now() THEN
    -- 자동 만료 처리
    UPDATE public.workspace_invitations
      SET status = 'expired', responded_at = now()
      WHERE id = p_invitation_id;
    RAISE EXCEPTION 'INVITATION_EXPIRED' USING ERRCODE = 'P0001';
  END IF;

  -- atomic: member INSERT + invitation status update
  INSERT INTO public.workspace_members (workspace_id, user_id, invited_by, role)
  VALUES (v_inv.workspace_id, v_caller_id, v_inv.invited_by, v_inv.role)
  ON CONFLICT (workspace_id, user_id) DO NOTHING;

  UPDATE public.workspace_invitations
    SET status = 'accepted', responded_at = now()
    WHERE id = p_invitation_id;

  RETURN jsonb_build_object(
    'invitationId', v_inv.id,
    'workspaceId', v_inv.workspace_id,
    'idempotent', false
  );
END;
$$;


ALTER FUNCTION public.accept_workspace_invitation(p_invitation_id uuid) OWNER TO postgres;

--
-- Name: FUNCTION accept_workspace_invitation(p_invitation_id uuid); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.accept_workspace_invitation(p_invitation_id uuid) IS '초대 수락 — atomic + idempotent. FOR UPDATE 로 동시 수락 race 차단.';


--
-- Name: add_direct_staff(uuid, uuid, jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.add_direct_staff(p_job_posting_id uuid, p_staff_id uuid, p_assignments jsonb DEFAULT '[]'::jsonb) RETURNS jsonb
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
    v_job.owner_id = v_owner
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


ALTER FUNCTION public.add_direct_staff(p_job_posting_id uuid, p_staff_id uuid, p_assignments jsonb) OWNER TO postgres;

--
-- Name: FUNCTION add_direct_staff(p_job_posting_id uuid, p_staff_id uuid, p_assignments jsonb); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.add_direct_staff(p_job_posting_id uuid, p_staff_id uuid, p_assignments jsonb) IS '지원서 없이 스태프(work_logs) 직접 추가. 정원가드 + person-basis filled +1(컨테이너는 R1 SKIP) + active→capacity_full 전이.';


--
-- Name: apply_with_capacity_check(uuid, uuid, text, text, text, text, text, text, text, text, text, text, text, jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.apply_with_capacity_check(p_applicant_id uuid, p_job_posting_id uuid, p_applicant_name text, p_applicant_phone text DEFAULT NULL::text, p_applicant_email text DEFAULT NULL::text, p_applicant_nickname text DEFAULT NULL::text, p_applicant_photo_url text DEFAULT NULL::text, p_applicant_role text DEFAULT NULL::text, p_custom_role text DEFAULT NULL::text, p_job_posting_title text DEFAULT NULL::text, p_job_posting_date text DEFAULT NULL::text, p_recruitment_type text DEFAULT NULL::text, p_message text DEFAULT NULL::text, p_assignments jsonb DEFAULT '[]'::jsonb, p_pre_question_answers jsonb DEFAULT NULL::jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_posting record; v_existing record; v_total_positions int; v_active_count int;
  v_application_id uuid; v_now timestamptz := now(); v_is_reapply boolean := false;
BEGIN
  IF auth.uid() IS NULL OR (auth.uid() IS DISTINCT FROM p_applicant_id AND NOT public.is_admin()) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'PERMISSION_DENIED', 'message', '본인만 지원할 수 있습니다.');
  END IF;

  SELECT id, status, total_positions, filled_positions, schedule INTO v_posting
  FROM job_postings WHERE id = p_job_posting_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'NOT_FOUND', 'message', '공고를 찾을 수 없습니다.');
  END IF;
  IF v_posting.status != 'active' THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'POSTING_CLOSED', 'message', '지원이 마감된 공고입니다.');
  END IF;

  SELECT id, status INTO v_existing FROM applications
  WHERE job_posting_id = p_job_posting_id AND applicant_id = p_applicant_id;
  IF FOUND THEN
    IF v_existing.status != 'cancelled' THEN
      RETURN jsonb_build_object('success', false, 'error_code', 'ALREADY_APPLIED', 'message', '이미 지원한 공고입니다.', 'application_id', v_existing.id);
    END IF;
    v_is_reapply := true;
    v_application_id := v_existing.id;
  END IF;

  v_total_positions := COALESCE(v_posting.total_positions, 0);
  IF v_total_positions > 0 THEN
    SELECT count(*) INTO v_active_count FROM applications
    WHERE job_posting_id = p_job_posting_id AND status IN ('applied', 'confirmed', 'cancellation_pending');
    IF v_active_count >= v_total_positions THEN
      RETURN jsonb_build_object('success', false, 'error_code', 'CAPACITY_FULL', 'message', '모집 인원이 마감되었습니다.', 'total_positions', v_total_positions, 'active_count', v_active_count);
    END IF;
  END IF;

  IF v_is_reapply THEN
    UPDATE applications SET
      status = 'applied', applicant_name = p_applicant_name, applicant_phone = p_applicant_phone,
      applicant_email = p_applicant_email, applicant_nickname = p_applicant_nickname,
      applicant_photo_url = p_applicant_photo_url, applicant_role = p_applicant_role::staff_role,
      custom_role = p_custom_role, job_posting_title = p_job_posting_title, job_posting_date = p_job_posting_date,
      recruitment_type = p_recruitment_type, message = p_message, assignments = p_assignments,
      pre_question_answers = p_pre_question_answers, is_read = false, cancelled_at = NULL,
      cancellation_request = NULL, rejection_reason = NULL, updated_at = v_now
    WHERE id = v_application_id;
  ELSE
    INSERT INTO applications (
      applicant_id, job_posting_id, status, applicant_name, applicant_phone, applicant_email,
      applicant_nickname, applicant_photo_url, applicant_role, custom_role,
      job_posting_title, job_posting_date, recruitment_type, message,
      assignments, pre_question_answers, is_read, created_at, updated_at
    ) VALUES (
      p_applicant_id, p_job_posting_id, 'applied', p_applicant_name, p_applicant_phone, p_applicant_email,
      p_applicant_nickname, p_applicant_photo_url, p_applicant_role::staff_role, p_custom_role,
      p_job_posting_title, p_job_posting_date, p_recruitment_type, p_message,
      p_assignments, p_pre_question_answers, false, v_now, v_now
    ) RETURNING id INTO v_application_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'application_id', v_application_id, 'is_reapply', v_is_reapply);
END;
$$;


ALTER FUNCTION public.apply_with_capacity_check(p_applicant_id uuid, p_job_posting_id uuid, p_applicant_name text, p_applicant_phone text, p_applicant_email text, p_applicant_nickname text, p_applicant_photo_url text, p_applicant_role text, p_custom_role text, p_job_posting_title text, p_job_posting_date text, p_recruitment_type text, p_message text, p_assignments jsonb, p_pre_question_answers jsonb) OWNER TO postgres;

--
-- Name: FUNCTION apply_with_capacity_check(p_applicant_id uuid, p_job_posting_id uuid, p_applicant_name text, p_applicant_phone text, p_applicant_email text, p_applicant_nickname text, p_applicant_photo_url text, p_applicant_role text, p_custom_role text, p_job_posting_title text, p_job_posting_date text, p_recruitment_type text, p_message text, p_assignments jsonb, p_pre_question_answers jsonb); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.apply_with_capacity_check(p_applicant_id uuid, p_job_posting_id uuid, p_applicant_name text, p_applicant_phone text, p_applicant_email text, p_applicant_nickname text, p_applicant_photo_url text, p_applicant_role text, p_custom_role text, p_job_posting_title text, p_job_posting_date text, p_recruitment_type text, p_message text, p_assignments jsonb, p_pre_question_answers jsonb) IS '원자적 지원 처리: FOR UPDATE 잠금으로 동시 지원 race condition 방지. 정원 확인 + 중복 체크 + 삽입을 하나의 트랜잭션으로 실행.';


--
-- Name: approve_employer_application(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.approve_employer_application(p_app_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_app      RECORD;
  v_affected INT;
  v_now      TIMESTAMPTZ := now();
BEGIN
  IF (auth.jwt() -> 'app_metadata' ->> 'role') IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'UNAUTHORIZED: 관리자 권한이 필요합니다';
  END IF;

  SELECT * INTO v_app FROM employer_applications WHERE id = p_app_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'EMPLOYER_APP_NOT_FOUND: 신청 내역을 찾을 수 없습니다';
  END IF;

  IF v_app.user_id IS NOT DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'EMPLOYER_APP_SELF_APPROVE: 본인 신청을 직접 처리할 수 없습니다';
  END IF;

  UPDATE employer_applications
  SET status = 'approved', reviewed_at = v_now, reviewed_by = auth.uid()
  WHERE id = p_app_id AND status = 'pending';

  GET DIAGNOSTICS v_affected = ROW_COUNT;

  IF v_affected = 0 THEN
    RAISE EXCEPTION 'EMPLOYER_APP_ALREADY_PROCESSED: 이미 처리된 신청입니다';
  END IF;

  UPDATE users
  SET role = 'employer', employer_registered_at = v_now, updated_at = v_now
  WHERE id = v_app.user_id;

  RETURN jsonb_build_object(
    'success', true, 'applicationId', p_app_id,
    'userId', v_app.user_id, 'reviewedAt', v_now
  );
END;
$$;


ALTER FUNCTION public.approve_employer_application(p_app_id uuid) OWNER TO postgres;

--
-- Name: archive_workspace(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.archive_workspace(p_workspace_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_owner_id uuid;
  v_archived_at timestamptz;
  v_active_count int;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
  END IF;

  SELECT owner_id, archived_at INTO v_owner_id, v_archived_at
  FROM public.workspaces WHERE id = p_workspace_id FOR UPDATE;

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'WORKSPACE_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF v_owner_id != v_caller_id THEN
    RAISE EXCEPTION 'PERMISSION_DENIED' USING ERRCODE = '42501';
  END IF;

  IF v_archived_at IS NOT NULL THEN
    RETURN;
  END IF;

  SELECT count(*)::int INTO v_active_count
  FROM public.job_postings
  WHERE workspace_id = p_workspace_id
    AND status IN ('active', 'approved', 'pending');

  IF v_active_count > 0 THEN
    RAISE EXCEPTION 'WORKSPACE_HAS_ACTIVE_POSTINGS:%', v_active_count USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.workspaces SET archived_at = now() WHERE id = p_workspace_id;
END;
$$;


ALTER FUNCTION public.archive_workspace(p_workspace_id uuid) OWNER TO postgres;

--
-- Name: FUNCTION archive_workspace(p_workspace_id uuid); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.archive_workspace(p_workspace_id uuid) IS '워크스페이스 소프트 삭제. owner 전용. 진행공고(active/approved/pending) 있으면 WORKSPACE_HAS_ACTIVE_POSTINGS:N 차단. 멱등. 2026-05-24.';


--
-- Name: cancel_application_atomically(uuid, text, uuid, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.cancel_application_atomically(p_application_id uuid, p_actor_type text, p_actor_id uuid, p_cancel_reason text DEFAULT NULL::text, p_rejection_reason text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_application applications%ROWTYPE; v_job_posting job_postings%ROWTYPE;
  v_active_confirmation_entry jsonb; v_active_confirmation_index int;
  v_confirmation_history jsonb := '[]'::jsonb; v_deleted_work_log_count int := 0;
  v_now text := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_now_ts timestamptz := now(); v_assignment_count int := 0; v_new_filled int;
  v_new_status text; v_updated_cancellation_request jsonb;
BEGIN
  -- [보안] 호출자 바인딩: p_actor_id 는 호출자 본인(또는 admin)이어야 함.
  IF auth.uid() IS NULL OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  SELECT * INTO v_application FROM applications WHERE id = p_application_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'application_not_found'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_actor_id AND is_active = true) THEN
    RETURN jsonb_build_object('success', false, 'error', 'account_disabled'); END IF;

  -- 멱등 처리
  IF p_actor_type = 'staff_initiates' AND v_application.status = 'applied' THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true); END IF;
  IF p_actor_type = 'employer_initiates' AND v_application.status = 'applied' THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true); END IF;
  IF p_actor_type = 'staff_approves_cancel_request' AND v_application.status = 'cancelled' THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true); END IF;

  -- 상태 전제 검증
  IF p_actor_type IN ('staff_initiates', 'employer_initiates') THEN
    IF v_application.status != 'confirmed' THEN RETURN jsonb_build_object('success', false, 'error', 'invalid_status_for_cancellation'); END IF;
  ELSIF p_actor_type = 'staff_approves_cancel_request' THEN
    IF v_application.status != 'cancellation_pending' THEN RETURN jsonb_build_object('success', false, 'error', 'invalid_status_for_approval'); END IF;
    IF (v_application.cancellation_request->>'status') != 'pending' THEN RETURN jsonb_build_object('success', false, 'error', 'cancellation_request_not_pending'); END IF;
  ELSE RETURN jsonb_build_object('success', false, 'error', 'invalid_actor_type'); END IF;

  SELECT * INTO v_job_posting FROM job_postings WHERE id = v_application.job_posting_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'job_posting_not_found'); END IF;

  -- 행위자별 인가
  -- owner_id 는 nullable(계정삭제 시 ON DELETE SET NULL) — NULL = p_actor_id 가 NULL 로 전파되면
  -- NOT(NULL OR false...) = NULL 이라 IF 미발화 → fail-open. COALESCE 로 fail-closed 고정
  -- (보안리뷰 MEDIUM, 기존 staff_approves 분기도 동일 하드닝 적용).
  IF p_actor_type IN ('staff_approves_cancel_request', 'employer_initiates') THEN
    IF NOT (COALESCE(v_job_posting.owner_id = p_actor_id, false) OR public.is_workspace_member(v_job_posting.workspace_id, p_actor_id)
      OR public.is_posting_collaborator(v_job_posting.id, p_actor_id) OR public.is_admin()) THEN
      RETURN jsonb_build_object('success', false, 'error', 'unauthorized'); END IF;
  ELSIF p_actor_type = 'staff_initiates' THEN
    IF v_application.applicant_id != p_actor_id THEN RETURN jsonb_build_object('success', false, 'error', 'unauthorized'); END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM work_logs WHERE application_id = p_application_id AND status IN ('checked_in', 'checked_out')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'staff_already_checked_in'); END IF;

  v_confirmation_history := COALESCE(v_application.confirmation_history, '[]'::jsonb);
  SELECT value, ordinality - 1 INTO v_active_confirmation_entry, v_active_confirmation_index
  FROM jsonb_array_elements(v_confirmation_history) WITH ORDINALITY WHERE (value->>'cancelled_at') IS NULL LIMIT 1;
  IF v_active_confirmation_entry IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'no_active_confirmation'); END IF;
  v_confirmation_history := jsonb_set(v_confirmation_history, ARRAY[v_active_confirmation_index::text, 'cancelled_at'], to_jsonb(v_now));
  v_confirmation_history := jsonb_set(v_confirmation_history, ARRAY[v_active_confirmation_index::text, 'cancelled_by'], to_jsonb(p_actor_id));
  v_confirmation_history := jsonb_set(v_confirmation_history, ARRAY[v_active_confirmation_index::text, 'cancellation_reason'], COALESCE(to_jsonb(p_cancel_reason), 'null'::jsonb));

  -- 전이 결과 상태: 본인 취소·구인자 해제는 applied 복귀, 취소요청 승인은 cancelled
  IF p_actor_type IN ('staff_initiates', 'employer_initiates') THEN v_new_status := 'applied';
  ELSE v_new_status := 'cancelled';
    v_updated_cancellation_request := v_application.cancellation_request || jsonb_build_object('status', 'approved', 'reviewed_at', v_now, 'reviewed_by', p_actor_id);
  END IF;

  UPDATE applications SET status = v_new_status::application_status, confirmation_history = v_confirmation_history,
    cancellation_request = COALESCE(v_updated_cancellation_request, cancellation_request), cancelled_at = v_now_ts, updated_at = v_now_ts
  WHERE id = p_application_id;

  -- 구인자 확정해제는 스태프에게 직접 통지
  -- (confirmed→applied 전이는 notify_on_application_update 트리거가 다루지 않음)
  IF p_actor_type = 'employer_initiates' THEN
    BEGIN
      INSERT INTO public.notifications (recipient_id, type, title, body, link, data, priority)
      VALUES (
        v_application.applicant_id,
        'confirmation_cancelled',
        '확정 취소',
        format('%s 확정이 취소되었습니다.',
          CASE WHEN v_job_posting.title IS NULL OR v_job_posting.title = '' THEN '해당 공고'
               ELSE format('''%s''', v_job_posting.title) END),
        '/schedule',
        jsonb_build_object(
          'applicationId', v_application.id,
          'jobPostingId', v_application.job_posting_id,
          'jobPostingTitle', COALESCE(v_job_posting.title, ''),
          'senderId', p_actor_id
        ),
        'high'
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[cancel_application_atomically] employer notify failed for % — %', p_application_id, SQLERRM;
    END;
  END IF;

  SELECT COUNT(*)::int INTO v_assignment_count FROM jsonb_array_elements(v_active_confirmation_entry->'assignments') a
  CROSS JOIN LATERAL jsonb_array_elements((a->>'dates')::jsonb) d;
  UPDATE job_postings SET
    status = CASE
      WHEN status = 'capacity_full' AND filled_positions < total_positions THEN 'active'::posting_status
      WHEN status = 'closed' AND closed_reason IN ('expired', 'expired_by_work_date') THEN 'closed'::posting_status
      WHEN status = 'closed' AND filled_positions < total_positions THEN 'active'::posting_status
      ELSE status
    END, updated_at = v_now_ts
  WHERE id = v_job_posting.id;
  SELECT filled_positions INTO v_new_filled FROM job_postings WHERE id = v_job_posting.id;
  DELETE FROM work_logs WHERE application_id = p_application_id AND status = 'scheduled';
  GET DIAGNOSTICS v_deleted_work_log_count = ROW_COUNT;
  RETURN jsonb_build_object('success', true, 'application_id', p_application_id, 'new_status', v_new_status,
    'assignment_count', v_assignment_count, 'new_filled_positions', v_new_filled,
    'deleted_work_log_count', v_deleted_work_log_count, 'cancelled_at', v_now);
END;
$$;


ALTER FUNCTION public.cancel_application_atomically(p_application_id uuid, p_actor_type text, p_actor_id uuid, p_cancel_reason text, p_rejection_reason text) OWNER TO postgres;

--
-- Name: FUNCTION cancel_application_atomically(p_application_id uuid, p_actor_type text, p_actor_id uuid, p_cancel_reason text, p_rejection_reason text); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.cancel_application_atomically(p_application_id uuid, p_actor_type text, p_actor_id uuid, p_cancel_reason text, p_rejection_reason text) IS '지원 취소 원자 RPC (person basis). filled_positions -= 1 (사람 단위, assignment_count는 반환 JSON에 유지).';


--
-- Name: check_email_exists(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.check_email_exists(p_email text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS(SELECT 1 FROM public.users WHERE email = p_email);
$$;


ALTER FUNCTION public.check_email_exists(p_email text) OWNER TO postgres;

--
-- Name: check_ip_rate_limit(text, integer, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.check_ip_rate_limit(p_ip text, p_max_requests integer DEFAULT 100, p_window_seconds integer DEFAULT 60) RETURNS jsonb
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
  SELECT public.check_rate_limit('ip:' || p_ip, p_max_requests, p_window_seconds);
$$;


ALTER FUNCTION public.check_ip_rate_limit(p_ip text, p_max_requests integer, p_window_seconds integer) OWNER TO postgres;

--
-- Name: check_nickname_exists(text, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.check_nickname_exists(p_nickname text, p_exclude_uid uuid DEFAULT NULL::uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.users WHERE nickname = p_nickname
    AND (p_exclude_uid IS NULL OR id != p_exclude_uid)
  );
$$;


ALTER FUNCTION public.check_nickname_exists(p_nickname text, p_exclude_uid uuid) OWNER TO postgres;

--
-- Name: check_phone_exists(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.check_phone_exists(p_phone text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS(SELECT 1 FROM public.users WHERE phone = p_phone);
$$;


ALTER FUNCTION public.check_phone_exists(p_phone text) OWNER TO postgres;

--
-- Name: check_rate_limit(text, integer, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.check_rate_limit(p_key text, p_max_requests integer DEFAULT 30, p_window_seconds integer DEFAULT 60) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
DECLARE
  v_record RECORD;
  v_now timestamptz := now();
  v_window_start timestamptz := v_now - (p_window_seconds || ' seconds')::interval;
  v_allowed boolean;
  v_remaining int;
BEGIN
  -- rate_limits 행 조회 또는 생성
  SELECT * INTO v_record FROM public.rate_limits WHERE key = p_key FOR UPDATE;

  IF v_record IS NULL THEN
    -- 첫 요청: 새 행 생성
    INSERT INTO public.rate_limits (key, tokens, last_refill, expires_at)
    VALUES (p_key, p_max_requests - 1, v_now, v_now + (p_window_seconds * 2 || ' seconds')::interval);

    RETURN jsonb_build_object('allowed', true, 'remaining', p_max_requests - 1, 'retryAfter', 0);
  END IF;

  -- 윈도우 리필 확인
  IF v_record.last_refill < v_window_start THEN
    -- 윈도우가 지남 → 토큰 리필
    UPDATE public.rate_limits
    SET tokens = p_max_requests - 1,
        last_refill = v_now,
        expires_at = v_now + (p_window_seconds * 2 || ' seconds')::interval
    WHERE key = p_key;

    RETURN jsonb_build_object('allowed', true, 'remaining', p_max_requests - 1, 'retryAfter', 0);
  END IF;

  -- 토큰 확인
  IF v_record.tokens > 0 THEN
    UPDATE public.rate_limits
    SET tokens = tokens - 1
    WHERE key = p_key;

    RETURN jsonb_build_object('allowed', true, 'remaining', v_record.tokens - 1, 'retryAfter', 0);
  ELSE
    -- 한도 초과
    v_remaining := EXTRACT(EPOCH FROM (v_record.last_refill + (p_window_seconds || ' seconds')::interval - v_now))::int;

    RETURN jsonb_build_object(
      'allowed', false,
      'remaining', 0,
      'retryAfter', GREATEST(v_remaining, 1)
    );
  END IF;
END;
$$;


ALTER FUNCTION public.check_rate_limit(p_key text, p_max_requests integer, p_window_seconds integer) OWNER TO postgres;

--
-- Name: check_user_rate_limit(uuid, text, integer, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.check_user_rate_limit(p_user_id uuid, p_operation text, p_max_requests integer DEFAULT 30, p_window_seconds integer DEFAULT 60) RETURNS jsonb
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
  SELECT public.check_rate_limit('user:' || p_user_id::text || ':' || p_operation, p_max_requests, p_window_seconds);
$$;


ALTER FUNCTION public.check_user_rate_limit(p_user_id uuid, p_operation text, p_max_requests integer, p_window_seconds integer) OWNER TO postgres;

--
-- Name: check_xss_fields(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.check_xss_fields() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $_$
DECLARE
  field_value TEXT;
  field_name TEXT;
  xss_pattern TEXT := '<\s*script|javascript\s*:|on\w+\s*=|<\s*iframe|<\s*object|<\s*embed';
BEGIN
  FOR field_name IN SELECT unnest(TG_ARGV)
  LOOP
    EXECUTE format('SELECT ($1).%I::text', field_name) INTO field_value USING NEW;
    IF field_value IS NOT NULL AND field_value ~* xss_pattern THEN
      RAISE EXCEPTION 'XSS pattern detected in field: %', field_name;
    END IF;
  END LOOP;
  RETURN NEW;
END;
$_$;


ALTER FUNCTION public.check_xss_fields() OWNER TO postgres;

--
-- Name: confirm_application(uuid, uuid, jsonb, jsonb, jsonb, text, boolean, jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.confirm_application(p_application_id uuid, p_owner_id uuid, p_assignments jsonb DEFAULT '[]'::jsonb, p_original_application jsonb DEFAULT NULL::jsonb, p_confirmation_history jsonb DEFAULT '[]'::jsonb, p_notes text DEFAULT NULL::text, p_is_fixed_posting boolean DEFAULT false, p_assignments_v3 jsonb DEFAULT NULL::jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_app record; v_job record; v_work_log_ids uuid[] := '{}'; v_wl_id uuid; v_assignment jsonb;
  v_now timestamptz := now(); v_existing int; v_capacity int; v_rec record; v_is_fixed boolean;
BEGIN
  IF auth.uid() IS NULL OR (auth.uid() IS DISTINCT FROM p_owner_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_owner_id AND is_active = true) THEN
    RAISE EXCEPTION 'ACCOUNT_DISABLED: owner account is disabled (%)', p_owner_id;
  END IF;

  SELECT * INTO v_app FROM applications WHERE id = p_application_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'APPLICATION_NOT_FOUND: %', p_application_id; END IF;
  IF v_app.status != 'applied' THEN
    RAISE EXCEPTION 'INVALID_STATUS: 현재 상태 %, applied만 확정 가능', v_app.status;
  END IF;

  SELECT * INTO v_job FROM job_postings WHERE id = v_app.job_posting_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'POSTING_NOT_FOUND: %', v_app.job_posting_id; END IF;

  v_is_fixed := (v_job.schedule->>'kind') = 'fixed';

  IF NOT (v_job.owner_id = p_owner_id OR public.is_workspace_member(v_job.workspace_id, p_owner_id)
    OR public.is_posting_collaborator(v_job.id, p_owner_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 공고 관리 권한 없음';
  END IF;

  IF jsonb_array_length(p_assignments) > 0 THEN
    FOR v_rec IN
      SELECT (a->>'date') AS a_date, public._posting_slot_key(a->>'timeSlot') AS slot_key,
        public._posting_role_key(a->>'role', a->>'customRole') AS role_key, COUNT(*)::int AS requested
      FROM jsonb_array_elements(p_assignments) a GROUP BY 1, 2, 3
    LOOP
      SELECT COUNT(*) INTO v_existing FROM work_logs wl
      WHERE wl.job_posting_id = v_app.job_posting_id AND wl.date = v_rec.a_date
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
  END IF;

  IF jsonb_array_length(p_assignments) > 0 THEN
    FOR v_assignment IN SELECT * FROM jsonb_array_elements(p_assignments)
    LOOP
      INSERT INTO work_logs (
        staff_id, job_posting_id, application_id, assignment_group_id, date, time_slot,
        staff_name, staff_nickname, staff_photo_url, staff_photo_url_blurhash,
        role, custom_role, owner_id, status, is_fixed_posting, created_at, updated_at
      ) VALUES (
        v_app.applicant_id, v_app.job_posting_id, p_application_id,
        v_assignment->>'groupId', v_assignment->>'date', v_assignment->>'timeSlot',
        v_app.applicant_name, v_app.applicant_nickname, v_app.applicant_photo_url, v_app.applicant_photo_url_blurhash,
        COALESCE((v_assignment->>'role')::staff_role, 'staff'::staff_role),
        v_assignment->>'customRole', p_owner_id, 'scheduled', v_is_fixed, v_now, v_now
      ) RETURNING id INTO v_wl_id;
      v_work_log_ids := array_append(v_work_log_ids, v_wl_id);
    END LOOP;
  END IF;

  UPDATE applications SET
    status = 'confirmed', assignments = COALESCE(p_assignments_v3, assignments),
    original_application = COALESCE(p_original_application, original_application),
    confirmation_history = p_confirmation_history, confirmed_at = v_now,
    processed_by = p_owner_id::text, processed_at = v_now, notes = COALESCE(p_notes, notes), updated_at = v_now
  WHERE id = p_application_id;

  RETURN jsonb_build_object('applicationId', p_application_id, 'workLogIds', to_jsonb(v_work_log_ids),
    'assignmentCount', jsonb_array_length(p_assignments));
END;
$$;


ALTER FUNCTION public.confirm_application(p_application_id uuid, p_owner_id uuid, p_assignments jsonb, p_original_application jsonb, p_confirmation_history jsonb, p_notes text, p_is_fixed_posting boolean, p_assignments_v3 jsonb) OWNER TO postgres;

--
-- Name: FUNCTION confirm_application(p_application_id uuid, p_owner_id uuid, p_assignments jsonb, p_original_application jsonb, p_confirmation_history jsonb, p_notes text, p_is_fixed_posting boolean, p_assignments_v3 jsonb); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.confirm_application(p_application_id uuid, p_owner_id uuid, p_assignments jsonb, p_original_application jsonb, p_confirmation_history jsonb, p_notes text, p_is_fixed_posting boolean, p_assignments_v3 jsonb) IS '지원서 확정 RPC (person basis). applications.assignments=v3 canonical, work_logs=flat 전개, filled_positions += 1 (사람 단위).';


--
-- Name: count_posting_confirmed_by_slot(uuid[]); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.count_posting_confirmed_by_slot(p_job_posting_ids uuid[]) RETURNS TABLE(job_posting_id uuid, work_date text, time_slot text, role_key text, confirmed_count integer)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
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
$$;


ALTER FUNCTION public.count_posting_confirmed_by_slot(p_job_posting_ids uuid[]) OWNER TO postgres;

--
-- Name: FUNCTION count_posting_confirmed_by_slot(p_job_posting_ids uuid[]); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.count_posting_confirmed_by_slot(p_job_posting_ids uuid[]) IS '공고별 (date,time_slot,role) 활성 확정 수 집계(카운트만 반환, PII 없음). H0 표시 + H1 가드 공용.';


--
-- Name: create_report(text, text, uuid, text, uuid, text, uuid, text, text, text[], public.report_severity, uuid, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.create_report(p_type text, p_reporter_type text, p_reporter_id uuid, p_reporter_name text, p_target_id uuid, p_target_name text, p_job_posting_id uuid, p_job_posting_title text, p_description text, p_evidence_urls text[], p_severity public.report_severity, p_work_log_id uuid DEFAULT NULL::uuid, p_work_date text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_report_id           uuid;
  v_existing_report_id  uuid;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_reporter_id THEN
    RAISE EXCEPTION 'FORBIDDEN: 본인 계정으로만 신고할 수 있습니다 (auth.uid=%, p_reporter_id=%)',
      auth.uid(), p_reporter_id
      USING ERRCODE = 'P0001';
  END IF;

  IF p_reporter_id = p_target_id THEN
    RAISE EXCEPTION 'CANNOT_REPORT_SELF: 본인을 신고할 수 없습니다'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_reporter_type NOT IN ('employer', 'employee') THEN
    RAISE EXCEPTION 'INVALID_REPORTER_TYPE: 유효하지 않은 신고자 유형 (%)', p_reporter_type
      USING ERRCODE = 'P0001';
  END IF;

  SELECT id INTO v_existing_report_id
    FROM public.reports
    WHERE reporter_id     = p_reporter_id
      AND target_id       = p_target_id
      AND job_posting_id  = p_job_posting_id
      AND type            = p_type
      AND created_at      > now() - interval '24 hours'
    LIMIT 1;

  IF v_existing_report_id IS NOT NULL THEN
    RAISE EXCEPTION 'DUPLICATE_REPORT: 24시간 내 동일 건을 이미 신고했습니다 (existing=%)',
      v_existing_report_id
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.reports (
    type,
    reporter_type,
    reporter_id,
    reporter_name,
    target_id,
    target_name,
    job_posting_id,
    job_posting_title,
    work_log_id,
    work_date,
    description,
    evidence_urls,
    severity,
    status
  )
  VALUES (
    p_type,
    p_reporter_type,
    p_reporter_id,
    p_reporter_name,
    p_target_id,
    p_target_name,
    p_job_posting_id,
    NULLIF(p_job_posting_title, ''),
    p_work_log_id,
    p_work_date,
    p_description,
    COALESCE(p_evidence_urls, ARRAY[]::text[]),
    p_severity,
    'pending'
  )
  RETURNING id INTO v_report_id;

  RETURN jsonb_build_object('report_id', v_report_id);
END;
$$;


ALTER FUNCTION public.create_report(p_type text, p_reporter_type text, p_reporter_id uuid, p_reporter_name text, p_target_id uuid, p_target_name text, p_job_posting_id uuid, p_job_posting_title text, p_description text, p_evidence_urls text[], p_severity public.report_severity, p_work_log_id uuid, p_work_date text) OWNER TO postgres;

--
-- Name: FUNCTION create_report(p_type text, p_reporter_type text, p_reporter_id uuid, p_reporter_name text, p_target_id uuid, p_target_name text, p_job_posting_id uuid, p_job_posting_title text, p_description text, p_evidence_urls text[], p_severity public.report_severity, p_work_log_id uuid, p_work_date text); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.create_report(p_type text, p_reporter_type text, p_reporter_id uuid, p_reporter_name text, p_target_id uuid, p_target_name text, p_job_posting_id uuid, p_job_posting_title text, p_description text, p_evidence_urls text[], p_severity public.report_severity, p_work_log_id uuid, p_work_date text) IS '양방향 신고 생성 RPC. auth.uid 일치 검증, 본인/중복(24h) 차단, reports INSERT. AFTER INSERT 트리거가 관리자 알림 자동 생성. jsonb { report_id: uuid } 반환.';


--
-- Name: create_review(uuid, uuid, text, text, uuid, text, text, uuid, text, public.review_sentiment, text[], text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.create_review(p_work_log_id uuid, p_job_posting_id uuid, p_job_posting_title text, p_work_date text, p_reviewer_id uuid, p_reviewer_name text, p_reviewer_type text, p_reviewee_id uuid, p_reviewee_name text, p_sentiment public.review_sentiment, p_tags text[], p_comment text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_review_id uuid;
  v_change numeric;
  v_current jsonb;
  v_new_score numeric;
  v_now text := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
BEGIN
  -- 호출자 바인딩: 작성자는 본인만 (SECURITY DEFINER 가 RLS 우회하므로 수동 검사)
  IF auth.uid() IS DISTINCT FROM p_reviewer_id THEN
    RAISE EXCEPTION 'unauthorized_reviewer';
  END IF;

  IF p_reviewer_type NOT IN ('employer', 'staff') THEN
    RAISE EXCEPTION 'invalid_reviewer_type';
  END IF;

  -- 서버 권위: sentiment → 점수 변화량 (클라 delta 불신)
  v_change := CASE p_sentiment
    WHEN 'positive' THEN 1.0
    WHEN 'neutral'  THEN 0
    WHEN 'negative' THEN -1.0
  END;

  -- 멱등 INSERT (id 는 gen_random_uuid 기본값)
  INSERT INTO public.reviews (
    work_log_id, job_posting_id, job_posting_title, work_date,
    reviewer_id, reviewer_name, reviewer_type,
    reviewee_id, reviewee_name, sentiment, tags, comment, bubble_score_change
  ) VALUES (
    p_work_log_id, p_job_posting_id, p_job_posting_title, p_work_date,
    p_reviewer_id, p_reviewer_name, p_reviewer_type,
    p_reviewee_id, p_reviewee_name, p_sentiment, COALESCE(p_tags, '{}'), p_comment, v_change::int
  )
  ON CONFLICT (work_log_id, reviewer_type) DO NOTHING
  RETURNING id INTO v_review_id;

  -- 이미 존재 → 점수 미반영, 기존 id 반환(멱등)
  IF v_review_id IS NULL THEN
    SELECT id INTO v_review_id FROM public.reviews
    WHERE work_log_id = p_work_log_id AND reviewer_type = p_reviewer_type;
    RETURN v_review_id;
  END IF;

  -- 피평가자 bubble_score 원자 갱신 (camelCase jsonb, clamp 0..100)
  SELECT bubble_score INTO v_current FROM public.users WHERE id = p_reviewee_id FOR UPDATE;
  v_new_score := round(
    GREATEST(0, LEAST(100, COALESCE((v_current->>'score')::numeric, 50.0) + v_change)), 1);

  UPDATE public.users SET bubble_score = jsonb_build_object(
    'score', v_new_score,
    'totalReviewCount', COALESCE((v_current->>'totalReviewCount')::int, 0) + 1,
    'positiveCount', COALESCE((v_current->>'positiveCount')::int, 0) + (CASE WHEN p_sentiment = 'positive' THEN 1 ELSE 0 END),
    'neutralCount',  COALESCE((v_current->>'neutralCount')::int, 0)  + (CASE WHEN p_sentiment = 'neutral'  THEN 1 ELSE 0 END),
    'negativeCount', COALESCE((v_current->>'negativeCount')::int, 0) + (CASE WHEN p_sentiment = 'negative' THEN 1 ELSE 0 END),
    'lastUpdatedAt', v_now
  ) WHERE id = p_reviewee_id;

  RETURN v_review_id;
END;
$$;


ALTER FUNCTION public.create_review(p_work_log_id uuid, p_job_posting_id uuid, p_job_posting_title text, p_work_date text, p_reviewer_id uuid, p_reviewer_name text, p_reviewer_type text, p_reviewee_id uuid, p_reviewee_name text, p_sentiment public.review_sentiment, p_tags text[], p_comment text) OWNER TO postgres;

--
-- Name: FUNCTION create_review(p_work_log_id uuid, p_job_posting_id uuid, p_job_posting_title text, p_work_date text, p_reviewer_id uuid, p_reviewer_name text, p_reviewer_type text, p_reviewee_id uuid, p_reviewee_name text, p_sentiment public.review_sentiment, p_tags text[], p_comment text); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.create_review(p_work_log_id uuid, p_job_posting_id uuid, p_job_posting_title text, p_work_date text, p_reviewer_id uuid, p_reviewer_name text, p_reviewer_type text, p_reviewee_id uuid, p_reviewee_name text, p_sentiment public.review_sentiment, p_tags text[], p_comment text) IS '리뷰 작성 원자 RPC. auth.uid()=reviewer 검사 → reviews INSERT(ON CONFLICT (work_log_id,reviewer_type) DO NOTHING) → 피평가자 users.bubble_score 갱신. 멱등(재호출 시 기존 id 반환·점수 미반영). 점수식 SSOT=src/types/review.ts BUBBLE_SCORE.';


--
-- Name: workspaces; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.workspaces (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    owner_id uuid NOT NULL,
    member_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    archived_at timestamp with time zone,
    CONSTRAINT workspaces_member_count_nonneg CHECK ((member_count >= 0)),
    CONSTRAINT workspaces_name_length CHECK (((char_length(name) >= 1) AND (char_length(name) <= 50)))
);

ALTER TABLE ONLY public.workspaces FORCE ROW LEVEL SECURITY;


ALTER TABLE public.workspaces OWNER TO postgres;

--
-- Name: TABLE workspaces; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.workspaces IS '공고 워크스페이스 — owner 단독 + editor 멤버. job_postings.workspace_id로 연결.';


--
-- Name: COLUMN workspaces.member_count; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.workspaces.member_count IS 'editor 수 (owner 제외). trigger 동기화. UI에서 owner+1 표시.';


--
-- Name: COLUMN workspaces.archived_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.workspaces.archived_at IS '소프트 삭제 마커. NULL=활성. 값 있으면 switcher/list/cap 에서 제외. owner 가 복원 가능. 2026-05-24.';


--
-- Name: create_workspace(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.create_workspace(p_name text) RETURNS public.workspaces
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_uid uuid;
  v_role text;
  v_count int;
  v_row public.workspaces%ROWTYPE;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
    RAISE EXCEPTION 'VALIDATION_REQUIRED';
  END IF;

  SELECT role::text INTO v_role
  FROM public.users
  WHERE id = v_uid AND is_active = true;

  IF v_role IS NULL OR v_role NOT IN ('employer', 'admin') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;

  SELECT count(*)::int INTO v_count
  FROM public.workspaces
  WHERE owner_id = v_uid AND archived_at IS NULL;

  IF v_count >= 10 THEN
    RAISE EXCEPTION 'WORKSPACE_CAP_REACHED';
  END IF;

  INSERT INTO public.workspaces (name, owner_id)
  VALUES (p_name, v_uid)
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;


ALTER FUNCTION public.create_workspace(p_name text) OWNER TO postgres;

--
-- Name: FUNCTION create_workspace(p_name text); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.create_workspace(p_name text) IS '워크스페이스 생성 RPC. SECURITY DEFINER + public.users.role 조회로 JWT staleness (Edge Function 사후 setRole + refreshSession 누락) 우회. 2026-05-09 root cause fix.';


--
-- Name: decrement_unread_counter(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.decrement_unread_counter(p_notification_id uuid) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  UPDATE public.notifications SET is_read = TRUE, read_at = now()
  WHERE id = p_notification_id AND is_read = FALSE;
$$;


ALTER FUNCTION public.decrement_unread_counter(p_notification_id uuid) OWNER TO postgres;

--
-- Name: decrement_unread_counter(uuid, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.decrement_unread_counter(p_user_id uuid, p_delta integer DEFAULT 1) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  UPDATE public.notification_counters
  SET unread_count = GREATEST(0, unread_count - p_delta),
      updated_at = now()
  WHERE user_id = p_user_id;
END;
$$;


ALTER FUNCTION public.decrement_unread_counter(p_user_id uuid, p_delta integer) OWNER TO postgres;

--
-- Name: derive_region_slug(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.derive_region_slug(addr text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO ''
    AS $$
DECLARE
  t text := btrim(coalesce(addr, ''));
  r text;
BEGIN
  IF t = '' THEN
    RETURN NULL;
  END IF;

  -- 1) 경기 우선 — '경기' 명시 시 경기 도시로 한정(광역시 광주와 혼동 방지)
  IF position('경기' in t) > 0 THEN
    SELECT m.slug INTO r FROM (VALUES
      ('수원시','경기 수원시'),('성남시','경기 성남시'),('고양시','경기 고양시'),
      ('용인시','경기 용인시'),('부천시','경기 부천시'),('안산시','경기 안산시'),
      ('안양시','경기 안양시'),('남양주시','경기 남양주시'),('화성시','경기 화성시'),
      ('평택시','경기 평택시'),('의정부시','경기 의정부시'),('시흥시','경기 시흥시'),
      ('파주시','경기 파주시'),('김포시','경기 김포시'),('광명시','경기 광명시'),
      ('광주시','경기 광주시'),('군포시','경기 군포시'),('하남시','경기 하남시'),
      ('오산시','경기 오산시'),('양주시','경기 양주시'),('이천시','경기 이천시'),
      ('구리시','경기 구리시'),('안성시','경기 안성시'),('포천시','경기 포천시'),
      ('의왕시','경기 의왕시'),('여주시','경기 여주시'),('동두천시','경기 동두천시'),
      ('과천시','경기 과천시'),('가평군','경기 가평군'),('양평군','경기 양평군'),
      ('연천군','경기 연천군')
    ) AS m(kw, slug)
    WHERE position(m.kw in t) > 0
    ORDER BY length(m.kw) DESC, m.kw
    LIMIT 1;
    RETURN r;
  END IF;

  -- 2) 광역시 — 시 단위 명시 매칭
  SELECT m.slug INTO r FROM (VALUES
    ('부산','부산'),('대구','대구'),('인천','인천'),('광주','광주'),
    ('대전','대전'),('울산','울산'),('세종','세종')
  ) AS m(kw, slug)
  WHERE position(m.kw in t) > 0
  ORDER BY length(m.kw) DESC, m.kw
  LIMIT 1;
  IF r IS NOT NULL THEN
    RETURN r;
  END IF;

  -- 2-1) 제주 — 서귀포시 먼저(제주시 substring 충돌 방지)
  IF position('서귀포' in t) > 0 THEN
    RETURN '제주 서귀포시';
  END IF;
  IF position('제주' in t) > 0 THEN
    RETURN '제주 제주시';
  END IF;

  -- 3)+4) 서울 구 매칭 — '서울' 명시 또는 폴백(구 이름만) 통합
  SELECT m.slug INTO r FROM (VALUES
    ('강남구','서울 강남구'),('강동구','서울 강동구'),('강북구','서울 강북구'),
    ('강서구','서울 강서구'),('관악구','서울 관악구'),('광진구','서울 광진구'),
    ('구로구','서울 구로구'),('금천구','서울 금천구'),('노원구','서울 노원구'),
    ('도봉구','서울 도봉구'),('동대문구','서울 동대문구'),('동작구','서울 동작구'),
    ('마포구','서울 마포구'),('서대문구','서울 서대문구'),('서초구','서울 서초구'),
    ('성동구','서울 성동구'),('성북구','서울 성북구'),('송파구','서울 송파구'),
    ('양천구','서울 양천구'),('영등포구','서울 영등포구'),('용산구','서울 용산구'),
    ('은평구','서울 은평구'),('종로구','서울 종로구'),('중랑구','서울 중랑구'),
    ('중구','서울 중구')
  ) AS m(kw, slug)
  WHERE position(m.kw in t) > 0
  ORDER BY length(m.kw) DESC, m.kw
  LIMIT 1;

  RETURN r;
END
$$;


ALTER FUNCTION public.derive_region_slug(addr text) OWNER TO postgres;

--
-- Name: FUNCTION derive_region_slug(addr text); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.derive_region_slug(addr text) IS '자유텍스트 주소 → region slug best-effort 도출(유지보수 전용). src/constants/regions.ts findRegionByAddress 의 SQL 포팅.';


--
-- Name: enforce_jp_status_transition(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.enforce_jp_status_transition() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_caller_uid uuid;
  v_is_workspace_owner boolean;
  v_is_admin boolean;
  v_is_collaborator boolean;
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status IN ('active', 'closed') THEN
    v_caller_uid := (SELECT auth.uid());

    IF v_caller_uid IS NULL THEN
      RETURN NEW;
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM public.workspaces
      WHERE id = NEW.workspace_id AND owner_id = v_caller_uid
    ) INTO v_is_workspace_owner;

    v_is_admin := coalesce(
      (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
      false
    );

    v_is_collaborator := public.is_posting_collaborator(NEW.id, v_caller_uid);

    IF NOT (v_is_workspace_owner OR v_is_admin OR v_is_collaborator) THEN
      RAISE EXCEPTION
        'permission denied: only workspace owner, admin, or collaborator can cancel job posting (id=%)',
        NEW.id
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION public.enforce_jp_status_transition() OWNER TO postgres;

--
-- Name: FUNCTION enforce_jp_status_transition(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.enforce_jp_status_transition() IS 'BEFORE UPDATE trigger 로 active|closed → cancelled 전이를 workspace owner|admin 만 통과시킨다. RLS jp_update_workspace_member 의 soft-delete 우회 갭을 DB-level 에서 차단. service-side (no JWT) bypass.';


--
-- Name: expire_pending_workspace_invitations(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.expire_pending_workspace_invitations() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_count integer;
BEGIN
  WITH expired AS (
    UPDATE public.workspace_invitations
      SET status = 'expired', responded_at = now()
      WHERE status = 'pending' AND expires_at < now()
      RETURNING 1
  )
  SELECT count(*) INTO v_count FROM expired;
  RETURN v_count;
END;
$$;


ALTER FUNCTION public.expire_pending_workspace_invitations() OWNER TO postgres;

--
-- Name: FUNCTION expire_pending_workspace_invitations(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.expire_pending_workspace_invitations() IS 'pg_cron 일 1회 호출 — pending 초대 만료 처리. 알림 없음 (D3).';


--
-- Name: fn_board_comment_count_sync(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_board_comment_count_sync() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.board_posts
       SET comment_count = COALESCE(comment_count, 0) + 1
     WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.board_posts
       SET comment_count = GREATEST(COALESCE(comment_count, 0) - 1, 0)
     WHERE id = OLD.post_id;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' AND NEW.post_id IS DISTINCT FROM OLD.post_id THEN
    UPDATE public.board_posts
       SET comment_count = GREATEST(COALESCE(comment_count, 0) - 1, 0)
     WHERE id = OLD.post_id;
    UPDATE public.board_posts
       SET comment_count = COALESCE(comment_count, 0) + 1
     WHERE id = NEW.post_id;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;


ALTER FUNCTION public.fn_board_comment_count_sync() OWNER TO postgres;

--
-- Name: fn_cleanup_expired_fcm_tokens(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_cleanup_expired_fcm_tokens() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
DECLARE
  v_deleted_count integer;
BEGIN
  DELETE FROM public.fcm_tokens
  WHERE last_refreshed_at < now() - INTERVAL '30 days';

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  IF v_deleted_count > 0 THEN
    RAISE NOTICE '[cleanup_expired_fcm_tokens] deleted % rows', v_deleted_count;
  END IF;

  RETURN v_deleted_count;
END;
$$;


ALTER FUNCTION public.fn_cleanup_expired_fcm_tokens() OWNER TO postgres;

--
-- Name: FUNCTION fn_cleanup_expired_fcm_tokens(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.fn_cleanup_expired_fcm_tokens() IS 'fcm_tokens 30일 이상 미갱신 레코드 일괄 삭제 (Firebase cleanupExpiredTokens 대체)';


--
-- Name: fn_cleanup_rate_limits(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_cleanup_rate_limits() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
DECLARE
  v_deleted_count integer;
BEGIN
  DELETE FROM public.rate_limits
  WHERE expires_at IS NOT NULL
    AND expires_at < now();

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  IF v_deleted_count > 0 THEN
    RAISE NOTICE '[cleanup_rate_limits] deleted % rows', v_deleted_count;
  END IF;

  RETURN v_deleted_count;
END;
$$;


ALTER FUNCTION public.fn_cleanup_rate_limits() OWNER TO postgres;

--
-- Name: FUNCTION fn_cleanup_rate_limits(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.fn_cleanup_rate_limits() IS 'rate_limits expires_at 경과 레코드 일괄 삭제 (Firebase cleanupRateLimits 대체)';


--
-- Name: fn_expire_by_last_work_date(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_expire_by_last_work_date() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
DECLARE
  v_cutoff date;
  v_updated_count integer;
BEGIN
  v_cutoff := ((now() AT TIME ZONE 'Asia/Seoul')::date - INTERVAL '2 days')::date;

  WITH expired AS (
    UPDATE public.job_postings
    SET
      status = 'closed',
      closed_at = now(),
      closed_reason = 'expired_by_work_date',
      updated_at = now()
    WHERE posting_type IN ('regular', 'urgent', 'tournament')
      AND status IN ('active', 'capacity_full')
      AND last_work_date IS NOT NULL
      AND last_work_date <= v_cutoff
    RETURNING id
  )
  SELECT count(*) INTO v_updated_count FROM expired;

  IF v_updated_count > 0 THEN
    RAISE NOTICE '[expire_by_last_work_date] closed % postings (cutoff=%)', v_updated_count, v_cutoff;
  END IF;

  RETURN v_updated_count;
END;
$$;


ALTER FUNCTION public.fn_expire_by_last_work_date() OWNER TO postgres;

--
-- Name: FUNCTION fn_expire_by_last_work_date(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.fn_expire_by_last_work_date() IS 'last_work_date가 KST 오늘-2일보다 이전이면 자동 마감 (Firebase expireByLastWorkDate 대체)';


--
-- Name: fn_expire_fixed_postings_batch(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_expire_fixed_postings_batch() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
DECLARE
  v_updated_count integer;
BEGIN
  WITH expired AS (
    UPDATE public.job_postings
    SET
      status = 'closed',
      closed_at = now(),
      closed_reason = 'expired',
      updated_at = now()
    WHERE posting_type = 'fixed'
      AND status IN ('active', 'capacity_full')
      AND fixed_config IS NOT NULL
      AND (fixed_config ->> 'expiresAt') IS NOT NULL
      AND (fixed_config ->> 'expiresAt')::timestamptz < now()
    RETURNING id
  )
  SELECT count(*) INTO v_updated_count FROM expired;

  IF v_updated_count > 0 THEN
    RAISE NOTICE '[expire_fixed_postings_batch] closed % postings', v_updated_count;
  END IF;

  RETURN v_updated_count;
END;
$$;


ALTER FUNCTION public.fn_expire_fixed_postings_batch() OWNER TO postgres;

--
-- Name: FUNCTION fn_expire_fixed_postings_batch(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.fn_expire_fixed_postings_batch() IS '고정 공고 fixed_config.expiresAt 경과 시 status=closed (Firebase expireFixedPostings 대체)';


--
-- Name: fn_fixed_posting_expired(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_fixed_posting_expired() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  -- status가 active이고 posting_type이 fixed이며 expiresAt이 지났으면 closed로 변경
  IF NEW.posting_type = 'fixed' AND NEW.status = 'active'
     AND NEW.fixed_config IS NOT NULL
     AND (NEW.fixed_config->>'expiresAt') IS NOT NULL
     AND (NEW.fixed_config->>'expiresAt')::timestamptz < now() THEN
    NEW.status := 'closed';
    NEW.closed_at := now();
    NEW.closed_reason := 'expired';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.fn_fixed_posting_expired() OWNER TO postgres;

--
-- Name: fn_notification_delete_decrement(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_notification_delete_decrement() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
BEGIN
  IF OLD.is_read = false THEN
    UPDATE public.notification_counters
    SET unread_count = GREATEST(0, unread_count - 1),
        updated_at = now()
    WHERE user_id = OLD.recipient_id;
  END IF;
  RETURN OLD;
END;
$$;


ALTER FUNCTION public.fn_notification_delete_decrement() OWNER TO postgres;

--
-- Name: fn_notification_insert_increment(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_notification_insert_increment() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
BEGIN
  IF NEW.is_read = false THEN
    INSERT INTO public.notification_counters (user_id, unread_count, updated_at)
    VALUES (NEW.recipient_id, 1, now())
    ON CONFLICT (user_id) DO UPDATE
      SET unread_count = public.notification_counters.unread_count + 1,
          updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.fn_notification_insert_increment() OWNER TO postgres;

--
-- Name: fn_notification_read_decrement(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_notification_read_decrement() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
BEGIN
  IF OLD.is_read = false AND NEW.is_read = true THEN
    UPDATE public.notification_counters
    SET unread_count = GREATEST(0, unread_count - 1),
        updated_at = now()
    WHERE user_id = NEW.recipient_id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.fn_notification_read_decrement() OWNER TO postgres;

--
-- Name: fn_notify_cancellation_request(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_notify_cancellation_request() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_owner_id uuid;
  v_posting_title text;
  v_workspace_id uuid;
BEGIN
  IF NEW.status::text = 'cancellation_pending' AND OLD.status::text != 'cancellation_pending' THEN
    SELECT owner_id, title, workspace_id INTO v_owner_id, v_posting_title, v_workspace_id
    FROM public.job_postings WHERE id = NEW.job_posting_id;

    -- 수신자: 공고 owner ∪ 워크스페이스 owner/멤버 ∪ 공고 협업자 (dedup, 신청자 제외)
    INSERT INTO public.notifications (recipient_id, type, category, title, body, data, priority)
    SELECT DISTINCT r.uid,
      'cancellation_requested',
      'application'::public.notification_category,
      '취소 요청',
      COALESCE(NEW.applicant_name, '스태프') || '님이 "' || COALESCE(v_posting_title, '공고') || '" 취소를 요청했습니다',
      jsonb_build_object('applicationId', NEW.id, 'jobPostingId', NEW.job_posting_id),
      'high'
    FROM (
      SELECT v_owner_id AS uid
      UNION
      SELECT w.owner_id FROM public.workspaces w
        WHERE v_workspace_id IS NOT NULL AND w.id = v_workspace_id
      UNION
      SELECT wm.user_id FROM public.workspace_members wm
        WHERE v_workspace_id IS NOT NULL AND wm.workspace_id = v_workspace_id
      UNION
      SELECT c.user_id FROM public.job_posting_collaborators c
        WHERE c.job_posting_id = NEW.job_posting_id
    ) r
    WHERE r.uid IS NOT NULL
      AND r.uid IS DISTINCT FROM NEW.applicant_id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.fn_notify_cancellation_request() OWNER TO postgres;

--
-- Name: fn_notify_inquiry_created(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_notify_inquiry_created() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
BEGIN
  INSERT INTO public.notifications (recipient_id, type, category, title, body, data)
  SELECT
    u.id,
    'inquiry_created',
    'admin',
    '새 문의',
    COALESCE(NEW.user_name, '사용자') || '님의 문의: ' || COALESCE(NEW.subject, ''),
    jsonb_build_object('inquiryId', NEW.id, 'category', NEW.category)
  FROM public.users u
  WHERE u.role = 'admin' AND u.is_active = true;

  RETURN NEW;
END;
$$;


ALTER FUNCTION public.fn_notify_inquiry_created() OWNER TO postgres;

--
-- Name: fn_notify_review_created(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_notify_review_created() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  INSERT INTO public.notifications (recipient_id, type, category, title, body, data)
  VALUES (NEW.reviewee_id, 'review_created', 'review', '새로운 리뷰',
    '"' || COALESCE(NEW.job_posting_title, '공고') || '" 관련 리뷰가 등록되었습니다',
    jsonb_build_object('reviewId', NEW.id, 'jobPostingId', NEW.job_posting_id));
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.fn_notify_review_created() OWNER TO postgres;

--
-- Name: fn_notify_tournament_approval(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_notify_tournament_approval() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
BEGIN
  IF NEW.posting_type::text = 'tournament'
     AND NEW.tournament_config IS NOT NULL
     AND (NEW.tournament_config->>'approvalStatus') = 'pending'
     AND (OLD.tournament_config IS NULL OR (OLD.tournament_config->>'approvalStatus') IS DISTINCT FROM 'pending') THEN

    INSERT INTO public.notifications (recipient_id, type, category, title, body, data, priority)
    SELECT
      u.id,
      'tournament_approval_request',
      'admin',
      '토너먼트 승인 요청',
      '"' || COALESCE(NEW.title, '공고') || '" 승인이 필요합니다',
      jsonb_build_object('jobPostingId', NEW.id),
      'high'
    FROM public.users u
    WHERE u.role = 'admin' AND u.is_active = true;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.fn_notify_tournament_approval() OWNER TO postgres;

--
-- Name: fn_ops_events_append_only(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_ops_events_append_only() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  RAISE EXCEPTION 'OPS_EVENTS_APPEND_ONLY: ops_events 는 append-only — % 불가', TG_OP
    USING ERRCODE = 'P0001';
END;
$$;


ALTER FUNCTION public.fn_ops_events_append_only() OWNER TO postgres;

--
-- Name: fn_ops_init_derived_rows(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_ops_init_derived_rows() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  INSERT INTO public.ops_clock (tournament_id)
  VALUES (NEW.id) ON CONFLICT (tournament_id) DO NOTHING;
  INSERT INTO public.ops_live_stats (tournament_id)
  VALUES (NEW.id) ON CONFLICT (tournament_id) DO NOTHING;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.fn_ops_init_derived_rows() OWNER TO postgres;

--
-- Name: fn_ops_live_stats_recompute_trigger(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_ops_live_stats_recompute_trigger() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_tid uuid;
BEGIN
  v_tid := COALESCE(NEW.tournament_id, OLD.tournament_id);
  IF v_tid IS NOT NULL THEN
    PERFORM public.fn_ops_recompute_live_stats(v_tid);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION public.fn_ops_live_stats_recompute_trigger() OWNER TO postgres;

--
-- Name: fn_ops_live_stats_recompute_trigger_tournaments(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_ops_live_stats_recompute_trigger_tournaments() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  PERFORM public.fn_ops_recompute_live_stats(NEW.id);
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.fn_ops_live_stats_recompute_trigger_tournaments() OWNER TO postgres;

--
-- Name: fn_ops_recompute_live_stats(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_ops_recompute_live_stats(p_tournament_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_buy_in_cost int;
  v_rebuy_cost  int;
  v_addon_cost  int;
  v_bounty_cost int;
  v_playing      int;
  v_entries      int;
  v_reentries    int;
  v_total_rebuys bigint;
  v_total_addons bigint;
  v_total_chips  bigint;
  v_tables_open  int;
  v_seats_total  int;
  v_seats_free   int;
  v_average_stack bigint;
  v_big_blind    int;
  v_avg_stack_bb numeric;
  v_total_buyins bigint;
  v_prize_pool   bigint;
  v_knockout_pool bigint;  -- [후속] int→bigint (22억 KO 풀 오버플로 근본 수선)
BEGIN
  -- [CASCADE 가드] 대회 삭제 중 자식 DELETE 트리거가 부르면 조용히 종료(1c 보존)
  IF NOT EXISTS (SELECT 1 FROM public.ops_tournaments WHERE id = p_tournament_id) THEN
    RETURN;
  END IF;

  SELECT buy_in_cost, rebuy_cost, addon_cost, bounty_cost
    INTO v_buy_in_cost, v_rebuy_cost, v_addon_cost, v_bounty_cost
    FROM public.ops_tournaments WHERE id = p_tournament_id;

  SELECT
    count(*) FILTER (WHERE status = 'active'),
    count(*),
    COALESCE(sum(reentries), 0),
    COALESCE(sum(rebuys), 0),
    COALESCE(sum(add_ons), 0),
    COALESCE(sum(chips) FILTER (WHERE status = 'active'), 0)
  INTO v_playing, v_entries, v_reentries, v_total_rebuys, v_total_addons, v_total_chips
  FROM public.ops_participants
  WHERE tournament_id = p_tournament_id;

  SELECT count(*)
    INTO v_tables_open
    FROM public.ops_tables
    WHERE tournament_id = p_tournament_id AND status = 'open';

  SELECT count(s.id), count(s.id) FILTER (WHERE s.participant_id IS NULL)
    INTO v_seats_total, v_seats_free
    FROM public.ops_seats s
    JOIN public.ops_tables t ON t.id = s.table_id
    WHERE s.tournament_id = p_tournament_id AND t.status = 'open';

  v_average_stack := COALESCE(round(v_total_chips::numeric / NULLIF(v_playing, 0))::bigint, 0);

  SELECT bl.big_blind
    INTO v_big_blind
    FROM public.ops_blind_levels bl
    JOIN public.ops_clock c
      ON c.tournament_id = bl.tournament_id AND c.current_level_sort = bl.sort
    WHERE bl.tournament_id = p_tournament_id;

  v_avg_stack_bb := COALESCE(v_average_stack::numeric / NULLIF(v_big_blind, 0), 0);

  -- [1f] 총 바이인 수 = entries + Σreentries (재진입 = 바이인 재지불, 1d 스펙이 1f 로 명시 이관)
  v_total_buyins := v_entries::bigint + v_reentries;
  v_prize_pool := v_total_buyins * COALESCE(v_buy_in_cost, 0)
                + v_total_rebuys * COALESCE(v_rebuy_cost, 0)
                + v_total_addons * COALESCE(v_addon_cost, 0);
  -- [1f] KO 풀: NULL = 비-바운티 대회(클라 카드 숨김 신호). fee_cost 는 계속 미포함(하우스 몫).
  -- [후속] ::int 다운캐스트 제거 — v_total_buyins(bigint) × v_bounty_cost(int) 는 이미 bigint.
  v_knockout_pool := CASE WHEN v_bounty_cost IS NULL THEN NULL
                          ELSE (v_total_buyins * v_bounty_cost) END;

  INSERT INTO public.ops_live_stats AS ls (
    tournament_id, playing, entries, unique_players, reentries_total,
    tables_open, seats_total, seats_free,
    total_chips, average_stack, avg_stack_bb, prize_pool, knockout_pool, updated_at
  ) VALUES (
    p_tournament_id, v_playing, v_entries, v_entries, v_reentries,
    v_tables_open, v_seats_total, v_seats_free,
    v_total_chips, v_average_stack, v_avg_stack_bb, v_prize_pool, v_knockout_pool, now()
  )
  ON CONFLICT (tournament_id) DO UPDATE SET
    playing         = EXCLUDED.playing,
    entries         = EXCLUDED.entries,
    unique_players  = EXCLUDED.unique_players,
    reentries_total = EXCLUDED.reentries_total,
    tables_open     = EXCLUDED.tables_open,
    seats_total     = EXCLUDED.seats_total,
    seats_free      = EXCLUDED.seats_free,
    total_chips     = EXCLUDED.total_chips,
    average_stack   = EXCLUDED.average_stack,
    avg_stack_bb    = EXCLUDED.avg_stack_bb,
    prize_pool      = EXCLUDED.prize_pool,
    knockout_pool   = EXCLUDED.knockout_pool,
    updated_at      = now();
END;
$$;


ALTER FUNCTION public.fn_ops_recompute_live_stats(p_tournament_id uuid) OWNER TO postgres;

--
-- Name: fn_ops_set_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_ops_set_updated_at() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.fn_ops_set_updated_at() OWNER TO postgres;

--
-- Name: fn_send_review_reminders(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_send_review_reminders() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
DECLARE
  v_inserted integer;
  v_target_start timestamptz;
  v_target_end timestamptz;
BEGIN
  v_target_start := (now() - INTERVAL '5 days')::date;
  v_target_end := v_target_start + INTERVAL '1 day';

  WITH target_work_logs AS (
    SELECT
      wl.id AS work_log_id,
      wl.staff_id,
      wl.job_posting_id,
      jp.title AS job_title,
      jp.owner_id AS employer_id
    FROM public.work_logs wl
    JOIN public.job_postings jp ON jp.id = wl.job_posting_id
    WHERE wl.check_out_ts IS NOT NULL
      AND wl.check_out_ts >= v_target_start
      AND wl.check_out_ts < v_target_end
  ),
  existing_reviews AS (
    SELECT work_log_id, reviewer_type
    FROM public.reviews
    WHERE work_log_id IN (SELECT work_log_id FROM target_work_logs)
  ),
  staff_reminders AS (
    SELECT
      twl.staff_id AS recipient_id,
      'review_reminder'::text AS type,
      '📝 평가 리마인더'::text AS title,
      format('%s 근무에 대한 평가가 아직 작성되지 않았습니다.',
             COALESCE(NULLIF(twl.job_title, ''), '근무')) AS body,
      format('/reviews/%s', twl.work_log_id) AS link,
      jsonb_build_object(
        'workLogId', twl.work_log_id,
        'jobPostingId', twl.job_posting_id,
        'jobPostingTitle', COALESCE(twl.job_title, ''),
        'reviewerType', 'staff'
      ) AS data
    FROM target_work_logs twl
    WHERE twl.staff_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM existing_reviews er
        WHERE er.work_log_id = twl.work_log_id AND er.reviewer_type = 'staff'
      )
  ),
  employer_reminders AS (
    SELECT
      twl.employer_id AS recipient_id,
      'review_reminder'::text AS type,
      '📝 평가 리마인더'::text AS title,
      format('%s 근무의 스태프 평가가 아직 작성되지 않았습니다.',
             COALESCE(NULLIF(twl.job_title, ''), '근무')) AS body,
      format('/reviews/%s', twl.work_log_id) AS link,
      jsonb_build_object(
        'workLogId', twl.work_log_id,
        'jobPostingId', twl.job_posting_id,
        'jobPostingTitle', COALESCE(twl.job_title, ''),
        'reviewerType', 'employer'
      ) AS data
    FROM target_work_logs twl
    WHERE twl.employer_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM existing_reviews er
        WHERE er.work_log_id = twl.work_log_id AND er.reviewer_type = 'employer'
      )
  ),
  all_reminders AS (
    SELECT * FROM staff_reminders
    UNION ALL
    SELECT * FROM employer_reminders
  ),
  inserted AS (
    INSERT INTO public.notifications (recipient_id, type, title, body, link, data, priority)
    SELECT recipient_id, type, title, body, link, data, 'normal'
    FROM all_reminders
    RETURNING id
  )
  SELECT count(*) INTO v_inserted FROM inserted;

  IF v_inserted > 0 THEN
    RAISE NOTICE '[send_review_reminders] inserted % reminders', v_inserted;
  END IF;

  RETURN v_inserted;
END;
$$;


ALTER FUNCTION public.fn_send_review_reminders() OWNER TO postgres;

--
-- Name: FUNCTION fn_send_review_reminders(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.fn_send_review_reminders() IS '퇴근 5일 후 미작성 리뷰 리마인더 발송 (Phase D.1 check_out_ts 기반).';


--
-- Name: fn_sync_application_completion(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_sync_application_completion() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_application_id uuid;
  v_total_logs int;
  v_completed_logs int;
BEGIN
  -- work_log의 application_id로 연관 지원서 찾기
  v_application_id := NEW.application_id;
  IF v_application_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- 해당 지원서의 모든 work_log 상태 확인
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status IN ('checked_out', 'completed', 'no_show'))
  INTO v_total_logs, v_completed_logs
  FROM public.work_logs
  WHERE application_id = v_application_id;

  IF v_total_logs > 0 AND v_total_logs = v_completed_logs THEN
    -- 모든 work_log가 종결 상태면 지원서를 completed로
    UPDATE public.applications
    SET status = 'completed', updated_at = now()
    WHERE id = v_application_id AND status = 'confirmed';
  ELSIF v_total_logs > 0 THEN
    -- 역전이: 일부 종결이 해제(노쇼 취소·상태 정정)되면 completed 지원서를 confirmed로 복구
    UPDATE public.applications
    SET status = 'confirmed', updated_at = now()
    WHERE id = v_application_id AND status = 'completed';
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION public.fn_sync_application_completion() OWNER TO postgres;

--
-- Name: fn_sync_workspace_member_count(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_sync_workspace_member_count() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.workspaces
      SET member_count = member_count + 1,
          updated_at = now()
      WHERE id = NEW.workspace_id;

  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.workspaces
      SET member_count = GREATEST(member_count - 1, 0),
          updated_at = now()
      WHERE id = OLD.workspace_id;
  END IF;

  RETURN NULL;
END;
$$;


ALTER FUNCTION public.fn_sync_workspace_member_count() OWNER TO postgres;

--
-- Name: FUNCTION fn_sync_workspace_member_count(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.fn_sync_workspace_member_count() IS 'workspace_members INSERT/DELETE 시 workspaces.member_count ±1. owner 제외 editor 수.';


--
-- Name: fn_update_job_posting_stats(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_update_job_posting_stats() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_counted_statuses TEXT[] := ARRAY['applied','confirmed','cancellation_pending'];
  v_filled_statuses  TEXT[] := ARRAY['confirmed','cancellation_pending','completed'];
  v_old_counted BOOLEAN; v_new_counted BOOLEAN;
  v_old_filled BOOLEAN; v_new_filled BOOLEAN;
  v_total_delta INT := 0; v_active_delta INT := 0; v_confirmed_delta INT := 0; v_cp_delta INT := 0;
  v_filled_delta INT := 0;
  v_job_posting_id UUID;
BEGIN
  v_job_posting_id := COALESCE(NEW.job_posting_id, OLD.job_posting_id);
  IF v_job_posting_id IS NULL THEN RETURN NULL; END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status::text = ANY(v_counted_statuses) THEN
      v_total_delta := 1;
      IF NEW.status::text = 'applied' THEN v_active_delta := 1;
      ELSIF NEW.status::text = 'confirmed' THEN v_confirmed_delta := 1;
      ELSIF NEW.status::text = 'cancellation_pending' THEN v_cp_delta := 1;
      END IF;
    END IF;
    IF NEW.status::text = ANY(v_filled_statuses) THEN v_filled_delta := 1; END IF;

  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.status::text = ANY(v_counted_statuses) THEN
      v_total_delta := -1;
      IF OLD.status::text = 'applied' THEN v_active_delta := -1;
      ELSIF OLD.status::text = 'confirmed' THEN v_confirmed_delta := -1;
      ELSIF OLD.status::text = 'cancellation_pending' THEN v_cp_delta := -1;
      END IF;
    END IF;
    IF OLD.status::text = ANY(v_filled_statuses) THEN v_filled_delta := -1; END IF;

  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status::text = NEW.status::text THEN RETURN NULL; END IF;

    v_old_counted := OLD.status::text = ANY(v_counted_statuses);
    v_new_counted := NEW.status::text = ANY(v_counted_statuses);
    IF v_old_counted AND NOT v_new_counted THEN v_total_delta := -1;
    ELSIF NOT v_old_counted AND v_new_counted THEN v_total_delta := 1;
    END IF;

    IF OLD.status::text = 'applied' AND NEW.status::text <> 'applied' THEN v_active_delta := -1;
    ELSIF NEW.status::text = 'applied' AND OLD.status::text <> 'applied' THEN v_active_delta := 1;
    END IF;

    IF OLD.status::text = 'confirmed' AND NEW.status::text <> 'confirmed' THEN v_confirmed_delta := -1;
    ELSIF NEW.status::text = 'confirmed' AND OLD.status::text <> 'confirmed' THEN v_confirmed_delta := 1;
    END IF;

    IF OLD.status::text = 'cancellation_pending' AND NEW.status::text <> 'cancellation_pending' THEN v_cp_delta := -1;
    ELSIF NEW.status::text = 'cancellation_pending' AND OLD.status::text <> 'cancellation_pending' THEN v_cp_delta := 1;
    END IF;

    v_old_filled := OLD.status::text = ANY(v_filled_statuses);
    v_new_filled := NEW.status::text = ANY(v_filled_statuses);
    IF v_old_filled AND NOT v_new_filled THEN v_filled_delta := -1;
    ELSIF NOT v_old_filled AND v_new_filled THEN v_filled_delta := 1;
    END IF;
  END IF;

  IF v_total_delta = 0 AND v_active_delta = 0 AND v_confirmed_delta = 0 AND v_cp_delta = 0
     AND v_filled_delta = 0 THEN
    RETURN NULL;
  END IF;

  UPDATE public.job_postings
  SET filled_positions = GREATEST(0, filled_positions + v_filled_delta),
      stats = jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(
        COALESCE(stats, '{}'::jsonb),
        '{totalApplicants}', to_jsonb(GREATEST(0, COALESCE((stats->>'totalApplicants')::int, 0) + v_total_delta))),
        '{activeApplicants}', to_jsonb(GREATEST(0, COALESCE((stats->>'activeApplicants')::int, 0) + v_active_delta))),
        '{confirmedApplicants}', to_jsonb(GREATEST(0, COALESCE((stats->>'confirmedApplicants')::int, 0) + v_confirmed_delta))),
        '{cancellationPendingApplicants}', to_jsonb(GREATEST(0, COALESCE((stats->>'cancellationPendingApplicants')::int, 0) + v_cp_delta))),
        '{filledPositions}', to_jsonb(GREATEST(0, COALESCE((stats->>'filledPositions')::int, 0) + v_filled_delta)))
  WHERE id = v_job_posting_id;

  -- M2: 인원마감 자동 전이 (active <-> capacity_full). 위 UPDATE 후 filled_positions 기준.
  UPDATE public.job_postings jp
  SET status = CASE
        WHEN jp.status = 'active'
         AND jp.total_positions > 0
         AND jp.filled_positions >= jp.total_positions
         THEN 'capacity_full'::posting_status
        WHEN jp.status = 'capacity_full'
         AND jp.filled_positions < jp.total_positions
         THEN 'active'::posting_status
        ELSE jp.status
      END,
      updated_at = CASE
        WHEN (jp.status = 'active' AND jp.filled_positions >= jp.total_positions AND jp.total_positions > 0)
          OR (jp.status = 'capacity_full' AND jp.filled_positions < jp.total_positions)
        THEN now() ELSE jp.updated_at
      END
  WHERE jp.id = v_job_posting_id;

  RETURN NULL;
END;
$$;


ALTER FUNCTION public.fn_update_job_posting_stats() OWNER TO postgres;

--
-- Name: fn_workspaces_set_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_workspaces_set_updated_at() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.fn_workspaces_set_updated_at() OWNER TO postgres;

--
-- Name: get_job_posting_stats(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_job_posting_stats(p_owner_id uuid) RETURNS TABLE(total bigint, active bigint, closed bigint, cancelled bigint, total_applications bigint, total_views bigint)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'pg_temp'
    AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 인증된 사용자만 통계를 조회할 수 있습니다';
  END IF;

  IF auth.uid() <> p_owner_id AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 본인 또는 관리자만 통계를 조회할 수 있습니다';
  END IF;

  RETURN QUERY
  SELECT
    count(*)::bigint,
    count(CASE WHEN jp.status IN ('active', 'capacity_full') THEN 1 END)::bigint,
    count(CASE WHEN jp.status = 'closed' THEN 1 END)::bigint,
    count(CASE WHEN jp.status = 'cancelled' THEN 1 END)::bigint,
    coalesce(sum((jp.stats->>'totalApplicants')::int), 0)::bigint,
    coalesce(sum(jp.view_count), 0)::bigint
  FROM public.job_postings jp
  WHERE jp.owner_id = p_owner_id
    AND jp.status IN ('active', 'capacity_full', 'closed', 'cancelled');
END;
$$;


ALTER FUNCTION public.get_job_posting_stats(p_owner_id uuid) OWNER TO postgres;

--
-- Name: get_latest_employer_application(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_latest_employer_application(p_user_id uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_target_user_id UUID;
  v_app            RECORD;
BEGIN
  v_target_user_id := COALESCE(p_user_id, auth.uid());

  IF v_target_user_id != auth.uid()
     AND (auth.jwt() -> 'app_metadata' ->> 'role') IS DISTINCT FROM 'admin'
  THEN
    RAISE EXCEPTION 'UNAUTHORIZED: 타인의 신청 내역 조회는 관리자만 가능합니다';
  END IF;

  SELECT * INTO v_app
    FROM employer_applications
    WHERE user_id = v_target_user_id
    ORDER BY created_at DESC
    LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'id', v_app.id, 'userId', v_app.user_id, 'status', v_app.status,
    'submittedAt', v_app.submitted_at, 'reviewedAt', v_app.reviewed_at,
    'reviewedBy', v_app.reviewed_by, 'rejectionReason', v_app.rejection_reason,
    'rejectionCategory', v_app.rejection_category,
    'agreementsSnapshot', v_app.agreements_snapshot,
    'supersedesId', v_app.supersedes_id, 'createdAt', v_app.created_at
  );
END;
$$;


ALTER FUNCTION public.get_latest_employer_application(p_user_id uuid) OWNER TO postgres;

--
-- Name: get_my_role(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_my_role() RETURNS text
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  SELECT coalesce(
    auth.jwt() -> 'app_metadata' ->> 'role',
    ''
  );
$$;


ALTER FUNCTION public.get_my_role() OWNER TO postgres;

--
-- Name: get_or_create_venue_container(uuid, text, text, jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_or_create_venue_container(p_workspace_id uuid, p_name text, p_kind text DEFAULT 'dated'::text, p_period jsonb DEFAULT NULL::jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_owner uuid := auth.uid();
  v_container_id uuid;
  v_now timestamptz := now();
  v_norm_name text;
  v_schedule jsonb;
BEGIN
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 인증이 필요합니다';
  END IF;

  IF NOT (public.is_workspace_member(p_workspace_id, v_owner) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 워크스페이스 권한이 없습니다';
  END IF;

  v_norm_name := btrim(COALESCE(p_name, ''));
  IF length(v_norm_name) = 0 THEN
    RAISE EXCEPTION 'INVALID_INPUT: 운영처명이 필요합니다';
  END IF;
  IF p_kind NOT IN ('dated', 'fixed') THEN
    RAISE EXCEPTION 'INVALID_INPUT: kind 는 dated|fixed 만 허용합니다 (%)', p_kind;
  END IF;

  v_schedule := jsonb_build_object('kind', p_kind, 'softTargets', '{}'::jsonb);
  IF p_period IS NOT NULL THEN
    v_schedule := v_schedule || jsonb_build_object('period', p_period);
  END IF;

  INSERT INTO job_postings (
    workspace_id, owner_id, title, status, posting_type,
    total_positions, filled_positions, schedule, schema_version,
    created_at, updated_at
  ) VALUES (
    p_workspace_id, v_owner, v_norm_name, 'container'::posting_status, 'regular'::posting_type,
    0, 0, v_schedule, 3,
    v_now, v_now
  )
  ON CONFLICT (workspace_id, lower(title), (schedule ->> 'kind')) WHERE status = 'container'
  DO NOTHING
  RETURNING id INTO v_container_id;

  IF v_container_id IS NULL THEN
    SELECT id INTO v_container_id
    FROM job_postings
    WHERE workspace_id = p_workspace_id
      AND lower(title) = lower(v_norm_name)
      AND (schedule ->> 'kind') = p_kind
      AND status = 'container'
    LIMIT 1;
  END IF;

  UPDATE job_postings
  SET venue_id = id, updated_at = v_now
  WHERE id = v_container_id
    AND venue_id IS DISTINCT FROM id;

  RETURN jsonb_build_object(
    'containerId', v_container_id,
    'workspaceId', p_workspace_id,
    'name', v_norm_name,
    'kind', p_kind
  );
END;
$$;


ALTER FUNCTION public.get_or_create_venue_container(p_workspace_id uuid, p_name text, p_kind text, p_period jsonb) OWNER TO postgres;

--
-- Name: FUNCTION get_or_create_venue_container(p_workspace_id uuid, p_name text, p_kind text, p_period jsonb); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.get_or_create_venue_container(p_workspace_id uuid, p_name text, p_kind text, p_period jsonb) IS '운영처(venue) 컨테이너 공고(status=container) 멱등 확보. ON CONFLICT(uniq_venue_container) race 방지, venue_id=self, softTargets 분리.';


--
-- Name: get_posting_filled_counts(uuid[]); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_posting_filled_counts(p_job_posting_ids uuid[]) RETURNS TABLE(job_posting_id uuid, work_date text, time_slot text, role_key text, confirmed_count integer)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT * FROM public.count_posting_confirmed_by_slot(p_job_posting_ids);
$$;


ALTER FUNCTION public.get_posting_filled_counts(p_job_posting_ids uuid[]) OWNER TO postgres;

--
-- Name: FUNCTION get_posting_filled_counts(p_job_posting_ids uuid[]); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.get_posting_filled_counts(p_job_posting_ids uuid[]) IS '공고 카드/상세 역할별 (filled/count) 표시용 집계. count_posting_confirmed_by_slot 래핑.';


--
-- Name: get_regular_posting_date_counts(text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_regular_posting_date_counts(p_start_date text, p_end_date text) RETURNS TABLE(work_date text, posting_count bigint)
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  with expanded as (
    select
      jp.id,
      unnest(
        case
          when jp.work_dates is not null and array_length(jp.work_dates, 1) > 0
            then jp.work_dates
          when jp.work_date is not null and jp.work_date <> ''
            then array[jp.work_date]
          else array[]::text[]
        end
      ) as wd
    from public.job_postings jp
    where jp.posting_type = 'regular'
      and jp.status = 'active'
  )
  select
    wd as work_date,
    count(distinct id) as posting_count
  from expanded
  where wd between p_start_date and p_end_date
  group by wd
  order by wd;
$$;


ALTER FUNCTION public.get_regular_posting_date_counts(p_start_date text, p_end_date text) OWNER TO postgres;

--
-- Name: FUNCTION get_regular_posting_date_counts(p_start_date text, p_end_date text); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.get_regular_posting_date_counts(p_start_date text, p_end_date text) IS 'DateCalendar UI용: 일반 공고 타입의 일자별 공고 개수 집계. 날짜는 yyyy-MM-dd 문자열.';


--
-- Name: get_unread_notification_count(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_unread_notification_count(p_user_id uuid) RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT count(*)::integer FROM public.notifications
  WHERE recipient_id = p_user_id AND is_read = FALSE;
$$;


ALTER FUNCTION public.get_unread_notification_count(p_user_id uuid) OWNER TO postgres;

--
-- Name: get_venue_day_slots(uuid, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_venue_day_slots(p_venue uuid, p_date text) RETURNS TABLE(work_log_id uuid, staff_id uuid, staff_name text, staff_nickname text, staff_photo_url text, role text, custom_role text, time_slot text, status text, job_posting_id uuid, is_container boolean, color text, notes text)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_ws uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 인증이 필요합니다';
  END IF;
  SELECT jp.workspace_id INTO v_ws FROM public.job_postings jp WHERE jp.id = p_venue AND jp.status = 'container';
  IF v_ws IS NULL THEN
    RAISE EXCEPTION 'VENUE_NOT_FOUND: %', p_venue;
  END IF;
  IF NOT (public.is_workspace_member(v_ws, auth.uid()) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 워크스페이스 권한이 없습니다';
  END IF;

  RETURN QUERY
  SELECT
    wl.id,
    wl.staff_id,
    wl.staff_name,
    wl.staff_nickname,
    wl.staff_photo_url,
    wl.role::text,
    wl.custom_role,
    wl.time_slot,
    wl.status::text,
    wl.job_posting_id,
    (wl.job_posting_id = p_venue) AS is_container,
    wl.color,
    wl.notes
  FROM public.work_logs wl
  WHERE wl.job_posting_id IN (
      -- M1: venue 스팬 ∩ 동일 workspace (타 워크스페이스 유령행 차단)
      SELECT jp.id FROM public.job_postings jp
      WHERE jp.id IN (SELECT public.venue_span_posting_ids(p_venue))
        AND jp.workspace_id = v_ws
    )
    AND wl.date = p_date
    AND wl.status NOT IN ('cancelled', 'no_show')
  ORDER BY wl.time_slot NULLS LAST, wl.staff_name;
END;
$$;


ALTER FUNCTION public.get_venue_day_slots(p_venue uuid, p_date text) OWNER TO postgres;

--
-- Name: FUNCTION get_venue_day_slots(p_venue uuid, p_date text); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.get_venue_day_slots(p_venue uuid, p_date text) IS '주간 그리드 하루 슬롯: venue 스팬 ∩ 동일 workspace 그 날 work_logs union (컨테이너+open 공고, M1 재필터).';


--
-- Name: get_venue_grid_summary(uuid, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_venue_grid_summary(p_venue uuid, p_from text, p_to text) RETURNS TABLE(d text, headcount integer, job_count integer)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_ws uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 인증이 필요합니다';
  END IF;
  SELECT jp.workspace_id INTO v_ws FROM public.job_postings jp WHERE jp.id = p_venue AND jp.status = 'container';
  IF v_ws IS NULL THEN
    RAISE EXCEPTION 'VENUE_NOT_FOUND: %', p_venue;
  END IF;
  IF NOT (public.is_workspace_member(v_ws, auth.uid()) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 워크스페이스 권한이 없습니다';
  END IF;

  RETURN QUERY
  SELECT
    wl.date AS d,
    COUNT(*)::int AS headcount,
    COUNT(DISTINCT wl.job_posting_id) FILTER (WHERE wl.job_posting_id <> p_venue)::int AS job_count
  FROM public.work_logs wl
  WHERE wl.job_posting_id IN (
      -- M1: venue 스팬 ∩ 동일 workspace (타 워크스페이스 유령행 차단)
      SELECT jp.id FROM public.job_postings jp
      WHERE jp.id IN (SELECT public.venue_span_posting_ids(p_venue))
        AND jp.workspace_id = v_ws
    )
    AND wl.date >= p_from AND wl.date <= p_to
    AND wl.status NOT IN ('cancelled', 'no_show')
  GROUP BY wl.date;
END;
$$;


ALTER FUNCTION public.get_venue_grid_summary(p_venue uuid, p_from text, p_to text) OWNER TO postgres;

--
-- Name: FUNCTION get_venue_grid_summary(p_venue uuid, p_from text, p_to text); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.get_venue_grid_summary(p_venue uuid, p_from text, p_to text) IS '주간 그리드 월 요약: venue 스팬 ∩ 동일 workspace 날짜별 headcount + job_count (E1 SSOT 경유, SECDEF 게이트, M1 재필터).';


--
-- Name: get_workspace_owner_profile(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_workspace_owner_profile(_workspace_id uuid) RETURNS TABLE(id uuid, nickname text, name text, photo_url text)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NOT public.is_workspace_member(_workspace_id, auth.uid())
     AND public.get_my_role() != 'admin' THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT u.id, u.nickname, u.name, u.photo_url
    FROM public.workspaces w
    JOIN public.users u ON u.id = w.owner_id
    WHERE w.id = _workspace_id;
END;
$$;


ALTER FUNCTION public.get_workspace_owner_profile(_workspace_id uuid) OWNER TO postgres;

--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_provider text;
  v_role public.user_role;
  v_workspace_name text;
BEGIN
  v_provider := NEW.raw_app_meta_data ->> 'provider';
  v_role := COALESCE((NEW.raw_app_meta_data ->> 'role')::public.user_role, 'staff');

  INSERT INTO public.users (id, email, name, role, social_provider)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data ->> 'name', ''),
    v_role,
    CASE
      WHEN v_provider IN ('apple', 'google', 'kakao', 'naver') THEN v_provider
      ELSE NULL
    END
  );

  -- employer 자동 default workspace 생성
  IF v_role = 'employer' THEN
    BEGIN
      v_workspace_name := COALESCE(
        NULLIF(LEFT(NEW.raw_user_meta_data ->> 'name', 40), ''),
        NULLIF(LEFT(SPLIT_PART(COALESCE(NEW.email, ''), '@', 1), 40), ''),
        '내'
      ) || ' 워크스페이스';

      INSERT INTO public.workspaces (name, owner_id)
      VALUES (v_workspace_name, NEW.id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'handle_new_user: workspace 자동 생성 실패 (user_id=%, error=%)',
        NEW.id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

--
-- Name: FUNCTION handle_new_user(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.handle_new_user() IS '신규 가입자 public.users INSERT + employer default workspace 자동 생성. 지갑/IAP 제거로 가입 하트 grant 블록 제거 (2026-06-22). workspace 실패는 회원가입 차단하지 않음 (EXCEPTION 격리).';


--
-- Name: increment_announcement_view_count(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.increment_announcement_view_count(p_announcement_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_author_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 인증된 사용자만 조회수를 증가시킬 수 있습니다';
  END IF;

  SELECT author_id INTO v_author_id
  FROM public.announcements
  WHERE id = p_announcement_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_author_id IS NOT NULL AND v_author_id = auth.uid() THEN
    RETURN;
  END IF;

  UPDATE public.announcements
  SET view_count = COALESCE(view_count, 0) + 1
  WHERE id = p_announcement_id;
END;
$$;


ALTER FUNCTION public.increment_announcement_view_count(p_announcement_id uuid) OWNER TO postgres;

--
-- Name: increment_board_post_view_count(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.increment_board_post_view_count(p_post_id text) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  UPDATE public.board_posts
  SET view_count = COALESCE(view_count, 0) + 1
  WHERE id = p_post_id;
$$;


ALTER FUNCTION public.increment_board_post_view_count(p_post_id text) OWNER TO postgres;

--
-- Name: increment_template_usage(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.increment_template_usage(p_template_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_updated integer;
  v_exists  boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 인증된 사용자만 템플릿 사용 횟수를 증가시킬 수 있습니다';
  END IF;

  UPDATE public.job_posting_templates
  SET usage_count = COALESCE(usage_count, 0) + 1
  WHERE id = p_template_id
    AND (user_id = auth.uid() OR public.is_admin());

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    SELECT EXISTS (SELECT 1 FROM public.job_posting_templates WHERE id = p_template_id)
      INTO v_exists;

    IF NOT v_exists THEN
      RETURN;
    END IF;

    RAISE EXCEPTION 'PERMISSION_DENIED: 본인 또는 관리자만 템플릿 사용 횟수를 증가시킬 수 있습니다';
  END IF;
END;
$$;


ALTER FUNCTION public.increment_template_usage(p_template_id uuid) OWNER TO postgres;

--
-- Name: increment_unread_counter(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.increment_unread_counter() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.notification_counters (user_id, unread_count, updated_at)
  VALUES (NEW.recipient_id, 1, now())
  ON CONFLICT (user_id) DO UPDATE
    SET unread_count = public.notification_counters.unread_count + 1,
        updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.increment_unread_counter() OWNER TO postgres;

--
-- Name: increment_view_count(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.increment_view_count(posting_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_owner_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 인증된 사용자만 조회수를 증가시킬 수 있습니다';
  END IF;

  SELECT owner_id INTO v_owner_id
  FROM public.job_postings
  WHERE id = posting_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_owner_id IS NOT NULL AND v_owner_id = auth.uid() THEN
    RETURN;
  END IF;

  UPDATE public.job_postings
  SET view_count = COALESCE(view_count, 0) + 1
  WHERE id = posting_id;
END;
$$;


ALTER FUNCTION public.increment_view_count(posting_id uuid) OWNER TO postgres;

--
-- Name: invite_workspace_member(uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.invite_workspace_member(p_workspace_id uuid, p_invitee_user_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_owner_id uuid;
  v_caller_id uuid := auth.uid();
  v_invitation_id uuid;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
  END IF;

  IF v_caller_id = p_invitee_user_id THEN
    RAISE EXCEPTION 'SELF_INVITE_FORBIDDEN' USING ERRCODE = 'P0001';
  END IF;

  SELECT owner_id INTO v_owner_id FROM public.workspaces WHERE id = p_workspace_id FOR SHARE;
  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'WORKSPACE_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF v_owner_id != v_caller_id THEN
    RAISE EXCEPTION 'PERMISSION_DENIED' USING ERRCODE = '42501';
  END IF;

  -- 이미 멤버인지
  IF EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = p_workspace_id AND user_id = p_invitee_user_id
  ) THEN
    RAISE EXCEPTION 'ALREADY_MEMBER' USING ERRCODE = 'P0001';
  END IF;

  -- owner 본인 초대 차단 (workspaces.owner_id 가 곧 멤버)
  IF v_owner_id = p_invitee_user_id THEN
    RAISE EXCEPTION 'ALREADY_MEMBER' USING ERRCODE = 'P0001';
  END IF;

  -- pending 중복 차단 (partial unique index 가 동시 INSERT 도 차단)
  BEGIN
    INSERT INTO public.workspace_invitations (workspace_id, invitee_user_id, invited_by)
    VALUES (p_workspace_id, p_invitee_user_id, v_caller_id)
    RETURNING id INTO v_invitation_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'ALREADY_INVITED' USING ERRCODE = 'P0001';
  END;

  RETURN v_invitation_id;
END;
$$;


ALTER FUNCTION public.invite_workspace_member(p_workspace_id uuid, p_invitee_user_id uuid) OWNER TO postgres;

--
-- Name: FUNCTION invite_workspace_member(p_workspace_id uuid, p_invitee_user_id uuid); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.invite_workspace_member(p_workspace_id uuid, p_invitee_user_id uuid) IS 'workspace owner 가 invitee 를 초대. RLS 우회용 SECURITY DEFINER + 명시적 owner 권한 체크.';


--
-- Name: is_admin(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.is_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;


ALTER FUNCTION public.is_admin() OWNER TO postgres;

--
-- Name: is_employer_or_admin(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.is_employer_or_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT coalesce((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'employer'), false);
$$;


ALTER FUNCTION public.is_employer_or_admin() OWNER TO postgres;

--
-- Name: FUNCTION is_employer_or_admin(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.is_employer_or_admin() IS 'JWT app_metadata.role 이 admin 또는 employer 인지 확인. RLS 정책 / RPC 권한 게이트에서 사용. is_admin()과 동일한 보안 시그니처 (SECURITY DEFINER + STABLE + 고정 search_path).';


--
-- Name: is_ops_member(uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.is_ops_member(_tournament_id uuid, _user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.ops_tournaments t
    WHERE t.id = _tournament_id
      AND (
        t.owner_id = _user_id
        OR (
          t.job_posting_id IS NOT NULL
          AND public.is_workspace_member(
            (SELECT jp.workspace_id FROM public.job_postings jp WHERE jp.id = t.job_posting_id),
            _user_id
          )
        )
      )
  );
$$;


ALTER FUNCTION public.is_ops_member(_tournament_id uuid, _user_id uuid) OWNER TO postgres;

--
-- Name: FUNCTION is_ops_member(_tournament_id uuid, _user_id uuid); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.is_ops_member(_tournament_id uuid, _user_id uuid) IS 'ops 멤버십 단일 진실 — owner OR 연결 공고 워크스페이스 멤버. RLS 정책 + RPC authz 핫패스.';


--
-- Name: is_posting_collaborator(uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.is_posting_collaborator(p_posting_id uuid, p_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.job_posting_collaborators
    WHERE job_posting_id = p_posting_id AND user_id = p_user_id
  );
$$;


ALTER FUNCTION public.is_posting_collaborator(p_posting_id uuid, p_user_id uuid) OWNER TO postgres;

--
-- Name: FUNCTION is_posting_collaborator(p_posting_id uuid, p_user_id uuid); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.is_posting_collaborator(p_posting_id uuid, p_user_id uuid) IS '공고별 협업자 여부 — RLS 정책 핫패스. workspace_members 와 OR 평가.';


--
-- Name: is_workspace_jpc_member(uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.is_workspace_jpc_member(_workspace_id uuid, _user_id uuid) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_exists boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1
    FROM public.job_postings jp
    JOIN public.job_posting_collaborators jpc
      ON jpc.job_posting_id = jp.id
    WHERE jp.workspace_id = _workspace_id
      AND jpc.user_id = _user_id
  ) INTO v_exists;
  RETURN v_exists;
END;
$$;


ALTER FUNCTION public.is_workspace_jpc_member(_workspace_id uuid, _user_id uuid) OWNER TO postgres;

--
-- Name: FUNCTION is_workspace_jpc_member(_workspace_id uuid, _user_id uuid); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.is_workspace_jpc_member(_workspace_id uuid, _user_id uuid) IS 'workspaces SELECT RLS 의 JPC JOIN 분기를 SECURITY DEFINER 로 격리. PostgreSQL RLS cycle 가드 회피 (42P17). C2 fix.';


--
-- Name: is_workspace_member(uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.is_workspace_member(_workspace_id uuid, _user_id uuid) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.workspaces
      WHERE id = _workspace_id AND owner_id = _user_id
    UNION ALL
    SELECT 1 FROM public.workspace_members
      WHERE workspace_id = _workspace_id AND user_id = _user_id
  ) INTO v_exists;
  RETURN v_exists;
END;
$$;


ALTER FUNCTION public.is_workspace_member(_workspace_id uuid, _user_id uuid) OWNER TO postgres;

--
-- Name: FUNCTION is_workspace_member(_workspace_id uuid, _user_id uuid); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.is_workspace_member(_workspace_id uuid, _user_id uuid) IS '워크스페이스 멤버십 단일 진실 — owner OR editor. RLS 정책 핫패스.';


--
-- Name: applications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.applications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    applicant_id uuid NOT NULL,
    job_posting_id uuid NOT NULL,
    status public.application_status DEFAULT 'applied'::public.application_status NOT NULL,
    applicant_name text NOT NULL,
    applicant_phone text,
    applicant_email text,
    applicant_role public.staff_role,
    applicant_nickname text,
    applicant_photo_url text,
    job_posting_title text,
    job_posting_date text,
    recruitment_type text,
    custom_role text,
    message text,
    assignments jsonb DEFAULT '[]'::jsonb,
    original_application jsonb,
    confirmation_history jsonb DEFAULT '[]'::jsonb,
    pre_question_answers jsonb,
    processed_by text,
    processed_at timestamp with time zone,
    rejection_reason text,
    confirmed_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    is_read boolean DEFAULT false,
    notes text,
    cancellation_request jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    applicant_photo_url_blurhash text,
    applicant_provision_consent_at timestamp with time zone,
    applicant_provision_consent_version text,
    CONSTRAINT applications_recruitment_type_check CHECK ((recruitment_type = ANY (ARRAY['event'::text, 'fixed'::text])))
);

ALTER TABLE ONLY public.applications REPLICA IDENTITY FULL;


ALTER TABLE public.applications OWNER TO postgres;

--
-- Name: COLUMN applications.applicant_photo_url_blurhash; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.applications.applicant_photo_url_blurhash IS 'impeccable v2 §18. users.photo_url_blurhash 비정규화 사본. 지원 시점 스냅샷.';


--
-- Name: COLUMN applications.applicant_provision_consent_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.applications.applicant_provision_consent_at IS '지원 시점 - 이 공고 구인자에게 정보 제공 동의 timestamp (포괄동의 보강)';


--
-- Name: COLUMN applications.applicant_provision_consent_version; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.applications.applicant_provision_consent_version IS 'thirdPartyConsent.ts 의 version 값 (예: v1-2026-05-13)';


--
-- Name: list_all_applications(public.application_status); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.list_all_applications(p_status public.application_status DEFAULT NULL::public.application_status) RETURNS SETOF public.applications
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_uid uuid;
  v_role text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RETURN; END IF;

  SELECT role::text INTO v_role
  FROM public.users
  WHERE id = v_uid AND is_active = true;

  IF v_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'PERMISSION_DENIED' USING errcode = 'P0001';
  END IF;

  RETURN QUERY
  SELECT * FROM public.applications
  WHERE p_status IS NULL OR status = p_status
  ORDER BY created_at DESC;
END;
$$;


ALTER FUNCTION public.list_all_applications(p_status public.application_status) OWNER TO postgres;

--
-- Name: event_qr_codes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.event_qr_codes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    job_posting_id uuid NOT NULL,
    user_id uuid NOT NULL,
    type text NOT NULL,
    code text NOT NULL,
    work_date text,
    is_active boolean DEFAULT true,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    assignment_group_id text,
    time_slot text,
    CONSTRAINT event_qr_codes_type_check CHECK ((type = ANY (ARRAY['checkIn'::text, 'checkOut'::text])))
);


ALTER TABLE public.event_qr_codes OWNER TO postgres;

--
-- Name: list_all_event_qr_codes(boolean); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.list_all_event_qr_codes(p_active boolean DEFAULT NULL::boolean) RETURNS SETOF public.event_qr_codes
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_uid uuid;
  v_role text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RETURN; END IF;

  SELECT role::text INTO v_role
  FROM public.users
  WHERE id = v_uid AND is_active = true;

  IF v_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'PERMISSION_DENIED' USING errcode = 'P0001';
  END IF;

  RETURN QUERY
  SELECT * FROM public.event_qr_codes
  WHERE p_active IS NULL OR is_active = p_active
  ORDER BY created_at DESC;
END;
$$;


ALTER FUNCTION public.list_all_event_qr_codes(p_active boolean) OWNER TO postgres;

--
-- Name: list_all_managed_postings(public.posting_status); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.list_all_managed_postings(p_status public.posting_status DEFAULT NULL::public.posting_status) RETURNS SETOF public.job_postings
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_uid uuid;
  v_role text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN;
  END IF;

  SELECT role::text INTO v_role
  FROM public.users
  WHERE id = v_uid AND is_active = true;

  IF v_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'PERMISSION_DENIED' USING errcode = 'P0001';
  END IF;

  RETURN QUERY
  SELECT *
  FROM public.job_postings
  WHERE p_status IS NULL OR status = p_status
  ORDER BY created_at DESC;
END;
$$;


ALTER FUNCTION public.list_all_managed_postings(p_status public.posting_status) OWNER TO postgres;

--
-- Name: work_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.work_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    staff_id uuid NOT NULL,
    job_posting_id uuid NOT NULL,
    application_id uuid,
    assignment_group_id text,
    date text NOT NULL,
    is_fixed_posting boolean DEFAULT false,
    staff_name text,
    staff_nickname text,
    staff_photo_url text,
    status public.work_log_status DEFAULT 'scheduled'::public.work_log_status NOT NULL,
    role public.staff_role DEFAULT 'staff'::public.staff_role NOT NULL,
    custom_role text,
    payroll_status public.payroll_status DEFAULT 'pending'::public.payroll_status,
    payroll_amount numeric(12,2),
    payroll_date timestamp with time zone,
    payroll_notes text,
    no_show_at jsonb,
    no_show_reason text,
    modification_history jsonb DEFAULT '[]'::jsonb,
    role_change_history jsonb DEFAULT '[]'::jsonb,
    settlement_modification_history jsonb DEFAULT '[]'::jsonb,
    has_time_modification_logs boolean DEFAULT false,
    custom_salary_info jsonb,
    custom_allowances jsonb,
    custom_tax_settings jsonb,
    notes text,
    time_slot text,
    owner_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    work_duration numeric,
    staff_photo_url_blurhash text,
    check_in_ts timestamp with time zone,
    check_out_ts timestamp with time zone,
    color text,
    clocked_out_raw timestamp with time zone,
    end_time_source text,
    edited_by uuid,
    CONSTRAINT work_logs_status_timestamp_consistency CHECK (
CASE
    WHEN (status = 'checked_in'::public.work_log_status) THEN (check_in_ts IS NOT NULL)
    WHEN (status = ANY (ARRAY['checked_out'::public.work_log_status, 'completed'::public.work_log_status])) THEN ((check_in_ts IS NOT NULL) AND (check_out_ts IS NOT NULL))
    ELSE true
END)
);

ALTER TABLE ONLY public.work_logs REPLICA IDENTITY FULL;


ALTER TABLE public.work_logs OWNER TO postgres;

--
-- Name: COLUMN work_logs.work_duration; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.work_logs.work_duration IS '근무시간 (시간 단위, 소수점 2자리). QR 퇴근 시 자동 계산.';


--
-- Name: COLUMN work_logs.staff_photo_url_blurhash; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.work_logs.staff_photo_url_blurhash IS 'impeccable v2 §18. users.photo_url_blurhash 비정규화 사본. 근무 배치 시점 스냅샷.';


--
-- Name: COLUMN work_logs.check_in_ts; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.work_logs.check_in_ts IS '출근 시각 (timestamptz). Phase D.3 에서 jsonb check_in_time 제거됨 (2026-04-21).';


--
-- Name: COLUMN work_logs.check_out_ts; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.work_logs.check_out_ts IS '퇴근 시각 (timestamptz). Phase D.3 에서 jsonb check_out_time 제거됨 (2026-04-21).';


--
-- Name: list_all_work_logs(public.work_log_status, date, date); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.list_all_work_logs(p_status public.work_log_status DEFAULT NULL::public.work_log_status, p_date_from date DEFAULT NULL::date, p_date_to date DEFAULT NULL::date) RETURNS SETOF public.work_logs
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_uid uuid;
  v_role text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RETURN; END IF;

  SELECT role::text INTO v_role
  FROM public.users
  WHERE id = v_uid AND is_active = true;

  IF v_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'PERMISSION_DENIED' USING errcode = 'P0001';
  END IF;

  RETURN QUERY
  SELECT * FROM public.work_logs
  WHERE (p_status IS NULL OR status = p_status)
    AND (p_date_from IS NULL OR date >= p_date_from::text)
    AND (p_date_to IS NULL OR date <= p_date_to::text)
  ORDER BY date DESC, created_at DESC;
END;
$$;


ALTER FUNCTION public.list_all_work_logs(p_status public.work_log_status, p_date_from date, p_date_to date) OWNER TO postgres;

--
-- Name: workspace_members; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.workspace_members (
    workspace_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role public.workspace_role DEFAULT 'editor'::public.workspace_role NOT NULL,
    invited_by uuid,
    joined_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.workspace_members FORCE ROW LEVEL SECURITY;


ALTER TABLE public.workspace_members OWNER TO postgres;

--
-- Name: TABLE workspace_members; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.workspace_members IS 'editor 멤버만 저장. owner는 workspaces.owner_id 단독 (D2 — drift 0).';


--
-- Name: list_all_workspace_members(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.list_all_workspace_members(p_workspace_id uuid DEFAULT NULL::uuid) RETURNS SETOF public.workspace_members
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_uid uuid;
  v_role text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RETURN; END IF;

  SELECT role::text INTO v_role
  FROM public.users
  WHERE id = v_uid AND is_active = true;

  IF v_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'PERMISSION_DENIED' USING errcode = 'P0001';
  END IF;

  RETURN QUERY
  SELECT * FROM public.workspace_members
  WHERE p_workspace_id IS NULL OR workspace_id = p_workspace_id
  ORDER BY joined_at DESC;
END;
$$;


ALTER FUNCTION public.list_all_workspace_members(p_workspace_id uuid) OWNER TO postgres;

--
-- Name: list_my_workspaces(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.list_my_workspaces() RETURNS TABLE(id uuid, name text, owner_id uuid, member_count integer, created_at timestamp with time zone, updated_at timestamp with time zone, archived_at timestamp with time zone)
    LANGUAGE plpgsql STABLE
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_uid uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    w.id,
    w.name,
    w.owner_id,
    w.member_count,
    w.created_at,
    w.updated_at,
    w.archived_at
  FROM public.workspaces w
  WHERE
    w.archived_at IS NULL
    AND (
      w.owner_id = v_uid
      OR EXISTS (
        SELECT 1 FROM public.workspace_members wm
        WHERE wm.workspace_id = w.id AND wm.user_id = v_uid
      )
    )
  ORDER BY w.created_at ASC;
END;
$$;


ALTER FUNCTION public.list_my_workspaces() OWNER TO postgres;

--
-- Name: FUNCTION list_my_workspaces(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.list_my_workspaces() IS '현재 사용자가 owner 또는 명시적 member 인 활성(archived_at IS NULL) 워크스페이스만 반환. 2026-05-24 아카이브 제외 + archived_at 컬럼 추가.';


--
-- Name: log_collaborator_audit(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.log_collaborator_audit() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  v_actor uuid;
BEGIN
  v_actor := auth.uid();
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.job_posting_collaborator_audit
      (job_posting_id, target_user_id, actor_user_id, action, source)
    VALUES (
      NEW.job_posting_id, NEW.user_id,
      NEW.added_by,
      'added',
      CASE WHEN v_actor IS NULL THEN 'system' ELSE 'user' END
    );
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.job_posting_collaborator_audit
      (job_posting_id, target_user_id, actor_user_id, action, source)
    VALUES (
      OLD.job_posting_id, OLD.user_id,
      v_actor,
      'removed',
      CASE WHEN v_actor IS NULL THEN 'cascade' ELSE 'user' END
    );
  END IF;
  RETURN NULL;
END;
$$;


ALTER FUNCTION public.log_collaborator_audit() OWNER TO postgres;

--
-- Name: notify_employer_application_change(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.notify_employer_application_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- INSERT: 새 pending 신청
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    -- 신청자에게 접수 알림
    INSERT INTO notifications (recipient_id, type, category, title, body, link, is_read, priority, created_at)
    VALUES (
      NEW.user_id,
      'employer_app_submitted',
      'system',
      '구인자 신청 접수',
      '구인자 등록 신청이 접수되었습니다. 평균 1-2시간 내 검토 후 결과를 알려드립니다.',
      '/employer-application-status',
      false,
      'normal',
      now()
    );

    -- 모든 admin에게 새 신청 알림
    INSERT INTO notifications (recipient_id, type, category, title, body, link, data, is_read, priority, created_at)
    SELECT
      u.id,
      'new_employer_application',
      'admin',
      '📋 새 구인자 신청',
      '새로운 구인자 등록 신청이 접수되었습니다.',
      '/admin/employer-applications/' || NEW.id,
      jsonb_build_object('applicationId', NEW.id, 'userId', NEW.user_id),
      false,
      'high',
      now()
    FROM users u
    WHERE u.role = 'admin';

  -- UPDATE → approved
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'approved' AND OLD.status = 'pending' THEN
    INSERT INTO notifications (recipient_id, type, category, title, body, link, is_read, priority, created_at)
    VALUES (
      NEW.user_id,
      'employer_app_approved',
      'system',
      '🎉 구인자 신청 승인',
      '구인자 등록 신청이 승인되었습니다. 지금 바로 공고를 등록해보세요!',
      '/employer-application-status',
      false,
      'high',
      now()
    );

  -- UPDATE → rejected
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'rejected' AND OLD.status = 'pending' THEN
    INSERT INTO notifications (recipient_id, type, category, title, body, link, data, is_read, priority, created_at)
    VALUES (
      NEW.user_id,
      'employer_app_rejected',
      'system',
      '구인자 신청 거부',
      '구인자 신청이 거부되었습니다.' || CASE WHEN NEW.rejection_category IS NOT NULL THEN ' 사유: ' || NEW.rejection_category ELSE '' END,
      '/employer-application-status',
      jsonb_build_object(
        'rejectionCategory', NEW.rejection_category,
        'rejectionReason', NEW.rejection_reason
      ),
      false,
      'normal',
      now()
    );
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION public.notify_employer_application_change() OWNER TO postgres;

--
-- Name: notify_on_application_insert(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.notify_on_application_insert() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
DECLARE
  v_job_title text;
  v_workspace_id uuid;
BEGIN
  SELECT title, workspace_id INTO v_job_title, v_workspace_id
  FROM public.job_postings WHERE id = NEW.job_posting_id;

  IF v_workspace_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (
    recipient_id, type, title, body, link, data, priority
  )
  SELECT
    r.recipient_id,
    'new_application',
    '📨 새로운 지원자',
    format('%s님이 ''%s''에 지원했습니다.', NEW.applicant_name, COALESCE(v_job_title, '해당 공고')),
    format('/employer/applicants/%s', NEW.job_posting_id),
    jsonb_build_object(
      'applicationId', NEW.id,
      'jobPostingId', NEW.job_posting_id,
      'applicantId', NEW.applicant_id,
      'applicantName', NEW.applicant_name,
      'jobPostingTitle', COALESCE(v_job_title, ''),
      'senderId', NEW.applicant_id
    ),
    'normal'
  FROM (
    SELECT owner_id AS recipient_id FROM public.workspaces WHERE id = v_workspace_id
    UNION
    SELECT user_id  AS recipient_id FROM public.workspace_members WHERE workspace_id = v_workspace_id
    UNION
    SELECT user_id  AS recipient_id FROM public.job_posting_collaborators WHERE job_posting_id = NEW.job_posting_id
  ) r
  WHERE r.recipient_id IS NOT NULL
    AND r.recipient_id != NEW.applicant_id;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[notify_on_application_insert] failed for application % — %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.notify_on_application_insert() OWNER TO postgres;

--
-- Name: FUNCTION notify_on_application_insert(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.notify_on_application_insert() IS 'Application INSERT 시 employer에게 신규 지원 알림 (Firebase onApplicationSubmitted 대체)';


--
-- Name: notify_on_application_update(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.notify_on_application_update() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
DECLARE
  v_job_title text;
  v_owner_id uuid;
  v_label text;
  v_old_cancel_status text;
  v_new_cancel_status text;
  v_rejection_reason text;
BEGIN
  -- 변경 감지: status 또는 cancellation_request.status
  v_old_cancel_status := OLD.cancellation_request ->> 'status';
  v_new_cancel_status := NEW.cancellation_request ->> 'status';

  IF OLD.status = NEW.status
     AND v_old_cancel_status IS NOT DISTINCT FROM v_new_cancel_status THEN
    RETURN NEW;
  END IF;

  -- 공고 정보 조회
  SELECT title, owner_id INTO v_job_title, v_owner_id
  FROM public.job_postings
  WHERE id = NEW.job_posting_id;

  v_label := CASE
    WHEN v_job_title IS NULL OR v_job_title = '' THEN '해당 공고'
    ELSE format('''%s''', v_job_title)
  END;

  -- ============ status 전환 ============

  -- applied → confirmed: 지원 확정 (high priority)
  IF OLD.status = 'applied' AND NEW.status = 'confirmed' THEN
    INSERT INTO public.notifications (
      recipient_id, type, title, body, link, data, priority
    ) VALUES (
      NEW.applicant_id,
      'application_confirmed',
      '지원 확정',
      format('%s 지원이 확정되었습니다.', v_label),
      '/schedule',
      jsonb_build_object(
        'applicationId', NEW.id,
        'jobPostingId', NEW.job_posting_id,
        'jobPostingTitle', COALESCE(v_job_title, ''),
        'senderId', v_owner_id
      ),
      'high'
    );
  END IF;

  -- → cancelled (cancellation_request 승인 외): 확정 취소
  IF OLD.status <> NEW.status
     AND NEW.status = 'cancelled'
     AND COALESCE(v_new_cancel_status, '') <> 'approved' THEN
    INSERT INTO public.notifications (
      recipient_id, type, title, body, link, data, priority
    ) VALUES (
      NEW.applicant_id,
      'confirmation_cancelled',
      '확정 취소',
      format('%s 확정이 취소되었습니다.', v_label),
      '/schedule',
      jsonb_build_object(
        'applicationId', NEW.id,
        'jobPostingId', NEW.job_posting_id,
        'jobPostingTitle', COALESCE(v_job_title, ''),
        'senderId', v_owner_id
      ),
      'normal'
    );
  END IF;

  -- → rejected: 지원 거절
  IF OLD.status <> NEW.status AND NEW.status = 'rejected' THEN
    INSERT INTO public.notifications (
      recipient_id, type, title, body, link, data, priority
    ) VALUES (
      NEW.applicant_id,
      'application_rejected',
      '지원 거절',
      format('%s 지원이 거절되었습니다.', v_label),
      '/schedule',
      jsonb_build_object(
        'applicationId', NEW.id,
        'jobPostingId', NEW.job_posting_id,
        'jobPostingTitle', COALESCE(v_job_title, ''),
        'senderId', v_owner_id
      ),
      'normal'
    );
  END IF;

  -- ============ cancellation_request 전환 ============

  -- → approved: 취소 요청 승인
  IF v_old_cancel_status IS DISTINCT FROM v_new_cancel_status
     AND v_new_cancel_status = 'approved' THEN
    INSERT INTO public.notifications (
      recipient_id, type, title, body, link, data, priority
    ) VALUES (
      NEW.applicant_id,
      'cancellation_approved',
      '취소 요청 승인',
      format('%s 취소 요청이 승인되었습니다.', v_label),
      '/schedule',
      jsonb_build_object(
        'applicationId', NEW.id,
        'jobPostingId', NEW.job_posting_id,
        'jobPostingTitle', COALESCE(v_job_title, ''),
        'senderId', v_owner_id
      ),
      'normal'
    );
  END IF;

  -- → rejected: 취소 요청 거절 (high priority — 출근 의무)
  IF v_old_cancel_status IS DISTINCT FROM v_new_cancel_status
     AND v_new_cancel_status = 'rejected' THEN
    v_rejection_reason := NEW.cancellation_request ->> 'rejectionReason';
    INSERT INTO public.notifications (
      recipient_id, type, title, body, link, data, priority
    ) VALUES (
      NEW.applicant_id,
      'cancellation_rejected',
      '취소 요청 거절',
      format(
        '%s 취소 요청이 거절되었습니다.%s',
        v_label,
        CASE WHEN v_rejection_reason IS NULL OR v_rejection_reason = ''
             THEN ''
             ELSE ' 사유: ' || v_rejection_reason
        END
      ),
      '/schedule',
      jsonb_build_object(
        'applicationId', NEW.id,
        'jobPostingId', NEW.job_posting_id,
        'jobPostingTitle', COALESCE(v_job_title, ''),
        'rejectionReason', COALESCE(v_rejection_reason, ''),
        'senderId', v_owner_id
      ),
      'high'
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[notify_on_application_update] failed for application % — %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.notify_on_application_update() OWNER TO postgres;

--
-- Name: FUNCTION notify_on_application_update(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.notify_on_application_update() IS 'Application status / cancellation_request 변경 시 applicant에게 알림 (Firebase onApplicationStatusChanged 대체)';


--
-- Name: notify_on_board_comment_insert(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.notify_on_board_comment_insert() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $_$
DECLARE
  v_post_title text;
  v_post_author_id uuid;
  v_post_board_type text;
  v_parent_author_id uuid;
  v_is_reply boolean;
  v_comment_title text;
  v_comment_body text;
  v_link text;
  v_base_data jsonb;
  v_mentioned_uuids uuid[];
BEGIN
  -- hidden/deleted 상태 댓글은 알림 스킵
  IF NEW.status = 'hidden' OR NEW.status = 'deleted' THEN
    RETURN NEW;
  END IF;
  IF NEW.author_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT p.title, p.author_id, p.board_type::text
    INTO v_post_title, v_post_author_id, v_post_board_type
  FROM public.board_posts p
  WHERE p.id = NEW.post_id;

  IF v_post_title IS NULL THEN
    RETURN NEW;
  END IF;

  v_is_reply := NEW.parent_comment_id IS NOT NULL;
  v_comment_title := CASE WHEN v_is_reply THEN '새 답글' ELSE '새 댓글' END;
  v_comment_body := format(
    '%s님이 "%s"에 %s을 남겼습니다.',
    COALESCE(NULLIF(NEW.author_name, ''), '사용자'),
    v_post_title,
    CASE WHEN v_is_reply THEN '답글' ELSE '댓글' END
  );
  v_link := format('/board/post/%s', NEW.post_id);
  v_base_data := jsonb_build_object(
    'postId', NEW.post_id,
    'boardTitle', v_post_title,
    'boardType', COALESCE(v_post_board_type, ''),
    'commentId', NEW.id,
    'senderId', NEW.author_id
  );

  -- 부모 댓글 작성자 (답글인 경우)
  IF v_is_reply THEN
    SELECT author_id INTO v_parent_author_id
    FROM public.board_comments
    WHERE id = NEW.parent_comment_id;
  END IF;

  -- mentioned_user_ids → uuid[] 변환 (text[] 저장이므로)
  v_mentioned_uuids := ARRAY(
    SELECT u::uuid
    FROM unnest(COALESCE(NEW.mentioned_user_ids, ARRAY[]::text[])) AS u
    WHERE u ~ '^[0-9a-fA-F-]{36}$'
  );

  -- ① mention 알림 먼저 (high priority, 댓글/답글 알림보다 우선)
  --    schedule 보드: 멤버십 또는 게시글 작성자만 mention 가능
  --    일반 보드: 게시글 작성자 또는 기존 active 댓글 작성자만 mention 가능
  INSERT INTO public.notifications (
    recipient_id, type, title, body, link, data, priority
  )
  SELECT DISTINCT
    m.recipient_id,
    'board_mention',
    '멘션',
    format(
      '%s님이 "%s"에서 회원님을 멘션했습니다.',
      COALESCE(NULLIF(NEW.author_name, ''), '사용자'),
      v_post_title
    ),
    v_link,
    v_base_data,
    'high'
  FROM unnest(v_mentioned_uuids) AS m(recipient_id)
  WHERE m.recipient_id <> NEW.author_id
    AND (
      (v_post_board_type = 'schedule' AND (
        m.recipient_id = v_post_author_id
        OR EXISTS (
          SELECT 1 FROM public.board_memberships bm
          WHERE bm.post_id = NEW.post_id
            AND bm.user_id = m.recipient_id
            AND bm.can_read = true
        )
      ))
      OR (v_post_board_type IS DISTINCT FROM 'schedule' AND (
        m.recipient_id = v_post_author_id
        OR EXISTS (
          SELECT 1 FROM public.board_comments bc
          WHERE bc.post_id = NEW.post_id
            AND bc.author_id = m.recipient_id
            AND bc.status = 'active'
        )
      ))
    );

  -- ② 댓글/답글 수신 대상 수집 (멘션 받은 사람 제외)
  WITH recipients AS (
    -- 답글: 부모 댓글 작성자 + 게시글 작성자
    SELECT v_parent_author_id AS recipient_id WHERE v_is_reply AND v_parent_author_id IS NOT NULL
    UNION
    SELECT v_post_author_id WHERE v_post_author_id IS NOT NULL
    UNION
    -- schedule 보드: 멤버 전체
    SELECT bm.user_id
    FROM public.board_memberships bm
    WHERE v_post_board_type = 'schedule'
      AND bm.post_id = NEW.post_id
      AND bm.can_read = true
  )
  INSERT INTO public.notifications (
    recipient_id, type, title, body, link, data, priority
  )
  SELECT DISTINCT
    r.recipient_id,
    CASE WHEN v_is_reply THEN 'board_reply' ELSE 'board_comment' END,
    v_comment_title,
    v_comment_body,
    v_link,
    v_base_data,
    'normal'
  FROM recipients r
  WHERE r.recipient_id IS NOT NULL
    AND r.recipient_id <> NEW.author_id
    AND r.recipient_id <> ALL(COALESCE(v_mentioned_uuids, ARRAY[]::uuid[]));

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[notify_on_board_comment_insert] failed for comment % — %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$_$;


ALTER FUNCTION public.notify_on_board_comment_insert() OWNER TO postgres;

--
-- Name: FUNCTION notify_on_board_comment_insert(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.notify_on_board_comment_insert() IS 'board_comments INSERT 시 게시글/부모 댓글 작성자/schedule 멤버/멘션 대상에게 알림 (Firebase onBoardCommentCreated 대체)';


--
-- Name: notify_on_board_post_update(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.notify_on_board_post_update() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $_$
DECLARE
  v_actor_id uuid;
  v_title text;
BEGIN
  -- is_locked false→true 전환만 감지
  IF OLD.is_locked = NEW.is_locked OR NEW.is_locked IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  v_title := COALESCE(NULLIF(NEW.title, ''), '게시글');

  -- locked_by가 uuid 문자열이면 파싱, 아니면 author_id 사용
  IF NEW.locked_by IS NOT NULL AND NEW.locked_by ~ '^[0-9a-fA-F-]{36}$' THEN
    v_actor_id := NEW.locked_by::uuid;
  ELSE
    v_actor_id := NEW.author_id;
  END IF;

  WITH recipients AS (
    SELECT NEW.author_id AS recipient_id WHERE NEW.author_id IS NOT NULL
    UNION
    SELECT bc.author_id
    FROM public.board_comments bc
    WHERE bc.post_id = NEW.id
      AND bc.author_id IS NOT NULL
    UNION
    SELECT bm.user_id
    FROM public.board_memberships bm
    WHERE NEW.board_type::text = 'schedule'
      AND bm.post_id = NEW.id
      AND bm.can_read = true
  )
  INSERT INTO public.notifications (
    recipient_id, type, title, body, link, data, priority
  )
  SELECT DISTINCT
    r.recipient_id,
    'board_locked',
    '게시글 잠금',
    format('"%s" 글이 잠겼습니다.', v_title),
    format('/board/post/%s', NEW.id),
    jsonb_build_object(
      'postId', NEW.id,
      'boardTitle', v_title,
      'boardType', NEW.board_type::text,
      'senderId', v_actor_id
    ),
    'high'
  FROM recipients r
  WHERE r.recipient_id IS NOT NULL
    AND r.recipient_id IS DISTINCT FROM v_actor_id;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[notify_on_board_post_update] failed for post % — %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$_$;


ALTER FUNCTION public.notify_on_board_post_update() OWNER TO postgres;

--
-- Name: FUNCTION notify_on_board_post_update(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.notify_on_board_post_update() IS 'board_posts UPDATE 시 잠금 전환되면 참여자에게 잠금 알림 (Firebase onBoardPostLocked 대체)';


--
-- Name: notify_on_collaborator_added(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.notify_on_collaborator_added() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
DECLARE
  v_caller_uid    uuid;
  v_job_title     text;
  v_adder_name    text;
BEGIN
  v_caller_uid := (SELECT auth.uid());

  IF v_caller_uid IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT title INTO v_job_title
  FROM public.job_postings WHERE id = NEW.job_posting_id;

  SELECT COALESCE(raw_user_meta_data->>'name', email)
  INTO v_adder_name
  FROM auth.users WHERE id = NEW.added_by;

  INSERT INTO public.notifications (
    recipient_id, type, title, body, link, data, priority
  ) VALUES (
    NEW.user_id,
    'job_posting_collaborator_added',
    '🤝 공고 관리 초대',
    format('%s님이 ''%s'' 공고 관리에 초대했어요',
           COALESCE(v_adder_name, '동료'),
           COALESCE(v_job_title, '해당 공고')),
    format('/my-postings/%s', NEW.job_posting_id),
    jsonb_build_object(
      'jobPostingId', NEW.job_posting_id,
      'addedBy', NEW.added_by,
      'addedAt', NEW.added_at,
      'senderId', NEW.added_by
    ),
    'normal'
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[notify_on_collaborator_added] failed for jpc % — %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.notify_on_collaborator_added() OWNER TO postgres;

--
-- Name: notify_on_collaborator_removed(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.notify_on_collaborator_removed() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
DECLARE
  v_caller_uid uuid;
  v_job_title  text;
BEGIN
  v_caller_uid := (SELECT auth.uid());

  IF v_caller_uid IS NULL OR v_caller_uid = OLD.user_id THEN
    RETURN OLD;
  END IF;

  SELECT title INTO v_job_title
  FROM public.job_postings WHERE id = OLD.job_posting_id;

  INSERT INTO public.notifications (
    recipient_id, type, title, body, link, data, priority
  ) VALUES (
    OLD.user_id,
    'job_posting_collaborator_removed',
    '공고 관리 제외',
    format('''%s'' 공고 관리에서 제외되었어요',
           COALESCE(v_job_title, '해당 공고')),
    '/my-postings',
    jsonb_build_object(
      'jobPostingId', OLD.job_posting_id,
      'senderId', v_caller_uid
    ),
    'normal'
  );

  RETURN OLD;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[notify_on_collaborator_removed] failed for jpc % — %', OLD.id, SQLERRM;
  RETURN OLD;
END;
$$;


ALTER FUNCTION public.notify_on_collaborator_removed() OWNER TO postgres;

--
-- Name: notify_on_inquiry_insert(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.notify_on_inquiry_insert() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
DECLARE
  v_user_name text;
BEGIN
  v_user_name := COALESCE(NULLIF(NEW.user_name, ''), '사용자');

  INSERT INTO public.notifications (
    recipient_id, type, title, body, link, data, priority
  )
  SELECT
    u.id,
    'new_inquiry',
    '💬 새로운 문의 접수',
    format('%s님의 문의: %s', v_user_name, NEW.subject),
    format('/admin/inquiries/%s', NEW.id),
    jsonb_build_object(
      'inquiryId', NEW.id,
      'category', COALESCE(NEW.category, ''),
      'subject', NEW.subject,
      'userName', v_user_name,
      'senderId', NEW.user_id
    ),
    'normal'
  FROM public.users u
  WHERE u.role = 'admin';

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[notify_on_inquiry_insert] failed for inquiry % — %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.notify_on_inquiry_insert() OWNER TO postgres;

--
-- Name: FUNCTION notify_on_inquiry_insert(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.notify_on_inquiry_insert() IS 'inquiries INSERT 시 전체 관리자에게 문의 접수 알림 (Firebase onInquiryCreated 대체)';


--
-- Name: notify_on_job_posting_insert(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.notify_on_job_posting_insert() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
DECLARE
  v_employer_name text;
BEGIN
  -- tournament 타입만 처리
  IF NEW.posting_type IS DISTINCT FROM 'tournament' THEN
    RETURN NEW;
  END IF;

  -- 구인자 이름 조회
  SELECT COALESCE(name, '알 수 없음') INTO v_employer_name
  FROM public.users
  WHERE id = NEW.owner_id;

  v_employer_name := COALESCE(v_employer_name, '알 수 없음');

  -- 모든 관리자에게 알림 INSERT
  INSERT INTO public.notifications (
    recipient_id, type, title, body, link, data, priority
  )
  SELECT
    u.id,
    'tournament_approval_request',
    '🏆 대회공고 승인 요청',
    format('%s님이 ''%s'' 대회공고 승인을 요청했습니다.', v_employer_name, NEW.title),
    '/admin/tournaments',
    jsonb_build_object(
      'jobPostingId', NEW.id,
      'jobTitle', NEW.title,
      'employerName', v_employer_name,
      'employerId', NEW.owner_id,
      'senderId', NEW.owner_id
    ),
    'high'
  FROM public.users u
  WHERE u.role = 'admin';

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[notify_on_job_posting_insert] failed for posting % — %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.notify_on_job_posting_insert() OWNER TO postgres;

--
-- Name: FUNCTION notify_on_job_posting_insert(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.notify_on_job_posting_insert() IS 'job_postings INSERT 시 관리자에게 대회공고 승인 요청 알림 (Firebase onTournamentPostingCreated 대체)';


--
-- Name: notify_on_job_posting_owner_expired(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.notify_on_job_posting_owner_expired() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
DECLARE
  v_notif_type text;
  v_notif_title text;
  v_notif_body text;
BEGIN
  IF NOT (OLD.status IN ('active', 'capacity_full') AND NEW.status = 'closed') THEN
    RETURN NEW;
  END IF;

  IF NEW.owner_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.closed_reason = 'expired' AND NEW.posting_type = 'fixed' THEN
    v_notif_type := 'fixed_posting_expired';
    v_notif_title := '⏰ 고정 공고 만료';
    v_notif_body := format('''%s'' 고정 공고가 만료되어 자동 마감되었습니다.', COALESCE(NEW.title, '공고'));
  ELSIF NEW.closed_reason = 'expired_by_work_date' THEN
    v_notif_type := 'work_date_expired';
    v_notif_title := '⏰ 공고 자동 마감';
    v_notif_body := format('''%s'' 공고가 근무일 경과로 자동 마감되었습니다.', COALESCE(NEW.title, '공고'));
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (
    recipient_id, type, title, body, link, data, priority
  ) VALUES (
    NEW.owner_id,
    v_notif_type,
    v_notif_title,
    v_notif_body,
    format('/jobs/%s', NEW.id),
    jsonb_build_object(
      'jobPostingId', NEW.id,
      'jobPostingTitle', COALESCE(NEW.title, ''),
      'closedReason', NEW.closed_reason,
      'postingType', NEW.posting_type::text
    ),
    'normal'
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[notify_on_job_posting_owner_expired] failed for posting % — %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.notify_on_job_posting_owner_expired() OWNER TO postgres;

--
-- Name: FUNCTION notify_on_job_posting_owner_expired(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.notify_on_job_posting_owner_expired() IS '공고 자동 마감(expired/expired_by_work_date) 시 작성자에게 알림 (Firebase onFixedPostingExpired + onWorkDateExpired 통합)';


--
-- Name: notify_on_job_posting_update(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.notify_on_job_posting_update() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
DECLARE
  v_changed_fields text[] := ARRAY[]::text[];
  v_status_transitioned boolean;
  v_notif_type text;
  v_notif_title text;
  v_notif_body text;
  v_notif_link text;
  v_notif_priority text;
  v_notif_data jsonb;
BEGIN
  v_status_transitioned := OLD.status IS DISTINCT FROM NEW.status;

  -- 1) status → 'cancelled' 전환: 공고 취소 알림 (high)
  IF v_status_transitioned AND NEW.status = 'cancelled' THEN
    v_notif_type := 'job_cancelled';
    v_notif_title := '🚫 공고 취소';
    v_notif_body := format('''%s''가 취소되었습니다.', COALESCE(NEW.title, '공고'));
    v_notif_link := '/schedule';
    v_notif_priority := 'high';
    v_notif_data := jsonb_build_object(
      'jobPostingId', NEW.id,
      'jobPostingTitle', COALESCE(NEW.title, ''),
      'senderId', NEW.owner_id
    );

  -- 2) status → 'closed' 전환: 공고 마감 알림 (normal)
  ELSIF v_status_transitioned AND NEW.status = 'closed' THEN
    v_notif_type := 'job_closed';
    v_notif_title := '📋 공고 마감 안내';
    v_notif_body := format('''%s''가 마감되었습니다.', COALESCE(NEW.title, '공고'));
    v_notif_link := format('/jobs/%s', NEW.id);
    v_notif_priority := 'normal';
    v_notif_data := jsonb_build_object(
      'jobPostingId', NEW.id,
      'jobPostingTitle', COALESCE(NEW.title, ''),
      'senderId', NEW.owner_id
    );

  -- 3) 기타 필드 변경: 공고 수정 알림 (normal)
  ELSE
    IF OLD.title IS DISTINCT FROM NEW.title THEN
      v_changed_fields := v_changed_fields || 'title';
    END IF;
    IF OLD.location IS DISTINCT FROM NEW.location THEN
      v_changed_fields := v_changed_fields || 'location';
    END IF;
    IF OLD.work_date IS DISTINCT FROM NEW.work_date THEN
      v_changed_fields := v_changed_fields || 'workDate';
    END IF;
    IF OLD.work_dates IS DISTINCT FROM NEW.work_dates THEN
      v_changed_fields := v_changed_fields || 'workDates';
    END IF;
    IF OLD.schedule IS DISTINCT FROM NEW.schedule THEN
      v_changed_fields := v_changed_fields || 'schedule';
    END IF;
    IF OLD.compensation IS DISTINCT FROM NEW.compensation THEN
      v_changed_fields := v_changed_fields || 'compensation';
    END IF;
    IF OLD.role_catalog IS DISTINCT FROM NEW.role_catalog THEN
      v_changed_fields := v_changed_fields || 'roleCatalog';
    END IF;
    IF OLD.posting_type IS DISTINCT FROM NEW.posting_type THEN
      v_changed_fields := v_changed_fields || 'postingType';
    END IF;
    IF v_status_transitioned THEN
      v_changed_fields := v_changed_fields || 'status';
    END IF;

    IF array_length(v_changed_fields, 1) IS NULL THEN
      RETURN NEW;
    END IF;

    v_notif_type := 'job_updated';
    v_notif_title := '📝 공고 수정 안내';
    v_notif_body := format(
      '''%s'' 공고가 수정되었습니다. 변경 내용을 확인하세요.',
      COALESCE(NEW.title, '공고')
    );
    v_notif_link := format('/jobs/%s', NEW.id);
    v_notif_priority := 'normal';
    v_notif_data := jsonb_build_object(
      'jobPostingId', NEW.id,
      'jobPostingTitle', COALESCE(NEW.title, ''),
      'changedFields', array_to_string(v_changed_fields, ', '),
      'senderId', NEW.owner_id
    );
  END IF;

  -- 해당 공고에 지원한 활성 지원자 전원에게 알림 INSERT
  INSERT INTO public.notifications (
    recipient_id, type, title, body, link, data, priority
  )
  SELECT DISTINCT
    a.applicant_id,
    v_notif_type,
    v_notif_title,
    v_notif_body,
    v_notif_link,
    v_notif_data,
    v_notif_priority
  FROM public.applications a
  WHERE a.job_posting_id = NEW.id
    AND a.status IN ('confirmed', 'applied', 'cancellation_pending');

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[notify_on_job_posting_update] failed for posting % — %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.notify_on_job_posting_update() OWNER TO postgres;

--
-- Name: FUNCTION notify_on_job_posting_update(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.notify_on_job_posting_update() IS 'job_postings UPDATE 시 지원자에게 수정/마감/취소 알림 (Firebase onJobPostingUpdated/Closed/Cancelled 통합)';


--
-- Name: notify_on_report_insert(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.notify_on_report_insert() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
DECLARE
  v_type_label text;
BEGIN
  -- 신고 유형 라벨 매핑 (Firebase REPORT_TYPE_LABELS 1:1 이전)
  v_type_label := CASE NEW.type
    WHEN 'tardiness' THEN '지각'
    WHEN 'negligence' THEN '근무태만'
    WHEN 'no_show' THEN '노쇼'
    WHEN 'early_leave' THEN '무단 조퇴'
    WHEN 'inappropriate' THEN '부적절한 행동'
    WHEN 'dress_code' THEN '복장 불량'
    WHEN 'communication' THEN '소통 문제'
    WHEN 'false_posting' THEN '허위 공고'
    WHEN 'employer_negligence' THEN '근무 관리 태만'
    WHEN 'unfair_treatment' THEN '부당한 대우'
    WHEN 'inappropriate_behavior' THEN '부적절한 행동'
    WHEN 'other' THEN '기타'
    ELSE NEW.type
  END;

  INSERT INTO public.notifications (
    recipient_id, type, title, body, link, data, priority
  )
  SELECT
    u.id,
    'new_report',
    '🚨 새로운 신고 접수',
    format(
      '%s님이 %s님을 신고했습니다. (%s)',
      NEW.reporter_name, NEW.target_name, v_type_label
    ),
    format('/admin/reports/%s', NEW.id),
    jsonb_build_object(
      'reportId', NEW.id,
      'reportType', NEW.type,
      'reporterName', NEW.reporter_name,
      'targetName', NEW.target_name,
      'severity', COALESCE(NEW.severity::text, 'medium'),
      'senderId', NEW.reporter_id
    ),
    'high'
  FROM public.users u
  WHERE u.role = 'admin';

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[notify_on_report_insert] failed for report % — %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.notify_on_report_insert() OWNER TO postgres;

--
-- Name: FUNCTION notify_on_report_insert(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.notify_on_report_insert() IS 'reports INSERT 시 전체 관리자에게 신고 접수 알림 (Firebase onReportCreated 대체)';


--
-- Name: notify_on_review_insert(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.notify_on_review_insert() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
DECLARE
  v_reviewer_label text;
  v_job_title text;
BEGIN
  IF NEW.reviewee_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_reviewer_label := CASE NEW.reviewer_type
    WHEN 'employer' THEN '구인자'
    WHEN 'staff' THEN '스태프'
    ELSE '상대방'
  END;

  v_job_title := COALESCE(NULLIF(NEW.job_posting_title, ''), '근무');

  INSERT INTO public.notifications (
    recipient_id, type, title, body, link, data, priority
  ) VALUES (
    NEW.reviewee_id,
    'review_received',
    '📋 새로운 평가가 도착했습니다',
    format(
      '"%s" 근무에 대한 %s 평가가 등록되었습니다. 내 평가를 작성하면 확인할 수 있습니다.',
      v_job_title, v_reviewer_label
    ),
    format('/reviews/%s', NEW.work_log_id),
    jsonb_build_object(
      'workLogId', NEW.work_log_id,
      'jobPostingId', NEW.job_posting_id,
      'jobPostingTitle', v_job_title,
      'senderId', NEW.reviewer_id
    ),
    'normal'
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[notify_on_review_insert] failed for review % — %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.notify_on_review_insert() OWNER TO postgres;

--
-- Name: FUNCTION notify_on_review_insert(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.notify_on_review_insert() IS 'reviews INSERT 시 reviewee에게 리뷰 수신 알림 (Firebase onReviewCreated 대체). 블라인드 정책 유지.';


--
-- Name: notify_on_work_log_checkinout_update(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.notify_on_work_log_checkinout_update() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_did_check_in boolean;
  v_did_check_out boolean;
  v_staff_name text;
  v_employer_id uuid;
  v_job_title text;
  v_job_posting_id uuid;
  v_check_in_display text;
  v_check_out_display text;
  v_base_data jsonb;
BEGIN
  v_did_check_in := OLD.check_in_ts IS NULL AND NEW.check_in_ts IS NOT NULL;
  v_did_check_out := OLD.check_out_ts IS NULL AND NEW.check_out_ts IS NOT NULL;

  IF NOT v_did_check_in AND NOT v_did_check_out THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(NULLIF(nickname, ''), NULLIF(name, ''), '스태프')
    INTO v_staff_name
  FROM public.users
  WHERE id = NEW.staff_id;
  v_staff_name := COALESCE(v_staff_name, '스태프');

  SELECT jp.owner_id, jp.title, jp.id
    INTO v_employer_id, v_job_title, v_job_posting_id
  FROM public.job_postings jp
  WHERE jp.id = NEW.job_posting_id;

  v_base_data := jsonb_build_object(
    'workLogId', NEW.id,
    'staffId', NEW.staff_id,
    'staffName', v_staff_name,
    'jobPostingId', v_job_posting_id,
    'jobPostingTitle', COALESCE(v_job_title, '근무')
  );

  IF v_did_check_in THEN
    v_check_in_display := public._fmt_worklog_time(NEW.check_in_ts);

    INSERT INTO public.notifications (recipient_id, type, title, body, link, data, priority)
    VALUES (
      NEW.staff_id,
      'work_log_check_in',
      '✅ 출근 확인',
      COALESCE(format('%s 출근 처리되었습니다. (%s)', v_job_title, v_check_in_display),
               '출근 처리되었습니다.'),
      format('/schedule/%s', NEW.id),
      v_base_data || jsonb_build_object('checkInTime', NEW.check_in_ts),
      'normal'
    );

    IF v_employer_id IS NOT NULL THEN
      INSERT INTO public.notifications (recipient_id, type, title, body, link, data, priority)
      VALUES (
        v_employer_id,
        'work_log_check_in',
        '✅ 스태프 출근',
        COALESCE(format('%s 님이 %s 에 출근했습니다. (%s)', v_staff_name, v_job_title, v_check_in_display),
                 '스태프가 출근했습니다.'),
        format('/jobs/%s', v_job_posting_id),
        v_base_data || jsonb_build_object('checkInTime', NEW.check_in_ts),
        'normal'
      );
    END IF;
  END IF;

  IF v_did_check_out THEN
    v_check_out_display := public._fmt_worklog_time(NEW.check_out_ts);

    INSERT INTO public.notifications (recipient_id, type, title, body, link, data, priority)
    VALUES (
      NEW.staff_id,
      'work_log_check_out',
      '🏁 퇴근 확인',
      COALESCE(format('%s 퇴근 처리되었습니다. (%s)', v_job_title, v_check_out_display),
               '퇴근 처리되었습니다.'),
      format('/schedule/%s', NEW.id),
      v_base_data || jsonb_build_object('checkOutTime', NEW.check_out_ts),
      'normal'
    );

    INSERT INTO public.notifications (recipient_id, type, title, body, link, data, priority)
    VALUES (
      NEW.staff_id,
      'review_request',
      '📝 평가 요청',
      COALESCE(format('%s 근무에 대해 평가해주세요.', v_job_title), '근무 평가를 남겨주세요.'),
      format('/reviews/%s', NEW.id),
      v_base_data || jsonb_build_object('reviewerType', 'staff'),
      'normal'
    );

    IF v_employer_id IS NOT NULL THEN
      INSERT INTO public.notifications (recipient_id, type, title, body, link, data, priority)
      VALUES (
        v_employer_id,
        'work_log_check_out',
        '🏁 스태프 퇴근',
        COALESCE(format('%s 님이 %s 에 퇴근했습니다. (%s)', v_staff_name, v_job_title, v_check_out_display),
                 '스태프가 퇴근했습니다.'),
        format('/jobs/%s', v_job_posting_id),
        v_base_data || jsonb_build_object('checkOutTime', NEW.check_out_ts),
        'normal'
      );

      INSERT INTO public.notifications (recipient_id, type, title, body, link, data, priority)
      VALUES (
        v_employer_id,
        'review_request',
        '📝 스태프 평가 요청',
        COALESCE(format('%s 근무의 스태프를 평가해주세요.', v_job_title),
                 '스태프 평가를 남겨주세요.'),
        format('/reviews/%s', NEW.id),
        v_base_data || jsonb_build_object('reviewerType', 'employer'),
        'normal'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION public.notify_on_work_log_checkinout_update() OWNER TO postgres;

--
-- Name: FUNCTION notify_on_work_log_checkinout_update(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.notify_on_work_log_checkinout_update() IS 'check_in_ts/check_out_ts null→non-null 전환 시 스태프+구인자 알림 (Phase D.1 fix-up: public.users nickname/name).';


--
-- Name: notify_on_work_log_insert(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.notify_on_work_log_insert() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
DECLARE
  v_job_title text;
  v_owner_id uuid;
  v_when text;
  v_label text;
BEGIN
  SELECT title, owner_id INTO v_job_title, v_owner_id
  FROM public.job_postings
  WHERE id = NEW.job_posting_id;

  v_label := CASE
    WHEN v_job_title IS NULL OR v_job_title = '' THEN '해당'
    ELSE format('''%s''', v_job_title)
  END;

  v_when := COALESCE(NEW.date, '예정된 일정')
          || CASE WHEN NEW.time_slot IS NOT NULL AND NEW.time_slot <> ''
                  THEN format(' (%s)', NEW.time_slot)
                  ELSE '' END;

  INSERT INTO public.notifications (
    recipient_id, type, title, body, link, data, priority
  ) VALUES (
    NEW.staff_id,
    'schedule_created',
    '새 근무 배정',
    format('%s 근무가 %s에 배정되었습니다.', v_label, v_when),
    '/schedule',
    jsonb_build_object(
      'workLogId', NEW.id,
      'jobPostingId', NEW.job_posting_id,
      'jobPostingTitle', COALESCE(v_job_title, ''),
      'date', COALESCE(NEW.date, ''),
      'role', COALESCE(NEW.role::text, ''),
      'timeSlot', COALESCE(NEW.time_slot, ''),
      'senderId', v_owner_id
    ),
    'high'
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[notify_on_work_log_insert] failed for work_log % — %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.notify_on_work_log_insert() OWNER TO postgres;

--
-- Name: FUNCTION notify_on_work_log_insert(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.notify_on_work_log_insert() IS 'work_logs INSERT 시 staff에게 새 근무 배정 알림 (Firebase onScheduleCreated 대체)';


--
-- Name: notify_on_work_log_no_show_update(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.notify_on_work_log_no_show_update() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
DECLARE
  v_job_title text;
  v_owner_id uuid;
  v_staff_name text;
BEGIN
  -- null → non-null 전환만 처리
  IF OLD.no_show_at IS NOT NULL OR NEW.no_show_at IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT title, owner_id INTO v_job_title, v_owner_id
  FROM public.job_postings
  WHERE id = NEW.job_posting_id;

  IF v_owner_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(NULLIF(nickname, ''), NULLIF(name, ''), '스태프')
    INTO v_staff_name
  FROM public.users
  WHERE id = NEW.staff_id;
  v_staff_name := COALESCE(v_staff_name, '스태프');

  INSERT INTO public.notifications (
    recipient_id, type, title, body, link, data, priority
  ) VALUES (
    v_owner_id,
    'no_show_alert',
    '노쇼 알림',
    CASE
      WHEN v_job_title IS NULL OR v_job_title = ''
        THEN format('%s님이 노쇼 처리되었습니다.', v_staff_name)
      ELSE format('%s님이 ''%s'' 근무에서 노쇼 처리되었습니다.', v_staff_name, v_job_title)
    END,
    format('/employer/applicants/%s', NEW.job_posting_id),
    jsonb_build_object(
      'workLogId', NEW.id,
      'jobPostingId', NEW.job_posting_id,
      'jobPostingTitle', COALESCE(v_job_title, ''),
      'staffId', NEW.staff_id,
      'staffName', v_staff_name,
      'date', COALESCE(NEW.date, ''),
      'senderId', NEW.staff_id
    ),
    'urgent'
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[notify_on_work_log_no_show_update] failed for work_log % — %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.notify_on_work_log_no_show_update() OWNER TO postgres;

--
-- Name: FUNCTION notify_on_work_log_no_show_update(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.notify_on_work_log_no_show_update() IS 'no_show_at 전환 시 구인자에게 urgent 알림 (Firebase onNoShow 대체)';


--
-- Name: notify_on_work_log_update(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.notify_on_work_log_update() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
DECLARE
  v_job_title text;
  v_owner_id uuid;
  v_label text;
  v_when text;
  v_amount_label text;
  v_modification_count_before int;
  v_modification_count_after int;
  v_time_change_parts text[];
  v_latest_mod jsonb;
  v_admin_id uuid;
BEGIN
  SELECT title, owner_id INTO v_job_title, v_owner_id
  FROM public.job_postings
  WHERE id = NEW.job_posting_id;

  v_label := CASE
    WHEN v_job_title IS NULL OR v_job_title = '' THEN '해당'
    ELSE format('''%s''', v_job_title)
  END;

  -- ==================== Case 1: 근무 취소 ====================
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'cancelled' THEN
    v_when := COALESCE(NEW.date, '')
            || CASE WHEN NEW.time_slot IS NOT NULL AND NEW.time_slot <> ''
                    THEN format(' (%s)', NEW.time_slot)
                    ELSE '' END;

    INSERT INTO public.notifications (
      recipient_id, type, title, body, link, data, priority
    ) VALUES (
      NEW.staff_id,
      'schedule_cancelled',
      '근무 취소',
      CASE WHEN v_when = '' OR v_when = ' '
           THEN format('%s 근무가 취소되었습니다.', v_label)
           ELSE format('%s %s 근무가 취소되었습니다.', v_label, trim(v_when))
      END,
      '/schedule',
      jsonb_build_object(
        'workLogId', NEW.id,
        'jobPostingId', NEW.job_posting_id,
        'jobPostingTitle', COALESCE(v_job_title, ''),
        'date', COALESCE(NEW.date, ''),
        'role', COALESCE(NEW.role::text, ''),
        'timeSlot', COALESCE(NEW.time_slot, ''),
        'senderId', v_owner_id
      ),
      'high'
    );
  END IF;

  -- ==================== Case 2: 근무 시간 변경 ====================
  -- modification_history 배열 길이가 증가하면 시간 수정으로 간주
  v_modification_count_before := COALESCE(jsonb_array_length(OLD.modification_history), 0);
  v_modification_count_after := COALESCE(jsonb_array_length(NEW.modification_history), 0);

  IF v_modification_count_after > v_modification_count_before THEN
    -- 가장 최근 수정 항목 조회
    v_latest_mod := NEW.modification_history -> (v_modification_count_after - 1);
    v_time_change_parts := ARRAY[]::text[];

    IF (v_latest_mod -> 'previousStartTime') IS NOT NULL
       OR (v_latest_mod -> 'newStartTime') IS NOT NULL THEN
      v_time_change_parts := array_append(
        v_time_change_parts,
        format(
          '시작 %s -> %s',
          COALESCE(v_latest_mod ->> 'previousStartTime', ''),
          COALESCE(v_latest_mod ->> 'newStartTime', '')
        )
      );
    END IF;

    IF (v_latest_mod -> 'previousEndTime') IS NOT NULL
       OR (v_latest_mod -> 'newEndTime') IS NOT NULL THEN
      v_time_change_parts := array_append(
        v_time_change_parts,
        format(
          '종료 %s -> %s',
          COALESCE(v_latest_mod ->> 'previousEndTime', ''),
          COALESCE(v_latest_mod ->> 'newEndTime', '')
        )
      );
    END IF;

    INSERT INTO public.notifications (
      recipient_id, type, title, body, link, data, priority
    ) VALUES (
      NEW.staff_id,
      'schedule_change',
      '근무 시간 변경',
      format(
        '%s 시간이 변경되었습니다: %s',
        v_label,
        array_to_string(v_time_change_parts, ', ')
      ),
      '/schedule',
      jsonb_build_object(
        'workLogId', NEW.id,
        'jobPostingId', NEW.job_posting_id,
        'jobPostingTitle', COALESCE(v_job_title, ''),
        'date', COALESCE(NEW.date, ''),
        'timeSlot', COALESCE(NEW.time_slot, ''),
        'senderId', v_owner_id
      ),
      'high'
    );
  END IF;

  -- ==================== Case 3: 정산 완료 ====================
  IF OLD.payroll_status IS DISTINCT FROM NEW.payroll_status
     AND NEW.payroll_status = 'completed' THEN
    v_amount_label := to_char(COALESCE(NEW.payroll_amount, 0), 'FM999,999,999,999');

    INSERT INTO public.notifications (
      recipient_id, type, title, body, link, data, priority
    ) VALUES (
      NEW.staff_id,
      'settlement_completed',
      '정산 완료',
      CASE WHEN v_job_title IS NULL OR v_job_title = ''
           THEN format('정산이 완료되었습니다. 지급액: %s원', v_amount_label)
           ELSE format('''%s'' 정산이 완료되었습니다. 지급액: %s원', v_job_title, v_amount_label)
      END,
      '/schedule',
      jsonb_build_object(
        'workLogId', NEW.id,
        'jobPostingId', NEW.job_posting_id,
        'jobPostingTitle', COALESCE(v_job_title, ''),
        'date', COALESCE(NEW.date, ''),
        'payrollAmount', COALESCE(NEW.payroll_amount, 0)::text,
        'payrollDate', COALESCE(NEW.payroll_date::text, '')
      ),
      'high'
    );
  END IF;

  -- ==================== Case 4: 음수 정산 감지 (모든 admin에게 broadcast) ====================
  -- payroll_amount가 0 이상 → 음수로 변경 시 (또는 최초 음수)
  IF COALESCE(NEW.payroll_amount, 0) < 0
     AND (OLD.payroll_amount IS NULL OR COALESCE(OLD.payroll_amount, 0) >= 0) THEN
    FOR v_admin_id IN
      SELECT id FROM public.users WHERE role = 'admin'
    LOOP
      INSERT INTO public.notifications (
        recipient_id, type, title, body, data, priority
      ) VALUES (
        v_admin_id,
        'negative_settlement_alert',
        '⚠️ 음수 정산 경고',
        format(
          '%s님의 정산 금액이 %s원입니다. (%s)',
          COALESCE(NEW.staff_nickname, NEW.staff_name, '알 수 없음'),
          to_char(NEW.payroll_amount, 'FM999,999,999,999'),
          COALESCE(v_job_title, '알 수 없음')
        ),
        jsonb_build_object(
          'workLogId', NEW.id,
          'staffId', NEW.staff_id,
          'jobPostingId', NEW.job_posting_id,
          'amount', NEW.payroll_amount::text
        ),
        'urgent'
      );
    END LOOP;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[notify_on_work_log_update] failed for work_log % — %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.notify_on_work_log_update() OWNER TO postgres;

--
-- Name: FUNCTION notify_on_work_log_update(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.notify_on_work_log_update() IS 'work_logs UPDATE 시 4가지 알림 통합 처리: 취소(schedule_cancelled), 시간변경(schedule_change), 정산완료(settlement_completed), 음수정산(negative_settlement_alert). Firebase onScheduleCancelled / onWorkTimeChanged / onSettlementCompleted / onNegativeSettlement 대체.';


--
-- Name: notify_on_workspace_invitation_insert(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.notify_on_workspace_invitation_insert() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_workspace_name text;
  v_inviter_name text;
BEGIN
  IF NEW.status != 'pending' THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_workspace_name FROM public.workspaces WHERE id = NEW.workspace_id;
  SELECT COALESCE(name, '알 수 없음') INTO v_inviter_name FROM public.users WHERE id = NEW.invited_by;

  v_workspace_name := COALESCE(v_workspace_name, '워크스페이스');
  v_inviter_name := COALESCE(v_inviter_name, '알 수 없음');

  INSERT INTO public.notifications (
    recipient_id, type, title, body, link, data, priority
  )
  VALUES (
    NEW.invitee_user_id,
    'workspace_invitation',
    format('%s님이 워크스페이스에 초대했어요', v_inviter_name),
    format('%s · 편집자 권한', v_workspace_name),
    format('/workspace/invitations'),
    jsonb_build_object(
      'invitationId', NEW.id,
      'workspaceId', NEW.workspace_id,
      'workspaceName', v_workspace_name,
      'inviterName', v_inviter_name,
      'senderId', NEW.invited_by
    ),
    'normal'
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[notify_on_workspace_invitation_insert] failed for invitation % — %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.notify_on_workspace_invitation_insert() OWNER TO postgres;

--
-- Name: FUNCTION notify_on_workspace_invitation_insert(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.notify_on_workspace_invitation_insert() IS '워크스페이스 초대 발송 시 invitee 에게 인앱 알림 INSERT (push 발송은 기존 trigger 가 처리).';


--
-- Name: ops_add_addon(uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.ops_add_addon(p_participant_id uuid, p_actor_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_p record;
  v_addon_chips int;
  v_chips_before int;
  v_chips_after int;
  v_add_ons int;
BEGIN
  IF auth.uid() IS NULL
     OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;

  SELECT id, tournament_id, status, chips
    INTO v_p
    FROM public.ops_participants
    WHERE id = p_participant_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PARTICIPANT_NOT_FOUND: 참가자를 찾을 수 없습니다 (%)', p_participant_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT (public.is_ops_member(v_p.tournament_id, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 관리 권한 없음' USING ERRCODE = 'P0001';
  END IF;

  IF v_p.status <> 'active' THEN
    RAISE EXCEPTION 'PARTICIPANT_NOT_ACTIVE: 활성 참가자만 애드온 가능 (status=%)', v_p.status
      USING ERRCODE = 'P0001';
  END IF;

  SELECT addon_chips INTO v_addon_chips FROM public.ops_tournaments
    WHERE id = v_p.tournament_id;

  v_chips_before := v_p.chips;
  UPDATE public.ops_participants
    SET add_ons = add_ons + 1, chips = chips + COALESCE(v_addon_chips, 0)
    WHERE id = p_participant_id
    RETURNING chips, add_ons INTO v_chips_after, v_add_ons;

  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (v_p.tournament_id, 'player_addon', p_actor_id,
          jsonb_build_object('participant_id', p_participant_id,
                             'chips_before', v_chips_before,
                             'chips_after', v_chips_after));

  RETURN jsonb_build_object('participant_id', p_participant_id,
                            'chips', v_chips_after, 'add_ons', v_add_ons);
END;
$$;


ALTER FUNCTION public.ops_add_addon(p_participant_id uuid, p_actor_id uuid) OWNER TO postgres;

--
-- Name: ops_add_rebuy(uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.ops_add_rebuy(p_participant_id uuid, p_actor_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_p record;
  v_rebuy_chips int;
  v_chips_before int;
  v_chips_after int;
  v_rebuys int;
BEGIN
  IF auth.uid() IS NULL
     OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;

  SELECT id, tournament_id, status, chips
    INTO v_p
    FROM public.ops_participants
    WHERE id = p_participant_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PARTICIPANT_NOT_FOUND: 참가자를 찾을 수 없습니다 (%)', p_participant_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT (public.is_ops_member(v_p.tournament_id, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 관리 권한 없음' USING ERRCODE = 'P0001';
  END IF;

  IF v_p.status <> 'active' THEN
    RAISE EXCEPTION 'PARTICIPANT_NOT_ACTIVE: 활성 참가자만 리바이 가능 (status=%)', v_p.status
      USING ERRCODE = 'P0001';
  END IF;

  SELECT rebuy_chips INTO v_rebuy_chips FROM public.ops_tournaments
    WHERE id = v_p.tournament_id;

  v_chips_before := v_p.chips;
  UPDATE public.ops_participants
    SET rebuys = rebuys + 1, chips = chips + COALESCE(v_rebuy_chips, 0)
    WHERE id = p_participant_id
    RETURNING chips, rebuys INTO v_chips_after, v_rebuys;

  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (v_p.tournament_id, 'player_rebuy', p_actor_id,
          jsonb_build_object('participant_id', p_participant_id,
                             'chips_before', v_chips_before,
                             'chips_after', v_chips_after));

  RETURN jsonb_build_object('participant_id', p_participant_id,
                            'chips', v_chips_after, 'rebuys', v_rebuys);
END;
$$;


ALTER FUNCTION public.ops_add_rebuy(p_participant_id uuid, p_actor_id uuid) OWNER TO postgres;

--
-- Name: ops_add_staff(uuid, uuid, uuid, public.staff_role, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.ops_add_staff(p_tournament_id uuid, p_actor_id uuid, p_staff_id uuid, p_role public.staff_role DEFAULT 'dealer'::public.staff_role, p_custom_role text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_t public.ops_tournaments%ROWTYPE;
  v_user public.users%ROWTYPE;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 본인 계정으로만 호출할 수 있습니다' USING ERRCODE = 'P0001';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('ops_tournament_' || p_tournament_id::text)::bigint);

  SELECT * INTO v_t FROM public.ops_tournaments WHERE id = p_tournament_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TOURNAMENT_NOT_FOUND: 대회를 찾을 수 없습니다' USING ERRCODE = 'P0001';
  END IF;
  IF NOT (public.is_ops_member(p_tournament_id, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 운영 권한이 없습니다' USING ERRCODE = 'P0001';
  END IF;

  -- 롤 게이트(적대검증 SEC-1): 이름 하베스팅 프리미티브 차단 — 전화검색(search_users_by_phone)과 신뢰경계 일치
  IF NOT (public.is_admin() OR EXISTS (
    SELECT 1 FROM public.users WHERE id = p_actor_id AND role IN ('employer','admin') AND is_active = true
  )) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 스태프 추가 권한이 없습니다' USING ERRCODE = 'P0001';
  END IF;

  -- 대상 검증: add_direct_staff(20260629000000:112)·search_users_by_phone(:65)와 문자 그대로 동일(COALESCE 필수 — status nullable)
  SELECT * INTO v_user FROM public.users
   WHERE id = p_staff_id AND is_active = true AND COALESCE(status, 'active') NOT IN ('deleted','deactivated');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'STAFF_NOT_FOUND: 추가할 수 없는 사용자입니다' USING ERRCODE = 'P0001';
  END IF;

  -- advisory 락이 대회 단위 직렬화하므로 pre-check가 race-safe
  IF EXISTS (SELECT 1 FROM public.ops_staff WHERE tournament_id = p_tournament_id AND staff_id = p_staff_id) THEN
    RAISE EXCEPTION 'DUPLICATE_STAFF: 이미 로스터에 있는 스태프입니다' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.ops_staff
    (tournament_id, staff_id, role, custom_role, staff_name, staff_nickname, source, source_work_log_id)
  VALUES
    (p_tournament_id, p_staff_id, p_role, p_custom_role,
     COALESCE(NULLIF(btrim(v_user.name), ''), v_user.nickname, '이름 미상'),
     v_user.nickname, 'manual', NULL)
  RETURNING id INTO v_id;

  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (p_tournament_id, 'staff_added', p_actor_id,
          jsonb_build_object('staff_id', p_staff_id, 'role', p_role::text));

  RETURN jsonb_build_object('opsStaffId', v_id);
END;
$$;


ALTER FUNCTION public.ops_add_staff(p_tournament_id uuid, p_actor_id uuid, p_staff_id uuid, p_role public.staff_role, p_custom_role text) OWNER TO postgres;

--
-- Name: ops_add_table(uuid, uuid, integer, text, public.ops_table_lock_type, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.ops_add_table(p_tournament_id uuid, p_actor_id uuid, p_seat_count integer, p_name text, p_lock_type public.ops_table_lock_type, p_priority integer) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE v_table_no int; v_table_id uuid; v_seats int; i int;
BEGIN
  IF auth.uid() IS NULL OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;
  PERFORM 1 FROM public.ops_tournaments WHERE id = p_tournament_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TOURNAMENT_NOT_FOUND: 대회를 찾을 수 없습니다 (%)', p_tournament_id USING ERRCODE = 'P0001';
  END IF;
  IF NOT (public.is_ops_member(p_tournament_id, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 관리 권한 없음' USING ERRCODE = 'P0001';
  END IF;

  v_seats := COALESCE(NULLIF(p_seat_count, 0), 9);
  IF v_seats < 1 OR v_seats > 11 THEN
    RAISE EXCEPTION 'INVALID_SEAT_COUNT: 좌석수는 1~11 (got %)', v_seats USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(max(table_no), 0) + 1 INTO v_table_no
    FROM public.ops_tables WHERE tournament_id = p_tournament_id;

  INSERT INTO public.ops_tables (tournament_id, table_no, name, lock_type, priority)
  VALUES (p_tournament_id, v_table_no, NULLIF(p_name, ''), COALESCE(p_lock_type, 'none'), p_priority)
  RETURNING id INTO v_table_id;

  FOR i IN 1..v_seats LOOP
    INSERT INTO public.ops_seats (tournament_id, table_id, table_no, seat_no)
    VALUES (p_tournament_id, v_table_id, v_table_no, i);
  END LOOP;

  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (p_tournament_id, 'table_added', p_actor_id,
          jsonb_build_object('table_id', v_table_id, 'table_no', v_table_no, 'seats', v_seats));

  RETURN jsonb_build_object('table_id', v_table_id, 'table_no', v_table_no);
END;
$$;


ALTER FUNCTION public.ops_add_table(p_tournament_id uuid, p_actor_id uuid, p_seat_count integer, p_name text, p_lock_type public.ops_table_lock_type, p_priority integer) OWNER TO postgres;

--
-- Name: ops_assign_seat(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.ops_assign_seat(p_seat_id uuid, p_participant_id uuid, p_actor_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE v_seat record; v_p record; v_table_status public.ops_table_status;
BEGIN
  IF auth.uid() IS NULL OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;
  SELECT s.id, s.tournament_id, s.table_id, s.participant_id, s.table_no, s.seat_no
    INTO v_seat FROM public.ops_seats s WHERE s.id = p_seat_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SEAT_NOT_FOUND: 좌석을 찾을 수 없습니다 (%)', p_seat_id USING ERRCODE = 'P0001';
  END IF;
  IF NOT (public.is_ops_member(v_seat.tournament_id, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 관리 권한 없음' USING ERRCODE = 'P0001';
  END IF;
  IF v_seat.participant_id IS NOT NULL THEN
    RAISE EXCEPTION 'SEAT_TAKEN: 이미 점유된 좌석' USING ERRCODE = 'P0001';
  END IF;
  SELECT status INTO v_table_status FROM public.ops_tables WHERE id = v_seat.table_id;
  IF v_table_status <> 'open' THEN
    RAISE EXCEPTION 'TABLE_NOT_OPEN: open 테이블만 배정 가능 (status=%)', v_table_status USING ERRCODE = 'P0001';
  END IF;
  SELECT id, tournament_id, status INTO v_p FROM public.ops_participants
    WHERE id = p_participant_id FOR UPDATE;
  IF NOT FOUND OR v_p.tournament_id <> v_seat.tournament_id THEN
    RAISE EXCEPTION 'PARTICIPANT_NOT_FOUND: 참가자를 찾을 수 없습니다 (%)', p_participant_id USING ERRCODE = 'P0001';
  END IF;
  IF v_p.status = 'busted' OR v_p.status = 'no_show' THEN
    RAISE EXCEPTION 'PARTICIPANT_NOT_ACTIVE: 탈락/미출석 참가자는 좌석배정 불가' USING ERRCODE = 'P0001';
  END IF;
  -- 단일점유: 이미 다른 좌석이면 partial UNIQUE 가 막지만 명시 검증.
  IF EXISTS (SELECT 1 FROM public.ops_seats WHERE tournament_id = v_seat.tournament_id
               AND participant_id = p_participant_id) THEN
    RAISE EXCEPTION 'PARTICIPANT_ALREADY_SEATED: 이미 좌석 배정됨' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.ops_seats SET participant_id = p_participant_id WHERE id = p_seat_id;
  UPDATE public.ops_participants SET status = 'active'
    WHERE id = p_participant_id AND status <> 'active';
  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (v_seat.tournament_id, 'player_moved', p_actor_id,
          jsonb_build_object('participant_id', p_participant_id, 'to_table', v_seat.table_no,
                             'to_seat', v_seat.seat_no, 'from', NULL));
  RETURN jsonb_build_object('seat_id', p_seat_id, 'participant_id', p_participant_id);
END;
$$;


ALTER FUNCTION public.ops_assign_seat(p_seat_id uuid, p_participant_id uuid, p_actor_id uuid) OWNER TO postgres;

--
-- Name: ops_assign_table_staff(uuid, uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.ops_assign_table_staff(p_tournament_id uuid, p_actor_id uuid, p_table_id uuid, p_staff_id uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_t public.ops_tournaments%ROWTYPE;
  v_table public.ops_tables%ROWTYPE;
  v_prev_table_id uuid;
  v_replaced uuid;
BEGIN
  IF auth.uid() IS NULL OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 본인 계정으로만 호출할 수 있습니다' USING ERRCODE = 'P0001';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('ops_tournament_' || p_tournament_id::text)::bigint);

  SELECT * INTO v_t FROM public.ops_tournaments WHERE id = p_tournament_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TOURNAMENT_NOT_FOUND: 대회를 찾을 수 없습니다' USING ERRCODE = 'P0001';
  END IF;
  IF NOT (public.is_ops_member(p_tournament_id, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 운영 권한이 없습니다' USING ERRCODE = 'P0001';
  END IF;

  -- 관련 행 일괄 잠금: 대상 테이블 + (배정 시) 스태프의 기존 배정 테이블, id asc
  PERFORM 1 FROM (
    SELECT id FROM public.ops_tables
     WHERE tournament_id = p_tournament_id
       AND (id = p_table_id OR (p_staff_id IS NOT NULL AND assigned_staff_id = p_staff_id))
     ORDER BY id
     FOR UPDATE
  ) locked;

  SELECT * INTO v_table FROM public.ops_tables
   WHERE id = p_table_id AND tournament_id = p_tournament_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TABLE_NOT_FOUND: 테이블을 찾을 수 없습니다' USING ERRCODE = 'P0001';
  END IF;

  IF p_staff_id IS NULL THEN
    -- 해제(멱등)
    IF v_table.assigned_staff_id IS NULL THEN
      RETURN jsonb_build_object('tableId', p_table_id, 'staffId', NULL);
    END IF;
    v_replaced := v_table.assigned_staff_id;
    UPDATE public.ops_tables SET assigned_staff_id = NULL WHERE id = p_table_id;
    INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
    VALUES (p_tournament_id, 'table_staff_unassigned', p_actor_id,
            jsonb_build_object('table_id', p_table_id, 'staff_id', v_replaced));
    RETURN jsonb_build_object('tableId', p_table_id, 'staffId', NULL);
  END IF;

  -- 로스터 멤버십 강제(역할은 비강제 — UI가 딜러 우선 필터)
  IF NOT EXISTS (SELECT 1 FROM public.ops_staff
                  WHERE tournament_id = p_tournament_id AND staff_id = p_staff_id) THEN
    RAISE EXCEPTION 'STAFF_NOT_IN_ROSTER: 로스터에 없는 스태프입니다. 먼저 로스터에 추가하세요' USING ERRCODE = 'P0001';
  END IF;

  IF v_table.assigned_staff_id IS NOT DISTINCT FROM p_staff_id THEN
    RETURN jsonb_build_object('tableId', p_table_id, 'staffId', p_staff_id); -- no-op
  END IF;

  -- move 시맨틱: 기존 배정 테이블 선해제(백스톱 UNIQUE 충돌 예방)
  SELECT id INTO v_prev_table_id FROM public.ops_tables
   WHERE tournament_id = p_tournament_id AND assigned_staff_id = p_staff_id AND id <> p_table_id;
  IF v_prev_table_id IS NOT NULL THEN
    UPDATE public.ops_tables SET assigned_staff_id = NULL WHERE id = v_prev_table_id;
  END IF;

  v_replaced := v_table.assigned_staff_id; -- 대상 테이블에 다른 딜러가 있었으면 교대
  UPDATE public.ops_tables SET assigned_staff_id = p_staff_id WHERE id = p_table_id;

  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (p_tournament_id, 'table_staff_assigned', p_actor_id,
          jsonb_build_object('table_id', p_table_id, 'staff_id', p_staff_id,
                             'previous_table_id', v_prev_table_id, 'replaced_staff_id', v_replaced));

  RETURN jsonb_build_object('tableId', p_table_id, 'staffId', p_staff_id);
END;
$$;


ALTER FUNCTION public.ops_assign_table_staff(p_tournament_id uuid, p_actor_id uuid, p_table_id uuid, p_staff_id uuid) OWNER TO postgres;

--
-- Name: ops_bust_participant(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.ops_bust_participant(p_participant_id uuid, p_actor_id uuid, p_eliminator_id uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_tournament_id uuid;
  v_status public.ops_participant_status;
  v_t_status public.ops_tournament_status;
  v_chips_before int;
  v_elim_status public.ops_participant_status;
  v_elim_tid uuid;
  v_active int;
  v_used_count int;
  v_finish int;
  v_prize int;
  v_active2 int;
  v_checked_in int;
  v_winner uuid;
  v_winner_prize int;
  v_seat_id uuid;
  v_freed_seat_id uuid;
  v_winner_json jsonb;
BEGIN
  -- 1) actor 가드 (v1 보존)
  IF auth.uid() IS NULL
     OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;

  -- 2) tournament_id 선취(비잠금) — advisory 락을 행 잠금보다 먼저 취득(v1 보존)
  SELECT tournament_id INTO v_tournament_id
    FROM public.ops_participants WHERE id = p_participant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PARTICIPANT_NOT_FOUND: 참가자를 찾을 수 없습니다 (%)', p_participant_id
      USING ERRCODE = 'P0001';
  END IF;

  -- 3) 멤버십 (v1 보존)
  IF NOT (public.is_ops_member(v_tournament_id, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 관리 권한 없음' USING ERRCODE = 'P0001';
  END IF;

  -- 4) advisory → 대회 FOR UPDATE + active 검사 (v1 보존)
  PERFORM pg_advisory_xact_lock(hashtext('ops_tournament_' || v_tournament_id::text)::bigint);
  SELECT status INTO v_t_status FROM public.ops_tournaments
    WHERE id = v_tournament_id FOR UPDATE;
  IF v_t_status <> 'active' THEN
    RAISE EXCEPTION 'INVALID_STATUS: 진행 중(active) 대회만 탈락 처리 가능 (status=%)', v_t_status
      USING ERRCODE = 'P0001';
  END IF;

  -- 5) [1f] eliminator 자기자신 가드 — 순수 인자 비교라 행 잠금 전 판정(표면은 락 이후와 동일)
  IF p_eliminator_id IS NOT NULL AND p_eliminator_id = p_participant_id THEN
    RAISE EXCEPTION 'ELIMINATOR_INVALID: 넉아웃 상대가 올바르지 않습니다(자기 자신)' USING ERRCODE = 'P0001';
  END IF;

  -- 6) 참가자 행 잠금 — 대상(+eliminator) id 오름차순 FOR UPDATE(락 불변식 '참가자' 항 복수 일반화)
  IF p_eliminator_id IS NOT NULL THEN
    PERFORM 1 FROM public.ops_participants
      WHERE id IN (p_participant_id, p_eliminator_id)
      ORDER BY id FOR UPDATE;
  END IF;

  -- 대상 status/chips 확인 — v1 검사 순서 보존(에러 메시지/순서 무회귀). 6)에서 잠금 보유 시 재잠금 무해.
  SELECT status, chips INTO v_status, v_chips_before
    FROM public.ops_participants WHERE id = p_participant_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PARTICIPANT_NOT_FOUND: 참가자를 찾을 수 없습니다 (%)', p_participant_id
      USING ERRCODE = 'P0001';
  END IF;
  IF v_status = 'busted' THEN
    RAISE EXCEPTION 'PARTICIPANT_ALREADY_BUSTED: 이미 탈락 처리된 참가자입니다' USING ERRCODE = 'P0001';
  ELSIF v_status <> 'active' THEN
    RAISE EXCEPTION 'PARTICIPANT_NOT_ACTIVE: 활성 참가자만 탈락 처리 가능 (status=%)', v_status
      USING ERRCODE = 'P0001';
  END IF;

  -- 7) [1f] eliminator 가드: 존재+같은 대회(미존재·타대회 동일 처리)·active.
  --    비-바운티 대회에서도 지정 가능(기록만 — 적립 표시는 클라가 bounty_cost 유무로 게이트).
  IF p_eliminator_id IS NOT NULL THEN
    SELECT status, tournament_id INTO v_elim_status, v_elim_tid
      FROM public.ops_participants WHERE id = p_eliminator_id;
    IF v_elim_tid IS NULL OR v_elim_tid <> v_tournament_id THEN
      RAISE EXCEPTION 'ELIMINATOR_INVALID: 넉아웃 상대가 올바르지 않습니다' USING ERRCODE = 'P0001';
    END IF;
    IF v_elim_status <> 'active' THEN
      RAISE EXCEPTION 'ELIMINATOR_INVALID: 넉아웃 상대가 올바르지 않습니다(비활성)' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- 8) 생존수 + 마지막 생존자 가드 (v1 보존)
  SELECT count(*) INTO v_active FROM public.ops_participants
    WHERE tournament_id = v_tournament_id AND status = 'active';
  IF v_active <= 1 THEN
    RAISE EXCEPTION 'PARTICIPANT_LAST_SURVIVOR: 마지막 생존자는 탈락 처리할 수 없습니다(우승 처리 대상)'
      USING ERRCODE = 'P0001';
  END IF;

  -- 9) finish_position = 생존수 이상 최소 미사용 순위 (v1 보존)
  SELECT count(*) INTO v_used_count FROM public.ops_participants
    WHERE tournament_id = v_tournament_id AND finish_position IS NOT NULL;
  SELECT g INTO v_finish
    FROM generate_series(v_active, v_active + v_used_count) AS g
    WHERE NOT EXISTS (
      SELECT 1 FROM public.ops_participants
      WHERE tournament_id = v_tournament_id AND finish_position = g)
    ORDER BY g LIMIT 1;

  -- 10) prize 매핑 (v1 보존)
  SELECT amount INTO v_prize FROM public.ops_prizes
    WHERE tournament_id = v_tournament_id AND rank = v_finish;

  -- 11) 변이 (v1 보존)
  UPDATE public.ops_participants
    SET status = 'busted', busted_at = now(), finish_position = v_finish,
        prize_amount = v_prize, chips = 0
    WHERE id = p_participant_id;

  -- 11-b) [1f] eliminator KO 적립
  IF p_eliminator_id IS NOT NULL THEN
    UPDATE public.ops_participants SET knockouts = knockouts + 1 WHERE id = p_eliminator_id;
  END IF;

  -- 12) 좌석 해제 (v1 보존) + [1f] freed_seat_id 기록(복수면 첫 좌석 — 단일점유 불변식상 실제 최대 1)
  v_freed_seat_id := NULL;
  FOR v_seat_id IN
    SELECT id FROM public.ops_seats
    WHERE participant_id = p_participant_id ORDER BY id FOR UPDATE
  LOOP
    UPDATE public.ops_seats SET participant_id = NULL WHERE id = v_seat_id;
    IF v_freed_seat_id IS NULL THEN
      v_freed_seat_id := v_seat_id;
    END IF;
    INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
    VALUES (v_tournament_id, 'seat_freed', p_actor_id,
            jsonb_build_object('participant_id', p_participant_id, 'seat_id', v_seat_id));
  END LOOP;

  -- 13) 이벤트 — [1f] payload 3필드 확장(chips_before/eliminator_id/freed_seat_id = undo 복원 소스)
  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (v_tournament_id, 'player_busted', p_actor_id,
          jsonb_build_object('participant_id', p_participant_id,
                             'finish_position', v_finish, 'prize_amount', v_prize,
                             'chips_before', v_chips_before,
                             'eliminator_id', p_eliminator_id,
                             'freed_seat_id', v_freed_seat_id));
  IF v_prize IS NOT NULL THEN
    INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
    VALUES (v_tournament_id, 'prize_assigned', p_actor_id,
            jsonb_build_object('participant_id', p_participant_id, 'rank', v_finish, 'amount', v_prize));
  END IF;

  -- 14) 우승 자동확정 (v1 보존 + [🔨H12] 보류 가드: checked_in 생존자가 있으면 확정 보류.
  --     undo/register/reenter 의 무좌석 폴백이 만든 checked_in 을 무시하고 completed 확정하면
  --     그 참가자는 fp NULL 고아(재bust 불가·D2 로 undo 불가·correct 는 fp NULL 거부) — 구제 불가.
  --     보류 시 운영자는 checked_in 을 착석(active 승급)시킨 뒤 진행하면 다음 bust 에서 재평가.)
  SELECT count(*) INTO v_active2 FROM public.ops_participants
    WHERE tournament_id = v_tournament_id AND status = 'active';
  SELECT count(*) INTO v_checked_in FROM public.ops_participants
    WHERE tournament_id = v_tournament_id AND status = 'checked_in';
  v_winner_json := NULL;
  IF v_active2 = 1 AND v_checked_in = 0 THEN
    SELECT id INTO v_winner FROM public.ops_participants
      WHERE tournament_id = v_tournament_id AND status = 'active' FOR UPDATE;
    SELECT amount INTO v_winner_prize FROM public.ops_prizes
      WHERE tournament_id = v_tournament_id AND rank = 1;
    UPDATE public.ops_participants
      SET finish_position = 1, prize_amount = v_winner_prize WHERE id = v_winner;
    UPDATE public.ops_tournaments SET status = 'completed' WHERE id = v_tournament_id;
    INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
    VALUES (v_tournament_id, 'tournament_status_changed', p_actor_id,
            jsonb_build_object('from', 'active', 'to', 'completed', 'reason', 'winner_finalized'));
    IF v_winner_prize IS NOT NULL THEN
      INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
      VALUES (v_tournament_id, 'prize_assigned', p_actor_id,
              jsonb_build_object('participant_id', v_winner, 'rank', 1, 'amount', v_winner_prize));
    END IF;
    v_winner_json := jsonb_build_object('participant_id', v_winner,
                                        'finish_position', 1, 'prize_amount', v_winner_prize);
  END IF;

  -- 15) 반환 (v1 보존 — winner_finalized 는 H12 보류 반영)
  RETURN jsonb_build_object(
    'participant_id', p_participant_id,
    'finish_position', v_finish,
    'prize_amount', v_prize,
    'winner_finalized', (v_active2 = 1 AND v_checked_in = 0),
    'winner', v_winner_json);
END;
$$;


ALTER FUNCTION public.ops_bust_participant(p_participant_id uuid, p_actor_id uuid, p_eliminator_id uuid) OWNER TO postgres;

--
-- Name: ops_claim_participant(text, text, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.ops_claim_participant(p_view_token text, p_claim_pin text, p_user_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $_$
DECLARE
  v_p record;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 본인 계정으로만 등록할 수 있습니다' USING ERRCODE = 'P0001';
  END IF;
  -- fail-closed: NULL 명시 가드(NULL ~ regex = NULL 우회 차단).
  IF p_view_token IS NULL OR char_length(p_view_token) < 32 THEN
    RAISE EXCEPTION 'OPS_VIEW_TOKEN_INVALID: 유효하지 않은 플레이어 토큰' USING ERRCODE = 'P0001';
  END IF;
  IF p_claim_pin IS NULL OR upper(p_claim_pin) !~ '^[0-9A-HJKMNP-TV-Z]{8}$' THEN
    RAISE EXCEPTION 'OPS_CLAIM_PIN_INVALID: 연결 PIN 형식이 올바르지 않습니다' USING ERRCODE = 'P0001';
  END IF;

  SELECT id, player_user_id, claim_pin_hash INTO v_p
    FROM public.ops_participants WHERE view_token = p_view_token FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'OPS_VIEW_TOKEN_INVALID: 유효하지 않은 플레이어 토큰' USING ERRCODE = 'P0001';
  END IF;

  -- NULL-안전 PIN 검증 + 오라클 회피(미발급=오답과 동일 코드).
  IF v_p.claim_pin_hash IS NULL
     OR crypt(upper(p_claim_pin), v_p.claim_pin_hash) IS DISTINCT FROM v_p.claim_pin_hash THEN
    RAISE EXCEPTION 'OPS_CLAIM_PIN_INVALID: 연결 PIN이 올바르지 않습니다' USING ERRCODE = 'P0001';
  END IF;

  IF v_p.player_user_id IS NOT NULL THEN
    IF v_p.player_user_id = p_user_id THEN
      RETURN jsonb_build_object('participantId', v_p.id, 'claimed', true, 'noop', true);
    END IF;
    RAISE EXCEPTION 'OPS_CLAIM_ALREADY_CLAIMED: 이미 다른 계정에 연결된 참가자입니다' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.ops_participants SET player_user_id = p_user_id WHERE id = v_p.id;
  RETURN jsonb_build_object('participantId', v_p.id, 'claimed', true);
END;
$_$;


ALTER FUNCTION public.ops_claim_participant(p_view_token text, p_claim_pin text, p_user_id uuid) OWNER TO postgres;

--
-- Name: ops_clock_adjust(uuid, uuid, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.ops_clock_adjust(p_tournament_id uuid, p_actor_id uuid, p_delta_sec integer) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_clock record;
BEGIN
  IF auth.uid() IS NULL OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;
  PERFORM 1 FROM public.ops_tournaments WHERE id = p_tournament_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TOURNAMENT_NOT_FOUND: 대회를 찾을 수 없습니다 (%)', p_tournament_id USING ERRCODE = 'P0001';
  END IF;
  IF NOT (public.is_ops_member(p_tournament_id, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 관리 권한 없음' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_clock FROM public.ops_clock WHERE tournament_id = p_tournament_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TOURNAMENT_NOT_FOUND: 클럭 행 없음 (%)', p_tournament_id USING ERRCODE = 'P0001';
  END IF;

  IF v_clock.is_running THEN
    UPDATE public.ops_clock SET
      level_started_at = level_started_at + make_interval(secs => p_delta_sec)
    WHERE tournament_id = p_tournament_id;
  ELSE
    UPDATE public.ops_clock SET
      paused_remaining_sec = GREATEST(COALESCE(paused_remaining_sec, 0) + p_delta_sec, 0)
    WHERE tournament_id = p_tournament_id;
  END IF;

  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (p_tournament_id, 'level_set', p_actor_id,
          jsonb_build_object('action', 'adjust', 'adjust_sec', p_delta_sec));

  RETURN jsonb_build_object('tournament_id', p_tournament_id, 'adjust_sec', p_delta_sec);
END;
$$;


ALTER FUNCTION public.ops_clock_adjust(p_tournament_id uuid, p_actor_id uuid, p_delta_sec integer) OWNER TO postgres;

--
-- Name: ops_clock_pause(uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.ops_clock_pause(p_tournament_id uuid, p_actor_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_clock record;
  v_duration int;
  v_remaining int;
BEGIN
  IF auth.uid() IS NULL OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;
  PERFORM 1 FROM public.ops_tournaments WHERE id = p_tournament_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TOURNAMENT_NOT_FOUND: 대회를 찾을 수 없습니다 (%)', p_tournament_id USING ERRCODE = 'P0001';
  END IF;
  IF NOT (public.is_ops_member(p_tournament_id, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 관리 권한 없음' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_clock FROM public.ops_clock WHERE tournament_id = p_tournament_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TOURNAMENT_NOT_FOUND: 클럭 행 없음 (%)', p_tournament_id USING ERRCODE = 'P0001';
  END IF;
  IF NOT v_clock.is_running THEN
    RETURN jsonb_build_object('tournament_id', p_tournament_id, 'is_running', false, 'noop', true);
  END IF;

  SELECT duration_sec INTO v_duration FROM public.ops_blind_levels
    WHERE tournament_id = p_tournament_id AND sort = v_clock.current_level_sort;

  v_remaining := GREATEST(0,
    COALESCE(v_duration, 0)
    - COALESCE(FLOOR(EXTRACT(EPOCH FROM (now() - v_clock.level_started_at)))::int, 0));

  UPDATE public.ops_clock SET
    is_running           = false,
    paused_remaining_sec = v_remaining
  WHERE tournament_id = p_tournament_id;

  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (p_tournament_id, 'level_pause', p_actor_id,
          jsonb_build_object('remaining_sec', v_remaining));

  RETURN jsonb_build_object('tournament_id', p_tournament_id, 'is_running', false,
                            'paused_remaining_sec', v_remaining);
END;
$$;


ALTER FUNCTION public.ops_clock_pause(p_tournament_id uuid, p_actor_id uuid) OWNER TO postgres;

--
-- Name: ops_clock_set_level(uuid, uuid, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.ops_clock_set_level(p_tournament_id uuid, p_actor_id uuid, p_sort integer) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $$
BEGIN
  IF auth.uid() IS NULL OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;
  PERFORM 1 FROM public.ops_tournaments WHERE id = p_tournament_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TOURNAMENT_NOT_FOUND: 대회를 찾을 수 없습니다 (%)', p_tournament_id USING ERRCODE = 'P0001';
  END IF;
  IF NOT (public.is_ops_member(p_tournament_id, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 관리 권한 없음' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ops_blind_levels
                   WHERE tournament_id = p_tournament_id AND sort = p_sort) THEN
    RAISE EXCEPTION 'OPS_INVALID_LEVEL: 존재하지 않는 레벨 (sort=%)', p_sort USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.ops_clock SET
    current_level_sort   = p_sort,
    level_started_at     = now(),
    paused_remaining_sec = NULL
  WHERE tournament_id = p_tournament_id;

  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (p_tournament_id, 'level_set', p_actor_id,
          jsonb_build_object('action', 'set_level', 'sort', p_sort));

  RETURN jsonb_build_object('tournament_id', p_tournament_id, 'current_level_sort', p_sort);
END;
$$;


ALTER FUNCTION public.ops_clock_set_level(p_tournament_id uuid, p_actor_id uuid, p_sort integer) OWNER TO postgres;

--
-- Name: ops_clock_start(uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.ops_clock_start(p_tournament_id uuid, p_actor_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_clock record;
  v_duration int;
BEGIN
  IF auth.uid() IS NULL OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;
  PERFORM 1 FROM public.ops_tournaments WHERE id = p_tournament_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TOURNAMENT_NOT_FOUND: 대회를 찾을 수 없습니다 (%)', p_tournament_id USING ERRCODE = 'P0001';
  END IF;
  IF NOT (public.is_ops_member(p_tournament_id, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 관리 권한 없음' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ops_blind_levels WHERE tournament_id = p_tournament_id) THEN
    RAISE EXCEPTION 'OPS_NO_BLIND_LEVELS: 블라인드 레벨이 없습니다' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_clock FROM public.ops_clock WHERE tournament_id = p_tournament_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TOURNAMENT_NOT_FOUND: 클럭 행 없음 (%)', p_tournament_id USING ERRCODE = 'P0001';
  END IF;
  IF v_clock.is_running THEN
    RETURN jsonb_build_object('tournament_id', p_tournament_id, 'is_running', true, 'noop', true);
  END IF;

  SELECT duration_sec INTO v_duration FROM public.ops_blind_levels
    WHERE tournament_id = p_tournament_id AND sort = v_clock.current_level_sort;
  IF v_duration IS NULL THEN
    SELECT sort, duration_sec INTO v_clock.current_level_sort, v_duration
      FROM public.ops_blind_levels WHERE tournament_id = p_tournament_id ORDER BY sort LIMIT 1;
  END IF;

  UPDATE public.ops_clock SET
    current_level_sort   = v_clock.current_level_sort,
    is_running           = true,
    level_started_at     = now() - make_interval(secs => (v_duration - COALESCE(v_clock.paused_remaining_sec, v_duration))),
    paused_remaining_sec = NULL
  WHERE tournament_id = p_tournament_id;

  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (p_tournament_id, 'level_play', p_actor_id,
          jsonb_build_object('level_sort', v_clock.current_level_sort));

  RETURN jsonb_build_object('tournament_id', p_tournament_id, 'is_running', true,
                            'current_level_sort', v_clock.current_level_sort);
END;
$$;


ALTER FUNCTION public.ops_clock_start(p_tournament_id uuid, p_actor_id uuid) OWNER TO postgres;

--
-- Name: ops_close_table(uuid, uuid, public.ops_table_status); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.ops_close_table(p_table_id uuid, p_actor_id uuid, p_status public.ops_table_status) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE v_tid uuid; v_occupied int;
BEGIN
  IF auth.uid() IS NULL OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;
  SELECT tournament_id INTO v_tid FROM public.ops_tables WHERE id = p_table_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TABLE_NOT_FOUND: 테이블을 찾을 수 없습니다 (%)', p_table_id USING ERRCODE = 'P0001';
  END IF;
  IF NOT (public.is_ops_member(v_tid, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 관리 권한 없음' USING ERRCODE = 'P0001';
  END IF;
  IF p_status = 'closed' THEN
    -- TOCTOU 차단: 이 테이블 좌석 전부 잠금 → 동시 배정/이동/대기채움/auto-seat 직렬화.
    PERFORM 1 FROM public.ops_seats WHERE table_id = p_table_id ORDER BY id FOR UPDATE;
    SELECT count(*) INTO v_occupied FROM public.ops_seats
      WHERE table_id = p_table_id AND participant_id IS NOT NULL;
    IF v_occupied > 0 THEN
      RAISE EXCEPTION 'TABLE_HAS_OCCUPANTS: 점유 좌석 % 개 — 먼저 비우세요', v_occupied USING ERRCODE = 'P0001';
    END IF;
  END IF;
  UPDATE public.ops_tables SET status = p_status WHERE id = p_table_id;
  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (v_tid, 'table_closed', p_actor_id, jsonb_build_object('table_id', p_table_id, 'status', p_status));
  RETURN jsonb_build_object('table_id', p_table_id, 'status', p_status);
END;
$$;


ALTER FUNCTION public.ops_close_table(p_table_id uuid, p_actor_id uuid, p_status public.ops_table_status) OWNER TO postgres;

--
-- Name: ops_correct_participant_prize(uuid, uuid, integer, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.ops_correct_participant_prize(p_participant_id uuid, p_actor_id uuid, p_amount integer DEFAULT NULL::integer, p_reason text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_tournament_id uuid;
  v_t_status public.ops_tournament_status;
  v_fp int;
  v_before int;
BEGIN
  -- 1) actor 가드
  IF auth.uid() IS NULL
     OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;

  -- 2) tournament_id 선취(비잠금)
  SELECT tournament_id INTO v_tournament_id
    FROM public.ops_participants WHERE id = p_participant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PARTICIPANT_NOT_FOUND: 참가자를 찾을 수 없습니다 (%)', p_participant_id
      USING ERRCODE = 'P0001';
  END IF;

  -- 3) 멤버십 [🔨H1: status 검사·advisory 보다 먼저 — 에러 차등 오라클 차단·1d 일관, §4.2 와 동일 근거]
  IF NOT (public.is_ops_member(v_tournament_id, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 관리 권한 없음' USING ERRCODE = 'P0001';
  END IF;

  -- 4) advisory → 대회 FOR UPDATE + active/completed 허용(upcoming 거부)
  PERFORM pg_advisory_xact_lock(hashtext('ops_tournament_' || v_tournament_id::text)::bigint);
  SELECT status INTO v_t_status FROM public.ops_tournaments
    WHERE id = v_tournament_id FOR UPDATE;
  IF v_t_status NOT IN ('active', 'completed') THEN
    RAISE EXCEPTION 'INVALID_STATUS: 시작 전 대회에는 정정할 상금이 없습니다 (status=%)', v_t_status
      USING ERRCODE = 'P0001';
  END IF;

  -- 5) 참가자 FOR UPDATE + 정산 대상(fp NOT NULL = busted 또는 확정 우승자)만
  SELECT finish_position, prize_amount INTO v_fp, v_before
    FROM public.ops_participants WHERE id = p_participant_id FOR UPDATE;
  IF v_fp IS NULL THEN
    RAISE EXCEPTION 'PRIZE_CORRECTION_INVALID: 순위가 확정된 참가자만 정정할 수 있습니다'
      USING ERRCODE = 'P0001';
  END IF;

  -- 6) 값 검증
  IF p_amount IS NOT NULL AND p_amount < 0 THEN
    RAISE EXCEPTION 'PRIZE_CORRECTION_INVALID: 금액은 0 이상이어야 합니다' USING ERRCODE = 'P0001';
  END IF;
  IF p_reason IS NOT NULL AND char_length(p_reason) > 200 THEN
    RAISE EXCEPTION 'PRIZE_CORRECTION_INVALID: 사유는 200자 이내여야 합니다' USING ERRCODE = 'P0001';
  END IF;

  -- 7) 변이(no-op 도 이벤트는 기록)
  UPDATE public.ops_participants SET prize_amount = p_amount WHERE id = p_participant_id;

  -- 8) 이벤트(p_reason 은 payload 에만 저장 — 공개 표면 미노출)
  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (v_tournament_id, 'prize_corrected', p_actor_id,
          jsonb_build_object('participant_id', p_participant_id,
                             'amount_before', v_before, 'amount_after', p_amount,
                             'reason', p_reason));

  RETURN jsonb_build_object('participant_id', p_participant_id,
                            'amount_before', v_before, 'amount_after', p_amount);
END;
$$;


ALTER FUNCTION public.ops_correct_participant_prize(p_participant_id uuid, p_actor_id uuid, p_amount integer, p_reason text) OWNER TO postgres;

--
-- Name: ops_create_tournament(uuid, text, text, date, text, uuid, integer, integer, jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.ops_create_tournament(p_owner_id uuid, p_name text, p_venue text, p_event_date date, p_game_type text, p_job_posting_id uuid, p_starting_chips integer, p_seats_per_table integer, p_config jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_tournament_id uuid;
  v_jp record;
BEGIN
  -- [보안] 호출자 바인딩: p_owner_id 는 호출자 본인(또는 admin).
  IF auth.uid() IS NULL
     OR (auth.uid() IS DISTINCT FROM p_owner_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;

  -- 공고 연동 시: 호출자가 해당 공고를 관리할 수 있어야 함.
  IF p_job_posting_id IS NOT NULL THEN
    SELECT id, owner_id, workspace_id INTO v_jp
      FROM public.job_postings WHERE id = p_job_posting_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'TOURNAMENT_NOT_FOUND: 공고를 찾을 수 없습니다 (%)', p_job_posting_id
        USING ERRCODE = 'P0001';
    END IF;
    IF NOT (
      v_jp.owner_id = p_owner_id
      OR public.is_workspace_member(v_jp.workspace_id, p_owner_id)
      OR public.is_admin()
    ) THEN
      RAISE EXCEPTION 'PERMISSION_DENIED: 공고 관리 권한 없음' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  INSERT INTO public.ops_tournaments (
    owner_id, job_posting_id, name, venue, event_date, game_type,
    status, seats_per_table, starting_chips,
    buy_in_chips, rebuy_chips, addon_chips,
    buy_in_cost, fee_cost, rebuy_cost, addon_cost, bounty_cost
  ) VALUES (
    p_owner_id, p_job_posting_id, p_name, p_venue, p_event_date,
    COALESCE(NULLIF(p_game_type, ''), 'NLH'),
    'upcoming', COALESCE(p_seats_per_table, 9), COALESCE(p_starting_chips, 0),
    COALESCE((p_config->>'buy_in_chips')::int, 0),
    COALESCE((p_config->>'rebuy_chips')::int, 0),
    COALESCE((p_config->>'addon_chips')::int, 0),
    COALESCE((p_config->>'buy_in_cost')::int, 0),
    COALESCE((p_config->>'fee_cost')::int, 0),
    COALESCE((p_config->>'rebuy_cost')::int, 0),
    COALESCE((p_config->>'addon_cost')::int, 0),
    (p_config->>'bounty_cost')::int    -- [1f] COALESCE 없음: NULL = 비-바운티(0 과 구분)
  ) RETURNING id INTO v_tournament_id;

  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (v_tournament_id, 'tournament_created', p_owner_id,
          jsonb_build_object('name', p_name));

  RETURN jsonb_build_object('tournament_id', v_tournament_id);
END;
$$;


ALTER FUNCTION public.ops_create_tournament(p_owner_id uuid, p_name text, p_venue text, p_event_date date, p_game_type text, p_job_posting_id uuid, p_starting_chips integer, p_seats_per_table integer, p_config jsonb) OWNER TO postgres;

--
-- Name: ops_free_seat(uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.ops_free_seat(p_seat_id uuid, p_actor_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE v_seat record;
BEGIN
  IF auth.uid() IS NULL OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;
  SELECT id, tournament_id, participant_id, table_no, seat_no INTO v_seat
    FROM public.ops_seats WHERE id = p_seat_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SEAT_NOT_FOUND: 좌석을 찾을 수 없습니다 (%)', p_seat_id USING ERRCODE = 'P0001';
  END IF;
  IF NOT (public.is_ops_member(v_seat.tournament_id, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 관리 권한 없음' USING ERRCODE = 'P0001';
  END IF;
  IF v_seat.participant_id IS NULL THEN
    RAISE EXCEPTION 'SEAT_NOT_OCCUPIED: 빈 좌석' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.ops_seats SET participant_id = NULL WHERE id = p_seat_id;
  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (v_seat.tournament_id, 'seat_freed', p_actor_id,
          jsonb_build_object('participant_id', v_seat.participant_id,
                             'table', v_seat.table_no, 'seat', v_seat.seat_no));
  RETURN jsonb_build_object('seat_id', p_seat_id);
END;
$$;


ALTER FUNCTION public.ops_free_seat(p_seat_id uuid, p_actor_id uuid) OWNER TO postgres;

--
-- Name: ops_get_monitor_snapshot(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.ops_get_monitor_snapshot(p_monitor_token text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_t     record;
  v_clock record;
  v_stats record;
  v_cur   record;
  v_next  record;
BEGIN
  IF p_monitor_token IS NULL OR char_length(p_monitor_token) < 32 THEN
    RAISE EXCEPTION 'OPS_MONITOR_TOKEN_INVALID: 유효하지 않은 모니터 토큰' USING ERRCODE = 'P0001';
  END IF;

  SELECT id, name, venue, event_date, game_type, status, color, registration_open
    INTO v_t
    FROM public.ops_tournaments
    WHERE monitor_token = p_monitor_token;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'OPS_MONITOR_TOKEN_INVALID: 유효하지 않은 모니터 토큰' USING ERRCODE = 'P0001';
  END IF;

  SELECT current_level_sort, level_started_at, is_running, paused_remaining_sec
    INTO v_clock FROM public.ops_clock WHERE tournament_id = v_t.id;

  SELECT playing, entries, reentries_total, tables_open, seats_total, seats_free,
         total_chips, average_stack, avg_stack_bb, prize_pool, knockout_pool
    INTO v_stats FROM public.ops_live_stats WHERE tournament_id = v_t.id;

  SELECT level, small_blind, big_blind, ante, duration_sec, is_break
    INTO v_cur FROM public.ops_blind_levels
    WHERE tournament_id = v_t.id AND sort = v_clock.current_level_sort;

  SELECT level, small_blind, big_blind, ante, duration_sec, is_break
    INTO v_next FROM public.ops_blind_levels
    WHERE tournament_id = v_t.id AND sort = v_clock.current_level_sort + 1;

  RETURN jsonb_build_object(
    'tournament', jsonb_build_object(
      'name', v_t.name, 'venue', v_t.venue, 'eventDate', v_t.event_date,
      'gameType', v_t.game_type, 'status', v_t.status::text, 'color', v_t.color,
      'registrationOpen', v_t.registration_open),
    'clock', jsonb_build_object(
      'currentLevelSort', v_clock.current_level_sort, 'levelStartedAt', v_clock.level_started_at,
      'isRunning', COALESCE(v_clock.is_running, false), 'pausedRemainingSec', v_clock.paused_remaining_sec),
    'currentLevel', CASE WHEN v_cur IS NULL THEN NULL ELSE jsonb_build_object(
      'level', v_cur.level, 'smallBlind', v_cur.small_blind, 'bigBlind', v_cur.big_blind,
      'ante', v_cur.ante, 'durationSec', v_cur.duration_sec, 'isBreak', v_cur.is_break) END,
    'nextLevel', CASE WHEN v_next IS NULL THEN NULL ELSE jsonb_build_object(
      'level', v_next.level, 'smallBlind', v_next.small_blind, 'bigBlind', v_next.big_blind,
      'ante', v_next.ante, 'durationSec', v_next.duration_sec, 'isBreak', v_next.is_break) END,
    'stats', jsonb_build_object(
      'playing', COALESCE(v_stats.playing, 0), 'entries', COALESCE(v_stats.entries, 0),
      'reentriesTotal', COALESCE(v_stats.reentries_total, 0), 'tablesOpen', COALESCE(v_stats.tables_open, 0),
      'seatsTotal', COALESCE(v_stats.seats_total, 0), 'seatsFree', COALESCE(v_stats.seats_free, 0),
      'totalChips', COALESCE(v_stats.total_chips, 0), 'averageStack', COALESCE(v_stats.average_stack, 0),
      'avgStackBb', COALESCE(v_stats.avg_stack_bb, 0), 'prizePool', COALESCE(v_stats.prize_pool, 0),
      'knockoutPool', v_stats.knockout_pool),
    'serverNow', now()
  );
END;
$$;


ALTER FUNCTION public.ops_get_monitor_snapshot(p_monitor_token text) OWNER TO postgres;

--
-- Name: ops_get_player_view(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.ops_get_player_view(p_view_token text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_p record; v_seat record; v_t record; v_clock record; v_cur record; v_stats record;
BEGIN
  IF p_view_token IS NULL OR char_length(p_view_token) < 32 THEN
    RAISE EXCEPTION 'OPS_VIEW_TOKEN_INVALID: 유효하지 않은 플레이어 토큰' USING ERRCODE = 'P0001';
  END IF;

  -- 본인 1행. 안전필드만 — view_token/claim_pin_hash/phone/nationality/note/player_user_id 미선택.
  SELECT id, tournament_id, entry_number, name, status, chips,
         finish_position, prize_amount, rebuys, add_ons, reentries, knockouts
    INTO v_p
    FROM public.ops_participants
    WHERE view_token = p_view_token;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'OPS_VIEW_TOKEN_INVALID: 유효하지 않은 플레이어 토큰' USING ERRCODE = 'P0001';
  END IF;

  SELECT t.table_no, s.seat_no
    INTO v_seat
    FROM public.ops_seats s
    JOIN public.ops_tables t ON t.id = s.table_id
    WHERE s.participant_id = v_p.id;

  -- bounty_cost 는 적립 계산에만 사용(자체는 반환 안 함).
  SELECT name, venue, game_type, status, bounty_cost
    INTO v_t FROM public.ops_tournaments WHERE id = v_p.tournament_id;

  SELECT current_level_sort, level_started_at, is_running, paused_remaining_sec
    INTO v_clock FROM public.ops_clock WHERE tournament_id = v_p.tournament_id;

  SELECT level, small_blind, big_blind, ante, duration_sec, is_break
    INTO v_cur FROM public.ops_blind_levels
    WHERE tournament_id = v_p.tournament_id AND sort = v_clock.current_level_sort;

  SELECT playing, entries, average_stack, avg_stack_bb
    INTO v_stats FROM public.ops_live_stats WHERE tournament_id = v_p.tournament_id;

  RETURN jsonb_build_object(
    'me', jsonb_build_object(
      'entryNumber', v_p.entry_number, 'name', v_p.name, 'status', v_p.status::text,
      'chips', v_p.chips, 'finishPosition', v_p.finish_position, 'prizeAmount', v_p.prize_amount,
      'rebuys', v_p.rebuys, 'addOns', v_p.add_ons, 'reentries', v_p.reentries,
      'knockouts', v_p.knockouts,
      -- [후속] ::bigint 승격 — knockouts(int) × bounty_cost(int) 의 int*int 오버플로 차단(#226 동일 클래스).
      'bountyAccrued', CASE WHEN v_t.bounty_cost IS NULL THEN NULL
                            ELSE v_p.knockouts::bigint * v_t.bounty_cost END,
      'tableNo', v_seat.table_no, 'seatNo', v_seat.seat_no),
    'tournament', jsonb_build_object(
      'name', v_t.name, 'venue', v_t.venue, 'gameType', v_t.game_type, 'status', v_t.status::text),
    'clock', jsonb_build_object(
      'currentLevelSort', v_clock.current_level_sort, 'levelStartedAt', v_clock.level_started_at,
      'isRunning', COALESCE(v_clock.is_running, false), 'pausedRemainingSec', v_clock.paused_remaining_sec),
    'currentLevel', CASE WHEN v_cur IS NULL THEN NULL ELSE jsonb_build_object(
      'level', v_cur.level, 'smallBlind', v_cur.small_blind, 'bigBlind', v_cur.big_blind,
      'ante', v_cur.ante, 'durationSec', v_cur.duration_sec, 'isBreak', v_cur.is_break) END,
    'stats', jsonb_build_object(
      'playing', COALESCE(v_stats.playing, 0), 'entries', COALESCE(v_stats.entries, 0),
      'averageStack', COALESCE(v_stats.average_stack, 0), 'avgStackBb', COALESCE(v_stats.avg_stack_bb, 0)),
    'serverNow', now()
  );
END;
$$;


ALTER FUNCTION public.ops_get_player_view(p_view_token text) OWNER TO postgres;

--
-- Name: ops_import_staff_from_posting(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.ops_import_staff_from_posting(p_tournament_id uuid, p_actor_id uuid, p_date text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_t public.ops_tournaments%ROWTYPE;
  v_posting_id uuid;
  v_candidates int;
  v_imported int;
BEGIN
  IF auth.uid() IS NULL OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 본인 계정으로만 호출할 수 있습니다' USING ERRCODE = 'P0001';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('ops_tournament_' || p_tournament_id::text)::bigint);

  SELECT * INTO v_t FROM public.ops_tournaments WHERE id = p_tournament_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TOURNAMENT_NOT_FOUND: 대회를 찾을 수 없습니다' USING ERRCODE = 'P0001';
  END IF;

  IF NOT (public.is_ops_member(p_tournament_id, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 운영 권한이 없습니다' USING ERRCODE = 'P0001';
  END IF;

  v_posting_id := v_t.job_posting_id;
  IF v_posting_id IS NULL THEN
    RAISE EXCEPTION 'NO_LINKED_POSTING: 연결된 공고가 없습니다. 먼저 공고를 연결하세요' USING ERRCODE = 'P0001';
  END IF;

  -- 확정 스태프 SSOT = work_logs (스펙 §2.2 — 읽기 전용, work_logs에 쓰지 않음)
  WITH src AS (
    SELECT DISTINCT ON (wl.staff_id)
           wl.staff_id, wl.role, wl.custom_role, wl.staff_name, wl.staff_nickname,
           wl.id AS work_log_id
    FROM public.work_logs wl
    WHERE wl.job_posting_id = v_posting_id
      AND wl.status NOT IN ('cancelled','no_show')
      AND (p_date IS NULL OR wl.date = p_date)
    ORDER BY wl.staff_id, wl.date DESC, wl.created_at DESC
  ), ins AS (
    INSERT INTO public.ops_staff
      (tournament_id, staff_id, role, custom_role, staff_name, staff_nickname, source, source_work_log_id)
    SELECT p_tournament_id, s.staff_id, s.role, s.custom_role,
           COALESCE(NULLIF(btrim(s.staff_name), ''), s.staff_nickname, '이름 미상'),
           s.staff_nickname, 'snapshot_import', s.work_log_id
    FROM src s
    ON CONFLICT (tournament_id, staff_id) DO NOTHING
    RETURNING 1
  )
  SELECT (SELECT count(*) FROM src), (SELECT count(*) FROM ins)
  INTO v_candidates, v_imported;

  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (p_tournament_id, 'staff_imported', p_actor_id,
          jsonb_build_object('job_posting_id', v_posting_id, 'date', p_date,
                             'imported', v_imported, 'skipped', v_candidates - v_imported));

  RETURN jsonb_build_object('imported', v_imported, 'skipped', v_candidates - v_imported);
END;
$$;


ALTER FUNCTION public.ops_import_staff_from_posting(p_tournament_id uuid, p_actor_id uuid, p_date text) OWNER TO postgres;

--
-- Name: ops_issue_player_credentials(uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.ops_issue_player_credentials(p_participant_id uuid, p_actor_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_tid uuid; v_token text; v_rand bytea; v_pin text;
BEGIN
  IF auth.uid() IS NULL OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;
  SELECT tournament_id, view_token INTO v_tid, v_token
    FROM public.ops_participants WHERE id = p_participant_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PARTICIPANT_NOT_FOUND: 참가자를 찾을 수 없습니다 (%)', p_participant_id USING ERRCODE = 'P0001';
  END IF;
  IF NOT (public.is_ops_member(v_tid, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 관리 권한 없음' USING ERRCODE = 'P0001';
  END IF;

  -- view_token 멱등(안정 URL/QR). 미발급 시에만 생성.
  IF v_token IS NULL THEN
    v_token := encode(gen_random_bytes(24), 'hex');
  END IF;

  -- 새 PIN 로테이트(균일 8자 base32 — 256=8*32 모듈로 편향 0).
  v_rand := gen_random_bytes(8);
  v_pin := (SELECT string_agg(
              substr('0123456789ABCDEFGHJKMNPQRSTVWXYZ', 1 + (get_byte(v_rand, g) % 32), 1),
              '' ORDER BY g)
            FROM generate_series(0, 7) AS g);

  UPDATE public.ops_participants
    SET view_token = v_token,
        claim_pin_hash = crypt(v_pin, gen_salt('bf'))
    WHERE id = p_participant_id;

  RETURN jsonb_build_object('participantId', p_participant_id, 'viewToken', v_token, 'claimPin', v_pin);
END;
$$;


ALTER FUNCTION public.ops_issue_player_credentials(p_participant_id uuid, p_actor_id uuid) OWNER TO postgres;

--
-- Name: ops_move_seat(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.ops_move_seat(p_from_seat_id uuid, p_to_seat_id uuid, p_actor_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE v_first uuid; v_second uuid; v_from record; v_to record; v_table_status public.ops_table_status;
BEGIN
  IF auth.uid() IS NULL OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;
  IF p_from_seat_id = p_to_seat_id THEN
    RAISE EXCEPTION 'INVALID_MOVE: 동일 좌석' USING ERRCODE = 'P0001';
  END IF;
  -- 데드락 회피: id 오름차순 잠금.
  v_first := LEAST(p_from_seat_id, p_to_seat_id);
  v_second := GREATEST(p_from_seat_id, p_to_seat_id);
  PERFORM 1 FROM public.ops_seats WHERE id = v_first FOR UPDATE;
  PERFORM 1 FROM public.ops_seats WHERE id = v_second FOR UPDATE;

  SELECT id, tournament_id, participant_id, table_no, seat_no INTO v_from
    FROM public.ops_seats WHERE id = p_from_seat_id;
  SELECT id, tournament_id, table_id, participant_id, table_no, seat_no INTO v_to
    FROM public.ops_seats WHERE id = p_to_seat_id;
  IF v_from.id IS NULL OR v_to.id IS NULL THEN
    RAISE EXCEPTION 'SEAT_NOT_FOUND: 좌석을 찾을 수 없습니다' USING ERRCODE = 'P0001';
  END IF;
  IF v_from.tournament_id <> v_to.tournament_id THEN
    RAISE EXCEPTION 'INVALID_MOVE: 다른 대회 좌석' USING ERRCODE = 'P0001';
  END IF;
  IF NOT (public.is_ops_member(v_from.tournament_id, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 관리 권한 없음' USING ERRCODE = 'P0001';
  END IF;
  IF v_from.participant_id IS NULL THEN
    RAISE EXCEPTION 'SEAT_NOT_OCCUPIED: 출발 좌석이 비어있음' USING ERRCODE = 'P0001';
  END IF;
  IF v_to.participant_id IS NOT NULL THEN
    RAISE EXCEPTION 'SEAT_TAKEN: 도착 좌석이 점유됨' USING ERRCODE = 'P0001';
  END IF;
  SELECT status INTO v_table_status FROM public.ops_tables WHERE id = v_to.table_id;
  IF v_table_status <> 'open' THEN
    RAISE EXCEPTION 'TABLE_NOT_OPEN: open 테이블로만 이동 가능 (status=%)', v_table_status USING ERRCODE = 'P0001';
  END IF;
  -- partial UNIQUE 회피: from 먼저 비움.
  UPDATE public.ops_seats SET participant_id = NULL WHERE id = p_from_seat_id;
  UPDATE public.ops_seats SET participant_id = v_from.participant_id WHERE id = p_to_seat_id;
  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (v_from.tournament_id, 'player_moved', p_actor_id,
          jsonb_build_object('participant_id', v_from.participant_id,
                             'from_table', v_from.table_no, 'from_seat', v_from.seat_no,
                             'to_table', v_to.table_no, 'to_seat', v_to.seat_no));
  RETURN jsonb_build_object('participant_id', v_from.participant_id,
                            'from_seat_id', p_from_seat_id, 'to_seat_id', p_to_seat_id);
END;
$$;


ALTER FUNCTION public.ops_move_seat(p_from_seat_id uuid, p_to_seat_id uuid, p_actor_id uuid) OWNER TO postgres;

--
-- Name: ops_redraw_waitlist_fill(uuid, uuid, jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.ops_redraw_waitlist_fill(p_tournament_id uuid, p_actor_id uuid, p_assignments jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE a jsonb; v_seat record; v_expected uuid; v_pid uuid; v_moved int := 0;
        v_seat_ids uuid[];
        v_lock_id uuid; v_p_tid uuid; v_p_status public.ops_participant_status; v_t_status public.ops_table_status; v_t_lock public.ops_table_lock_type;
BEGIN
  IF auth.uid() IS NULL OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;
  IF NOT (public.is_ops_member(p_tournament_id, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 관리 권한 없음' USING ERRCODE = 'P0001';
  END IF;
  IF jsonb_typeof(p_assignments) <> 'array' OR jsonb_array_length(p_assignments) = 0 THEN
    RAISE EXCEPTION 'INVALID_ASSIGNMENTS: 배정 목록이 비었습니다' USING ERRCODE = 'P0001';
  END IF;

  -- 결정적 락 순서: 관련 좌석 id 오름차순 FOR UPDATE.
  SELECT array_agg(value->>'seat_id' ORDER BY value->>'seat_id')
    INTO v_seat_ids FROM jsonb_array_elements(p_assignments);
  -- id 오름차순 잠금(ops_move_seat 와 동일 규율) — array 정렬만으론 락 획득 순서 보장 안됨.
  FOR v_lock_id IN SELECT id FROM public.ops_seats WHERE id = ANY(v_seat_ids::uuid[]) ORDER BY id LOOP
    PERFORM 1 FROM public.ops_seats WHERE id = v_lock_id FOR UPDATE;
  END LOOP;

  FOR a IN SELECT * FROM jsonb_array_elements(p_assignments) LOOP
    v_pid := (a->>'participant_id')::uuid;
    v_expected := NULLIF(a->>'expected', '')::uuid;
    SELECT id, tournament_id, table_id, participant_id, table_no, seat_no INTO v_seat
      FROM public.ops_seats WHERE id = (a->>'seat_id')::uuid;
    IF v_seat.id IS NULL OR v_seat.tournament_id <> p_tournament_id THEN
      RAISE EXCEPTION 'SEAT_NOT_FOUND: 좌석 % 없음', a->>'seat_id' USING ERRCODE = 'P0001';
    END IF;
    -- TOCTOU: 미리보기 시점 값과 현재값 불일치면 거부.
    IF v_seat.participant_id IS DISTINCT FROM v_expected THEN
      RAISE EXCEPTION 'SEAT_VERSION_CONFLICT: 좌석 상태가 변경됨 — 다시 시도' USING ERRCODE = 'P0001';
    END IF;
    -- 대상 좌석이 비어야(대기채움), 참가자가 미착석이어야.
    IF v_seat.participant_id IS NOT NULL THEN
      RAISE EXCEPTION 'SEAT_TAKEN: 좌석 점유됨' USING ERRCODE = 'P0001';
    END IF;
    IF EXISTS (SELECT 1 FROM public.ops_seats WHERE tournament_id = p_tournament_id
                 AND participant_id = v_pid) THEN
      RAISE EXCEPTION 'PARTICIPANT_ALREADY_SEATED: 참가자 % 이미 착석', v_pid USING ERRCODE = 'P0001';
    END IF;
    -- 참가자 동일 대회 + 활성가능 상태 검증 (cross-tenant/탈락 차단).
    SELECT tournament_id, status INTO v_p_tid, v_p_status
      FROM public.ops_participants WHERE id = v_pid FOR UPDATE;
    IF NOT FOUND OR v_p_tid <> p_tournament_id THEN
      RAISE EXCEPTION 'PARTICIPANT_NOT_FOUND: 참가자 % 없음/타대회', v_pid USING ERRCODE = 'P0001';
    END IF;
    IF v_p_status = 'busted' OR v_p_status = 'no_show' THEN
      RAISE EXCEPTION 'PARTICIPANT_NOT_ACTIVE: 탈락/미출석 참가자는 배정 불가' USING ERRCODE = 'P0001';
    END IF;
    -- 대상 좌석 테이블은 open·unlocked 만 (대기채움 범위 — closed/standby/locked 제외).
    SELECT status, lock_type INTO v_t_status, v_t_lock
      FROM public.ops_tables WHERE id = v_seat.table_id;
    IF v_t_status <> 'open' OR v_t_lock <> 'none' THEN
      RAISE EXCEPTION 'TABLE_NOT_OPEN: redraw 대상 테이블은 open·unlocked 만 (status=%, lock=%)', v_t_status, v_t_lock USING ERRCODE = 'P0001';
    END IF;
    UPDATE public.ops_seats SET participant_id = v_pid WHERE id = v_seat.id;
    UPDATE public.ops_participants SET status = 'active' WHERE id = v_pid AND status <> 'active';
    v_moved := v_moved + 1;
  END LOOP;

  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (p_tournament_id, 'table_redraw', p_actor_id,
          jsonb_build_object('mode', 'waitlist_fill', 'moved', v_moved));
  RETURN jsonb_build_object('moved', v_moved);
END;
$$;


ALTER FUNCTION public.ops_redraw_waitlist_fill(p_tournament_id uuid, p_actor_id uuid, p_assignments jsonb) OWNER TO postgres;

--
-- Name: ops_reenter_participant(uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.ops_reenter_participant(p_participant_id uuid, p_actor_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_tournament_id uuid;
  v_status public.ops_participant_status;
  v_reentries int;
  v_t_status public.ops_tournament_status;
  v_reentry_allowed boolean;
  v_max_reentries int;
  v_starting_chips int;
  v_auto_seat boolean;
  v_seat_id uuid;
  v_new_status public.ops_participant_status;
  v_seated boolean;
BEGIN
  IF auth.uid() IS NULL
     OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;

  -- tournament_id 선취(비잠금) — 데드락 회피: advisory 락을 참가자/대회 행 잠금보다 먼저 취득.
  SELECT tournament_id INTO v_tournament_id
    FROM public.ops_participants WHERE id = p_participant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PARTICIPANT_NOT_FOUND: 참가자를 찾을 수 없습니다 (%)', p_participant_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT (public.is_ops_member(v_tournament_id, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 관리 권한 없음' USING ERRCODE = 'P0001';
  END IF;

  -- advisory 락(전 bust/reenter 동일 키로 직렬화) → 대회 행 잠금.
  --    잠금 순서 불변식: advisory → 대회 FOR UPDATE → 참가자 FOR UPDATE.
  PERFORM pg_advisory_xact_lock(hashtext('ops_tournament_' || v_tournament_id::text)::bigint);
  SELECT status, reentry_allowed, max_reentries, starting_chips, auto_seat_on_register
    INTO v_t_status, v_reentry_allowed, v_max_reentries, v_starting_chips, v_auto_seat
    FROM public.ops_tournaments WHERE id = v_tournament_id FOR UPDATE;
  IF v_t_status <> 'active' THEN
    RAISE EXCEPTION 'INVALID_STATUS: 진행 중(active) 대회만 재진입 가능 (status=%)', v_t_status
      USING ERRCODE = 'P0001';
  END IF;

  -- 참가자 행 잠금(advisory/대회 락 이후) + status/카운터 확인
  SELECT status, reentries INTO v_status, v_reentries
    FROM public.ops_participants WHERE id = p_participant_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PARTICIPANT_NOT_FOUND: 참가자를 찾을 수 없습니다 (%)', p_participant_id
      USING ERRCODE = 'P0001';
  END IF;

  IF v_status <> 'busted' THEN
    RAISE EXCEPTION 'PARTICIPANT_NOT_BUSTED: 탈락 상태가 아니어서 재진입할 수 없습니다 (status=%)', v_status
      USING ERRCODE = 'P0001';
  END IF;
  IF v_reentry_allowed = false THEN
    RAISE EXCEPTION 'REENTRY_NOT_ALLOWED: 이 대회는 재진입이 허용되지 않습니다' USING ERRCODE = 'P0001';
  END IF;
  IF v_max_reentries IS NOT NULL AND v_reentries >= v_max_reentries THEN
    RAISE EXCEPTION 'MAX_REENTRIES_EXCEEDED: 최대 재진입 횟수를 초과했습니다 (max=%)', v_max_reentries
      USING ERRCODE = 'P0001';
  END IF;

  -- auto-seat 결정(register 미러: 좌석 확보 시에만 active)
  v_seat_id := NULL;
  IF v_auto_seat THEN
    SELECT s.id INTO v_seat_id
      FROM public.ops_seats s
      JOIN public.ops_tables t ON t.id = s.table_id
      WHERE s.tournament_id = v_tournament_id
        AND s.participant_id IS NULL
        AND t.status = 'open' AND t.lock_type = 'none'
      ORDER BY s.table_no, s.seat_no
      LIMIT 1 FOR UPDATE OF s SKIP LOCKED;
  END IF;
  v_seated := v_seat_id IS NOT NULL;
  v_new_status := CASE WHEN v_seated THEN 'active'::public.ops_participant_status
                       ELSE 'checked_in'::public.ops_participant_status END;

  UPDATE public.ops_participants
    SET chips = v_starting_chips, finish_position = NULL, busted_at = NULL,
        prize_amount = NULL, reentries = v_reentries + 1, status = v_new_status
    WHERE id = p_participant_id;

  IF v_seated THEN
    UPDATE public.ops_seats SET participant_id = p_participant_id WHERE id = v_seat_id;
  END IF;

  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (v_tournament_id, 'player_reentered', p_actor_id,
          jsonb_build_object('participant_id', p_participant_id,
                             'reentries', v_reentries + 1, 'seated', v_seated));

  RETURN jsonb_build_object('participant_id', p_participant_id,
                            'reentries', v_reentries + 1, 'status', v_new_status, 'seated', v_seated);
END;
$$;


ALTER FUNCTION public.ops_reenter_participant(p_participant_id uuid, p_actor_id uuid) OWNER TO postgres;

--
-- Name: ops_register_participant(uuid, uuid, text, text, text, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.ops_register_participant(p_tournament_id uuid, p_actor_id uuid, p_name text, p_nationality text, p_phone text, p_buy_in_amount integer) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE v_t record; v_entry int; v_participant_id uuid; v_seat_id uuid;
        v_status public.ops_participant_status; v_table_no int; v_seat_no int;
BEGIN
  IF auth.uid() IS NULL OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;
  SELECT id, registration_open, starting_chips, next_entry_seq, auto_seat_on_register
    INTO v_t FROM public.ops_tournaments WHERE id = p_tournament_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TOURNAMENT_NOT_FOUND: 대회를 찾을 수 없습니다 (%)', p_tournament_id USING ERRCODE = 'P0001';
  END IF;
  IF NOT (public.is_ops_member(p_tournament_id, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 관리 권한 없음' USING ERRCODE = 'P0001';
  END IF;
  IF v_t.registration_open = false THEN
    RAISE EXCEPTION 'REGISTRATION_CLOSED: 등록이 마감되었습니다' USING ERRCODE = 'P0001';
  END IF;

  v_entry := v_t.next_entry_seq + 1;
  UPDATE public.ops_tournaments SET next_entry_seq = v_entry WHERE id = p_tournament_id;

  -- auto-seat: open·unlocked 테이블의 빈좌석 1개(table_no,seat_no asc) 잠금 시도.
  v_seat_id := NULL;
  IF v_t.auto_seat_on_register THEN
    SELECT s.id, s.table_no, s.seat_no INTO v_seat_id, v_table_no, v_seat_no
      FROM public.ops_seats s
      JOIN public.ops_tables t ON t.id = s.table_id
      WHERE s.tournament_id = p_tournament_id
        AND s.participant_id IS NULL
        AND t.status = 'open' AND t.lock_type = 'none'
      ORDER BY s.table_no, s.seat_no
      LIMIT 1 FOR UPDATE OF s SKIP LOCKED;
  END IF;

  v_status := CASE WHEN v_seat_id IS NOT NULL THEN 'active'::public.ops_participant_status
                   ELSE 'checked_in'::public.ops_participant_status END;

  INSERT INTO public.ops_participants (tournament_id, entry_number, name, nationality, phone,
                                       status, chips, buy_in_amount)
  VALUES (p_tournament_id, v_entry, p_name, p_nationality, p_phone,
          v_status, v_t.starting_chips, p_buy_in_amount)
  RETURNING id INTO v_participant_id;

  IF v_seat_id IS NOT NULL THEN
    UPDATE public.ops_seats SET participant_id = v_participant_id WHERE id = v_seat_id;
  END IF;

  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (p_tournament_id, 'player_registered', p_actor_id,
          jsonb_build_object('participant_id', v_participant_id, 'entry_number', v_entry,
                             'seated', v_seat_id IS NOT NULL,
                             'table', v_table_no, 'seat', v_seat_no));

  RETURN jsonb_build_object('participant_id', v_participant_id, 'entry_number', v_entry,
                            'status', v_status, 'seated', v_seat_id IS NOT NULL);
END;
$$;


ALTER FUNCTION public.ops_register_participant(p_tournament_id uuid, p_actor_id uuid, p_name text, p_nationality text, p_phone text, p_buy_in_amount integer) OWNER TO postgres;

--
-- Name: ops_remove_staff(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.ops_remove_staff(p_tournament_id uuid, p_actor_id uuid, p_ops_staff_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_t public.ops_tournaments%ROWTYPE;
  v_row public.ops_staff%ROWTYPE;
  v_table_ids uuid[];
BEGIN
  IF auth.uid() IS NULL OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 본인 계정으로만 호출할 수 있습니다' USING ERRCODE = 'P0001';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('ops_tournament_' || p_tournament_id::text)::bigint);

  SELECT * INTO v_t FROM public.ops_tournaments WHERE id = p_tournament_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TOURNAMENT_NOT_FOUND: 대회를 찾을 수 없습니다' USING ERRCODE = 'P0001';
  END IF;
  IF NOT (public.is_ops_member(p_tournament_id, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 운영 권한이 없습니다' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_row FROM public.ops_staff
   WHERE id = p_ops_staff_id AND tournament_id = p_tournament_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'STAFF_NOT_FOUND: 로스터에서 찾을 수 없습니다' USING ERRCODE = 'P0001';
  END IF;

  -- cascade-clear: 배정 테이블 선해제 (id asc 잠금 — FOR UPDATE는 집계와 못 쓰므로 서브쿼리)
  SELECT array_agg(id) INTO v_table_ids FROM (
    SELECT id FROM public.ops_tables
     WHERE tournament_id = p_tournament_id AND assigned_staff_id = v_row.staff_id
     ORDER BY id
     FOR UPDATE
  ) locked;
  IF v_table_ids IS NOT NULL THEN
    UPDATE public.ops_tables SET assigned_staff_id = NULL WHERE id = ANY(v_table_ids);
  END IF;

  DELETE FROM public.ops_staff WHERE id = p_ops_staff_id;

  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (p_tournament_id, 'staff_removed', p_actor_id,
          jsonb_build_object('staff_id', v_row.staff_id,
                             'cleared_table_ids', COALESCE(to_jsonb(v_table_ids), '[]'::jsonb)));

  RETURN jsonb_build_object('success', true,
                            'clearedTableIds', COALESCE(to_jsonb(v_table_ids), '[]'::jsonb));
END;
$$;


ALTER FUNCTION public.ops_remove_staff(p_tournament_id uuid, p_actor_id uuid, p_ops_staff_id uuid) OWNER TO postgres;

--
-- Name: ops_reseat_participants(uuid, uuid, jsonb, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.ops_reseat_participants(p_tournament_id uuid, p_actor_id uuid, p_assignments jsonb, p_mode text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $_$
DECLARE
  v_pids     uuid[];
  v_seat_ids uuid[];
  v_n        int;
  v_t_status text;
  v_moved    int := 0;
  v_seated   int := 0;
  r          record;
BEGIN
  -- 1. actor 가드
  IF auth.uid() IS NULL OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 권한이 없어요.' USING ERRCODE = 'P0001';
  END IF;

  -- 2. mode 검증
  IF p_mode IS NULL OR p_mode NOT IN ('random_draw', 'chip_draft') THEN
    RAISE EXCEPTION 'INVALID_REDRAW_MODE: 지원하지 않는 배정 방식이에요.' USING ERRCODE = 'P0001';
  END IF;

  -- 3. assignments 파싱·구조 검증
  IF p_assignments IS NULL OR jsonb_typeof(p_assignments) <> 'array' OR jsonb_array_length(p_assignments) = 0 THEN
    RAISE EXCEPTION 'SEAT_ASSIGNMENT_INVALID: 좌석 배정 정보가 올바르지 않아요.' USING ERRCODE = 'P0001';
  END IF;
  -- 3a. 신뢰경계 방어(golden #6): 아래 array_agg 의 ::uuid 캐스트 전에 각 id 가 uuid 텍스트인지 선검증.
  --     비-uuid 문자열이 raw 22P02(친절 SEAT_ASSIGNMENT_INVALID 경로 우회)로 누출되던 갭 차단.
  --     그룹형 hex(RFC 4122 variant 비강제) — 클라 uuidLike 정규식과 정합. NULL(키 부재)=빈문자→미매치.
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_assignments) e
    WHERE coalesce(e->>'participant_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       OR coalesce(e->>'seat_id', '')        !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ) THEN
    RAISE EXCEPTION 'SEAT_ASSIGNMENT_INVALID: 좌석 배정 정보가 올바르지 않아요.' USING ERRCODE = 'P0001';
  END IF;
  SELECT array_agg((e->>'participant_id')::uuid), array_agg((e->>'seat_id')::uuid)
    INTO v_pids, v_seat_ids
    FROM jsonb_array_elements(p_assignments) e;
  IF array_position(v_pids, NULL) IS NOT NULL OR array_position(v_seat_ids, NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'SEAT_ASSIGNMENT_INVALID: 좌석 배정 정보가 올바르지 않아요.' USING ERRCODE = 'P0001';
  END IF;
  v_n := array_length(v_pids, 1);
  -- 참가자·좌석 중복 금지
  IF (SELECT count(DISTINCT x) FROM unnest(v_pids) x) <> v_n
     OR (SELECT count(DISTINCT x) FROM unnest(v_seat_ids) x) <> v_n THEN
    RAISE EXCEPTION 'SEAT_ASSIGNMENT_INVALID: 좌석 배정 정보가 올바르지 않아요.' USING ERRCODE = 'P0001';
  END IF;

  -- 4. advisory → 대회 FOR UPDATE → 멤버십
  PERFORM pg_advisory_xact_lock(hashtext('ops_tournament_' || p_tournament_id::text)::bigint);
  SELECT status INTO v_t_status FROM public.ops_tournaments WHERE id = p_tournament_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TOURNAMENT_NOT_FOUND: 대회를 찾을 수 없어요.' USING ERRCODE = 'P0001';
  END IF;
  IF v_t_status = 'completed' THEN
    RAISE EXCEPTION 'INVALID_STATUS: 종료된 대회는 재배치할 수 없어요.' USING ERRCODE = 'P0001';
  END IF;
  IF NOT (public.is_ops_member(p_tournament_id, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 권한이 없어요.' USING ERRCODE = 'P0001';
  END IF;

  -- 5. 좌석 잠금(id asc) — 참가자보다 먼저 잠가 비-advisory 좌석 RPC(assign/move/redraw)의
  --    좌석-우선 규약과 통일(ABBA 데드락 회피). 목표 좌석 ∪ 풀 플레이어 현재 점유 좌석.
  PERFORM 1 FROM public.ops_seats
    WHERE tournament_id = p_tournament_id AND (id = ANY(v_seat_ids) OR participant_id = ANY(v_pids))
    ORDER BY id FOR UPDATE;

  -- 6. 참가자 잠금·가드(id asc) — 좌석 잠금 이후
  PERFORM 1 FROM public.ops_participants
    WHERE tournament_id = p_tournament_id AND id = ANY(v_pids)
    ORDER BY id FOR UPDATE;
  IF (SELECT count(*) FROM public.ops_participants
      WHERE tournament_id = p_tournament_id AND id = ANY(v_pids)) <> v_n THEN
    RAISE EXCEPTION 'PARTICIPANT_NOT_FOUND: 참가자를 찾을 수 없어요.' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.ops_participants
    WHERE tournament_id = p_tournament_id AND id = ANY(v_pids)
      AND status NOT IN ('active', 'checked_in')
  ) THEN
    RAISE EXCEPTION 'PARTICIPANT_NOT_ACTIVE: 활성/대기 상태 참가자만 배정할 수 있어요.' USING ERRCODE = 'P0001';
  END IF;

  -- 7. 목표 좌석 가드: 존재·동일대회·적격 테이블·외부인 미점유
  FOR r IN SELECT unnest(v_seat_ids) AS seat_id LOOP
    PERFORM 1 FROM public.ops_seats s JOIN public.ops_tables t ON t.id = s.table_id
      WHERE s.id = r.seat_id AND s.tournament_id = p_tournament_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'SEAT_ASSIGNMENT_INVALID: 좌석 배정 정보가 올바르지 않아요.' USING ERRCODE = 'P0001';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.ops_seats s JOIN public.ops_tables t ON t.id = s.table_id
      WHERE s.id = r.seat_id AND t.status = 'open' AND t.lock_type = 'none'
    ) THEN
      RAISE EXCEPTION 'TABLE_NOT_OPEN: 닫혔거나 잠긴 테이블에는 배정할 수 없어요.' USING ERRCODE = 'P0001';
    END IF;
    -- 외부인(풀에 없는 참가자) 동시 착석 → TOCTOU 충돌
    IF EXISTS (
      SELECT 1 FROM public.ops_seats s
      WHERE s.id = r.seat_id AND s.participant_id IS NOT NULL AND NOT (s.participant_id = ANY(v_pids))
    ) THEN
      RAISE EXCEPTION 'SEAT_VERSION_CONFLICT: 좌석 상태가 바뀌었어요. 다시 계산해 주세요.' USING ERRCODE = 'P0001';
    END IF;
  END LOOP;

  -- 8. 소스 보호 가드: 풀 참가자가 비적격 테이블(마감/대기/잠금/피처)에 앉아 있으면 거부
  --    피처/잠금 테이블 점유자는 재배치에서 보호(클라가 풀에서 선제외, 서버 백스톱).
  IF EXISTS (
    SELECT 1 FROM public.ops_seats s JOIN public.ops_tables t ON t.id = s.table_id
    WHERE s.tournament_id = p_tournament_id AND s.participant_id = ANY(v_pids)
      AND NOT (t.status = 'open' AND t.lock_type = 'none')
  ) THEN
    RAISE EXCEPTION 'SEAT_ASSIGNMENT_INVALID: 보호된(마감/대기/잠금/피처) 테이블 참가자는 재배치 대상이 아니에요.' USING ERRCODE = 'P0001';
  END IF;

  -- 9. 전원 비우기(풀 플레이어 현재 좌석 vacate → partial UNIQUE 충돌 회피)
  --    derangement(p1@s1→s2, p2@s2→s1) 시 중간 상태 없이 한 번에 비움.
  UPDATE public.ops_seats SET participant_id = NULL
    WHERE tournament_id = p_tournament_id AND participant_id = ANY(v_pids);

  -- 10. 목표 앉히기(9 이후라 풀 플레이어 좌석 미보유 → 단일점유 충돌 불가)
  FOR r IN
    SELECT (e->>'participant_id')::uuid AS pid, (e->>'seat_id')::uuid AS sid
      FROM jsonb_array_elements(p_assignments) e
  LOOP
    UPDATE public.ops_seats SET participant_id = r.pid WHERE id = r.sid;
  END LOOP;
  v_moved := v_n; -- 전원 비우고 다시 앉혔으므로 배정 수 = v_n

  -- 11. checked_in → active 승급
  WITH upd AS (
    UPDATE public.ops_participants SET status = 'active'
      WHERE tournament_id = p_tournament_id AND id = ANY(v_pids) AND status = 'checked_in'
      RETURNING 1
  )
  SELECT count(*) INTO v_seated FROM upd;

  -- 12. 이벤트 (컬럼명은 type — ops_events에 event_type 컬럼 없음)
  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (p_tournament_id, 'table_redraw', p_actor_id,
          jsonb_build_object('mode', p_mode, 'moved', v_moved, 'seated', v_seated));

  -- 13. 반환
  RETURN jsonb_build_object('moved', v_moved, 'seated', v_seated, 'mode', p_mode);
END;
$_$;


ALTER FUNCTION public.ops_reseat_participants(p_tournament_id uuid, p_actor_id uuid, p_assignments jsonb, p_mode text) OWNER TO postgres;

--
-- Name: ops_rotate_monitor_token(uuid, uuid, boolean); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.ops_rotate_monitor_token(p_tournament_id uuid, p_actor_id uuid, p_force boolean DEFAULT false) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_token text;
BEGIN
  IF auth.uid() IS NULL OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;
  PERFORM 1 FROM public.ops_tournaments WHERE id = p_tournament_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TOURNAMENT_NOT_FOUND: 대회를 찾을 수 없습니다 (%)', p_tournament_id USING ERRCODE = 'P0001';
  END IF;
  IF NOT (public.is_ops_member(p_tournament_id, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 관리 권한 없음' USING ERRCODE = 'P0001';
  END IF;

  SELECT monitor_token INTO v_token FROM public.ops_tournaments WHERE id = p_tournament_id;
  IF v_token IS NULL OR p_force THEN
    v_token := encode(gen_random_bytes(24), 'hex');
    UPDATE public.ops_tournaments SET monitor_token = v_token WHERE id = p_tournament_id;
  END IF;

  RETURN jsonb_build_object('tournamentId', p_tournament_id, 'monitorToken', v_token);
END;
$$;


ALTER FUNCTION public.ops_rotate_monitor_token(p_tournament_id uuid, p_actor_id uuid, p_force boolean) OWNER TO postgres;

--
-- Name: ops_set_blind_levels(uuid, uuid, jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.ops_set_blind_levels(p_tournament_id uuid, p_actor_id uuid, p_levels jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  a jsonb;
  v_sort int := 0;
  v_count int;
  v_cur_sort int;
  v_new_sort int;
  v_reanchored boolean := false;
BEGIN
  IF auth.uid() IS NULL OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;
  PERFORM 1 FROM public.ops_tournaments WHERE id = p_tournament_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TOURNAMENT_NOT_FOUND: 대회를 찾을 수 없습니다 (%)', p_tournament_id USING ERRCODE = 'P0001';
  END IF;
  IF NOT (public.is_ops_member(p_tournament_id, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 관리 권한 없음' USING ERRCODE = 'P0001';
  END IF;
  IF jsonb_typeof(p_levels) <> 'array' OR jsonb_array_length(p_levels) = 0 THEN
    RAISE EXCEPTION 'OPS_BLIND_LEVELS_INVALID: 블라인드 레벨이 비었습니다' USING ERRCODE = 'P0001';
  END IF;
  FOR a IN SELECT * FROM jsonb_array_elements(p_levels) LOOP
    IF COALESCE((a->>'duration_sec')::int, 0) <= 0 THEN
      RAISE EXCEPTION 'OPS_BLIND_LEVELS_INVALID: duration_sec 는 0보다 커야 합니다' USING ERRCODE = 'P0001';
    END IF;
    IF COALESCE((a->>'small_blind')::int, 0) < 0
       OR COALESCE((a->>'big_blind')::int, 0) < 0
       OR COALESCE((a->>'ante')::int, 0) < 0 THEN
      RAISE EXCEPTION 'OPS_BLIND_LEVELS_INVALID: 블라인드/안티는 음수 불가' USING ERRCODE = 'P0001';
    END IF;
  END LOOP;

  DELETE FROM public.ops_blind_levels WHERE tournament_id = p_tournament_id;
  FOR a IN SELECT * FROM jsonb_array_elements(p_levels) LOOP
    v_sort := v_sort + 1;
    INSERT INTO public.ops_blind_levels (
      tournament_id, level, small_blind, big_blind, ante, duration_sec, is_break, sort)
    VALUES (
      p_tournament_id,
      COALESCE((a->>'level')::int, v_sort),
      COALESCE((a->>'small_blind')::int, 0),
      COALESCE((a->>'big_blind')::int, 0),
      COALESCE((a->>'ante')::int, 0),
      (a->>'duration_sec')::int,
      COALESCE((a->>'is_break')::boolean, false),
      v_sort);
  END LOOP;
  v_count := v_sort;

  -- §0.5 B2: 교체 후 current_level_sort clamp [1, N]. 변하면 안전 재앵커.
  SELECT current_level_sort INTO v_cur_sort FROM public.ops_clock
    WHERE tournament_id = p_tournament_id FOR UPDATE;
  IF v_cur_sort IS NOT NULL THEN
    v_new_sort := LEAST(GREATEST(v_cur_sort, 1), v_count);
    IF v_new_sort IS DISTINCT FROM v_cur_sort THEN
      UPDATE public.ops_clock SET
        current_level_sort   = v_new_sort,
        level_started_at     = now(),
        is_running           = false,
        paused_remaining_sec = NULL
      WHERE tournament_id = p_tournament_id;
      v_reanchored := true;
    END IF;
  END IF;

  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (p_tournament_id, 'level_set', p_actor_id,
          jsonb_build_object('action', 'blind_levels_set', 'count', v_count, 'reanchored', v_reanchored));

  RETURN jsonb_build_object('tournament_id', p_tournament_id, 'count', v_count, 'reanchored', v_reanchored);
END;
$$;


ALTER FUNCTION public.ops_set_blind_levels(p_tournament_id uuid, p_actor_id uuid, p_levels jsonb) OWNER TO postgres;

--
-- Name: ops_set_prize_structure(uuid, uuid, jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.ops_set_prize_structure(p_tournament_id uuid, p_actor_id uuid, p_prizes jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $_$
DECLARE
  v_t_status public.ops_tournament_status;
  v_count int;
  v_distinct int;
  v_bad int;
BEGIN
  IF auth.uid() IS NULL
     OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;

  SELECT status INTO v_t_status FROM public.ops_tournaments
    WHERE id = p_tournament_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TOURNAMENT_NOT_FOUND: 대회를 찾을 수 없습니다 (%)', p_tournament_id
      USING ERRCODE = 'P0001';
  END IF;
  IF NOT (public.is_ops_member(p_tournament_id, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 관리 권한 없음' USING ERRCODE = 'P0001';
  END IF;
  IF v_t_status = 'completed' THEN
    RAISE EXCEPTION 'INVALID_STATUS: 종료된 대회의 상금 구조는 변경할 수 없습니다' USING ERRCODE = 'P0001';
  END IF;

  -- NULL 도 거부(jsonb_typeof(NULL)=NULL → NULL<>'array'=NULL 이라 array 가드만으론 통과해 silent clear).
  IF p_prizes IS NULL OR jsonb_typeof(p_prizes) <> 'array' THEN
    RAISE EXCEPTION 'PRIZE_STRUCTURE_INVALID: 상금 구조 형식이 올바르지 않습니다' USING ERRCODE = 'P0001';
  END IF;

  -- 신뢰경계 방어(golden #6): 캐스트(::int) 전에 rank·amount 가 양의 정수 텍스트인지 선검증.
  -- 비-숫자/소수/불리언/객체/누락 키가 아래 count(DISTINCT (e->>'rank')::int) 캐스트에서
  -- raw 22P02(친절 PRIZE_STRUCTURE_INVALID 경로 우회)로 누출되던 갭 차단.
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_prizes) e
    WHERE coalesce(e->>'rank', '') !~ '^[0-9]+$'
       OR coalesce(e->>'amount', '') !~ '^[0-9]+$'
  ) THEN
    RAISE EXCEPTION 'PRIZE_STRUCTURE_INVALID: 순위·금액은 양의 정수여야 합니다' USING ERRCODE = 'P0001';
  END IF;

  -- 위 선검증으로 rank·amount 는 모두 양의 정수 텍스트가 보장됨(::int 캐스트 안전).
  SELECT count(*),
         count(DISTINCT (e->>'rank')::int),
         count(*) FILTER (WHERE (e->>'rank')::int <= 0 OR (e->>'amount')::int < 1)
    INTO v_count, v_distinct, v_bad
    FROM jsonb_array_elements(p_prizes) e;
  IF v_bad > 0 OR v_count <> v_distinct THEN
    RAISE EXCEPTION 'PRIZE_STRUCTURE_INVALID: 순위·금액이 올바르지 않습니다(중복/0이하)' USING ERRCODE = 'P0001';
  END IF;

  DELETE FROM public.ops_prizes WHERE tournament_id = p_tournament_id;
  IF v_count > 0 THEN
    INSERT INTO public.ops_prizes (tournament_id, rank, amount)
    SELECT p_tournament_id, (e->>'rank')::int, (e->>'amount')::int
      FROM jsonb_array_elements(p_prizes) e;
  END IF;

  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (p_tournament_id, 'prize_structure_set', p_actor_id,
          jsonb_build_object('count', v_count));

  RETURN jsonb_build_object('tournament_id', p_tournament_id, 'count', v_count);
END;
$_$;


ALTER FUNCTION public.ops_set_prize_structure(p_tournament_id uuid, p_actor_id uuid, p_prizes jsonb) OWNER TO postgres;

--
-- Name: ops_set_table_lock(uuid, uuid, public.ops_table_lock_type); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.ops_set_table_lock(p_table_id uuid, p_actor_id uuid, p_lock_type public.ops_table_lock_type) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE v_tid uuid;
BEGIN
  IF auth.uid() IS NULL OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;
  SELECT tournament_id INTO v_tid FROM public.ops_tables WHERE id = p_table_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TABLE_NOT_FOUND: 테이블을 찾을 수 없습니다 (%)', p_table_id USING ERRCODE = 'P0001';
  END IF;
  IF NOT (public.is_ops_member(v_tid, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 관리 권한 없음' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.ops_tables SET lock_type = p_lock_type WHERE id = p_table_id;
  RETURN jsonb_build_object('table_id', p_table_id, 'lock_type', p_lock_type);
END;
$$;


ALTER FUNCTION public.ops_set_table_lock(p_table_id uuid, p_actor_id uuid, p_lock_type public.ops_table_lock_type) OWNER TO postgres;

--
-- Name: ops_set_table_priority(uuid, uuid, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.ops_set_table_priority(p_table_id uuid, p_actor_id uuid, p_priority integer) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE v_tid uuid;
BEGIN
  IF auth.uid() IS NULL OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;
  SELECT tournament_id INTO v_tid FROM public.ops_tables WHERE id = p_table_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TABLE_NOT_FOUND: 테이블을 찾을 수 없습니다 (%)', p_table_id USING ERRCODE = 'P0001';
  END IF;
  IF NOT (public.is_ops_member(v_tid, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 관리 권한 없음' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.ops_tables SET priority = p_priority WHERE id = p_table_id;
  RETURN jsonb_build_object('table_id', p_table_id, 'priority', p_priority);
END;
$$;


ALTER FUNCTION public.ops_set_table_priority(p_table_id uuid, p_actor_id uuid, p_priority integer) OWNER TO postgres;

--
-- Name: ops_set_tournament_posting(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.ops_set_tournament_posting(p_tournament_id uuid, p_actor_id uuid, p_job_posting_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_t  public.ops_tournaments%ROWTYPE;
  v_jp public.job_postings%ROWTYPE;
  v_old uuid;
BEGIN
  IF auth.uid() IS NULL OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 본인 계정으로만 호출할 수 있습니다' USING ERRCODE = 'P0001';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('ops_tournament_' || p_tournament_id::text)::bigint);

  SELECT * INTO v_t FROM public.ops_tournaments WHERE id = p_tournament_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TOURNAMENT_NOT_FOUND: 대회를 찾을 수 없습니다' USING ERRCODE = 'P0001';
  END IF;

  -- 연결 변경은 owner 전용(is_ops_member의 워크스페이스 분기를 바꾸는 조작)
  IF v_t.owner_id IS DISTINCT FROM p_actor_id AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 소유자만 공고 연결을 변경할 수 있습니다' USING ERRCODE = 'P0001';
  END IF;

  IF p_job_posting_id IS NOT NULL THEN
    SELECT * INTO v_jp FROM public.job_postings WHERE id = p_job_posting_id;
    -- ops_create_tournament의 공고 게이트(20260625120200:43-57)와 동일 조건
    IF NOT FOUND OR NOT (
      v_jp.owner_id = p_actor_id
      OR public.is_workspace_member(v_jp.workspace_id, p_actor_id)
      OR public.is_admin()
    ) THEN
      RAISE EXCEPTION 'POSTING_NOT_FOUND: 공고를 찾을 수 없거나 접근 권한이 없습니다' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  v_old := v_t.job_posting_id;
  IF v_old IS NOT DISTINCT FROM p_job_posting_id THEN
    RETURN jsonb_build_object('tournamentId', p_tournament_id, 'jobPostingId', p_job_posting_id);
  END IF;

  UPDATE public.ops_tournaments SET job_posting_id = p_job_posting_id WHERE id = p_tournament_id;

  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (
    p_tournament_id,
    CASE WHEN p_job_posting_id IS NULL
      THEN 'posting_unlinked'::public.ops_event_type
      ELSE 'posting_linked'::public.ops_event_type END,
    p_actor_id,
    jsonb_build_object('old_posting_id', v_old, 'new_posting_id', p_job_posting_id)
  );

  RETURN jsonb_build_object('tournamentId', p_tournament_id, 'jobPostingId', p_job_posting_id);
END;
$$;


ALTER FUNCTION public.ops_set_tournament_posting(p_tournament_id uuid, p_actor_id uuid, p_job_posting_id uuid) OWNER TO postgres;

--
-- Name: ops_set_tournament_status(uuid, uuid, public.ops_tournament_status); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.ops_set_tournament_status(p_tournament_id uuid, p_actor_id uuid, p_status public.ops_tournament_status) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_current ops_tournament_status;
BEGIN
  IF auth.uid() IS NULL
     OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;

  SELECT status INTO v_current FROM public.ops_tournaments
    WHERE id = p_tournament_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TOURNAMENT_NOT_FOUND: 대회를 찾을 수 없습니다 (%)', p_tournament_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT (public.is_ops_member(p_tournament_id, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 관리 권한 없음' USING ERRCODE = 'P0001';
  END IF;

  -- 합법 전이: upcoming→active, active→completed, active→upcoming(되돌리기), upcoming→completed(취소).
  IF NOT (
    (v_current = 'upcoming' AND p_status IN ('active', 'completed'))
    OR (v_current = 'active' AND p_status IN ('completed', 'upcoming'))
  ) THEN
    RAISE EXCEPTION 'INVALID_STATUS: % → % 전이 불가', v_current, p_status
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.ops_tournaments SET status = p_status WHERE id = p_tournament_id;

  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (p_tournament_id, 'tournament_status_changed', p_actor_id,
          jsonb_build_object('from', v_current, 'to', p_status));

  RETURN jsonb_build_object('tournament_id', p_tournament_id, 'status', p_status);
END;
$$;


ALTER FUNCTION public.ops_set_tournament_status(p_tournament_id uuid, p_actor_id uuid, p_status public.ops_tournament_status) OWNER TO postgres;

--
-- Name: ops_toggle_registration(uuid, uuid, boolean); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.ops_toggle_registration(p_tournament_id uuid, p_actor_id uuid, p_open boolean) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL
     OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;

  SELECT id INTO v_id FROM public.ops_tournaments
    WHERE id = p_tournament_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TOURNAMENT_NOT_FOUND: 대회를 찾을 수 없습니다 (%)', p_tournament_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT (public.is_ops_member(p_tournament_id, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 관리 권한 없음' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.ops_tournaments SET registration_open = p_open WHERE id = p_tournament_id;

  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (p_tournament_id, 'registration_toggled', p_actor_id,
          jsonb_build_object('open', p_open));

  RETURN jsonb_build_object('tournament_id', p_tournament_id, 'registration_open', p_open);
END;
$$;


ALTER FUNCTION public.ops_toggle_registration(p_tournament_id uuid, p_actor_id uuid, p_open boolean) OWNER TO postgres;

--
-- Name: ops_unclaim_participant(uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.ops_unclaim_participant(p_participant_id uuid, p_actor_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_tid uuid;
BEGIN
  IF auth.uid() IS NULL OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;
  SELECT tournament_id INTO v_tid
    FROM public.ops_participants WHERE id = p_participant_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PARTICIPANT_NOT_FOUND: 참가자를 찾을 수 없습니다 (%)', p_participant_id USING ERRCODE = 'P0001';
  END IF;
  IF NOT (public.is_ops_member(v_tid, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 관리 권한 없음' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.ops_participants SET player_user_id = NULL WHERE id = p_participant_id;
  RETURN jsonb_build_object('participantId', p_participant_id, 'unclaimed', true);
END;
$$;


ALTER FUNCTION public.ops_unclaim_participant(p_participant_id uuid, p_actor_id uuid) OWNER TO postgres;

--
-- Name: ops_undo_bust(uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.ops_undo_bust(p_participant_id uuid, p_actor_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_tournament_id uuid;
  v_t_status public.ops_tournament_status;
  v_status public.ops_participant_status;
  v_payload jsonb;
  v_chips_before int;
  v_elim_id uuid;
  v_bust_seat_id uuid;
  v_seat_id uuid;
  v_seat_restored text;
  v_new_status public.ops_participant_status;
  v_seated boolean;
  v_table_no int;
  v_seat_no int;
BEGIN
  -- 1) actor 가드
  IF auth.uid() IS NULL
     OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;

  -- 2) tournament_id 선취(비잠금)
  SELECT tournament_id INTO v_tournament_id
    FROM public.ops_participants WHERE id = p_participant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PARTICIPANT_NOT_FOUND: 참가자를 찾을 수 없습니다 (%)', p_participant_id
      USING ERRCODE = 'P0001';
  END IF;

  -- 3) 멤버십 [🔨H1: status 검사·advisory 보다 먼저 — 1d 3종·bust v2 와 동일 순서.
  --    비멤버가 INVALID_STATUS/PERMISSION_DENIED 차등으로 대회 status 를 판별하는 오라클 차단 +
  --    비멤버는 advisory·행 잠금을 점유하지 않음]
  IF NOT (public.is_ops_member(v_tournament_id, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 관리 권한 없음' USING ERRCODE = 'P0001';
  END IF;

  -- 4) advisory → 대회 FOR UPDATE + active 한정(D2 — 우승확정 후 completed 면 여기서 차단)
  PERFORM pg_advisory_xact_lock(hashtext('ops_tournament_' || v_tournament_id::text)::bigint);
  SELECT status INTO v_t_status FROM public.ops_tournaments
    WHERE id = v_tournament_id FOR UPDATE;
  IF v_t_status <> 'active' THEN
    RAISE EXCEPTION 'INVALID_STATUS: 진행 중 대회에서만 탈락 취소가 가능합니다 (status=%)', v_t_status
      USING ERRCODE = 'P0001';
  END IF;

  -- 5) 복원 소스 = 최신 player_busted 이벤트(무잠금 조회 — append-only 불변).
  --    bust→reenter→재bust 이력에서도 "현재 busted = 최신 bust 이벤트" 대응 성립.
  --    [🔨H11] 정렬은 seq(IDENTITY 전순서) — created_at 은 now()=txn 시작 고정이라 동률 비결정.
  SELECT payload INTO v_payload FROM public.ops_events
    WHERE tournament_id = v_tournament_id AND type = 'player_busted'
      AND (payload->>'participant_id')::uuid = p_participant_id
    ORDER BY seq DESC LIMIT 1;
  v_chips_before := COALESCE((v_payload->>'chips_before')::int, 0);  -- E2 fail-safe(구 payload/이론상 부재)
  v_elim_id      := (v_payload->>'eliminator_id')::uuid;
  v_bust_seat_id := (v_payload->>'freed_seat_id')::uuid;

  -- 6) 참가자(+eliminator) id 오름차순 FOR UPDATE(4.1 규약) → busted 검사
  IF v_elim_id IS NOT NULL AND v_elim_id <> p_participant_id THEN
    PERFORM 1 FROM public.ops_participants
      WHERE id IN (p_participant_id, v_elim_id)
      ORDER BY id FOR UPDATE;
  END IF;
  SELECT status INTO v_status
    FROM public.ops_participants WHERE id = p_participant_id FOR UPDATE;
  IF v_status <> 'busted' THEN
    RAISE EXCEPTION 'UNDO_INVALID_STATE: 탈락 상태의 참가자만 취소할 수 있습니다 (status=%)', v_status
      USING ERRCODE = 'P0001';
  END IF;

  -- 7) KO 롤백 — GREATEST 0(CHECK 위반 방어). eliminator 가 그 사이 busted 여도 카운트만 감소(정합).
  IF v_elim_id IS NOT NULL THEN
    UPDATE public.ops_participants
      SET knockouts = GREATEST(knockouts - 1, 0) WHERE id = v_elim_id;
  END IF;

  -- 8) 좌석 3분기: ①원좌석(존재·비점유·open·unlocked) ②auto-seat(빈좌석 첫 자리 —
  --    auto_seat_on_register 설정과 무관하게 항상 시도: undo 는 "물리적으로 앉아 있던 사람"의 복구)
  --    ③빈좌석 없으면 무좌석. SKIP LOCKED = reenter 와 동일 패턴(경합 시 다음 분기 폴백).
  v_seat_id := NULL;
  v_seat_restored := 'none';
  IF v_bust_seat_id IS NOT NULL THEN
    SELECT s.id INTO v_seat_id
      FROM public.ops_seats s
      JOIN public.ops_tables t ON t.id = s.table_id
      WHERE s.id = v_bust_seat_id AND s.tournament_id = v_tournament_id
        AND s.participant_id IS NULL
        AND t.status = 'open' AND t.lock_type = 'none'
      FOR UPDATE OF s SKIP LOCKED;
    IF v_seat_id IS NOT NULL THEN
      v_seat_restored := 'original';
    END IF;
  END IF;
  IF v_seat_id IS NULL THEN
    SELECT s.id INTO v_seat_id
      FROM public.ops_seats s
      JOIN public.ops_tables t ON t.id = s.table_id
      WHERE s.tournament_id = v_tournament_id
        AND s.participant_id IS NULL
        AND t.status = 'open' AND t.lock_type = 'none'
      ORDER BY s.table_no, s.seat_no
      LIMIT 1 FOR UPDATE OF s SKIP LOCKED;
    IF v_seat_id IS NOT NULL THEN
      v_seat_restored := 'auto';
    END IF;
  END IF;
  v_seated := v_seat_id IS NOT NULL;
  v_new_status := CASE WHEN v_seated THEN 'active'::public.ops_participant_status
                       ELSE 'checked_in'::public.ops_participant_status END;

  -- 9) 참가자 복원
  UPDATE public.ops_participants
    SET status = v_new_status, chips = v_chips_before,
        finish_position = NULL, busted_at = NULL, prize_amount = NULL
    WHERE id = p_participant_id;

  IF v_seated THEN
    UPDATE public.ops_seats SET participant_id = p_participant_id WHERE id = v_seat_id;
    SELECT table_no, seat_no INTO v_table_no, v_seat_no
      FROM public.ops_seats WHERE id = v_seat_id;
  END IF;

  -- 10) 이벤트 + 반환
  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (v_tournament_id, 'player_bust_undone', p_actor_id,
          jsonb_build_object('participant_id', p_participant_id,
                             'restored_chips', v_chips_before,
                             'eliminator_id', v_elim_id,
                             'seat_restored', v_seat_restored));

  RETURN jsonb_build_object(
    'participant_id', p_participant_id,
    'restored_chips', v_chips_before,
    'status', v_new_status,
    'seated', v_seated,
    'table_no', v_table_no,
    'seat_no', v_seat_no);
END;
$$;


ALTER FUNCTION public.ops_undo_bust(p_participant_id uuid, p_actor_id uuid) OWNER TO postgres;

--
-- Name: ops_update_tournament(uuid, uuid, jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.ops_update_tournament(p_tournament_id uuid, p_actor_id uuid, p_patch jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL
     OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;

  SELECT id INTO v_id FROM public.ops_tournaments
    WHERE id = p_tournament_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TOURNAMENT_NOT_FOUND: 대회를 찾을 수 없습니다 (%)', p_tournament_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT (public.is_ops_member(p_tournament_id, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 관리 권한 없음' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.ops_tournaments SET
    name            = COALESCE(p_patch->>'name', name),
    venue           = COALESCE(p_patch->>'venue', venue),
    event_date      = COALESCE((p_patch->>'event_date')::date, event_date),
    game_type       = COALESCE(p_patch->>'game_type', game_type),
    starting_chips  = COALESCE((p_patch->>'starting_chips')::int, starting_chips),
    seats_per_table = COALESCE((p_patch->>'seats_per_table')::int, seats_per_table),
    buy_in_chips    = COALESCE((p_patch->>'buy_in_chips')::int, buy_in_chips),
    rebuy_chips     = COALESCE((p_patch->>'rebuy_chips')::int, rebuy_chips),
    addon_chips     = COALESCE((p_patch->>'addon_chips')::int, addon_chips),
    buy_in_cost     = COALESCE((p_patch->>'buy_in_cost')::int, buy_in_cost),
    fee_cost        = COALESCE((p_patch->>'fee_cost')::int, fee_cost),
    rebuy_cost      = COALESCE((p_patch->>'rebuy_cost')::int, rebuy_cost),
    addon_cost      = COALESCE((p_patch->>'addon_cost')::int, addon_cost),
    -- [1f] bounty_cost 만 key-presence 분기: COALESCE 패치로는 NULL 되돌리기(비-바운티 전환) 불가.
    bounty_cost     = CASE WHEN p_patch ? 'bounty_cost'
                           THEN (p_patch->>'bounty_cost')::int
                           ELSE bounty_cost END,
    color           = COALESCE(p_patch->>'color', color)
  WHERE id = p_tournament_id;

  RETURN jsonb_build_object('tournament_id', p_tournament_id);
END;
$$;


ALTER FUNCTION public.ops_update_tournament(p_tournament_id uuid, p_actor_id uuid, p_patch jsonb) OWNER TO postgres;

--
-- Name: permanently_delete_user(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.permanently_delete_user(p_user_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
DECLARE
  v_user record; v_deleted_apps int; v_deleted_wlogs int; v_deleted_notifs int;
BEGIN
  IF auth.uid() IS NULL
     OR (auth.uid() IS DISTINCT FROM p_user_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 본인 또는 관리자만 삭제 가능';
  END IF;

  SELECT * INTO v_user FROM public.users WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'USER_NOT_FOUND: %', p_user_id; END IF;

  UPDATE public.applications SET
    applicant_name = '[deleted]', applicant_nickname = NULL, applicant_phone = NULL,
    applicant_email = NULL, applicant_photo_url = NULL, updated_at = now()
  WHERE applicant_id = p_user_id;
  GET DIAGNOSTICS v_deleted_apps = ROW_COUNT;

  UPDATE public.work_logs SET
    staff_name = '[deleted]', staff_nickname = NULL, staff_photo_url = NULL, updated_at = now()
  WHERE staff_id = p_user_id;
  GET DIAGNOSTICS v_deleted_wlogs = ROW_COUNT;

  UPDATE public.work_logs SET owner_id = NULL, updated_at = now() WHERE owner_id = p_user_id;

  UPDATE public.job_postings SET
    status = 'closed', closed_at = now(), closed_reason = 'owner_deleted', owner_id = NULL, updated_at = now()
  WHERE owner_id = p_user_id AND status = 'active';
  UPDATE public.job_postings SET owner_id = NULL, updated_at = now() WHERE owner_id = p_user_id;

  UPDATE public.announcements SET author_id = NULL WHERE author_id = p_user_id;
  UPDATE public.board_posts SET author_id = NULL WHERE author_id = p_user_id;
  UPDATE public.board_comments SET author_id = NULL WHERE author_id = p_user_id;
  DELETE FROM public.board_votes WHERE user_id = p_user_id;
  UPDATE public.board_reports SET reporter_id = NULL WHERE reporter_id = p_user_id;
  DELETE FROM public.event_qr_codes WHERE user_id = p_user_id;
  UPDATE public.inquiries SET user_id = NULL WHERE user_id = p_user_id;
  UPDATE public.reports SET reporter_id = NULL WHERE reporter_id = p_user_id;
  UPDATE public.reviews SET reviewer_id = NULL, reviewer_name = '[deleted]' WHERE reviewer_id = p_user_id;
  UPDATE public.reviews SET reviewee_id = NULL, reviewee_name = '[deleted]' WHERE reviewee_id = p_user_id;
  DELETE FROM public.notifications WHERE recipient_id = p_user_id;
  GET DIAGNOSTICS v_deleted_notifs = ROW_COUNT;
  DELETE FROM public.notification_settings WHERE user_id = p_user_id;
  DELETE FROM public.users WHERE id = p_user_id;
  DELETE FROM auth.users WHERE id = p_user_id;

  RETURN jsonb_build_object('success', true, 'anonymizedApplications', v_deleted_apps,
    'anonymizedWorkLogs', v_deleted_wlogs, 'deletedNotifications', v_deleted_notifs);
END;
$$;


ALTER FUNCTION public.permanently_delete_user(p_user_id uuid) OWNER TO postgres;

--
-- Name: prevent_role_self_escalation(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.prevent_role_self_escalation() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF OLD.role = NEW.role THEN RETURN NEW; END IF;
  IF public.is_admin() THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'ROLE_CHANGE_DENIED: 역할 변경은 전용 API를 통해서만 가능합니다';
END;
$$;


ALTER FUNCTION public.prevent_role_self_escalation() OWNER TO postgres;

--
-- Name: process_qr_checkin_atomically(uuid, uuid, uuid, text, timestamp with time zone, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.process_qr_checkin_atomically(p_work_log_id uuid, p_staff_id uuid, p_job_posting_id uuid, p_action text, p_check_time timestamp with time zone DEFAULT now(), p_expected_date text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_work_log work_logs%ROWTYPE;
  v_job_posting_status text;
  v_check_time timestamptz;
  v_now text;
  v_work_duration numeric := 0;
  v_duration_minutes numeric;
  v_action text;
BEGIN
  IF auth.uid() IS NULL
     OR (auth.uid() IS DISTINCT FROM p_staff_id AND NOT public.is_admin()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  -- [P1#7] 클라 시각 클램프: NULL 또는 서버 시각과 5분 초과 편차 → 서버 now() 사용
  v_check_time := CASE
    WHEN p_check_time IS NULL
      OR abs(EXTRACT(EPOCH FROM (p_check_time - now()))) > 300 THEN now()
    ELSE p_check_time
  END;
  v_now := to_char(v_check_time AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');

  SELECT * INTO v_work_log FROM work_logs WHERE id = p_work_log_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'work_log_not_found'); END IF;

  SELECT status INTO v_job_posting_status FROM job_postings WHERE id = p_job_posting_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'job_posting_not_found'); END IF;

  IF v_work_log.staff_id IS DISTINCT FROM p_staff_id THEN RETURN jsonb_build_object('success', false, 'error', 'staff_id_mismatch'); END IF;
  IF v_work_log.job_posting_id IS DISTINCT FROM p_job_posting_id THEN RETURN jsonb_build_object('success', false, 'error', 'job_posting_id_mismatch'); END IF;
  IF p_expected_date IS NOT NULL AND COALESCE(v_work_log.is_fixed_posting, false) = false AND v_work_log.date IS DISTINCT FROM p_expected_date THEN RETURN jsonb_build_object('success', false, 'error', 'date_mismatch'); END IF;
  IF v_job_posting_status::text NOT IN ('active', 'container') THEN RETURN jsonb_build_object('success', false, 'error', 'job_posting_inactive'); END IF;
  IF v_work_log.payroll_status::text = 'completed' THEN RETURN jsonb_build_object('success', false, 'error', 'already_settled'); END IF;

  v_action := p_action;
  IF v_action = 'auto' THEN
    IF v_work_log.status::text = 'checked_in' THEN
      v_action := 'checkOut';
    ELSE
      v_action := 'checkIn';
    END IF;
  END IF;

  IF v_action = 'checkIn' THEN
    IF v_work_log.status::text IN ('checked_in', 'checked_out') THEN RETURN jsonb_build_object('success', false, 'error', 'already_checked_in'); END IF;
    UPDATE work_logs SET status = 'checked_in', check_in_ts = v_check_time, updated_at = v_check_time WHERE id = p_work_log_id;
    RETURN jsonb_build_object('success', true, 'action', 'checkIn', 'check_in_time', v_now, 'work_duration', 0);
  ELSIF v_action = 'checkOut' THEN
    IF v_work_log.status::text != 'checked_in' THEN RETURN jsonb_build_object('success', false, 'error', 'not_checked_in'); END IF;
    IF v_work_log.check_in_ts IS NOT NULL THEN
      v_duration_minutes := EXTRACT(EPOCH FROM (v_check_time - v_work_log.check_in_ts)) / 60;
      v_work_duration := GREATEST(0, ROUND((v_duration_minutes / 60)::numeric * 100) / 100);
    END IF;
    UPDATE work_logs SET
      status = 'checked_out',
      check_out_ts = v_check_time,
      clocked_out_raw = COALESCE(v_work_log.clocked_out_raw, v_check_time),
      end_time_source = 'qr',
      work_duration = v_work_duration,
      updated_at = v_check_time
    WHERE id = p_work_log_id;
    RETURN jsonb_build_object('success', true, 'action', 'checkOut', 'check_out_time', v_now, 'work_duration', v_work_duration);
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'invalid_action');
  END IF;
END;
$$;


ALTER FUNCTION public.process_qr_checkin_atomically(p_work_log_id uuid, p_staff_id uuid, p_job_posting_id uuid, p_action text, p_check_time timestamp with time zone, p_expected_date text) OWNER TO postgres;

--
-- Name: FUNCTION process_qr_checkin_atomically(p_work_log_id uuid, p_staff_id uuid, p_job_posting_id uuid, p_action text, p_check_time timestamp with time zone, p_expected_date text); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.process_qr_checkin_atomically(p_work_log_id uuid, p_staff_id uuid, p_job_posting_id uuid, p_action text, p_check_time timestamp with time zone, p_expected_date text) IS 'QR check-in/out 원자화 RPC. 라이브 본문 보존 + 컨테이너 공고 허용 + auto 분기 + clocked_out_raw 원본보존/end_time_source=qr (주간 배치 그리드 S5/R4).';


--
-- Name: protect_work_log_payroll_columns(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.protect_work_log_payroll_columns() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_role text;
BEGIN
  -- service_role (Postgres role)은 모든 변경 허용 (서버 사이드 RPC/Edge Function)
  IF current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- 앱 권한 (app_metadata.role): admin / employer 허용
  v_role := coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '');

  IF v_role IN ('admin', 'employer') THEN
    RETURN NEW;
  END IF;

  -- staff (또는 기타): payroll 관련 컬럼 변경 시 예외 발생
  IF (OLD.payroll_amount IS DISTINCT FROM NEW.payroll_amount)
     OR (OLD.payroll_status IS DISTINCT FROM NEW.payroll_status)
     OR (OLD.payroll_date   IS DISTINCT FROM NEW.payroll_date)
     OR (OLD.payroll_notes  IS DISTINCT FROM NEW.payroll_notes) THEN
    RAISE EXCEPTION 'staff_cannot_modify_payroll_fields'
      USING ERRCODE = '42501', -- insufficient_privilege
            DETAIL  = 'payroll_amount / payroll_status / payroll_date / payroll_notes 컬럼은 staff가 직접 변경할 수 없습니다.';
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION public.protect_work_log_payroll_columns() OWNER TO postgres;

--
-- Name: FUNCTION protect_work_log_payroll_columns(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.protect_work_log_payroll_columns() IS 'T-E5: staff 권한의 work_logs payroll 컬럼 직접 수정 차단. employer/admin/service_role은 허용.';


--
-- Name: register_as_employer(jsonb, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.register_as_employer(p_employer_agreements jsonb DEFAULT NULL::jsonb, p_intro text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user         RECORD;
  v_app_id       UUID;
  v_supersedes   UUID;
  v_now          TIMESTAMPTZ := now();
BEGIN
  -- 현재 사용자 조회
  SELECT * INTO v_user FROM users WHERE id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'USER_NOT_FOUND: 사용자를 찾을 수 없습니다';
  END IF;

  -- staff → employer 신청만 허용 (admin 상승 차단)
  IF v_user.role != 'staff' THEN
    RAISE EXCEPTION 'INVALID_ROLE_TRANSITION: 현재 역할 %, staff만 구인자 신청 가능', v_user.role;
  END IF;

  -- 동일 유저 pending 중복 신청 차단
  IF EXISTS (
    SELECT 1 FROM employer_applications
    WHERE user_id = auth.uid() AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'EMPLOYER_APP_PENDING_EXISTS: 이미 심사 중인 신청이 있습니다';
  END IF;

  -- 재신청 체인: 직전 거부된 신청 ID 조회
  SELECT id INTO v_supersedes
  FROM employer_applications
  WHERE user_id = auth.uid()
    AND status = 'rejected'
  ORDER BY created_at DESC
  LIMIT 1;

  -- 신청 INSERT (intro + supersedes_id 포함)
  INSERT INTO employer_applications (
    user_id,
    status,
    submitted_at,
    agreements_snapshot,
    intro,
    supersedes_id,
    created_at
  ) VALUES (
    auth.uid(),
    'pending',
    v_now,
    COALESCE(p_employer_agreements, '{}'::JSONB),
    p_intro,
    v_supersedes,
    v_now
  )
  RETURNING id INTO v_app_id;

  RETURN jsonb_build_object(
    'success',       true,
    'applicationId', v_app_id,
    'status',        'pending',
    'submittedAt',   v_now,
    'supersedesId',  v_supersedes
  );
END;
$$;


ALTER FUNCTION public.register_as_employer(p_employer_agreements jsonb, p_intro text) OWNER TO postgres;

--
-- Name: reject_employer_application(uuid, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.reject_employer_application(p_app_id uuid, p_reason text DEFAULT NULL::text, p_category text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_app      RECORD;
  v_affected INT;
  v_now      TIMESTAMPTZ := now();
BEGIN
  IF (auth.jwt() -> 'app_metadata' ->> 'role') IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'UNAUTHORIZED: 관리자 권한이 필요합니다';
  END IF;

  SELECT * INTO v_app FROM employer_applications WHERE id = p_app_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'EMPLOYER_APP_NOT_FOUND: 신청 내역을 찾을 수 없습니다';
  END IF;

  IF v_app.user_id IS NOT DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'EMPLOYER_APP_SELF_APPROVE: 본인 신청을 직접 처리할 수 없습니다';
  END IF;

  IF p_category IS NOT NULL AND p_category NOT IN ('duplicate', 'dummy', 'identity_mismatch', 'other') THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: 유효하지 않은 rejection_category: %', p_category;
  END IF;

  UPDATE employer_applications
  SET
    status = 'rejected', reviewed_at = v_now, reviewed_by = auth.uid(),
    rejection_reason = p_reason, rejection_category = p_category
  WHERE id = p_app_id AND status = 'pending';

  GET DIAGNOSTICS v_affected = ROW_COUNT;

  IF v_affected = 0 THEN
    RAISE EXCEPTION 'EMPLOYER_APP_ALREADY_PROCESSED: 이미 처리된 신청입니다';
  END IF;

  RETURN jsonb_build_object(
    'success', true, 'applicationId', p_app_id,
    'userId', v_app.user_id, 'reviewedAt', v_now
  );
END;
$$;


ALTER FUNCTION public.reject_employer_application(p_app_id uuid, p_reason text, p_category text) OWNER TO postgres;

--
-- Name: reject_workspace_invitation(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.reject_workspace_invitation(p_invitation_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_inv record;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_inv FROM public.workspace_invitations WHERE id = p_invitation_id FOR UPDATE;
  IF v_inv IS NULL THEN
    RAISE EXCEPTION 'INVITATION_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF v_inv.invitee_user_id != v_caller_id THEN
    RAISE EXCEPTION 'PERMISSION_DENIED' USING ERRCODE = '42501';
  END IF;

  -- 멱등성: 이미 rejected 면 noop
  IF v_inv.status = 'rejected' THEN
    RETURN;
  END IF;

  IF v_inv.status != 'pending' THEN
    RAISE EXCEPTION 'INVITATION_%', upper(v_inv.status) USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.workspace_invitations
    SET status = 'rejected', responded_at = now()
    WHERE id = p_invitation_id;
END;
$$;


ALTER FUNCTION public.reject_workspace_invitation(p_invitation_id uuid) OWNER TO postgres;

--
-- Name: remove_direct_staff(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.remove_direct_staff(p_work_log_id uuid) RETURNS jsonb
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
    v_job.owner_id = v_owner
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


ALTER FUNCTION public.remove_direct_staff(p_work_log_id uuid) OWNER TO postgres;

--
-- Name: FUNCTION remove_direct_staff(p_work_log_id uuid); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.remove_direct_staff(p_work_log_id uuid) IS '직접추가 스태프(application_id NULL) 삭제 + person-basis filled -1(컨테이너는 E7 대칭 SKIP) + capacity_full/closed→active 재개방.';


--
-- Name: remove_workspace_member(uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.remove_workspace_member(p_workspace_id uuid, p_user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_owner_id uuid;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
  END IF;

  SELECT owner_id INTO v_owner_id FROM public.workspaces WHERE id = p_workspace_id FOR SHARE;
  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'WORKSPACE_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF v_owner_id != v_caller_id THEN
    RAISE EXCEPTION 'PERMISSION_DENIED' USING ERRCODE = '42501';
  END IF;

  IF p_user_id = v_owner_id THEN
    RAISE EXCEPTION 'CANNOT_REMOVE_OWNER' USING ERRCODE = 'P0001';
  END IF;

  -- 멱등성: row 없으면 noop
  DELETE FROM public.workspace_members
    WHERE workspace_id = p_workspace_id AND user_id = p_user_id;
END;
$$;


ALTER FUNCTION public.remove_workspace_member(p_workspace_id uuid, p_user_id uuid) OWNER TO postgres;

--
-- Name: reset_unread_counter(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.reset_unread_counter(p_user_id uuid) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  UPDATE public.notifications SET is_read = TRUE, read_at = now()
  WHERE recipient_id = p_user_id AND is_read = FALSE;
$$;


ALTER FUNCTION public.reset_unread_counter(p_user_id uuid) OWNER TO postgres;

--
-- Name: restore_workspace(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.restore_workspace(p_workspace_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_owner_id uuid;
  v_archived_at timestamptz;
  v_active_count int;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
  END IF;

  SELECT owner_id, archived_at INTO v_owner_id, v_archived_at
  FROM public.workspaces WHERE id = p_workspace_id FOR UPDATE;

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'WORKSPACE_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF v_owner_id != v_caller_id THEN
    RAISE EXCEPTION 'PERMISSION_DENIED' USING ERRCODE = '42501';
  END IF;

  IF v_archived_at IS NULL THEN
    RETURN;
  END IF;

  SELECT count(*)::int INTO v_active_count
  FROM public.workspaces
  WHERE owner_id = v_caller_id AND archived_at IS NULL;

  IF v_active_count >= 10 THEN
    RAISE EXCEPTION 'WORKSPACE_CAP_REACHED' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.workspaces SET archived_at = NULL WHERE id = p_workspace_id;
END;
$$;


ALTER FUNCTION public.restore_workspace(p_workspace_id uuid) OWNER TO postgres;

--
-- Name: FUNCTION restore_workspace(p_workspace_id uuid); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.restore_workspace(p_workspace_id uuid) IS '워크스페이스 복원. owner 전용. 활성 cap(10) 재검사. 멱등. 2026-05-24.';


--
-- Name: review_report(uuid, text, uuid, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.review_report(p_report_id uuid, p_status text, p_reviewer_id uuid, p_reviewer_notes text DEFAULT ''::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_caller_role     text;
  v_current_status  text;
BEGIN
  v_caller_role := auth.jwt() -> 'app_metadata' ->> 'role';
  IF v_caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'FORBIDDEN: admin 권한이 필요합니다 (caller role: %)',
      COALESCE(v_caller_role, 'null')
      USING ERRCODE = 'P0001';
  END IF;

  IF p_status NOT IN ('reviewed', 'resolved', 'dismissed') THEN
    RAISE EXCEPTION 'INVALID_STATUS: 유효하지 않은 처리 상태 (%)', p_status
      USING ERRCODE = 'P0001';
  END IF;

  SELECT status INTO v_current_status
    FROM public.reports
    WHERE id = p_report_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'REPORT_NOT_FOUND: 신고를 찾을 수 없습니다 (%)', p_report_id
      USING ERRCODE = 'P0001';
  END IF;

  IF v_current_status IN ('resolved', 'dismissed') THEN
    RAISE EXCEPTION 'REPORT_ALREADY_REVIEWED: 이미 처리된 신고입니다 (status=%)',
      v_current_status
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.reports
    SET status         = p_status,
        reviewer_id    = p_reviewer_id::text,
        reviewer_notes = NULLIF(p_reviewer_notes, ''),
        reviewed_at    = now(),
        updated_at     = now()
    WHERE id = p_report_id;
END;
$$;


ALTER FUNCTION public.review_report(p_report_id uuid, p_status text, p_reviewer_id uuid, p_reviewer_notes text) OWNER TO postgres;

--
-- Name: FUNCTION review_report(p_report_id uuid, p_status text, p_reviewer_id uuid, p_reviewer_notes text); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.review_report(p_report_id uuid, p_status text, p_reviewer_id uuid, p_reviewer_notes text) IS '관리자 전용 신고 처리 RPC. app_metadata.role=admin 필요. pending/reviewed → reviewed/resolved/dismissed 전이 허용, 종결(resolved/dismissed) 건은 REPORT_ALREADY_REVIEWED. reviewer_id/reviewer_notes/reviewed_at 은 마지막 처리 기준 덮어쓰기.';


--
-- Name: revoke_workspace_invitation(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.revoke_workspace_invitation(p_invitation_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_inv record;
  v_owner_id uuid;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_inv FROM public.workspace_invitations WHERE id = p_invitation_id FOR UPDATE;
  IF v_inv IS NULL THEN
    RAISE EXCEPTION 'INVITATION_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  SELECT owner_id INTO v_owner_id FROM public.workspaces WHERE id = v_inv.workspace_id;
  IF v_owner_id != v_caller_id THEN
    RAISE EXCEPTION 'PERMISSION_DENIED' USING ERRCODE = '42501';
  END IF;

  -- 멱등성
  IF v_inv.status = 'revoked' THEN
    RETURN;
  END IF;

  IF v_inv.status != 'pending' THEN
    RAISE EXCEPTION 'INVITATION_%', upper(v_inv.status) USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.workspace_invitations
    SET status = 'revoked', responded_at = now()
    WHERE id = p_invitation_id;
END;
$$;


ALTER FUNCTION public.revoke_workspace_invitation(p_invitation_id uuid) OWNER TO postgres;

--
-- Name: rls_auto_enable(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.rls_auto_enable() RETURNS event_trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION public.rls_auto_enable() OWNER TO postgres;

--
-- Name: search_users_by_phone(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.search_users_by_phone(p_phone text) RETURNS TABLE(id uuid, name text, nickname text, phone text, photo_url text, photo_url_blurhash text, region text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_norm text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 인증이 필요합니다';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role IN ('employer', 'admin') AND u.is_active = true
  ) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 구인자만 사용할 수 있습니다';
  END IF;

  v_norm := regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g');
  IF length(v_norm) < 9 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT u.id, u.name, u.nickname, u.phone, u.photo_url, u.photo_url_blurhash, u.region
  FROM public.users u
  WHERE u.is_active = true
    AND COALESCE(u.status, 'active') NOT IN ('deleted', 'deactivated')
    AND regexp_replace(COALESCE(u.phone, ''), '\D', '', 'g') = v_norm
  LIMIT 5;
END;
$$;


ALTER FUNCTION public.search_users_by_phone(p_phone text) OWNER TO postgres;

--
-- Name: FUNCTION search_users_by_phone(p_phone text); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.search_users_by_phone(p_phone text) IS '전화 정확일치 사용자 검색(구인자 전용, 열거 방지). 스태프 직접 추가용.';


--
-- Name: search_users_for_collaborator_invite(uuid, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.search_users_for_collaborator_invite(p_job_posting_id uuid, p_email_query text) RETURNS TABLE(id uuid, email text, name text, nickname text, photo_url text)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  v_caller_uid uuid;
  v_is_owner   boolean;
  v_escaped    text;
BEGIN
  v_caller_uid := (SELECT auth.uid());

  IF v_caller_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.job_postings jp
    JOIN public.workspaces w ON w.id = jp.workspace_id
    WHERE jp.id = p_job_posting_id AND w.owner_id = v_caller_uid
  ) INTO v_is_owner;

  IF NOT v_is_owner THEN
    RAISE EXCEPTION 'permission denied: workspace owner required' USING ERRCODE = '42501';
  END IF;

  IF p_email_query IS NULL OR length(trim(p_email_query)) < 3 THEN
    RETURN;
  END IF;

  v_escaped := replace(replace(replace(trim(p_email_query), '\', '\\'), '%', '\%'), '_', '\_');

  RETURN QUERY
  SELECT u.id, u.email, u.name, u.nickname, u.photo_url
  FROM public.users u
  WHERE u.email ILIKE v_escaped || '%' ESCAPE '\'
    AND coalesce(u.is_active, true) = true
  LIMIT 10;
END;
$$;


ALTER FUNCTION public.search_users_for_collaborator_invite(p_job_posting_id uuid, p_email_query text) OWNER TO postgres;

--
-- Name: FUNCTION search_users_for_collaborator_invite(p_job_posting_id uuid, p_email_query text); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.search_users_for_collaborator_invite(p_job_posting_id uuid, p_email_query text) IS 'workspace owner 의 collaborator 후보 검색 — RLS bypass + 와일드카드 이스케이프 + 최대 10건';


--
-- Name: set_venue_soft_target(uuid, text, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.set_venue_soft_target(p_venue uuid, p_date text, p_count integer) RETURNS jsonb
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
    v_owner_id = v_caller
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


ALTER FUNCTION public.set_venue_soft_target(p_venue uuid, p_date text, p_count integer) OWNER TO postgres;

--
-- Name: FUNCTION set_venue_soft_target(p_venue uuid, p_date text, p_count integer); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.set_venue_soft_target(p_venue uuid, p_date text, p_count integer) IS '운영처 컨테이너 schedule.softTargets[date]=count read-modify-write. 날짜키 YYYY-MM-DD 정규화(E5), count=0 키제거, restrictive 정책 우회 유일 경로(SECDEF).';


--
-- Name: sync_schedule_board(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.sync_schedule_board(p_job_posting_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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
  SELECT * INTO v_jp FROM job_postings WHERE id = p_job_posting_id FOR UPDATE;

  IF NOT FOUND THEN
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
    'member_count', v_member_count + 1
  );
END;
$$;


ALTER FUNCTION public.sync_schedule_board(p_job_posting_id uuid) OWNER TO postgres;

--
-- Name: FUNCTION sync_schedule_board(p_job_posting_id uuid); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.sync_schedule_board(p_job_posting_id uuid) IS 'Schedule board sync (board_posts + board_memberships)를 단일 트랜잭션으로 처리. outbox processor(service_role)만 호출 — authenticated EXECUTE 없음(20260710020000에서 회수). 재부여 금지: 클라이언트는 schedule_board_sync_outbox 에 enqueue 만 한다.';


--
-- Name: sync_user_role_to_app_metadata(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.sync_user_role_to_app_metadata() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
                          || jsonb_build_object('role', NEW.role::text)
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.sync_user_role_to_app_metadata() OWNER TO postgres;

--
-- Name: toggle_board_post_vote(text, uuid, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.toggle_board_post_vote(p_post_id text, p_user_id uuid, p_vote_type text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_existing_type text;
  v_result_type   text;
BEGIN
  IF auth.uid() IS NULL
     OR (auth.uid() IS DISTINCT FROM p_user_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;

  IF p_vote_type NOT IN ('like', 'dislike') THEN
    RAISE EXCEPTION 'invalid vote type: %', p_vote_type USING ERRCODE = '22023';
  END IF;

  SELECT type INTO v_existing_type
  FROM public.board_votes
  WHERE post_id = p_post_id AND user_id = p_user_id;

  IF v_existing_type IS NOT NULL THEN
    IF v_existing_type = p_vote_type THEN
      DELETE FROM public.board_votes
      WHERE post_id = p_post_id AND user_id = p_user_id;
      IF p_vote_type = 'like' THEN
        UPDATE public.board_posts
        SET like_count = GREATEST(0, COALESCE(like_count, 0) - 1), updated_at = now()
        WHERE id = p_post_id;
      ELSE
        UPDATE public.board_posts
        SET dislike_count = GREATEST(0, COALESCE(dislike_count, 0) - 1), updated_at = now()
        WHERE id = p_post_id;
      END IF;
      v_result_type := NULL;
    ELSE
      UPDATE public.board_votes
      SET type = p_vote_type
      WHERE post_id = p_post_id AND user_id = p_user_id;
      IF p_vote_type = 'like' THEN
        UPDATE public.board_posts
        SET like_count = COALESCE(like_count, 0) + 1,
            dislike_count = GREATEST(0, COALESCE(dislike_count, 0) - 1), updated_at = now()
        WHERE id = p_post_id;
      ELSE
        UPDATE public.board_posts
        SET dislike_count = COALESCE(dislike_count, 0) + 1,
            like_count = GREATEST(0, COALESCE(like_count, 0) - 1), updated_at = now()
        WHERE id = p_post_id;
      END IF;
      v_result_type := p_vote_type;
    END IF;
  ELSE
    INSERT INTO public.board_votes (post_id, user_id, type)
    VALUES (p_post_id, p_user_id, p_vote_type);
    IF p_vote_type = 'like' THEN
      UPDATE public.board_posts
      SET like_count = COALESCE(like_count, 0) + 1, updated_at = now()
      WHERE id = p_post_id;
    ELSE
      UPDATE public.board_posts
      SET dislike_count = COALESCE(dislike_count, 0) + 1, updated_at = now()
      WHERE id = p_post_id;
    END IF;
    v_result_type := p_vote_type;
  END IF;

  RETURN jsonb_build_object('result_type', v_result_type);
END;
$$;


ALTER FUNCTION public.toggle_board_post_vote(p_post_id text, p_user_id uuid, p_vote_type text) OWNER TO postgres;

--
-- Name: toggle_comment_reaction(uuid, uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.toggle_comment_reaction(p_post_id uuid, p_comment_id uuid, p_user_id uuid, p_reaction_type text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_existing_type text;
  v_result_type   text;
BEGIN
  IF auth.uid() IS NULL
     OR (auth.uid() IS DISTINCT FROM p_user_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;

  SELECT type INTO v_existing_type
  FROM public.board_comment_reactions
  WHERE comment_id = p_comment_id AND user_id = p_user_id;

  IF v_existing_type IS NOT NULL THEN
    IF v_existing_type = p_reaction_type THEN
      DELETE FROM public.board_comment_reactions
      WHERE comment_id = p_comment_id AND user_id = p_user_id;
      UPDATE public.board_comments
      SET reaction_counts = jsonb_set(
        COALESCE(reaction_counts, '{}'),
        ARRAY[p_reaction_type],
        to_jsonb(GREATEST(0, COALESCE((reaction_counts->>p_reaction_type)::int, 0) - 1))
      )
      WHERE id = p_comment_id;
      v_result_type := NULL;
    ELSE
      UPDATE public.board_comment_reactions
      SET type = p_reaction_type
      WHERE comment_id = p_comment_id AND user_id = p_user_id;
      UPDATE public.board_comments
      SET reaction_counts = jsonb_set(
        jsonb_set(
          COALESCE(reaction_counts, '{}'),
          ARRAY[v_existing_type],
          to_jsonb(GREATEST(0, COALESCE((reaction_counts->>v_existing_type)::int, 0) - 1))
        ),
        ARRAY[p_reaction_type],
        to_jsonb(COALESCE((reaction_counts->>p_reaction_type)::int, 0) + 1)
      )
      WHERE id = p_comment_id;
      v_result_type := p_reaction_type;
    END IF;
  ELSE
    INSERT INTO public.board_comment_reactions (post_id, comment_id, user_id, type)
    VALUES (p_post_id, p_comment_id, p_user_id, p_reaction_type);
    UPDATE public.board_comments
    SET reaction_counts = jsonb_set(
      COALESCE(reaction_counts, '{}'),
      ARRAY[p_reaction_type],
      to_jsonb(COALESCE((reaction_counts->>p_reaction_type)::int, 0) + 1)
    )
    WHERE id = p_comment_id;
    v_result_type := p_reaction_type;
  END IF;

  RETURN jsonb_build_object('result_type', v_result_type);
END;
$$;


ALTER FUNCTION public.toggle_comment_reaction(p_post_id uuid, p_comment_id uuid, p_user_id uuid, p_reaction_type text) OWNER TO postgres;

--
-- Name: trigger_send_push_notification(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.trigger_send_push_notification() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
DECLARE
  v_supabase_url text;
  v_service_role_key text;
  v_ids uuid[];
BEGIN
  SELECT array_agg(id) INTO v_ids
  FROM new_rows
  WHERE recipient_id IS NOT NULL;

  IF v_ids IS NULL OR array_length(v_ids, 1) = 0 THEN
    RETURN NULL;
  END IF;

  SELECT decrypted_secret INTO v_supabase_url
  FROM vault.decrypted_secrets WHERE name = 'supabase_url'
  ORDER BY created_at DESC LIMIT 1;

  SELECT decrypted_secret INTO v_service_role_key
  FROM vault.decrypted_secrets WHERE name = 'service_role_key'
  ORDER BY created_at DESC LIMIT 1;

  IF v_supabase_url IS NULL OR v_service_role_key IS NULL THEN
    RAISE WARNING '[send-push-trigger] vault secrets missing — skip % notifications', array_length(v_ids, 1);
    RETURN NULL;
  END IF;

  PERFORM net.http_post(
    url := v_supabase_url || '/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_service_role_key,
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object('notificationIds', to_jsonb(v_ids)),
    timeout_milliseconds := 5000
  );

  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[send-push-trigger] failed for batch of % notifications — %',
    COALESCE(array_length(v_ids, 1), 0), SQLERRM;
  RETURN NULL;
END;
$$;


ALTER FUNCTION public.trigger_send_push_notification() OWNER TO postgres;

--
-- Name: update_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at() OWNER TO postgres;

--
-- Name: update_user_role(uuid, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_user_role(p_user_id uuid, p_new_role text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_caller_role text;
  v_previous_role text;
  v_new_role public.user_role;
BEGIN
  -- 1. 호출자 admin 검증
  v_caller_role := auth.jwt() -> 'app_metadata' ->> 'role';
  IF v_caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'FORBIDDEN: admin 권한이 필요합니다 (caller role: %)', COALESCE(v_caller_role, 'null');
  END IF;

  -- 2. 자기 자신 역할 변경 차단 (admin 자가강등 방지)
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'INVALID_TARGET: 자신의 역할은 변경할 수 없습니다';
  END IF;

  -- 3. 입력 role enum 캐스팅 (잘못된 값이면 invalid_text_representation 에러)
  BEGIN
    v_new_role := p_new_role::public.user_role;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'INVALID_ROLE: 유효하지 않은 역할 값 (%)', p_new_role;
  END;

  -- 4. 대상 사용자 조회 + 잠금
  SELECT role::text INTO v_previous_role
    FROM public.users
    WHERE id = p_user_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'USER_NOT_FOUND: 대상 사용자를 찾을 수 없습니다 (%)', p_user_id;
  END IF;

  -- 5. 동일 역할이면 no-op (트리거 불필요한 JWT 갱신 방지)
  IF v_previous_role = p_new_role THEN
    RETURN jsonb_build_object('previous_role', v_previous_role);
  END IF;

  -- 6. 역할 변경 (on_public_user_role_changed 트리거가 app_metadata 동기화)
  UPDATE public.users
    SET role = v_new_role,
        updated_at = now()
    WHERE id = p_user_id;

  RETURN jsonb_build_object('previous_role', v_previous_role);
END;
$$;


ALTER FUNCTION public.update_user_role(p_user_id uuid, p_new_role text) OWNER TO postgres;

--
-- Name: FUNCTION update_user_role(p_user_id uuid, p_new_role text); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.update_user_role(p_user_id uuid, p_new_role text) IS '관리자 전용 사용자 역할 변경 RPC. app_metadata.role=admin 필요. 자기 자신 대상 금지. previous_role 반환.';


--
-- Name: venue_span_posting_ids(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.venue_span_posting_ids(p_venue uuid) RETURNS SETOF uuid
    LANGUAGE sql STABLE
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT id FROM public.job_postings
  WHERE p_venue IS NOT NULL AND (venue_id = p_venue OR id = p_venue);
$$;


ALTER FUNCTION public.venue_span_posting_ids(p_venue uuid) OWNER TO postgres;

--
-- Name: FUNCTION venue_span_posting_ids(p_venue uuid); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.venue_span_posting_ids(p_venue uuid) IS 'venue 스팬 SSOT: 운영처 컨테이너(id=:V)+그 venue 의 공고(venue_id=:V) posting id 집합. count/부족/정산 reader 공용(E1 발산 방지).';


--
-- Name: workspace_count_for_owner(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.workspace_count_for_owner(_owner_id uuid) RETURNS integer
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_count int;
BEGIN
  SELECT count(*)::int INTO v_count
  FROM public.workspaces
  WHERE owner_id = _owner_id AND archived_at IS NULL;
  RETURN v_count;
END;
$$;


ALTER FUNCTION public.workspace_count_for_owner(_owner_id uuid) OWNER TO postgres;

--
-- Name: action_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.action_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    action text NOT NULL,
    metadata jsonb,
    ip_address text,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.action_logs OWNER TO postgres;

--
-- Name: announcements; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.announcements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    content text NOT NULL,
    category public.announcement_category DEFAULT 'notice'::public.announcement_category NOT NULL,
    status public.announcement_status DEFAULT 'draft'::public.announcement_status NOT NULL,
    priority integer DEFAULT 0,
    is_pinned boolean DEFAULT false,
    target_audience jsonb DEFAULT '{"type": "all"}'::jsonb,
    author_id uuid,
    author_name text NOT NULL,
    view_count integer DEFAULT 0,
    published_at timestamp with time zone,
    image_url text,
    image_storage_path text,
    images jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    image_url_blurhash text,
    CONSTRAINT announcements_priority_check CHECK ((priority = ANY (ARRAY[0, 1, 2])))
);


ALTER TABLE public.announcements OWNER TO postgres;

--
-- Name: COLUMN announcements.image_url_blurhash; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.announcements.image_url_blurhash IS 'impeccable v2 §18. 공지사항 대표 이미지 blurhash. announcements.images 배열 항목은 각 객체에 blurhash 필드 포함(zod 스키마).';


--
-- Name: app_config; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.app_config (
    key text NOT NULL,
    value jsonb NOT NULL,
    description text,
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.app_config OWNER TO postgres;

--
-- Name: board_comment_reactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.board_comment_reactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    post_id text NOT NULL,
    comment_id uuid NOT NULL,
    user_id uuid NOT NULL,
    type text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT board_comment_reactions_type_check CHECK ((type = ANY (ARRAY['thumbs_up'::text, 'heart'::text, 'laugh'::text, 'surprised'::text, 'sad'::text, 'angry'::text])))
);


ALTER TABLE public.board_comment_reactions OWNER TO postgres;

--
-- Name: board_comments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.board_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    post_id text NOT NULL,
    parent_comment_id uuid,
    body text NOT NULL,
    author_id uuid,
    author_name text NOT NULL,
    author_role text NOT NULL,
    mentioned_user_ids text[] DEFAULT '{}'::text[],
    reaction_counts jsonb DEFAULT '{}'::jsonb,
    is_pinned boolean DEFAULT false,
    pinned_at timestamp with time zone,
    pinned_by text,
    status text DEFAULT 'active'::text,
    image_attachments jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT board_comments_status_check CHECK ((status = ANY (ARRAY['active'::text, 'hidden'::text, 'deleted'::text]))),
    CONSTRAINT chk_board_comment_author_role CHECK ((author_role = ANY (ARRAY['admin'::text, 'employer'::text, 'staff'::text, 'system'::text]))),
    CONSTRAINT chk_board_comment_status CHECK (((status IS NULL) OR (status = ANY (ARRAY['active'::text, 'hidden'::text, 'deleted'::text]))))
);


ALTER TABLE public.board_comments OWNER TO postgres;

--
-- Name: board_memberships; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.board_memberships (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    board_type public.board_type DEFAULT 'schedule'::public.board_type,
    user_id uuid NOT NULL,
    post_id text NOT NULL,
    job_posting_id uuid NOT NULL,
    role text DEFAULT 'confirmed'::text,
    display_name text,
    can_read boolean DEFAULT true,
    can_comment boolean DEFAULT true,
    title text,
    work_date text,
    author_id uuid,
    last_activity_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT board_memberships_role_check CHECK ((role = ANY (ARRAY['author'::text, 'confirmed'::text, 'admin'::text])))
);


ALTER TABLE public.board_memberships OWNER TO postgres;

--
-- Name: board_posts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.board_posts (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    board_type public.board_type DEFAULT 'free'::public.board_type NOT NULL,
    source text DEFAULT 'board'::text,
    title text NOT NULL,
    body text NOT NULL,
    author_id uuid,
    author_name text NOT NULL,
    author_role text NOT NULL,
    visibility text DEFAULT 'public'::text,
    status text DEFAULT 'active'::text,
    linked_job_posting_id uuid,
    is_auto_created boolean DEFAULT false,
    is_locked boolean DEFAULT false,
    locked_by text,
    locked_at timestamp with time zone,
    like_count integer DEFAULT 0,
    dislike_count integer DEFAULT 0,
    comment_count integer DEFAULT 0,
    view_count integer DEFAULT 0,
    image_attachments jsonb DEFAULT '[]'::jsonb,
    last_activity_at timestamp with time zone,
    announcement_category public.announcement_category,
    is_pinned boolean DEFAULT false,
    job_summary jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT board_posts_source_check CHECK ((source = ANY (ARRAY['board'::text, 'announcement'::text]))),
    CONSTRAINT board_posts_status_check CHECK ((status = ANY (ARRAY['active'::text, 'locked'::text, 'hidden'::text, 'archived'::text]))),
    CONSTRAINT board_posts_visibility_check CHECK ((visibility = ANY (ARRAY['public'::text, 'participants_only'::text]))),
    CONSTRAINT chk_board_post_status CHECK (((status IS NULL) OR (status = ANY (ARRAY['active'::text, 'locked'::text, 'hidden'::text, 'archived'::text]))))
);


ALTER TABLE public.board_posts OWNER TO postgres;

--
-- Name: board_reports; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.board_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    target_type text NOT NULL,
    target_id uuid NOT NULL,
    post_id text NOT NULL,
    reporter_id uuid,
    reason text NOT NULL,
    details text,
    status text DEFAULT 'pending'::text,
    resolved_by text,
    resolved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT board_reports_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'resolved'::text, 'dismissed'::text]))),
    CONSTRAINT board_reports_target_type_check CHECK ((target_type = ANY (ARRAY['post'::text, 'comment'::text])))
);


ALTER TABLE public.board_reports OWNER TO postgres;

--
-- Name: board_votes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.board_votes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    post_id text NOT NULL,
    user_id uuid NOT NULL,
    type text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT board_votes_type_check CHECK ((type = ANY (ARRAY['like'::text, 'dislike'::text])))
);


ALTER TABLE public.board_votes OWNER TO postgres;

--
-- Name: employer_applications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.employer_applications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    status text NOT NULL,
    submitted_at timestamp with time zone DEFAULT now() NOT NULL,
    reviewed_at timestamp with time zone,
    reviewed_by uuid,
    rejection_reason text,
    rejection_category text,
    agreements_snapshot jsonb NOT NULL,
    supersedes_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    intro text,
    CONSTRAINT employer_applications_intro_len_chk CHECK (((intro IS NULL) OR (char_length(intro) <= 300))),
    CONSTRAINT employer_applications_rejection_category_check CHECK ((rejection_category = ANY (ARRAY['duplicate'::text, 'dummy'::text, 'identity_mismatch'::text, 'other'::text]))),
    CONSTRAINT employer_applications_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);


ALTER TABLE public.employer_applications OWNER TO postgres;

--
-- Name: fcm_tokens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.fcm_tokens (
    user_id uuid NOT NULL,
    token text NOT NULL,
    type text NOT NULL,
    platform text NOT NULL,
    registered_at timestamp with time zone DEFAULT now() NOT NULL,
    last_refreshed_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT fcm_tokens_platform_check CHECK ((platform = ANY (ARRAY['ios'::text, 'android'::text]))),
    CONSTRAINT fcm_tokens_type_check CHECK ((type = ANY (ARRAY['expo'::text, 'fcm'::text])))
);


ALTER TABLE public.fcm_tokens OWNER TO postgres;

--
-- Name: inquiries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.inquiries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    user_email text,
    user_name text,
    category text DEFAULT 'general'::text,
    subject text NOT NULL,
    message text NOT NULL,
    status public.inquiry_status DEFAULT 'open'::public.inquiry_status,
    attachments jsonb DEFAULT '[]'::jsonb,
    response text,
    responder_id uuid,
    responder_name text,
    responded_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT inquiries_category_check CHECK ((category = ANY (ARRAY['general'::text, 'technical'::text, 'payment'::text, 'account'::text, 'report'::text, 'other'::text])))
);


ALTER TABLE public.inquiries OWNER TO postgres;

--
-- Name: job_posting_collaborator_audit; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.job_posting_collaborator_audit (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    job_posting_id uuid NOT NULL,
    target_user_id uuid NOT NULL,
    actor_user_id uuid,
    action text NOT NULL,
    source text DEFAULT 'user'::text NOT NULL,
    at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT job_posting_collaborator_audit_action_check CHECK ((action = ANY (ARRAY['added'::text, 'removed'::text]))),
    CONSTRAINT job_posting_collaborator_audit_source_check CHECK ((source = ANY (ARRAY['user'::text, 'system'::text, 'cascade'::text])))
);


ALTER TABLE public.job_posting_collaborator_audit OWNER TO postgres;

--
-- Name: TABLE job_posting_collaborator_audit; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.job_posting_collaborator_audit IS '공고별 협업자 추가/제거 이력 — workspace owner 만 SELECT, trigger 만 쓰기';


--
-- Name: job_posting_collaborators; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.job_posting_collaborators (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    job_posting_id uuid NOT NULL,
    user_id uuid NOT NULL,
    added_by uuid NOT NULL,
    added_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT job_posting_collaborators_check CHECK ((user_id <> added_by))
);


ALTER TABLE public.job_posting_collaborators OWNER TO postgres;

--
-- Name: TABLE job_posting_collaborators; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.job_posting_collaborators IS '공고 단위 협업자 — workspace editor 와 별개의 입자 권한 (D1 OR 평가)';


--
-- Name: job_posting_templates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.job_posting_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    template_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    usage_count integer DEFAULT 0 NOT NULL,
    description text
);


ALTER TABLE public.job_posting_templates OWNER TO postgres;

--
-- Name: COLUMN job_posting_templates.description; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.job_posting_templates.description IS '템플릿 설명 (선택, max 100자) — TemplateModal.tsx에서 입력';


--
-- Name: notification_counters; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notification_counters (
    user_id uuid NOT NULL,
    unread_count integer DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.notification_counters OWNER TO postgres;

--
-- Name: notification_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notification_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    push_enabled boolean DEFAULT true NOT NULL,
    categories jsonb DEFAULT '{}'::jsonb,
    quiet_hours jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    "grouping" jsonb DEFAULT jsonb_build_object('enabled', true, 'minGroupSize', 2, 'timeWindowHours', 24)
);


ALTER TABLE public.notification_settings OWNER TO postgres;

--
-- Name: TABLE notification_settings; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.notification_settings IS '사용자별 알림 설정';


--
-- Name: COLUMN notification_settings."grouping"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.notification_settings."grouping" IS '알림 그룹화 설정. shape: { enabled: boolean, minGroupSize: number, timeWindowHours: number }. 클라이언트 NotificationSettings.grouping과 1:1 매칭.';


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    recipient_id uuid NOT NULL,
    type text NOT NULL,
    category public.notification_category,
    title text NOT NULL,
    body text NOT NULL,
    link text,
    data jsonb,
    is_read boolean DEFAULT false,
    priority text DEFAULT 'normal'::text,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT notifications_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'normal'::text, 'high'::text, 'urgent'::text])))
);

ALTER TABLE ONLY public.notifications REPLICA IDENTITY FULL;


ALTER TABLE public.notifications OWNER TO postgres;

--
-- Name: ops_blind_levels; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ops_blind_levels (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tournament_id uuid NOT NULL,
    level integer NOT NULL,
    small_blind integer DEFAULT 0 NOT NULL,
    big_blind integer DEFAULT 0 NOT NULL,
    ante integer DEFAULT 0 NOT NULL,
    duration_sec integer NOT NULL,
    is_break boolean DEFAULT false NOT NULL,
    sort integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ops_blind_levels_values_nonneg CHECK (((small_blind >= 0) AND (big_blind >= 0) AND (ante >= 0) AND (duration_sec > 0)))
);

ALTER TABLE ONLY public.ops_blind_levels FORCE ROW LEVEL SECURITY;


ALTER TABLE public.ops_blind_levels OWNER TO postgres;

--
-- Name: TABLE ops_blind_levels; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.ops_blind_levels IS '블라인드 구조. sort 1..N 연속(ops_set_blind_levels 전체교체로 보장). 쓰기는 1c SECDEF RPC 전용.';


--
-- Name: ops_clock; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ops_clock (
    tournament_id uuid NOT NULL,
    current_level_sort integer DEFAULT 1 NOT NULL,
    level_started_at timestamp with time zone,
    is_running boolean DEFAULT false NOT NULL,
    paused_remaining_sec integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.ops_clock FORCE ROW LEVEL SECURITY;


ALTER TABLE public.ops_clock OWNER TO postgres;

--
-- Name: TABLE ops_clock; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.ops_clock IS '서버 동기 클럭(대회당 1행). 남은시간 = 서버 앵커(level_started_at) 파생. 쓰기는 1c SECDEF RPC 전용.';


--
-- Name: ops_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ops_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tournament_id uuid NOT NULL,
    type public.ops_event_type NOT NULL,
    actor_id uuid,
    actor_device text,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    seq bigint NOT NULL
);

ALTER TABLE ONLY public.ops_events FORCE ROW LEVEL SECURITY;


ALTER TABLE public.ops_events OWNER TO postgres;

--
-- Name: TABLE ops_events; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.ops_events IS 'Append-only 이벤트 로그. UPDATE/DELETE 금지(트리거 RAISE + REVOKE). Realtime publication 미등록.';


--
-- Name: ops_events_seq_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.ops_events ALTER COLUMN seq ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.ops_events_seq_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: ops_live_stats; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ops_live_stats (
    tournament_id uuid NOT NULL,
    playing integer DEFAULT 0 NOT NULL,
    entries integer DEFAULT 0 NOT NULL,
    unique_players integer DEFAULT 0 NOT NULL,
    reentries_total integer DEFAULT 0 NOT NULL,
    tables_open integer DEFAULT 0 NOT NULL,
    seats_total integer DEFAULT 0 NOT NULL,
    seats_free integer DEFAULT 0 NOT NULL,
    total_chips bigint DEFAULT 0 NOT NULL,
    average_stack bigint DEFAULT 0 NOT NULL,
    avg_stack_bb numeric DEFAULT 0 NOT NULL,
    prize_pool bigint DEFAULT 0 NOT NULL,
    knockout_pool bigint,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.ops_live_stats FORCE ROW LEVEL SECURITY;


ALTER TABLE public.ops_live_stats OWNER TO postgres;

--
-- Name: TABLE ops_live_stats; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.ops_live_stats IS '파생 통계(대회당 1행). fn_ops_recompute_live_stats 트리거 재계산(원천 participants/seats/tables/clock·blind). 쓰기는 함수 전용.';


--
-- Name: ops_participants; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ops_participants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tournament_id uuid NOT NULL,
    entry_number integer NOT NULL,
    name text NOT NULL,
    nationality text,
    phone text,
    player_user_id uuid,
    view_token text,
    status public.ops_participant_status DEFAULT 'registered'::public.ops_participant_status NOT NULL,
    chips integer DEFAULT 0 NOT NULL,
    buy_in_amount integer,
    rebuys integer DEFAULT 0 NOT NULL,
    add_ons integer DEFAULT 0 NOT NULL,
    reentries integer DEFAULT 0 NOT NULL,
    finish_position integer,
    busted_at timestamp with time zone,
    prize_amount integer,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    claim_pin_hash text,
    knockouts integer DEFAULT 0 NOT NULL,
    CONSTRAINT ops_participants_addons_nonneg CHECK ((add_ons >= 0)),
    CONSTRAINT ops_participants_chips_nonneg CHECK ((chips >= 0)),
    CONSTRAINT ops_participants_knockouts_nonneg CHECK ((knockouts >= 0)),
    CONSTRAINT ops_participants_name_length CHECK (((char_length(name) >= 1) AND (char_length(name) <= 50))),
    CONSTRAINT ops_participants_rebuys_nonneg CHECK ((rebuys >= 0)),
    CONSTRAINT ops_participants_reentries_nonneg CHECK ((reentries >= 0))
);

ALTER TABLE ONLY public.ops_participants FORCE ROW LEVEL SECURITY;


ALTER TABLE public.ops_participants OWNER TO postgres;

--
-- Name: TABLE ops_participants; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.ops_participants IS '대회 참가자(엔트리). entry_number 는 tournament 내 1부터 gap-free. 쓰기는 T2 SECDEF RPC 전용.';


--
-- Name: COLUMN ops_participants.view_token; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.ops_participants.view_token IS '읽기 능력(anon player_view 키). 공유·유출 허용(읽기만). 운영자 read 가능(D8).';


--
-- Name: COLUMN ops_participants.claim_pin_hash; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.ops_participants.claim_pin_hash IS 'claim 비밀의 bcrypt 해시. null=미발급. anon/공개 경로 절대 미반환.';


--
-- Name: ops_prizes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ops_prizes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tournament_id uuid NOT NULL,
    rank integer NOT NULL,
    amount integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ops_prizes_amount_nonneg CHECK ((amount >= 0)),
    CONSTRAINT ops_prizes_rank_positive CHECK ((rank > 0))
);

ALTER TABLE ONLY public.ops_prizes FORCE ROW LEVEL SECURITY;


ALTER TABLE public.ops_prizes OWNER TO postgres;

--
-- Name: TABLE ops_prizes; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.ops_prizes IS '순위별 고정 상금 구조(1d). 쓰기는 SECDEF RPC 전용. bust 가 rank=finish_position 으로 prize_amount 매핑.';


--
-- Name: ops_seats; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ops_seats (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tournament_id uuid NOT NULL,
    table_id uuid NOT NULL,
    table_no integer NOT NULL,
    seat_no integer NOT NULL,
    participant_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ops_seats_seat_no_positive CHECK ((seat_no >= 1))
);

ALTER TABLE ONLY public.ops_seats FORCE ROW LEVEL SECURITY;


ALTER TABLE public.ops_seats OWNER TO postgres;

--
-- Name: TABLE ops_seats; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.ops_seats IS '좌석 단일 점유원. participant 점유는 partial UNIQUE 로 대회내 1좌석 강제.';


--
-- Name: ops_staff; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ops_staff (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tournament_id uuid NOT NULL,
    staff_id uuid NOT NULL,
    role public.staff_role DEFAULT 'dealer'::public.staff_role NOT NULL,
    custom_role text,
    staff_name text NOT NULL,
    staff_nickname text,
    source text NOT NULL,
    source_work_log_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ops_staff_source_check CHECK ((source = ANY (ARRAY['snapshot_import'::text, 'manual'::text])))
);

ALTER TABLE ONLY public.ops_staff FORCE ROW LEVEL SECURITY;


ALTER TABLE public.ops_staff OWNER TO postgres;

--
-- Name: TABLE ops_staff; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.ops_staff IS '대회별 딜러/스태프 스냅샷. staff_name/staff_nickname 은 INSERT 시점 고정(users 변경 무관). source_work_log_id 는 공고 확정스태프 import 출처(snapshot_import), 수동추가는 manual/NULL. 쓰기는 SECDEF RPC 전용(M2~).';


--
-- Name: ops_tables; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ops_tables (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tournament_id uuid NOT NULL,
    table_no integer NOT NULL,
    name text,
    status public.ops_table_status DEFAULT 'open'::public.ops_table_status NOT NULL,
    assigned_staff_id uuid,
    lock_type public.ops_table_lock_type DEFAULT 'none'::public.ops_table_lock_type NOT NULL,
    priority integer,
    "position" jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ops_tables_name_length CHECK (((name IS NULL) OR ((char_length(name) >= 1) AND (char_length(name) <= 50)))),
    CONSTRAINT ops_tables_table_no_positive CHECK ((table_no >= 1))
);

ALTER TABLE ONLY public.ops_tables FORCE ROW LEVEL SECURITY;


ALTER TABLE public.ops_tables OWNER TO postgres;

--
-- Name: TABLE ops_tables; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.ops_tables IS '라이브 운영 테이블. 쓰기는 1b SECDEF RPC 전용. closed/standby/lock 은 redraw 제외.';


--
-- Name: ops_tournaments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ops_tournaments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    job_posting_id uuid,
    name text NOT NULL,
    venue text,
    event_date date,
    game_type text DEFAULT 'NLH'::text NOT NULL,
    status public.ops_tournament_status DEFAULT 'upcoming'::public.ops_tournament_status NOT NULL,
    seats_per_table integer DEFAULT 9 NOT NULL,
    starting_chips integer DEFAULT 0 NOT NULL,
    color text,
    buy_in_chips integer DEFAULT 0 NOT NULL,
    rebuy_chips integer DEFAULT 0 NOT NULL,
    addon_chips integer DEFAULT 0 NOT NULL,
    buy_in_cost integer DEFAULT 0 NOT NULL,
    fee_cost integer DEFAULT 0 NOT NULL,
    rebuy_cost integer DEFAULT 0 NOT NULL,
    addon_cost integer DEFAULT 0 NOT NULL,
    bounty_cost integer,
    registration_open boolean DEFAULT true NOT NULL,
    auto_seat_on_register boolean DEFAULT true NOT NULL,
    reentry_allowed boolean DEFAULT true NOT NULL,
    max_reentries integer,
    monitor_token text,
    next_entry_seq integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ops_tournaments_bounty_cost_nonneg CHECK (((bounty_cost IS NULL) OR ((bounty_cost >= 0) AND (bounty_cost <= 100000000)))),
    CONSTRAINT ops_tournaments_name_length CHECK (((char_length(name) >= 1) AND (char_length(name) <= 100))),
    CONSTRAINT ops_tournaments_seats_range CHECK (((seats_per_table >= 2) AND (seats_per_table <= 11))),
    CONSTRAINT ops_tournaments_starting_chips_nonneg CHECK ((starting_chips >= 0))
);

ALTER TABLE ONLY public.ops_tournaments FORCE ROW LEVEL SECURITY;


ALTER TABLE public.ops_tournaments OWNER TO postgres;

--
-- Name: TABLE ops_tournaments; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.ops_tournaments IS '라이브 운영 대회. owner OR 연결 공고 워크스페이스 멤버만 SELECT. 쓰기는 T2 SECDEF RPC 전용.';


--
-- Name: COLUMN ops_tournaments.next_entry_seq; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.ops_tournaments.next_entry_seq IS '엔트리 번호 할당자. ops_register_participant 가 +1 후 UPDATE (FOR UPDATE 직렬화).';


--
-- Name: processed_identity_verifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.processed_identity_verifications (
    verification_id text NOT NULL,
    user_id uuid NOT NULL,
    function_name text NOT NULL,
    processed_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.processed_identity_verifications OWNER TO postgres;

--
-- Name: TABLE processed_identity_verifications; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.processed_identity_verifications IS 'PortOne identityVerificationId 멱등성 — once-only 처리 보장. P1 verification_id replay 차단.';


--
-- Name: COLUMN processed_identity_verifications.verification_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.processed_identity_verifications.verification_id IS 'PortOne identityVerificationId (예: inicis-identity-<uuid>)';


--
-- Name: COLUMN processed_identity_verifications.function_name; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.processed_identity_verifications.function_name IS '처리한 Edge Function 이름 — 디버깅 + 향후 다중 함수 멱등성 확장 대비';


--
-- Name: rate_limits; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.rate_limits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key text NOT NULL,
    tokens integer DEFAULT 0,
    last_refill timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone
);


ALTER TABLE public.rate_limits OWNER TO postgres;

--
-- Name: reports; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    type text NOT NULL,
    reporter_type text NOT NULL,
    reporter_id uuid,
    reporter_name text NOT NULL,
    target_id uuid NOT NULL,
    target_name text NOT NULL,
    job_posting_id uuid NOT NULL,
    job_posting_title text,
    work_log_id uuid,
    work_date text,
    description text NOT NULL,
    evidence_urls text[],
    status text DEFAULT 'pending'::text,
    severity public.report_severity DEFAULT 'medium'::public.report_severity,
    reviewer_id text,
    reviewer_notes text,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT chk_report_status CHECK (((status IS NULL) OR (status = ANY (ARRAY['pending'::text, 'reviewed'::text, 'resolved'::text, 'dismissed'::text])))),
    CONSTRAINT chk_report_type CHECK ((type = ANY (ARRAY['tardiness'::text, 'negligence'::text, 'no_show'::text, 'early_leave'::text, 'inappropriate'::text, 'dress_code'::text, 'communication'::text, 'false_posting'::text, 'employer_negligence'::text, 'unfair_treatment'::text, 'inappropriate_behavior'::text, 'other'::text]))),
    CONSTRAINT reports_reporter_type_check CHECK ((reporter_type = ANY (ARRAY['employer'::text, 'employee'::text]))),
    CONSTRAINT reports_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'reviewed'::text, 'resolved'::text, 'dismissed'::text])))
);


ALTER TABLE public.reports OWNER TO postgres;

--
-- Name: CONSTRAINT chk_report_type ON reports; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON CONSTRAINT chk_report_type ON public.reports IS 'src/types/report.ts 의 EmployeeReportType + EmployerReportType union 과 일치해야 함.';


--
-- Name: reviews; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    work_log_id uuid NOT NULL,
    job_posting_id uuid NOT NULL,
    job_posting_title text,
    work_date text,
    reviewer_id uuid,
    reviewer_name text NOT NULL,
    reviewer_type text NOT NULL,
    reviewee_id uuid,
    reviewee_name text NOT NULL,
    sentiment public.review_sentiment NOT NULL,
    tags text[] DEFAULT '{}'::text[],
    comment text,
    bubble_score_change integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT reviews_reviewer_type_check CHECK ((reviewer_type = ANY (ARRAY['employer'::text, 'staff'::text])))
);


ALTER TABLE public.reviews OWNER TO postgres;

--
-- Name: schedule_board_sync_outbox; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.schedule_board_sync_outbox (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    job_posting_id uuid NOT NULL,
    action text NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    error_message text,
    retry_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT schedule_board_sync_outbox_action_check CHECK ((action = ANY (ARRAY['create'::text, 'update'::text, 'delete'::text, 'close'::text, 'reopen'::text]))),
    CONSTRAINT schedule_board_sync_outbox_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'success'::text, 'failed_retry_limit'::text])))
);


ALTER TABLE public.schedule_board_sync_outbox OWNER TO postgres;

--
-- Name: TABLE schedule_board_sync_outbox; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.schedule_board_sync_outbox IS 'T-B7: Schedule board sync 의도를 영속화하는 outbox 테이블. jobManagementService가 작성, sync-schedule-board-outbox Edge Function이 polling으로 처리.';


--
-- Name: user_consents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_consents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    consent_type text NOT NULL,
    version text,
    agreed boolean DEFAULT false NOT NULL,
    agreed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.user_consents OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id uuid NOT NULL,
    email text NOT NULL,
    name text NOT NULL,
    nickname text,
    phone text,
    role public.user_role DEFAULT 'staff'::public.user_role NOT NULL,
    photo_url text,
    phone_verified boolean DEFAULT false,
    identity_verified boolean DEFAULT false,
    identity_verified_at timestamp with time zone,
    identity_provider text,
    identity_data jsonb,
    gender text,
    birth_date text,
    region text,
    experience_years integer,
    career text,
    note text,
    social_provider text,
    terms_agreed boolean DEFAULT false,
    privacy_agreed boolean DEFAULT false,
    marketing_agreed boolean DEFAULT false,
    employer_agreements jsonb,
    employer_registered_at timestamp with time zone,
    bubble_score jsonb DEFAULT '{"score": 50, "neutralCount": 0, "negativeCount": 0, "positiveCount": 0, "totalReviewCount": 0}'::jsonb,
    status text DEFAULT 'active'::text,
    profile_completed boolean DEFAULT false,
    is_active boolean DEFAULT true,
    fcm_tokens jsonb DEFAULT '{}'::jsonb,
    deletion_requested_at timestamp with time zone,
    deletion_scheduled_for timestamp with time zone,
    is_orphan boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    photo_url_blurhash text,
    identity_ci_hash text,
    third_party_agreed boolean,
    third_party_agreed_at timestamp with time zone,
    third_party_agreed_version text,
    CONSTRAINT users_gender_check CHECK ((gender = ANY (ARRAY['male'::text, 'female'::text]))),
    CONSTRAINT users_social_provider_check CHECK ((social_provider = ANY (ARRAY['apple'::text, 'google'::text, 'kakao'::text, 'naver'::text]))),
    CONSTRAINT users_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text, 'suspended'::text, 'deleted'::text])))
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: COLUMN users.identity_data; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.identity_data IS 'PortOne 본인인증으로 받은 신원 정보 jsonb. provider/channel/identityVerificationId/verifiedAt/name/birthDate/gender/phoneNumber/ciHash/isForeigner.';


--
-- Name: COLUMN users.photo_url_blurhash; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.photo_url_blurhash IS 'impeccable v2 §18. 프로필 사진 blurhash 해시(~30자). 클라이언트 선계산.';


--
-- Name: COLUMN users.identity_ci_hash; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.identity_ci_hash IS 'PortOne 본인인증 CI(Connecting Information) 해시. 동일인 중복 가입 검사용. identity jsonb의 ciHash 필드와 동기화 유지.';


--
-- Name: COLUMN users.third_party_agreed; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.third_party_agreed IS '개인정보 제3자 제공 동의 (구인구직 매칭 상대방에게 이름·연락처·프로필 제공) - 개보법 §17';


--
-- Name: COLUMN users.third_party_agreed_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.third_party_agreed_at IS '제3자 제공 동의 timestamp - 분쟁 대응용';


--
-- Name: COLUMN users.third_party_agreed_version; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.third_party_agreed_version IS 'thirdPartyConsent.ts 의 version 값 (예: v1-2026-05-13)';


--
-- Name: workspace_invitations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.workspace_invitations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    invitee_user_id uuid NOT NULL,
    role public.workspace_role DEFAULT 'editor'::public.workspace_role NOT NULL,
    invited_by uuid NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '7 days'::interval) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    responded_at timestamp with time zone,
    CONSTRAINT workspace_invitations_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'rejected'::text, 'revoked'::text, 'expired'::text])))
);

ALTER TABLE ONLY public.workspace_invitations FORCE ROW LEVEL SECURITY;


ALTER TABLE public.workspace_invitations OWNER TO postgres;

--
-- Name: TABLE workspace_invitations; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.workspace_invitations IS '인앱 초대 (invitee_user_id 필수). 외부 이메일 초대는 Phase 2.';


--
-- Name: COLUMN workspace_invitations.status; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.workspace_invitations.status IS 'pending → accepted/rejected/revoked/expired. 만료 정리는 pg_cron (PR #2).';


--
-- Name: action_logs action_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.action_logs
    ADD CONSTRAINT action_logs_pkey PRIMARY KEY (id);


--
-- Name: announcements announcements_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_pkey PRIMARY KEY (id);


--
-- Name: app_config app_config_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.app_config
    ADD CONSTRAINT app_config_pkey PRIMARY KEY (key);


--
-- Name: applications applications_job_posting_id_applicant_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_job_posting_id_applicant_id_key UNIQUE (job_posting_id, applicant_id);


--
-- Name: applications applications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_pkey PRIMARY KEY (id);


--
-- Name: board_comment_reactions board_comment_reactions_comment_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.board_comment_reactions
    ADD CONSTRAINT board_comment_reactions_comment_id_user_id_key UNIQUE (comment_id, user_id);


--
-- Name: board_comment_reactions board_comment_reactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.board_comment_reactions
    ADD CONSTRAINT board_comment_reactions_pkey PRIMARY KEY (id);


--
-- Name: board_comments board_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.board_comments
    ADD CONSTRAINT board_comments_pkey PRIMARY KEY (id);


--
-- Name: board_memberships board_memberships_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.board_memberships
    ADD CONSTRAINT board_memberships_pkey PRIMARY KEY (id);


--
-- Name: board_memberships board_memberships_user_id_post_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.board_memberships
    ADD CONSTRAINT board_memberships_user_id_post_id_key UNIQUE (user_id, post_id);


--
-- Name: board_posts board_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.board_posts
    ADD CONSTRAINT board_posts_pkey PRIMARY KEY (id);


--
-- Name: board_reports board_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.board_reports
    ADD CONSTRAINT board_reports_pkey PRIMARY KEY (id);


--
-- Name: board_votes board_votes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.board_votes
    ADD CONSTRAINT board_votes_pkey PRIMARY KEY (id);


--
-- Name: board_votes board_votes_post_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.board_votes
    ADD CONSTRAINT board_votes_post_id_user_id_key UNIQUE (post_id, user_id);


--
-- Name: job_postings chk_container_no_filled; Type: CHECK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE public.job_postings
    ADD CONSTRAINT chk_container_no_filled CHECK (((status <> 'container'::public.posting_status) OR (COALESCE(filled_positions, 0) = 0))) NOT VALID;


--
-- Name: employer_applications employer_applications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employer_applications
    ADD CONSTRAINT employer_applications_pkey PRIMARY KEY (id);


--
-- Name: event_qr_codes event_qr_codes_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.event_qr_codes
    ADD CONSTRAINT event_qr_codes_code_key UNIQUE (code);


--
-- Name: event_qr_codes event_qr_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.event_qr_codes
    ADD CONSTRAINT event_qr_codes_pkey PRIMARY KEY (id);


--
-- Name: fcm_tokens fcm_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fcm_tokens
    ADD CONSTRAINT fcm_tokens_pkey PRIMARY KEY (user_id, token);


--
-- Name: inquiries inquiries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inquiries
    ADD CONSTRAINT inquiries_pkey PRIMARY KEY (id);


--
-- Name: job_posting_collaborator_audit job_posting_collaborator_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_posting_collaborator_audit
    ADD CONSTRAINT job_posting_collaborator_audit_pkey PRIMARY KEY (id);


--
-- Name: job_posting_collaborators job_posting_collaborators_job_posting_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_posting_collaborators
    ADD CONSTRAINT job_posting_collaborators_job_posting_id_user_id_key UNIQUE (job_posting_id, user_id);


--
-- Name: job_posting_collaborators job_posting_collaborators_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_posting_collaborators
    ADD CONSTRAINT job_posting_collaborators_pkey PRIMARY KEY (id);


--
-- Name: job_posting_templates job_posting_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_posting_templates
    ADD CONSTRAINT job_posting_templates_pkey PRIMARY KEY (id);


--
-- Name: job_postings job_postings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_postings
    ADD CONSTRAINT job_postings_pkey PRIMARY KEY (id);


--
-- Name: notification_counters notification_counters_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_counters
    ADD CONSTRAINT notification_counters_pkey PRIMARY KEY (user_id);


--
-- Name: notification_settings notification_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_settings
    ADD CONSTRAINT notification_settings_pkey PRIMARY KEY (id);


--
-- Name: notification_settings notification_settings_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_settings
    ADD CONSTRAINT notification_settings_user_id_key UNIQUE (user_id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: ops_blind_levels ops_blind_levels_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ops_blind_levels
    ADD CONSTRAINT ops_blind_levels_pkey PRIMARY KEY (id);


--
-- Name: ops_blind_levels ops_blind_levels_sort_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ops_blind_levels
    ADD CONSTRAINT ops_blind_levels_sort_unique UNIQUE (tournament_id, sort);


--
-- Name: ops_clock ops_clock_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ops_clock
    ADD CONSTRAINT ops_clock_pkey PRIMARY KEY (tournament_id);


--
-- Name: ops_events ops_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ops_events
    ADD CONSTRAINT ops_events_pkey PRIMARY KEY (id);


--
-- Name: ops_live_stats ops_live_stats_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ops_live_stats
    ADD CONSTRAINT ops_live_stats_pkey PRIMARY KEY (tournament_id);


--
-- Name: ops_participants ops_participants_claim_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ops_participants
    ADD CONSTRAINT ops_participants_claim_token_key UNIQUE (view_token);


--
-- Name: ops_participants ops_participants_entry_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ops_participants
    ADD CONSTRAINT ops_participants_entry_unique UNIQUE (tournament_id, entry_number);


--
-- Name: ops_participants ops_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ops_participants
    ADD CONSTRAINT ops_participants_pkey PRIMARY KEY (id);


--
-- Name: ops_prizes ops_prizes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ops_prizes
    ADD CONSTRAINT ops_prizes_pkey PRIMARY KEY (id);


--
-- Name: ops_prizes ops_prizes_unique_rank; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ops_prizes
    ADD CONSTRAINT ops_prizes_unique_rank UNIQUE (tournament_id, rank);


--
-- Name: ops_seats ops_seats_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ops_seats
    ADD CONSTRAINT ops_seats_pkey PRIMARY KEY (id);


--
-- Name: ops_seats ops_seats_seat_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ops_seats
    ADD CONSTRAINT ops_seats_seat_unique UNIQUE (table_id, seat_no);


--
-- Name: ops_staff ops_staff_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ops_staff
    ADD CONSTRAINT ops_staff_pkey PRIMARY KEY (id);


--
-- Name: ops_staff ops_staff_tournament_id_staff_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ops_staff
    ADD CONSTRAINT ops_staff_tournament_id_staff_id_key UNIQUE (tournament_id, staff_id);


--
-- Name: ops_tables ops_tables_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ops_tables
    ADD CONSTRAINT ops_tables_pkey PRIMARY KEY (id);


--
-- Name: ops_tables ops_tables_table_no_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ops_tables
    ADD CONSTRAINT ops_tables_table_no_unique UNIQUE (tournament_id, table_no);


--
-- Name: ops_tournaments ops_tournaments_monitor_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ops_tournaments
    ADD CONSTRAINT ops_tournaments_monitor_token_key UNIQUE (monitor_token);


--
-- Name: ops_tournaments ops_tournaments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ops_tournaments
    ADD CONSTRAINT ops_tournaments_pkey PRIMARY KEY (id);


--
-- Name: processed_identity_verifications processed_identity_verifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.processed_identity_verifications
    ADD CONSTRAINT processed_identity_verifications_pkey PRIMARY KEY (verification_id);


--
-- Name: rate_limits rate_limits_key_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rate_limits
    ADD CONSTRAINT rate_limits_key_key UNIQUE (key);


--
-- Name: rate_limits rate_limits_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rate_limits
    ADD CONSTRAINT rate_limits_pkey PRIMARY KEY (id);


--
-- Name: reports reports_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_pkey PRIMARY KEY (id);


--
-- Name: reviews reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_pkey PRIMARY KEY (id);


--
-- Name: reviews reviews_work_log_reviewer_type_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_work_log_reviewer_type_key UNIQUE (work_log_id, reviewer_type);


--
-- Name: schedule_board_sync_outbox schedule_board_sync_outbox_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.schedule_board_sync_outbox
    ADD CONSTRAINT schedule_board_sync_outbox_pkey PRIMARY KEY (id);


--
-- Name: user_consents user_consents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_consents
    ADD CONSTRAINT user_consents_pkey PRIMARY KEY (id);


--
-- Name: users users_nickname_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_nickname_key UNIQUE (nickname);


--
-- Name: users users_phone_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_phone_key UNIQUE (phone);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: work_logs work_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_logs
    ADD CONSTRAINT work_logs_pkey PRIMARY KEY (id);


--
-- Name: workspace_invitations workspace_invitations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workspace_invitations
    ADD CONSTRAINT workspace_invitations_pkey PRIMARY KEY (id);


--
-- Name: workspace_members workspace_members_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workspace_members
    ADD CONSTRAINT workspace_members_pkey PRIMARY KEY (workspace_id, user_id);


--
-- Name: workspaces workspaces_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workspaces
    ADD CONSTRAINT workspaces_pkey PRIMARY KEY (id);


--
-- Name: idx_al_action; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_al_action ON public.action_logs USING btree (action, created_at DESC);


--
-- Name: idx_al_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_al_user ON public.action_logs USING btree (user_id) WHERE (user_id IS NOT NULL);


--
-- Name: idx_ann_author; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ann_author ON public.announcements USING btree (author_id);


--
-- Name: idx_ann_pinned; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ann_pinned ON public.announcements USING btree (is_pinned DESC, created_at DESC) WHERE (status = 'published'::public.announcement_status);


--
-- Name: idx_ann_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ann_status ON public.announcements USING btree (status, priority DESC, created_at DESC);


--
-- Name: idx_app_applicant; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_app_applicant ON public.applications USING btree (applicant_id, created_at DESC);


--
-- Name: idx_app_applicant_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_app_applicant_status ON public.applications USING btree (applicant_id, status, created_at DESC);


--
-- Name: idx_app_posting; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_app_posting ON public.applications USING btree (job_posting_id, created_at DESC);


--
-- Name: idx_app_posting_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_app_posting_status ON public.applications USING btree (job_posting_id, status, created_at DESC);


--
-- Name: idx_app_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_app_status ON public.applications USING btree (status);


--
-- Name: idx_bc_author; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bc_author ON public.board_comments USING btree (author_id);


--
-- Name: idx_bc_parent; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bc_parent ON public.board_comments USING btree (parent_comment_id);


--
-- Name: idx_bc_post; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bc_post ON public.board_comments USING btree (post_id, created_at);


--
-- Name: idx_bcr_post; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bcr_post ON public.board_comment_reactions USING btree (post_id);


--
-- Name: idx_bcr_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bcr_user ON public.board_comment_reactions USING btree (user_id);


--
-- Name: idx_bm_post; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bm_post ON public.board_memberships USING btree (post_id);


--
-- Name: idx_bm_posting; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bm_posting ON public.board_memberships USING btree (job_posting_id);


--
-- Name: idx_bm_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bm_user ON public.board_memberships USING btree (user_id);


--
-- Name: idx_bp_author; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bp_author ON public.board_posts USING btree (author_id);


--
-- Name: idx_bp_linked_jp; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bp_linked_jp ON public.board_posts USING btree (linked_job_posting_id) WHERE (linked_job_posting_id IS NOT NULL);


--
-- Name: idx_bp_type_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bp_type_created ON public.board_posts USING btree (board_type, created_at DESC);


--
-- Name: idx_br_post; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_br_post ON public.board_reports USING btree (post_id);


--
-- Name: idx_brep_reporter; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_brep_reporter ON public.board_reports USING btree (reporter_id);


--
-- Name: idx_bv_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bv_user ON public.board_votes USING btree (user_id);


--
-- Name: idx_employer_applications_pending; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_employer_applications_pending ON public.employer_applications USING btree (submitted_at) WHERE (status = 'pending'::text);


--
-- Name: idx_employer_applications_reviewed_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_employer_applications_reviewed_by ON public.employer_applications USING btree (reviewed_by);


--
-- Name: idx_employer_applications_supersedes_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_employer_applications_supersedes_id ON public.employer_applications USING btree (supersedes_id);


--
-- Name: idx_employer_applications_user_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_employer_applications_user_status ON public.employer_applications USING btree (user_id, status);


--
-- Name: idx_fcm_tokens_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_fcm_tokens_user_id ON public.fcm_tokens USING btree (user_id);


--
-- Name: idx_inq_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_inq_status ON public.inquiries USING btree (status);


--
-- Name: idx_inq_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_inq_user ON public.inquiries USING btree (user_id);


--
-- Name: idx_job_postings_location_region; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_job_postings_location_region ON public.job_postings USING btree (((location ->> 'region'::text))) WHERE ((location ->> 'region'::text) IS NOT NULL);


--
-- Name: idx_job_postings_venue_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_job_postings_venue_id ON public.job_postings USING btree (venue_id);


--
-- Name: idx_job_postings_workspace_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_job_postings_workspace_id ON public.job_postings USING btree (workspace_id) WHERE (workspace_id IS NOT NULL);


--
-- Name: idx_jp_last_work_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_jp_last_work_date ON public.job_postings USING btree (last_work_date) WHERE (status = ANY (ARRAY['approved'::public.posting_status, 'active'::public.posting_status, 'closed'::public.posting_status]));


--
-- Name: idx_jp_owner; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_jp_owner ON public.job_postings USING btree (owner_id);


--
-- Name: idx_jp_owner_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_jp_owner_created ON public.job_postings USING btree (owner_id, created_at DESC);


--
-- Name: idx_jp_owner_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_jp_owner_status ON public.job_postings USING btree (owner_id, status);


--
-- Name: idx_jp_status_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_jp_status_created ON public.job_postings USING btree (status, created_at DESC);


--
-- Name: idx_jp_type_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_jp_type_status ON public.job_postings USING btree (posting_type, status, created_at DESC);


--
-- Name: idx_jp_work_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_jp_work_date ON public.job_postings USING btree (work_date);


--
-- Name: idx_jpc_added_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_jpc_added_by ON public.job_posting_collaborators USING btree (added_by);


--
-- Name: idx_jpc_posting_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_jpc_posting_id ON public.job_posting_collaborators USING btree (job_posting_id);


--
-- Name: idx_jpc_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_jpc_user_id ON public.job_posting_collaborators USING btree (user_id);


--
-- Name: idx_jpca_posting_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_jpca_posting_id ON public.job_posting_collaborator_audit USING btree (job_posting_id, at DESC);


--
-- Name: idx_jpca_target_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_jpca_target_id ON public.job_posting_collaborator_audit USING btree (target_user_id, at DESC);


--
-- Name: idx_notif_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notif_category ON public.notifications USING btree (recipient_id, category, created_at DESC);


--
-- Name: idx_notif_recipient; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notif_recipient ON public.notifications USING btree (recipient_id, created_at DESC);


--
-- Name: idx_notif_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notif_type ON public.notifications USING btree (recipient_id, type, created_at DESC);


--
-- Name: idx_notif_unread; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notif_unread ON public.notifications USING btree (recipient_id) WHERE (is_read = false);


--
-- Name: idx_ops_events_tournament_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ops_events_tournament_created ON public.ops_events USING btree (tournament_id, created_at DESC);


--
-- Name: idx_ops_participants_tournament_finish; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ops_participants_tournament_finish ON public.ops_participants USING btree (tournament_id, finish_position);


--
-- Name: idx_ops_participants_tournament_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ops_participants_tournament_status ON public.ops_participants USING btree (tournament_id, status);


--
-- Name: idx_ops_prizes_tournament_rank; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ops_prizes_tournament_rank ON public.ops_prizes USING btree (tournament_id, rank);


--
-- Name: idx_ops_seats_table; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ops_seats_table ON public.ops_seats USING btree (table_id);


--
-- Name: idx_ops_seats_tournament; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ops_seats_tournament ON public.ops_seats USING btree (tournament_id);


--
-- Name: idx_ops_staff_source_work_log_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ops_staff_source_work_log_id ON public.ops_staff USING btree (source_work_log_id);


--
-- Name: idx_ops_staff_staff_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ops_staff_staff_id ON public.ops_staff USING btree (staff_id);


--
-- Name: idx_ops_tables_tournament; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ops_tables_tournament ON public.ops_tables USING btree (tournament_id);


--
-- Name: idx_ops_tournaments_job_posting_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ops_tournaments_job_posting_id ON public.ops_tournaments USING btree (job_posting_id) WHERE (job_posting_id IS NOT NULL);


--
-- Name: idx_ops_tournaments_owner_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ops_tournaments_owner_id ON public.ops_tournaments USING btree (owner_id);


--
-- Name: idx_ops_tournaments_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ops_tournaments_status ON public.ops_tournaments USING btree (status);


--
-- Name: idx_processed_iv_processed_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_processed_iv_processed_at ON public.processed_identity_verifications USING btree (processed_at DESC);


--
-- Name: idx_processed_iv_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_processed_iv_user_id ON public.processed_identity_verifications USING btree (user_id);


--
-- Name: idx_qr_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_qr_code ON public.event_qr_codes USING btree (code) WHERE (is_active = true);


--
-- Name: idx_qr_posting; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_qr_posting ON public.event_qr_codes USING btree (job_posting_id);


--
-- Name: idx_qr_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_qr_user ON public.event_qr_codes USING btree (user_id);


--
-- Name: idx_rep_job_posting; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rep_job_posting ON public.reports USING btree (job_posting_id);


--
-- Name: idx_rep_reporter; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rep_reporter ON public.reports USING btree (reporter_id);


--
-- Name: idx_rep_severity; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rep_severity ON public.reports USING btree (severity, status);


--
-- Name: idx_rep_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rep_status ON public.reports USING btree (status, created_at DESC);


--
-- Name: idx_rep_work_log; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rep_work_log ON public.reports USING btree (work_log_id);


--
-- Name: idx_rev_job_posting; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rev_job_posting ON public.reviews USING btree (job_posting_id);


--
-- Name: idx_rev_reviewee; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rev_reviewee ON public.reviews USING btree (reviewee_id, created_at DESC);


--
-- Name: idx_rev_reviewer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rev_reviewer ON public.reviews USING btree (reviewer_id, created_at DESC);


--
-- Name: idx_rev_worklog; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rev_worklog ON public.reviews USING btree (work_log_id);


--
-- Name: idx_rl_expires; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rl_expires ON public.rate_limits USING btree (expires_at);


--
-- Name: idx_schedule_board_sync_outbox_job_posting; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_schedule_board_sync_outbox_job_posting ON public.schedule_board_sync_outbox USING btree (job_posting_id);


--
-- Name: idx_schedule_board_sync_outbox_status_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_schedule_board_sync_outbox_status_created ON public.schedule_board_sync_outbox USING btree (status, created_at) WHERE (status = ANY (ARRAY['pending'::text, 'processing'::text]));


--
-- Name: idx_templates_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_templates_user ON public.job_posting_templates USING btree (user_id);


--
-- Name: idx_user_consents_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_consents_user ON public.user_consents USING btree (user_id);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: idx_users_role; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_role ON public.users USING btree (role);


--
-- Name: idx_users_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_status ON public.users USING btree (status);


--
-- Name: idx_wl_application; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wl_application ON public.work_logs USING btree (application_id);


--
-- Name: idx_wl_owner; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wl_owner ON public.work_logs USING btree (owner_id);


--
-- Name: idx_wl_payroll; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wl_payroll ON public.work_logs USING btree (payroll_status) WHERE (payroll_status = 'pending'::public.payroll_status);


--
-- Name: idx_wl_posting_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wl_posting_date ON public.work_logs USING btree (job_posting_id, date);


--
-- Name: idx_wl_posting_staff; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wl_posting_staff ON public.work_logs USING btree (job_posting_id, staff_id);


--
-- Name: idx_wl_staff_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wl_staff_date ON public.work_logs USING btree (staff_id, date DESC);


--
-- Name: idx_wl_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wl_status ON public.work_logs USING btree (status) WHERE (status <> ALL (ARRAY['completed'::public.work_log_status, 'cancelled'::public.work_log_status]));


--
-- Name: idx_work_logs_check_in_ts; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_work_logs_check_in_ts ON public.work_logs USING btree (check_in_ts);


--
-- Name: idx_work_logs_check_out_ts; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_work_logs_check_out_ts ON public.work_logs USING btree (check_out_ts);


--
-- Name: idx_workspace_invitations_expires_pending; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_workspace_invitations_expires_pending ON public.workspace_invitations USING btree (expires_at) WHERE (status = 'pending'::text);


--
-- Name: idx_workspace_invitations_invited_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_workspace_invitations_invited_by ON public.workspace_invitations USING btree (invited_by);


--
-- Name: idx_workspace_invitations_invitee_pending; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_workspace_invitations_invitee_pending ON public.workspace_invitations USING btree (invitee_user_id) WHERE (status = 'pending'::text);


--
-- Name: idx_workspace_invitations_workspace_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_workspace_invitations_workspace_status ON public.workspace_invitations USING btree (workspace_id, status);


--
-- Name: idx_workspace_members_invited_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_workspace_members_invited_by ON public.workspace_members USING btree (invited_by) WHERE (invited_by IS NOT NULL);


--
-- Name: idx_workspace_members_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_workspace_members_user_id ON public.workspace_members USING btree (user_id);


--
-- Name: idx_workspaces_owner_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_workspaces_owner_active ON public.workspaces USING btree (owner_id) WHERE (archived_at IS NULL);


--
-- Name: idx_workspaces_owner_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_workspaces_owner_id ON public.workspaces USING btree (owner_id);


--
-- Name: uniq_ops_participants_finish_position; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX uniq_ops_participants_finish_position ON public.ops_participants USING btree (tournament_id, finish_position) WHERE (finish_position IS NOT NULL);


--
-- Name: uniq_ops_seats_participant; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX uniq_ops_seats_participant ON public.ops_seats USING btree (tournament_id, participant_id) WHERE (participant_id IS NOT NULL);


--
-- Name: uniq_venue_container; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX uniq_venue_container ON public.job_postings USING btree (workspace_id, lower(title), ((schedule ->> 'kind'::text))) WHERE (status = 'container'::public.posting_status);


--
-- Name: uniq_workspace_invitations_pending; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX uniq_workspace_invitations_pending ON public.workspace_invitations USING btree (workspace_id, invitee_user_id) WHERE (status = 'pending'::text);


--
-- Name: uq_employer_applications_pending; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX uq_employer_applications_pending ON public.employer_applications USING btree (user_id) WHERE (status = 'pending'::text);


--
-- Name: INDEX uq_employer_applications_pending; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON INDEX public.uq_employer_applications_pending IS '동일 유저 pending 신청 1개만 허용 (동시 요청 race condition 차단).';


--
-- Name: uq_ops_tables_assigned_staff; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX uq_ops_tables_assigned_staff ON public.ops_tables USING btree (tournament_id, assigned_staff_id) WHERE (assigned_staff_id IS NOT NULL);


--
-- Name: users_identity_ci_hash_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX users_identity_ci_hash_idx ON public.users USING btree (identity_ci_hash) WHERE (identity_ci_hash IS NOT NULL);


--
-- Name: announcements announcements_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER announcements_updated_at BEFORE UPDATE ON public.announcements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: announcements announcements_xss_check; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER announcements_xss_check BEFORE INSERT OR UPDATE ON public.announcements FOR EACH ROW EXECUTE FUNCTION public.check_xss_fields('title', 'content');


--
-- Name: app_config app_config_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER app_config_updated_at BEFORE UPDATE ON public.app_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: applications application_notify_insert; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER application_notify_insert AFTER INSERT ON public.applications FOR EACH ROW EXECUTE FUNCTION public.notify_on_application_insert();


--
-- Name: applications application_notify_update; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER application_notify_update AFTER UPDATE ON public.applications FOR EACH ROW EXECUTE FUNCTION public.notify_on_application_update();


--
-- Name: applications applications_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER applications_updated_at BEFORE UPDATE ON public.applications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: applications applications_xss_check; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER applications_xss_check BEFORE INSERT OR UPDATE ON public.applications FOR EACH ROW EXECUTE FUNCTION public.check_xss_fields('message', 'notes');


--
-- Name: board_comments board_comment_notify_insert; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER board_comment_notify_insert AFTER INSERT ON public.board_comments FOR EACH ROW EXECUTE FUNCTION public.notify_on_board_comment_insert();


--
-- Name: board_comments board_comments_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER board_comments_updated_at BEFORE UPDATE ON public.board_comments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: board_comments board_comments_xss_check; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER board_comments_xss_check BEFORE INSERT OR UPDATE ON public.board_comments FOR EACH ROW EXECUTE FUNCTION public.check_xss_fields('body');


--
-- Name: board_memberships board_memberships_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER board_memberships_updated_at BEFORE UPDATE ON public.board_memberships FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: board_posts board_post_notify_update; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER board_post_notify_update AFTER UPDATE ON public.board_posts FOR EACH ROW EXECUTE FUNCTION public.notify_on_board_post_update();


--
-- Name: board_posts board_posts_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER board_posts_updated_at BEFORE UPDATE ON public.board_posts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: board_posts board_posts_xss_check; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER board_posts_xss_check BEFORE INSERT OR UPDATE ON public.board_posts FOR EACH ROW EXECUTE FUNCTION public.check_xss_fields('title', 'body');


--
-- Name: employer_applications employer_application_notification_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER employer_application_notification_trigger AFTER INSERT OR UPDATE ON public.employer_applications FOR EACH ROW EXECUTE FUNCTION public.notify_employer_application_change();


--
-- Name: inquiries inquiries_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER inquiries_updated_at BEFORE UPDATE ON public.inquiries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: inquiries inquiries_xss_check; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER inquiries_xss_check BEFORE INSERT OR UPDATE ON public.inquiries FOR EACH ROW EXECUTE FUNCTION public.check_xss_fields('subject', 'message');


--
-- Name: inquiries inquiry_notify_insert; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER inquiry_notify_insert AFTER INSERT ON public.inquiries FOR EACH ROW EXECUTE FUNCTION public.notify_on_inquiry_insert();


--
-- Name: job_postings job_posting_notify_insert; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER job_posting_notify_insert AFTER INSERT ON public.job_postings FOR EACH ROW EXECUTE FUNCTION public.notify_on_job_posting_insert();


--
-- Name: job_postings job_posting_notify_owner_expired; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER job_posting_notify_owner_expired AFTER UPDATE ON public.job_postings FOR EACH ROW EXECUTE FUNCTION public.notify_on_job_posting_owner_expired();


--
-- Name: job_postings job_posting_notify_update; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER job_posting_notify_update AFTER UPDATE ON public.job_postings FOR EACH ROW EXECUTE FUNCTION public.notify_on_job_posting_update();


--
-- Name: job_postings job_postings_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER job_postings_updated_at BEFORE UPDATE ON public.job_postings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: job_postings job_postings_xss_check; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER job_postings_xss_check BEFORE INSERT OR UPDATE ON public.job_postings FOR EACH ROW EXECUTE FUNCTION public.check_xss_fields('title', 'description');


--
-- Name: notifications on_notification_created; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER on_notification_created AFTER INSERT ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.increment_unread_counter();


--
-- Name: notifications on_notification_created_send_push; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER on_notification_created_send_push AFTER INSERT ON public.notifications REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION public.trigger_send_push_notification();


--
-- Name: users on_public_user_created_sync_role; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER on_public_user_created_sync_role AFTER INSERT ON public.users FOR EACH ROW EXECUTE FUNCTION public.sync_user_role_to_app_metadata();


--
-- Name: users on_public_user_role_changed; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER on_public_user_role_changed AFTER UPDATE OF role ON public.users FOR EACH ROW WHEN ((old.role IS DISTINCT FROM new.role)) EXECUTE FUNCTION public.sync_user_role_to_app_metadata();


--
-- Name: users prevent_role_escalation; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER prevent_role_escalation BEFORE UPDATE OF role ON public.users FOR EACH ROW EXECUTE FUNCTION public.prevent_role_self_escalation();


--
-- Name: work_logs protect_work_log_payroll; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER protect_work_log_payroll BEFORE UPDATE ON public.work_logs FOR EACH ROW EXECUTE FUNCTION public.protect_work_log_payroll_columns();


--
-- Name: reports report_notify_insert; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER report_notify_insert AFTER INSERT ON public.reports FOR EACH ROW EXECUTE FUNCTION public.notify_on_report_insert();


--
-- Name: reports reports_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER reports_updated_at BEFORE UPDATE ON public.reports FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: reports reports_xss_check; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER reports_xss_check BEFORE INSERT OR UPDATE ON public.reports FOR EACH ROW EXECUTE FUNCTION public.check_xss_fields('description');


--
-- Name: reviews review_notify_insert; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER review_notify_insert AFTER INSERT ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.notify_on_review_insert();


--
-- Name: job_posting_templates templates_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER templates_updated_at BEFORE UPDATE ON public.job_posting_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: board_comments tr_board_comment_count_sync; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tr_board_comment_count_sync AFTER INSERT OR DELETE OR UPDATE OF post_id ON public.board_comments FOR EACH ROW EXECUTE FUNCTION public.fn_board_comment_count_sync();


--
-- Name: job_postings tr_fixed_posting_expired; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tr_fixed_posting_expired BEFORE UPDATE ON public.job_postings FOR EACH ROW EXECUTE FUNCTION public.fn_fixed_posting_expired();


--
-- Name: notifications tr_notification_delete_decrement; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tr_notification_delete_decrement AFTER DELETE ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.fn_notification_delete_decrement();


--
-- Name: notifications tr_notification_read_decrement; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tr_notification_read_decrement AFTER UPDATE OF is_read ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.fn_notification_read_decrement();


--
-- Name: applications tr_notify_cancellation_request; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tr_notify_cancellation_request AFTER UPDATE ON public.applications FOR EACH ROW EXECUTE FUNCTION public.fn_notify_cancellation_request();


--
-- Name: inquiries tr_notify_inquiry_created; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tr_notify_inquiry_created AFTER INSERT ON public.inquiries FOR EACH ROW EXECUTE FUNCTION public.fn_notify_inquiry_created();


--
-- Name: reviews tr_notify_review_created; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tr_notify_review_created AFTER INSERT ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.fn_notify_review_created();


--
-- Name: job_postings tr_notify_tournament_approval; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tr_notify_tournament_approval AFTER INSERT OR UPDATE ON public.job_postings FOR EACH ROW EXECUTE FUNCTION public.fn_notify_tournament_approval();


--
-- Name: work_logs tr_notify_work_log_checkinout; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tr_notify_work_log_checkinout AFTER UPDATE OF check_in_ts, check_out_ts ON public.work_logs FOR EACH ROW EXECUTE FUNCTION public.notify_on_work_log_checkinout_update();


--
-- Name: work_logs tr_sync_application_completion; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tr_sync_application_completion AFTER UPDATE ON public.work_logs FOR EACH ROW WHEN ((old.status IS DISTINCT FROM new.status)) EXECUTE FUNCTION public.fn_sync_application_completion();


--
-- Name: applications tr_update_job_posting_stats; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tr_update_job_posting_stats AFTER INSERT OR DELETE OR UPDATE OF status ON public.applications FOR EACH ROW EXECUTE FUNCTION public.fn_update_job_posting_stats();


--
-- Name: job_postings trg_enforce_jp_status_transition; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_enforce_jp_status_transition BEFORE UPDATE OF status ON public.job_postings FOR EACH ROW WHEN ((new.status IS DISTINCT FROM old.status)) EXECUTE FUNCTION public.enforce_jp_status_transition();


--
-- Name: job_posting_collaborators trg_jpc_added_notify; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_jpc_added_notify AFTER INSERT ON public.job_posting_collaborators FOR EACH ROW EXECUTE FUNCTION public.notify_on_collaborator_added();


--
-- Name: job_posting_collaborators trg_jpc_removed_notify; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_jpc_removed_notify AFTER DELETE ON public.job_posting_collaborators FOR EACH ROW EXECUTE FUNCTION public.notify_on_collaborator_removed();


--
-- Name: job_posting_collaborators trg_jpca_log; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_jpca_log AFTER INSERT OR DELETE ON public.job_posting_collaborators FOR EACH ROW EXECUTE FUNCTION public.log_collaborator_audit();


--
-- Name: ops_blind_levels trg_ops_blind_levels_recompute_stats; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE CONSTRAINT TRIGGER trg_ops_blind_levels_recompute_stats AFTER INSERT OR DELETE OR UPDATE ON public.ops_blind_levels DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.fn_ops_live_stats_recompute_trigger();


--
-- Name: ops_blind_levels trg_ops_blind_levels_set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_ops_blind_levels_set_updated_at BEFORE UPDATE ON public.ops_blind_levels FOR EACH ROW EXECUTE FUNCTION public.fn_ops_set_updated_at();


--
-- Name: ops_clock trg_ops_clock_recompute_stats; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE CONSTRAINT TRIGGER trg_ops_clock_recompute_stats AFTER UPDATE ON public.ops_clock DEFERRABLE INITIALLY DEFERRED FOR EACH ROW WHEN ((old.current_level_sort IS DISTINCT FROM new.current_level_sort)) EXECUTE FUNCTION public.fn_ops_live_stats_recompute_trigger();


--
-- Name: ops_clock trg_ops_clock_set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_ops_clock_set_updated_at BEFORE UPDATE ON public.ops_clock FOR EACH ROW EXECUTE FUNCTION public.fn_ops_set_updated_at();


--
-- Name: ops_events trg_ops_events_append_only; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_ops_events_append_only BEFORE DELETE OR UPDATE ON public.ops_events FOR EACH ROW EXECUTE FUNCTION public.fn_ops_events_append_only();


--
-- Name: ops_tournaments trg_ops_init_derived_rows; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_ops_init_derived_rows AFTER INSERT ON public.ops_tournaments FOR EACH ROW EXECUTE FUNCTION public.fn_ops_init_derived_rows();


--
-- Name: ops_live_stats trg_ops_live_stats_set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_ops_live_stats_set_updated_at BEFORE UPDATE ON public.ops_live_stats FOR EACH ROW EXECUTE FUNCTION public.fn_ops_set_updated_at();


--
-- Name: ops_participants trg_ops_participants_recompute_stats; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE CONSTRAINT TRIGGER trg_ops_participants_recompute_stats AFTER INSERT OR DELETE OR UPDATE ON public.ops_participants DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.fn_ops_live_stats_recompute_trigger();


--
-- Name: ops_participants trg_ops_participants_set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_ops_participants_set_updated_at BEFORE UPDATE ON public.ops_participants FOR EACH ROW EXECUTE FUNCTION public.fn_ops_set_updated_at();


--
-- Name: ops_prizes trg_ops_prizes_set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_ops_prizes_set_updated_at BEFORE UPDATE ON public.ops_prizes FOR EACH ROW EXECUTE FUNCTION public.fn_ops_set_updated_at();


--
-- Name: ops_seats trg_ops_seats_recompute_stats; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE CONSTRAINT TRIGGER trg_ops_seats_recompute_stats AFTER INSERT OR DELETE OR UPDATE ON public.ops_seats DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.fn_ops_live_stats_recompute_trigger();


--
-- Name: ops_seats trg_ops_seats_set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_ops_seats_set_updated_at BEFORE UPDATE ON public.ops_seats FOR EACH ROW EXECUTE FUNCTION public.fn_ops_set_updated_at();


--
-- Name: ops_tables trg_ops_tables_recompute_stats; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE CONSTRAINT TRIGGER trg_ops_tables_recompute_stats AFTER INSERT OR DELETE OR UPDATE ON public.ops_tables DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.fn_ops_live_stats_recompute_trigger();


--
-- Name: ops_tables trg_ops_tables_set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_ops_tables_set_updated_at BEFORE UPDATE ON public.ops_tables FOR EACH ROW EXECUTE FUNCTION public.fn_ops_set_updated_at();


--
-- Name: ops_tournaments trg_ops_tournaments_recompute_stats; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE CONSTRAINT TRIGGER trg_ops_tournaments_recompute_stats AFTER UPDATE ON public.ops_tournaments DEFERRABLE INITIALLY DEFERRED FOR EACH ROW WHEN (((old.buy_in_cost IS DISTINCT FROM new.buy_in_cost) OR (old.rebuy_cost IS DISTINCT FROM new.rebuy_cost) OR (old.addon_cost IS DISTINCT FROM new.addon_cost) OR (old.bounty_cost IS DISTINCT FROM new.bounty_cost))) EXECUTE FUNCTION public.fn_ops_live_stats_recompute_trigger_tournaments();


--
-- Name: ops_tournaments trg_ops_tournaments_set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_ops_tournaments_set_updated_at BEFORE UPDATE ON public.ops_tournaments FOR EACH ROW EXECUTE FUNCTION public.fn_ops_set_updated_at();


--
-- Name: workspace_members trg_sync_workspace_member_count; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_sync_workspace_member_count AFTER INSERT OR DELETE ON public.workspace_members FOR EACH ROW EXECUTE FUNCTION public.fn_sync_workspace_member_count();


--
-- Name: workspaces trg_workspaces_set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_workspaces_set_updated_at BEFORE UPDATE ON public.workspaces FOR EACH ROW EXECUTE FUNCTION public.fn_workspaces_set_updated_at();


--
-- Name: notification_settings update_notification_settings_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_notification_settings_updated_at BEFORE UPDATE ON public.notification_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: users users_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: users users_xss_check; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER users_xss_check BEFORE INSERT OR UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.check_xss_fields('name', 'nickname', 'note', 'career');


--
-- Name: work_logs work_log_notify_insert; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER work_log_notify_insert AFTER INSERT ON public.work_logs FOR EACH ROW EXECUTE FUNCTION public.notify_on_work_log_insert();


--
-- Name: work_logs work_log_notify_no_show_update; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER work_log_notify_no_show_update AFTER UPDATE ON public.work_logs FOR EACH ROW EXECUTE FUNCTION public.notify_on_work_log_no_show_update();


--
-- Name: work_logs work_log_notify_update; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER work_log_notify_update AFTER UPDATE ON public.work_logs FOR EACH ROW EXECUTE FUNCTION public.notify_on_work_log_update();


--
-- Name: work_logs work_logs_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER work_logs_updated_at BEFORE UPDATE ON public.work_logs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: workspace_invitations workspace_invitation_notify_insert; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER workspace_invitation_notify_insert AFTER INSERT ON public.workspace_invitations FOR EACH ROW EXECUTE FUNCTION public.notify_on_workspace_invitation_insert();


--
-- Name: announcements announcements_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id);


--
-- Name: applications applications_applicant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_applicant_id_fkey FOREIGN KEY (applicant_id) REFERENCES public.users(id);


--
-- Name: applications applications_job_posting_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_job_posting_id_fkey FOREIGN KEY (job_posting_id) REFERENCES public.job_postings(id);


--
-- Name: board_comment_reactions board_comment_reactions_comment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.board_comment_reactions
    ADD CONSTRAINT board_comment_reactions_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES public.board_comments(id) ON DELETE CASCADE;


--
-- Name: board_comment_reactions board_comment_reactions_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.board_comment_reactions
    ADD CONSTRAINT board_comment_reactions_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.board_posts(id) ON DELETE CASCADE;


--
-- Name: board_comment_reactions board_comment_reactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.board_comment_reactions
    ADD CONSTRAINT board_comment_reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: board_comments board_comments_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.board_comments
    ADD CONSTRAINT board_comments_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id);


--
-- Name: board_comments board_comments_parent_comment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.board_comments
    ADD CONSTRAINT board_comments_parent_comment_id_fkey FOREIGN KEY (parent_comment_id) REFERENCES public.board_comments(id);


--
-- Name: board_comments board_comments_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.board_comments
    ADD CONSTRAINT board_comments_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.board_posts(id) ON DELETE CASCADE;


--
-- Name: board_memberships board_memberships_job_posting_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.board_memberships
    ADD CONSTRAINT board_memberships_job_posting_id_fkey FOREIGN KEY (job_posting_id) REFERENCES public.job_postings(id);


--
-- Name: board_memberships board_memberships_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.board_memberships
    ADD CONSTRAINT board_memberships_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.board_posts(id) ON DELETE CASCADE;


--
-- Name: board_memberships board_memberships_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.board_memberships
    ADD CONSTRAINT board_memberships_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: board_posts board_posts_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.board_posts
    ADD CONSTRAINT board_posts_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id);


--
-- Name: board_posts board_posts_linked_job_posting_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.board_posts
    ADD CONSTRAINT board_posts_linked_job_posting_id_fkey FOREIGN KEY (linked_job_posting_id) REFERENCES public.job_postings(id);


--
-- Name: board_reports board_reports_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.board_reports
    ADD CONSTRAINT board_reports_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.board_posts(id) ON DELETE CASCADE;


--
-- Name: board_reports board_reports_reporter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.board_reports
    ADD CONSTRAINT board_reports_reporter_id_fkey FOREIGN KEY (reporter_id) REFERENCES public.users(id);


--
-- Name: board_votes board_votes_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.board_votes
    ADD CONSTRAINT board_votes_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.board_posts(id) ON DELETE CASCADE;


--
-- Name: board_votes board_votes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.board_votes
    ADD CONSTRAINT board_votes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: employer_applications employer_applications_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employer_applications
    ADD CONSTRAINT employer_applications_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id);


--
-- Name: employer_applications employer_applications_supersedes_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employer_applications
    ADD CONSTRAINT employer_applications_supersedes_id_fkey FOREIGN KEY (supersedes_id) REFERENCES public.employer_applications(id);


--
-- Name: employer_applications employer_applications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employer_applications
    ADD CONSTRAINT employer_applications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: event_qr_codes event_qr_codes_job_posting_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.event_qr_codes
    ADD CONSTRAINT event_qr_codes_job_posting_id_fkey FOREIGN KEY (job_posting_id) REFERENCES public.job_postings(id);


--
-- Name: event_qr_codes event_qr_codes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.event_qr_codes
    ADD CONSTRAINT event_qr_codes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: fcm_tokens fcm_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fcm_tokens
    ADD CONSTRAINT fcm_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: inquiries inquiries_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inquiries
    ADD CONSTRAINT inquiries_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: job_posting_collaborators job_posting_collaborators_added_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_posting_collaborators
    ADD CONSTRAINT job_posting_collaborators_added_by_fkey FOREIGN KEY (added_by) REFERENCES auth.users(id);


--
-- Name: job_posting_collaborators job_posting_collaborators_job_posting_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_posting_collaborators
    ADD CONSTRAINT job_posting_collaborators_job_posting_id_fkey FOREIGN KEY (job_posting_id) REFERENCES public.job_postings(id) ON DELETE CASCADE;


--
-- Name: job_posting_collaborators job_posting_collaborators_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_posting_collaborators
    ADD CONSTRAINT job_posting_collaborators_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: job_posting_collaborators job_posting_collaborators_user_id_public_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_posting_collaborators
    ADD CONSTRAINT job_posting_collaborators_user_id_public_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: job_posting_templates job_posting_templates_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_posting_templates
    ADD CONSTRAINT job_posting_templates_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: job_postings job_postings_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_postings
    ADD CONSTRAINT job_postings_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id);


--
-- Name: job_postings job_postings_venue_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_postings
    ADD CONSTRAINT job_postings_venue_id_fkey FOREIGN KEY (venue_id) REFERENCES public.job_postings(id);


--
-- Name: job_postings job_postings_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_postings
    ADD CONSTRAINT job_postings_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE RESTRICT;


--
-- Name: notification_counters notification_counters_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_counters
    ADD CONSTRAINT notification_counters_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: notification_settings notification_settings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_settings
    ADD CONSTRAINT notification_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_recipient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: ops_blind_levels ops_blind_levels_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ops_blind_levels
    ADD CONSTRAINT ops_blind_levels_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.ops_tournaments(id) ON DELETE CASCADE;


--
-- Name: ops_clock ops_clock_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ops_clock
    ADD CONSTRAINT ops_clock_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.ops_tournaments(id) ON DELETE CASCADE;


--
-- Name: ops_events ops_events_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ops_events
    ADD CONSTRAINT ops_events_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: ops_events ops_events_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ops_events
    ADD CONSTRAINT ops_events_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.ops_tournaments(id) ON DELETE CASCADE;


--
-- Name: ops_live_stats ops_live_stats_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ops_live_stats
    ADD CONSTRAINT ops_live_stats_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.ops_tournaments(id) ON DELETE CASCADE;


--
-- Name: ops_participants ops_participants_player_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ops_participants
    ADD CONSTRAINT ops_participants_player_user_id_fkey FOREIGN KEY (player_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: ops_participants ops_participants_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ops_participants
    ADD CONSTRAINT ops_participants_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.ops_tournaments(id) ON DELETE CASCADE;


--
-- Name: ops_prizes ops_prizes_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ops_prizes
    ADD CONSTRAINT ops_prizes_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.ops_tournaments(id) ON DELETE CASCADE;


--
-- Name: ops_seats ops_seats_participant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ops_seats
    ADD CONSTRAINT ops_seats_participant_id_fkey FOREIGN KEY (participant_id) REFERENCES public.ops_participants(id) ON DELETE SET NULL;


--
-- Name: ops_seats ops_seats_table_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ops_seats
    ADD CONSTRAINT ops_seats_table_id_fkey FOREIGN KEY (table_id) REFERENCES public.ops_tables(id) ON DELETE CASCADE;


--
-- Name: ops_seats ops_seats_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ops_seats
    ADD CONSTRAINT ops_seats_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.ops_tournaments(id) ON DELETE CASCADE;


--
-- Name: ops_staff ops_staff_source_work_log_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ops_staff
    ADD CONSTRAINT ops_staff_source_work_log_id_fkey FOREIGN KEY (source_work_log_id) REFERENCES public.work_logs(id) ON DELETE SET NULL;


--
-- Name: ops_staff ops_staff_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ops_staff
    ADD CONSTRAINT ops_staff_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: ops_staff ops_staff_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ops_staff
    ADD CONSTRAINT ops_staff_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.ops_tournaments(id) ON DELETE CASCADE;


--
-- Name: ops_tables ops_tables_assigned_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ops_tables
    ADD CONSTRAINT ops_tables_assigned_staff_id_fkey FOREIGN KEY (assigned_staff_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: ops_tables ops_tables_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ops_tables
    ADD CONSTRAINT ops_tables_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.ops_tournaments(id) ON DELETE CASCADE;


--
-- Name: ops_tournaments ops_tournaments_job_posting_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ops_tournaments
    ADD CONSTRAINT ops_tournaments_job_posting_id_fkey FOREIGN KEY (job_posting_id) REFERENCES public.job_postings(id) ON DELETE SET NULL;


--
-- Name: ops_tournaments ops_tournaments_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ops_tournaments
    ADD CONSTRAINT ops_tournaments_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: processed_identity_verifications processed_identity_verifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.processed_identity_verifications
    ADD CONSTRAINT processed_identity_verifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: reports reports_job_posting_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_job_posting_id_fkey FOREIGN KEY (job_posting_id) REFERENCES public.job_postings(id);


--
-- Name: reports reports_reporter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_reporter_id_fkey FOREIGN KEY (reporter_id) REFERENCES public.users(id);


--
-- Name: reports reports_work_log_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_work_log_id_fkey FOREIGN KEY (work_log_id) REFERENCES public.work_logs(id);


--
-- Name: reviews reviews_job_posting_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_job_posting_id_fkey FOREIGN KEY (job_posting_id) REFERENCES public.job_postings(id);


--
-- Name: reviews reviews_reviewee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_reviewee_id_fkey FOREIGN KEY (reviewee_id) REFERENCES public.users(id);


--
-- Name: reviews reviews_reviewer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES public.users(id);


--
-- Name: reviews reviews_work_log_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_work_log_id_fkey FOREIGN KEY (work_log_id) REFERENCES public.work_logs(id);


--
-- Name: user_consents user_consents_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_consents
    ADD CONSTRAINT user_consents_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users users_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: work_logs work_logs_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_logs
    ADD CONSTRAINT work_logs_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.applications(id);


--
-- Name: work_logs work_logs_edited_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_logs
    ADD CONSTRAINT work_logs_edited_by_fkey FOREIGN KEY (edited_by) REFERENCES public.users(id);


--
-- Name: work_logs work_logs_job_posting_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_logs
    ADD CONSTRAINT work_logs_job_posting_id_fkey FOREIGN KEY (job_posting_id) REFERENCES public.job_postings(id);


--
-- Name: work_logs work_logs_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_logs
    ADD CONSTRAINT work_logs_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id);


--
-- Name: work_logs work_logs_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_logs
    ADD CONSTRAINT work_logs_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.users(id);


--
-- Name: workspace_invitations workspace_invitations_invited_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workspace_invitations
    ADD CONSTRAINT workspace_invitations_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: workspace_invitations workspace_invitations_invitee_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workspace_invitations
    ADD CONSTRAINT workspace_invitations_invitee_user_id_fkey FOREIGN KEY (invitee_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: workspace_invitations workspace_invitations_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workspace_invitations
    ADD CONSTRAINT workspace_invitations_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: workspace_members workspace_members_invited_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workspace_members
    ADD CONSTRAINT workspace_members_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: workspace_members workspace_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workspace_members
    ADD CONSTRAINT workspace_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: workspace_members workspace_members_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workspace_members
    ADD CONSTRAINT workspace_members_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: workspaces workspaces_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workspaces
    ADD CONSTRAINT workspaces_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: notification_settings Users can insert own notification settings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert own notification settings" ON public.notification_settings FOR INSERT WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: notification_settings Users can update own notification settings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update own notification settings" ON public.notification_settings FOR UPDATE USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: notification_counters Users can update own unread counter; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update own unread counter" ON public.notification_counters FOR UPDATE USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: notification_settings Users can view own notification settings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own notification settings" ON public.notification_settings FOR SELECT USING (((( SELECT auth.uid() AS uid) = user_id) OR ( SELECT public.is_admin() AS is_admin)));


--
-- Name: notification_counters Users can view own unread counter; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own unread counter" ON public.notification_counters FOR SELECT USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: action_logs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.action_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: action_logs al_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY al_select ON public.action_logs FOR SELECT USING ((( SELECT public.get_my_role() AS get_my_role) = 'admin'::text));


--
-- Name: announcements; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

--
-- Name: announcements announcements_delete_admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY announcements_delete_admin ON public.announcements FOR DELETE TO authenticated USING (( SELECT public.is_admin() AS is_admin));


--
-- Name: announcements announcements_insert_admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY announcements_insert_admin ON public.announcements FOR INSERT TO authenticated WITH CHECK (( SELECT public.is_admin() AS is_admin));


--
-- Name: announcements announcements_select_published; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY announcements_select_published ON public.announcements FOR SELECT TO authenticated USING ((((status = 'published'::public.announcement_status) AND (((target_audience ->> 'type'::text) = 'all'::text) OR (((target_audience ->> 'type'::text) = 'roles'::text) AND ((target_audience -> 'roles'::text) @> to_jsonb(( SELECT public.get_my_role() AS get_my_role)))))) OR ( SELECT public.is_admin() AS is_admin)));


--
-- Name: announcements announcements_update_admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY announcements_update_admin ON public.announcements FOR UPDATE TO authenticated USING (( SELECT public.is_admin() AS is_admin)) WITH CHECK (( SELECT public.is_admin() AS is_admin));


--
-- Name: app_config; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

--
-- Name: applications app_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY app_insert ON public.applications FOR INSERT WITH CHECK ((( SELECT auth.uid() AS uid) = applicant_id));


--
-- Name: applications app_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY app_select ON public.applications FOR SELECT USING (((applicant_id = ( SELECT auth.uid() AS uid)) OR (job_posting_id IN ( SELECT job_postings.id
   FROM public.job_postings
  WHERE ((job_postings.owner_id = ( SELECT auth.uid() AS uid)) OR public.is_workspace_member(job_postings.workspace_id, ( SELECT auth.uid() AS uid)) OR public.is_posting_collaborator(job_postings.id, ( SELECT auth.uid() AS uid)))))));


--
-- Name: applications app_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY app_update ON public.applications FOR UPDATE USING (((applicant_id = ( SELECT auth.uid() AS uid)) OR (job_posting_id IN ( SELECT job_postings.id
   FROM public.job_postings
  WHERE ((job_postings.owner_id = ( SELECT auth.uid() AS uid)) OR public.is_workspace_member(job_postings.workspace_id, ( SELECT auth.uid() AS uid)) OR public.is_posting_collaborator(job_postings.id, ( SELECT auth.uid() AS uid)))))));


--
-- Name: applications; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

--
-- Name: applications applications_delete_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY applications_delete_own ON public.applications FOR DELETE TO authenticated USING (((applicant_id = ( SELECT auth.uid() AS uid)) AND (status = ANY (ARRAY['applied'::public.application_status, 'cancelled'::public.application_status]))));


--
-- Name: job_posting_collaborator_audit audit_select_owner; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY audit_select_owner ON public.job_posting_collaborator_audit FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.job_postings jp
     JOIN public.workspaces w ON ((w.id = jp.workspace_id)))
  WHERE ((jp.id = job_posting_collaborator_audit.job_posting_id) AND (w.owner_id = ( SELECT auth.uid() AS uid))))));


--
-- Name: board_comments bc_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY bc_delete ON public.board_comments FOR DELETE USING (((author_id = ( SELECT auth.uid() AS uid)) OR (( SELECT public.get_my_role() AS get_my_role) = 'admin'::text)));


--
-- Name: board_comments bc_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY bc_insert ON public.board_comments FOR INSERT WITH CHECK ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: board_comments bc_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY bc_select ON public.board_comments FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.board_posts bp
  WHERE ((bp.id = board_comments.post_id) AND ((bp.visibility = 'public'::text) OR (bp.author_id = ( SELECT auth.uid() AS uid)) OR (( SELECT public.get_my_role() AS get_my_role) = 'admin'::text) OR (EXISTS ( SELECT 1
           FROM public.board_memberships bm
          WHERE ((bm.user_id = ( SELECT auth.uid() AS uid)) AND (bm.post_id = bp.id)))))))));


--
-- Name: board_comments bc_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY bc_update ON public.board_comments FOR UPDATE USING (((author_id = ( SELECT auth.uid() AS uid)) OR (( SELECT public.get_my_role() AS get_my_role) = 'admin'::text)));


--
-- Name: board_memberships bm_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY bm_insert ON public.board_memberships FOR INSERT WITH CHECK ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: board_memberships bm_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY bm_select ON public.board_memberships FOR SELECT USING (((user_id = ( SELECT auth.uid() AS uid)) OR (( SELECT public.get_my_role() AS get_my_role) = 'admin'::text)));


--
-- Name: board_comment_reactions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.board_comment_reactions ENABLE ROW LEVEL SECURITY;

--
-- Name: board_comments; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.board_comments ENABLE ROW LEVEL SECURITY;

--
-- Name: board_memberships; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.board_memberships ENABLE ROW LEVEL SECURITY;

--
-- Name: board_memberships board_memberships_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY board_memberships_delete ON public.board_memberships FOR DELETE USING (((user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT public.is_admin() AS is_admin)));


--
-- Name: board_posts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.board_posts ENABLE ROW LEVEL SECURITY;

--
-- Name: board_reports; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.board_reports ENABLE ROW LEVEL SECURITY;

--
-- Name: board_votes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.board_votes ENABLE ROW LEVEL SECURITY;

--
-- Name: board_posts bp_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY bp_delete ON public.board_posts FOR DELETE USING (((author_id = ( SELECT auth.uid() AS uid)) OR (( SELECT public.get_my_role() AS get_my_role) = 'admin'::text)));


--
-- Name: board_posts bp_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY bp_insert ON public.board_posts FOR INSERT WITH CHECK ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: board_posts bp_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY bp_select ON public.board_posts FOR SELECT USING (((visibility = 'public'::text) OR (author_id = ( SELECT auth.uid() AS uid)) OR (( SELECT public.get_my_role() AS get_my_role) = 'admin'::text) OR (EXISTS ( SELECT 1
   FROM public.board_memberships
  WHERE ((board_memberships.user_id = ( SELECT auth.uid() AS uid)) AND (board_memberships.post_id = board_posts.id))))));


--
-- Name: board_posts bp_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY bp_update ON public.board_posts FOR UPDATE USING (((author_id = ( SELECT auth.uid() AS uid)) OR (( SELECT public.get_my_role() AS get_my_role) = 'admin'::text)));


--
-- Name: board_reports brep_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY brep_insert ON public.board_reports FOR INSERT WITH CHECK ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: board_reports brep_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY brep_select ON public.board_reports FOR SELECT USING (((reporter_id = ( SELECT auth.uid() AS uid)) OR (( SELECT public.get_my_role() AS get_my_role) = 'admin'::text)));


--
-- Name: board_votes bv_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY bv_delete ON public.board_votes FOR DELETE USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: board_votes bv_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY bv_insert ON public.board_votes FOR INSERT WITH CHECK ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: board_votes bv_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY bv_select ON public.board_votes FOR SELECT USING ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: board_votes bv_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY bv_update ON public.board_votes FOR UPDATE USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: app_config config_admin_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY config_admin_delete ON public.app_config FOR DELETE TO authenticated USING (( SELECT public.is_admin() AS is_admin));


--
-- Name: app_config config_admin_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY config_admin_insert ON public.app_config FOR INSERT TO authenticated WITH CHECK (( SELECT public.is_admin() AS is_admin));


--
-- Name: app_config config_admin_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY config_admin_update ON public.app_config FOR UPDATE TO authenticated USING (( SELECT public.is_admin() AS is_admin));


--
-- Name: app_config config_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY config_select ON public.app_config FOR SELECT TO authenticated, anon USING (true);


--
-- Name: user_consents consents_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY consents_insert ON public.user_consents FOR INSERT WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: user_consents consents_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY consents_select ON public.user_consents FOR SELECT USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: employer_applications; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.employer_applications ENABLE ROW LEVEL SECURITY;

--
-- Name: employer_applications employer_applications_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY employer_applications_select ON public.employer_applications FOR SELECT USING (((( SELECT auth.uid() AS uid) = user_id) OR (((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)));


--
-- Name: event_qr_codes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.event_qr_codes ENABLE ROW LEVEL SECURITY;

--
-- Name: fcm_tokens; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.fcm_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: fcm_tokens fcm_tokens_delete_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY fcm_tokens_delete_own ON public.fcm_tokens FOR DELETE USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: fcm_tokens fcm_tokens_insert_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY fcm_tokens_insert_own ON public.fcm_tokens FOR INSERT WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: fcm_tokens fcm_tokens_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY fcm_tokens_select ON public.fcm_tokens FOR SELECT USING (((( SELECT auth.uid() AS uid) = user_id) OR (((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)));


--
-- Name: fcm_tokens fcm_tokens_update_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY fcm_tokens_update_own ON public.fcm_tokens FOR UPDATE USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: inquiries inq_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY inq_insert ON public.inquiries FOR INSERT WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: inquiries inq_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY inq_select ON public.inquiries FOR SELECT USING (((user_id = ( SELECT auth.uid() AS uid)) OR (( SELECT public.get_my_role() AS get_my_role) = 'admin'::text)));


--
-- Name: inquiries inq_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY inq_update ON public.inquiries FOR UPDATE USING ((( SELECT public.get_my_role() AS get_my_role) = 'admin'::text));


--
-- Name: inquiries; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;

--
-- Name: inquiries inquiries_delete_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY inquiries_delete_own ON public.inquiries FOR DELETE TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) AND (status = 'open'::public.inquiry_status)));


--
-- Name: job_posting_collaborator_audit; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.job_posting_collaborator_audit ENABLE ROW LEVEL SECURITY;

--
-- Name: job_posting_collaborators; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.job_posting_collaborators ENABLE ROW LEVEL SECURITY;

--
-- Name: job_posting_templates; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.job_posting_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: job_postings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.job_postings ENABLE ROW LEVEL SECURITY;

--
-- Name: job_postings job_postings_select_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY job_postings_select_all ON public.job_postings FOR SELECT USING ((status = ANY (ARRAY['approved'::public.posting_status, 'active'::public.posting_status, 'capacity_full'::public.posting_status, 'closed'::public.posting_status])));


--
-- Name: job_postings jp_container_no_direct_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY jp_container_no_direct_insert ON public.job_postings AS RESTRICTIVE FOR INSERT WITH CHECK ((status <> 'container'::public.posting_status));


--
-- Name: job_postings jp_container_no_direct_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY jp_container_no_direct_update ON public.job_postings AS RESTRICTIVE FOR UPDATE USING ((status <> 'container'::public.posting_status)) WITH CHECK ((status <> 'container'::public.posting_status));


--
-- Name: job_postings jp_delete_workspace_owner; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY jp_delete_workspace_owner ON public.job_postings FOR DELETE TO authenticated USING (((workspace_id IN ( SELECT workspaces.id
   FROM public.workspaces
  WHERE (workspaces.owner_id = ( SELECT auth.uid() AS uid)))) OR ( SELECT public.is_admin() AS is_admin)));


--
-- Name: job_postings jp_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY jp_insert ON public.job_postings FOR INSERT WITH CHECK ((( SELECT public.get_my_role() AS get_my_role) = ANY (ARRAY['admin'::text, 'employer'::text])));


--
-- Name: job_postings jp_select_managed; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY jp_select_managed ON public.job_postings FOR SELECT TO authenticated USING (((owner_id = ( SELECT auth.uid() AS uid)) OR public.is_workspace_member(workspace_id, ( SELECT auth.uid() AS uid)) OR public.is_posting_collaborator(id, ( SELECT auth.uid() AS uid))));


--
-- Name: job_postings jp_select_public_search; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY jp_select_public_search ON public.job_postings FOR SELECT USING ((status = ANY (ARRAY['approved'::public.posting_status, 'active'::public.posting_status, 'capacity_full'::public.posting_status, 'closed'::public.posting_status])));


--
-- Name: job_postings jp_update_workspace_member; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY jp_update_workspace_member ON public.job_postings FOR UPDATE USING ((public.is_workspace_member(workspace_id, ( SELECT auth.uid() AS uid)) OR public.is_posting_collaborator(id, ( SELECT auth.uid() AS uid)) OR ( SELECT public.is_admin() AS is_admin))) WITH CHECK ((public.is_workspace_member(workspace_id, ( SELECT auth.uid() AS uid)) OR public.is_posting_collaborator(id, ( SELECT auth.uid() AS uid)) OR ( SELECT public.is_admin() AS is_admin)));


--
-- Name: job_posting_collaborators jpc_delete_owner_or_self; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY jpc_delete_owner_or_self ON public.job_posting_collaborators FOR DELETE USING (((user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM (public.job_postings jp
     JOIN public.workspaces w ON ((w.id = jp.workspace_id)))
  WHERE ((jp.id = job_posting_collaborators.job_posting_id) AND (w.owner_id = ( SELECT auth.uid() AS uid)))))));


--
-- Name: job_posting_collaborators jpc_insert_ws_owner; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY jpc_insert_ws_owner ON public.job_posting_collaborators FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM (public.job_postings jp
     JOIN public.workspaces w ON ((w.id = jp.workspace_id)))
  WHERE ((jp.id = job_posting_collaborators.job_posting_id) AND (w.owner_id = ( SELECT auth.uid() AS uid))))) AND (added_by = ( SELECT auth.uid() AS uid))));


--
-- Name: job_posting_collaborators jpc_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY jpc_select ON public.job_posting_collaborators FOR SELECT USING (((user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM public.job_postings jp
  WHERE ((jp.id = job_posting_collaborators.job_posting_id) AND public.is_workspace_member(jp.workspace_id, ( SELECT auth.uid() AS uid)))))));


--
-- Name: notifications notif_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY notif_delete ON public.notifications FOR DELETE USING (((recipient_id = ( SELECT auth.uid() AS uid)) OR (( SELECT public.get_my_role() AS get_my_role) = 'admin'::text)));


--
-- Name: notifications notif_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY notif_select ON public.notifications FOR SELECT USING ((recipient_id = ( SELECT auth.uid() AS uid)));


--
-- Name: notifications notif_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY notif_update ON public.notifications FOR UPDATE USING ((recipient_id = ( SELECT auth.uid() AS uid)));


--
-- Name: notification_counters; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.notification_counters ENABLE ROW LEVEL SECURITY;

--
-- Name: notification_settings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: ops_blind_levels; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.ops_blind_levels ENABLE ROW LEVEL SECURITY;

--
-- Name: ops_blind_levels ops_blind_levels_select_member; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY ops_blind_levels_select_member ON public.ops_blind_levels FOR SELECT TO authenticated USING ((public.is_ops_member(tournament_id, ( SELECT auth.uid() AS uid)) OR ( SELECT public.is_admin() AS is_admin)));


--
-- Name: ops_clock; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.ops_clock ENABLE ROW LEVEL SECURITY;

--
-- Name: ops_clock ops_clock_select_member; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY ops_clock_select_member ON public.ops_clock FOR SELECT TO authenticated USING ((public.is_ops_member(tournament_id, ( SELECT auth.uid() AS uid)) OR ( SELECT public.is_admin() AS is_admin)));


--
-- Name: ops_events; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.ops_events ENABLE ROW LEVEL SECURITY;

--
-- Name: ops_events ops_events_select_member; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY ops_events_select_member ON public.ops_events FOR SELECT TO authenticated USING ((public.is_ops_member(tournament_id, ( SELECT auth.uid() AS uid)) OR ( SELECT public.is_admin() AS is_admin)));


--
-- Name: ops_live_stats; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.ops_live_stats ENABLE ROW LEVEL SECURITY;

--
-- Name: ops_live_stats ops_live_stats_select_member; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY ops_live_stats_select_member ON public.ops_live_stats FOR SELECT TO authenticated USING ((public.is_ops_member(tournament_id, ( SELECT auth.uid() AS uid)) OR ( SELECT public.is_admin() AS is_admin)));


--
-- Name: ops_participants; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.ops_participants ENABLE ROW LEVEL SECURITY;

--
-- Name: ops_participants ops_participants_select_member; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY ops_participants_select_member ON public.ops_participants FOR SELECT TO authenticated USING ((public.is_ops_member(tournament_id, ( SELECT auth.uid() AS uid)) OR ( SELECT public.is_admin() AS is_admin)));


--
-- Name: ops_prizes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.ops_prizes ENABLE ROW LEVEL SECURITY;

--
-- Name: ops_prizes ops_prizes_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY ops_prizes_select ON public.ops_prizes FOR SELECT TO authenticated USING ((public.is_ops_member(tournament_id, auth.uid()) OR public.is_admin()));


--
-- Name: ops_seats; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.ops_seats ENABLE ROW LEVEL SECURITY;

--
-- Name: ops_seats ops_seats_select_member; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY ops_seats_select_member ON public.ops_seats FOR SELECT TO authenticated USING ((public.is_ops_member(tournament_id, ( SELECT auth.uid() AS uid)) OR ( SELECT public.is_admin() AS is_admin)));


--
-- Name: ops_staff; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.ops_staff ENABLE ROW LEVEL SECURITY;

--
-- Name: ops_staff ops_staff_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY ops_staff_select ON public.ops_staff FOR SELECT TO authenticated USING ((public.is_ops_member(tournament_id, ( SELECT auth.uid() AS uid)) OR ( SELECT public.is_admin() AS is_admin)));


--
-- Name: ops_tables; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.ops_tables ENABLE ROW LEVEL SECURITY;

--
-- Name: ops_tables ops_tables_select_member; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY ops_tables_select_member ON public.ops_tables FOR SELECT TO authenticated USING ((public.is_ops_member(tournament_id, ( SELECT auth.uid() AS uid)) OR ( SELECT public.is_admin() AS is_admin)));


--
-- Name: ops_tournaments; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.ops_tournaments ENABLE ROW LEVEL SECURITY;

--
-- Name: ops_tournaments ops_tournaments_select_member; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY ops_tournaments_select_member ON public.ops_tournaments FOR SELECT TO authenticated USING ((public.is_ops_member(id, ( SELECT auth.uid() AS uid)) OR ( SELECT public.is_admin() AS is_admin)));


--
-- Name: processed_identity_verifications; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.processed_identity_verifications ENABLE ROW LEVEL SECURITY;

--
-- Name: processed_identity_verifications processed_iv_select_self; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY processed_iv_select_self ON public.processed_identity_verifications FOR SELECT TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: event_qr_codes qr_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY qr_delete ON public.event_qr_codes FOR DELETE USING (((user_id = ( SELECT auth.uid() AS uid)) OR (job_posting_id IN ( SELECT job_postings.id
   FROM public.job_postings
  WHERE (public.is_workspace_member(job_postings.workspace_id, ( SELECT auth.uid() AS uid)) OR public.is_posting_collaborator(job_postings.id, ( SELECT auth.uid() AS uid)))))));


--
-- Name: event_qr_codes qr_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY qr_insert ON public.event_qr_codes FOR INSERT WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: event_qr_codes qr_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY qr_select ON public.event_qr_codes FOR SELECT USING (((user_id = ( SELECT auth.uid() AS uid)) OR (job_posting_id IN ( SELECT job_postings.id
   FROM public.job_postings
  WHERE ((job_postings.owner_id = ( SELECT auth.uid() AS uid)) OR public.is_workspace_member(job_postings.workspace_id, ( SELECT auth.uid() AS uid)) OR public.is_posting_collaborator(job_postings.id, ( SELECT auth.uid() AS uid)))))));


--
-- Name: event_qr_codes qr_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY qr_update ON public.event_qr_codes FOR UPDATE USING (((user_id = ( SELECT auth.uid() AS uid)) OR (job_posting_id IN ( SELECT job_postings.id
   FROM public.job_postings
  WHERE (public.is_workspace_member(job_postings.workspace_id, ( SELECT auth.uid() AS uid)) OR public.is_posting_collaborator(job_postings.id, ( SELECT auth.uid() AS uid)))))));


--
-- Name: rate_limits; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

--
-- Name: rate_limits rate_limits_deny_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY rate_limits_deny_all ON public.rate_limits TO authenticated USING (false);


--
-- Name: board_comment_reactions reaction_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY reaction_delete ON public.board_comment_reactions FOR DELETE USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: board_comment_reactions reaction_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY reaction_insert ON public.board_comment_reactions FOR INSERT WITH CHECK ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: board_comment_reactions reaction_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY reaction_select ON public.board_comment_reactions FOR SELECT USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: board_comment_reactions reaction_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY reaction_update ON public.board_comment_reactions FOR UPDATE USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: reports rep_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY rep_insert ON public.reports FOR INSERT WITH CHECK ((( SELECT auth.uid() AS uid) = reporter_id));


--
-- Name: reports rep_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY rep_select ON public.reports FOR SELECT USING (((reporter_id = ( SELECT auth.uid() AS uid)) OR (( SELECT public.get_my_role() AS get_my_role) = 'admin'::text)));


--
-- Name: reports rep_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY rep_update ON public.reports FOR UPDATE USING ((( SELECT public.get_my_role() AS get_my_role) = 'admin'::text));


--
-- Name: reports; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

--
-- Name: reviews rev_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY rev_insert ON public.reviews FOR INSERT WITH CHECK ((( SELECT auth.uid() AS uid) = reviewer_id));


--
-- Name: reviews rev_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY rev_select ON public.reviews FOR SELECT USING (((reviewer_id = ( SELECT auth.uid() AS uid)) OR (reviewee_id = ( SELECT auth.uid() AS uid)) OR (( SELECT public.get_my_role() AS get_my_role) = 'admin'::text)));


--
-- Name: reviews; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

--
-- Name: schedule_board_sync_outbox; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.schedule_board_sync_outbox ENABLE ROW LEVEL SECURITY;

--
-- Name: schedule_board_sync_outbox schedule_board_sync_outbox_authenticated_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY schedule_board_sync_outbox_authenticated_insert ON public.schedule_board_sync_outbox FOR INSERT TO authenticated WITH CHECK (((status = 'pending'::text) AND (retry_count = 0) AND (error_message IS NULL)));


--
-- Name: schedule_board_sync_outbox schedule_board_sync_outbox_service_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY schedule_board_sync_outbox_service_all ON public.schedule_board_sync_outbox TO service_role USING (true) WITH CHECK (true);


--
-- Name: job_posting_templates templates_delete_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY templates_delete_own ON public.job_posting_templates FOR DELETE TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: job_posting_templates templates_insert_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY templates_insert_own ON public.job_posting_templates FOR INSERT TO authenticated WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: job_posting_templates templates_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY templates_select_own ON public.job_posting_templates FOR SELECT TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: job_posting_templates templates_update_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY templates_update_own ON public.job_posting_templates FOR UPDATE TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: user_consents; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

--
-- Name: users users_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY users_select ON public.users FOR SELECT USING (((( SELECT auth.uid() AS uid) = id) OR (( SELECT public.get_my_role() AS get_my_role) = 'admin'::text)));


--
-- Name: users users_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY users_update ON public.users FOR UPDATE USING (((( SELECT auth.uid() AS uid) = id) OR (( SELECT public.get_my_role() AS get_my_role) = 'admin'::text)));


--
-- Name: work_logs wl_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY wl_select ON public.work_logs FOR SELECT USING (((staff_id = ( SELECT auth.uid() AS uid)) OR (owner_id = ( SELECT auth.uid() AS uid)) OR (job_posting_id IN ( SELECT job_postings.id
   FROM public.job_postings
  WHERE (public.is_workspace_member(job_postings.workspace_id, ( SELECT auth.uid() AS uid)) OR public.is_posting_collaborator(job_postings.id, ( SELECT auth.uid() AS uid)))))));


--
-- Name: work_logs wl_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY wl_update ON public.work_logs FOR UPDATE USING (((owner_id = ( SELECT auth.uid() AS uid)) OR (job_posting_id IN ( SELECT job_postings.id
   FROM public.job_postings
  WHERE (public.is_workspace_member(job_postings.workspace_id, ( SELECT auth.uid() AS uid)) OR public.is_posting_collaborator(job_postings.id, ( SELECT auth.uid() AS uid)))))));


--
-- Name: POLICY wl_update ON work_logs; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON POLICY wl_update ON public.work_logs IS '근무기록 UPDATE: 공고 owner / 워크스페이스 멤버 / 공고 협업자만. 스태프 자기행 쓰기는 2026-07-10 회수 — 정산 입력값(check_in_ts/custom_*) 조작 차단. 스태프 출퇴근은 process_qr_checkin_atomically(SECURITY DEFINER) 경유.';


--
-- Name: work_logs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.work_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: workspace_invitations; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.workspace_invitations ENABLE ROW LEVEL SECURITY;

--
-- Name: workspace_invitations workspace_invitations_select_relevant; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY workspace_invitations_select_relevant ON public.workspace_invitations FOR SELECT TO authenticated USING (((invitee_user_id = ( SELECT auth.uid() AS uid)) OR (workspace_id IN ( SELECT workspaces.id
   FROM public.workspaces
  WHERE (workspaces.owner_id = ( SELECT auth.uid() AS uid)))) OR ( SELECT public.is_admin() AS is_admin)));


--
-- Name: workspace_members; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

--
-- Name: workspace_members workspace_members_no_direct_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY workspace_members_no_direct_delete ON public.workspace_members FOR DELETE USING (false);


--
-- Name: workspace_members workspace_members_no_direct_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY workspace_members_no_direct_update ON public.workspace_members FOR UPDATE USING (false);


--
-- Name: workspace_members workspace_members_select_self_or_workspace; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY workspace_members_select_self_or_workspace ON public.workspace_members FOR SELECT USING (((user_id = ( SELECT auth.uid() AS uid)) OR public.is_workspace_member(workspace_id, ( SELECT auth.uid() AS uid))));


--
-- Name: workspaces; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

--
-- Name: workspaces workspaces_insert_employer_with_cap; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY workspaces_insert_employer_with_cap ON public.workspaces FOR INSERT TO authenticated WITH CHECK (((owner_id = ( SELECT auth.uid() AS uid)) AND (( SELECT public.get_my_role() AS get_my_role) = ANY (ARRAY['employer'::text, 'admin'::text])) AND (public.workspace_count_for_owner(owner_id) < 10)));


--
-- Name: workspaces workspaces_select_owner_or_member; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY workspaces_select_owner_or_member ON public.workspaces FOR SELECT USING ((public.is_workspace_member(id, ( SELECT auth.uid() AS uid)) OR public.is_workspace_jpc_member(id, ( SELECT auth.uid() AS uid)) OR ( SELECT public.is_admin() AS is_admin)));


--
-- Name: workspaces workspaces_update_owner; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY workspaces_update_owner ON public.workspaces FOR UPDATE TO authenticated USING (((owner_id = ( SELECT auth.uid() AS uid)) OR ( SELECT public.is_admin() AS is_admin))) WITH CHECK (((owner_id = ( SELECT auth.uid() AS uid)) OR ( SELECT public.is_admin() AS is_admin)));


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: TABLE job_postings; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.job_postings TO anon;
GRANT ALL ON TABLE public.job_postings TO authenticated;
GRANT ALL ON TABLE public.job_postings TO service_role;


--
-- Name: FUNCTION _build_schedule_board_body(p_jp public.job_postings); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public._build_schedule_board_body(p_jp public.job_postings) TO anon;
GRANT ALL ON FUNCTION public._build_schedule_board_body(p_jp public.job_postings) TO authenticated;
GRANT ALL ON FUNCTION public._build_schedule_board_body(p_jp public.job_postings) TO service_role;


--
-- Name: FUNCTION _fmt_worklog_time(p_ts timestamp with time zone); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public._fmt_worklog_time(p_ts timestamp with time zone) TO anon;
GRANT ALL ON FUNCTION public._fmt_worklog_time(p_ts timestamp with time zone) TO authenticated;
GRANT ALL ON FUNCTION public._fmt_worklog_time(p_ts timestamp with time zone) TO service_role;


--
-- Name: FUNCTION _format_compensation_label(p_compensation jsonb); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public._format_compensation_label(p_compensation jsonb) TO anon;
GRANT ALL ON FUNCTION public._format_compensation_label(p_compensation jsonb) TO authenticated;
GRANT ALL ON FUNCTION public._format_compensation_label(p_compensation jsonb) TO service_role;


--
-- Name: FUNCTION _posting_role_key(p_role text, p_custom_role text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public._posting_role_key(p_role text, p_custom_role text) TO anon;
GRANT ALL ON FUNCTION public._posting_role_key(p_role text, p_custom_role text) TO authenticated;
GRANT ALL ON FUNCTION public._posting_role_key(p_role text, p_custom_role text) TO service_role;


--
-- Name: FUNCTION _posting_slot_key(p_time_slot text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public._posting_slot_key(p_time_slot text) TO anon;
GRANT ALL ON FUNCTION public._posting_slot_key(p_time_slot text) TO authenticated;
GRANT ALL ON FUNCTION public._posting_slot_key(p_time_slot text) TO service_role;


--
-- Name: FUNCTION accept_workspace_invitation(p_invitation_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.accept_workspace_invitation(p_invitation_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.accept_workspace_invitation(p_invitation_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.accept_workspace_invitation(p_invitation_id uuid) TO service_role;


--
-- Name: FUNCTION add_direct_staff(p_job_posting_id uuid, p_staff_id uuid, p_assignments jsonb); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.add_direct_staff(p_job_posting_id uuid, p_staff_id uuid, p_assignments jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.add_direct_staff(p_job_posting_id uuid, p_staff_id uuid, p_assignments jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.add_direct_staff(p_job_posting_id uuid, p_staff_id uuid, p_assignments jsonb) TO service_role;


--
-- Name: FUNCTION apply_with_capacity_check(p_applicant_id uuid, p_job_posting_id uuid, p_applicant_name text, p_applicant_phone text, p_applicant_email text, p_applicant_nickname text, p_applicant_photo_url text, p_applicant_role text, p_custom_role text, p_job_posting_title text, p_job_posting_date text, p_recruitment_type text, p_message text, p_assignments jsonb, p_pre_question_answers jsonb); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.apply_with_capacity_check(p_applicant_id uuid, p_job_posting_id uuid, p_applicant_name text, p_applicant_phone text, p_applicant_email text, p_applicant_nickname text, p_applicant_photo_url text, p_applicant_role text, p_custom_role text, p_job_posting_title text, p_job_posting_date text, p_recruitment_type text, p_message text, p_assignments jsonb, p_pre_question_answers jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.apply_with_capacity_check(p_applicant_id uuid, p_job_posting_id uuid, p_applicant_name text, p_applicant_phone text, p_applicant_email text, p_applicant_nickname text, p_applicant_photo_url text, p_applicant_role text, p_custom_role text, p_job_posting_title text, p_job_posting_date text, p_recruitment_type text, p_message text, p_assignments jsonb, p_pre_question_answers jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.apply_with_capacity_check(p_applicant_id uuid, p_job_posting_id uuid, p_applicant_name text, p_applicant_phone text, p_applicant_email text, p_applicant_nickname text, p_applicant_photo_url text, p_applicant_role text, p_custom_role text, p_job_posting_title text, p_job_posting_date text, p_recruitment_type text, p_message text, p_assignments jsonb, p_pre_question_answers jsonb) TO service_role;


--
-- Name: FUNCTION approve_employer_application(p_app_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.approve_employer_application(p_app_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.approve_employer_application(p_app_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.approve_employer_application(p_app_id uuid) TO service_role;


--
-- Name: FUNCTION archive_workspace(p_workspace_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.archive_workspace(p_workspace_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.archive_workspace(p_workspace_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.archive_workspace(p_workspace_id uuid) TO service_role;


--
-- Name: FUNCTION cancel_application_atomically(p_application_id uuid, p_actor_type text, p_actor_id uuid, p_cancel_reason text, p_rejection_reason text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.cancel_application_atomically(p_application_id uuid, p_actor_type text, p_actor_id uuid, p_cancel_reason text, p_rejection_reason text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.cancel_application_atomically(p_application_id uuid, p_actor_type text, p_actor_id uuid, p_cancel_reason text, p_rejection_reason text) TO authenticated;
GRANT ALL ON FUNCTION public.cancel_application_atomically(p_application_id uuid, p_actor_type text, p_actor_id uuid, p_cancel_reason text, p_rejection_reason text) TO service_role;


--
-- Name: FUNCTION check_email_exists(p_email text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.check_email_exists(p_email text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.check_email_exists(p_email text) TO anon;
GRANT ALL ON FUNCTION public.check_email_exists(p_email text) TO authenticated;
GRANT ALL ON FUNCTION public.check_email_exists(p_email text) TO service_role;


--
-- Name: FUNCTION check_ip_rate_limit(p_ip text, p_max_requests integer, p_window_seconds integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.check_ip_rate_limit(p_ip text, p_max_requests integer, p_window_seconds integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.check_ip_rate_limit(p_ip text, p_max_requests integer, p_window_seconds integer) TO service_role;


--
-- Name: FUNCTION check_nickname_exists(p_nickname text, p_exclude_uid uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.check_nickname_exists(p_nickname text, p_exclude_uid uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.check_nickname_exists(p_nickname text, p_exclude_uid uuid) TO anon;
GRANT ALL ON FUNCTION public.check_nickname_exists(p_nickname text, p_exclude_uid uuid) TO authenticated;
GRANT ALL ON FUNCTION public.check_nickname_exists(p_nickname text, p_exclude_uid uuid) TO service_role;


--
-- Name: FUNCTION check_phone_exists(p_phone text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.check_phone_exists(p_phone text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.check_phone_exists(p_phone text) TO authenticated;
GRANT ALL ON FUNCTION public.check_phone_exists(p_phone text) TO service_role;


--
-- Name: FUNCTION check_rate_limit(p_key text, p_max_requests integer, p_window_seconds integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.check_rate_limit(p_key text, p_max_requests integer, p_window_seconds integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.check_rate_limit(p_key text, p_max_requests integer, p_window_seconds integer) TO service_role;


--
-- Name: FUNCTION check_user_rate_limit(p_user_id uuid, p_operation text, p_max_requests integer, p_window_seconds integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.check_user_rate_limit(p_user_id uuid, p_operation text, p_max_requests integer, p_window_seconds integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.check_user_rate_limit(p_user_id uuid, p_operation text, p_max_requests integer, p_window_seconds integer) TO service_role;


--
-- Name: FUNCTION check_xss_fields(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.check_xss_fields() TO anon;
GRANT ALL ON FUNCTION public.check_xss_fields() TO authenticated;
GRANT ALL ON FUNCTION public.check_xss_fields() TO service_role;


--
-- Name: FUNCTION confirm_application(p_application_id uuid, p_owner_id uuid, p_assignments jsonb, p_original_application jsonb, p_confirmation_history jsonb, p_notes text, p_is_fixed_posting boolean, p_assignments_v3 jsonb); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.confirm_application(p_application_id uuid, p_owner_id uuid, p_assignments jsonb, p_original_application jsonb, p_confirmation_history jsonb, p_notes text, p_is_fixed_posting boolean, p_assignments_v3 jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.confirm_application(p_application_id uuid, p_owner_id uuid, p_assignments jsonb, p_original_application jsonb, p_confirmation_history jsonb, p_notes text, p_is_fixed_posting boolean, p_assignments_v3 jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.confirm_application(p_application_id uuid, p_owner_id uuid, p_assignments jsonb, p_original_application jsonb, p_confirmation_history jsonb, p_notes text, p_is_fixed_posting boolean, p_assignments_v3 jsonb) TO service_role;


--
-- Name: FUNCTION count_posting_confirmed_by_slot(p_job_posting_ids uuid[]); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.count_posting_confirmed_by_slot(p_job_posting_ids uuid[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.count_posting_confirmed_by_slot(p_job_posting_ids uuid[]) TO authenticated;
GRANT ALL ON FUNCTION public.count_posting_confirmed_by_slot(p_job_posting_ids uuid[]) TO service_role;


--
-- Name: FUNCTION create_report(p_type text, p_reporter_type text, p_reporter_id uuid, p_reporter_name text, p_target_id uuid, p_target_name text, p_job_posting_id uuid, p_job_posting_title text, p_description text, p_evidence_urls text[], p_severity public.report_severity, p_work_log_id uuid, p_work_date text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.create_report(p_type text, p_reporter_type text, p_reporter_id uuid, p_reporter_name text, p_target_id uuid, p_target_name text, p_job_posting_id uuid, p_job_posting_title text, p_description text, p_evidence_urls text[], p_severity public.report_severity, p_work_log_id uuid, p_work_date text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.create_report(p_type text, p_reporter_type text, p_reporter_id uuid, p_reporter_name text, p_target_id uuid, p_target_name text, p_job_posting_id uuid, p_job_posting_title text, p_description text, p_evidence_urls text[], p_severity public.report_severity, p_work_log_id uuid, p_work_date text) TO authenticated;
GRANT ALL ON FUNCTION public.create_report(p_type text, p_reporter_type text, p_reporter_id uuid, p_reporter_name text, p_target_id uuid, p_target_name text, p_job_posting_id uuid, p_job_posting_title text, p_description text, p_evidence_urls text[], p_severity public.report_severity, p_work_log_id uuid, p_work_date text) TO service_role;


--
-- Name: FUNCTION create_review(p_work_log_id uuid, p_job_posting_id uuid, p_job_posting_title text, p_work_date text, p_reviewer_id uuid, p_reviewer_name text, p_reviewer_type text, p_reviewee_id uuid, p_reviewee_name text, p_sentiment public.review_sentiment, p_tags text[], p_comment text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.create_review(p_work_log_id uuid, p_job_posting_id uuid, p_job_posting_title text, p_work_date text, p_reviewer_id uuid, p_reviewer_name text, p_reviewer_type text, p_reviewee_id uuid, p_reviewee_name text, p_sentiment public.review_sentiment, p_tags text[], p_comment text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.create_review(p_work_log_id uuid, p_job_posting_id uuid, p_job_posting_title text, p_work_date text, p_reviewer_id uuid, p_reviewer_name text, p_reviewer_type text, p_reviewee_id uuid, p_reviewee_name text, p_sentiment public.review_sentiment, p_tags text[], p_comment text) TO authenticated;
GRANT ALL ON FUNCTION public.create_review(p_work_log_id uuid, p_job_posting_id uuid, p_job_posting_title text, p_work_date text, p_reviewer_id uuid, p_reviewer_name text, p_reviewer_type text, p_reviewee_id uuid, p_reviewee_name text, p_sentiment public.review_sentiment, p_tags text[], p_comment text) TO service_role;


--
-- Name: TABLE workspaces; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.workspaces TO anon;
GRANT ALL ON TABLE public.workspaces TO authenticated;
GRANT ALL ON TABLE public.workspaces TO service_role;


--
-- Name: FUNCTION create_workspace(p_name text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.create_workspace(p_name text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.create_workspace(p_name text) TO authenticated;
GRANT ALL ON FUNCTION public.create_workspace(p_name text) TO service_role;


--
-- Name: FUNCTION decrement_unread_counter(p_notification_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.decrement_unread_counter(p_notification_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.decrement_unread_counter(p_notification_id uuid) TO service_role;


--
-- Name: FUNCTION decrement_unread_counter(p_user_id uuid, p_delta integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.decrement_unread_counter(p_user_id uuid, p_delta integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.decrement_unread_counter(p_user_id uuid, p_delta integer) TO service_role;


--
-- Name: FUNCTION derive_region_slug(addr text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.derive_region_slug(addr text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.derive_region_slug(addr text) TO service_role;


--
-- Name: FUNCTION enforce_jp_status_transition(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.enforce_jp_status_transition() FROM PUBLIC;
GRANT ALL ON FUNCTION public.enforce_jp_status_transition() TO anon;
GRANT ALL ON FUNCTION public.enforce_jp_status_transition() TO authenticated;
GRANT ALL ON FUNCTION public.enforce_jp_status_transition() TO service_role;


--
-- Name: FUNCTION expire_pending_workspace_invitations(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.expire_pending_workspace_invitations() FROM PUBLIC;
GRANT ALL ON FUNCTION public.expire_pending_workspace_invitations() TO service_role;


--
-- Name: FUNCTION fn_board_comment_count_sync(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.fn_board_comment_count_sync() TO anon;
GRANT ALL ON FUNCTION public.fn_board_comment_count_sync() TO authenticated;
GRANT ALL ON FUNCTION public.fn_board_comment_count_sync() TO service_role;


--
-- Name: FUNCTION fn_cleanup_expired_fcm_tokens(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.fn_cleanup_expired_fcm_tokens() FROM PUBLIC;
GRANT ALL ON FUNCTION public.fn_cleanup_expired_fcm_tokens() TO service_role;


--
-- Name: FUNCTION fn_cleanup_rate_limits(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.fn_cleanup_rate_limits() FROM PUBLIC;
GRANT ALL ON FUNCTION public.fn_cleanup_rate_limits() TO service_role;


--
-- Name: FUNCTION fn_expire_by_last_work_date(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.fn_expire_by_last_work_date() FROM PUBLIC;
GRANT ALL ON FUNCTION public.fn_expire_by_last_work_date() TO service_role;


--
-- Name: FUNCTION fn_expire_fixed_postings_batch(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.fn_expire_fixed_postings_batch() FROM PUBLIC;
GRANT ALL ON FUNCTION public.fn_expire_fixed_postings_batch() TO service_role;


--
-- Name: FUNCTION fn_fixed_posting_expired(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.fn_fixed_posting_expired() TO anon;
GRANT ALL ON FUNCTION public.fn_fixed_posting_expired() TO authenticated;
GRANT ALL ON FUNCTION public.fn_fixed_posting_expired() TO service_role;


--
-- Name: FUNCTION fn_notification_delete_decrement(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.fn_notification_delete_decrement() TO anon;
GRANT ALL ON FUNCTION public.fn_notification_delete_decrement() TO authenticated;
GRANT ALL ON FUNCTION public.fn_notification_delete_decrement() TO service_role;


--
-- Name: FUNCTION fn_notification_insert_increment(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.fn_notification_insert_increment() TO anon;
GRANT ALL ON FUNCTION public.fn_notification_insert_increment() TO authenticated;
GRANT ALL ON FUNCTION public.fn_notification_insert_increment() TO service_role;


--
-- Name: FUNCTION fn_notification_read_decrement(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.fn_notification_read_decrement() TO anon;
GRANT ALL ON FUNCTION public.fn_notification_read_decrement() TO authenticated;
GRANT ALL ON FUNCTION public.fn_notification_read_decrement() TO service_role;


--
-- Name: FUNCTION fn_notify_cancellation_request(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.fn_notify_cancellation_request() TO anon;
GRANT ALL ON FUNCTION public.fn_notify_cancellation_request() TO authenticated;
GRANT ALL ON FUNCTION public.fn_notify_cancellation_request() TO service_role;


--
-- Name: FUNCTION fn_notify_inquiry_created(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.fn_notify_inquiry_created() TO anon;
GRANT ALL ON FUNCTION public.fn_notify_inquiry_created() TO authenticated;
GRANT ALL ON FUNCTION public.fn_notify_inquiry_created() TO service_role;


--
-- Name: FUNCTION fn_notify_review_created(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.fn_notify_review_created() TO anon;
GRANT ALL ON FUNCTION public.fn_notify_review_created() TO authenticated;
GRANT ALL ON FUNCTION public.fn_notify_review_created() TO service_role;


--
-- Name: FUNCTION fn_notify_tournament_approval(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.fn_notify_tournament_approval() TO anon;
GRANT ALL ON FUNCTION public.fn_notify_tournament_approval() TO authenticated;
GRANT ALL ON FUNCTION public.fn_notify_tournament_approval() TO service_role;


--
-- Name: FUNCTION fn_ops_events_append_only(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.fn_ops_events_append_only() FROM PUBLIC;
GRANT ALL ON FUNCTION public.fn_ops_events_append_only() TO service_role;


--
-- Name: FUNCTION fn_ops_init_derived_rows(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.fn_ops_init_derived_rows() FROM PUBLIC;
GRANT ALL ON FUNCTION public.fn_ops_init_derived_rows() TO service_role;


--
-- Name: FUNCTION fn_ops_live_stats_recompute_trigger(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.fn_ops_live_stats_recompute_trigger() FROM PUBLIC;
GRANT ALL ON FUNCTION public.fn_ops_live_stats_recompute_trigger() TO service_role;


--
-- Name: FUNCTION fn_ops_live_stats_recompute_trigger_tournaments(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.fn_ops_live_stats_recompute_trigger_tournaments() FROM PUBLIC;
GRANT ALL ON FUNCTION public.fn_ops_live_stats_recompute_trigger_tournaments() TO service_role;


--
-- Name: FUNCTION fn_ops_recompute_live_stats(p_tournament_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.fn_ops_recompute_live_stats(p_tournament_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.fn_ops_recompute_live_stats(p_tournament_id uuid) TO service_role;


--
-- Name: FUNCTION fn_ops_set_updated_at(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.fn_ops_set_updated_at() FROM PUBLIC;
GRANT ALL ON FUNCTION public.fn_ops_set_updated_at() TO service_role;


--
-- Name: FUNCTION fn_send_review_reminders(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.fn_send_review_reminders() FROM PUBLIC;
GRANT ALL ON FUNCTION public.fn_send_review_reminders() TO service_role;


--
-- Name: FUNCTION fn_sync_application_completion(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.fn_sync_application_completion() TO anon;
GRANT ALL ON FUNCTION public.fn_sync_application_completion() TO authenticated;
GRANT ALL ON FUNCTION public.fn_sync_application_completion() TO service_role;


--
-- Name: FUNCTION fn_sync_workspace_member_count(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.fn_sync_workspace_member_count() FROM PUBLIC;
GRANT ALL ON FUNCTION public.fn_sync_workspace_member_count() TO service_role;


--
-- Name: FUNCTION fn_update_job_posting_stats(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.fn_update_job_posting_stats() TO anon;
GRANT ALL ON FUNCTION public.fn_update_job_posting_stats() TO authenticated;
GRANT ALL ON FUNCTION public.fn_update_job_posting_stats() TO service_role;


--
-- Name: FUNCTION fn_workspaces_set_updated_at(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.fn_workspaces_set_updated_at() FROM PUBLIC;
GRANT ALL ON FUNCTION public.fn_workspaces_set_updated_at() TO service_role;


--
-- Name: FUNCTION get_job_posting_stats(p_owner_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.get_job_posting_stats(p_owner_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_job_posting_stats(p_owner_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_job_posting_stats(p_owner_id uuid) TO service_role;


--
-- Name: FUNCTION get_latest_employer_application(p_user_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.get_latest_employer_application(p_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_latest_employer_application(p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_latest_employer_application(p_user_id uuid) TO service_role;


--
-- Name: FUNCTION get_my_role(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_my_role() TO anon;
GRANT ALL ON FUNCTION public.get_my_role() TO authenticated;
GRANT ALL ON FUNCTION public.get_my_role() TO service_role;


--
-- Name: FUNCTION get_or_create_venue_container(p_workspace_id uuid, p_name text, p_kind text, p_period jsonb); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.get_or_create_venue_container(p_workspace_id uuid, p_name text, p_kind text, p_period jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_or_create_venue_container(p_workspace_id uuid, p_name text, p_kind text, p_period jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.get_or_create_venue_container(p_workspace_id uuid, p_name text, p_kind text, p_period jsonb) TO service_role;


--
-- Name: FUNCTION get_posting_filled_counts(p_job_posting_ids uuid[]); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.get_posting_filled_counts(p_job_posting_ids uuid[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_posting_filled_counts(p_job_posting_ids uuid[]) TO authenticated;
GRANT ALL ON FUNCTION public.get_posting_filled_counts(p_job_posting_ids uuid[]) TO service_role;
GRANT ALL ON FUNCTION public.get_posting_filled_counts(p_job_posting_ids uuid[]) TO anon;


--
-- Name: FUNCTION get_regular_posting_date_counts(p_start_date text, p_end_date text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_regular_posting_date_counts(p_start_date text, p_end_date text) TO anon;
GRANT ALL ON FUNCTION public.get_regular_posting_date_counts(p_start_date text, p_end_date text) TO authenticated;
GRANT ALL ON FUNCTION public.get_regular_posting_date_counts(p_start_date text, p_end_date text) TO service_role;


--
-- Name: FUNCTION get_unread_notification_count(p_user_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.get_unread_notification_count(p_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_unread_notification_count(p_user_id uuid) TO service_role;


--
-- Name: FUNCTION get_venue_day_slots(p_venue uuid, p_date text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.get_venue_day_slots(p_venue uuid, p_date text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_venue_day_slots(p_venue uuid, p_date text) TO authenticated;
GRANT ALL ON FUNCTION public.get_venue_day_slots(p_venue uuid, p_date text) TO service_role;


--
-- Name: FUNCTION get_venue_grid_summary(p_venue uuid, p_from text, p_to text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.get_venue_grid_summary(p_venue uuid, p_from text, p_to text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_venue_grid_summary(p_venue uuid, p_from text, p_to text) TO authenticated;
GRANT ALL ON FUNCTION public.get_venue_grid_summary(p_venue uuid, p_from text, p_to text) TO service_role;


--
-- Name: FUNCTION get_workspace_owner_profile(_workspace_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.get_workspace_owner_profile(_workspace_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_workspace_owner_profile(_workspace_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_workspace_owner_profile(_workspace_id uuid) TO service_role;


--
-- Name: FUNCTION handle_new_user(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.handle_new_user() TO anon;
GRANT ALL ON FUNCTION public.handle_new_user() TO authenticated;
GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;


--
-- Name: FUNCTION increment_announcement_view_count(p_announcement_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.increment_announcement_view_count(p_announcement_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.increment_announcement_view_count(p_announcement_id uuid) TO anon;
GRANT ALL ON FUNCTION public.increment_announcement_view_count(p_announcement_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.increment_announcement_view_count(p_announcement_id uuid) TO service_role;


--
-- Name: FUNCTION increment_board_post_view_count(p_post_id text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.increment_board_post_view_count(p_post_id text) TO anon;
GRANT ALL ON FUNCTION public.increment_board_post_view_count(p_post_id text) TO authenticated;
GRANT ALL ON FUNCTION public.increment_board_post_view_count(p_post_id text) TO service_role;


--
-- Name: FUNCTION increment_template_usage(p_template_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.increment_template_usage(p_template_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.increment_template_usage(p_template_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.increment_template_usage(p_template_id uuid) TO service_role;


--
-- Name: FUNCTION increment_unread_counter(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.increment_unread_counter() TO anon;
GRANT ALL ON FUNCTION public.increment_unread_counter() TO authenticated;
GRANT ALL ON FUNCTION public.increment_unread_counter() TO service_role;


--
-- Name: FUNCTION increment_view_count(posting_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.increment_view_count(posting_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.increment_view_count(posting_id uuid) TO anon;
GRANT ALL ON FUNCTION public.increment_view_count(posting_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.increment_view_count(posting_id uuid) TO service_role;


--
-- Name: FUNCTION invite_workspace_member(p_workspace_id uuid, p_invitee_user_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.invite_workspace_member(p_workspace_id uuid, p_invitee_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.invite_workspace_member(p_workspace_id uuid, p_invitee_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.invite_workspace_member(p_workspace_id uuid, p_invitee_user_id uuid) TO service_role;


--
-- Name: FUNCTION is_admin(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.is_admin() TO anon;
GRANT ALL ON FUNCTION public.is_admin() TO authenticated;
GRANT ALL ON FUNCTION public.is_admin() TO service_role;


--
-- Name: FUNCTION is_employer_or_admin(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.is_employer_or_admin() TO anon;
GRANT ALL ON FUNCTION public.is_employer_or_admin() TO authenticated;
GRANT ALL ON FUNCTION public.is_employer_or_admin() TO service_role;


--
-- Name: FUNCTION is_ops_member(_tournament_id uuid, _user_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.is_ops_member(_tournament_id uuid, _user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_ops_member(_tournament_id uuid, _user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_ops_member(_tournament_id uuid, _user_id uuid) TO service_role;


--
-- Name: FUNCTION is_posting_collaborator(p_posting_id uuid, p_user_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.is_posting_collaborator(p_posting_id uuid, p_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_posting_collaborator(p_posting_id uuid, p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_posting_collaborator(p_posting_id uuid, p_user_id uuid) TO service_role;


--
-- Name: FUNCTION is_workspace_jpc_member(_workspace_id uuid, _user_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.is_workspace_jpc_member(_workspace_id uuid, _user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_workspace_jpc_member(_workspace_id uuid, _user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_workspace_jpc_member(_workspace_id uuid, _user_id uuid) TO service_role;


--
-- Name: FUNCTION is_workspace_member(_workspace_id uuid, _user_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.is_workspace_member(_workspace_id uuid, _user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_workspace_member(_workspace_id uuid, _user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_workspace_member(_workspace_id uuid, _user_id uuid) TO service_role;


--
-- Name: TABLE applications; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.applications TO anon;
GRANT ALL ON TABLE public.applications TO authenticated;
GRANT ALL ON TABLE public.applications TO service_role;


--
-- Name: FUNCTION list_all_applications(p_status public.application_status); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.list_all_applications(p_status public.application_status) FROM PUBLIC;
GRANT ALL ON FUNCTION public.list_all_applications(p_status public.application_status) TO authenticated;
GRANT ALL ON FUNCTION public.list_all_applications(p_status public.application_status) TO service_role;


--
-- Name: TABLE event_qr_codes; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.event_qr_codes TO anon;
GRANT ALL ON TABLE public.event_qr_codes TO authenticated;
GRANT ALL ON TABLE public.event_qr_codes TO service_role;


--
-- Name: FUNCTION list_all_event_qr_codes(p_active boolean); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.list_all_event_qr_codes(p_active boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.list_all_event_qr_codes(p_active boolean) TO authenticated;
GRANT ALL ON FUNCTION public.list_all_event_qr_codes(p_active boolean) TO service_role;


--
-- Name: FUNCTION list_all_managed_postings(p_status public.posting_status); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.list_all_managed_postings(p_status public.posting_status) FROM PUBLIC;
GRANT ALL ON FUNCTION public.list_all_managed_postings(p_status public.posting_status) TO authenticated;
GRANT ALL ON FUNCTION public.list_all_managed_postings(p_status public.posting_status) TO service_role;


--
-- Name: TABLE work_logs; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.work_logs TO anon;
GRANT ALL ON TABLE public.work_logs TO authenticated;
GRANT ALL ON TABLE public.work_logs TO service_role;


--
-- Name: FUNCTION list_all_work_logs(p_status public.work_log_status, p_date_from date, p_date_to date); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.list_all_work_logs(p_status public.work_log_status, p_date_from date, p_date_to date) FROM PUBLIC;
GRANT ALL ON FUNCTION public.list_all_work_logs(p_status public.work_log_status, p_date_from date, p_date_to date) TO authenticated;
GRANT ALL ON FUNCTION public.list_all_work_logs(p_status public.work_log_status, p_date_from date, p_date_to date) TO service_role;


--
-- Name: TABLE workspace_members; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.workspace_members TO anon;
GRANT ALL ON TABLE public.workspace_members TO authenticated;
GRANT ALL ON TABLE public.workspace_members TO service_role;


--
-- Name: FUNCTION list_all_workspace_members(p_workspace_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.list_all_workspace_members(p_workspace_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.list_all_workspace_members(p_workspace_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.list_all_workspace_members(p_workspace_id uuid) TO service_role;


--
-- Name: FUNCTION list_my_workspaces(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.list_my_workspaces() TO anon;
GRANT ALL ON FUNCTION public.list_my_workspaces() TO authenticated;
GRANT ALL ON FUNCTION public.list_my_workspaces() TO service_role;


--
-- Name: FUNCTION log_collaborator_audit(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.log_collaborator_audit() TO anon;
GRANT ALL ON FUNCTION public.log_collaborator_audit() TO authenticated;
GRANT ALL ON FUNCTION public.log_collaborator_audit() TO service_role;


--
-- Name: FUNCTION notify_employer_application_change(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.notify_employer_application_change() FROM PUBLIC;


--
-- Name: FUNCTION notify_on_application_insert(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.notify_on_application_insert() TO anon;
GRANT ALL ON FUNCTION public.notify_on_application_insert() TO authenticated;
GRANT ALL ON FUNCTION public.notify_on_application_insert() TO service_role;


--
-- Name: FUNCTION notify_on_application_update(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.notify_on_application_update() TO anon;
GRANT ALL ON FUNCTION public.notify_on_application_update() TO authenticated;
GRANT ALL ON FUNCTION public.notify_on_application_update() TO service_role;


--
-- Name: FUNCTION notify_on_board_comment_insert(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.notify_on_board_comment_insert() TO anon;
GRANT ALL ON FUNCTION public.notify_on_board_comment_insert() TO authenticated;
GRANT ALL ON FUNCTION public.notify_on_board_comment_insert() TO service_role;


--
-- Name: FUNCTION notify_on_board_post_update(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.notify_on_board_post_update() TO anon;
GRANT ALL ON FUNCTION public.notify_on_board_post_update() TO authenticated;
GRANT ALL ON FUNCTION public.notify_on_board_post_update() TO service_role;


--
-- Name: FUNCTION notify_on_collaborator_added(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.notify_on_collaborator_added() TO anon;
GRANT ALL ON FUNCTION public.notify_on_collaborator_added() TO authenticated;
GRANT ALL ON FUNCTION public.notify_on_collaborator_added() TO service_role;


--
-- Name: FUNCTION notify_on_collaborator_removed(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.notify_on_collaborator_removed() TO anon;
GRANT ALL ON FUNCTION public.notify_on_collaborator_removed() TO authenticated;
GRANT ALL ON FUNCTION public.notify_on_collaborator_removed() TO service_role;


--
-- Name: FUNCTION notify_on_inquiry_insert(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.notify_on_inquiry_insert() TO anon;
GRANT ALL ON FUNCTION public.notify_on_inquiry_insert() TO authenticated;
GRANT ALL ON FUNCTION public.notify_on_inquiry_insert() TO service_role;


--
-- Name: FUNCTION notify_on_job_posting_insert(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.notify_on_job_posting_insert() TO anon;
GRANT ALL ON FUNCTION public.notify_on_job_posting_insert() TO authenticated;
GRANT ALL ON FUNCTION public.notify_on_job_posting_insert() TO service_role;


--
-- Name: FUNCTION notify_on_job_posting_owner_expired(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.notify_on_job_posting_owner_expired() TO anon;
GRANT ALL ON FUNCTION public.notify_on_job_posting_owner_expired() TO authenticated;
GRANT ALL ON FUNCTION public.notify_on_job_posting_owner_expired() TO service_role;


--
-- Name: FUNCTION notify_on_job_posting_update(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.notify_on_job_posting_update() TO anon;
GRANT ALL ON FUNCTION public.notify_on_job_posting_update() TO authenticated;
GRANT ALL ON FUNCTION public.notify_on_job_posting_update() TO service_role;


--
-- Name: FUNCTION notify_on_report_insert(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.notify_on_report_insert() TO anon;
GRANT ALL ON FUNCTION public.notify_on_report_insert() TO authenticated;
GRANT ALL ON FUNCTION public.notify_on_report_insert() TO service_role;


--
-- Name: FUNCTION notify_on_review_insert(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.notify_on_review_insert() TO anon;
GRANT ALL ON FUNCTION public.notify_on_review_insert() TO authenticated;
GRANT ALL ON FUNCTION public.notify_on_review_insert() TO service_role;


--
-- Name: FUNCTION notify_on_work_log_checkinout_update(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.notify_on_work_log_checkinout_update() TO anon;
GRANT ALL ON FUNCTION public.notify_on_work_log_checkinout_update() TO authenticated;
GRANT ALL ON FUNCTION public.notify_on_work_log_checkinout_update() TO service_role;


--
-- Name: FUNCTION notify_on_work_log_insert(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.notify_on_work_log_insert() TO anon;
GRANT ALL ON FUNCTION public.notify_on_work_log_insert() TO authenticated;
GRANT ALL ON FUNCTION public.notify_on_work_log_insert() TO service_role;


--
-- Name: FUNCTION notify_on_work_log_no_show_update(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.notify_on_work_log_no_show_update() TO anon;
GRANT ALL ON FUNCTION public.notify_on_work_log_no_show_update() TO authenticated;
GRANT ALL ON FUNCTION public.notify_on_work_log_no_show_update() TO service_role;


--
-- Name: FUNCTION notify_on_work_log_update(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.notify_on_work_log_update() TO anon;
GRANT ALL ON FUNCTION public.notify_on_work_log_update() TO authenticated;
GRANT ALL ON FUNCTION public.notify_on_work_log_update() TO service_role;


--
-- Name: FUNCTION notify_on_workspace_invitation_insert(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.notify_on_workspace_invitation_insert() FROM PUBLIC;
GRANT ALL ON FUNCTION public.notify_on_workspace_invitation_insert() TO service_role;


--
-- Name: FUNCTION ops_add_addon(p_participant_id uuid, p_actor_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.ops_add_addon(p_participant_id uuid, p_actor_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.ops_add_addon(p_participant_id uuid, p_actor_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.ops_add_addon(p_participant_id uuid, p_actor_id uuid) TO service_role;


--
-- Name: FUNCTION ops_add_rebuy(p_participant_id uuid, p_actor_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.ops_add_rebuy(p_participant_id uuid, p_actor_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.ops_add_rebuy(p_participant_id uuid, p_actor_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.ops_add_rebuy(p_participant_id uuid, p_actor_id uuid) TO service_role;


--
-- Name: FUNCTION ops_add_staff(p_tournament_id uuid, p_actor_id uuid, p_staff_id uuid, p_role public.staff_role, p_custom_role text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.ops_add_staff(p_tournament_id uuid, p_actor_id uuid, p_staff_id uuid, p_role public.staff_role, p_custom_role text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.ops_add_staff(p_tournament_id uuid, p_actor_id uuid, p_staff_id uuid, p_role public.staff_role, p_custom_role text) TO authenticated;
GRANT ALL ON FUNCTION public.ops_add_staff(p_tournament_id uuid, p_actor_id uuid, p_staff_id uuid, p_role public.staff_role, p_custom_role text) TO service_role;


--
-- Name: FUNCTION ops_add_table(p_tournament_id uuid, p_actor_id uuid, p_seat_count integer, p_name text, p_lock_type public.ops_table_lock_type, p_priority integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.ops_add_table(p_tournament_id uuid, p_actor_id uuid, p_seat_count integer, p_name text, p_lock_type public.ops_table_lock_type, p_priority integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.ops_add_table(p_tournament_id uuid, p_actor_id uuid, p_seat_count integer, p_name text, p_lock_type public.ops_table_lock_type, p_priority integer) TO authenticated;
GRANT ALL ON FUNCTION public.ops_add_table(p_tournament_id uuid, p_actor_id uuid, p_seat_count integer, p_name text, p_lock_type public.ops_table_lock_type, p_priority integer) TO service_role;


--
-- Name: FUNCTION ops_assign_seat(p_seat_id uuid, p_participant_id uuid, p_actor_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.ops_assign_seat(p_seat_id uuid, p_participant_id uuid, p_actor_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.ops_assign_seat(p_seat_id uuid, p_participant_id uuid, p_actor_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.ops_assign_seat(p_seat_id uuid, p_participant_id uuid, p_actor_id uuid) TO service_role;


--
-- Name: FUNCTION ops_assign_table_staff(p_tournament_id uuid, p_actor_id uuid, p_table_id uuid, p_staff_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.ops_assign_table_staff(p_tournament_id uuid, p_actor_id uuid, p_table_id uuid, p_staff_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.ops_assign_table_staff(p_tournament_id uuid, p_actor_id uuid, p_table_id uuid, p_staff_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.ops_assign_table_staff(p_tournament_id uuid, p_actor_id uuid, p_table_id uuid, p_staff_id uuid) TO service_role;


--
-- Name: FUNCTION ops_bust_participant(p_participant_id uuid, p_actor_id uuid, p_eliminator_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.ops_bust_participant(p_participant_id uuid, p_actor_id uuid, p_eliminator_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.ops_bust_participant(p_participant_id uuid, p_actor_id uuid, p_eliminator_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.ops_bust_participant(p_participant_id uuid, p_actor_id uuid, p_eliminator_id uuid) TO service_role;


--
-- Name: FUNCTION ops_claim_participant(p_view_token text, p_claim_pin text, p_user_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.ops_claim_participant(p_view_token text, p_claim_pin text, p_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.ops_claim_participant(p_view_token text, p_claim_pin text, p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.ops_claim_participant(p_view_token text, p_claim_pin text, p_user_id uuid) TO service_role;


--
-- Name: FUNCTION ops_clock_adjust(p_tournament_id uuid, p_actor_id uuid, p_delta_sec integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.ops_clock_adjust(p_tournament_id uuid, p_actor_id uuid, p_delta_sec integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.ops_clock_adjust(p_tournament_id uuid, p_actor_id uuid, p_delta_sec integer) TO authenticated;
GRANT ALL ON FUNCTION public.ops_clock_adjust(p_tournament_id uuid, p_actor_id uuid, p_delta_sec integer) TO service_role;


--
-- Name: FUNCTION ops_clock_pause(p_tournament_id uuid, p_actor_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.ops_clock_pause(p_tournament_id uuid, p_actor_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.ops_clock_pause(p_tournament_id uuid, p_actor_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.ops_clock_pause(p_tournament_id uuid, p_actor_id uuid) TO service_role;


--
-- Name: FUNCTION ops_clock_set_level(p_tournament_id uuid, p_actor_id uuid, p_sort integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.ops_clock_set_level(p_tournament_id uuid, p_actor_id uuid, p_sort integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.ops_clock_set_level(p_tournament_id uuid, p_actor_id uuid, p_sort integer) TO authenticated;
GRANT ALL ON FUNCTION public.ops_clock_set_level(p_tournament_id uuid, p_actor_id uuid, p_sort integer) TO service_role;


--
-- Name: FUNCTION ops_clock_start(p_tournament_id uuid, p_actor_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.ops_clock_start(p_tournament_id uuid, p_actor_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.ops_clock_start(p_tournament_id uuid, p_actor_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.ops_clock_start(p_tournament_id uuid, p_actor_id uuid) TO service_role;


--
-- Name: FUNCTION ops_close_table(p_table_id uuid, p_actor_id uuid, p_status public.ops_table_status); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.ops_close_table(p_table_id uuid, p_actor_id uuid, p_status public.ops_table_status) FROM PUBLIC;
GRANT ALL ON FUNCTION public.ops_close_table(p_table_id uuid, p_actor_id uuid, p_status public.ops_table_status) TO authenticated;
GRANT ALL ON FUNCTION public.ops_close_table(p_table_id uuid, p_actor_id uuid, p_status public.ops_table_status) TO service_role;


--
-- Name: FUNCTION ops_correct_participant_prize(p_participant_id uuid, p_actor_id uuid, p_amount integer, p_reason text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.ops_correct_participant_prize(p_participant_id uuid, p_actor_id uuid, p_amount integer, p_reason text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.ops_correct_participant_prize(p_participant_id uuid, p_actor_id uuid, p_amount integer, p_reason text) TO authenticated;
GRANT ALL ON FUNCTION public.ops_correct_participant_prize(p_participant_id uuid, p_actor_id uuid, p_amount integer, p_reason text) TO service_role;


--
-- Name: FUNCTION ops_create_tournament(p_owner_id uuid, p_name text, p_venue text, p_event_date date, p_game_type text, p_job_posting_id uuid, p_starting_chips integer, p_seats_per_table integer, p_config jsonb); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.ops_create_tournament(p_owner_id uuid, p_name text, p_venue text, p_event_date date, p_game_type text, p_job_posting_id uuid, p_starting_chips integer, p_seats_per_table integer, p_config jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.ops_create_tournament(p_owner_id uuid, p_name text, p_venue text, p_event_date date, p_game_type text, p_job_posting_id uuid, p_starting_chips integer, p_seats_per_table integer, p_config jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.ops_create_tournament(p_owner_id uuid, p_name text, p_venue text, p_event_date date, p_game_type text, p_job_posting_id uuid, p_starting_chips integer, p_seats_per_table integer, p_config jsonb) TO service_role;


--
-- Name: FUNCTION ops_free_seat(p_seat_id uuid, p_actor_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.ops_free_seat(p_seat_id uuid, p_actor_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.ops_free_seat(p_seat_id uuid, p_actor_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.ops_free_seat(p_seat_id uuid, p_actor_id uuid) TO service_role;


--
-- Name: FUNCTION ops_get_monitor_snapshot(p_monitor_token text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.ops_get_monitor_snapshot(p_monitor_token text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.ops_get_monitor_snapshot(p_monitor_token text) TO anon;
GRANT ALL ON FUNCTION public.ops_get_monitor_snapshot(p_monitor_token text) TO authenticated;
GRANT ALL ON FUNCTION public.ops_get_monitor_snapshot(p_monitor_token text) TO service_role;


--
-- Name: FUNCTION ops_get_player_view(p_view_token text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.ops_get_player_view(p_view_token text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.ops_get_player_view(p_view_token text) TO anon;
GRANT ALL ON FUNCTION public.ops_get_player_view(p_view_token text) TO authenticated;
GRANT ALL ON FUNCTION public.ops_get_player_view(p_view_token text) TO service_role;


--
-- Name: FUNCTION ops_import_staff_from_posting(p_tournament_id uuid, p_actor_id uuid, p_date text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.ops_import_staff_from_posting(p_tournament_id uuid, p_actor_id uuid, p_date text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.ops_import_staff_from_posting(p_tournament_id uuid, p_actor_id uuid, p_date text) TO authenticated;
GRANT ALL ON FUNCTION public.ops_import_staff_from_posting(p_tournament_id uuid, p_actor_id uuid, p_date text) TO service_role;


--
-- Name: FUNCTION ops_issue_player_credentials(p_participant_id uuid, p_actor_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.ops_issue_player_credentials(p_participant_id uuid, p_actor_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.ops_issue_player_credentials(p_participant_id uuid, p_actor_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.ops_issue_player_credentials(p_participant_id uuid, p_actor_id uuid) TO service_role;


--
-- Name: FUNCTION ops_move_seat(p_from_seat_id uuid, p_to_seat_id uuid, p_actor_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.ops_move_seat(p_from_seat_id uuid, p_to_seat_id uuid, p_actor_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.ops_move_seat(p_from_seat_id uuid, p_to_seat_id uuid, p_actor_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.ops_move_seat(p_from_seat_id uuid, p_to_seat_id uuid, p_actor_id uuid) TO service_role;


--
-- Name: FUNCTION ops_redraw_waitlist_fill(p_tournament_id uuid, p_actor_id uuid, p_assignments jsonb); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.ops_redraw_waitlist_fill(p_tournament_id uuid, p_actor_id uuid, p_assignments jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.ops_redraw_waitlist_fill(p_tournament_id uuid, p_actor_id uuid, p_assignments jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.ops_redraw_waitlist_fill(p_tournament_id uuid, p_actor_id uuid, p_assignments jsonb) TO service_role;


--
-- Name: FUNCTION ops_reenter_participant(p_participant_id uuid, p_actor_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.ops_reenter_participant(p_participant_id uuid, p_actor_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.ops_reenter_participant(p_participant_id uuid, p_actor_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.ops_reenter_participant(p_participant_id uuid, p_actor_id uuid) TO service_role;


--
-- Name: FUNCTION ops_register_participant(p_tournament_id uuid, p_actor_id uuid, p_name text, p_nationality text, p_phone text, p_buy_in_amount integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.ops_register_participant(p_tournament_id uuid, p_actor_id uuid, p_name text, p_nationality text, p_phone text, p_buy_in_amount integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.ops_register_participant(p_tournament_id uuid, p_actor_id uuid, p_name text, p_nationality text, p_phone text, p_buy_in_amount integer) TO authenticated;
GRANT ALL ON FUNCTION public.ops_register_participant(p_tournament_id uuid, p_actor_id uuid, p_name text, p_nationality text, p_phone text, p_buy_in_amount integer) TO service_role;


--
-- Name: FUNCTION ops_remove_staff(p_tournament_id uuid, p_actor_id uuid, p_ops_staff_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.ops_remove_staff(p_tournament_id uuid, p_actor_id uuid, p_ops_staff_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.ops_remove_staff(p_tournament_id uuid, p_actor_id uuid, p_ops_staff_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.ops_remove_staff(p_tournament_id uuid, p_actor_id uuid, p_ops_staff_id uuid) TO service_role;


--
-- Name: FUNCTION ops_reseat_participants(p_tournament_id uuid, p_actor_id uuid, p_assignments jsonb, p_mode text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.ops_reseat_participants(p_tournament_id uuid, p_actor_id uuid, p_assignments jsonb, p_mode text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.ops_reseat_participants(p_tournament_id uuid, p_actor_id uuid, p_assignments jsonb, p_mode text) TO authenticated;
GRANT ALL ON FUNCTION public.ops_reseat_participants(p_tournament_id uuid, p_actor_id uuid, p_assignments jsonb, p_mode text) TO service_role;


--
-- Name: FUNCTION ops_rotate_monitor_token(p_tournament_id uuid, p_actor_id uuid, p_force boolean); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.ops_rotate_monitor_token(p_tournament_id uuid, p_actor_id uuid, p_force boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.ops_rotate_monitor_token(p_tournament_id uuid, p_actor_id uuid, p_force boolean) TO authenticated;
GRANT ALL ON FUNCTION public.ops_rotate_monitor_token(p_tournament_id uuid, p_actor_id uuid, p_force boolean) TO service_role;


--
-- Name: FUNCTION ops_set_blind_levels(p_tournament_id uuid, p_actor_id uuid, p_levels jsonb); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.ops_set_blind_levels(p_tournament_id uuid, p_actor_id uuid, p_levels jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.ops_set_blind_levels(p_tournament_id uuid, p_actor_id uuid, p_levels jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.ops_set_blind_levels(p_tournament_id uuid, p_actor_id uuid, p_levels jsonb) TO service_role;


--
-- Name: FUNCTION ops_set_prize_structure(p_tournament_id uuid, p_actor_id uuid, p_prizes jsonb); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.ops_set_prize_structure(p_tournament_id uuid, p_actor_id uuid, p_prizes jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.ops_set_prize_structure(p_tournament_id uuid, p_actor_id uuid, p_prizes jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.ops_set_prize_structure(p_tournament_id uuid, p_actor_id uuid, p_prizes jsonb) TO service_role;


--
-- Name: FUNCTION ops_set_table_lock(p_table_id uuid, p_actor_id uuid, p_lock_type public.ops_table_lock_type); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.ops_set_table_lock(p_table_id uuid, p_actor_id uuid, p_lock_type public.ops_table_lock_type) FROM PUBLIC;
GRANT ALL ON FUNCTION public.ops_set_table_lock(p_table_id uuid, p_actor_id uuid, p_lock_type public.ops_table_lock_type) TO authenticated;
GRANT ALL ON FUNCTION public.ops_set_table_lock(p_table_id uuid, p_actor_id uuid, p_lock_type public.ops_table_lock_type) TO service_role;


--
-- Name: FUNCTION ops_set_table_priority(p_table_id uuid, p_actor_id uuid, p_priority integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.ops_set_table_priority(p_table_id uuid, p_actor_id uuid, p_priority integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.ops_set_table_priority(p_table_id uuid, p_actor_id uuid, p_priority integer) TO authenticated;
GRANT ALL ON FUNCTION public.ops_set_table_priority(p_table_id uuid, p_actor_id uuid, p_priority integer) TO service_role;


--
-- Name: FUNCTION ops_set_tournament_posting(p_tournament_id uuid, p_actor_id uuid, p_job_posting_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.ops_set_tournament_posting(p_tournament_id uuid, p_actor_id uuid, p_job_posting_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.ops_set_tournament_posting(p_tournament_id uuid, p_actor_id uuid, p_job_posting_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.ops_set_tournament_posting(p_tournament_id uuid, p_actor_id uuid, p_job_posting_id uuid) TO service_role;


--
-- Name: FUNCTION ops_set_tournament_status(p_tournament_id uuid, p_actor_id uuid, p_status public.ops_tournament_status); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.ops_set_tournament_status(p_tournament_id uuid, p_actor_id uuid, p_status public.ops_tournament_status) FROM PUBLIC;
GRANT ALL ON FUNCTION public.ops_set_tournament_status(p_tournament_id uuid, p_actor_id uuid, p_status public.ops_tournament_status) TO authenticated;
GRANT ALL ON FUNCTION public.ops_set_tournament_status(p_tournament_id uuid, p_actor_id uuid, p_status public.ops_tournament_status) TO service_role;


--
-- Name: FUNCTION ops_toggle_registration(p_tournament_id uuid, p_actor_id uuid, p_open boolean); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.ops_toggle_registration(p_tournament_id uuid, p_actor_id uuid, p_open boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.ops_toggle_registration(p_tournament_id uuid, p_actor_id uuid, p_open boolean) TO authenticated;
GRANT ALL ON FUNCTION public.ops_toggle_registration(p_tournament_id uuid, p_actor_id uuid, p_open boolean) TO service_role;


--
-- Name: FUNCTION ops_unclaim_participant(p_participant_id uuid, p_actor_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.ops_unclaim_participant(p_participant_id uuid, p_actor_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.ops_unclaim_participant(p_participant_id uuid, p_actor_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.ops_unclaim_participant(p_participant_id uuid, p_actor_id uuid) TO service_role;


--
-- Name: FUNCTION ops_undo_bust(p_participant_id uuid, p_actor_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.ops_undo_bust(p_participant_id uuid, p_actor_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.ops_undo_bust(p_participant_id uuid, p_actor_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.ops_undo_bust(p_participant_id uuid, p_actor_id uuid) TO service_role;


--
-- Name: FUNCTION ops_update_tournament(p_tournament_id uuid, p_actor_id uuid, p_patch jsonb); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.ops_update_tournament(p_tournament_id uuid, p_actor_id uuid, p_patch jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.ops_update_tournament(p_tournament_id uuid, p_actor_id uuid, p_patch jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.ops_update_tournament(p_tournament_id uuid, p_actor_id uuid, p_patch jsonb) TO service_role;


--
-- Name: FUNCTION permanently_delete_user(p_user_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.permanently_delete_user(p_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.permanently_delete_user(p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.permanently_delete_user(p_user_id uuid) TO service_role;


--
-- Name: FUNCTION prevent_role_self_escalation(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.prevent_role_self_escalation() TO anon;
GRANT ALL ON FUNCTION public.prevent_role_self_escalation() TO authenticated;
GRANT ALL ON FUNCTION public.prevent_role_self_escalation() TO service_role;


--
-- Name: FUNCTION process_qr_checkin_atomically(p_work_log_id uuid, p_staff_id uuid, p_job_posting_id uuid, p_action text, p_check_time timestamp with time zone, p_expected_date text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.process_qr_checkin_atomically(p_work_log_id uuid, p_staff_id uuid, p_job_posting_id uuid, p_action text, p_check_time timestamp with time zone, p_expected_date text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.process_qr_checkin_atomically(p_work_log_id uuid, p_staff_id uuid, p_job_posting_id uuid, p_action text, p_check_time timestamp with time zone, p_expected_date text) TO authenticated;
GRANT ALL ON FUNCTION public.process_qr_checkin_atomically(p_work_log_id uuid, p_staff_id uuid, p_job_posting_id uuid, p_action text, p_check_time timestamp with time zone, p_expected_date text) TO service_role;


--
-- Name: FUNCTION protect_work_log_payroll_columns(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.protect_work_log_payroll_columns() TO anon;
GRANT ALL ON FUNCTION public.protect_work_log_payroll_columns() TO authenticated;
GRANT ALL ON FUNCTION public.protect_work_log_payroll_columns() TO service_role;


--
-- Name: FUNCTION register_as_employer(p_employer_agreements jsonb, p_intro text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.register_as_employer(p_employer_agreements jsonb, p_intro text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.register_as_employer(p_employer_agreements jsonb, p_intro text) TO authenticated;
GRANT ALL ON FUNCTION public.register_as_employer(p_employer_agreements jsonb, p_intro text) TO service_role;


--
-- Name: FUNCTION reject_employer_application(p_app_id uuid, p_reason text, p_category text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.reject_employer_application(p_app_id uuid, p_reason text, p_category text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.reject_employer_application(p_app_id uuid, p_reason text, p_category text) TO authenticated;
GRANT ALL ON FUNCTION public.reject_employer_application(p_app_id uuid, p_reason text, p_category text) TO service_role;


--
-- Name: FUNCTION reject_workspace_invitation(p_invitation_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.reject_workspace_invitation(p_invitation_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.reject_workspace_invitation(p_invitation_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.reject_workspace_invitation(p_invitation_id uuid) TO service_role;


--
-- Name: FUNCTION remove_direct_staff(p_work_log_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.remove_direct_staff(p_work_log_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.remove_direct_staff(p_work_log_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.remove_direct_staff(p_work_log_id uuid) TO service_role;


--
-- Name: FUNCTION remove_workspace_member(p_workspace_id uuid, p_user_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.remove_workspace_member(p_workspace_id uuid, p_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.remove_workspace_member(p_workspace_id uuid, p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.remove_workspace_member(p_workspace_id uuid, p_user_id uuid) TO service_role;


--
-- Name: FUNCTION reset_unread_counter(p_user_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.reset_unread_counter(p_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.reset_unread_counter(p_user_id uuid) TO service_role;


--
-- Name: FUNCTION restore_workspace(p_workspace_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.restore_workspace(p_workspace_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.restore_workspace(p_workspace_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.restore_workspace(p_workspace_id uuid) TO service_role;


--
-- Name: FUNCTION review_report(p_report_id uuid, p_status text, p_reviewer_id uuid, p_reviewer_notes text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.review_report(p_report_id uuid, p_status text, p_reviewer_id uuid, p_reviewer_notes text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.review_report(p_report_id uuid, p_status text, p_reviewer_id uuid, p_reviewer_notes text) TO authenticated;
GRANT ALL ON FUNCTION public.review_report(p_report_id uuid, p_status text, p_reviewer_id uuid, p_reviewer_notes text) TO service_role;


--
-- Name: FUNCTION revoke_workspace_invitation(p_invitation_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.revoke_workspace_invitation(p_invitation_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.revoke_workspace_invitation(p_invitation_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.revoke_workspace_invitation(p_invitation_id uuid) TO service_role;


--
-- Name: FUNCTION rls_auto_enable(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC;
GRANT ALL ON FUNCTION public.rls_auto_enable() TO authenticated;
GRANT ALL ON FUNCTION public.rls_auto_enable() TO service_role;


--
-- Name: FUNCTION search_users_by_phone(p_phone text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.search_users_by_phone(p_phone text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.search_users_by_phone(p_phone text) TO authenticated;
GRANT ALL ON FUNCTION public.search_users_by_phone(p_phone text) TO service_role;


--
-- Name: FUNCTION search_users_for_collaborator_invite(p_job_posting_id uuid, p_email_query text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.search_users_for_collaborator_invite(p_job_posting_id uuid, p_email_query text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.search_users_for_collaborator_invite(p_job_posting_id uuid, p_email_query text) TO authenticated;
GRANT ALL ON FUNCTION public.search_users_for_collaborator_invite(p_job_posting_id uuid, p_email_query text) TO service_role;


--
-- Name: FUNCTION set_venue_soft_target(p_venue uuid, p_date text, p_count integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.set_venue_soft_target(p_venue uuid, p_date text, p_count integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_venue_soft_target(p_venue uuid, p_date text, p_count integer) TO authenticated;
GRANT ALL ON FUNCTION public.set_venue_soft_target(p_venue uuid, p_date text, p_count integer) TO service_role;


--
-- Name: FUNCTION sync_schedule_board(p_job_posting_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.sync_schedule_board(p_job_posting_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.sync_schedule_board(p_job_posting_id uuid) TO service_role;


--
-- Name: FUNCTION sync_user_role_to_app_metadata(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.sync_user_role_to_app_metadata() TO anon;
GRANT ALL ON FUNCTION public.sync_user_role_to_app_metadata() TO authenticated;
GRANT ALL ON FUNCTION public.sync_user_role_to_app_metadata() TO service_role;


--
-- Name: FUNCTION toggle_board_post_vote(p_post_id text, p_user_id uuid, p_vote_type text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.toggle_board_post_vote(p_post_id text, p_user_id uuid, p_vote_type text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.toggle_board_post_vote(p_post_id text, p_user_id uuid, p_vote_type text) TO authenticated;
GRANT ALL ON FUNCTION public.toggle_board_post_vote(p_post_id text, p_user_id uuid, p_vote_type text) TO service_role;


--
-- Name: FUNCTION toggle_comment_reaction(p_post_id uuid, p_comment_id uuid, p_user_id uuid, p_reaction_type text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.toggle_comment_reaction(p_post_id uuid, p_comment_id uuid, p_user_id uuid, p_reaction_type text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.toggle_comment_reaction(p_post_id uuid, p_comment_id uuid, p_user_id uuid, p_reaction_type text) TO authenticated;
GRANT ALL ON FUNCTION public.toggle_comment_reaction(p_post_id uuid, p_comment_id uuid, p_user_id uuid, p_reaction_type text) TO service_role;


--
-- Name: FUNCTION trigger_send_push_notification(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.trigger_send_push_notification() TO anon;
GRANT ALL ON FUNCTION public.trigger_send_push_notification() TO authenticated;
GRANT ALL ON FUNCTION public.trigger_send_push_notification() TO service_role;


--
-- Name: FUNCTION update_updated_at(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.update_updated_at() TO anon;
GRANT ALL ON FUNCTION public.update_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.update_updated_at() TO service_role;


--
-- Name: FUNCTION update_user_role(p_user_id uuid, p_new_role text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.update_user_role(p_user_id uuid, p_new_role text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.update_user_role(p_user_id uuid, p_new_role text) TO authenticated;
GRANT ALL ON FUNCTION public.update_user_role(p_user_id uuid, p_new_role text) TO service_role;


--
-- Name: FUNCTION venue_span_posting_ids(p_venue uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.venue_span_posting_ids(p_venue uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.venue_span_posting_ids(p_venue uuid) TO authenticated;
GRANT ALL ON FUNCTION public.venue_span_posting_ids(p_venue uuid) TO service_role;


--
-- Name: FUNCTION workspace_count_for_owner(_owner_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.workspace_count_for_owner(_owner_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.workspace_count_for_owner(_owner_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.workspace_count_for_owner(_owner_id uuid) TO service_role;


--
-- Name: TABLE action_logs; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.action_logs TO anon;
GRANT ALL ON TABLE public.action_logs TO authenticated;
GRANT ALL ON TABLE public.action_logs TO service_role;


--
-- Name: TABLE announcements; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.announcements TO anon;
GRANT ALL ON TABLE public.announcements TO authenticated;
GRANT ALL ON TABLE public.announcements TO service_role;


--
-- Name: TABLE app_config; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.app_config TO anon;
GRANT ALL ON TABLE public.app_config TO authenticated;
GRANT ALL ON TABLE public.app_config TO service_role;


--
-- Name: TABLE board_comment_reactions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.board_comment_reactions TO anon;
GRANT ALL ON TABLE public.board_comment_reactions TO authenticated;
GRANT ALL ON TABLE public.board_comment_reactions TO service_role;


--
-- Name: TABLE board_comments; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.board_comments TO anon;
GRANT ALL ON TABLE public.board_comments TO authenticated;
GRANT ALL ON TABLE public.board_comments TO service_role;


--
-- Name: TABLE board_memberships; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.board_memberships TO anon;
GRANT ALL ON TABLE public.board_memberships TO authenticated;
GRANT ALL ON TABLE public.board_memberships TO service_role;


--
-- Name: TABLE board_posts; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.board_posts TO anon;
GRANT ALL ON TABLE public.board_posts TO authenticated;
GRANT ALL ON TABLE public.board_posts TO service_role;


--
-- Name: TABLE board_reports; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.board_reports TO anon;
GRANT ALL ON TABLE public.board_reports TO authenticated;
GRANT ALL ON TABLE public.board_reports TO service_role;


--
-- Name: TABLE board_votes; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.board_votes TO anon;
GRANT ALL ON TABLE public.board_votes TO authenticated;
GRANT ALL ON TABLE public.board_votes TO service_role;


--
-- Name: TABLE employer_applications; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.employer_applications TO anon;
GRANT ALL ON TABLE public.employer_applications TO authenticated;
GRANT ALL ON TABLE public.employer_applications TO service_role;


--
-- Name: TABLE fcm_tokens; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.fcm_tokens TO anon;
GRANT ALL ON TABLE public.fcm_tokens TO authenticated;
GRANT ALL ON TABLE public.fcm_tokens TO service_role;


--
-- Name: TABLE inquiries; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.inquiries TO anon;
GRANT ALL ON TABLE public.inquiries TO authenticated;
GRANT ALL ON TABLE public.inquiries TO service_role;


--
-- Name: TABLE job_posting_collaborator_audit; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.job_posting_collaborator_audit TO anon;
GRANT ALL ON TABLE public.job_posting_collaborator_audit TO authenticated;
GRANT ALL ON TABLE public.job_posting_collaborator_audit TO service_role;


--
-- Name: TABLE job_posting_collaborators; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.job_posting_collaborators TO anon;
GRANT ALL ON TABLE public.job_posting_collaborators TO authenticated;
GRANT ALL ON TABLE public.job_posting_collaborators TO service_role;


--
-- Name: TABLE job_posting_templates; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.job_posting_templates TO anon;
GRANT ALL ON TABLE public.job_posting_templates TO authenticated;
GRANT ALL ON TABLE public.job_posting_templates TO service_role;


--
-- Name: TABLE notification_counters; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.notification_counters TO anon;
GRANT ALL ON TABLE public.notification_counters TO authenticated;
GRANT ALL ON TABLE public.notification_counters TO service_role;


--
-- Name: TABLE notification_settings; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.notification_settings TO anon;
GRANT ALL ON TABLE public.notification_settings TO authenticated;
GRANT ALL ON TABLE public.notification_settings TO service_role;


--
-- Name: TABLE notifications; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.notifications TO anon;
GRANT ALL ON TABLE public.notifications TO authenticated;
GRANT ALL ON TABLE public.notifications TO service_role;


--
-- Name: TABLE ops_blind_levels; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.ops_blind_levels TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.ops_blind_levels TO authenticated;
GRANT ALL ON TABLE public.ops_blind_levels TO service_role;


--
-- Name: TABLE ops_clock; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.ops_clock TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.ops_clock TO authenticated;
GRANT ALL ON TABLE public.ops_clock TO service_role;


--
-- Name: TABLE ops_events; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.ops_events TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.ops_events TO authenticated;
GRANT ALL ON TABLE public.ops_events TO service_role;


--
-- Name: SEQUENCE ops_events_seq_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.ops_events_seq_seq TO anon;
GRANT ALL ON SEQUENCE public.ops_events_seq_seq TO authenticated;
GRANT ALL ON SEQUENCE public.ops_events_seq_seq TO service_role;


--
-- Name: TABLE ops_live_stats; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.ops_live_stats TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.ops_live_stats TO authenticated;
GRANT ALL ON TABLE public.ops_live_stats TO service_role;


--
-- Name: TABLE ops_participants; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.ops_participants TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.ops_participants TO authenticated;
GRANT ALL ON TABLE public.ops_participants TO service_role;


--
-- Name: TABLE ops_prizes; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.ops_prizes TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.ops_prizes TO authenticated;
GRANT ALL ON TABLE public.ops_prizes TO service_role;


--
-- Name: TABLE ops_seats; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.ops_seats TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.ops_seats TO authenticated;
GRANT ALL ON TABLE public.ops_seats TO service_role;


--
-- Name: TABLE ops_staff; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.ops_staff TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.ops_staff TO authenticated;
GRANT ALL ON TABLE public.ops_staff TO service_role;


--
-- Name: TABLE ops_tables; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.ops_tables TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.ops_tables TO authenticated;
GRANT ALL ON TABLE public.ops_tables TO service_role;


--
-- Name: TABLE ops_tournaments; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.ops_tournaments TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.ops_tournaments TO authenticated;
GRANT ALL ON TABLE public.ops_tournaments TO service_role;


--
-- Name: TABLE processed_identity_verifications; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.processed_identity_verifications TO anon;
GRANT ALL ON TABLE public.processed_identity_verifications TO authenticated;
GRANT ALL ON TABLE public.processed_identity_verifications TO service_role;


--
-- Name: TABLE rate_limits; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.rate_limits TO anon;
GRANT ALL ON TABLE public.rate_limits TO authenticated;
GRANT ALL ON TABLE public.rate_limits TO service_role;


--
-- Name: TABLE reports; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.reports TO anon;
GRANT ALL ON TABLE public.reports TO authenticated;
GRANT ALL ON TABLE public.reports TO service_role;


--
-- Name: TABLE reviews; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.reviews TO anon;
GRANT ALL ON TABLE public.reviews TO authenticated;
GRANT ALL ON TABLE public.reviews TO service_role;


--
-- Name: TABLE schedule_board_sync_outbox; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.schedule_board_sync_outbox TO anon;
GRANT ALL ON TABLE public.schedule_board_sync_outbox TO authenticated;
GRANT ALL ON TABLE public.schedule_board_sync_outbox TO service_role;


--
-- Name: TABLE user_consents; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.user_consents TO anon;
GRANT ALL ON TABLE public.user_consents TO authenticated;
GRANT ALL ON TABLE public.user_consents TO service_role;


--
-- Name: TABLE users; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.users TO anon;
GRANT ALL ON TABLE public.users TO authenticated;
GRANT ALL ON TABLE public.users TO service_role;


--
-- Name: TABLE workspace_invitations; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.workspace_invitations TO anon;
GRANT ALL ON TABLE public.workspace_invitations TO authenticated;
GRANT ALL ON TABLE public.workspace_invitations TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--



--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--



--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--



--
-- PostgreSQL database dump complete
--


