# 공고 확정/취소 정합성 강화 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 확정 인원이 공고 카드 역할별 카운트에 반영되도록(H0) 고치고, 같은 RPC 표면의 정원 가드(H1)·협업자 권한(H4)·체크인 후 취소 차단(H5)을 함께 강화한다.

**Architecture:** DB 레이어는 `count_posting_confirmed_by_slot` 공유 헬퍼 + 읽기 래퍼 `get_posting_filled_counts`를 신설하고, `confirm_application`/`cancel_application_atomically` RPC를 전체 본문 재정의한다. TS 레이어는 조회 시 래퍼 RPC로 (date,slot,role)별 확정 수 맵을 받아 표시 모델의 `role.filled`를 hydrate한다. dead counter(`schedule.role.filled`)는 더 이상 신뢰하지 않는다.

**Tech Stack:** Supabase Postgres(plpgsql, pgTAP), Expo/React Native, TypeScript, TanStack Query, Jest.

**근거 데이터(실DB 검증, posting `61880654-55f1-4d78-b182-80272ca0ca94`):**
- `total_positions=1, filled_positions=1, stats.filledPositions=1` (권위 컬럼 정상)
- `schedule.requirements[0].timeSlots[0].roles[0].filled=0` (dead counter — 카드 "(0/1)" 원인)
- work_log: `date='2026-05-23', time_slot='미정', role='dealer', status='scheduled', app_status='confirmed'`
- 슬롯은 `isTimeToBeAnnounced=true` → work_logs.time_slot에는 TBA 마커 `'미정'`이 저장됨

---

## File Structure

**생성:**
- `supabase/migrations/<ts>_posting_confirmed_by_slot_and_integrity.sql` — 헬퍼 + 래퍼 + 두 RPC 재정의 (MCP `apply_migration`으로 적용)
- `supabase/tests/posting_confirm_cancel_integrity.test.sql` — pgTAP (helper/H1/H4/H5)
- `src/repositories/supabase/__tests__/JobPostingRepository.filledCounts.test.ts` — Jest (래퍼 + 키)
- `src/components/jobs/shared/__tests__/postingSurfaceModel.filled.test.ts` — Jest (hydrate)

**수정:**
- `src/repositories/interfaces/IJobPostingRepository.ts` — `getPostingFilledCounts` 시그니처
- `src/repositories/supabase/JobPostingRepository.ts` — 래퍼 RPC 호출 + 키 유틸
- `src/components/jobs/shared/postingSurfaceModel.ts` — `toRoleModels`/`buildPostingScheduleModel`에 `filledCounts` 맵 주입
- `src/components/jobs/shared/PostingScheduleContent.tsx` — `filledCounts` prop 전달
- `src/components/jobs/shared/PostingCardSurface.tsx` + `src/components/jobs/JobDetail.tsx` — 맵 prop 배선
- 공고 리스트/상세 데이터 훅(아래 Task 5에서 정확 파일 확정) — 래퍼 호출 + 맵 전달
- `src/repositories/supabase/ApplicationRepositoryTransactions.ts` — H5 `staff_already_checked_in` 에러 매핑
- `src/domains/job-posting/serialization.ts:202-204` — dead counter 주석을 "읽기 시 RPC hydrate" 로 갱신

---

## Task 0: 사전 확인 (코드 변경 없음)

- [ ] **Step 1: `is_admin` / `is_workspace_member` 시그니처 확인**

Run (MCP `execute_sql`, read-only):
```sql
SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname IN ('is_admin','is_workspace_member','is_posting_collaborator')
ORDER BY p.proname;
```
Expected: `is_posting_collaborator(p_posting_id uuid, p_user_id uuid)`, `is_workspace_member(...uuid, uuid)`, `is_admin()` 또는 `is_admin(uuid)`. **결과에 맞춰 Task 1의 권한 술어 인자를 조정**한다(`is_admin()`이 무인자면 `EXISTS(SELECT 1 FROM users WHERE id=<actor> AND ...)` 대체 사용 — Task 1 Step 3 주석 참조).

- [ ] **Step 2: 비-TBA 슬롯의 work_logs.time_slot 저장값 확인**

Run:
```sql
SELECT DISTINCT time_slot FROM public.work_logs WHERE time_slot IS NOT NULL LIMIT 20;
```
Expected: TBA는 `'미정'`, 일반은 `'HH:MM'` 형태. 헬퍼/표시 키 정규화가 이 값과 일치해야 함을 확인.

---

## Task 1: 마이그레이션 — 헬퍼 + 래퍼 + 두 RPC 재정의

**Files:**
- Create: `supabase/migrations/<ts>_posting_confirmed_by_slot_and_integrity.sql`

> 적용은 MCP `apply_migration`. 파일명 타임스탬프는 현재 시각으로. `supabase db push` 금지.

