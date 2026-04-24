# work_logs timestamptz Phase D — jsonb DROP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `work_logs.check_in_time` / `check_out_time` (jsonb) 컬럼을 안전하게 DROP 하고, 모든 앱 + DB 경로를 `check_in_ts` / `check_out_ts` (timestamptz) 단일 포맷으로 정리.

**Architecture:** 3 단계로 나눠 비파괴 작업 먼저, 최종 DROP 단계에서만 사용자 명시 확인 후 실행. 단계별 독립 커밋으로 언제든 중단/롤백 가능. Supabase MCP `apply_migration` 로 DB 변경, `generate_typescript_types` 로 타입 재생성. 도메인 타입(`WorkLog.checkInTime`)은 유지하고 mapper 만 단순화.

**Tech Stack:** Supabase PostgreSQL (timestamptz, triggers, plpgsql), Supabase MCP, TypeScript strict, Zod 4.x, Jest.

---

## 전제

- **Phase A + C 완료** (2026-04-21 master):
  - `check_in_ts timestamptz`, `check_out_ts timestamptz` 컬럼 존재 + backfill 완료
  - `tr_sync_work_log_ts` sync trigger 동작 중 (jsonb → ts)
  - `process_qr_checkin_atomically` RPC dual-write 상태
  - `TABLE_COLUMNS` 가 `check_in_ts, check_out_ts` 포함 + `applyTsPreference` 매퍼 우선 사용
- **DB 의존성 조사 완료** (`pg_proc` 쿼리):
  - `fn_sync_work_log_ts` (Phase A trigger — Phase D 에서 DROP)
  - `process_qr_checkin_atomically` (Phase C dual-write — Phase D.1 에서 ts-only)
  - `notify_on_work_log_checkinout_update` (work_logs UPDATE trigger — null→non-null 감지용)
  - `_fmt_worklog_time(jsonb)` (notify 내에서 호출)
  - `fn_send_review_reminders` (cron — 퇴근 5일 후 리뷰 리마인더)

## 범위 결정

- **컬럼 이름 유지**: `check_in_ts` / `check_out_ts` 그대로 (RENAME TO `check_in_time` 안 함). rename 은 앱 전역 파급이 커서 별도 거대 작업. Phase D 는 "jsonb 제거" 까지만.
- **도메인 타입 유지**: `WorkLog.checkInTime`, `workLog.checkOutTime` 그대로. mapper 가 `checkInTs` → `checkInTime` 으로 변환 유지.
- **RPC 응답 payload 유지**: `process_qr_checkin_atomically` 의 JSON 응답은 `check_in_time` 키 유지 (클라이언트 계약 안정화).

## File Structure

**수정 파일 (7):**
- `uniqn-mobile/src/repositories/supabase/WorkLogRepositoryHelpers.ts` — TABLE_COLUMNS 에서 jsonb 컬럼 제거, `applyTsPreference` fallback 제거
- `uniqn-mobile/src/repositories/supabase/WorkLogRepositoryTransactions.ts` — writer `check_in_time`/`check_out_time` → `check_in_ts`/`check_out_ts`
- `uniqn-mobile/src/repositories/supabase/SettlementRepository.ts` — writer 전환
- `uniqn-mobile/src/repositories/supabase/ConfirmedStaffRepository.ts` — writer 전환
- `uniqn-mobile/src/repositories/supabase/ApplicationRepositoryTransactions.ts` — null init `check_in_ts: null, check_out_ts: null`
- `uniqn-mobile/src/repositories/supabase/UserRepository.ts` — select + row 매핑 ts 로 단순화
- `uniqn-mobile/src/types/supabase.ts` + `uniqn-mobile/src/lib/database.types.ts` — MCP `generate_typescript_types` 로 regenerate

**신규 migration (3):**
- `20260421190000_worklog_ts_phase_d_1_db_functions_to_ts.sql` — `_fmt_worklog_time(timestamptz)` 신규 + `notify_on_work_log_checkinout_update` / `fn_send_review_reminders` / `process_qr_checkin_atomically` ts 기반으로 refactor
- `20260421190500_worklog_ts_phase_d_2_stage_codebase_cleanup.sql` — no-op SQL (코드 변경 전용 단계, migration 파일 생략 가능. 본 플랜은 이 단계를 코드 커밋만으로 진행)
- `20260421200000_worklog_ts_phase_d_3_drop_jsonb_columns.sql` — **DESTRUCTIVE**. 사용자 명시 확인 후 apply.

