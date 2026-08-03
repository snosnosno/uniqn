-- ============================================================
-- R0 — 시간 '미정' 표현 통일: 서버 선행 마이그레이션
-- 설계 진실원: docs/analysis/2026-08-03-time-model-redesign.md (§3 R0)
--
-- ── 이 마이그레이션이 존재하는 이유 (CRITICAL) ──────────────
-- 현행은 "시간 미정"을 **네 가지 값**으로 표현한다: NULL / '' / '미정' / 'NEGOTIABLE'.
-- 그런데 `_posting_slot_key` 는 앞의 셋만 '미정' 으로 접고 **'NEGOTIABLE' 만 자기 자신이 키가
-- 된다**(baseline:535-542 실측). 동시에 정원 검사의 공고 측 키는 고정공고일 때
-- `WHEN v_is_fixed THEN 'NEGOTIABLE'` 로 만들어진다.
--
--   공고 측 키 = 'NEGOTIABLE'   ↔   지원서 측 키 = _posting_slot_key(클라가 보낸 값)
--
-- 즉 **클라가 어느 센티널을 보내느냐에 따라 두 키가 갈린다.** 갈리면 정원 조회가 0행을 내고
-- `v_capacity`=0 이 되는데, 가드는 `IF v_capacity > 0 AND ...` 이라 **통째로 건너뛴다** —
-- 고정공고에서 무제한 초과 배정이 열린다. R1(클라가 'NEGOTIABLE' 대신 '미정' 을 보냄)을
-- 이것 없이 먼저 배포하면 그 순간 이 구멍이 열린다. 그래서 R0 가 **반드시 선행**한다.
--
-- ── 실측 근거 (prod, 2026-08-03) ────────────────────────────
--   · 'NEGOTIABLE' 리터럴을 가진 public 함수 = 정확히 3개
--     (confirm_application · add_direct_staff · notify_on_work_log_update)
--     → 프롬프트가 지목했던 "seat-basis 정원 카운트 계열"에는 **없다**(pg_proc.prosrc 전수).
--   · `_posting_slot_key` 에 의존하는 인덱스·제약·생성컬럼 = **0건**(pg_depend 실측) → 재정의 안전.
--   · `_posting_slot_key` 호출자 = add_direct_staff · confirm_application ·
--     count_posting_confirmed_by_slot · update_work_log_slot (4개).
--   · work_logs 전체 3행: 범위형 2('18:30 - 03:00'·'17:00 - 00:00') + 정규형 1.
--     'NEGOTIABLE'·'미정'·''·NULL 행은 **0건**.
--   · fixed 공고 **0건** → 이 변경의 데이터 노출도는 현재 0. 계약(코드 경로)만 고친다.
--   · 공고 schedule 안의 시각 값은 전부 0패딩('09:00'…), isTimeToBeAnnounced 슬롯 0건.
--
-- ── 재정의 규율 (실사고 기반) ───────────────────────────────
-- 🔴 DROP FUNCTION 금지 — `CREATE OR REPLACE` 만. DROP 하면 회수해 둔 PUBLIC EXECUTE 가
--    기본 GRANT 로 되살아난다(20260730174805 이 회수한 상태).
-- 🔴 `SET search_path` 는 **함수마다 다르다**. CREATE OR REPLACE 는 명시하지 않은 속성을
--    기본값으로 되돌리므로(=proconfig 통째 교체) prod 실측값을 그대로 복사한다:
--      _posting_slot_key            → pg_catalog, pg_temp
--      confirm_application          → public, pg_temp        (extensions 없음!)
--      add_direct_staff             → public, extensions, pg_temp
--      notify_on_job_posting_update → public, extensions, pg_temp
-- 🔴 구클라 하위호환이 R0 의 존재 이유다 — 센티널이 와도 **에러가 아니라 흡수**여야 한다.
--    23514(CHECK 위반)를 내면 설계 위반이다.
--
-- ⚠️ 함수 카운트: 192 → **193** (신설 1개 `_normalize_time_slot`, 재정의 4개).
-- ============================================================