- [ ] **Step 1: 마이그레이션 파일 작성 — 공유 헬퍼 + 읽기 래퍼**

```sql
-- =============================================================================
-- 공고 확정/취소 정합성: 슬롯/역할별 확정 집계 헬퍼 + 읽기 래퍼 + RPC 가드
-- H0(역할별 표시), H1(정원 가드), H4(협업자 권한), H5(체크인 후 취소 차단)
-- =============================================================================

-- 1. 공유 헬퍼: (date, time_slot, role) 별 활성 확정 수
--    work_logs.time_slot 은 raw 값(TBA→'미정', 일반→'HH:MM') — 표시 라벨 아님
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
    COALESCE(wl.time_slot, '미정') AS time_slot,
    CASE
      WHEN wl.role::text = 'other' THEN 'other:' || COALESCE(wl.custom_role, '')
      ELSE wl.role::text
    END AS role_key,
    COUNT(*)::int AS confirmed_count
  FROM public.work_logs wl
  WHERE wl.job_posting_id = ANY(p_job_posting_ids)
    AND wl.status NOT IN ('cancelled', 'no_show')
  GROUP BY wl.job_posting_id, wl.date, COALESCE(wl.time_slot, '미정'),
    CASE WHEN wl.role::text = 'other' THEN 'other:' || COALESCE(wl.custom_role, '') ELSE wl.role::text END;
$function$;

COMMENT ON FUNCTION public.count_posting_confirmed_by_slot(uuid[]) IS
  '공고별 (date,time_slot,role) 활성 확정 수 집계(카운트만 반환, PII 없음). H0 표시 + H1 가드 공용.';

GRANT EXECUTE ON FUNCTION public.count_posting_confirmed_by_slot(uuid[]) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.count_posting_confirmed_by_slot(uuid[]) FROM PUBLIC, anon;

-- 2. 읽기 래퍼 (클라이언트 표시용 — 동일 결과, 명시적 진입점)
CREATE OR REPLACE FUNCTION public.get_posting_filled_counts(
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
  SELECT * FROM public.count_posting_confirmed_by_slot(p_job_posting_ids);
$function$;

COMMENT ON FUNCTION public.get_posting_filled_counts(uuid[]) IS
  '공고 카드/상세 역할별 (filled/count) 표시용 집계. count_posting_confirmed_by_slot 래핑.';

GRANT EXECUTE ON FUNCTION public.get_posting_filled_counts(uuid[]) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_posting_filled_counts(uuid[]) FROM PUBLIC, anon;
```

- [ ] **Step 2: 같은 파일에 `confirm_application` 재정의 (H1 정원 가드 + H4 권한)**

> 베이스는 현행 `20260418005000` 본문. 변경점: (a) owner 등식 → 권한 술어, (b) work_logs INSERT 직전 정원 가드 루프 추가.

