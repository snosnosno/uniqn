-- ============================================================
-- 정원 0 fail-closed — `v_capacity = 0` 을 "정원 미상=통과" → "자리 없음=거부"로
-- ============================================================
--
-- 선행: R0(20260803120000) confirm_application · 3-C(20260804120000) 정원 이동
-- 원장: docs/planning/2026-07-31-execution-session-prompts.md §5 (S7 잔여 과제)
--
-- ── 배경: 원인이 하나가 아니었다 ─────────────────────────────
--
-- `confirm_application` 의 정원 가드는 `IF v_capacity > 0 AND ...` 라 0 을 통째로 건너뛰었다.
-- 그런데 0 이 되는 원인은 셋이고, 각각 뜻이 다르다:
--
--   A. 역할 객체가 레거시 `headcount` 만 가짐
--      → `v_capacity` 는 `count` 만 읽었다 → 0.
--      🔴 **순수 버그다.** `_total_positions_from_schedule`(20260718000000:24)은
--         `COALESCE(count, headcount, 0)` 으로 센다 — 같은 원문을 두 함수가 다르게 읽었다.
--         정원 총합은 5 인데 가드는 "정원 미상"으로 보고 무제한 확정을 허용했다.
--   B. 원문에 그 (날짜, 슬롯키, 역할키) 자체가 없음 → 0행 → 진짜 **"정원 미상"**.
--   C. 원문에 `count: 0` 이 명시됨 → 진짜 **"자리 없음"**.
--
-- ── 이 마이그가 하는 일 ─────────────────────────────────────
--
--   ① `v_capacity` 를 `COALESCE(count, headcount)` 로 읽는다 — A 를 닫는다(읽기 정합).
--   ② `v_capacity` 를 **NULL 허용**으로 바꿔 B 와 C 를 구분한다.
--      · `NULL` = 축 미매칭 또는 정원 키 해석 불가 → **"정원 미상"** → 통과(관측 로그만)
--      · 숫자(0 포함)     = 해석된 정원              → **거부 판정**
--      🔑 이 NULL 규약은 3-C 의 `_posting_schedule_role_count`(20260804120000:182)와
--         **정확히 같은 의미**다. 정원을 읽는 두 함수가 이제 같은 말을 한다.
--   ③ `_posting_schedule_move_capacity` 가 출발지 정원이 0 이 되어도 **역할 항목을 남긴다**.
--
-- ── ③ 이 왜 필수인가 (설계 §10-7 미확정 1번의 결론을 뒤집는다) ──
--
-- 3-C 설계는 "출발지 정원이 0 이 되면 항목을 지운다"로 닫았고, 근거는
-- **"남겨도 `v_capacity > 0` 가드는 똑같이 스킵되므로 보안 차이가 없다"** 였다.
-- ②가 그 근거를 무효로 만든다:
--
--   지우면 → 축 미매칭(B) → `v_capacity IS NULL` → **통과**   ← 3-C 가 구멍을 다시 연다
--   남기면 → `count: 0`(C) → `v_capacity = 0`   → **거부**   ← 닫힌다
--
-- 그래서 ②와 ③은 한 마이그에서 같이 가야 한다. 하나만 하면 3-C 경로가 열린 채 남는다.
--
-- ── B 를 닫지 않는 이유 (사용자 결정, 2026-08-04) ────────────
--
-- 축 미매칭까지 거부하면 마지막 fail-open 이 닫히지만, 공고 수정으로 슬롯이 사라진 뒤
-- 남은 지원자를 확정하려는 정상 경로와 레거시 키 드리프트가 전부 막힌다.
-- **의미가 명확한 것(A·C)만 닫고 미상(B)은 관측 로그로 남긴다.**
--
-- ── prod 실측 (2026-08-04, 이 결정의 근거) ───────────────────
--
--   · 공고 원문 역할 항목 109건 **전부 `count > 0`** — headcount 전용 0 · `count:0` 0
--   · `v_capacity = 0` 이 실제 발생한 work_logs 2건은 **전부 container + 직접 배치**라
--     `confirm_application` 을 아예 거치지 않는다
--   · fixed 공고 0건 · work_logs 3건 · confirmed 지원서 1건
--   → **영향받을 기존 데이터가 0건이다.** 지금이 전환 위험이 가장 낮은 시점이고,
--     R0 이 심은 관측 로그를 더 기다려도 트래픽이 없어 0건이 쌓인다.
--
-- ⚠️ **`update_posting_slot_time` 의 반환값이 하나 달라진다.** 출발지 항목이 더는
--    사라지지 않으므로 `capacityMoved.from.count` 가 null 이 되지 않고 항상 숫자다
--    (20260804120000:560 의 주석은 이 마이그 이후 낡은 서술이다).
--
-- 본문은 각각 가장 최근 정의를 그대로 옮기고 위 세 곳만 고쳤다:
--   `confirm_application`               ← 20260803120000:138-260
--   `_posting_schedule_move_capacity`   ← 20260804120000:209-341
-- 시그니처가 같으므로 **파리티 함수 수는 불변(199)**.
--
-- 🔴 prod 적용 완료 — 재적용 금지. 기록명이 파일명과 다르고 **두 건**이다:
--      20260804142737 capacity_zero_fail_closed
--      20260804142944 capacity_zero_fail_closed_verbatim_fix
--    두 번째는 첫 적용 때 함수 본문의 **주석 4줄이 축약돼** 레포와 prod 의 `prosrc` 가
--    갈린 것을 되돌린 것이다(동작은 동일했다). md5 대조가 그걸 잡았다:
--      `md5(replace(pg_get_functiondef(oid), chr(13), ''))` 를 로컬↔prod 로 비교
--      (chr(13) 제거는 로컬 파일 CRLF 때문에 필수 — 안 하면 전부 가짜 불일치로 보인다).
--    🔑 **동작이 같아도 정본이 갈리면 다음 재정의의 베이스가 흔들린다.** 마이그를
--       손으로 옮길 때 주석을 줄이지 말 것.
-- ============================================================

