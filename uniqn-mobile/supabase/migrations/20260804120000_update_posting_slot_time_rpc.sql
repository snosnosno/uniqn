-- ============================================================
-- 공고 시간 변경 (3-C) — 한 슬롯에서 고른 인원의 출근 시각을 한 트랜잭션으로 옮긴다
--
-- 설계: docs/planning/2026-08-03-3c-posting-time-change-design.md (S7 개정 §10 이 정본)
-- 선행: #407 update_work_log_slot · #382 시각 알림 Case 2-B · R0(#409)/R1(#410) 센티널 통일
--
-- ── 이 함수가 하는 일은 셋뿐이다 ─────────────────────────────
--   1) 넘어온 work_log 들이 정말 그 슬롯(공고·날짜·역할키·출발 시각키)에 속하는지 검증
--   2) 각 행에 대해 **기존 `update_work_log_slot` 을 그대로 호출**
--   3) 공고 원문의 정원(count)을 옮긴 인원수만큼 출발지 → 목적지로 이동
--
-- 🔑 **2)가 이 설계의 핵심이다.** assignments 셀 분해·자가 치유·모호하면 손대지 않기·
--    0패딩 정규화·패치 계약(미지 키 거부)·RLS wl_update 재현·시각 변경 알림(Case 2-B)은
--    전부 #407 이 이미 풀어 놓았다. 복사하면 두 벌이 되어 갈라진다 —
--    **호출하면 한 벌로 남는다.** 3-C 가 "신규 기능이 아니라 묶음 적용"이라는 설계 판정(§0)을
--    코드 구조로 그대로 옮긴 것이다.
--    🔑 SECDEF 안에서 SECDEF 를 불러도 `auth.uid()` 는 여전히 **원 호출자**를 가리킨다
--       (JWT GUC 를 읽는다) — 행별 권한 검사는 약해지지 않는다.
--
-- ── 대상 축 (설계 §4-1 + §10-1) ─────────────────────────────
--   후보 = work_logs 중
--     job_posting_id = :posting AND date = :date
--     AND _posting_role_key(role, custom_role)  = :roleKey
--     AND _posting_slot_key(time_slot)          = :fromSlotKey
--     AND status NOT IN ('cancelled', 'no_show')      -- 🔴 소프트 취소 필터
--
--   실제 대상 = 그중 구인자가 고른 `p_work_log_ids`(사용자 결정 ④).
--   🔴 **하나라도 축을 벗어나면 전체를 거부한다.** 부분 적용은 한 슬롯을 둘로 갈라놓고
--      일부에게만 알림을 보낸다 — 조용히 반쯤 성공하는 것이 통째로 실패하는 것보다 나쁘다.
--   🔴 소프트 취소 필터를 빠뜨리면 취소된 인원의 시간까지 바뀌고 그들에게 알림이 간다(무증상).
--
-- ⚠️ 개별 조정된 인원은 이 축에서 **이미 자기 시각 그룹으로 옮겨가 있다.**
--    20:00 으로 개별 조정된 사람은 '18:00' 후보에 없고 '20:00' 후보에 있다. 축이
--    `work_logs.time_slot` 이기 때문이고, 다른 축은 만들 수 없다 — work_logs 는
--    "원래 어느 슬롯으로 뽑혔는지"를 기억하는 컬럼이 없다.
--
-- ── 권한: 두 정책의 **교집합** (확대 0) ──────────────────────
--   이 함수는 `work_logs` 와 `job_postings` 를 **둘 다** 쓴다. 그래서 둘 다 통과해야 한다.
--     work_logs.wl_update                     : owner_id = uid OR (workspace member OR collaborator)
--     job_postings.jp_update_workspace_member : workspace member OR collaborator OR is_admin()
--   교집합 = **workspace member OR posting collaborator**.
--   🔴 `work_logs.owner_id = uid` 만 가진 사람은 거부한다 — 공고 원문을 고칠 권한이 없다.
--   🔴 `is_admin()` 만 가진 사람도 거부한다 — wl_update 에 admin 분기가 없다.
--      한쪽 정책만 보고 열면 다른 쪽 테이블에 대해 **권한 확대**가 된다.
--   행별 wl_update 재검증은 `update_work_log_slot` 이 한 번 더 한다(이중 방어).
--
-- ── 잠금 ────────────────────────────────────────────────────
-- 🔴 **`ORDER BY id` 로 돈다.** 단건 RPC 에는 없던 위험이다 — 두 구인자가 겹치는 슬롯을
--    동시에 편집할 때 순서가 없으면 서로의 행을 엇갈려 잠가 데드락이 난다.
--    `job_postings` 는 **맨 마지막에** 잠근다(applications → work_logs → job_postings).
--    좌석 트리거가 work_logs 를 먼저 잡고 job_postings 를 갱신하는 기존 방향과 같다.
--
-- ── 공고 원문 정원 이동 (사용자 결정 ⑤ · §10-3) ──────────────
-- 🔴 **이걸 빼면 출발지 슬롯 정원이 통째로 재개방된다.** `confirm_application` 은
--    `v_existing` 을 work_logs 에서, `v_capacity` 를 공고 원문에서 읽는다
--    (20260803120000:186-195). 7명을 옮기고 원문을 두면 0 + 7 ≤ 7 이 통과해
--    같은 자리에 7명을 또 확정할 수 있다. 에러는 나지 않는다 — R0 이 막으려던 우회와 같다.
--
-- 🔑 정원을 **옮기기만** 하므로 `_total_positions_from_schedule` 의 총합이 보존된다
--    → `total_positions` 불변 → `capacity_full ↔ active` 자동 전이 없음
--    → 그에 딸린 마감 알림 연쇄도 없음 (20260718000000:22-29, 46-58).
--
-- 🔴 **zod 계약을 깨지 않는다** (`src/schemas/jobPosting.schema.ts`):
--    · `postingTimeSlotSchema` 는 `.strict()` — 새 슬롯에 규정 밖 키를 넣으면 공고 레코드가
--      통째로 파싱 실패한다(A2 사고 유형). 그래서 `jsonb_strip_nulls` 로 `customRole: null`
--      같은 JSON null 을 반드시 제거한다(`z.string().optional()` 은 null 을 거부한다).
--    · `count` 는 **required number** 다 — 문자열로 쓰면 안 된다.
--    · 기존 슬롯/역할 객체는 `||` 로 **덮어쓰기만** 한다(id·tentativeDescription 보존).
--
-- ⚠️ **정원 이동을 건너뛰는 경우가 있다**(그리고 반환값이 그 사실을 말한다):
--    · 컨테이너 공고 — 모집 요건이 없다. RESTRICTIVE 정책 `jp_container_no_direct_update` 도
--      container 행 UPDATE 를 막는다(baseline:13606). 지원·확정 경로가 없어 정원 개념이 없다.
--    · 🔴 **고정공고(`schedule.kind = 'fixed'`)** — 스키마가 **요건 1개·슬롯 1개**만 허용한다
--      (`jobPosting.schema.ts` superRefine). 슬롯을 더하면 공고가 검증 실패로 사라진다.
--      고정공고의 공고 측 슬롯 키는 '미정' 이라 실제 시각을 가진 work_log 와 이미 갈려 있고
--      `v_capacity=0` 으로 가드가 이미 스킵된다 — 3-C 가 악화시키지 않는다.
--    · 요건에서 그 (날짜, 출발 슬롯, 역할) 을 못 찾는 경우.
--
-- 🔴 **알려진 잔여 구멍(3-C 가 만들지 않았지만 더 쉽게 닿게 한다).**
--    출발지 정원이 0 이 되면 그 역할 항목을 지운다. 그러면 `confirm_application` 의
--    `v_capacity` 가 0 이 되는데, 가드는 `IF v_capacity > 0 AND ...` 라 **통째로 건너뛴다**
--    (20260803120000:215). 즉 그 슬롯을 겨냥해 **직접 만든** 지원서는 정원 검사 없이 확정된다.
--    UI 는 공고 원문에서 슬롯 목록을 만들므로 사라진 슬롯을 제시하지 않는다(정상 경로 노출 0).
--    `v_capacity=0` 을 "정원 미상=통과"가 아니라 "자리 없음=거부"로 바꾸는 것은 레거시 공고
--    전체에 영향이 가는 별건이다 — 3-C 범위 밖으로 두고 여기 남긴다.
--
-- ── 알림 (사용자 결정 ⑥ · §10-4) ────────────────────────────
-- 🔑 **알림 코드는 한 줄도 없다.** `update_work_log_slot` 의 UPDATE 가 Case 2-B 를 깨우고
--    (`notify_on_work_log_update`, #382), 취소 힌트도 같은 트리거가 붙인다.
--    공고 원문 UPDATE 는 `notify_on_job_posting_update` 를 깨워 지원자 전원에게
--    '근무일 변경'을 보낸다 — **의도적으로 억제하지 않는다.** 미확정 지원자는 자기가 노리던
--    자리가 줄어든 것을 알아야 하고, 트리거 재정의는 검증된 알림 경로에 회귀 위험을 새로 만든다.
-- ============================================================

-- ------------------------------------------------------------
-- 0) 공고 원문 슬롯 헬퍼 3종
--    🔑 슬롯 키 규칙은 `confirm_application` 의 정원 CASE 와 **글자 그대로 같은 결과**를 낸다.
--       그쪽은 고정공고 분기(`WHEN v_is_fixed THEN '미정'`)를 따로 두지만, startTime·time 이
--       둘 다 없으면 ELSE 분기도 `_posting_slot_key(_normalize_time_slot(NULL))` = '미정' 이라
--       모든 입력에서 결과가 일치한다. 두 곳이 갈리면 정원 조회가 0행을 내고 조용히 어긋난다.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._posting_schedule_slot_key(p_slot jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT CASE
    WHEN COALESCE((p_slot->>'isTimeToBeAnnounced')::boolean, false) THEN '미정'
    ELSE public._posting_slot_key(
           public._normalize_time_slot(COALESCE(p_slot->>'startTime', p_slot->>'time')))
  END;
$$;

COMMENT ON FUNCTION public._posting_schedule_slot_key(jsonb) IS
  '공고 원문 timeSlot 객체 → 슬롯 키. confirm_application 의 정원 CASE 와 동일 결과(모든 입력에서).';

-- 그 (날짜, 슬롯키, 역할키) 의 정원. **없으면 NULL** — 0(정원 0)과 구분해야 한다.
CREATE OR REPLACE FUNCTION public._posting_schedule_role_count(
  p_schedule jsonb, p_date text, p_slot_key text, p_role_key text
)
RETURNS int
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT MAX(COALESCE((r->>'count')::int, 0))::int
  FROM jsonb_array_elements(COALESCE(p_schedule->'requirements', '[]'::jsonb)) req
  CROSS JOIN jsonb_array_elements(COALESCE(req->'timeSlots', '[]'::jsonb)) ts
  CROSS JOIN jsonb_array_elements(COALESCE(ts->'roles', '[]'::jsonb)) r
  WHERE COALESCE(req->>'date', 'FIXED_SCHEDULE') = p_date
    AND public._posting_schedule_slot_key(ts) = p_slot_key
    AND public._posting_role_key(r->>'role', r->>'customRole') = p_role_key;
$$;

COMMENT ON FUNCTION public._posting_schedule_role_count(jsonb, text, text, text) IS
  '공고 원문의 (날짜, 슬롯키, 역할키) 정원. 요건에 없으면 NULL(정원 0 과 구분). confirm_application 의 MAX 집계와 동형.';

-- 정원 이동: 출발지 -N (0 이 되면 항목 제거), 목적지 +N (없으면 슬롯/역할 신설).
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
  -- 신설용 역할 객체. 🔴 strip_nulls 없이 쓰면 customRole:null 이 남아 zod 가 공고를 거부한다.
  v_new_role  jsonb := jsonb_strip_nulls(jsonb_build_object(
                 'role',       split_part(p_role_key, ':', 1),
                 'customRole', CASE WHEN p_role_key LIKE 'other:%'
                                    THEN NULLIF(substring(p_role_key FROM 7), '') END,
                 'count',      p_n));
BEGIN
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
        -- 출발지: 그 역할만 -N. 0 이 되면 항목을 지운다(정원 0 유령 슬롯을 남기지 않는다).
        v_roles := '[]'::jsonb;
        FOR v_role IN SELECT e FROM jsonb_array_elements(
                        COALESCE(v_slot->'roles', '[]'::jsonb)) AS t(e)
        LOOP
          IF public._posting_role_key(v_role->>'role', v_role->>'customRole') = p_role_key THEN
            v_cnt := GREATEST(COALESCE((v_role->>'count')::int, 0) - p_n, 0);
            IF v_cnt > 0 THEN
              v_roles := v_roles || jsonb_build_array(v_role || jsonb_build_object('count', v_cnt));
            END IF;
          ELSE
            v_roles := v_roles || jsonb_build_array(v_role);
          END IF;
        END LOOP;
        -- 역할이 하나도 안 남으면 슬롯 자체를 뺀다.
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
            v_roles := v_roles || jsonb_build_array(v_role || jsonb_build_object(
                         'count', COALESCE((v_role->>'count')::int, 0) + p_n));
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
  '공고 원문 정원 이동: 출발 슬롯 역할 -N(0 이면 제거), 목적 슬롯 역할 +N(없으면 슬롯/역할 신설). 총합 보존 → total_positions 불변.';

REVOKE ALL ON FUNCTION public._posting_schedule_slot_key(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public._posting_schedule_role_count(jsonb, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public._posting_schedule_move_capacity(jsonb, text, text, text, text, text, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._posting_schedule_slot_key(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public._posting_schedule_role_count(jsonb, text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public._posting_schedule_move_capacity(jsonb, text, text, text, text, text, int) TO authenticated, service_role;

-- ------------------------------------------------------------
-- 1) 본체
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_posting_slot_time(
  p_job_posting_id uuid,
  p_date           text,
  p_role_key       text,
  p_from_slot_key  text,
  p_work_log_ids   uuid[],
  p_patch          jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_actor uuid := auth.uid();

  v_jp      record;
  v_unknown text;

  v_set_time boolean := false;
  v_new_time text;            -- 목적지 time_slot 최종값 (NULL = 미정)
  v_raw_time text;
  v_to_slot  text;            -- 목적지 슬롯 키 ('미정' 또는 'HH:MM')

  v_requested int;
  v_matched   int;
  v_moved     int := 0;
  v_synced    int := 0;

  v_id      uuid;
  v_res     jsonb;
  v_skipped jsonb := '[]'::jsonb;

  v_cap_reason text;
  v_schedule   jsonb;
  v_new_sched  jsonb;
  v_from_after int;
  v_to_after   int;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 인증이 필요합니다';
  END IF;

  -- ── 1) 인자 계약 검증 (fail-closed) ─────────────────────────
  IF p_job_posting_id IS NULL OR p_date IS NULL OR p_role_key IS NULL OR p_from_slot_key IS NULL THEN
    RAISE EXCEPTION 'INVALID_INPUT: 슬롯 정보가 올바르지 않습니다';
  END IF;

  IF p_work_log_ids IS NULL OR array_length(p_work_log_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'INVALID_INPUT: 변경할 대상을 선택해주세요';
  END IF;

  -- NULL 원소·중복은 "몇 명을 옮겼는가"를 흐린다. 중복이 있으면 같은 행을 두 번 세어
  -- 정원 이동 수가 실제 이동 수보다 커진다 — 조용히 정원이 새는 경로다.
  IF EXISTS (SELECT 1 FROM unnest(p_work_log_ids) x WHERE x IS NULL) THEN
    RAISE EXCEPTION 'INVALID_INPUT: 변경할 대상이 올바르지 않습니다';
  END IF;
  v_requested := array_length(p_work_log_ids, 1);
  IF (SELECT count(DISTINCT x) FROM unnest(p_work_log_ids) x) <> v_requested THEN
    RAISE EXCEPTION 'INVALID_INPUT: 변경할 대상이 중복되었습니다';
  END IF;

  IF p_patch IS NULL OR jsonb_typeof(p_patch) <> 'object' THEN
    RAISE EXCEPTION 'INVALID_INPUT: 수정 내용이 올바르지 않습니다';
  END IF;

  -- 전체 축은 **시간만** 받는다. 역할·색상·메모는 슬롯 단위로 의미가 없다
  -- (역할을 바꾸면 슬롯 이동이 아니라 다른 슬롯으로의 재배치다).
  SELECT k INTO v_unknown
  FROM jsonb_object_keys(p_patch) k
  WHERE k NOT IN ('startTime', 'timeUndecided')
  LIMIT 1;
  IF v_unknown IS NOT NULL THEN
    RAISE EXCEPTION 'INVALID_INPUT: 알 수 없는 수정 항목입니다: %', v_unknown;
  END IF;

  -- '미정' 이 startTime 보다 우선한다(update_work_log_slot·클라 addSlotPayload 와 동일).
  IF p_patch ? 'timeUndecided' THEN
    IF jsonb_typeof(p_patch->'timeUndecided') <> 'boolean' THEN
      RAISE EXCEPTION 'INVALID_INPUT: 시간 미정 값이 올바르지 않습니다';
    END IF;
    IF (p_patch->>'timeUndecided')::boolean THEN
      v_set_time := true;
      v_new_time := NULL;
    END IF;
  END IF;

  IF NOT v_set_time AND p_patch ? 'startTime' THEN
    IF jsonb_typeof(p_patch->'startTime') <> 'string' THEN
      RAISE EXCEPTION 'INVALID_INPUT: 출근 시간 형식이 올바르지 않습니다';
    END IF;
    v_raw_time := btrim(p_patch->>'startTime');
    IF v_raw_time !~ '^(0?[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$' THEN
      RAISE EXCEPTION 'INVALID_INPUT: 출근 시간 형식이 올바르지 않습니다';
    END IF;
    -- 0패딩을 **여기서도** 한다. update_work_log_slot 이 work_logs 에 같은 정규화를 하지만,
    -- 공고 원문의 목적지 슬롯 키는 이 값으로 만들어진다 — '9:00' 으로 슬롯을 신설하면
    -- work_logs 는 '09:00' 이 되어 두 키가 영영 안 만난다(정원 조회 0행).
    v_new_time := lpad(split_part(v_raw_time, ':', 1)::int::text, 2, '0')
                  || ':' || split_part(v_raw_time, ':', 2);
    v_set_time := true;
  END IF;

  IF NOT v_set_time THEN
    RAISE EXCEPTION 'INVALID_INPUT: 변경할 시간을 지정해주세요';
  END IF;

  v_to_slot := public._posting_slot_key(v_new_time);

  IF v_to_slot = p_from_slot_key THEN
    RAISE EXCEPTION 'INVALID_INPUT: 이미 같은 시간입니다';
  END IF;

  -- ── 2) 권한: wl_update ∩ jp_update (확대 0) ─────────────────
  SELECT jp.id, jp.workspace_id, jp.status
    INTO v_jp
  FROM public.job_postings jp
  WHERE jp.id = p_job_posting_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'JOB_POSTING_NOT_FOUND: %', p_job_posting_id;
  END IF;

  IF NOT (
    COALESCE(public.is_workspace_member(v_jp.workspace_id, v_actor), false)
    OR COALESCE(public.is_posting_collaborator(v_jp.id, v_actor), false)
  ) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 권한이 있는 공고의 근무 시간만 변경할 수 있습니다';
  END IF;

  -- ── 3) 대상 축 검증 — 하나라도 벗어나면 전체 거부 ───────────
  SELECT count(*) INTO v_matched
  FROM public.work_logs wl
  WHERE wl.id = ANY (p_work_log_ids)
    AND wl.job_posting_id = p_job_posting_id
    AND wl.date = p_date
    AND public._posting_role_key(wl.role::text, wl.custom_role) = p_role_key
    AND public._posting_slot_key(wl.time_slot) = p_from_slot_key
    AND wl.status NOT IN ('cancelled', 'no_show');

  IF v_matched <> v_requested THEN
    RAISE EXCEPTION
      'SLOT_MISMATCH: 선택한 인원 중 %명이 이 슬롯에 없습니다 (요청 % / 일치 %)',
      v_requested - v_matched, v_requested, v_matched;
  END IF;

  -- ── 4) 행별 적용 — 🔴 ORDER BY id (데드락 방지) ─────────────
  -- 기존 단건 RPC 를 그대로 호출한다. 잠금(applications → work_logs)·권한 재검사·
  -- assignments 동기화·시각 변경 알림이 전부 그 안에서 일어난다.
  FOR v_id IN
    SELECT wl.id FROM public.work_logs wl
    WHERE wl.id = ANY (p_work_log_ids)
    ORDER BY wl.id
  LOOP
    v_res   := public.update_work_log_slot(v_id, p_patch);
    v_moved := v_moved + 1;

    IF COALESCE((v_res->>'assignmentSynced')::boolean, false) THEN
      v_synced := v_synced + 1;
    ELSIF COALESCE(v_res->>'assignmentSyncReason', '') <> 'no_application' THEN
      -- `no_application` 은 add_direct_staff 로 직접 배치한 행이라 **동기화 상대가 없다** —
      -- 실패가 아니므로 건너뜀 목록에 넣지 않는다(집계에서만 빠진다).
      v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
        'workLogId', v_id,
        'reason',    v_res->>'assignmentSyncReason'));
    END IF;
  END LOOP;

  -- ── 5) 공고 원문 정원 이동 (§10-3) ──────────────────────────
  -- job_postings 는 **맨 마지막에** 잠근다(위 루프가 applications·work_logs 를 이미 잡았다).
  IF v_jp.status = 'container'::posting_status THEN
    v_cap_reason := 'container_posting';
  ELSE
    SELECT jp.schedule INTO v_schedule
    FROM public.job_postings jp WHERE jp.id = p_job_posting_id FOR UPDATE;

    IF COALESCE(v_schedule->>'kind', '') = 'fixed' THEN
      -- 🔴 스키마가 요건 1개·슬롯 1개만 허용한다. 손대면 공고가 검증 실패로 사라진다.
      v_cap_reason := 'fixed_schedule';
    ELSIF public._posting_schedule_role_count(v_schedule, p_date, p_from_slot_key, p_role_key) IS NULL THEN
      v_cap_reason := 'requirement_not_found';
    ELSE
      v_new_sched := public._posting_schedule_move_capacity(
        v_schedule, p_date, p_role_key, p_from_slot_key, v_to_slot, v_new_time, v_moved);

      UPDATE public.job_postings SET schedule = v_new_sched, updated_at = now()
      WHERE id = p_job_posting_id;

      v_from_after := public._posting_schedule_role_count(v_new_sched, p_date, p_from_slot_key, p_role_key);
      v_to_after   := public._posting_schedule_role_count(v_new_sched, p_date, v_to_slot,       p_role_key);
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success',          true,
    'jobPostingId',     p_job_posting_id,
    'date',             p_date,
    'roleKey',          p_role_key,
    'fromSlotKey',      p_from_slot_key,
    'toSlotKey',        v_to_slot,
    'total',            v_requested,
    'updated',          v_moved,
    'assignmentSynced', v_synced,
    'skipped',          v_skipped,
    -- 출발지가 0 이 되어 항목이 사라졌으면 `from.count` 는 null 이다(정원 0 과 "없음"을 구분).
    'capacityMoved',    CASE WHEN v_cap_reason IS NULL
      THEN jsonb_build_object(
             'from', jsonb_build_object('slot', p_from_slot_key, 'count', v_from_after),
             'to',   jsonb_build_object('slot', v_to_slot,       'count', v_to_after))
      END,
    'capacitySkipReason', v_cap_reason
  );
END;
$$;

COMMENT ON FUNCTION public.update_posting_slot_time(uuid, text, text, text, uuid[], jsonb) IS
  '공고 시간 변경(3-C): 한 슬롯에서 고른 인원의 출근 시각을 옮기고 공고 원문 정원도 같은 수만큼 이동한다. '
  '행별 적용은 update_work_log_slot 을 호출해 재사용한다(복제 금지) — 알림·assignments 동기화가 그대로 상속된다. '
  '권한은 wl_update ∩ jp_update(워크스페이스 멤버 또는 협업자) 교집합, 확대 0. 축을 벗어난 대상이 하나라도 있으면 전체 거부.';

REVOKE ALL ON FUNCTION public.update_posting_slot_time(uuid, text, text, text, uuid[], jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_posting_slot_time(uuid, text, text, text, uuid[], jsonb) TO authenticated;