-- ------------------------------------------------------------
-- 1) 신설: _normalize_time_slot — work_logs.time_slot 저장 직전 정본화
--
--    비유: 손님이 "저녁쯤"이라 적든 "미정"이라 적든 예약 장부에는 **빈칸 하나**로 적는다.
--          시각을 적었으면 '9시'가 아니라 '09:00' 으로 통일해 적는다.
--
--    🔑 설계 원칙 — **아는 형태만 흡수하고, 모르는 형태는 건드리지 않는다.**
--       미지의 값을 NULL 로 접으면 오타 하나가 조용히 '미정' 으로 둔갑해 사라진다.
--       그대로 통과시키면 기존 CHECK(`work_logs_time_slot_format`)이 지금처럼 계속 잡는다.
--       즉 이 함수는 방어를 **추가만** 하고 제거하지 않는다.
--
--    0패딩을 여기서 하는 이유: CHECK 의 정규식이 `[01][0-9]|2[0-3]` 라 '9:00' 은 애초에
--    통과하지 못하고, `_posting_slot_key` 가 원문 문자열을 키로 쓰므로 '9:00' 과 '09:00' 이
--    다른 슬롯으로 쪼개져 정원 판정이 조용히 갈린다(20260802180000 §156-159 선례).
--
--    권한: SECDEF 가 아니고 테이블에 접근하지 않는 순수 텍스트 함수라 형제 헬퍼
--    `_posting_slot_key` 와 동일하게 기본 PUBLIC EXECUTE 를 둔다.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._normalize_time_slot(p_raw text) RETURNS text
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'pg_catalog', 'pg_temp'
    AS $$
  SELECT CASE
    -- 미정 센티널 4종(NULL · '' · 공백 · '미정' · 'NEGOTIABLE') → NULL 하나로 수렴
    WHEN head IS NULL                       THEN NULL
    WHEN head IN ('미정', 'NEGOTIABLE')     THEN NULL
    -- 단일 시각 + 범위형('18:30 - 03:00' → '18:30')을 같은 경로로 접고 0패딩까지 마친다
    WHEN head ~ '^([01]?[0-9]|2[0-3]):[0-5][0-9]$'
      THEN lpad(split_part(head, ':', 1), 2, '0') || ':' || split_part(head, ':', 2)
    -- 해석 불가 → 원문 그대로. 기존 CHECK 이 계속 잡는다(방어 제거 금지).
    ELSE p_raw
  END
  FROM (
    SELECT NULLIF(btrim((regexp_split_to_array(COALESCE(p_raw, ''), '[-~]'))[1]), '') AS head
  ) s;
$$;

COMMENT ON FUNCTION public._normalize_time_slot(p_raw text) IS
  'work_logs.time_slot 저장 정본화 — 센티널(NULL/''''/''미정''/''NEGOTIABLE'')→NULL, 범위형→시작시각, 시각→0패딩 ''HH:mm''. '
  '해석 불가 값은 원문 그대로 통과시켜 기존 CHECK 이 계속 잡게 한다(방어 추가만, 제거 없음).';


-- ------------------------------------------------------------
-- 2) 재정의: _posting_slot_key — 'NEGOTIABLE' 을 '미정' 으로 흡수
--    이 한 줄이 "공고 측 키 ↔ 지원서 측 키" 분열의 절반을 없앤다. 나머지 절반은 §3·§4 의
--    정원 CASE 리터럴 교정이다. **둘은 반드시 같은 마이그레이션에 있어야 한다** —
--    한쪽만 적용하면 분열 방향만 뒤집힌다.
--
--    ⚠️ baseline 파일에는 `SET` 절이 없지만 prod 는 `search_path=pg_catalog, pg_temp` 를
--       갖고 있다(후속 하드닝 마이그가 ALTER 로 얹은 것). 명시하지 않으면 여기서 유실된다.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._posting_slot_key(p_time_slot text) RETURNS text
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'pg_catalog', 'pg_temp'
    AS $$
  SELECT CASE
    WHEN p_time_slot IS NULL
      OR btrim(p_time_slot) IN ('', '미정', 'NEGOTIABLE') THEN '미정'
    ELSE btrim((regexp_split_to_array(p_time_slot, '[-~]'))[1])
  END;
$$;

COMMENT ON FUNCTION public._posting_slot_key(p_time_slot text) IS
  '슬롯 표시/집계 공유 키 — 미정 센티널 4종(NULL/''''/''미정''/''NEGOTIABLE'')→''미정'', 범위→시작시각. parseTimeSlot 동치.';