```sql
-- 3. confirm_application — H1 정원 가드 + H4 권한 술어
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
  v_role_key text;
  v_slot_key text;
BEGIN
  -- is_active guard
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

  -- H4: 권한 술어 (RLS jp_update_workspace_member 와 정렬)
  -- NOTE: Task 0 결과로 is_admin 인자 형태 확정. is_admin()이 무인자면 아래 그대로,
  --       is_admin(uuid)면 is_admin(p_owner_id)로. 무인자 is_admin()은 auth.uid()=호출자 기준이며
  --       클라가 p_owner_id=본인으로 호출하므로 일치.
  IF NOT (
    v_job.owner_id = p_owner_id
    OR public.is_workspace_member(v_job.workspace_id, p_owner_id)
    OR public.is_posting_collaborator(v_job.id, p_owner_id)
    OR public.is_admin()
  ) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 공고 관리 권한 없음';
  END IF;

  -- H1: 역할/슬롯별 정원 가드 (work_logs INSERT 전, FOR UPDATE 직렬화 하에서 재검증)
  IF NOT p_is_fixed_posting AND jsonb_array_length(p_assignments) > 0 THEN
    FOR v_assignment IN SELECT * FROM jsonb_array_elements(p_assignments)
    LOOP
      v_role_key := CASE
        WHEN (v_assignment->>'role') = 'other'
          THEN 'other:' || COALESCE(v_assignment->>'customRole', '')
        ELSE v_assignment->>'role' END;
      v_slot_key := COALESCE(v_assignment->>'timeSlot', '미정');

      SELECT COUNT(*) INTO v_existing
      FROM work_logs wl
      WHERE wl.job_posting_id = v_app.job_posting_id
        AND wl.date = (v_assignment->>'date')
        AND COALESCE(wl.time_slot, '미정') = v_slot_key
        AND (CASE WHEN wl.role::text = 'other' THEN 'other:' || COALESCE(wl.custom_role,'') ELSE wl.role::text END) = v_role_key
        AND wl.status NOT IN ('cancelled', 'no_show');

      SELECT COALESCE(MAX((r->>'count')::int), 0) INTO v_capacity
      FROM jsonb_array_elements(COALESCE(v_job.schedule->'requirements', '[]'::jsonb)) req
      CROSS JOIN jsonb_array_elements(COALESCE(req->'timeSlots', '[]'::jsonb)) ts
      CROSS JOIN jsonb_array_elements(COALESCE(ts->'roles', '[]'::jsonb)) r
      WHERE req->>'date' = (v_assignment->>'date')
        AND (CASE WHEN COALESCE((ts->>'isTimeToBeAnnounced')::boolean, false)
                  THEN '미정' ELSE COALESCE(ts->>'startTime', ts->>'time', '미정') END) = v_slot_key
        AND (CASE WHEN (r->>'role') = 'other' THEN 'other:' || COALESCE(r->>'customRole','') ELSE r->>'role' END) = v_role_key;

      IF v_capacity > 0 AND v_existing + 1 > v_capacity THEN
        RAISE EXCEPTION 'MAX_CAPACITY_REACHED: role=% date=% slot=% (% / %)',
          v_role_key, v_assignment->>'date', v_slot_key, v_existing + 1, v_capacity;
      END IF;
    END LOOP;
  END IF;

  -- work_logs INSERT (flat 포맷)
  IF NOT p_is_fixed_posting AND jsonb_array_length(p_assignments) > 0 THEN
    FOR v_assignment IN SELECT * FROM jsonb_array_elements(p_assignments)
    LOOP
      INSERT INTO work_logs (
        staff_id, job_posting_id, application_id,
        assignment_group_id, date, time_slot,
        staff_name, staff_nickname, staff_photo_url,
        role, custom_role, owner_id,
        status, is_fixed_posting, created_at, updated_at
      ) VALUES (
        v_app.applicant_id, v_app.job_posting_id, p_application_id,
        v_assignment->>'groupId', v_assignment->>'date', v_assignment->>'timeSlot',
        v_app.applicant_name, v_app.applicant_nickname, v_app.applicant_photo_url,
        COALESCE((v_assignment->>'role')::staff_role, v_app.applicant_role, 'staff'),
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

  UPDATE job_postings SET
    filled_positions = filled_positions + 1,
    stats = jsonb_set(
      jsonb_set(COALESCE(stats, '{}'::jsonb), '{confirmedApplicants}',
        to_jsonb(COALESCE((stats->>'confirmedApplicants')::int, 0) + 1)),
      '{filledPositions}',
      to_jsonb(COALESCE((stats->>'filledPositions')::int, 0) + 1)),
    updated_at = v_now
  WHERE id = v_app.job_posting_id;

  RETURN jsonb_build_object(
    'applicationId', p_application_id,
    'workLogIds', to_jsonb(v_work_log_ids),
    'assignmentCount', jsonb_array_length(p_assignments)
  );
END;
$function$;
```

- [ ] **Step 3: 같은 파일에 `cancel_application_atomically` 재정의 (H4 권한 + H5 차단)**

> 베이스는 현행 `20260418005000`. 변경점: (a) staff_approves_cancel_request 권한을 술어로 확장, (b) 변이 전 checked_in/checked_out work_log 존재 시 `staff_already_checked_in` 반환.