**검증 파일:**
- `uniqn-mobile/src/repositories/supabase/__tests__/qrCheckinAtomic.test.ts` — RPC 응답 호환 유지 확인
- `uniqn-mobile/src/repositories/supabase/__tests__/confirmCreatesWorkLog.test.ts` — 생성 경로 회귀

**건드리지 않는 파일:**
- 도메인 / 서비스 레이어 (ScheduleConverter, SettlementCalculator 등) — `workLog.checkInTime` 소비만 하므로 변경 불필요.

---

## Task 1: DB 함수 refactor (비파괴) — notify + review reminder + RPC 를 ts 기반으로

**Files:**
- Create: `uniqn-mobile/supabase/migrations/20260421190000_worklog_ts_phase_d_1_db_functions_to_ts.sql`

- [ ] **Step 1: migration 파일 작성**

아래 전체 내용을 해당 경로에 작성. 3 가지 함수를 한 migration 에 묶음 (원자적 적용).

```sql
-- work_logs timestamptz 전환 Phase D.1 (비파괴)
-- 목표: jsonb 컬럼에 의존하는 DB 함수를 timestamptz 기반으로 refactor
--       최종 DROP COLUMN 직전까지 dual-state (컬럼은 남아 있지만 함수는 ts 만 사용)
-- 참조: .gstack/qa-reports/REFACTOR-5.md Phase D

-- 1. _fmt_worklog_time 을 timestamptz 오버로드로 재정의
CREATE OR REPLACE FUNCTION public._fmt_worklog_time(p_ts timestamptz)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = 'public'
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

COMMENT ON FUNCTION public._fmt_worklog_time(timestamptz) IS
  'work_logs.check_in_ts 등 timestamptz 를 Asia/Seoul HH:MM 으로 포맷. NULL → NULL.';

-- 2. notify_on_work_log_checkinout_update 를 check_in_ts/check_out_ts 로 전환
CREATE OR REPLACE FUNCTION public.notify_on_work_log_checkinout_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
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

  -- 공통 조회 (기존 로직 유지)
  SELECT full_name INTO v_staff_name FROM public.user_profiles WHERE id = NEW.staff_id;

  SELECT jp.owner_id, jp.title, jp.id
    INTO v_employer_id, v_job_title, v_job_posting_id
  FROM public.job_postings jp
  WHERE jp.id = NEW.job_posting_id;

  v_base_data := jsonb_build_object(
    'workLogId', NEW.id,
    'staffId', NEW.staff_id,
    'staffName', COALESCE(v_staff_name, '스태프'),
    'jobPostingId', v_job_posting_id,
    'jobPostingTitle', COALESCE(v_job_title, '근무')
  );

  -- ============ 출근 ============
  IF v_did_check_in THEN
    v_check_in_display := public._fmt_worklog_time(NEW.check_in_ts);

    -- 스태프
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

    -- 구인자
    IF v_employer_id IS NOT NULL THEN
      INSERT INTO public.notifications (recipient_id, type, title, body, link, data, priority)
      VALUES (
        v_employer_id,
        'work_log_check_in',
        '✅ 스태프 출근',
        COALESCE(format('%s 님이 %s 에 출근했습니다. (%s)',
                       COALESCE(v_staff_name, '스태프'), v_job_title, v_check_in_display),
                 '스태프가 출근했습니다.'),
        format('/jobs/%s', v_job_posting_id),
        v_base_data || jsonb_build_object('checkInTime', NEW.check_in_ts),
        'normal'
      );
    END IF;
  END IF;

  -- ============ 퇴근 ============
  IF v_did_check_out THEN
    v_check_out_display := public._fmt_worklog_time(NEW.check_out_ts);

    -- 스태프: 퇴근
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

    -- 스태프: review_request
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

    -- 구인자: 퇴근
    IF v_employer_id IS NOT NULL THEN
      INSERT INTO public.notifications (recipient_id, type, title, body, link, data, priority)
      VALUES (
        v_employer_id,
        'work_log_check_out',
        '🏁 스태프 퇴근',
        COALESCE(format('%s 님이 %s 에 퇴근했습니다. (%s)',
                       COALESCE(v_staff_name, '스태프'), v_job_title, v_check_out_display),
                 '스태프가 퇴근했습니다.'),
        format('/jobs/%s', v_job_posting_id),
        v_base_data || jsonb_build_object('checkOutTime', NEW.check_out_ts),
        'normal'
      );

      -- 구인자: review_request
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

COMMENT ON FUNCTION public.notify_on_work_log_checkinout_update() IS
  'check_in_ts/check_out_ts 전환 시 스태프+구인자에게 알림 (Phase D.1 ts 전환).';

-- 3. work_logs UPDATE trigger 재연결 (컬럼을 바꿨으므로 UPDATE OF 도 변경)
DROP TRIGGER IF EXISTS tr_notify_work_log_checkinout ON public.work_logs;
CREATE TRIGGER tr_notify_work_log_checkinout
AFTER UPDATE OF check_in_ts, check_out_ts
ON public.work_logs
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_work_log_checkinout_update();

-- 4. fn_send_review_reminders 를 check_out_ts 기반으로 전환
CREATE OR REPLACE FUNCTION public.fn_send_review_reminders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions'
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

COMMENT ON FUNCTION public.fn_send_review_reminders() IS
  '퇴근 5일 후 미작성 리뷰 리마인더 발송 (Phase D.1 check_out_ts 기반).';

-- 5. process_qr_checkin_atomically 를 ts-only 로 전환 (jsonb 쓰기 제거)
CREATE OR REPLACE FUNCTION public.process_qr_checkin_atomically(
  p_work_log_id uuid,
  p_staff_id uuid,
  p_job_posting_id uuid,
  p_action text,
  p_check_time timestamptz DEFAULT now(),
  p_expected_date text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_work_log work_logs%ROWTYPE;
  v_job_posting_status text;
  v_now text := to_char(p_check_time AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_work_duration numeric := 0;
  v_duration_minutes numeric;
BEGIN
  SELECT * INTO v_work_log
  FROM work_logs
  WHERE id = p_work_log_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'work_log_not_found');
  END IF;

  SELECT status INTO v_job_posting_status
  FROM job_postings
  WHERE id = p_job_posting_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'job_posting_not_found');
  END IF;

  IF v_work_log.staff_id IS DISTINCT FROM p_staff_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'staff_id_mismatch');
  END IF;

  IF v_work_log.job_posting_id IS DISTINCT FROM p_job_posting_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'job_posting_id_mismatch');
  END IF;

  IF p_expected_date IS NOT NULL
     AND COALESCE(v_work_log.is_fixed_posting, false) = false
     AND v_work_log.date IS DISTINCT FROM p_expected_date THEN
    RETURN jsonb_build_object('success', false, 'error', 'date_mismatch');
  END IF;

  IF v_job_posting_status::text != 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'job_posting_inactive');
  END IF;

  IF v_work_log.payroll_status::text = 'completed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_settled');
  END IF;

  IF p_action = 'checkIn' THEN
    IF v_work_log.status::text IN ('checked_in', 'checked_out') THEN
      RETURN jsonb_build_object('success', false, 'error', 'already_checked_in');
    END IF;

    -- Phase D.1: ts-only write. jsonb 컬럼은 sync trigger 가 빈 값으로 남겨둠 (Phase D.3 DROP).
    UPDATE work_logs SET
      status = 'checked_in',
      check_in_ts = p_check_time,
      updated_at = p_check_time
    WHERE id = p_work_log_id;

    RETURN jsonb_build_object(
      'success', true,
      'action', 'checkIn',
      'check_in_time', v_now,
      'work_duration', 0
    );

  ELSIF p_action = 'checkOut' THEN
    IF v_work_log.status::text != 'checked_in' THEN
      RETURN jsonb_build_object('success', false, 'error', 'not_checked_in');
    END IF;

    IF v_work_log.check_in_ts IS NOT NULL THEN
      v_duration_minutes := EXTRACT(EPOCH FROM (p_check_time - v_work_log.check_in_ts)) / 60;
      v_work_duration := GREATEST(0, ROUND((v_duration_minutes / 60)::numeric * 100) / 100);
    END IF;

    UPDATE work_logs SET
      status = 'checked_out',
      check_out_ts = p_check_time,
      work_duration = v_work_duration,
      updated_at = p_check_time
    WHERE id = p_work_log_id;

    RETURN jsonb_build_object(
      'success', true,
      'action', 'checkOut',
      'check_out_time', v_now,
      'work_duration', v_work_duration
    );

  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'invalid_action');
  END IF;
END;
$$;

COMMENT ON FUNCTION public.process_qr_checkin_atomically(
  uuid, uuid, uuid, text, timestamptz, text
) IS 'Phase D.1: ts-only write. check_in_time/check_out_time jsonb 쓰기 제거. Phase D.3 에서 jsonb 컬럼 DROP 예정.';
```