-- ------------------------------------------------------------
-- 1) confirm_application — 정원 읽기 정합(headcount) + NULL 규약
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
      -- 🔴 슬롯 키는 **저장될 값** 기준으로 계산한다. 원문으로 계산하면 비패딩 시각('9:00')이
      --    공고 측 '09:00' 과 다른 키가 되어 정원 조회가 0행 → v_capacity=0 → 가드가 통째로
      --    건너뛴다. R0 이전에는 그 직후 INSERT 가 CHECK 위반(23514)으로 죽어 **우연히** 막혔지만,
      --    R0 가 저장을 정규화해 성공시키므로 여기서 키를 맞추지 않으면 fail-closed 가
      --    fail-open 으로 뒤집힌다.
      --    🔑 `wl.time_slot`(이미 저장된 값) 쪽은 감싸지 않는다 — CHECK 이 허용하는 저장값
      --       전체(NULL·센티널·0패딩 'HH:MM'·범위형)에 대해 `_posting_slot_key` 단독 결과와
      --       `_normalize_time_slot` 경유 결과가 동일하고, COUNT 스캔 비용만 늘기 때문이다.
      SELECT (a->>'date') AS a_date,
        public._posting_slot_key(public._normalize_time_slot(a->>'timeSlot')) AS slot_key,
        public._posting_role_key(a->>'role', a->>'customRole') AS role_key, COUNT(*)::int AS requested
      FROM jsonb_array_elements(p_assignments) a GROUP BY 1, 2, 3
    LOOP
      SELECT COUNT(*) INTO v_existing FROM work_logs wl
      WHERE wl.job_posting_id = v_app.job_posting_id AND wl.date = v_rec.a_date
        AND public._posting_slot_key(wl.time_slot) = v_rec.slot_key
        AND public._posting_role_key(wl.role::text, wl.custom_role) = v_rec.role_key
        AND wl.status NOT IN ('cancelled', 'no_show');

      -- 🔴 정원 키는 두 가지다 — `count`(정본)와 `headcount`(레거시).
      --    `_total_positions_from_schedule`(20260718000000:24)이 `COALESCE(count, headcount, 0)`
      --    으로 총합을 세므로 가드도 **같은 순서로** 읽어야 한다. `count` 만 읽으면
      --    headcount-only 역할이 0 으로 보여 가드가 통째로 스킵된다(무제한 초과 확정).
      -- 🔑 **COALESCE 로 0 을 덮지 않는다.** MAX 는 일치 행이 없으면 NULL 을 낸다 —
      --    그 NULL 이 "정원 미상"이고, 0 은 "자리 없음"이다. 둘을 접으면 구분이 사라진다.
      --    같은 NULL 규약을 3-C 의 `_posting_schedule_role_count`(20260804120000:182)도 쓴다.
      SELECT MAX(COALESCE((r->>'count')::int, (r->>'headcount')::int)) INTO v_capacity
      FROM jsonb_array_elements(COALESCE(v_job.schedule->'requirements', '[]'::jsonb)) req
      CROSS JOIN jsonb_array_elements(COALESCE(req->'timeSlots', '[]'::jsonb)) ts
      CROSS JOIN jsonb_array_elements(COALESCE(ts->'roles', '[]'::jsonb)) r
      WHERE COALESCE(req->>'date', 'FIXED_SCHEDULE') = v_rec.a_date
        AND (CASE
              WHEN COALESCE((ts->>'isTimeToBeAnnounced')::boolean, false) THEN '미정'
              WHEN COALESCE(ts->>'startTime', ts->>'time') IS NOT NULL
                THEN public._posting_slot_key(
                       public._normalize_time_slot(COALESCE(ts->>'startTime', ts->>'time')))
              -- [R0] 고정공고 협의 슬롯도 '미정' 키로 접는다(구 'NEGOTIABLE' 폐지).
              WHEN v_is_fixed THEN '미정'
              ELSE public._posting_slot_key(
                     public._normalize_time_slot(COALESCE(ts->>'startTime', ts->>'time')))
            END) = v_rec.slot_key
        AND public._posting_role_key(r->>'role', r->>'customRole') = v_rec.role_key;

      -- [관측] 정원 미상 = 가드 우회. R0 이 심은 `capacity=0 match` 로그의 후신이다 —
      --        이제 0 은 우회가 아니라 거부이므로, 우회는 NULL 하나뿐이다.
      --        (문구를 바꿨지만 prod 에 쌓인 옛 로그는 0건이라 검색 단절 비용이 없다.)
      IF v_capacity IS NULL THEN
        RAISE LOG 'capacity unknown (guard skipped): posting=% date=% slot=% role=%',
          v_app.job_posting_id, v_rec.a_date, v_rec.slot_key, v_rec.role_key;
      END IF;

      -- 🔴 `v_capacity IS NOT NULL` 이면 0 이어도 판정한다 — **자리 없음은 거부다.**
      --    `> 0` 조건을 되살리면 `count: 0` 슬롯과 3-C 가 비운 슬롯이 다시 무제한으로 열린다.
      IF v_capacity IS NOT NULL AND v_existing + v_rec.requested > v_capacity THEN
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
  '[R0] 미정 키는 ''미정'' 하나로 통일(고정공고 포함) + work_logs.time_slot 은 _normalize_time_slot 경유 저장. '
  '[정원0] 정원은 COALESCE(count, headcount) 로 읽고 NULL(축 미매칭=정원 미상)만 가드를 건너뛴다 — 0 은 자리 없음이라 거부한다.';