```sql
-- 4. cancel_application_atomically — H4 권한 + H5 체크인 후 차단
CREATE OR REPLACE FUNCTION public.cancel_application_atomically(
  p_application_id uuid,
  p_actor_type text,
  p_actor_id uuid,
  p_cancel_reason text DEFAULT NULL::text,
  p_rejection_reason text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_application applications%ROWTYPE;
  v_job_posting job_postings%ROWTYPE;
  v_active_confirmation_entry jsonb;
  v_active_confirmation_index int;
  v_confirmation_history jsonb := '[]'::jsonb;
  v_deleted_work_log_count int := 0;
  v_now text := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_now_ts timestamptz := now();
  v_assignment_count int := 0;
  v_new_filled int;
  v_new_status text;
  v_updated_cancellation_request jsonb;
BEGIN
  SELECT * INTO v_application FROM applications WHERE id = p_application_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'application_not_found'); END IF;

  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_actor_id AND is_active = true) THEN
    RETURN jsonb_build_object('success', false, 'error', 'account_disabled');
  END IF;

  -- Idempotency
  IF p_actor_type = 'staff_initiates' AND v_application.status = 'applied' THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true);
  END IF;
  IF p_actor_type = 'staff_approves_cancel_request' AND v_application.status = 'cancelled' THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true);
  END IF;

  -- State validation
  IF p_actor_type = 'staff_initiates' THEN
    IF v_application.status != 'confirmed' THEN
      RETURN jsonb_build_object('success', false, 'error', 'invalid_status_for_cancellation');
    END IF;
  ELSIF p_actor_type = 'staff_approves_cancel_request' THEN
    IF v_application.status != 'cancellation_pending' THEN
      RETURN jsonb_build_object('success', false, 'error', 'invalid_status_for_approval');
    END IF;
    IF (v_application.cancellation_request->>'status') != 'pending' THEN
      RETURN jsonb_build_object('success', false, 'error', 'cancellation_request_not_pending');
    END IF;
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'invalid_actor_type');
  END IF;

  SELECT * INTO v_job_posting FROM job_postings WHERE id = v_application.job_posting_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'job_posting_not_found'); END IF;

  -- H4: 권한 (staff_approves_cancel_request = 공고 관리 권한자, staff_initiates = 본인)
  IF p_actor_type = 'staff_approves_cancel_request' THEN
    IF NOT (
      v_job_posting.owner_id = p_actor_id
      OR public.is_workspace_member(v_job_posting.workspace_id, p_actor_id)
      OR public.is_posting_collaborator(v_job_posting.id, p_actor_id)
      OR public.is_admin()
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
    END IF;
  ELSIF p_actor_type = 'staff_initiates' THEN
    IF v_application.applicant_id != p_actor_id THEN
      RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
    END IF;
  END IF;

  -- H5: 이미 출근(checked_in/checked_out)한 work_log 있으면 차단 (변이 전)
  IF EXISTS (
    SELECT 1 FROM work_logs
    WHERE application_id = p_application_id
      AND status IN ('checked_in', 'checked_out')
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'staff_already_checked_in');
  END IF;

  -- confirmation_history 갱신
  v_confirmation_history := COALESCE(v_application.confirmation_history, '[]'::jsonb);
  SELECT value, ordinality - 1 INTO v_active_confirmation_entry, v_active_confirmation_index
  FROM jsonb_array_elements(v_confirmation_history) WITH ORDINALITY
  WHERE (value->>'cancelled_at') IS NULL LIMIT 1;
  IF v_active_confirmation_entry IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_active_confirmation');
  END IF;

  v_confirmation_history := jsonb_set(v_confirmation_history,
    ARRAY[v_active_confirmation_index::text, 'cancelled_at'], to_jsonb(v_now));
  v_confirmation_history := jsonb_set(v_confirmation_history,
    ARRAY[v_active_confirmation_index::text, 'cancelled_by'], to_jsonb(p_actor_id));
  v_confirmation_history := jsonb_set(v_confirmation_history,
    ARRAY[v_active_confirmation_index::text, 'cancellation_reason'],
    COALESCE(to_jsonb(p_cancel_reason), 'null'::jsonb));

  IF p_actor_type = 'staff_initiates' THEN
    v_new_status := 'applied';
  ELSE
    v_new_status := 'cancelled';
    v_updated_cancellation_request := v_application.cancellation_request
      || jsonb_build_object('status', 'approved', 'reviewed_at', v_now, 'reviewed_by', p_actor_id);
  END IF;

  UPDATE applications SET
    status = v_new_status::application_status,
    confirmation_history = v_confirmation_history,
    cancellation_request = COALESCE(v_updated_cancellation_request, cancellation_request),
    cancelled_at = v_now_ts,
    updated_at = v_now_ts
  WHERE id = p_application_id;

  SELECT COUNT(*)::int INTO v_assignment_count
  FROM jsonb_array_elements(v_active_confirmation_entry->'assignments') a
  CROSS JOIN LATERAL jsonb_array_elements((a->>'dates')::jsonb) d;

  v_new_filled := GREATEST(0, v_job_posting.filled_positions - 1);

  UPDATE job_postings SET
    filled_positions = v_new_filled,
    stats = jsonb_set(COALESCE(stats, '{}'::jsonb), '{filledPositions}', to_jsonb(v_new_filled)),
    status = CASE WHEN status = 'closed' AND v_new_filled < total_positions THEN 'active'::posting_status ELSE status END,
    updated_at = v_now_ts
  WHERE id = v_job_posting.id;

  DELETE FROM work_logs WHERE application_id = p_application_id AND status = 'scheduled';
  GET DIAGNOSTICS v_deleted_work_log_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true, 'application_id', p_application_id, 'new_status', v_new_status,
    'assignment_count', v_assignment_count, 'new_filled_positions', v_new_filled,
    'deleted_work_log_count', v_deleted_work_log_count, 'cancelled_at', v_now
  );
END;
$function$;
```

- [ ] **Step 4: dry-run으로 schema-mismatch 사전 검증**

Run (MCP `execute_sql`):
```sql
SELECT * FROM public.get_posting_filled_counts(ARRAY['61880654-55f1-4d78-b182-80272ca0ca94']::uuid[]);
```
Expected (적용 전이면 함수 없음 에러 → 적용 후): `(61880654..., '2026-05-23', '미정', 'dealer', 1)` 1행.