> **중요**: jsonb 버전의 `_fmt_worklog_time(jsonb)` 는 Phase D.3 migration 에서 DROP. 지금은 남겨둠 (CREATE OR REPLACE 가 signature 를 덮지 못함 — overload 추가만 됨).

- [ ] **Step 2: MCP `apply_migration` 적용**

`mcp__supabase__apply_migration({ name: "worklog_ts_phase_d_1_db_functions_to_ts", query: <위 SQL> })`

Expected: `{ success: true }`

- [ ] **Step 3: DB smoke test — notify trigger 검증**

```sql
-- Phase D.1 trigger smoke test: check_in_ts 만 UPDATE 해도 notify 발생
-- (실제 notification 생성 후 롤백)
BEGIN;
  WITH target AS (
    SELECT id FROM work_logs WHERE status = 'scheduled' LIMIT 1
  )
  UPDATE work_logs SET check_in_ts = now()
  WHERE id IN (SELECT id FROM target);

  -- 방금 생성된 notification 확인
  SELECT type, title, left(body, 40) as body_preview
  FROM public.notifications
  WHERE type IN ('work_log_check_in')
    AND created_at > now() - INTERVAL '5 seconds'
  ORDER BY created_at DESC
  LIMIT 3;
ROLLBACK;
```

Expected: 최소 1건 insert (스태프 또는 구인자 notification).