-- ------------------------------------------------------------
-- 3) 재정의: confirm_application
--    20260718000100 본문 그대로 + 두 곳만 교정:
--      (a) 정원 CASE 의 `WHEN v_is_fixed THEN 'NEGOTIABLE'` → `'미정'`
--          (§2 로 지원서 측이 '미정' 으로 접히므로 공고 측도 같은 값이어야 만난다.
--           이 분기는 startTime/time 이 NULL 인 경우에만 도달하므로 ELSE 의
--           `_posting_slot_key(NULL)` = '미정' 과 동치다 — 의도를 남기려 분기는 유지한다.)
--      (b) work_logs INSERT 의 timeSlot 을 `_normalize_time_slot` 경유
--          (구클라·구데이터·취소복원이 낡은 값을 재전송해도 여기서 전부 흡수된다.
--           **applications jsonb 백필이 통째로 불필요해지는 핵심 장치**.)
--    나머지는 한 글자도 손대지 않았다.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.confirm_application(p_application_id uuid, p_owner_id uuid, p_assignments jsonb DEFAULT '[]'::jsonb, p_original_application jsonb DEFAULT NULL::jsonb, p_confirmation_history jsonb DEFAULT '[]'::jsonb, p_notes text DEFAULT NULL::text, p_is_fixed_posting boolean DEFAULT false, p_assignments_v3 jsonb DEFAULT NULL::jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
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

  -- [P2] owner_id NULL(고아 공고) fail-closed — COALESCE 로 NULL→false (형제 RPC 3종과 정합).
  IF NOT (COALESCE(v_job.owner_id = p_owner_id, false) OR public.is_workspace_member(v_job.workspace_id, p_owner_id)
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
              -- [R0] 고정공고 협의 슬롯도 '미정' 키로 접는다(구 'NEGOTIABLE' 폐지).
              WHEN v_is_fixed THEN '미정'
              ELSE public._posting_slot_key(COALESCE(ts->>'startTime', ts->>'time'))
            END) = v_rec.slot_key
        AND public._posting_role_key(r->>'role', r->>'customRole') = v_rec.role_key;

      -- [관측] capacity=0 = 정원가드 우회(슬롯/역할/날짜 미매칭). 좌석 기준 스펙 리스크 추적용 로그.
      IF v_capacity = 0 THEN
        RAISE LOG 'capacity=0 match: posting=% date=% slot=% role=%',
          v_app.job_posting_id, v_rec.a_date, v_rec.slot_key, v_rec.role_key;
      END IF;

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
        -- [R0] 신뢰 경계 정규화: 센티널→NULL, 범위형→시작시각, 0패딩.
        v_assignment->>'groupId', v_assignment->>'date',
        public._normalize_time_slot(v_assignment->>'timeSlot'),
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

COMMENT ON FUNCTION public.confirm_application(uuid, uuid, jsonb, jsonb, jsonb, text, boolean, jsonb) IS
  '지원서 확정 RPC. work_logs=flat 전개, filled 는 seat 트리거가 좌석 단위(+N) 자동 반영. 슬롯 정원가드 유지. owner_id NULL fail-closed(COALESCE, 형제 3종 정합). '
  '[R0] 미정 키는 ''미정'' 하나로 통일(고정공고 포함) + work_logs.time_slot 은 _normalize_time_slot 경유 저장.';

-- CREATE OR REPLACE 는 ACL 을 보존하지만 회수 상태를 명시적으로 재확인한다(멱등).
REVOKE ALL ON FUNCTION public.confirm_application(uuid, uuid, jsonb, jsonb, jsonb, text, boolean, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_application(uuid, uuid, jsonb, jsonb, jsonb, text, boolean, jsonb) TO authenticated;


-- ------------------------------------------------------------
-- 4) 재정의: add_direct_staff
--    20260718000000 본문 그대로 + §3 과 **같은 두 곳**만 교정.
--    🔑 중복 가드(`DUPLICATE_ASSIGNMENT`)는 양변 모두 `_posting_slot_key` 경유라
--       §2 의 흡수로 자동 정합된다 — 별도 수정 불필요.
-- ------------------------------------------------------------
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
            -- [R0] 고정공고 협의 슬롯도 '미정' 키로 접는다(구 'NEGOTIABLE' 폐지).
            WHEN v_is_fixed THEN '미정'
            ELSE public._posting_slot_key(COALESCE(ts->>'startTime', ts->>'time'))
          END) = v_rec.slot_key
      AND public._posting_role_key(r->>'role', r->>'customRole') = v_rec.role_key;

    IF v_capacity > 0 AND v_existing + v_rec.requested > v_capacity THEN
      RAISE EXCEPTION 'MAX_CAPACITY_REACHED: role=% date=% slot=% (% / %)',
        v_rec.role_key, v_rec.a_date, v_rec.slot_key, v_existing + v_rec.requested, v_capacity;
    END IF;
  END LOOP;

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
      -- [R0] 신뢰 경계 정규화: 센티널→NULL, 범위형→시작시각, 0패딩.
      v_assignment->>'date', public._normalize_time_slot(v_assignment->>'timeSlot'),
      v_staff.name, v_staff.nickname, v_staff.photo_url, v_staff.photo_url_blurhash,
      COALESCE((v_assignment->>'role')::staff_role, 'staff'::staff_role),
      v_assignment->>'customRole', v_owner,
      'scheduled', v_is_fixed, v_assignment->>'notes',
      v_now, v_now
    ) RETURNING id INTO v_wl_id;
    v_work_log_ids := array_append(v_work_log_ids, v_wl_id);
  END LOOP;

  -- filled 는 seat 트리거가 좌석 단위(+N) 자동 반영(컨테이너 SKIP). capacity_full 전이도 BEFORE 트리거 자동.
  RETURN jsonb_build_object(
    'jobPostingId', p_job_posting_id,
    'staffId', p_staff_id,
    'workLogIds', to_jsonb(v_work_log_ids)
  );
