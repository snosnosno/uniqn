-- ============================================================
-- update_work_log_slot 확장 — 실적(출퇴근)·상태 파생·역할 이력을 한 트랜잭션으로 흡수
--
-- 근거: docs/planning/2026-08-06-work-time-editing-unification-plan.md Task 3.
--
-- ── 무엇이 문제인가 ─────────────────────────────────────────
-- 예정(time_slot) 쓰기는 이미 이 RPC 다. 그런데 실적(check_in_ts·check_out_ts) 쓰기는
-- 아직 **클라 직접 UPDATE 2곳**이다:
--   · ConfirmedStaffRepository.updateWorkTimeWithTransaction (스태프 관리 탭)
--   · SettlementRepository.updateWorkTimeWithTransaction      (정산 탭)
-- 편집기 3곳을 시트 하나로 합치면 "저장 한 번"이 **호출 두 번**(RPC + PATCH)이 되어
-- 한쪽만 성공하는 부분 실패가 생긴다. 실적을 이 RPC 로 흡수해 한 트랜잭션으로 모은다.
-- (Task 4 가 위 두 리포지토리를 이 계약으로 갈아끼운다.)
--
-- ── 베이스 ──────────────────────────────────────────────────
-- 20260802180000_update_work_log_slot_rpc.sql 본문. prod 실측 대조 확인 —
--   md5(replace(pg_get_functiondef(oid), chr(13), '')) = daa783a987ca7af284aa1a79f6a29066
-- 로 레포 적용본과 완전 일치하며 그 뒤 얹힌 하드닝은 없다.
-- (⚠️ chr(13) 제거 없이 비교하면 CRLF 때문에 전부 가짜 불일치로 보인다.)
--
-- ── 형식 규율 ───────────────────────────────────────────────
--  * 반환 타입이 그대로라 **CREATE OR REPLACE 로 충분하다**. DROP 하면 20260731090000 계열이
--    회수한 권한이 기본값으로 되살아난다.
--  * SET 절은 proconfig 를 통째로 갈아치우므로 현행값 `'public', 'pg_temp'` 를 그대로 유지한다.
--    🔴 `extensions` 를 넣지 않는다 — 이 함수의 현행값이 아니다.
--    `pg_temp` 누락 회귀 가드: supabase/tests/parity_baseline_guard.test.sql:172-182.
--  * 함수 신설·삭제 없음 → 파리티 200 / 111 불변.
--
-- ── 계약 확장 ───────────────────────────────────────────────
-- 허용 키에 3개를 더한다(클라 통합 시트의 실적 축과 1:1):
--   checkIn  : string(ISO) | null   ── 키 없음=미변경 / JSON null=삭제 / 문자열=기록
--   checkOut : string(ISO) | null
--   reason   : string               ── 수정 사유. 이력 두 종류(시간·역할)에 함께 실린다.
-- 🔴 3상 계약을 `COALESCE`·truthy 로 짜면 **null(삭제)이 조용히 무시된다.** 기존 키가 이미
--    쓰는 패턴 그대로 — 키 존재는 `?`, 값 타입은 `jsonb_typeof` 로 따로 본다.
--
-- ── 이번에 넣은 것과 그 근거 ────────────────────────────────
-- (가) 상태 파생 — 클라 `resolveWorkTimeStatus`(workLogTimeStatus.ts)를 그대로 옮긴다.
--      work_logs 의 정산 게이트는 **status** 로 판정하므로(settle_work_log), 시각만 고치고
--      status 를 안 맞추면 '고쳐도 영원히 정산 불가'인 막다른 길이 생긴다(SET-1).
--      🔴 `no_show`·`cancelled` 는 건드리지 않는다 — 시간 수정이 노쇼를 조용히 checked_out 으로
--         뒤집으면 없던 유급 근무가 생긴다. 노쇼 정정은 전용 경로만 담당한다.
--      🔴 **실적 키가 패치에 있을 때만 파생한다**(D1). 브리프 초안은 파생을 무조건 돌렸는데,
--         그러면 status='scheduled' 인데 check_in_ts 가 남아 있는 행(CHECK 상 적법하다)에서
--         **메모나 예정만 고쳐도 status 가 checked_in 으로 튄다.** 예정 변경은 근태 상태를
--         절대 건드리지 않는다는 것이 이 통합의 전제다.
--         회귀 가드: work_log_slot_attendance_rpc.test.sql 10번.
-- (나) 수정 이력(modification_history) — 배열 길이 증가가 notify_on_work_log_update Case 2 를
--      발화시켜 스태프에게 "근무 시간 변경" 알림을 보내고 이력 섹션에 표시된다.
--      Task 1(20260806120000)의 병합 가드 덕에 예정+실적을 한 UPDATE 로 바꿔도 알림은 1통이다.
--      🔑 엔트리 모양은 클라 `appendWorkTimeModification` 계약 그대로 — **바뀐 축만** 싣는다.
--         안 바뀐 축까지 previous/new 를 채우면 표시 컴포넌트가 "변경 없음"을 구분하지 못하고
--         알림 본문에 무의미한 '종료  -> ' 문구가 붙는다.
-- (다) 역할 이력(role_change_history) — 근무표 경로(updateSlot)에는 아예 없던 것이다.
--      스태프 관리 탭의 역할 변경만 남기고 있었으므로, 같은 시트로 합치면서 서버로 모은다.
--      표준 역할로 바꿀 때 옛 `custom_role` 을 지운다 — 남기면 `_posting_role_key` 가
--      custom_role 을 우선하므로 역할 키가 'other:바리스타' 에서 영영 안 바뀌어 유령이 된다.
--      🔑 그래서 assignments 동기화의 `v_role_key_new` 도 **정리 후 custom_role** 로 계산한다.
--         (베이스의 "updateSlot 은 custom_role 을 건드리지 않는다"는 전제가 여기서 깨진다.)
--      🔑 `staffRole='other'` 로 가는 경우는 지우지 않는다 — 패치에 커스텀 역할명을 담는 키가
--         없어 무엇으로 대체할지 알 수 없다. 지우면 역할 이름 자체가 증발한다.
-- (라) 정산 완료 잠금 — 클라 `AlreadySettledError` 의 서버 짝. **실적 키에만** 건다.
--      기존 키(예정·역할·색·메모)까지 좁히면 아직 전환 안 된 구 빌드의 근무표 편집이 즉사한다.
-- (마) 이력 append 는 **이미 FOR UPDATE 로 잠근 스냅샷(v_wl)** 에서 한다. 다시 SELECT 하면
--      잠금 밖 읽기가 되어 Lost Update 경로가 열린다.
--
-- ── 이번에 넣지 않은 것 ─────────────────────────────────────
-- 🔴 **역할 정원 초과 거부는 넣지 않는다**(D7 · 사용자 확정). 정원 판정은 공고 축이고
--    근무표는 그 밖의 배치도 허용해 왔다. 여기서 막으면 지금 되는 저장이 갑자기 거부된다.
-- 🔴 `work_logs` 직접 UPDATE 차단(REVOKE/정책 축소)도 넣지 않는다. 순서는 베이스와 같다 —
--    머지 → 웹 배포 + OTA → 롤아웃 확인 → 그 다음. 구/신 클라 공존이 전제다.
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

  -- 실적 축(출퇴근). 3상 계약이라 "설정 여부"와 "설정할 값"을 분리해서 들고 있어야 한다.
  v_set_check_in    boolean := false;
  v_new_check_in    timestamptz;
  v_set_check_out   boolean := false;
  v_new_check_out   timestamptz;
  v_final_check_in  timestamptz;
  v_final_check_out timestamptz;
  v_touch_attendance boolean := false;   -- = v_set_check_in OR v_set_check_out

  -- 수정 사유(시간 이력·역할 이력 공용)
  v_reason text := '';

  -- 상태 파생
  v_set_status boolean := false;
  v_new_status work_log_status;

  -- 이력
  v_mod_entry        jsonb;
  v_new_mod_history  jsonb;
  v_new_role_history jsonb;

  -- 갱신 후 유효값(동기화 기준)
  v_final_time        text;
  v_final_role        staff_role;
  v_clear_custom_role boolean := false;
  v_final_custom_role text;

  -- assignments 동기화
  v_synced       boolean := false;
  v_reason_sync  text    := 'no_application';
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
  WHERE k NOT IN ('startTime', 'timeUndecided', 'staffRole', 'color', 'memo', 'editedBy',
                  'checkIn', 'checkOut', 'reason')
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

  -- 수정 사유: 두 이력(시간·역할)에 그대로 실려 스태프 알림 본문·이력 섹션으로 노출된다.
  --   지금까지 검증은 클라 `assertWorkTimeReason`(200자 + xssValidation) 뿐이었다 —
  --   쓰기 경계가 이 함수로 옮겨오므로 같은 불변식을 여기서 재현한다.
  --   빈 사유는 클라와 같이 '' 로 정규화한다(사유 미입력은 정상 경로다).
  IF p_patch ? 'reason' THEN
    IF jsonb_typeof(p_patch->'reason') = 'null' THEN
      v_reason := '';
    ELSIF jsonb_typeof(p_patch->'reason') = 'string' THEN
      v_reason := p_patch->>'reason';
      IF length(v_reason) > 200
         OR v_reason ~* '<\s*script|javascript\s*:|on\w+\s*=|<\s*iframe|<\s*object|<\s*embed' THEN
        RAISE EXCEPTION 'INVALID_INPUT: 수정 사유에 허용되지 않은 내용이 있거나 너무 깁니다.';
      END IF;
    ELSE
      RAISE EXCEPTION 'INVALID_PATCH_TYPE: reason';
    END IF;
  END IF;

  -- 실적 출근. 🔴 키 없음=미변경 / JSON null=삭제 / 문자열=기록.
  --   `p_patch ? 'checkIn'` 은 값이 JSON null 이어도 true 이므로 존재와 타입을 따로 본다.
  IF p_patch ? 'checkIn' THEN
    v_set_check_in := true;
    IF jsonb_typeof(p_patch->'checkIn') = 'null' THEN
      v_new_check_in := NULL;
    ELSIF jsonb_typeof(p_patch->'checkIn') = 'string' THEN
      -- 캐스트 실패(22007)를 그대로 흘리면 앱이 매핑할 수 없는 원시 에러가 된다.
      BEGIN
        v_new_check_in := (p_patch->>'checkIn')::timestamptz;
      EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'INVALID_PATCH_TYPE: checkIn';
      END;
    ELSE
      RAISE EXCEPTION 'INVALID_PATCH_TYPE: checkIn';
    END IF;
  END IF;

  IF p_patch ? 'checkOut' THEN
    v_set_check_out := true;
    IF jsonb_typeof(p_patch->'checkOut') = 'null' THEN
      v_new_check_out := NULL;
    ELSIF jsonb_typeof(p_patch->'checkOut') = 'string' THEN
      BEGIN
        v_new_check_out := (p_patch->>'checkOut')::timestamptz;
      EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'INVALID_PATCH_TYPE: checkOut';
      END;
    ELSE
      RAISE EXCEPTION 'INVALID_PATCH_TYPE: checkOut';
    END IF;
  END IF;

  v_touch_attendance := v_set_check_in OR v_set_check_out;

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
      v_reason_sync := 'application_missing';  -- 고아 FK: work_logs 만 갱신한다
    END IF;
  END IF;

  SELECT * INTO v_wl FROM public.work_logs WHERE id = p_work_log_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'WORK_LOG_NOT_FOUND: %', p_work_log_id;
  END IF;

  -- 잠금 전 읽은 application_id 가 그 사이 바뀌었으면 동기화하지 않는다(잘못된 지원서 오염 방지).
  IF v_sync_app_id IS NOT NULL AND v_sync_app_id IS DISTINCT FROM v_wl.application_id THEN
    v_sync_app_id := NULL;
    v_reason_sync := 'application_changed';
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

  -- ── 3-B) 정산 완료 잠금 (실적 키 한정) ──────────────────────
  -- 클라 `AlreadySettledError`(SettlementRepository·ConfirmedStaffRepository)의 서버 짝.
  -- 🔴 기존 키(예정·역할·색·메모)에는 걸지 않는다 — 지금 되는 저장을 조용히 좁히면
  --    아직 전환되지 않은 구 빌드의 근무표 편집이 즉사한다. 구/신 클라 공존이 전제다.
  IF v_touch_attendance AND v_wl.payroll_status = 'completed' THEN
    RAISE EXCEPTION 'ALREADY_SETTLED: 정산이 완료된 근무는 시간을 수정할 수 없습니다';
  END IF;

  -- ── 4) 상태 파생 + 이력 조립 ────────────────────────────────
  -- ⚠️ 아래는 전부 위에서 FOR UPDATE 로 잠근 스냅샷(v_wl)에서 읽는다.
  --    다시 SELECT 하면 잠금 밖 읽기가 되어 Lost Update 경로가 열린다.
  IF v_touch_attendance THEN
    v_final_check_in  := CASE WHEN v_set_check_in  THEN v_new_check_in  ELSE v_wl.check_in_ts  END;
    v_final_check_out := CASE WHEN v_set_check_out THEN v_new_check_out ELSE v_wl.check_out_ts END;

    -- 근태 생애주기 상태에서만 파생한다. no_show·cancelled 는 건드리지 않는다 —
    -- 시간 수정이 노쇼를 조용히 checked_out 으로 뒤집으면 없던 유급 근무가 생긴다.
    IF v_wl.status IN ('scheduled', 'checked_in', 'checked_out', 'completed') THEN
      IF v_final_check_in IS NOT NULL AND v_final_check_out IS NOT NULL THEN
        -- 이미 completed 인 행을 checked_out 으로 되돌리지 않는다 — completed 도
        -- '양쪽 NOT NULL' 을 만족하므로 제약 위반이 아니고, 강등하면
        -- tr_sync_application_completion 이 applications 를 불필요하게 역전파한다.
        IF v_wl.status <> 'completed' THEN
          v_set_status := true;
          v_new_status := 'checked_out';
        END IF;
      ELSIF v_final_check_in IS NOT NULL THEN
        v_set_status := true;
        v_new_status := 'checked_in';
      ELSE
        -- 출근 시각이 없으면 scheduled 로 강등한다. 안 하면 CHECK
        -- work_logs_status_timestamp_consistency 가 UPDATE 전체를 23514 로 거부한다.
        v_set_status := true;
        v_new_status := 'scheduled';
      END IF;
    END IF;

    -- 수정 이력. 🔑 **바뀐 축만** 싣는다(클라 appendWorkTimeModification 계약).
    --    안 바뀐 축까지 채우면 알림 본문에 무의미한 '종료  -> ' 가 붙고
    --    이력 섹션이 "변경 없음"을 구분하지 못한다.
    v_mod_entry := jsonb_build_object(
      'modifiedAt', v_now,
      'modifiedBy', v_actor,
      'reason',     v_reason
    );
    IF v_set_check_in THEN
      v_mod_entry := v_mod_entry || jsonb_build_object(
        'previousStartTime', v_wl.check_in_ts,
        'newStartTime',      v_new_check_in);
    END IF;
    IF v_set_check_out THEN
      v_mod_entry := v_mod_entry || jsonb_build_object(
        'previousEndTime', v_wl.check_out_ts,
        'newEndTime',      v_new_check_out);
    END IF;

    -- ⚠️ jsonb_array_length 는 배열이 아니면 22023 을 던진다. 컬럼 default 는 '[]' 이고 클라는
    --    항상 배열을 쓰지만 raw PostgREST 로는 객체도 들어간다 — 오염된 한 행이 저장을
    --    통째로 죽이지 않도록 타입을 먼저 본다(notify 트리거의 같은 가드와 대칭).
    v_new_mod_history := CASE
        WHEN jsonb_typeof(v_wl.modification_history) = 'array' THEN v_wl.modification_history
        ELSE '[]'::jsonb
      END || jsonb_build_array(v_mod_entry);
  END IF;

  -- 역할 이력 + custom_role 정리. 근무표 경로에 없던 것을 여기서 흡수한다.
  IF v_set_role AND v_new_role IS DISTINCT FROM v_wl.role THEN
    v_new_role_history := CASE
        WHEN jsonb_typeof(v_wl.role_change_history) = 'array' THEN v_wl.role_change_history
        ELSE '[]'::jsonb
      END || jsonb_build_array(jsonb_build_object(
        'previousRole', v_wl.role::text,
        'newRole',      v_new_role::text,
        'reason',       v_reason,
        'changedBy',    v_actor,
        'changedAt',    v_now
      ));

    -- 표준 역할로 바꾸면 옛 커스텀 역할명을 지운다 — 남기면 `_posting_role_key` 가
    -- custom_role 을 우선하므로 역할 키가 'other:<옛이름>' 에서 영영 안 바뀐다(유령 부활).
    -- 🔑 'other' 로 가는 경우는 지우지 않는다 — 패치에 커스텀 역할명을 담는 키가 없어
    --    무엇으로 대체할지 알 수 없고, 지우면 역할 이름 자체가 증발한다.
    v_clear_custom_role := (v_new_role <> 'other');
  END IF;

  -- ── 5) work_logs 갱신 ───────────────────────────────────────
  v_final_time        := CASE WHEN v_set_time THEN v_new_time ELSE v_wl.time_slot END;
  v_final_role        := CASE WHEN v_set_role THEN v_new_role ELSE v_wl.role END;
  v_final_custom_role := CASE WHEN v_clear_custom_role THEN NULL ELSE v_wl.custom_role END;

  UPDATE public.work_logs SET
    time_slot    = CASE WHEN v_set_time   THEN v_new_time  ELSE time_slot  END,
    role         = CASE WHEN v_set_role   THEN v_new_role  ELSE role       END,
    color        = CASE WHEN v_set_color  THEN v_new_color ELSE color      END,
    notes        = CASE WHEN v_set_memo   THEN v_new_memo  ELSE notes      END,
    custom_role  = CASE WHEN v_clear_custom_role THEN NULL ELSE custom_role END,
    -- 실적 3상: 설정 안 했으면 컬럼을 손대지 않고, 설정했으면 NULL 도 그대로 쓴다.
    check_in_ts  = CASE WHEN v_set_check_in  THEN v_new_check_in  ELSE check_in_ts  END,
    check_out_ts = CASE WHEN v_set_check_out THEN v_new_check_out ELSE check_out_ts END,
    -- 퇴근 시각을 사람이 쓰면 출처를 되돌린다. 빼면 QR 로 찍힌 뒤 수정된 행이 계속 'qr' 로
    -- 남아 화면에 거짓 "QR 기록" 이 뜬다(ConfirmedStaffRepository.ts:426 이 지키던 것).
    end_time_source = CASE WHEN v_set_check_out THEN 'manual' ELSE end_time_source END,
    status       = CASE WHEN v_set_status THEN v_new_status ELSE status END,
    modification_history       = COALESCE(v_new_mod_history,  modification_history),
    role_change_history        = COALESCE(v_new_role_history, role_change_history),
    has_time_modification_logs = CASE WHEN v_touch_attendance THEN true
                                      ELSE has_time_modification_logs END,
    -- 🔑 퇴근 시각을 쓸 때 edited_by 도 함께 세우는 비대칭은 흡수 대상 경로
    --    (ConfirmedStaffRepository.ts:427)를 그대로 옮긴 것이다. 통합 시트는 editedBy 를
    --    명시로 보내므로 실사용에서는 두 경로가 같은 값으로 수렴한다.
    edited_by    = CASE WHEN v_set_editor OR v_set_check_out THEN v_actor ELSE edited_by END,
    updated_at   = v_now
  WHERE id = p_work_log_id;

  -- ── 6) applications.assignments 동기화 ──────────────────────
  -- 🔴 이 구간의 실패가 슬롯 편집 자체를 죽이면 **선재 대비 회귀**다(지금은 applications 를
  --    아예 안 건드리므로 그런 실패가 없다). 그래서 하위 트랜잭션으로 감싸 강등시킨다 —
  --    편집은 성사시키고 동기화만 포기한다. 조용히 삼키지 않도록 WARNING 을 남기고
  --    반환값의 `assignmentSynced:false` + `reason` 으로 호출자에게 사실을 알린다.
  IF v_sync_app_id IS NOT NULL THEN
    BEGIN
      -- 6-1) 역할 키. 🔑 이전 키는 **옛 custom_role**, 새 키는 **정리 후 custom_role** 로 본다.
      --      custom_role 이 살아 있으면 `_posting_role_key` 상 실제 역할 키는 바뀌지 않으므로
      --      "새 staffRole 을 그대로 roleIds 에 넣기"는 틀린다. 키에서 역산해야 한다.
      v_role_key_old := public._posting_role_key(v_wl.role::text, v_wl.custom_role);
      v_role_key_new := public._posting_role_key(v_final_role::text, v_final_custom_role);

      v_role_id_new := CASE
        WHEN v_role_key_new = 'other:'      THEN 'other'
        WHEN v_role_key_new LIKE 'other:%'  THEN substring(v_role_key_new FROM 7)
        ELSE v_role_key_new
      END;

      -- 6-2) assignments 의 `timeSlot` 은 **zod 가 널을 금지한다**
      --      (`application.schema.ts` assignmentInnerSchema: `timeSlot: z.string()`).
      --      JSON null 을 쓰면 지원서 레코드가 파싱 단계에서 통째로 증발한다(A2 사고 선례).
      --      미정은 `'미정'`(TBA_TIME_MARKER)으로 쓴다 — `_posting_slot_key` 상 NULL/''/'미정' 은
      --      모두 같은 슬롯 키로 접히고, `ScheduleConverter.parseTimeSlotToTimestamp` 도 null 로 접는다.
      v_slot_new := CASE
        WHEN v_final_time IS NULL OR btrim(v_final_time) = '' THEN '미정'
        ELSE v_final_time
      END;

      -- 6-3) 매칭. 표류하지 않는 축만 쓴다: application_id(FK) + groupId + date + 역할 키.
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
        v_reason_sync := CASE WHEN v_match_cnt = 0 THEN 'no_match' ELSE 'ambiguous_match' END;
      ELSE
        -- 6-4) 재작성. 매칭된 원소만 셀 단위로 분해하고 나머지는 그대로 옮긴다.
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
        v_reason_sync := NULL;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- 편집은 살리고 동기화만 포기한다. 표류(현상 유지)가 편집 실패보다 싸다.
      RAISE WARNING '[update_work_log_slot] assignments sync failed for work_log % — %',
        p_work_log_id, SQLERRM;
      v_synced := false;
      v_reason_sync := 'sync_failed';
    END;
  END IF;

  RETURN jsonb_build_object(
    'success',              true,
    'workLogId',            p_work_log_id,
    'assignmentSynced',     v_synced,
    'assignmentSyncReason', v_reason_sync
  );
END;
$$;

COMMENT ON FUNCTION public.update_work_log_slot(uuid, jsonb) IS
  '근무 시간 편집 통합 쓰기 — 예정(time_slot)·실적(check_in_ts/check_out_ts)·역할·색상·메모를 '
  'work_logs 와 applications.assignments 에 한 트랜잭션으로 반영한다. '
  'jsonb 패치는 키 존재로 부분 갱신을 표현하고(GRID-1), 실적 키는 3상이다(키 없음=미변경 / '
  'JSON null=삭제 / 문자열=기록). 실적이 바뀔 때만 status 를 파생하고(no_show·cancelled 제외) '
  'modification_history 를 append 하며, 역할이 실제로 바뀔 때만 role_change_history 를 남기고 '
  '표준 역할 전환 시 custom_role 을 정리한다. 정산 완료건은 실적 수정만 거부한다. '
  '권한은 RLS wl_update 정확 재현(확대 0). 매칭이 모호하면 assignments 동기화만 건너뛴다.';

REVOKE ALL ON FUNCTION public.update_work_log_slot(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_work_log_slot(uuid, jsonb) TO authenticated;