- [ ] **Step 4: DB smoke test — RPC 검증**

```sql
BEGIN;
  WITH target AS (
    SELECT id, staff_id, job_posting_id FROM work_logs WHERE status = 'scheduled' LIMIT 1
  )
  SELECT public.process_qr_checkin_atomically(
    t.id, t.staff_id, t.job_posting_id, 'checkIn', now(), NULL
  ) AS rpc_result
  FROM target t;

  -- check_in_time jsonb 는 이제 NULL (sync trigger 는 그대로 동작, 쓰기는 안 함)
  SELECT id, check_in_time, check_in_ts, status
  FROM work_logs
  WHERE status = 'checked_in'
  ORDER BY updated_at DESC LIMIT 1;
ROLLBACK;
```

Expected: `status=checked_in`, `check_in_ts` 값 있음. `check_in_time` 은 NULL (sync trigger 는 jsonb UPDATE 감지하므로 트리거가 안 발동).

- [ ] **Step 5: 커밋**

```bash
git add uniqn-mobile/supabase/migrations/20260421190000_worklog_ts_phase_d_1_db_functions_to_ts.sql
git commit -m "feat(supabase): Phase D.1 — work_logs DB 함수 timestamptz 전환

- _fmt_worklog_time(timestamptz) 오버로드 추가
- notify_on_work_log_checkinout_update: check_in_ts/check_out_ts 기반으로 rewrite
- tr_notify_work_log_checkinout trigger UPDATE OF 컬럼 전환
- fn_send_review_reminders: check_out_ts 사용
- process_qr_checkin_atomically: ts-only write (jsonb 제거)

DB smoke test PASS: ts UPDATE → notify insert / RPC → check_in_ts 직접 set"
```

---

## Task 2: Writer 코드 전환 — WorkLogRepositoryTransactions

**Files:**
- Modify: `uniqn-mobile/src/repositories/supabase/WorkLogRepositoryTransactions.ts:67-77`

- [ ] **Step 1: executeUpdateWorkTime 의 write 경로 ts 로 전환**

`WorkLogRepositoryTransactions.ts:67-77` 의 updateData 구성부 수정.

```typescript
    // 3. 업데이트 데이터 구성
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.checkInTime) {
      updateData.check_in_ts = updates.checkInTime.toISOString();
    }

    if (updates.checkOutTime) {
      updateData.check_out_ts = updates.checkOutTime.toISOString();
    }

    if (updates.notes !== undefined) {
      updateData.notes = updates.notes;
    }
```

> **Why ISO string?** Supabase PostgREST 가 timestamptz 에 ISO string 을 그대로 캐스트.

- [ ] **Step 2: type check**

Run: `npx tsc --noEmit`
Expected: exit 0

- [ ] **Step 3: Jest 확인**

Run: `npx jest --testPathPattern="WorkLog|qrCheckin" --no-coverage`
Expected: all PASS

- [ ] **Step 4: 커밋**