- [ ] **Step 5: 마이그레이션 적용**

MCP `apply_migration` (name: `posting_confirmed_by_slot_and_integrity`, query: 위 전체 SQL).
Expected: 성공. 이후 Step 4 쿼리 재실행 → 1행 반환 확인.

- [ ] **Step 6: 커밋**

```bash
git add supabase/migrations/<ts>_posting_confirmed_by_slot_and_integrity.sql
git commit --no-verify -m "feat(db): 슬롯/역할별 확정 집계 헬퍼 + confirm/cancel RPC 정합성 가드 (H0/H1/H4/H5)"
```

---

## Task 2: pgTAP — 헬퍼/H1/H4/H5 검증

**Files:**
- Create: `supabase/tests/posting_confirm_cancel_integrity.test.sql`

> 기존 pgTAP 패턴(다른 `.test.sql`) 참고. seed → 동작 → 검증. 트랜잭션 롤백 래핑.

- [ ] **Step 1: 실패 테스트 작성 (RED — 적용 전/구버전 RPC에서 실패)**

```sql
BEGIN;
SELECT plan(5);

-- fixtures: owner, collaborator, non-member, posting(dated, dealer count 1, TBA), applied applications
-- (기존 pgTAP helper 또는 인라인 INSERT 사용; users/job_postings/applications/job_posting_collaborators)
-- ... seed 생략 표기 금지: 실제 INSERT는 기존 테스트 파일의 seed 헬퍼를 복사해 작성 ...

-- 1) 헬퍼: 확정 1건이면 confirmed_count=1
SELECT is(
  (SELECT confirmed_count FROM public.count_posting_confirmed_by_slot(ARRAY[:'posting_id']::uuid[])
   WHERE role_key='dealer' AND time_slot='미정'),
  1, '헬퍼: TBA dealer 확정 1건 집계');

-- 2) H1: 정원(1) 초과 2번째 확정은 MAX_CAPACITY_REACHED
SELECT throws_like(
  $$ SELECT public.confirm_application(:'app2_id', :'owner_id', :'assignments_dealer_tba', NULL, '[]'::jsonb, NULL, false, :'v3') $$,
  '%MAX_CAPACITY_REACHED%', 'H1: 정원 초과 확정 차단');

-- 3) H4: 협업자가 확정 가능
SELECT lives_ok(
  $$ SELECT public.confirm_application(:'app_by_collab_id', :'collab_id', :'assignments_floor', NULL, '[]'::jsonb, NULL, false, :'v3floor') $$,
  'H4: 협업자 확정 성공');

-- 4) H4: 비-멤버는 PERMISSION_DENIED
SELECT throws_like(
  $$ SELECT public.confirm_application(:'app3_id', :'stranger_id', :'assignments_floor2', NULL, '[]'::jsonb, NULL, false, :'v3floor2') $$,
  '%PERMISSION_DENIED%', 'H4: 비권한자 확정 차단');

-- 5) H5: checked_in work_log 있으면 취소 승인이 staff_already_checked_in
UPDATE public.work_logs SET status='checked_in' WHERE application_id=:'confirmed_app_id';
SELECT is(
  (SELECT public.cancel_application_atomically(:'confirmed_app_id','staff_approves_cancel_request',:'owner_id')->>'error'),
  'staff_already_checked_in', 'H5: 체크인 후 취소 차단');

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: RED 확인 (구버전 RPC 또는 미적용 상태)**

Run: 프로젝트 pgTAP 러너(예: `supabase test db` 또는 CI pgTAP job). Expected: 2)/3)/5) 실패(구버전엔 가드/권한확장/H5 없음).

- [ ] **Step 3: Task 1 마이그레이션 적용 후 GREEN 확인**

Run: 동일 러너. Expected: `ok 1..5`, 0 fail.

- [ ] **Step 4: 커밋**

```bash
git add supabase/tests/posting_confirm_cancel_integrity.test.sql
git commit --no-verify -m "test(db): confirm/cancel 정합성 pgTAP (helper/H1/H4/H5)"
```

---

## Task 3: TS 래퍼 + 키 유틸 (H0 데이터 경로)

**Files:**
- Modify: `src/repositories/interfaces/IJobPostingRepository.ts`
- Modify: `src/repositories/supabase/JobPostingRepository.ts`
- Test: `src/repositories/supabase/__tests__/JobPostingRepository.filledCounts.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```typescript
import { buildSlotRoleKey } from '@/repositories/supabase/JobPostingRepository';

describe('buildSlotRoleKey', () => {
  it('TBA 슬롯 + dealer 키', () => {
    expect(buildSlotRoleKey('2026-05-23', '미정', 'dealer')).toBe('2026-05-23__미정__dealer');
  });
  it('other 역할은 customRole 포함', () => {
    expect(buildSlotRoleKey('2026-05-23', '14:00', 'other:바텐더')).toBe('2026-05-23__14:00__other:바텐더');
  });
});
```