END;
$$;

COMMENT ON FUNCTION public.add_direct_staff(uuid, uuid, jsonb) IS
  '지원서 없이 스태프(work_logs) 직접 추가. 정원가드·중복가드 유지, filled 는 좌석 트리거 소관. '
  '[R0] 미정 키는 ''미정'' 하나로 통일(고정공고 포함) + work_logs.time_slot 은 _normalize_time_slot 경유 저장.';

REVOKE ALL ON FUNCTION public.add_direct_staff(uuid, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_direct_staff(uuid, uuid, jsonb) TO authenticated;


-- ------------------------------------------------------------
-- 5) 재정의: notify_on_job_posting_update — 확정자 분리 + 직접 배치 스태프 수신 누락 해소
--    20260802170100 본문 그대로 + 두 가지만 추가:
--
--    (a) **수신자 누락**: 현행 수신자 조인은 `applications` 단독이라
--        `add_direct_staff` 로 배치된 스태프(application_id NULL, 지원서 자체가 없음)는
--        공고 수정·마감·**취소** 알림을 **한 번도 받지 못했다.** 계약(work_log)을 가진
--        사람이므로 확정 지원자와 동일하게 취급한다.
--        중복 방지: 같은 사람이 지원서와 직접배치 work_log 를 동시에 가질 수 있으므로
--        recipient_id 로 접은 뒤 1건만 넣는다(기존 SELECT DISTINCT 와 같은 보증).
--
--    (b) **확정자 오도 문구**: 설계 원칙 "공고=광고, work_log=계약" 상 공고 수정은
--        확정자에게 전파되지 않는다. 그런데 현행은 확정자에게도 `/jobs/{id}` 를 보낸다 —
--        "근무일이 변경되었습니다" + 공고 링크는 "내 근무가 바뀐다"는 정반대 뜻으로 읽힌다.
--        근무일·시간 축이 바뀐 경우에 한해 확정자에게는 문장을 덧붙이고 `/schedule` 로 보낸다.
--        (급여·장소 등 다른 축은 현행 그대로 — 판단 근거가 없는 확대를 하지 않는다.)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_on_job_posting_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_changed_fields text[] := ARRAY[]::text[];
  v_changed_labels text[] := ARRAY[]::text[];
  v_date_changed boolean;
  v_last_label text;
  v_last_char_code int;
  v_josa text;
  v_status_transitioned boolean;
  v_notif_type text;
  v_notif_title text;
  v_notif_body text;
  v_notif_link text;
  v_notif_priority text;
  v_notif_data jsonb;
  -- [R0] 계약 보유자(확정 지원자 + 직접배치 스태프) 전용 문구·목적지.
  --      NULL 이면 분리하지 않고 전원이 같은 알림을 받는다(기존 동작).
  v_contract_body text;
  v_contract_link text;
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
      v_changed_fields := array_append(v_changed_fields, 'title');
    END IF;
    IF OLD.location IS DISTINCT FROM NEW.location THEN
      v_changed_fields := array_append(v_changed_fields, 'location');
    END IF;
    IF OLD.work_date IS DISTINCT FROM NEW.work_date THEN
      v_changed_fields := array_append(v_changed_fields, 'workDate');
    END IF;
    IF OLD.work_dates IS DISTINCT FROM NEW.work_dates THEN
      v_changed_fields := array_append(v_changed_fields, 'workDates');
    END IF;
    IF OLD.schedule IS DISTINCT FROM NEW.schedule THEN
      v_changed_fields := array_append(v_changed_fields, 'schedule');
    END IF;
    IF OLD.compensation IS DISTINCT FROM NEW.compensation THEN
      v_changed_fields := array_append(v_changed_fields, 'compensation');
    END IF;
    IF OLD.role_catalog IS DISTINCT FROM NEW.role_catalog THEN
      v_changed_fields := array_append(v_changed_fields, 'roleCatalog');
    END IF;
    IF OLD.posting_type IS DISTINCT FROM NEW.posting_type THEN
      v_changed_fields := array_append(v_changed_fields, 'postingType');
    END IF;
    -- status 는 의도적으로 제외 (위 ⚠️ 참조 — capacity_full 자동 전이 알림 폭탄 방지)

    IF array_length(v_changed_fields, 1) IS NULL THEN
      RETURN NEW;
    END IF;

    -- ---- 한글 라벨 적립 (중요도순) ----
    -- 지원자 입장에서 "출근 여부를 다시 판단해야 하는가"가 중요도의 기준이다.
    -- 급여·근무일이 최상단, 단순 표기 변경인 제목이 최하단.
    -- 중복 가드: 날짜 축 3개(work_date/work_dates/schedule)는 OR 로 합쳐 '근무일' 1개만 적립한다.
    -- (DISTINCT 를 쓰면 가나다순으로 재정렬돼 중요도 순서가 무너진다)
    v_date_changed :=
      (OLD.work_date IS DISTINCT FROM NEW.work_date)
      OR (OLD.work_dates IS DISTINCT FROM NEW.work_dates)
      OR (OLD.schedule IS DISTINCT FROM NEW.schedule);

    IF OLD.compensation IS DISTINCT FROM NEW.compensation THEN
      v_changed_labels := array_append(v_changed_labels, '급여');
    END IF;
    IF v_date_changed THEN
      v_changed_labels := array_append(v_changed_labels, '근무일');
    END IF;
    IF OLD.location IS DISTINCT FROM NEW.location THEN
      v_changed_labels := array_append(v_changed_labels, '근무 장소');
    END IF;
    IF OLD.role_catalog IS DISTINCT FROM NEW.role_catalog THEN
      v_changed_labels := array_append(v_changed_labels, '모집 역할');
    END IF;
    IF OLD.posting_type IS DISTINCT FROM NEW.posting_type THEN
      v_changed_labels := array_append(v_changed_labels, '공고 유형');
    END IF;
    IF OLD.title IS DISTINCT FROM NEW.title THEN
      v_changed_labels := array_append(v_changed_labels, '제목');
    END IF;

    -- ---- 조사(이/가) 결정 ----
    -- 마지막 라벨의 받침 유무로 고른다. '급여가 / 근무일이' 처럼 자연스러워야
    -- 알림이 기계가 쓴 문장으로 읽히지 않는다.
    -- 한글 음절 영역(U+AC00~U+D7A3)에서 (코드 - 0xAC00) % 28 = 0 이면 종성 없음.
    v_last_label := v_changed_labels[array_length(v_changed_labels, 1)];
    v_last_char_code := ascii(right(v_last_label, 1));
    IF v_last_char_code BETWEEN 44032 AND 55203
       AND (v_last_char_code - 44032) % 28 = 0 THEN
      v_josa := '가';
    ELSE
      v_josa := '이';
    END IF;

    v_notif_type := 'job_updated';
    v_notif_title := '📝 공고 수정 안내';
    -- 라벨을 문장 맨 앞에 둔다 — 목록에서 body 가 2줄로 잘려도 무엇이 바뀌었는지는 남는다.
    v_notif_body := format(
      '%s%s 변경되었습니다. ''%s'' 공고를 확인해 주세요.',
      array_to_string(v_changed_labels, '·'),
      v_josa,
      COALESCE(NEW.title, '공고')
    );
    v_notif_link := format('/jobs/%s', NEW.id);
    v_notif_priority := 'normal';
    v_notif_data := jsonb_build_object(
      'jobPostingId', NEW.id,
      'jobPostingTitle', COALESCE(NEW.title, ''),
      'changedFields', array_to_string(v_changed_fields, ', '),
      'changedLabels', array_to_string(v_changed_labels, '·'),
      'senderId', NEW.owner_id
    );

    -- [R0] 근무일·시간 축이 바뀐 경우에만 계약 보유자를 분리한다.
    --      공고는 광고이고 확정된 근무 시간의 정본은 work_logs 다 — 공고 링크로 보내면
    --      "내 시간이 바뀌었나?"를 확인할 수 없는 곳으로 보내는 셈이다.
    IF v_date_changed THEN
      v_contract_body := v_notif_body
        || ' 이미 확정된 내 근무 시간은 바뀌지 않습니다 — 근무표에서 확인해 주세요.';
      v_contract_link := '/schedule';
    END IF;
  END IF;

  -- 수신자 = 활성 지원자 ∪ 직접 배치 스태프. recipient_id 기준으로 1건만 발송한다.
  WITH recipients AS (
    SELECT a.applicant_id AS recipient_id,
           bool_or(a.status = 'confirmed') AS is_contracted
    FROM public.applications a
    WHERE a.job_posting_id = NEW.id
      AND a.status IN ('confirmed', 'applied', 'cancellation_pending')
    GROUP BY a.applicant_id

    UNION ALL

    -- [R0] 지원서 없이 근무표에 직접 배치된 스태프(application_id IS NULL).
    --      취소·무단결근 행은 제외 — 이미 계약이 끝난 사람이다.
    SELECT wl.staff_id, true
    FROM public.work_logs wl
    WHERE wl.job_posting_id = NEW.id
      AND wl.application_id IS NULL
      AND wl.status NOT IN ('cancelled', 'no_show')
  ),
  merged AS (
    SELECT recipient_id, bool_or(is_contracted) AS is_contracted
    FROM recipients
    WHERE recipient_id IS NOT NULL
    GROUP BY recipient_id
  )
  INSERT INTO public.notifications (
    recipient_id, type, title, body, link, data, priority
  )
  SELECT
    m.recipient_id,
    v_notif_type,
    v_notif_title,
    CASE WHEN m.is_contracted AND v_contract_body IS NOT NULL
         THEN v_contract_body ELSE v_notif_body END,
    CASE WHEN m.is_contracted AND v_contract_link IS NOT NULL
         THEN v_contract_link ELSE v_notif_link END,
    v_notif_data,
    v_notif_priority
  FROM merged m;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[notify_on_job_posting_update] failed for posting % — %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.notify_on_job_posting_update() IS
  'job_postings UPDATE 시 지원자에게 수정/마감/취소 알림. 수정 알림 본문은 변경된 항목의 한글 라벨을 '
  '중요도순(급여·근무일·근무 장소·모집 역할·공고 유형·제목)으로 문장 맨 앞에 싣는다. '
  'status 는 변경필드에서 의도적으로 제외(capacity_full 자동 전이 알림 폭탄 방지). '
  '[R0] 수신자에 직접 배치 스태프(application_id NULL) 포함 + 근무일 변경 시 계약 보유자는 /schedule 로 분리.';

-- CREATE OR REPLACE 는 기존 ACL 을 보존하지만, 20260730174805 의 회수 상태를
-- 명시적으로 재확인한다(트리거 함수는 소유자 권한으로 실행되므로 동작에 영향 없음).
REVOKE ALL ON FUNCTION public.notify_on_job_posting_update() FROM PUBLIC, anon, authenticated;