```bash
git add uniqn-mobile/src/repositories/supabase/WorkLogRepositoryTransactions.ts
git commit -m "refactor(worklog): Phase D.2 — executeUpdateWorkTime check_in_ts/check_out_ts 직접 쓰기"
```

---

## Task 3: Writer 코드 전환 — SettlementRepository

**Files:**
- Modify: `uniqn-mobile/src/repositories/supabase/SettlementRepository.ts:134-142`

- [ ] **Step 1: updateWorkTimeWithTransaction 의 write 경로 ts 로 전환**

```typescript
      if (context.checkInTime !== undefined) {
        updateData.check_in_ts = context.checkInTime ? context.checkInTime.toISOString() : null;
      }

      if (context.checkOutTime !== undefined) {
        updateData.check_out_ts = context.checkOutTime
          ? context.checkOutTime.toISOString()
          : null;
      }
```

- [ ] **Step 2: type check + jest**

Run:
```bash
npx tsc --noEmit && npx jest --testPathPattern="settlement|Settlement" --no-coverage
```
Expected: exit 0 / all PASS

- [ ] **Step 3: 커밋**

```bash
git add uniqn-mobile/src/repositories/supabase/SettlementRepository.ts
git commit -m "refactor(settlement): Phase D.3 — updateWorkTimeWithTransaction ts 직접 쓰기"
```

---

## Task 4: Writer 코드 전환 — ConfirmedStaffRepository

**Files:**
- Modify: `uniqn-mobile/src/repositories/supabase/ConfirmedStaffRepository.ts:243-251`

- [ ] **Step 1: write 경로 ts 로 전환**

```typescript
      if (context.checkInTime !== undefined) {
        updateData.check_in_ts = context.checkInTime ? context.checkInTime.toISOString() : null;
      }

      if (context.checkOutTime !== undefined) {
        updateData.check_out_ts = context.checkOutTime
          ? context.checkOutTime.toISOString()
          : null;
      }
```

- [ ] **Step 2: type check + jest**

Run:
```bash
npx tsc --noEmit && npx jest --testPathPattern="Confirmed|confirmed" --no-coverage
```
Expected: exit 0 / all PASS

- [ ] **Step 3: 커밋**

```bash
git add uniqn-mobile/src/repositories/supabase/ConfirmedStaffRepository.ts
git commit -m "refactor(staff): Phase D.4 — ConfirmedStaff updateWorkTime ts 직접 쓰기"
```

---

## Task 5: Writer 코드 전환 — ApplicationRepositoryTransactions null init

**Files:**
- Modify: `uniqn-mobile/src/repositories/supabase/ApplicationRepositoryTransactions.ts:378-379`

- [ ] **Step 1: INSERT 시 null 초기화를 ts 컬럼으로**

`createWorkLogsForConfirmation` 의 workLogInserts 배열에서:

```typescript
      workLogInserts.push({
        staff_id: applicationData.applicantId,
        staff_name: applicationData.applicantName,
        job_posting_id: applicationData.jobPostingId,
        job_posting_name: jobData.title,
        owner_id: jobData.ownerId,
        role: normalizedRole.role,
        custom_role: normalizedRole.customRole ?? null,
        date,
        time_slot: assignment.timeSlot,
        is_time_to_be_announced: assignment.isTimeToBeAnnounced ?? false,
        tentative_description: assignment.tentativeDescription ?? null,
        status: STATUS.WORK_LOG.SCHEDULED,
        check_in_ts: null,
        check_out_ts: null,
        work_duration: null,
        payroll_amount: null,
        is_settled: false,
        assignment_group_id: assignment.groupId ?? null,
        check_method: assignment.checkMethod ?? 'individual',
        created_at: now,
        updated_at: now,
      });
```

> **Why explicit null?** Supabase INSERT 는 키가 없어도 NULL 이 들어가지만, 계약 명시성을 위해 유지. 대안은 키 전체 삭제.

- [ ] **Step 2: type check + jest**

Run:
```bash
npx tsc --noEmit && npx jest --testPathPattern="confirmCreatesWorkLog|Application" --no-coverage
```
Expected: exit 0 / all PASS

- [ ] **Step 3: 커밋**

```bash
git add uniqn-mobile/src/repositories/supabase/ApplicationRepositoryTransactions.ts
git commit -m "refactor(application): Phase D.5 — createWorkLogsForConfirmation ts 컬럼 초기화"
```

---

## Task 6: UserRepository exportUserData ts-only

**Files:**
- Modify: `uniqn-mobile/src/repositories/supabase/UserRepository.ts:506-510, 535-540`