-- CREATE OR REPLACE 는 ACL 을 보존하지만 회수 상태를 명시적으로 재확인한다(멱등).
REVOKE ALL ON FUNCTION public.confirm_application(uuid, uuid, jsonb, jsonb, jsonb, text, boolean, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_application(uuid, uuid, jsonb, jsonb, jsonb, text, boolean, jsonb) TO authenticated;


-- ------------------------------------------------------------
-- 2) _posting_schedule_move_capacity — 출발지 0 이어도 항목 유지
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._posting_schedule_move_capacity(
  p_schedule  jsonb,
  p_date      text,
  p_role_key  text,
  p_from_slot text,
  p_to_slot   text,
  p_to_time   text,   -- 목적지 슬롯을 신설할 때 쓸 'HH:MM'. NULL = 미정 슬롯
  p_n         int
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_reqs      jsonb := '[]'::jsonb;
  v_req       jsonb;
  v_slots     jsonb;
  v_slot      jsonb;
  v_roles     jsonb;
  v_role      jsonb;
  v_key       text;
  v_found_to  boolean;
  v_found_rl  boolean;
  v_cnt       int;
  v_new_role  jsonb;
  -- 🔴 **실제로 옮길 수 있는 정원.** 출발지에 있는 것보다 더 뺄 수는 없다.
  --    `GREATEST(count - p_n, 0)` 로 깎으면서 목적지에는 p_n 전액을 더하면 **총합이 는다.**
  --    실측: 정원 2 슬롯에 5명이 배치된 상태에서 5명 이동 → 총합 3 → 6.
  --    총합이 늘면 `total_positions` 가 늘고 `fn_recalc_total_and_capacity` 가
  --    capacity_full 공고를 active 로 되돌린다 — 마감된 공고가 다시 열린다.
  --    배치 인원 > 원문 정원인 슬롯은 실재한다(`v_capacity=0` 가드 스킵·레거시 데이터).
  v_move      int;
BEGIN
  -- 🔑 옮길 양을 **출발지가 실제로 가진 만큼으로 먼저 clamp** 한다. 그러면 뺀 만큼만 더하게 되어
  --    총합이 어떤 입력에서도 보존된다(초과 배정 상태는 목적지로 그대로 따라갈 뿐, 새로 만들지 않는다).
  v_move := LEAST(p_n, COALESCE(
              public._posting_schedule_role_count(p_schedule, p_date, p_from_slot, p_role_key), 0));
  IF v_move <= 0 THEN
    RETURN p_schedule;   -- 옮길 정원이 없다 — 원문을 건드리지 않는다.
  END IF;

  -- 신설용 역할 객체. 🔴 strip_nulls 없이 쓰면 customRole:null 이 남아 zod 가 공고를 거부한다.
  v_new_role := jsonb_strip_nulls(jsonb_build_object(
                  'role',       split_part(p_role_key, ':', 1),
                  'customRole', CASE WHEN p_role_key LIKE 'other:%'
                                     THEN NULLIF(substring(p_role_key FROM 7), '') END,
                  'count',      v_move));

  FOR v_req IN SELECT e FROM jsonb_array_elements(
                 COALESCE(p_schedule->'requirements', '[]'::jsonb)) AS t(e)
  LOOP
    IF COALESCE(v_req->>'date', 'FIXED_SCHEDULE') IS DISTINCT FROM p_date THEN
      v_reqs := v_reqs || jsonb_build_array(v_req);
      CONTINUE;
    END IF;

    v_slots    := '[]'::jsonb;
    v_found_to := false;

    FOR v_slot IN SELECT e FROM jsonb_array_elements(
                    COALESCE(v_req->'timeSlots', '[]'::jsonb)) AS t(e)
    LOOP
      v_key := public._posting_schedule_slot_key(v_slot);

      IF v_key = p_from_slot THEN
        -- 출발지: 그 역할만 -N.
        -- 🔴 **0 이 되어도 항목을 남긴다.** 예전엔 "유령 슬롯을 남기지 않는다"며 지웠고,
        --    그 근거는 "남겨도 `v_capacity > 0` 가드는 똑같이 스킵되므로 보안 차이가 없다"였다.
        --    이 마이그가 그 가드를 `IS NOT NULL` 로 바꾸면서 근거가 뒤집혔다:
        --      지우면 → 축 미매칭 → `v_capacity IS NULL`(정원 미상) → **확정 통과**
        --      남기면 → `count: 0`  → `v_capacity = 0`(자리 없음) → **확정 거부**
        --    즉 지우는 순간 3-C 가 방금 비운 슬롯이 무제한으로 다시 열린다.
        -- 🔑 총합은 그대로다 — `_total_positions_from_schedule` 은 0 을 0 으로 더한다.
        v_roles := '[]'::jsonb;
        FOR v_role IN SELECT e FROM jsonb_array_elements(
                        COALESCE(v_slot->'roles', '[]'::jsonb)) AS t(e)
        LOOP
          IF public._posting_role_key(v_role->>'role', v_role->>'customRole') = p_role_key THEN
            v_cnt := GREATEST(public._posting_role_capacity(v_role) - v_move, 0);
            -- 🔑 되돌려 쓰는 키는 원래 키를 유지한다(레거시 headcount 역할은 headcount 로).
            v_roles := v_roles || jsonb_build_array(
              v_role || jsonb_build_object(public._posting_role_count_key(v_role), v_cnt));
          ELSE
            v_roles := v_roles || jsonb_build_array(v_role);
          END IF;
        END LOOP;
        -- 역할이 하나도 안 남으면 슬롯 자체를 뺀다.
        -- ⚠️ 이제 대상 역할은 항상 남으므로 이 분기는 **원문 `roles` 가 애초에 빈 배열인
        --    레거시 슬롯**에서만 걸린다. 그런 슬롯은 정원 정보가 없으니 만들지 않는다.
        IF jsonb_array_length(v_roles) > 0 THEN
          v_slots := v_slots || jsonb_build_array(v_slot || jsonb_build_object('roles', v_roles));
        END IF;

      ELSIF v_key = p_to_slot THEN
        -- 목적지: 그 역할에 +N. 역할이 없으면 그 슬롯 안에 새로 만든다.
        v_found_to := true;
        v_roles    := '[]'::jsonb;
        v_found_rl := false;
        FOR v_role IN SELECT e FROM jsonb_array_elements(
                        COALESCE(v_slot->'roles', '[]'::jsonb)) AS t(e)
        LOOP
          IF public._posting_role_key(v_role->>'role', v_role->>'customRole') = p_role_key THEN
            v_found_rl := true;
            -- 🔴 목적지도 **원래 쓰던 키**에 되돌려 쓴다. 여기서 `count` 를 새로 만들면
            --    `headcount` 만 있던 역할이 COALESCE 우선순위상 `count` 로 읽혀 총합이 깨진다.
            v_roles := v_roles || jsonb_build_array(v_role || jsonb_build_object(
                         public._posting_role_count_key(v_role),
                         public._posting_role_capacity(v_role) + v_move));
          ELSE
            v_roles := v_roles || jsonb_build_array(v_role);
          END IF;
        END LOOP;
        IF NOT v_found_rl THEN
          v_roles := v_roles || jsonb_build_array(v_new_role);
        END IF;
        v_slots := v_slots || jsonb_build_array(v_slot || jsonb_build_object('roles', v_roles));

      ELSE
        v_slots := v_slots || jsonb_build_array(v_slot);
      END IF;
    END LOOP;

    -- 목적지 슬롯이 아예 없었으면 신설한다. 🔴 strict 스키마가 허용하는 키만 쓴다.
    IF NOT v_found_to THEN
      v_slots := v_slots || jsonb_build_array(
        CASE WHEN p_to_time IS NULL
          THEN jsonb_build_object('isTimeToBeAnnounced', true, 'roles', jsonb_build_array(v_new_role))
          ELSE jsonb_build_object('startTime', p_to_time,      'roles', jsonb_build_array(v_new_role))
        END);
    END IF;

    v_reqs := v_reqs || jsonb_build_array(v_req || jsonb_build_object('timeSlots', v_slots));
  END LOOP;

  RETURN p_schedule || jsonb_build_object('requirements', v_reqs);
END;
$$;

COMMENT ON FUNCTION public._posting_schedule_move_capacity(jsonb, text, text, text, text, text, int) IS
  '공고 원문 정원 이동: 출발 슬롯 역할 -N(0 이 되어도 항목을 남긴다 — 지우면 축 미매칭이 되어 '
  'confirm_application 의 "정원 미상 → 통과" 경로로 빠진다), 목적 슬롯 역할 +N(없으면 슬롯/역할 신설). '
  '총합 보존 → total_positions 불변.';

-- 정원 이동 헬퍼는 3-C 마이그(20260804120000)에서 이미 회수·부여됐다. CREATE OR REPLACE 가
-- ACL 을 보존하지만 명시적으로 재확인한다.
REVOKE ALL ON FUNCTION public._posting_schedule_move_capacity(jsonb, text, text, text, text, text, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._posting_schedule_move_capacity(jsonb, text, text, text, text, text, int) TO authenticated, service_role;