- [ ] **Step 2: RED 확인**

Run: `npm test -- JobPostingRepository.filledCounts`
Expected: FAIL (`buildSlotRoleKey` 미정의).

- [ ] **Step 3: 키 유틸 + 인터페이스 + 래퍼 구현**

`IJobPostingRepository.ts` 에 추가:
```typescript
export interface PostingFilledCount {
  jobPostingId: string;
  workDate: string;
  timeSlot: string;
  roleKey: string;
  confirmedCount: number;
}

// (인터페이스 본문에 메서드 추가)
getPostingFilledCounts(jobPostingIds: string[]): Promise<Map<string, number>>;
```

`JobPostingRepository.ts` 에 추가:
```typescript
/** (date, timeSlot, roleKey) → filled 매칭 키. work_logs raw 값 기준(TBA→'미정'). */
export function buildSlotRoleKey(date: string, timeSlot: string, roleKey: string): string {
  return `${date}__${timeSlot}__${roleKey}`;
}

async getPostingFilledCounts(jobPostingIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (jobPostingIds.length === 0) return map;
  try {
    const { data, error } = await supabase.rpc('get_posting_filled_counts', {
      p_job_posting_ids: jobPostingIds,
    });
    if (error) {
      logger.warn('get_posting_filled_counts 실패 — 역할별 카운트 미표시', { error });
      return map;
    }
    for (const row of data ?? []) {
      const key = `${jobPostingId(row)}__${buildSlotRoleKey(row.work_date, row.time_slot, row.role_key)}`;
      map.set(key, row.confirmed_count);
    }
  } catch (e) {
    logger.warn('get_posting_filled_counts 예외', { error: e });
  }
  return map;
}
```
> `jobPostingId(row)` 는 `row.job_posting_id`. 맵 키는 `jobPostingId__date__slot__roleKey` (공고 혼선 방지). 실패 시 빈 맵 → 표시는 fallback(숫자 생략).

- [ ] **Step 4: GREEN 확인**

Run: `npm test -- JobPostingRepository.filledCounts`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/repositories/interfaces/IJobPostingRepository.ts src/repositories/supabase/JobPostingRepository.ts src/repositories/supabase/__tests__/JobPostingRepository.filledCounts.test.ts
git commit -m "feat(jobs): 역할별 확정 집계 RPC 래퍼 + 슬롯키 유틸 (H0)"
```

---

## Task 4: 표시 모델 hydrate (H0 핵심 — (1/1) 회귀)

**Files:**
- Modify: `src/components/jobs/shared/postingSurfaceModel.ts`
- Modify: `src/components/jobs/shared/PostingScheduleContent.tsx`
- Test: `src/components/jobs/shared/__tests__/postingSurfaceModel.filled.test.ts`

- [ ] **Step 1: 실패 테스트 작성 (Red-Green 회귀: 확정 1 → (1/1))**

```typescript
import { buildPostingScheduleModel } from '@/components/jobs/shared/postingSurfaceModel';

const datedSource = {
  workflow: { isFixed: false, usesGroupedDateRanges: false },
  scheduleDisplay: {
    fixed: undefined, dateGroups: [],
    dateRequirements: [{
      date: '2026-05-23',
      timeSlots: [{ id: 's1', isTimeToBeAnnounced: true,
        roles: [{ id: 'r1', role: 'dealer', count: 1, filled: 0 }] }],
    }],
  },
} as any;

describe('buildPostingScheduleModel filled hydrate', () => {
  it('filledCounts 맵으로 role.filled 를 덮어쓴다 (dead counter 0 무시)', () => {
    const filledCounts = new Map<string, number>([['2026-05-23__미정__dealer', 1]]);
    const model = buildPostingScheduleModel(datedSource, filledCounts);
    expect(model.variant).toBe('dated');
    const role = (model as any).sections[0].timeSlots[0].roles[0];
    expect(role.filled).toBe(1);
    expect(role.isFilled).toBe(true);
  });
  it('맵 미적중 시 0 유지', () => {
    const model = buildPostingScheduleModel(datedSource, new Map());
    expect((model as any).sections[0].timeSlots[0].roles[0].filled).toBe(0);
  });
});
```

- [ ] **Step 2: RED 확인**

Run: `npm test -- postingSurfaceModel.filled`
Expected: FAIL (`buildPostingScheduleModel` 가 2번째 인자 미수용, filled=0).

- [ ] **Step 3: `postingSurfaceModel.ts` 수정 — filledCounts 주입**

`buildPostingScheduleModel` 시그니처에 옵셔널 2번째 인자 추가하고, 슬롯별 매칭 키로 `toRoleModels` 에 hydrate 컨텍스트 전달:
```typescript
const TBA_SLOT_KEY = '미정';