- [ ] **Step 1: select 에서 jsonb 제거**

```typescript
supabase
  .from(TABLES.WORK_LOGS)
  .select('id, date, check_in_ts, check_out_ts')
  .eq('staff_id', userId),
```

- [ ] **Step 2: row 매핑 ts 로 교체**

```typescript
const workLogs = ((workLogsResult.data ?? []) as Record<string, unknown>[]).map((row) => ({
  id: row.id as string,
  date: (row.date as string) ?? '',
  checkInAt: (row.check_in_ts as string) ?? undefined,
  checkOutAt: (row.check_out_ts as string) ?? undefined,
}));
```

- [ ] **Step 3: type check**

Run: `npx tsc --noEmit`
Expected: exit 0

- [ ] **Step 4: 커밋**

```bash
git add uniqn-mobile/src/repositories/supabase/UserRepository.ts
git commit -m "refactor(user): Phase D.6 — exportUserData ts-only select + 매핑"
```

---

## Task 7: Reader 단순화 — TABLE_COLUMNS + applyTsPreference

**Files:**
- Modify: `uniqn-mobile/src/repositories/supabase/WorkLogRepositoryHelpers.ts:20-36`

- [ ] **Step 1: TABLE_COLUMNS 에서 jsonb 컬럼 제거 + applyTsPreference 단순화**

```typescript
export const TABLE_COLUMNS =
  'id,application_id,assignment_group_id,check_in_ts,check_out_ts,created_at,custom_allowances,custom_role,custom_salary_info,custom_tax_settings,date,has_time_modification_logs,is_fixed_posting,job_posting_id,modification_history,no_show_at,no_show_reason,notes,owner_id,payroll_amount,payroll_date,payroll_notes,payroll_status,role,role_change_history,settlement_modification_history,staff_id,staff_name,staff_nickname,staff_photo_url,staff_photo_url_blurhash,status,time_slot,updated_at' as const;

// ============================================================================
// Mapping Functions
// ============================================================================

// Phase D: jsonb 컬럼 제거 후 checkInTs/checkOutTs (timestamptz, PostgREST ISO string) 단일 소스.
function applyTsPreference(camel: Record<string, unknown>): Record<string, unknown> {
  return {
    ...camel,
    checkInTime: camel.checkInTs ?? null,
    checkOutTime: camel.checkOutTs ?? null,
  };
}

export function toWorkLog(row: Record<string, unknown>): WorkLog | null {
  const camel = toCamelCase<Record<string, unknown>>(row);
  return parseWorkLogDocument({ ...applyTsPreference(camel), id: row.id });
}

export function rowsToWorkLogs(rows: Record<string, unknown>[]): WorkLog[] {
  return parseWorkLogDocuments(
    rows.map((row) => ({
      ...applyTsPreference(toCamelCase<Record<string, unknown>>(row)),
      id: row.id,
    }))
  );
}
```

- [ ] **Step 2: type check + Jest 전체**

Run:
```bash
npx tsc --noEmit && npx jest --testPathPattern="WorkLog|qrCheckin|settlement|Confirmed" --no-coverage
```
Expected: exit 0 / all PASS

- [ ] **Step 3: 커밋**

```bash
git add uniqn-mobile/src/repositories/supabase/WorkLogRepositoryHelpers.ts
git commit -m "refactor(worklog): Phase D.7 — TABLE_COLUMNS jsonb 제거 + applyTsPreference 단순화"
```

---

## Task 8: 전체 코드 회귀 검증 (pre-DROP gate)

**Files:**
- None (verification only)

- [ ] **Step 1: 코드베이스에 jsonb 컬럼 직접 참조 0건 확인**

Run:
```bash
grep -rn "check_in_time\|check_out_time" uniqn-mobile/src | grep -v "database.types.ts\|supabase.ts\|qrCheckinAtomic.test.ts"
```

Expected: 출력 비어있음 (database.types.ts / types/supabase.ts 는 generated, qrCheckinAtomic.test.ts 는 RPC response key 라 OK).

- [ ] **Step 2: npm run quality**

Run: `npm run quality`
Expected: exit 0

- [ ] **Step 3: 전체 Jest 실행**

Run: `npm test -- --no-coverage 2>&1 | tail -10`
Expected: Phase C 기준 3940 PASS 유지 (Phase C 와 동일한 선행 실패 2건만 허용)

- [ ] **Step 4: DB 의존성 재확인 — 함수 내 jsonb 참조 0건**

