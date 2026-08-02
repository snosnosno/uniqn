-- ============================================================
-- 근무표 슬롯 편집 RPC 화 — work_logs 와 applications.assignments 를 함께 갱신
--
-- 원인(감사 후속 · 세션 F 설계):
--   `WorkLogRepositoryVenue.updateSlot` 이 `work_logs` 의 `time_slot`·`role` 만 UPDATE 하고
--   `applications.assignments[]` 는 낡은 채 두어 **두 원천이 표류**한다.
--   세션 E(#404)는 병합 키를 FK 2단계로 바꿔 화면 증상(카드 2장 쪼개짐)만 막았다 —
--   원천 불일치 자체는 남아 있다. 이 마이그가 그 원인을 없앤다.
--
-- ⚠️ 긴급도: #404 로 링크 키가 들어와 **표류해도 병합은 안 끊긴다.**
--    이건 파손 수리가 아니라 데이터 정합성 수선이다. 서두르다 남의 원소를 오염시키는 쪽이 더 나쁘다.
--    그래서 이 함수의 기본 태도는 "모호하면 손대지 않는다"이다.
--
-- ── 계약 ────────────────────────────────────────────────────
-- `p_patch` 는 **jsonb 패치**다. 스칼라 인자가 아닌 이유는 기존 계약이 3상이기 때문이다:
--   "키를 안 보내면 그 컬럼을 아예 UPDATE 페이로드에 만들지 않는다"(GRID-1 회귀 가드).
--   스칼라 NULL 로는 '미제공'과 '비움'을 구분할 수 없다. 키 존재는 `p_patch ? 'startTime'` 으로 본다.
-- 허용 키(클라 `UpdateSlotInput` 과 1:1): startTime · timeUndecided · staffRole · color · memo · editedBy
--   🔴 미지의 키는 **거부**한다. 조용히 무시하면 `start_time` 같은 표기 드리프트가
--      "저장했는데 아무것도 안 바뀐다"는 무증상 결함이 된다(가장 비싼 실패 모드).
--   🔴 각 키의 jsonb 타입도 검사한다 — `p_patch ? 'startTime'` 은 값이 **JSON null 이어도 true** 라
--      타입 검사가 없으면 NULL 이 정규화 로직으로 흘러든다(JSON null ≠ SQL NULL 함정).
--
-- ── 권한 ────────────────────────────────────────────────────
-- 🔴 RLS `wl_update` 를 **정확히 그대로** 재현한다(확대 0). prod 실측 정책:
--     work_logs.owner_id = auth.uid()
--     OR job_posting_id IN (SELECT id FROM job_postings
--          WHERE is_workspace_member(workspace_id, auth.uid())
--             OR is_posting_collaborator(id, auth.uid()))
--   형제 RPC `set_work_log_payroll_status` 는 `is_admin()` 을 의도적으로 **더했지만**,
--   이 함수는 더하지 않는다. 그 함수는 "관리자 지원 업무"라는 별도 근거로 연 것이고,
--   슬롯 편집에는 그 근거가 없다. 권한 확대는 조용히 끼워 넣을 성질이 아니다.
--   `job_postings.owner_id` 분기도 없다 — 현행 RLS 에 없기 때문이다(있었다면 지금도 통과했을 것).
--   🔑 SECDEF 안에서 `current_user` 는 함수 소유자다. 호출자는 반드시 `auth.uid()` 로 본다.
--
-- ── 잠금 ────────────────────────────────────────────────────
-- `applications` → `work_logs` 순서로 잠근다. 기존 RPC 관례와 같다
--   (`confirm_application`·`cancel_application_atomically` 둘 다 applications 를 먼저 잠근다).
-- assignments 는 read-modify-write 라 잠금 없이는 동시 편집이 서로의 원소를 지운다(Lost Update).
--
-- ── 트리거 영향(실측) ───────────────────────────────────────
-- `applications` 의 UPDATE 트리거 2종은 **알림을 내지 않는다**:
--   · `notify_on_application_update` — `status` 도 `cancellation_request->>'status'` 도 안 바뀌면 즉시 RETURN
--   · `fn_notify_cancellation_request` — `status = 'cancellation_pending'` 전이에서만 발화
--   즉 assignments 만 고치는 이 UPDATE 로 지원자에게 알림이 새지 않는다(prosrc 실측 확인).
-- `work_logs` 쪽 트리거(notify_on_work_log_update 의 시각 변경 알림 등)는 기존 직접 UPDATE 와
--   **동일하게** 발화한다 — SECDEF 는 트리거를 우회하지 않는다.
--
-- ── 이번에 넣지 않은 것 ─────────────────────────────────────
-- 🔴 `work_logs` 직접 UPDATE 차단(REVOKE/정책 축소)은 **넣지 않는다.**
--    순서: 이 PR 머지 → 웹 배포 + OTA → 롤아웃 확인(사용자 게이트) → 그 다음.
--    역순이면 아직 전환되지 않은 구 빌드가 즉사한다. 구/신 클라 공존이 전제다.
--    🔑 배포도 마이그(함수 생성)가 먼저다. 역순이면 신 클라가 PGRST202(함수 없음)를 만난다.
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_work_log_slot(
  p_work_log_id uuid,
  p_patch       jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_actor   uuid        := auth.uid();
  v_now     timestamptz := now();

  v_app_id      uuid;
  v_sync_app_id uuid;
  v_wl      record;
  v_app     record;

  v_unknown text;

  -- 시간 축
  v_set_time boolean := false;
  v_new_time text;                 -- work_logs.time_slot 최종값(NULL = 미정)
  v_raw_time text;

  -- 역할 축
  v_set_role boolean := false;
  v_new_role staff_role;

  v_set_color  boolean := false;
  v_new_color  text;
  v_set_memo   boolean := false;
  v_new_memo   text;
  v_set_editor boolean := false;

  -- 갱신 후 유효값(동기화 기준)
  v_final_time text;
  v_final_role staff_role;

  -- assignments 동기화
  v_synced       boolean := false;
  v_reason       text    := 'no_application';
  v_role_key_old text;
  v_role_key_new text;
  v_role_id_new  text;
  v_slot_new     text;
  v_match_cnt    int     := 0;
  v_match_ord    int;
  v_elem         jsonb;
  v_ord          int;
  v_new_arr      jsonb;
  v_dates        jsonb;
  v_roles        jsonb;
  v_rest_dates   jsonb;
  v_rest_roles   jsonb;
  v_piece        jsonb;

  -- staff_role enum 라벨 집합(roleIds 가 표준 역할인지 커스텀 역할명인지 가르는 기준)
  v_role_labels text[] := enum_range(NULL::staff_role)::text[];
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 인증이 필요합니다';
  END IF;

  IF p_patch IS NULL OR jsonb_typeof(p_patch) <> 'object' THEN
    RAISE EXCEPTION 'INVALID_INPUT: 수정 내용이 올바르지 않습니다';
  END IF;

  -- ── 1) 패치 계약 검증 (fail-closed) ─────────────────────────
  SELECT k INTO v_unknown
  FROM jsonb_object_keys(p_patch) k
  WHERE k NOT IN ('startTime', 'timeUndecided', 'staffRole', 'color', 'memo', 'editedBy')
  LIMIT 1;
  IF v_unknown IS NOT NULL THEN
    RAISE EXCEPTION 'INVALID_INPUT: 알 수 없는 수정 항목입니다: %', v_unknown;
  END IF;

  -- 시간: '미정'이 startTime 보다 우선한다(클라 updateSlot·addSlotPayload 와 동일 우선순위).
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
    -- 🔴 정본은 **단일 시각 'HH:mm'** 이다(§K). 범위 문자열·자유 텍스트·범위 밖 시각을 전부 거부해
    --    폐지된 범위 저장이 다시 흘러드는 경로를 형식 단계에서 끊는다.
    IF v_raw_time !~ '^(0?[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$' THEN
      RAISE EXCEPTION 'INVALID_INPUT: 출근 시간 형식이 올바르지 않습니다';
    END IF;
    -- 🔴 0패딩 정규화를 **여기서** 한다. CHECK 제약에 맡기면 두 가지가 깨진다:
    --    ① `work_logs_time_slot_format` 위반이 23514 원시 에러로 새어 나가 설명할 수 없고
    --    ② `_posting_slot_key` 가 **원문 문자열**을 슬롯 키로 쓰므로 '9:00' 과 '09:00' 이
    --       다른 슬롯으로 쪼개져 정원·중복배정 판정이 조용히 갈린다.
    v_new_time := lpad(split_part(v_raw_time, ':', 1)::int::text, 2, '0')
                  || ':' || split_part(v_raw_time, ':', 2);
    v_set_time := true;
  END IF;

  IF p_patch ? 'staffRole' THEN
    IF jsonb_typeof(p_patch->'staffRole') <> 'string'
       OR NOT ((p_patch->>'staffRole') = ANY (v_role_labels)) THEN
      RAISE EXCEPTION 'INVALID_INPUT: 알 수 없는 역할입니다';
    END IF;
    v_new_role := (p_patch->>'staffRole')::staff_role;
    v_set_role := true;
  END IF;

  -- 색상: **토큰 화이트리스트(19종)는 서버로 옮기지 않는다** — 그건 제품 규칙이라
  --   팔레트를 늘릴 때마다 마이그가 필요해진다. 서버는 보안 불변식(길이·XSS)만 재현한다.
  IF p_patch ? 'color' THEN
    IF jsonb_typeof(p_patch->'color') <> 'string' THEN
      RAISE EXCEPTION 'INVALID_INPUT: 색상 값이 올바르지 않습니다';
    END IF;
    v_new_color := btrim(p_patch->>'color');
    IF length(v_new_color) > 50
       OR v_new_color ~* '<\s*script|javascript\s*:|on\w+\s*=|<\s*iframe|<\s*object|<\s*embed' THEN
      RAISE EXCEPTION 'INVALID_INPUT: 허용되지 않은 색상입니다';
    END IF;
    v_set_color := true;
  END IF;

  -- 메모: 클라 `assertSlotMemo`(500자 + xssValidation)와 같은 규약. trim 결과를 저장하는 것도 동일.
  IF p_patch ? 'memo' THEN
    IF jsonb_typeof(p_patch->'memo') <> 'string' THEN
      RAISE EXCEPTION 'INVALID_INPUT: 메모 값이 올바르지 않습니다';
    END IF;
    v_new_memo := p_patch->>'memo';
    IF length(v_new_memo) > 500
       OR v_new_memo ~* '<\s*script|javascript\s*:|on\w+\s*=|<\s*iframe|<\s*object|<\s*embed' THEN
      RAISE EXCEPTION 'INVALID_INPUT: 메모에 허용되지 않은 내용이 있거나 너무 깁니다.';
    END IF;
    v_new_memo := btrim(v_new_memo);
    v_set_memo := true;
  END IF;

  -- 수정 행위자: 키가 있으면 기록하되 **값은 호출자로 덮어쓴다**(위조 불가).
  --   클라는 이미 `editedBy = user?.uid` 로 자기 자신만 보낸다(VenueDayPanel.tsx:103) —
  --   서버가 auth.uid() 를 쓰면 의미는 같고 위조 경로만 사라진다.
  IF p_patch ? 'editedBy' THEN
    IF jsonb_typeof(p_patch->'editedBy') <> 'string' THEN
      RAISE EXCEPTION 'INVALID_INPUT: 수정자 값이 올바르지 않습니다';
    END IF;
    v_set_editor := true;
  END IF;

  -- ── 2) 잠금: applications → work_logs (기존 RPC 관례) ────────
  SELECT application_id INTO v_app_id FROM public.work_logs WHERE id = p_work_log_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'WORK_LOG_NOT_FOUND: %', p_work_log_id;
  END IF;

  -- 🔑 `add_direct_staff` 가 만든 행은 `application_id` 가 NULL 이다(수동 추가 — 상대편 지원서가
  --    아예 없다). 동기화 대상이 아니므로 잠그지도 않는다.
  IF v_app_id IS NOT NULL THEN
    SELECT * INTO v_app FROM public.applications WHERE id = v_app_id FOR UPDATE;
    IF FOUND THEN
      v_sync_app_id := v_app_id;
    ELSE
      v_reason := 'application_missing';  -- 고아 FK: work_logs 만 갱신한다
    END IF;
  END IF;

  SELECT * INTO v_wl FROM public.work_logs WHERE id = p_work_log_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'WORK_LOG_NOT_FOUND: %', p_work_log_id;
  END IF;

  -- 잠금 전 읽은 application_id 가 그 사이 바뀌었으면 동기화하지 않는다(잘못된 지원서 오염 방지).
  IF v_sync_app_id IS NOT NULL AND v_sync_app_id IS DISTINCT FROM v_wl.application_id THEN
    v_sync_app_id := NULL;
    v_reason := 'application_changed';
  END IF;

  -- ── 3) 권한: RLS wl_update 정확 재현 ────────────────────────
  IF NOT (
    COALESCE(v_wl.owner_id = v_actor, false)
    OR EXISTS (
      SELECT 1 FROM public.job_postings jp
      WHERE jp.id = v_wl.job_posting_id
        AND (COALESCE(public.is_workspace_member(jp.workspace_id, v_actor), false)
          OR COALESCE(public.is_posting_collaborator(jp.id, v_actor), false))
    )
  ) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 권한이 있는 공고의 근무 기록만 수정할 수 있습니다';
  END IF;

  -- ── 4) work_logs 갱신 ───────────────────────────────────────
  v_final_time := CASE WHEN v_set_time THEN v_new_time ELSE v_wl.time_slot END;
  v_final_role := CASE WHEN v_set_role THEN v_new_role ELSE v_wl.role END;

  UPDATE public.work_logs SET
    time_slot  = CASE WHEN v_set_time   THEN v_new_time  ELSE time_slot  END,
    role       = CASE WHEN v_set_role   THEN v_new_role  ELSE role       END,
    color      = CASE WHEN v_set_color  THEN v_new_color ELSE color      END,
    notes      = CASE WHEN v_set_memo   THEN v_new_memo  ELSE notes      END,
    edited_by  = CASE WHEN v_set_editor THEN v_actor     ELSE edited_by  END,
    updated_at = v_now
  WHERE id = p_work_log_id;

  -- ── 5) applications.assignments 동기화 ──────────────────────
  -- 🔴 이 구간의 실패가 슬롯 편집 자체를 죽이면 **선재 대비 회귀**다(지금은 applications 를
  --    아예 안 건드리므로 그런 실패가 없다). 그래서 하위 트랜잭션으로 감싸 강등시킨다 —
  --    편집은 성사시키고 동기화만 포기한다. 조용히 삼키지 않도록 WARNING 을 남기고
  --    반환값의 `assignmentSynced:false` + `reason` 으로 호출자에게 사실을 알린다.
  IF v_sync_app_id IS NOT NULL THEN
    BEGIN
      -- 5-1) 역할 키. 🔑 `updateSlot` 은 `custom_role` 을 건드리지 않으므로 custom_role 은 그대로다.
      --      custom_role 이 살아 있으면 `_posting_role_key` 상 실제 역할 키는 바뀌지 않는다 —
      --      그래서 "새 staffRole 을 그대로 roleIds 에 넣기"는 틀린다. 키에서 역산해야 한다.
      v_role_key_old := public._posting_role_key(v_wl.role::text, v_wl.custom_role);
      v_role_key_new := public._posting_role_key(v_final_role::text, v_wl.custom_role);

      v_role_id_new := CASE
        WHEN v_role_key_new = 'other:'      THEN 'other'
        WHEN v_role_key_new LIKE 'other:%'  THEN substring(v_role_key_new FROM 7)
        ELSE v_role_key_new
      END;

      -- 5-2) assignments 의 `timeSlot` 은 **zod 가 널을 금지한다**
      --      (`application.schema.ts` assignmentInnerSchema: `timeSlot: z.string()`).
      --      JSON null 을 쓰면 지원서 레코드가 파싱 단계에서 통째로 증발한다(A2 사고 선례).
      --      미정은 `'미정'`(TBA_TIME_MARKER)으로 쓴다 — `_posting_slot_key` 상 NULL/''/'미정' 은
      --      모두 같은 슬롯 키로 접히고, `ScheduleConverter.parseTimeSlotToTimestamp` 도 null 로 접는다.
      v_slot_new := CASE
        WHEN v_final_time IS NULL OR btrim(v_final_time) = '' THEN '미정'
        ELSE v_final_time
      END;

      -- 5-3) 매칭. 표류하지 않는 축만 쓴다: application_id(FK) + groupId + date + 역할 키.
      --      원소 하나가 (dates × roleIds) 곱을 덮으므로 **셀 단위로** 본다.
      --      🔴 원소 안에서 같은 날짜/같은 역할 키가 2개 이상이면 그 원소는 매칭에서 빠진다 —
      --         `roleIds` 는 집합이 아니라 **다중집합**(같은 역할 N번 = N명 요청, slotCapacity.ts:116)
      --         이라 어느 사람의 셀인지 가릴 수 없다. 모호하면 손대지 않는 것이 이 함수의 규칙이다.
      SELECT count(*)::int, min(t.ord)::int
        INTO v_match_cnt, v_match_ord
      FROM jsonb_array_elements(
             CASE WHEN jsonb_typeof(v_app.assignments) = 'array'
                  THEN v_app.assignments ELSE '[]'::jsonb END
           ) WITH ORDINALITY AS t(elem, ord)
      WHERE (t.elem->>'groupId') IS NOT DISTINCT FROM v_wl.assignment_group_id
        AND (SELECT count(*) FROM jsonb_array_elements_text(
               CASE WHEN jsonb_typeof(t.elem->'dates') = 'array'
                    THEN t.elem->'dates' ELSE '[]'::jsonb END) d
             WHERE d = v_wl.date) = 1
        AND (SELECT count(*) FROM jsonb_array_elements_text(
               CASE WHEN jsonb_typeof(t.elem->'roleIds') = 'array'
                    THEN t.elem->'roleIds' ELSE '[]'::jsonb END) r
             WHERE public._posting_role_key(
                     CASE WHEN r = ANY (v_role_labels) THEN r    ELSE 'other' END,
                     CASE WHEN r = ANY (v_role_labels) THEN NULL ELSE r       END
                   ) = v_role_key_old) = 1;

      IF v_match_cnt <> 1 THEN
        v_reason := CASE WHEN v_match_cnt = 0 THEN 'no_match' ELSE 'ambiguous_match' END;
      ELSE
        -- 5-4) 재작성. 매칭된 원소만 셀 단위로 분해하고 나머지는 그대로 옮긴다.
        v_new_arr := '[]'::jsonb;

        FOR v_ord, v_elem IN
          SELECT t.ord, t.elem
          FROM jsonb_array_elements(v_app.assignments) WITH ORDINALITY AS t(elem, ord)
          ORDER BY t.ord
        LOOP
          IF v_ord <> v_match_ord THEN
            v_new_arr := v_new_arr || jsonb_build_array(v_elem);
            CONTINUE;
          END IF;

          v_dates := CASE WHEN jsonb_typeof(v_elem->'dates') = 'array'
                          THEN v_elem->'dates' ELSE '[]'::jsonb END;
          v_roles := CASE WHEN jsonb_typeof(v_elem->'roleIds') = 'array'
                          THEN v_elem->'roleIds' ELSE '[]'::jsonb END;

          SELECT COALESCE(jsonb_agg(to_jsonb(d) ORDER BY o), '[]'::jsonb) INTO v_rest_dates
          FROM jsonb_array_elements_text(v_dates) WITH ORDINALITY AS x(d, o)
          WHERE d IS DISTINCT FROM v_wl.date;

          SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY o), '[]'::jsonb) INTO v_rest_roles
          FROM jsonb_array_elements_text(v_roles) WITH ORDINALITY AS x(r, o)
          WHERE public._posting_role_key(
                  CASE WHEN r = ANY (v_role_labels) THEN r    ELSE 'other' END,
                  CASE WHEN r = ANY (v_role_labels) THEN NULL ELSE r       END
                ) IS DISTINCT FROM v_role_key_old;

          -- 🔴 여기가 이 마이그의 핵심 위험 지점이다. 한 원소가 dates:[d1,d2,d3] 를 덮는데
          --    d2 만 편집하고 원소의 timeSlot 을 제자리에서 바꾸면 **d1·d3 까지 조용히 바뀐다.**
          --    그래서 편집된 셀만 떼어내고 나머지는 원래 값 그대로 남긴다.
          --    🔑 세 조각 모두 `groupId` 는 **원본을 유지**한다. 새 groupId 를 발급하면
          --       `work_logs.assignment_group_id` 와 어긋나 세션 E 가 세운 병합 링크가 다시 깨진다.
          --       분할 후에도 키에 `date` 가 있어 dates 가 서로소면 셀↔원소 1:1 이 유지된다.

          -- A) 나머지 날짜 × 전체 역할 — 값은 손대지 않는다.
          IF jsonb_array_length(v_rest_dates) > 0 THEN
            v_piece := (v_elem
              || jsonb_build_object('dates', v_rest_dates,
                                    'isGrouped', jsonb_array_length(v_rest_dates) > 1))
              - 'duration';  -- dates 가 달라졌으므로 기간 정보는 더 이상 사실이 아니다(zod optional)
            v_new_arr := v_new_arr || jsonb_build_array(v_piece);
          END IF;

          -- B) 같은 날 × 나머지 역할 — 값은 손대지 않는다.
          IF jsonb_array_length(v_rest_roles) > 0 THEN
            v_piece := v_elem
              || jsonb_build_object('dates', jsonb_build_array(v_wl.date),
                                    'roleIds', v_rest_roles,
                                    'isGrouped', false);
            IF jsonb_array_length(v_dates) > 1 THEN
              v_piece := v_piece - 'duration';
            END IF;
            v_new_arr := v_new_arr || jsonb_build_array(v_piece);
          END IF;

          -- C) 편집된 셀. 🔑 시간·역할을 **패치 여부와 무관하게** 갱신 후 work_logs 값으로 맞춘다 —
          --    이미 표류해 있던 원소도 이 저장 한 번으로 함께 수렴한다(자가 치유).
          v_piece := v_elem
            || jsonb_build_object('dates', jsonb_build_array(v_wl.date),
                                  'roleIds', jsonb_build_array(v_role_id_new),
                                  'timeSlot', v_slot_new,
                                  'isGrouped', false);
          IF jsonb_array_length(v_dates) > 1 THEN
            v_piece := v_piece - 'duration';
          END IF;
          v_new_arr := v_new_arr || jsonb_build_array(v_piece);
        END LOOP;

        UPDATE public.applications
           SET assignments = v_new_arr,
               updated_at  = v_now
         WHERE id = v_sync_app_id;

        v_synced := true;
        v_reason := NULL;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- 편집은 살리고 동기화만 포기한다. 표류(현상 유지)가 편집 실패보다 싸다.
      RAISE WARNING '[update_work_log_slot] assignments sync failed for work_log % — %',
        p_work_log_id, SQLERRM;
      v_synced := false;
      v_reason := 'sync_failed';
    END;
  END IF;

  RETURN jsonb_build_object(
    'success',              true,
    'workLogId',            p_work_log_id,
    'assignmentSynced',     v_synced,
    'assignmentSyncReason', v_reason
  );
END;
$$;

COMMENT ON FUNCTION public.update_work_log_slot(uuid, jsonb) IS
  '근무표 슬롯 편집(시간·역할·색상·메모)을 work_logs 와 applications.assignments 에 한 트랜잭션으로 반영한다. '
  'jsonb 패치는 키 존재로 부분 갱신을 표현한다(GRID-1). 권한은 RLS wl_update 정확 재현(확대 0). '
  '매칭이 모호하면 assignments 동기화만 건너뛰고 work_logs 는 갱신한다 — 남의 원소를 오염시키는 것보다 표류가 싸다.';

REVOKE ALL ON FUNCTION public.update_work_log_slot(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_work_log_slot(uuid, jsonb) TO authenticated;