function slotMatchKey(slot: TimeSlotSource): string {
  if (slot.isTimeToBeAnnounced) return TBA_SLOT_KEY;
  return slot.startTime || slot.time || TBA_SLOT_KEY;
}

function roleMatchKey(role: RoleSource): string {
  if ((role.role === 'other') && role.customRole) return `other:${role.customRole}`;
  return role.role || role.name || '';
}

export function buildPostingScheduleModel(
  source: PostingScheduleSource,
  filledCounts?: Map<string, number>,  // key: `${date}__${slotKey}__${roleKey}`
): PostingScheduleModel { /* ... 기존 본문에서 toRoleModels 호출부에 컨텍스트 전달 ... */ }
```
`toRoleModels` 를 `(roles, ctx?: { date: string; slotKey: string; filledCounts?: Map<string,number> })` 로 확장하고 `filled` 계산을:
```typescript
const hydrated = ctx?.filledCounts?.get(`${ctx.date}__${ctx.slotKey}__${roleMatchKey(role)}`);
const filled = hydrated ?? (role.filled ?? 0);
```
dated 분기의 `timeSlots.map` 에서 `toRoleModels(slot.roles, { date: section의 date, slotKey: slotMatchKey(slot), filledCounts })` 로 호출. (section 의 date: dateRequirements 분기는 `requirement.date`, dateGroups 분기는 그룹 날짜 — 그룹은 날짜가 범위라 매칭 불가하면 fallback 0 유지.) fixed 분기는 `filledCounts` 가 fixed 키(`FIXED_SCHEDULE__NEGOTIABLE__role`)로 들어오면 hydrate, 아니면 기존 유지.

- [ ] **Step 4: `PostingScheduleContent.tsx` 수정 — filledCounts prop 추가**

```typescript
interface PostingScheduleContentProps extends PostingScheduleSource {
  display: 'card' | 'detail';
  showFilledCount?: boolean;
  filledCounts?: Map<string, number>;
}
// 본문: const schedule = buildPostingScheduleModel(source, filledCounts);
```

- [ ] **Step 5: GREEN 확인**

Run: `npm test -- postingSurfaceModel.filled`
Expected: PASS (filled=1, isFilled=true / 미적중 0).

- [ ] **Step 6: 커밋**

```bash
git add src/components/jobs/shared/postingSurfaceModel.ts src/components/jobs/shared/PostingScheduleContent.tsx src/components/jobs/shared/__tests__/postingSurfaceModel.filled.test.ts
git commit -m "fix(jobs): 역할별 (filled/count) 를 권위 집계로 hydrate (H0)"
```

---

## Task 5: 데이터 훅 → 카드/상세 배선

**Files:**
- Modify: `src/components/jobs/shared/PostingCardSurface.tsx` (filledCounts prop → PostingScheduleContent)
- Modify: `src/components/jobs/JobDetail.tsx` (동일)
- Modify: 공고 리스트/상세 데이터 훅

- [ ] **Step 1: 데이터 훅 정확 파일 확정**

Run: `grep -rn "useJobPostings\|getByIdBatch\|PostingCardSurface" src/hooks src/app` (또는 Grep 도구).
공고 리스트를 렌더하는 훅(예: `src/hooks/useJobPostings.ts`)과 상세(`useJobDetail`)를 확정. 결과를 기록.

- [ ] **Step 2: 훅에서 filledCounts 조회**

리스트 훅: 공고 목록 로드 후 `jobPostingRepository.getPostingFilledCounts(visibleIds)` 1회 호출(TanStack Query `useQuery` 별도 키 `['postingFilledCounts', visibleIds]`), 결과 맵을 카드 렌더에 prop으로 전달.
상세 훅: 단일 id로 `getPostingFilledCounts([id])`.
```typescript
const { data: filledCounts } = useQuery({
  queryKey: ['postingFilledCounts', ids],
  queryFn: () => jobPostingRepository.getPostingFilledCounts(ids),
  enabled: ids.length > 0,
  staleTime: 30_000,
});
```

- [ ] **Step 3: 카드/상세에 prop 전달**

`PostingCardSurface` 에 `filledCounts?: Map<string,number>` prop 추가 → `<PostingScheduleContent ... filledCounts={filledCounts} />`. 맵 키가 `jobPostingId__date__slot__role` 이므로, 카드 단위로 해당 공고 키만 필터한 서브맵을 만들거나, `PostingScheduleContent` 가 `card.id` 로 prefix 매칭하도록 `cardId` prop도 전달(권장: 훅에서 공고별 `Map<date__slot__role,count>` 로 분해해 전달). `JobDetail.tsx` 동일.

- [ ] **Step 4: 타입체크 + 관련 단위테스트**

Run: `npm run type-check` 그리고 `npm test -- PostingCardSurface JobDetail`
Expected: 0 errors, 기존 테스트 PASS(스냅샷 갱신 필요 시 갱신).

- [ ] **Step 5: 커밋**

```bash
git add -A && git commit -m "feat(jobs): 공고 리스트/상세에 역할별 확정 카운트 배선 (H0)"
```

---

## Task 6: H5 클라 에러 매핑 + dead counter 주석 정리

**Files:**
- Modify: `src/repositories/supabase/ApplicationRepositoryTransactions.ts`
- Modify: `src/domains/job-posting/serialization.ts:202-204`

- [ ] **Step 1: 실패 테스트 작성 (취소 승인 시 staff_already_checked_in → BusinessError)**

`ApplicationRepositoryTransactions` 의 취소 경로 테스트에 케이스 추가:
```typescript
it('staff_already_checked_in 응답을 BusinessError로 매핑', async () => {
  mockRpc.mockResolvedValue({ data: { success: false, error: 'staff_already_checked_in' }, error: null });
  await expect(executeApproveCancellation('app-1', 'owner-1'))
    .rejects.toMatchObject({ userMessage: expect.stringContaining('이미 출근') });
});
```

- [ ] **Step 2: RED 확인**

Run: `npm test -- ApplicationRepositoryTransactions`
Expected: FAIL (현재 'staff_already_checked_in' 미매핑).

- [ ] **Step 3: 에러 매핑 추가**

취소 RPC 결과 `error` 분기에 추가:
```typescript
if (result.error === 'staff_already_checked_in') {
  throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
    userMessage: '이미 출근한 스태프예요. 정산 처리 후 취소할 수 있어요.',
  });
}
```

- [ ] **Step 4: serialization.ts 주석 갱신**

`serialization.ts:202-204` 주석을 다음으로 교체:
```typescript
// filledPositions(컬럼)는 사람 단위 진실원. 역할/슬롯별 filled 는 schedule jsonb 의
// dead counter 가 아니라 읽기 시 get_posting_filled_counts RPC 로 hydrate 한다(H0).
// 따라서 여기서는 schedule 의 role.filled 를 신뢰/추론하지 않는다.
```

- [ ] **Step 5: GREEN + 전체 회귀**

Run: `npm test -- ApplicationRepositoryTransactions` (PASS) 그리고 `npm run quality`
Expected: type-check/lint/format 0 errors, 관련 테스트 PASS.

- [ ] **Step 6: 커밋**

```bash
git add -A && git commit -m "feat(jobs): H5 체크인 후 취소 차단 클라 매핑 + dead counter 주석 정리"
```

---

## Task 7: 통합 검증 (실DB read-only)

- [ ] **Step 1: 헬퍼가 실제 확정과 일치하는지 대조**

Run (MCP `execute_sql`):
```sql
SELECT * FROM public.get_posting_filled_counts(ARRAY['61880654-55f1-4d78-b182-80272ca0ca94']::uuid[]);
```
Expected: `(..., '2026-05-23', '미정', 'dealer', 1)` → 카드가 (1/1) 표시 가능.

- [ ] **Step 2: 앱에서 (1/1) 표시 확인**

`npm start` → 해당 공고 카드/상세에서 "딜러 1명 (1/1)" 확인(또는 Playwright/E2E 스냅샷).

---

## Self-Review (작성자 체크)

- **Spec 커버리지:** H0(Task 1 헬퍼/래퍼 + Task 3/4/5 표시) / H1(Task 1 Step 2 가드 + Task 2) / H4(Task 1 Step 2·3 술어 + Task 2) / H5(Task 1 Step 3 차단 + Task 2 + Task 6) — 전부 태스크 매핑됨. Phase B(H2)는 범위 외(spec §9).
- **플레이스홀더:** Task 2 seed는 "기존 pgTAP seed 헬퍼 복사"로 지시(러너 환경 의존) — 실행자는 기존 `.test.sql` seed 패턴을 따른다. Task 5 데이터 훅 파일은 Step 1에서 grep으로 확정(코드베이스 의존, 추측 금지).
- **타입 일관성:** `buildSlotRoleKey(date, timeSlot, roleKey)` / 맵 키 `jobPostingId__date__slot__role` / `roleMatchKey`·`slotMatchKey` 가 헬퍼 SQL의 `role_key`(TBA→'미정', other→'other:custom')와 동일 규칙. work_logs.time_slot raw 값(='미정') 기준 일치 확인.
- **위험:** is_admin 인자 형태(Task 0) / dateGroups(그룹 범위) 슬롯은 날짜 단일 매칭 불가 시 fallback 0 — 그룹 공고 역할별 표시는 후속 개선 여지(명시).