```sql
SELECT p.proname
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.prokind = 'f'
  AND pg_get_functiondef(p.oid) ~* '(NEW|OLD|v_work_log)\.check_(in|out)_time\b';
```

Expected: 결과 없음 (fn_sync_work_log_ts 는 이 조건에 걸릴 수 있으니 확인 후 Task 9 에서 함께 DROP).

- [ ] **Step 5: 사용자에게 destructive migration 진입 확인 요청**

> **⚠ STOP AND ASK**: Task 9 는 `DROP COLUMN` 과 `DROP TRIGGER` 를 포함한 destructive migration. 사용자에게 `"Phase D 최종 DROP 진행해도 됩니까?"` 명시 확인 받은 후 Task 9 진입.

---

## Task 9: Destructive DROP migration (사용자 명시 확인 필수)

**Files:**
- Create: `uniqn-mobile/supabase/migrations/20260421200000_worklog_ts_phase_d_3_drop_jsonb_columns.sql`

- [ ] **Step 1: migration 파일 작성**

```sql
-- work_logs timestamptz 전환 Phase D.3 (DESTRUCTIVE)
-- 목표: jsonb 컬럼 + sync trigger + jsonb 오버로드 함수 DROP
-- 사전 조건 (Task 8 검증 완료):
--   1. 앱 코드: check_in_time/check_out_time 직접 참조 0건
--   2. DB 함수: check_in_time/check_out_time 참조 0건 (fn_sync_work_log_ts 제외)
--   3. 모든 writer 가 check_in_ts/check_out_ts 로 전환됨
-- 참조: docs/superpowers/plans/2026-04-21-worklog-timestamptz-phase-d.md Task 9

-- 1. sync trigger + 함수 DROP
DROP TRIGGER IF EXISTS tr_sync_work_log_ts ON public.work_logs;
DROP FUNCTION IF EXISTS public.fn_sync_work_log_ts();

-- 2. jsonb 오버로드 _fmt_worklog_time(jsonb) DROP (timestamptz 버전만 남김)
DROP FUNCTION IF EXISTS public._fmt_worklog_time(jsonb);

-- 3. jsonb 컬럼 DROP
ALTER TABLE public.work_logs DROP COLUMN check_in_time;
ALTER TABLE public.work_logs DROP COLUMN check_out_time;

COMMENT ON COLUMN public.work_logs.check_in_ts IS '출근 시각 (timestamptz). Phase D.3 에서 jsonb check_in_time 제거됨 (2026-04-21).';
COMMENT ON COLUMN public.work_logs.check_out_ts IS '퇴근 시각 (timestamptz). Phase D.3 에서 jsonb check_out_time 제거됨 (2026-04-21).';
```

- [ ] **Step 2: 사용자 confirm 재확인**

> 사용자에게 다음 문장 출력: `"Phase D.3 DROP migration 을 apply 합니다. 되돌릴 수 없습니다. 진행할까요? (yes/no)"`. `yes` 응답 받은 후 Step 3.

- [ ] **Step 3: MCP `apply_migration` 적용**

`mcp__supabase__apply_migration({ name: "worklog_ts_phase_d_3_drop_jsonb_columns", query: <위 SQL> })`

Expected: `{ success: true }`

- [ ] **Step 4: DB 상태 확인**

```sql
-- 컬럼 제거 확인
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'work_logs'
  AND column_name IN ('check_in_time', 'check_out_time', 'check_in_ts', 'check_out_ts');
```

Expected: `check_in_ts`, `check_out_ts` 만 반환 (timestamp with time zone).

```sql
-- 트리거 제거 확인
SELECT tgname FROM pg_trigger
WHERE tgrelid = 'public.work_logs'::regclass AND tgname = 'tr_sync_work_log_ts';
```

Expected: 빈 결과.

```sql
-- jsonb _fmt_worklog_time 제거 확인
SELECT p.proname, pg_get_function_arguments(p.oid) as args
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' AND p.proname = '_fmt_worklog_time';
```

Expected: `p_ts timestamp with time zone` 버전 1개만.

- [ ] **Step 5: TypeScript types regenerate**

`mcp__supabase__generate_typescript_types()` 호출 → 결과를 `src/types/supabase.ts` 와 `src/lib/database.types.ts` 에 덮어쓰기.

- [ ] **Step 6: type check + Jest 전체**

Run:
```bash
npm run quality && npm test -- --no-coverage 2>&1 | tail -10
```
Expected: exit 0 / 기존 수준 PASS.

- [ ] **Step 7: 커밋**

```bash
git add uniqn-mobile/supabase/migrations/20260421200000_worklog_ts_phase_d_3_drop_jsonb_columns.sql \
        uniqn-mobile/src/types/supabase.ts \
        uniqn-mobile/src/lib/database.types.ts
git commit -m "feat(supabase)!: Phase D.3 — work_logs jsonb check_in_time/check_out_time DROP

DESTRUCTIVE:
- DROP COLUMN check_in_time, check_out_time (jsonb)
- DROP TRIGGER tr_sync_work_log_ts + fn_sync_work_log_ts
- DROP FUNCTION _fmt_worklog_time(jsonb)

Migration 분기점: 이 커밋 이후 rollback 은 새 컬럼 추가 + 전체 데이터 backfill 필요.
TypeScript types regenerated via MCP generate_typescript_types."
```

---

## Task 10: REFACTOR-5.md + 메모리 업데이트 + 최종 보고

**Files:**
- Modify: `.gstack/qa-reports/REFACTOR-5.md` (local, gitignored)
- Modify: `C:\Users\user\.claude\projects\C--Users-user-Desktop-T-HOLDEM\memory\project_worklog_timestamptz_migration.md`

- [ ] **Step 1: REFACTOR-5.md Phase D 완료 반영**

테이블 D 행을 `✅ 완료` 로, "Phase D 산출물" 섹션 추가 (commit list + migration 목록 + 검증 증거).

- [ ] **Step 2: 메모리 업데이트**

`project_worklog_timestamptz_migration.md` 의 Phase D 섹션을 완료 상태로 업데이트. Phase D.3 migration 이름, TypeScript types regenerate 기록, jsonb 완전 제거 명시.

- [ ] **Step 3: 최종 증거 수집**

Run:
```bash
git log --oneline -n 15
```

Phase D 관련 10+ commits 확인 후 사용자에게 완료 보고.

---

## 롤백 전략

| 단계 | 롤백 방법 |
|------|----------|
| Task 1 (DB 함수 refactor) | `CREATE OR REPLACE` 로 Phase C 버전 재적용 |
| Task 2-7 (코드) | 단일 커밋 revert — `git revert <sha>` |
| Task 9 (DROP) | **사실상 불가** — 새 jsonb 컬럼 추가 + ts → jsonb 재 backfill 필요. 진행 전 사용자 확인 필수 |

## 제외된 범위 (명시)

- **컬럼 rename (`check_in_ts` → `check_in_time`)**: 앱 전역 파급이 커서 별도 작업. 장기적으로는 rename 가능하지만 현재 우선순위 낮음.
- **RPC 응답 payload 키 이름**: `check_in_time` / `check_out_time` 키 유지 (클라이언트 계약 안정화).
- **도메인 타입 `WorkLog.checkInTime` / `checkOutTime`**: 유지. mapper 가 ISO string 으로 전달.
- **Zod 스키마**: 2026-04-19 에 이미 ISO string 정규화. 추가 변경 없음.

## Self-Review 체크리스트

### Spec coverage
| 요구 | 대응 Task |
|------|-----------|
| DB 함수들을 ts 로 refactor (notify, review, RPC) | Task 1 |
| 모든 writer 가 ts 에 쓰기 | Task 2-5 |
| UserRepository export ts-only | Task 6 |
| TABLE_COLUMNS + mapper 단순화 | Task 7 |
| 코드 회귀 검증 gate | Task 8 |
| jsonb DROP + trigger DROP + 함수 DROP | Task 9 |
| 문서 + 메모리 업데이트 | Task 10 |

### Placeholder scan
- ❌ "TBD", "implement later" 없음
- ❌ "Similar to Task N" 없음
- ✅ 모든 SQL/TS 코드 블록 실제 내용 포함

### Type consistency
- DB 컬럼명: `check_in_ts`, `check_out_ts` 일관
- 앱 레이어: `checkInTime`, `checkOutTime` (도메인 타입) 유지
- RPC 응답 키: `check_in_time`, `check_out_time` 유지 (문자열 contract)
- `applyTsPreference` 단순화된 버전 1종만 (Task 7 에서 확정)

### 안전장치
- Task 8 = pre-DROP verification gate (grep + DB 쿼리 + 테스트)
- Task 9 Step 2 = 사용자 명시 confirm 단계
- Task 9 Step 4 = post-DROP DB 상태 검증
